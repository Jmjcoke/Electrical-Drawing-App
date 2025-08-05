# Coding Standards

## TypeScript Standards

### Code Style and Formatting
```typescript
// Use strict TypeScript configuration
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Interface and Type Definitions
```typescript
// Use PascalCase for interfaces and types
interface AnalysisResult {
  summary: string;
  confidence: number;
  components: ComponentIdentification[];
}

// Use descriptive, domain-specific naming
type QueryType = 'component_identification' | 'general_question' | 'schematic_analysis';

// Prefer interfaces over type aliases for object shapes
interface ComponentIdentification {
  readonly id: string;
  readonly type: string;
  readonly confidence: number;
  readonly location: Coordinates;
}
```

### Function and Component Standards
```typescript
// Use explicit return types for functions
function processAnalysis(query: Query): Promise<AnalysisResult> {
  // Implementation
}

// Use functional components with TypeScript
interface ComponentProps {
  readonly analysisResult: AnalysisResult;
  readonly onResultClick: (componentId: string) => void;
}

const AnalysisDisplay: React.FC<ComponentProps> = ({ 
  analysisResult, 
  onResultClick 
}) => {
  // Component implementation
};
```

## Code Organization

### File Structure
```
src/
├── components/          # React components
│   ├── common/         # Reusable components
│   ├── upload/         # Upload-specific components
│   └── analysis/       # Analysis-specific components
├── hooks/              # Custom React hooks
├── services/           # API and external service layers
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── constants/          # Application constants
```

### Import Organization
```typescript
// 1. External library imports
import React, { useState, useEffect } from 'react';
import { Material-UI imports } from '@mui/material';

// 2. Internal service imports
import { analysisApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

// 3. Type imports (using type-only imports)
import type { AnalysisResult, Query } from '../types/analysis';
```

## Code Quality Standards

### ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking",
    "react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "react-hooks/exhaustive-deps": "error"
  }
}
```

### Prettier Configuration
```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

## Error Handling

### Frontend Error Handling
```typescript
// Use error boundaries for React components
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Component error:', error, errorInfo);
    // Send to error tracking service
  }
}

// Use consistent error handling in async functions
async function uploadFile(file: File): Promise<UploadResult> {
  try {
    const result = await fileUploadService.upload(file);
    return result;
  } catch (error) {
    console.error('File upload failed:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
}
```

### Backend Error Handling
```typescript
// Use consistent error response format
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

// Express error middleware
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const errorResponse: ErrorResponse = {
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    },
  };

  res.status(err.statusCode || 500).json(errorResponse);
};
```

## Performance Standards

### React Performance
```typescript
// Use React.memo for component optimization
const ExpensiveComponent = React.memo<Props>(({ data }) => {
  // Component implementation
});

// Use useMemo and useCallback appropriately
const processedData = useMemo(() => {
  return expensiveProcessing(rawData);
}, [rawData]);

const handleClick = useCallback((id: string) => {
  onItemClick(id);
}, [onItemClick]);
```

### Code Splitting
```typescript
// Use dynamic imports for code splitting
const AnalysisModule = React.lazy(() => import('./AnalysisModule'));

// Wrap with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <AnalysisModule />
</Suspense>
```

## Documentation Standards

### JSDoc Comments
```typescript
/**
 * Processes electrical drawing analysis using multiple LLM models
 * @param query - The user's analysis query
 * @param documentIds - Array of document IDs to analyze
 * @returns Promise resolving to aggregated analysis result
 * @throws {AnalysisError} When analysis processing fails
 */
async function processAnalysis(
  query: Query,
  documentIds: string[]
): Promise<AnalysisResult> {
  // Implementation
}
```

### README Requirements
- Clear setup instructions
- Environment configuration
- API documentation
- Development workflow
- Deployment procedures

## Git Workflow

### Commit Standards
```bash
# Use conventional commit format
feat: add component identification feature
fix: resolve PDF rendering issue
docs: update API documentation
test: add unit tests for analysis service
refactor: improve error handling in upload service
```

### Branch Naming
```bash
feature/component-identification
bugfix/pdf-rendering-issue
hotfix/security-vulnerability
release/v1.0.0
```

### Pull Request Requirements
- Code review by at least one team member
- All tests passing
- ESLint and Prettier checks passing
- Documentation updated
- No merge conflicts