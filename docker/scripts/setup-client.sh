#!/bin/bash
set -e

echo "=== Setting up Windows Client ==="

DOMAIN_NAME=${DOMAIN_NAME:-applocker.local}
DOMAIN_ADMIN_USER=${DOMAIN_ADMIN_USER:-Administrator}
DOMAIN_ADMIN_PASSWORD=${DOMAIN_ADMIN_PASSWORD:-SecurePass123!}
DNS_SERVER=${DNS_SERVER:-domain-controller}

# Configure DNS
echo "nameserver ${DNS_SERVER}" > /etc/resolv.conf
echo "search ${DOMAIN_NAME}" >> /etc/resolv.conf

# Configure Kerberos
cat > /etc/krb5.conf <<EOF
[libdefaults]
    default_realm = ${DOMAIN_NAME^^}
    dns_lookup_realm = true
    dns_lookup_kdc = true

[realms]
    ${DOMAIN_NAME^^} = {
        kdc = ${DNS_SERVER}
        admin_server = ${DNS_SERVER}
    }

[domain_realm]
    .${DOMAIN_NAME} = ${DOMAIN_NAME^^}
    ${DOMAIN_NAME} = ${DOMAIN_NAME^^}
EOF

# Wait for domain controller to be ready
echo "Waiting for domain controller..."
until ping -c 1 ${DNS_SERVER} > /dev/null 2>&1; do
    echo "Waiting for ${DNS_SERVER}..."
    sleep 5
done

# Join domain (if not already joined)
if [ ! -f /etc/samba/smb.conf ]; then
    echo "Joining domain..."
    # Note: This is a simplified version. Real domain join requires more configuration
    cat > /etc/samba/smb.conf <<EOF
[global]
    workgroup = ${DOMAIN_NAME%%.*}
    realm = ${DOMAIN_NAME^^}
    security = ads
    dns forwarder = 8.8.8.8
EOF
fi

# Setup WinRM simulator (Python-based)
cat > /usr/local/bin/winrm-server.py <<'PYTHON_EOF'
#!/usr/bin/env python3
import http.server
import socketserver
import json
from urllib.parse import urlparse, parse_qs

class WinRMHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/soap+xml')
        self.end_headers()
        
        response = '''<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
    <s:Body>
        <rsp:CommandResponse xmlns:rsp="http://schemas.microsoft.com/wbem/wsman/1/windows/shell">
            <rsp:CommandId>test-command-id</rsp:CommandId>
            <rsp:State>http://schemas.microsoft.com/wbem/wsman/1/windows/shell/CommandState/Done</rsp:State>
        </rsp:CommandResponse>
    </s:Body>
</s:Envelope>'''
        self.wfile.write(response.encode())

if __name__ == "__main__":
    PORT = 5985
    with socketserver.TCPServer(("", PORT), WinRMHandler) as httpd:
        print(f"WinRM simulator listening on port {PORT}")
        httpd.serve_forever()
PYTHON_EOF

chmod +x /usr/local/bin/winrm-server.py

# Start WinRM simulator in background
nohup python3 /usr/local/bin/winrm-server.py > /var/log/winrm.log 2>&1 &

echo "=== Client setup complete ==="
echo "Domain: ${DOMAIN_NAME}"
echo "DNS Server: ${DNS_SERVER}"

# Keep container running
tail -f /dev/null
