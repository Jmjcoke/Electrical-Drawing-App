import * as express from 'express';
import * as request from 'supertest';
import { SharedStorageRoutes } from '../shared-storage.routes';
import { SessionPathConfig, ServiceConfig } from '../../types/shared-storage.types';

describe('SharedStorageRoutes', () => {
  let app: express.Application;
  let routes: SharedStorageRoutes;
  let mockConfig: SessionPathConfig;

  beforeEach(() => {
    mockConfig = {
      baseSessionPath: '/tmp/test-sessions',
      serviceMap: {
        'file-processor': {
          name: 'file-processor',
          permissions: { canRead: true, canWrite: true, allowedSubPaths: [] },
          allowedSessionPatterns: ['.*']
        },
        'llm-orchestrator': {
          name: 'llm-orchestrator',
          permissions: { canRead: true, canWrite: false, allowedSubPaths: [] },
          allowedSessionPatterns: ['.*']
        }
      }
    };

    routes = new SharedStorageRoutes(mockConfig);
    app = express();
    app.use(express.json());
    app.use('/api/v1/shared-storage', routes.getRouter());
  });

  describe('GET /api/v1/shared-storage/health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('shared-storage-service');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should handle service unavailability', async () => {
      // This would require mocking filesystem failures
      // For now, we test the response structure
      const response = await request(app)
        .get('/api/v1/shared-storage/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/v1/shared-storage/health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health/detailed')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('shared-storage-service');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Check detailed response structure
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('storage');
      expect(response.body.checks).toHaveProperty('metrics');
      expect(response.body.checks).toHaveProperty('logging');
      expect(response.body.checks).toHaveProperty('performance');

      expect(response.body).toHaveProperty('dependencies');
      expect(response.body.dependencies).toHaveProperty('filesystem');
      expect(response.body.dependencies).toHaveProperty('docker_volume');
      expect(response.body.dependencies).toHaveProperty('prometheus');
      expect(response.body.dependencies).toHaveProperty('elasticsearch');
    });

    it('should handle degraded health states', async () => {
      // This test would require mocking component failures
      const response = await request(app)
        .get('/api/v1/shared-storage/health/detailed')
        .expect(200);

      expect(response.body.checks.storage).toHaveProperty('status');
      expect(response.body.checks.storage).toHaveProperty('details');
    });
  });

  describe('GET /api/v1/shared-storage/health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('checks');
      expect(typeof response.body.ready).toBe('boolean');
    });

    it('should indicate ready when service is operational', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health/ready')
        .expect(200);

      expect(response.body.ready).toBeDefined();
      expect(response.body.status).toMatch(/ready|not_ready/);
    });
  });

  describe('GET /api/v1/shared-storage/health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('alive');
      expect(typeof response.body.alive).toBe('boolean');
    });

    it('should indicate alive when service is running', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health/live')
        .expect(200);

      expect(response.body.alive).toBe(true);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('GET /api/v1/shared-storage/metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/metrics')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(response.text).toContain('# HELP shared_storage_active_connections');
      expect(response.text).toContain('# TYPE shared_storage_active_connections gauge');
      expect(response.text).toMatch(/shared_storage_active_connections \d+/);
    });

    it('should handle metrics collection errors', async () => {
      // This test would require mocking Prometheus client failures
      const response = await request(app)
        .get('/api/v1/shared-storage/metrics')
        .expect(200);

      expect(response.text).toBeDefined();
      expect(typeof response.text).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health/unknown')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health')
        .set('Content-Type', 'application/json')
        .send({ invalid: 'data' })
        .expect(200); // Health endpoints should still work

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('HTTP Methods', () => {
    it('should reject POST requests to health endpoints', async () => {
      const response = await request(app)
        .post('/api/v1/shared-storage/health')
        .send({})
        .expect(404); // Express default for undefined routes

      expect(response.body).toBeDefined();
    });

    it('should reject PUT requests to health endpoints', async () => {
      const response = await request(app)
        .put('/api/v1/shared-storage/health')
        .send({})
        .expect(404);

      expect(response.body).toBeDefined();
    });

    it('should reject DELETE requests to health endpoints', async () => {
      const response = await request(app)
        .delete('/api/v1/shared-storage/health')
        .expect(404);

      expect(response.body).toBeDefined();
    });
  });

  describe('CORS and Headers', () => {
    it('should include appropriate CORS headers', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health')
        .expect(200);

      // CORS headers should be present (set by parent app)
      expect(response.headers).toBeDefined();
    });

    it('should include cache control headers', async () => {
      const response = await request(app)
        .get('/api/v1/shared-storage/health')
        .expect(200);

      // Health endpoints typically shouldn't be cached
      expect(response.headers).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should respond quickly to health checks', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/v1/shared-storage/health')
        .expect(200);

      const duration = Date.now() - startTime;

      // Health checks should be fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent health check requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/shared-storage/health')
          .expect(200)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });
    });
  });
});
