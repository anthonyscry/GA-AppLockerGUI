#!/bin/bash
set -e

echo "=== Setting up Active Directory Domain Controller ==="

DOMAIN_NAME=${DOMAIN_NAME:-applocker.local}
DOMAIN_NETBIOS=${DOMAIN_NETBIOS:-APPLOCKER}
DOMAIN_ADMIN_PASSWORD=${DOMAIN_ADMIN_PASSWORD:-SecurePass123!}
DNS_FORWARDER=${DNS_FORWARDER:-8.8.8.8}

# Configure Kerberos
cat > /etc/krb5.conf <<EOF
[libdefaults]
    default_realm = ${DOMAIN_NAME^^}
    dns_lookup_realm = false
    dns_lookup_kdc = true

[realms]
    ${DOMAIN_NAME^^} = {
        kdc = localhost
        admin_server = localhost
    }

[domain_realm]
    .${DOMAIN_NAME} = ${DOMAIN_NAME^^}
    ${DOMAIN_NAME} = ${DOMAIN_NAME^^}
EOF

# Configure Samba AD
cat > /etc/samba/smb.conf <<EOF
[global]
    workgroup = ${DOMAIN_NETBIOS}
    realm = ${DOMAIN_NAME^^}
    netbios name = DC01
    server role = active directory domain controller
    dns forwarder = ${DNS_FORWARDER}
    
    # Security settings
    security = ads
    encrypt passwords = yes
    
    # Logging
    log file = /var/log/samba/log.%m
    log level = 1
    
    # Performance
    socket options = TCP_NODELAY IPTOS_LOWDELAY SO_RCVBUF=131072 SO_SNDBUF=131072
    read raw = yes
    write raw = yes
    
    # Samba AD specific
    idmap_ldb:use rfc2307 = yes
    
[netlogon]
    path = /var/lib/samba/sysvol/${DOMAIN_NAME}/scripts
    read only = no

[sysvol]
    path = /var/lib/samba/sysvol
    read only = no
EOF

# Provision Samba AD domain (only if not already provisioned)
if [ ! -f /var/lib/samba/private/secrets.tdb ]; then
    echo "Provisioning Samba AD domain..."
    samba-tool domain provision \
        --realm=${DOMAIN_NAME^^} \
        --domain=${DOMAIN_NETBIOS} \
        --server-role=dc \
        --dns-backend=SAMBA_INTERNAL \
        --adminpass=${DOMAIN_ADMIN_PASSWORD} \
        --use-rfc2307 \
        --function-level=2008_R2
fi

# Start Samba services
echo "Starting Samba services..."
supervisord -c /etc/supervisor/supervisord.conf || true

# Wait for services to be ready
echo "Waiting for AD DS services to start..."
sleep 10

# Create test users and groups
echo "Creating test users and groups..."
samba-tool user create testuser1 "TestUser1@123" || true
samba-tool user create testuser2 "TestUser2@123" || true
samba-tool group add "AppLocker-Users" || true
samba-tool group add "AppLocker-Admins" || true
samba-tool group addmembers "AppLocker-Users" testuser1,testuser2 || true

echo "=== Domain Controller setup complete ==="
echo "Domain: ${DOMAIN_NAME}"
echo "NetBIOS: ${DOMAIN_NETBIOS}"
echo "Admin Password: ${DOMAIN_ADMIN_PASSWORD}"

# Keep container running
tail -f /var/log/samba/log.smbd
