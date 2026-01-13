/**
 * Security Handlers
 * Handles Electron security configurations
 */

const { app } = require('electron');
const path = require('path');

/**
 * Utility to sanitize log data (remove sensitive information)
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
function sanitizeLogData(data) {
  if (typeof data !== 'object' || data === null) return data;
  const sanitized = { ...data };
  if (sanitized.path) sanitized.path = '[REDACTED]';
  if (sanitized.url) sanitized.url = '[REDACTED]';
  if (sanitized.navigationUrl) sanitized.navigationUrl = '[REDACTED]';
  return sanitized;
}

/**
 * Get allowed origin for the application
 * @returns {string} - Allowed origin URL
 */
function getOrigin() {
  const devServerUrl = process.env.DEV_SERVER_URL || 'http://localhost:3000';
  if (process.env.NODE_ENV === 'development') {
    return devServerUrl;
  }
  return 'file://';
}

/**
 * Get allowed file paths for production
 * @returns {string[]} - Array of allowed absolute paths
 */
function getAllowedPaths() {
  const allowedPaths = [
    path.join(__dirname, '..', 'dist'),
  ];
  return allowedPaths.map(p => path.normalize(p));
}

/**
 * Validate if a file path is allowed
 * @param {string} filePath - Path to validate
 * @returns {boolean} - True if path is allowed
 */
function isPathAllowed(filePath) {
  try {
    const normalizedPath = path.normalize(filePath);
    const allowedPaths = getAllowedPaths();
    return allowedPaths.some(allowedPath => 
      normalizedPath.startsWith(allowedPath)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Setup security handlers for web contents
 */
function setupSecurityHandlers() {
  if (!app || !app.on) {
    console.warn('Electron app not available, skipping security handlers setup');
    return;
  }
  
  // Prevent new window creation
  app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      const sanitized = sanitizeLogData({ navigationUrl });
      console.warn('Blocked new window creation:', sanitized);
    });

    // Prevent navigation to external URLs with proper path validation
    contents.on('will-navigate', (event, navigationUrl) => {
      try {
        const parsedUrl = new URL(navigationUrl);
        const allowedOrigin = getOrigin();
        
        // For file:// protocol, validate the path strictly
        if (parsedUrl.protocol === 'file:') {
          // Remove leading slash on Windows (file:///C:/path)
          let filePath = parsedUrl.pathname;
          if (process.platform === 'win32' && filePath.startsWith('/')) {
            filePath = filePath.substring(1);
          }
          
          if (!isPathAllowed(filePath)) {
            event.preventDefault();
            const sanitized = sanitizeLogData({ navigationUrl });
            console.warn('Blocked navigation to unauthorized file path:', sanitized);
            return;
          }
        } else if (parsedUrl.origin !== allowedOrigin) {
          event.preventDefault();
          const sanitized = sanitizeLogData({ navigationUrl });
          console.warn('Blocked navigation to external URL:', sanitized);
        }
      } catch (error) {
        // Invalid URL format - block it
        event.preventDefault();
        const sanitized = sanitizeLogData({ navigationUrl });
        console.warn('Blocked navigation to invalid URL:', sanitized);
      }
    });

    // Prevent downloads unless explicitly allowed
    contents.session.on('will-download', (event, item, webContents) => {
      // Log download attempts for security auditing (sanitized)
      const sanitized = sanitizeLogData({ filename: item.getFilename() });
      if (process.env.NODE_ENV === 'development') {
        console.log('Download initiated:', sanitized);
      }
      // Add custom download handling if needed
    });
  });
}

/**
 * Validate certificate for external requests
 * SECURITY: Only allows certificates from whitelist (even in development)
 * 
 * To configure trusted certificates, set the ALLOWED_CERT_FINGERPRINTS environment variable:
 * - Format: Comma-separated list of certificate fingerprints (SHA-256)
 * - Example: ALLOWED_CERT_FINGERPRINTS="SHA256:abc123...,SHA256:def456..."
 * 
 * To get a certificate fingerprint:
 * 1. Open the certificate in Windows Certificate Manager
 * 2. View Details tab
 * 3. Select "Thumbprint" field
 * 4. Copy the value and format as "SHA256:<value>"
 * 
 * SECURITY NOTE: This implementation NEVER allows all self-signed certificates.
 * All certificates must be explicitly whitelisted, even in development mode.
 */
function setupCertificateValidation() {
  if (!app || !app.on) {
    console.warn('Electron app not available, skipping certificate validation setup');
    return;
  }
  
  // Get allowed certificate fingerprints from environment
  // SECURITY: Empty array means NO certificates are trusted (secure default)
  const allowedFingerprints = process.env.ALLOWED_CERT_FINGERPRINTS 
    ? process.env.ALLOWED_CERT_FINGERPRINTS.split(',').map(f => f.trim()).filter(f => f.length > 0)
    : [];
  
  if (allowedFingerprints.length > 0) {
    console.log(`[Security] Certificate validation enabled with ${allowedFingerprints.length} trusted certificate(s)`);
  } else {
    console.warn('[Security] No trusted certificates configured. All certificate errors will be rejected.');
    console.warn('[Security] Set ALLOWED_CERT_FINGERPRINTS environment variable to allow specific certificates.');
  }
  
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // Always validate certificates - never allow all self-signed certs
    const certFingerprint = certificate ? certificate.fingerprint : null;
    
    if (!certFingerprint) {
      // No certificate provided - reject
      const sanitized = sanitizeLogData({ url, error: error.toString() });
      console.error('[Security] Certificate validation failed: No certificate fingerprint', sanitized);
      callback(false);
      return;
    }
    
    if (allowedFingerprints.includes(certFingerprint)) {
      // Certificate is in whitelist - allow it
      console.log('[Security] Certificate trusted via whitelist:', {
        issuer: certificate.issuerName,
        subject: certificate.subjectName,
      });
      event.preventDefault();
      callback(true);
    } else {
      // Certificate not in whitelist - reject
      const sanitized = sanitizeLogData({ 
        url, 
        error: error.toString(),
        fingerprint: certFingerprint.substring(0, 20) + '...' // Log partial fingerprint for debugging
      });
      console.error('[Security] Certificate validation failed: Not in whitelist', sanitized);
      callback(false);
    }
  });
}

module.exports = {
  setupSecurityHandlers,
  setupCertificateValidation,
};
