import { Router } from 'express';
import { SharedStorageHealthCheck } from './shared-storage.health';
import { sharedStorageLogger } from './shared-storage.logger';
import { SessionPathConfig } from '../types/shared-storage.types';

/**
 * SharedStorageRoutes provides HTTP endpoints for SharedStorageService health monitoring
 * Implements RESTful health check endpoints following industry standards
 */
export class SharedStorageRoutes {
  private router: Router;
  private healthCheck: SharedStorageHealthCheck;

  constructor(config: SessionPathConfig) {
    this.router = Router();
    this.healthCheck = new SharedStorageHealthCheck(config);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Basic health check endpoint - for load balancers and monitoring systems
    this.router.get('/health', async (req, res) => {
      try {
        const health = await this.healthCheck.basicHealth();

        const statusCode = health.status === 'healthy' ? 200 : 503;

        res.status(statusCode).json(health);

        sharedStorageLogger.logHealthCheckRequest('/health', statusCode, health.status);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'shared-storage-service',
          error: 'Health check failed'
        });

        sharedStorageLogger.logHealthCheckError('/health', error);
      }
    });

    // Detailed health check endpoint - for debugging and detailed monitoring
    this.router.get('/health/detailed', async (req, res) => {
      try {
        const health = await this.healthCheck.detailedHealth();

        const statusCode = health.status === 'healthy' ? 200 : 503;

        res.status(statusCode).json(health);

        sharedStorageLogger.logHealthCheckRequest('/health/detailed', statusCode, health.status, {
          checks_count: Object.keys(health.checks).length
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'shared-storage-service',
          error: 'Detailed health check failed',
          details: error.message
        });

        sharedStorageLogger.logHealthCheckError('/health/detailed', error);
      }
    });

    // Readiness probe endpoint - for Kubernetes and container orchestration
    this.router.get('/health/ready', async (req, res) => {
      try {
        const readiness = await this.healthCheck.readiness();

        const statusCode = readiness.ready ? 200 : 503;

        res.status(statusCode).json(readiness);

        sharedStorageLogger.logHealthCheckRequest('/health/ready', statusCode, readiness.status, {
          ready: readiness.ready
        });
      } catch (error) {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          service: 'shared-storage-service',
          ready: false,
          error: 'Readiness check failed'
        });

        sharedStorageLogger.logHealthCheckError('/health/ready', error);
      }
    });

    // Liveness probe endpoint - for container orchestration systems
    this.router.get('/health/live', async (req, res) => {
      try {
        // Liveness is simpler - just check if the service is running
        const health = await this.healthCheck.basicHealth();

        const statusCode = health.status === 'healthy' ? 200 : 503;

        res.status(statusCode).json({
          status: health.status,
          timestamp: new Date().toISOString(),
          service: 'shared-storage-service',
          alive: health.status === 'healthy'
        });

        sharedStorageLogger.logHealthCheckRequest('/health/live', statusCode, health.status);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'shared-storage-service',
          alive: false,
          error: 'Liveness check failed'
        });

        sharedStorageLogger.logHealthCheckError('/health/live', error);
      }
    });

    // Metrics endpoint - for Prometheus scraping
    this.router.get('/metrics', async (req, res) => {
      try {
        // Import the metrics registry dynamically to avoid circular dependencies
        const { sharedStorageMetrics } = await import('./shared-storage.metrics');

        const metrics = await sharedStorageMetrics.getPrometheusMetrics();

        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.status(200).send(metrics);

        sharedStorageLogger.logMetricsRequest('/metrics', 200);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to retrieve metrics',
          timestamp: new Date().toISOString()
        });

        sharedStorageLogger.logMetricsError('/metrics', error);
      }
    });
  }

  /**
   * Get the configured Express router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get health check instance for direct access
   */
  getHealthCheck(): SharedStorageHealthCheck {
    return this.healthCheck;
  }
}

// Export factory function for creating routes
export const createSharedStorageRoutes = (config: SessionPathConfig) => {
  return new SharedStorageRoutes(config);
};
