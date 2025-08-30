/**
 * Type definitions for SharedStorageService
 * Provides cross-service file access for microservices architecture
 */

export interface ISharedStorageService {
  /**
   * Get the session path for a specific service
   * @param sessionId - UUID of the session
   * @param service - Name of the requesting service
   * @returns Promise resolving to absolute session path
   */
  getSessionPath(sessionId: string, service: string): Promise<string>;

  /**
   * Access a file from a session directory
   * @param sessionId - UUID of the session
   * @param filepath - Relative path within session directory
   * @param service - Name of the requesting service
   * @returns Promise resolving to file buffer
   */
  accessFile(sessionId: string, filepath: string, service: string): Promise<Buffer>;

  /**
   * Check if service has permissions to access session
   * @param sessionId - UUID of the session
   * @param service - Name of the requesting service
   * @returns Promise resolving to permission status
   */
  checkPermissions(sessionId: string, service: string): Promise<boolean>;

  /**
   * List files in session directory
   * @param sessionId - UUID of the session
   * @param subPath - Optional subdirectory path (e.g., 'converted_images')
   * @param service - Name of the requesting service
   * @returns Promise resolving to array of file paths
   */
  listFiles(sessionId: string, subPath: string, service: string): Promise<string[]>;

  /**
   * Check if file exists in session
   * @param sessionId - UUID of the session
   * @param filepath - Relative path within session directory
   * @param service - Name of the requesting service
   * @returns Promise resolving to existence status
   */
  fileExists(sessionId: string, filepath: string, service: string): Promise<boolean>;
}

export interface SessionPathConfig {
  readonly baseSessionPath: string;
  readonly serviceMap: Record<string, ServiceConfig>;
}

export interface ServiceConfig {
  readonly name: string;
  readonly permissions: ServicePermissions;
  readonly allowedSessionPatterns?: string[];
}

export interface ServicePermissions {
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly allowedSubPaths: string[];
}

export interface SharedStorageError {
  readonly code: string;
  readonly message: string;
  readonly sessionId?: string;
  readonly service?: string;
  readonly filepath?: string;
  readonly timestamp: string;
}

export class SharedStorageServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly sessionId?: string,
    public readonly service?: string,
    public readonly filepath?: string
  ) {
    super(message);
    this.name = 'SharedStorageServiceError';
  }

  toJSON(): SharedStorageError {
    return {
      code: this.code,
      message: this.message,
      sessionId: this.sessionId,
      service: this.service,
      filepath: this.filepath,
      timestamp: new Date().toISOString(),
    };
  }
}

// Error codes
export const SHARED_STORAGE_ERRORS = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SERVICE_UNAUTHORIZED: 'SERVICE_UNAUTHORIZED',
  PATH_TRAVERSAL_DETECTED: 'PATH_TRAVERSAL_DETECTED',
  FILE_ACCESS_ERROR: 'FILE_ACCESS_ERROR',
  INVALID_SESSION_ID: 'INVALID_SESSION_ID',
  INVALID_SERVICE_NAME: 'INVALID_SERVICE_NAME',
} as const;

export type SharedStorageErrorCode = typeof SHARED_STORAGE_ERRORS[keyof typeof SHARED_STORAGE_ERRORS];