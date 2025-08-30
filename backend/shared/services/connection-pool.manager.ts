import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * Configuration for connection pooling
 */
export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  maxIdleTime: number;
  connectionTimeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
  acquireTimeout: number;
  validationInterval: number;
}

/**
 * Represents a pooled connection with metadata
 */
export interface PooledConnection {
  id: string;
  created: Date;
  lastUsed: Date;
  isHealthy: boolean;
  activeRequests: number;
  connection: any; // Docker volume connection or filesystem handle
}

/**
 * Connection pool statistics
 */
export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  averageWaitTime: number;
  connectionErrors: number;
  healthCheckErrors: number;
}

/**
 * Connection pool manager for Docker volume access optimization
 */
export class ConnectionPoolManager extends EventEmitter {
  private config: ConnectionPoolConfig;
  private pool: PooledConnection[] = [];
  private waitingQueue: Array<{
    resolve: (connection: PooledConnection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    startTime: number;
  }> = [];
  private stats: PoolStats;
  private healthCheckTimer?: NodeJS.Timeout;
  private validationTimer?: NodeJS.Timeout;

  constructor(config: ConnectionPoolConfig) {
    super();
    this.config = config;
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      averageWaitTime: 0,
      connectionErrors: 0,
      healthCheckErrors: 0,
    };

    this.initializePool();
    this.startHealthMonitoring();
    this.startValidationRoutine();
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<PooledConnection> {
    const startTime = performance.now();
    this.stats.pendingRequests++;

    return new Promise<PooledConnection>((resolve, reject) => {
      // Check if we have an available connection
      const availableConnection = this.pool.find(conn => conn.isHealthy && conn.activeRequests === 0);

      if (availableConnection) {
        this.activateConnection(availableConnection);
        this.stats.pendingRequests--;
        this.updateAverageWaitTime(performance.now() - startTime);
        resolve(availableConnection);
        return;
      }

      // Check if we can create a new connection
      if (this.stats.totalConnections < this.config.maxConnections) {
        try {
          const newConnection = this.createConnection();
          this.pool.push(newConnection);
          this.stats.totalConnections++;
          this.activateConnection(newConnection);
          this.stats.pendingRequests--;
          this.updateAverageWaitTime(performance.now() - startTime);
          resolve(newConnection);
          return;
        } catch (error) {
          this.stats.connectionErrors++;
          this.stats.pendingRequests--;
          reject(new Error(`Failed to create connection: ${(error as Error).message}`));
          return;
        }
      }

      // Add to waiting queue
      const timeout = setTimeout(() => {
        this.removeFromWaitingQueue(resolve, reject);
        this.stats.pendingRequests--;
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      this.waitingQueue.push({
        resolve,
        reject,
        timeout,
        startTime,
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: PooledConnection): Promise<void> {
    try {
      connection.activeRequests--;
      connection.lastUsed = new Date();

      // Check if there's a waiting request
      if (this.waitingQueue.length > 0) {
        const waitingRequest = this.waitingQueue.shift()!;
        clearTimeout(waitingRequest.timeout);
        this.activateConnection(connection);
        this.stats.pendingRequests--;
        this.updateAverageWaitTime(performance.now() - waitingRequest.startTime);
        waitingRequest.resolve(connection);
        return;
      }

      // Return to idle pool
      this.updatePoolStats();
      this.emit('connectionReleased', connection.id);
    } catch (error) {
      this.emit('releaseError', { connectionId: connection.id, error: error as Error });
      throw error;
    }
  }

  /**
   * Get current pool statistics
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Force close all connections
   */
  async close(): Promise<void> {
    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }

    // Clear waiting queue
    for (const request of this.waitingQueue) {
      clearTimeout(request.timeout);
      request.reject(new Error('Pool is shutting down'));
    }
    this.waitingQueue = [];

    // Close all connections
    const closePromises = this.pool.map(async (connection) => {
      try {
        await this.destroyConnection(connection);
      } catch (error) {
        this.emit('closeError', { connectionId: connection.id, error: error as Error });
      }
    });

    await Promise.all(closePromises);
    this.pool = [];
    this.stats.totalConnections = 0;
    this.stats.activeConnections = 0;
    this.stats.idleConnections = 0;
  }

  /**
   * Initialize the connection pool with minimum connections
   */
  private initializePool(): void {
    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        const connection = this.createConnection();
        this.pool.push(connection);
        this.stats.totalConnections++;
      } catch (error) {
        this.stats.connectionErrors++;
        this.emit('initializationError', { index: i, error: error as Error });
      }
    }

    this.updatePoolStats();
    this.emit('poolInitialized', { initialConnections: this.stats.totalConnections });
  }

  /**
   * Start health monitoring routine
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Start validation routine for connection cleanup
   */
  private startValidationRoutine(): void {
    this.validationTimer = setInterval(() => {
      this.validateAndCleanupConnections();
    }, this.config.validationInterval);
  }

  /**
   * Perform health checks on all connections
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = this.pool.map(async (connection) => {
      try {
        const isHealthy = await this.checkConnectionHealth(connection);
        if (!isHealthy) {
          connection.isHealthy = false;
          this.stats.healthCheckErrors++;
          this.emit('connectionUnhealthy', connection.id);
        } else if (!connection.isHealthy) {
          connection.isHealthy = true;
          this.emit('connectionRecovered', connection.id);
        }
      } catch (error) {
        connection.isHealthy = false;
        this.stats.healthCheckErrors++;
        this.emit('healthCheckError', { connectionId: connection.id, error: error as Error });
      }
    });

    await Promise.all(healthCheckPromises);
  }

  /**
   * Validate and cleanup idle/unhealthy connections
   */
  private validateAndCleanupConnections(): void {
    const now = Date.now();
    const connectionsToRemove: PooledConnection[] = [];

    for (const connection of this.pool) {
      // Remove unhealthy connections
      if (!connection.isHealthy) {
        connectionsToRemove.push(connection);
        continue;
      }

      // Remove idle connections beyond maxIdleTime
      const idleTime = now - connection.lastUsed.getTime();
      if (connection.activeRequests === 0 && idleTime > this.config.maxIdleTime) {
        connectionsToRemove.push(connection);
      }
    }

    // Remove connections
    for (const connection of connectionsToRemove) {
      this.removeConnection(connection);
    }

    // Maintain minimum connections
    while (this.stats.totalConnections < this.config.minConnections &&
           this.stats.totalConnections < this.config.maxConnections) {
      try {
        const connection = this.createConnection();
        this.pool.push(connection);
        this.stats.totalConnections++;
        this.emit('connectionCreated', connection.id);
      } catch (error) {
        this.stats.connectionErrors++;
        this.emit('connectionCreationError', error as Error);
      }
    }

    this.updatePoolStats();
  }

  /**
   * Create a new connection
   */
  private createConnection(): PooledConnection {
    const connection: PooledConnection = {
      id: this.generateConnectionId(),
      created: new Date(),
      lastUsed: new Date(),
      isHealthy: true,
      activeRequests: 0,
      connection: this.createDockerVolumeConnection(), // Placeholder for actual Docker volume connection
    };

    this.emit('connectionCreated', connection.id);
    return connection;
  }

  /**
   * Activate a connection for use
   */
  private activateConnection(connection: PooledConnection): void {
    connection.activeRequests++;
    connection.lastUsed = new Date();
    this.updatePoolStats();
  }

  /**
   * Remove a connection from the pool
   */
  private removeConnection(connection: PooledConnection): void {
    const index = this.pool.indexOf(connection);
    if (index !== -1) {
      this.pool.splice(index, 1);
      this.destroyConnection(connection);
      this.stats.totalConnections--;
      this.updatePoolStats();
      this.emit('connectionDestroyed', connection.id);
    }
  }

  /**
   * Remove a request from the waiting queue
   */
  private removeFromWaitingQueue(
    resolve: (connection: PooledConnection) => void,
    reject: (error: Error) => void
  ): void {
    const index = this.waitingQueue.findIndex(
      request => request.resolve === resolve && request.reject === reject
    );
    if (index !== -1) {
      clearTimeout(this.waitingQueue[index].timeout);
      this.waitingQueue.splice(index, 1);
    }
  }

  /**
   * Update pool statistics
   */
  private updatePoolStats(): void {
    this.stats.activeConnections = this.pool.reduce((sum, conn) => sum + conn.activeRequests, 0);
    this.stats.idleConnections = this.pool.filter(conn => conn.activeRequests === 0).length;
  }

  /**
   * Update average wait time
   */
  private updateAverageWaitTime(waitTime: number): void {
    // Simple moving average calculation
    this.stats.averageWaitTime = (this.stats.averageWaitTime + waitTime) / 2;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create Docker volume connection (placeholder implementation)
   */
  private createDockerVolumeConnection(): any {
    // Placeholder for actual Docker volume connection creation
    // This would typically involve Docker SDK or volume mount operations
    return {
      type: 'docker-volume',
      mounted: true,
      path: '/tmp/shared-storage',
      timestamp: Date.now(),
    };
  }

  /**
   * Check connection health (placeholder implementation)
   */
  private async checkConnectionHealth(connection: PooledConnection): Promise<boolean> {
    try {
      // Placeholder health check - would verify Docker volume accessibility
      // This could involve checking if volume is mounted, permissions, etc.
      return connection.connection.mounted && connection.isHealthy;
    } catch (error) {
      return false;
    }
  }

  /**
   * Destroy a connection (placeholder implementation)
   */
  private async destroyConnection(connection: PooledConnection): Promise<void> {
    // Placeholder for connection cleanup
    // This would typically involve unmounting Docker volumes, closing handles, etc.
    if (connection.connection) {
      connection.connection.mounted = false;
    }
  }
}

/**
 * Factory function to create ConnectionPoolManager with default configuration
 */
export function createConnectionPoolManager(config?: Partial<ConnectionPoolConfig>): ConnectionPoolManager {
  const defaultConfig: ConnectionPoolConfig = {
    maxConnections: 20,
    minConnections: 5,
    maxIdleTime: 300000, // 5 minutes
    connectionTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    healthCheckInterval: 60000, // 1 minute
    acquireTimeout: 10000, // 10 seconds
    validationInterval: 120000, // 2 minutes
  };

  return new ConnectionPoolManager({ ...defaultConfig, ...config });
}
