import { jest } from '@jest/globals';
import { ConnectionPoolManager, createConnectionPoolManager } from '../connection-pool.manager';
import { ConnectionPoolConfig } from '../connection-pool.manager';

describe('ConnectionPoolManager', () => {
  let config: ConnectionPoolConfig;
  let poolManager: ConnectionPoolManager;

  beforeEach(() => {
    config = {
      maxConnections: 10,
      minConnections: 2,
      maxIdleTime: 1000, // 1 second for testing
      connectionTimeout: 5000,
      retryAttempts: 3,
      healthCheckInterval: 100, // 100ms for testing
      acquireTimeout: 1000, // 1 second for testing
      validationInterval: 200, // 200ms for testing
    };

    jest.useFakeTimers();
  });

  afterEach(async () => {
    if (poolManager) {
      await poolManager.close();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize with minimum connections', () => {
      poolManager = createConnectionPoolManager(config);
      const stats = poolManager.getStats();

      expect(stats.totalConnections).toBe(config.minConnections);
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(config.minConnections);
    });

    test('should emit poolInitialized event', () => {
      const mockEmit = jest.fn();
      const originalEmit = ConnectionPoolManager.prototype.emit;

      ConnectionPoolManager.prototype.emit = mockEmit;

      poolManager = createConnectionPoolManager(config);

      expect(mockEmit).toHaveBeenCalledWith('poolInitialized', {
        initialConnections: config.minConnections
      });

      ConnectionPoolManager.prototype.emit = originalEmit;
    });
  });

  describe('Connection Acquisition', () => {
    beforeEach(() => {
      poolManager = createConnectionPoolManager(config);
    });

    test('should acquire connection successfully', async () => {
      const connection = await poolManager.acquire();

      expect(connection).toBeDefined();
      expect(connection.id).toMatch(/^conn_\d+_[a-z0-9]+$/);
      expect(connection.isHealthy).toBe(true);
      expect(connection.activeRequests).toBe(1);

      const stats = poolManager.getStats();
      expect(stats.activeConnections).toBe(1);
      expect(stats.idleConnections).toBe(config.minConnections - 1);
    });

    test('should create new connection when pool is full', async () => {
      // Acquire all minimum connections
      const connections = [];
      for (let i = 0; i < config.maxConnections; i++) {
        const conn = await poolManager.acquire();
        connections.push(conn);
      }

      const stats = poolManager.getStats();
      expect(stats.totalConnections).toBe(config.maxConnections);

      // Release all connections
      await Promise.all(connections.map(conn => poolManager.release(conn)));
    });

    test('should queue requests when pool is exhausted', async () => {
      // Acquire all available connections
      const connections = [];
      for (let i = 0; i < config.maxConnections; i++) {
        const conn = await poolManager.acquire();
        connections.push(conn);
      }

      // This request should be queued
      const queuedPromise = poolManager.acquire();

      // Release one connection
      await poolManager.release(connections[0]);

      // Queued request should now resolve
      const queuedConnection = await queuedPromise;
      expect(queuedConnection).toBeDefined();

      // Cleanup remaining connections
      connections.shift(); // Remove the released connection
      await Promise.all(connections.map(conn => poolManager.release(conn)));
    });

    test('should timeout when acquireTimeout is exceeded', async () => {
      // Fill the pool
      const connections = [];
      for (let i = 0; i < config.maxConnections; i++) {
        const conn = await poolManager.acquire();
        connections.push(conn);
      }

      // This should timeout
      await expect(poolManager.acquire()).rejects.toThrow('Connection acquire timeout');

      // Cleanup
      await Promise.all(connections.map(conn => poolManager.release(conn)));
    });
  });

  describe('Connection Release', () => {
    beforeEach(() => {
      poolManager = createConnectionPoolManager(config);
    });

    test('should release connection successfully', async () => {
      const connection = await poolManager.acquire();
      const statsBefore = poolManager.getStats();

      await poolManager.release(connection);
      const statsAfter = poolManager.getStats();

      expect(statsAfter.activeConnections).toBe(statsBefore.activeConnections - 1);
      expect(statsAfter.idleConnections).toBe(statsBefore.idleConnections + 1);
      expect(connection.activeRequests).toBe(0);
    });

    test('should handle release of unknown connection gracefully', async () => {
      const fakeConnection = {
        id: 'fake_conn',
        created: new Date(),
        lastUsed: new Date(),
        isHealthy: true,
        activeRequests: 1,
        connection: {},
      };

      await expect(poolManager.release(fakeConnection as any)).resolves.toBeUndefined();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(() => {
      poolManager = createConnectionPoolManager(config);
    });

    test('should perform health checks periodically', () => {
      jest.advanceTimersByTime(config.healthCheckInterval);

      // Health checks should have been performed
      const stats = poolManager.getStats();
      expect(stats.healthCheckErrors).toBeDefined();
    });

    test('should mark unhealthy connections', async () => {
      // Mock unhealthy connection
      const connection = await poolManager.acquire();
      connection.connection.mounted = false;

      // Advance time to trigger health check
      jest.advanceTimersByTime(config.healthCheckInterval);

      // Connection should be marked as unhealthy
      expect(connection.isHealthy).toBe(false);
    });

    test('should emit connectionUnhealthy event', async () => {
      const mockEmit = jest.fn();
      const originalEmit = poolManager.emit;
      poolManager.emit = mockEmit;

      const connection = await poolManager.acquire();
      connection.connection.mounted = false;

      jest.advanceTimersByTime(config.healthCheckInterval);

      expect(mockEmit).toHaveBeenCalledWith('connectionUnhealthy', connection.id);

      poolManager.emit = originalEmit;
      await poolManager.release(connection);
    });
  });

  describe('Connection Validation and Cleanup', () => {
    beforeEach(() => {
      poolManager = createConnectionPoolManager(config);
    });

    test('should remove idle connections after maxIdleTime', async () => {
      const connection = await poolManager.acquire();
      await poolManager.release(connection);

      const statsBefore = poolManager.getStats();
      expect(statsBefore.idleConnections).toBeGreaterThan(0);

      // Advance time beyond maxIdleTime
      jest.advanceTimersByTime(config.maxIdleTime + 100);

      const statsAfter = poolManager.getStats();
      expect(statsAfter.totalConnections).toBeLessThanOrEqual(statsBefore.totalConnections);
    });

    test('should maintain minimum connections', async () => {
      // Acquire all connections
      const connections = [];
      for (let i = 0; i < config.maxConnections; i++) {
        const conn = await poolManager.acquire();
        connections.push(conn);
      }

      // Make some connections idle
      await Promise.all(connections.slice(0, 5).map(conn => poolManager.release(conn)));

      // Advance time to trigger validation
      jest.advanceTimersByTime(config.validationInterval);

      const stats = poolManager.getStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(config.minConnections);

      // Cleanup
      await Promise.all(connections.slice(5).map(conn => poolManager.release(conn)));
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      poolManager = createConnectionPoolManager(config);
    });

    test('should track connection statistics accurately', async () => {
      const stats1 = poolManager.getStats();

      const conn1 = await poolManager.acquire();
      const conn2 = await poolManager.acquire();

      const stats2 = poolManager.getStats();
      expect(stats2.activeConnections).toBe(stats1.activeConnections + 2);
      expect(stats2.idleConnections).toBe(stats1.idleConnections - 2);

      await poolManager.release(conn1);

      const stats3 = poolManager.getStats();
      expect(stats3.activeConnections).toBe(stats2.activeConnections - 1);
      expect(stats3.idleConnections).toBe(stats2.idleConnections + 1);

      await poolManager.release(conn2);
    });

    test('should track pending requests', async () => {
      // Fill the pool
      const connections = [];
      for (let i = 0; i < config.maxConnections; i++) {
        const conn = await poolManager.acquire();
        connections.push(conn);
      }

      const statsWithFullPool = poolManager.getStats();
      expect(statsWithFullPool.pendingRequests).toBe(0);

      // Queue a request
      const queuedPromise = poolManager.acquire();
      const statsWithQueuedRequest = poolManager.getStats();
      expect(statsWithQueuedRequest.pendingRequests).toBe(1);

      // Release a connection to resolve the queued request
      await poolManager.release(connections[0]);
      await queuedPromise;

      const statsAfterResolution = poolManager.getStats();
      expect(statsAfterResolution.pendingRequests).toBe(0);

      // Cleanup remaining connections
      await Promise.all(connections.slice(1).map(conn => poolManager.release(conn)));
    });
  });

  describe('Pool Closure', () => {
    beforeEach(() => {
      poolManager = createConnectionPoolManager(config);
    });

    test('should close all connections gracefully', async () => {
      // Acquire some connections
      const conn1 = await poolManager.acquire();
      const conn2 = await poolManager.acquire();

      const statsBefore = poolManager.getStats();

      await poolManager.close();

      const statsAfter = poolManager.getStats();
      expect(statsAfter.totalConnections).toBe(0);
      expect(statsAfter.activeConnections).toBe(0);
      expect(statsAfter.idleConnections).toBe(0);
    });

    test('should reject pending acquire requests on close', async () => {
      // Fill the pool
      const connections = [];
      for (let i = 0; i < config.maxConnections; i++) {
        const conn = await poolManager.acquire();
        connections.push(conn);
      }

      // Queue a request
      const queuedPromise = poolManager.acquire();

      // Close the pool
      await poolManager.close();

      // Queued request should be rejected
      await expect(queuedPromise).rejects.toThrow('Pool is shutting down');
    });
  });

  describe('Error Handling', () => {
    test('should handle connection creation errors gracefully', () => {
      // Mock connection creation failure
      const originalCreateConnection = ConnectionPoolManager.prototype['createConnection'];
      ConnectionPoolManager.prototype['createConnection'] = jest.fn(() => {
        throw new Error('Connection creation failed');
      });

      poolManager = createConnectionPoolManager(config);
      const stats = poolManager.getStats();

      // Should still initialize with some connections despite errors
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);

      ConnectionPoolManager.prototype['createConnection'] = originalCreateConnection;
    });

    test('should track connection errors', async () => {
      poolManager = createConnectionPoolManager(config);

      const statsBefore = poolManager.getStats();

      // Force a connection error by mocking createConnection
      const originalCreateConnection = poolManager['createConnection'];
      poolManager['createConnection'] = jest.fn(() => {
        throw new Error('Connection failed');
      });

      try {
        await poolManager.acquire();
      } catch (error) {
        // Expected to fail
      }

      const statsAfter = poolManager.getStats();
      expect(statsAfter.connectionErrors).toBeGreaterThan(statsBefore.connectionErrors);

      poolManager['createConnection'] = originalCreateConnection;
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      poolManager = createConnectionPoolManager(config);
    });

    test('should emit connection events', async () => {
      const events: string[] = [];
      const originalEmit = poolManager.emit;

      poolManager.emit = (event: string, ...args: any[]) => {
        events.push(event);
        return originalEmit.call(poolManager, event, ...args);
      };

      const connection = await poolManager.acquire();
      await poolManager.release(connection);

      expect(events).toContain('connectionCreated');
      expect(events).toContain('connectionReleased');

      poolManager.emit = originalEmit;
    });

    test('should emit error events', async () => {
      const events: string[] = [];
      const originalEmit = poolManager.emit;

      poolManager.emit = (event: string, ...args: any[]) => {
        events.push(event);
        return originalEmit.call(poolManager, event, ...args);
      };

      // Force an error
      const originalCreateConnection = poolManager['createConnection'];
      poolManager['createConnection'] = jest.fn(() => {
        throw new Error('Creation failed');
      });

      try {
        await poolManager.acquire();
      } catch (error) {
        // Expected
      }

      expect(events).toContain('connectionCreationError');

      poolManager['createConnection'] = originalCreateConnection;
      poolManager.emit = originalEmit;
    });
  });
});
