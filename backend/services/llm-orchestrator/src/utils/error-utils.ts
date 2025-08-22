/**
 * Error utility functions for consistent error handling
 */

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

/**
 * Get error details from unknown error type
 */
export function getErrorDetails(error: unknown): any {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
  }
  return { error: String(error) };
}

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Convert optional value to required with undefined union
 */
export function optionalToUndefined<T>(value: T | undefined): T | undefined {
  return value;
}