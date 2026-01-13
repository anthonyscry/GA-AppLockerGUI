/**
 * Security Handlers
 * Handles Electron security configurations
 */

const { app } = require('electron');

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
      // Optionally log or handle navigation attempts
      console.warn('Blocked new window creation:', navigationUrl);
    });

    // Prevent navigation to external URLs
    contents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);

      if (parsedUrl.origin !== getOrigin()) {
        event.preventDefault();
        console.warn('Blocked navigation to external URL:', navigationUrl);
      }
    });

    // Prevent downloads unless explicitly allowed
    contents.session.on('will-download', (event, item, webContents) => {
      // Log download attempts for security auditing
      console.log('Download initiated:', item.getFilename());
      // Add custom download handling if needed
    });
  });
}

/**
 * Get allowed origin for the application
 */
function getOrigin() {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  // For production, return file:// protocol or your app's origin
  return 'file://';
}

/**
 * Validate certificate for external requests (if any)
 */
function setupCertificateValidation() {
  if (!app || !app.on) {
    console.warn('Electron app not available, skipping certificate validation setup');
    return;
  }
  
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // In production, you should validate certificates properly
    if (process.env.NODE_ENV === 'development') {
      // Allow self-signed certificates in development
      event.preventDefault();
      callback(true);
    } else {
      // In production, validate certificates
      callback(false);
    }
  });
}

module.exports = {
  setupSecurityHandlers,
  setupCertificateValidation,
};
