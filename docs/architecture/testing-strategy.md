# Testing Strategy

## Testing Philosophy

### Testing Pyramid
```
                    /\
                   /  \
                  / E2E \     (Few)
                 /______\
                /        \
               / Integration \  (Some)
              /______________\
             /                \
            /   Unit Tests      \  (Many)
           /____________________\
```

### Testing Principles
- **Test Driven Development (TDD)**: Write tests before implementation
- **Comprehensive Coverage**: Aim for 90%+ code coverage
- **Fast Feedback**: Unit tests should run in under 2 seconds
- **Reliable Tests**: Tests should be deterministic and independent
- **Meaningful Tests**: Focus on behavior, not implementation details

## Frontend Testing

### Unit Testing with Jest and React Testing Library
```typescript
// Component testing example
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload } from './FileUpload';

describe('FileUpload Component', () => {
  it('should upload file and show progress', async () => {
    const mockOnUpload = jest.fn();
    render(<FileUpload onUpload={mockOnUpload} />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload file/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(file);
    });
  });

  it('should show error for invalid file types', () => {
    render(<FileUpload onUpload={jest.fn()} />);
    
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload file/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });
});
```

### Custom Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from './useFileUpload';

describe('useFileUpload Hook', () => {
  it('should handle file upload state correctly', async () => {
    const { result } = renderHook(() => useFileUpload());
    
    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    
    await act(async () => {
      await result.current.uploadFile(file);
    });
    
    expect(result.current.uploadedFiles).toHaveLength(1);
  });
});
```

### API Service Testing
```typescript
import { analysisApi } from './analysisApi';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.post('/api/analysis', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'test-id',
        result: 'test result',
        confidence: 0.95
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Analysis API', () => {
  it('should submit analysis request', async () => {
    const query = 'What components are in this schematic?';
    const documentIds = ['doc-1', 'doc-2'];
    
    const result = await analysisApi.submitAnalysis(query, documentIds);
    
    expect(result.id).toBe('test-id');
    expect(result.confidence).toBe(0.95);
  });
});
```

## Backend Testing

### Unit Testing with Jest
```typescript
// Service layer testing
import { AnalysisService } from './AnalysisService';
import { MockLLMProvider } from '../__mocks__/MockLLMProvider';

describe('AnalysisService', () => {
  let analysisService: AnalysisService;
  let mockLLMProvider: MockLLMProvider;

  beforeEach(() => {
    mockLLMProvider = new MockLLMProvider();
    analysisService = new AnalysisService(mockLLMProvider);
  });

  it('should process analysis with multiple models', async () => {
    const query = 'Identify components';
    const documentData = Buffer.from('test pdf data');
    
    mockLLMProvider.mockResponse({
      model: 'gpt-4-vision',
      response: 'Found resistor at coordinates (100, 200)',
      confidence: 0.92
    });
    
    const result = await analysisService.processAnalysis(query, [documentData]);
    
    expect(result.components).toHaveLength(1);
    expect(result.components[0].type).toBe('resistor');
    expect(result.aggregatedConfidence).toBeGreaterThan(0.9);
  });
});
```

### Database Testing
```typescript
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
});

beforeEach(async () => {
  // Reset database before each test
  execSync('npx prisma migrate reset --force', { 
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } 
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Session Repository', () => {
  it('should create and retrieve session', async () => {
    const sessionData = {
      id: 'test-session-id',
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
      ipAddress: '127.0.0.1'
    };
    
    const created = await prisma.session.create({ data: sessionData });
    const retrieved = await prisma.session.findUnique({ 
      where: { id: 'test-session-id' } 
    });
    
    expect(retrieved).toEqual(expect.objectContaining(sessionData));
  });
});
```

## Integration Testing

### API Integration Tests
```typescript
import request from 'supertest';
import { app } from '../app';

describe('Analysis API Integration', () => {
  it('should handle complete analysis workflow', async () => {
    // 1. Create session
    const sessionResponse = await request(app)
      .post('/api/sessions')
      .expect(201);
    
    const sessionId = sessionResponse.body.id;
    
    // 2. Upload document
    const uploadResponse = await request(app)
      .post(`/api/sessions/${sessionId}/documents`)
      .attach('file', Buffer.from('test pdf'), 'test.pdf')
      .expect(201);
    
    const documentId = uploadResponse.body.id;
    
    // 3. Submit analysis
    const analysisResponse = await request(app)
      .post(`/api/sessions/${sessionId}/analysis`)
      .send({
        query: 'What components are in this schematic?',
        documentIds: [documentId]
      })
      .expect(201);
    
    expect(analysisResponse.body.id).toBeDefined();
    expect(analysisResponse.body.status).toBe('processing');
  });
});
```

### WebSocket Integration
```typescript
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../server';

describe('WebSocket Integration', () => {
  let server: any;
  let client: any;

  beforeEach((done) => {
    server = createServer();
    server.listen(() => {
      const port = server.address().port;
      client = ioClient(`http://localhost:${port}`);
      client.on('connect', done);
    });
  });

  afterEach(() => {
    server.close();
    client.close();
  });

  it('should receive analysis progress updates', (done) => {
    client.emit('join-session', { sessionId: 'test-session' });
    
    client.on('analysis-progress', (data) => {
      expect(data.progress).toBeGreaterThan(0);
      expect(data.stage).toBeDefined();
      done();
    });
    
    // Trigger analysis that sends progress updates
    client.emit('start-analysis', {
      query: 'test query',
      documentIds: ['doc-1']
    });
  });
});
```

## End-to-End Testing

### Playwright E2E Tests
```typescript
import { test, expect } from '@playwright/test';

test('complete electrical analysis workflow', async ({ page }) => {
  // Navigate to application
  await page.goto('/');
  
  // Upload PDF file
  await page.setInputFiles('input[type="file"]', 'test-files/sample-schematic.pdf');
  await expect(page.locator('.upload-success')).toBeVisible();
  
  // Enter analysis query
  await page.fill('textarea[name="query"]', 'What resistors are in this circuit?');
  await page.click('button:text("Analyze")');
  
  // Wait for analysis to complete
  await expect(page.locator('.analysis-results')).toBeVisible({ timeout: 30000 });
  
  // Verify results
  const components = page.locator('.component-identification');
  await expect(components).toHaveCount.greaterThan(0);
  
  // Test component highlighting
  await components.first().click();
  await expect(page.locator('.component-highlight')).toBeVisible();
});

test('error handling for invalid files', async ({ page }) => {
  await page.goto('/');
  
  // Try to upload invalid file
  await page.setInputFiles('input[type="file"]', 'test-files/invalid.txt');
  
  // Should show error message
  await expect(page.locator('.error-message')).toContainText('Invalid file type');
});
```

## Performance Testing

### Load Testing with Artillery
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 300
      arrivalRate: 50
      name: Load test
scenarios:
  - name: "Analysis workflow"
    flow:
      - post:
          url: "/api/sessions"
      - post:
          url: "/api/sessions/{{ id }}/documents"
          formData:
            file: "@test-files/sample.pdf"
      - post:
          url: "/api/sessions/{{ id }}/analysis"
          json:
            query: "Identify components"
            documentIds: ["{{ documentId }}"]
```

### Frontend Performance Testing
```typescript
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('should render large component list efficiently', () => {
    const start = performance.now();
    
    const components = Array.from({ length: 1000 }, (_, i) => ({
      id: `component-${i}`,
      type: 'resistor',
      location: { x: i % 100, y: Math.floor(i / 100) }
    }));
    
    render(<ComponentList components={components} />);
    
    const end = performance.now();
    expect(end - start).toBeLessThan(100); // Should render in under 100ms
  });
});
```

## Test Configuration

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test-utils.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Test Environment Setup
```typescript
// src/test-setup.ts
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

configure({ testIdAttribute: 'data-testid' });

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Global test utilities
global.fetch = jest.fn();

// Setup and teardown
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Continuous Integration

### GitHub Actions Test Pipeline
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Quality Gates

### Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:unit"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --findRelatedTests"
    ]
  }
}
```

### Test Requirements for Deployment
- All unit tests passing (100%)
- Integration tests passing (100%)
- Code coverage above 90%
- E2E tests for critical paths passing
- Performance benchmarks met
- Security scans passing