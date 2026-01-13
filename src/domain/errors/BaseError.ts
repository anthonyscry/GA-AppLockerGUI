/**
 * Base Error Class
 * Foundation for all application errors
 */

export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    public readonly cause?: Error,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error to JSON for logging/API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.message;
  }
}

/**
 * Validation Error
 * Thrown when input validation fails
 */
export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly field?: string,
    cause?: Error,
    context?: Record<string, unknown>
  ) {
    super(message, cause, { ...context, field });
  }
}

/**
 * Not Found Error
 * Thrown when a requested resource doesn't exist
 */
export class NotFoundError extends BaseError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(
    resource: string,
    identifier?: string,
    cause?: Error
  ) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, cause, { resource, identifier });
  }
}

/**
 * External Service Error
 * Thrown when external service calls fail
 */
export class ExternalServiceError extends BaseError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;

  constructor(
    service: string,
    message: string,
    cause?: Error,
    context?: Record<string, unknown>
  ) {
    super(`External service error (${service}): ${message}`, cause, {
      ...context,
      service,
    });
  }
}

/**
 * Authentication Error
 * Thrown when authentication fails
 */
export class AuthenticationError extends BaseError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly statusCode = 401;

  constructor(message: string = 'Authentication failed', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Authorization Error
 * Thrown when user lacks required permissions
 */
export class AuthorizationError extends BaseError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly statusCode = 403;

  constructor(
    resource: string,
    action: string,
    cause?: Error
  ) {
    super(`Unauthorized: Cannot ${action} ${resource}`, cause, {
      resource,
      action,
    });
  }
}

/**
 * Conflict Error
 * Thrown when operation conflicts with current state
 */
export class ConflictError extends BaseError {
  readonly code = 'CONFLICT_ERROR';
  readonly statusCode = 409;

  constructor(message: string, cause?: Error, context?: Record<string, unknown>) {
    super(message, cause, context);
  }
}

/**
 * Internal Error
 * Thrown for unexpected internal errors
 */
export class InternalError extends BaseError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;

  constructor(message: string, cause?: Error, context?: Record<string, unknown>) {
    super(message, cause, context);
  }
}
