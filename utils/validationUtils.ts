/**
 * Validation Utilities
 * Common validation helper functions
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate hostname format
 */
export function isValidHostname(hostname: string): boolean {
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(hostname);
}

/**
 * Validate OU path format
 */
export function isValidOUPath(ouPath: string): boolean {
  // Basic validation for OU=Workstations,DC=GA-ASI,DC=CORP format
  const ouRegex = /^OU=[^,]+(,DC=[^,]+)+$/i;
  return ouRegex.test(ouPath);
}

/**
 * Validate publisher name format
 */
export function isValidPublisherName(publisher: string): boolean {
  // Publisher names typically follow: O=..., L=..., S=..., C=...
  const publisherRegex = /^O=[^,]+(,\s*(L|S|C)=[^,]+)+$/;
  return publisherRegex.test(publisher);
}

/**
 * Sanitize input to prevent injection
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}
