# ELECTRICAL ORCHESTRATOR Frontend Architecture

## Overview

This document defines the comprehensive frontend architecture for the ELECTRICAL ORCHESTRATOR application, implementing a modern, scalable React-based solution optimized for electrical circuit analysis and brownfield estimation workflows. The architecture prioritizes performance, maintainability, and professional user experience for oil & gas industry applications.

## Frontend Philosophy & Patterns

### Architectural Principles

**Component-First Development:**
- Atomic design methodology with reusable, composable components
- Clear separation between presentation and business logic
- Component composition over inheritance patterns

**State Management Strategy:**
- Centralized state management using Zustand for global application state
- Local component state for UI-specific interactions
- Server state management through React Query for data fetching and caching

**Progressive Enhancement:**
- Core functionality accessible without JavaScript (where applicable)
- Enhanced interactions layered on top of solid foundation
- Graceful degradation for legacy browser support

**Performance-First Design:**
- Code splitting and lazy loading for optimal bundle sizes
- Optimistic UI updates for responsive user interactions
- Efficient rendering patterns with React 18 concurrent features

### Design Patterns

**Container/Presenter Pattern:**
- Smart containers handle data fetching and state management
- Dumb presenters focus purely on UI rendering and user interactions
- Clear boundaries between business logic and presentation

**Compound Component Pattern:**
- Complex UI components built from smaller, focused sub-components
- Flexible composition for varied use cases
- Consistent API across component families

**Render Props / Custom Hooks:**
- Reusable logic encapsulated in custom hooks
- Cross-cutting concerns (authentication, data fetching, validation) abstracted
- Component logic separation for improved testability

## Technology Stack

### Core Framework
- **React 18.3.x:** Latest stable with concurrent features and automatic batching
- **Next.js 14.x:** App Router with server components and streaming SSR
- **TypeScript 5.3.x:** Strict type checking with latest language features

### State Management
- **Zustand 4.x:** Lightweight, flexible state management without boilerplate
- **React Query 5.x:** Server state management with advanced caching and synchronization
- **React Hook Form 7.x:** Performant form state management with validation

### UI & Styling
- **Tailwind CSS 3.x:** Utility-first CSS framework with custom design system
- **Headless UI 2.x:** Unstyled, accessible UI components
- **Framer Motion 11.x:** Advanced animations and gesture handling

### Development Tools
- **Vite 5.x:** Lightning-fast build tool and development server
- **ESLint 8.x:** Code linting with custom electrical domain rules
- **Prettier 3.x:** Consistent code formatting
- **Storybook 7.x:** Component development and documentation

## Directory Structure

```
frontend/
├── public/                          # Static assets
│   ├── icons/                       # SVG icons and favicons
│   ├── images/                      # Static images and illustrations
│   └── fonts/                       # Custom font files
├── src/
│   ├── app/                         # Next.js App Router pages
│   │   ├── (auth)/                  # Route groups for auth layouts
│   │   ├── dashboard/               # Dashboard pages and layouts
│   │   ├── workspace/               # Drawing workspace pages
│   │   ├── projects/                # Project management pages
│   │   ├── reports/                 # Reporting and analytics pages
│   │   ├── layout.tsx               # Root layout component
│   │   ├── page.tsx                 # Homepage component
│   │   ├── loading.tsx              # Global loading UI
│   │   ├── error.tsx                # Global error UI
│   │   └── not-found.tsx            # 404 page component
│   ├── components/                  # Reusable UI components
│   │   ├── ui/                      # Base design system components
│   │   │   ├── Button/              # Button component variants
│   │   │   ├── Input/               # Form input components
│   │   │   ├── Card/                # Card layout components
│   │   │   ├── Modal/               # Modal and dialog components
│   │   │   └── index.ts             # Component exports
│   │   ├── forms/                   # Form-specific components
│   │   │   ├── ProjectForm/         # Project creation forms
│   │   │   ├── ValidationForm/      # Estimation validation forms
│   │   │   └── index.ts             # Form component exports
│   │   ├── charts/                  # Data visualization components
│   │   │   ├── ProgressChart/       # Project progress visualizations
│   │   │   ├── AccuracyChart/       # Estimation accuracy charts
│   │   │   └── index.ts             # Chart component exports
│   │   ├── electrical/              # Domain-specific components
│   │   │   ├── CircuitViewer/       # PDF circuit analysis interface
│   │   │   ├── ComponentPanel/      # Electrical component details
│   │   │   ├── EstimationInterface/ # Man-hour estimation UI
│   │   │   └── index.ts             # Electrical component exports
│   │   └── layout/                  # Layout and navigation components
│   │       ├── Header/              # Application header
│   │       ├── Sidebar/             # Navigation sidebar
│   │       ├── Footer/              # Application footer
│   │       └── index.ts             # Layout component exports
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAuth.ts               # Authentication state and methods
│   │   ├── useProjects.ts           # Project data management
│   │   ├── useCircuitAnalysis.ts    # Circuit analysis operations
│   │   ├── useEstimation.ts         # Estimation calculation hooks
│   │   └── index.ts                 # Hook exports
│   ├── services/                    # API communication layer
│   │   ├── api/                     # API client configuration
│   │   │   ├── client.ts            # Base API client setup
│   │   │   ├── auth.ts              # Authentication endpoints
│   │   │   ├── projects.ts          # Project management endpoints
│   │   │   ├── circuits.ts          # Circuit analysis endpoints
│   │   │   ├── estimations.ts       # Estimation endpoints
│   │   │   └── index.ts             # API service exports
│   │   ├── websocket/               # Real-time communication
│   │   │   ├── client.ts            # WebSocket client setup
│   │   │   ├── handlers.ts          # Message handling logic
│   │   │   └── index.ts             # WebSocket exports
│   │   └── storage/                 # Local storage utilities
│   │       ├── localStorage.ts      # Browser storage wrapper
│   │       ├── sessionStorage.ts    # Session storage utilities
│   │       └── index.ts             # Storage exports
│   ├── stores/                      # Zustand state stores
│   │   ├── authStore.ts             # Authentication state
│   │   ├── projectStore.ts          # Project management state
│   │   ├── circuitStore.ts          # Circuit analysis state
│   │   ├── estimationStore.ts       # Estimation calculation state
│   │   ├── uiStore.ts               # UI state and preferences
│   │   └── index.ts                 # Store exports
│   ├── utils/                       # Utility functions and helpers
│   │   ├── validation/              # Form and data validation
│   │   │   ├── schemas.ts           # Zod validation schemas
│   │   │   ├── rules.ts             # Custom validation rules
│   │   │   └── index.ts             # Validation exports
│   │   ├── formatting/              # Data formatting utilities
│   │   │   ├── currency.ts          # Currency formatting
│   │   │   ├── dates.ts             # Date/time formatting
│   │   │   ├── numbers.ts           # Number formatting
│   │   │   └── index.ts             # Formatting exports
│   │   ├── constants/               # Application constants
│   │   │   ├── routes.ts            # Route definitions
│   │   │   ├── colors.ts            # Design system colors
│   │   │   ├── breakpoints.ts       # Responsive breakpoints
│   │   │   └── index.ts             # Constants exports
│   │   └── helpers/                 # General utility functions
│   │       ├── arrays.ts            # Array manipulation utilities
│   │       ├── objects.ts           # Object manipulation utilities
│   │       ├── strings.ts           # String manipulation utilities
│   │       └── index.ts             # Helper exports
│   ├── types/                       # TypeScript type definitions
│   │   ├── api.ts                   # API response types
│   │   ├── electrical.ts            # Electrical domain types
│   │   ├── user.ts                  # User and authentication types
│   │   ├── project.ts               # Project management types
│   │   └── index.ts                 # Type exports
│   ├── styles/                      # Global styles and themes
│   │   ├── globals.css              # Global CSS styles
│   │   ├── components.css           # Component-specific styles
│   │   └── tailwind.config.js       # Tailwind configuration
│   └── tests/                       # Test files and utilities
│       ├── __mocks__/               # Mock data and functions
│       ├── utils/                   # Testing utility functions
│       ├── setup.ts                 # Test environment setup
│       └── jest.config.js           # Jest configuration
├── .env.local                       # Local environment variables
├── .env.example                     # Environment variable template
├── next.config.js                   # Next.js configuration
├── tailwind.config.js               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
├── package.json                     # Dependencies and scripts
└── README.md                        # Frontend documentation
```

## Component Strategy & Conventions

### Component Architecture

**Base Component Library:**
- Headless UI components as foundation for accessibility
- Custom design system built on Tailwind CSS utilities
- Consistent prop interfaces across component families
- Comprehensive TypeScript typing for all component APIs

**Component Naming Conventions:**
- PascalCase for component names and file names
- Descriptive, domain-specific naming (CircuitViewer, EstimationPanel)
- Suffix conventions: Container, Provider, Hook, Store
- Consistent export patterns with named and default exports

**Component Composition:**
```typescript
// Example: Circuit Analysis Component Composition
<CircuitAnalysisContainer>
  <CircuitViewer 
    pdfUrl={pdfUrl}
    onComponentSelect={handleComponentSelect}
    highlightedCircuits={selectedCircuits}
  />
  <ComponentPanel 
    selectedComponent={activeComponent}
    onSpecificationUpdate={handleSpecUpdate}
  />
  <EstimationInterface
    circuitData={circuitData}
    onEstimateGenerate={handleEstimateGenerate}
  />
</CircuitAnalysisContainer>
```

### Component Categories

**UI Components (src/components/ui/):**
- Basic building blocks: Button, Input, Card, Modal
- Consistent sizing, spacing, and interaction patterns
- Full accessibility support with ARIA attributes
- Comprehensive prop interfaces for customization

**Form Components (src/components/forms/):**
- React Hook Form integration with validation
- Field-level error handling and user feedback
- Auto-save capabilities for complex forms
- Multi-step form support with progress indication

**Chart Components (src/components/charts/):**
- Recharts integration for data visualization
- Responsive design across device breakpoints
- Interactive features: zoom, pan, data point selection
- Export capabilities for reports and documentation

**Electrical Components (src/components/electrical/):**
- Domain-specific UI for circuit analysis
- PDF viewer integration with annotation capabilities
- Component specification panels with technical data
- Estimation interfaces with calculation previews

**Layout Components (src/components/layout/):**
- Application shell with header, sidebar, footer
- Responsive navigation with mobile adaptations
- Context-aware content areas that adapt to user role
- Breadcrumb navigation for complex workflows

## State Management (Zustand)

### Store Architecture

**Global Stores:**
```typescript
// Authentication Store
interface AuthStore {
  user: User | null;
  role: UserRole;
  permissions: Permission[];
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// Project Store
interface ProjectStore {
  projects: Project[];
  activeProject: Project | null;
  createProject: (data: CreateProjectData) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectData) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (project: Project) => void;
}

// Circuit Analysis Store
interface CircuitStore {
  analysisResults: CircuitAnalysis[];
  selectedComponents: ElectricalComponent[];
  estimationData: EstimationData | null;
  analyzeCircuit: (pdfFile: File) => Promise<CircuitAnalysis>;
  selectComponent: (component: ElectricalComponent) => void;
  generateEstimation: (analysisId: string) => Promise<EstimationData>;
}
```

**Store Composition Patterns:**
- Modular stores with clear boundaries and responsibilities
- Cross-store communication through computed selectors
- Persistent state for user preferences and session data
- Optimistic updates with rollback capabilities

**State Persistence:**
- Local storage for user preferences and UI state
- Session storage for temporary data and form state
- Server synchronization for critical business data
- Offline capability with conflict resolution

### State Flow Patterns

**Data Fetching Flow:**
1. Component mounts and triggers data fetch through custom hook
2. React Query manages cache, loading states, and error handling
3. Successful data updates relevant Zustand store
4. Store update triggers component re-render with fresh data
5. Background refetch maintains data freshness

**User Interaction Flow:**
1. User interaction triggers action in UI component
2. Action updates local Zustand store optimistically
3. Async operation initiated to sync with backend
4. Success/failure updates store with final state
5. UI reflects final state with appropriate feedback

## API Interaction Layer

### HTTP Client Configuration

**Base Client Setup:**
```typescript
// API Client with Interceptors
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor for Authentication
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor for Error Handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
```

**React Query Integration:**
```typescript
// Circuit Analysis Query
export const useCircuitAnalysis = (projectId: string) => {
  return useQuery({
    queryKey: ['circuit-analysis', projectId],
    queryFn: () => circuitApi.getAnalysis(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

// Estimation Mutation
export const useCreateEstimation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: estimationApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['estimations']);
      queryClient.setQueryData(['estimation', data.id], data);
    },
  });
};
```

### API Service Organization

**Service Layer Structure:**
- Dedicated service files for each domain (auth, projects, circuits)
- Consistent error handling and response transformation
- Request/response type safety with TypeScript
- Retry logic for critical operations

**Caching Strategy:**
- Aggressive caching for static reference data
- Smart invalidation for dynamic project data
- Optimistic updates for immediate user feedback
- Background refresh for data consistency

## Routing Strategy (Next.js App Router)

### Route Organization

**App Router Structure:**
```
app/
├── (auth)/                    # Route group for authentication
│   ├── login/page.tsx         # Login page
│   ├── register/page.tsx      # Registration page
│   └── layout.tsx             # Auth layout
├── dashboard/                 # Project dashboard
│   ├── page.tsx               # Dashboard overview
│   ├── projects/              # Project management
│   │   ├── page.tsx           # Project list
│   │   ├── [id]/              # Dynamic project routes
│   │   │   ├── page.tsx       # Project details
│   │   │   ├── workspace/     # Circuit workspace
│   │   │   │   └── page.tsx   # Workspace interface
│   │   │   └── reports/       # Project reports
│   │   │       └── page.tsx   # Report interface
│   │   └── new/               # New project creation
│   │       └── page.tsx       # Project creation form
│   └── layout.tsx             # Dashboard layout
├── reports/                   # System-wide reports
│   ├── page.tsx               # Report dashboard
│   ├── accuracy/page.tsx      # Estimation accuracy
│   └── productivity/page.tsx  # Team productivity
├── settings/                  # User and system settings
│   ├── page.tsx               # Settings overview
│   ├── profile/page.tsx       # User profile
│   └── preferences/page.tsx   # User preferences
├── layout.tsx                 # Root layout
├── page.tsx                   # Homepage
├── loading.tsx                # Global loading UI
├── error.tsx                  # Global error boundary
└── not-found.tsx              # 404 page
```

**Route Protection:**
```typescript
// Middleware for Route Protection
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Navigation Patterns

**Programmatic Navigation:**
- Next.js router for client-side navigation
- URL state management for bookmarkable views
- Back/forward browser history support
- Loading states during route transitions

**Deep Linking Support:**
- Shareable URLs for specific circuit analyses
- Project-specific workspaces with state restoration
- Report URLs with filter parameters
- Component-level routing for complex interfaces

## Build, Bundling & Deployment

### Build Configuration

**Next.js Configuration:**
```javascript
// next.config.js
const nextConfig = {
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['canvas'],
  },
  images: {
    domains: ['storage.electrical-orchestrator.com'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        canvas: false,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL}/:path*`,
      },
    ];
  },
};
```

**Bundle Optimization:**
- Code splitting by route and component
- Dynamic imports for heavy libraries (PDF.js, Chart.js)
- Tree shaking for unused code elimination
- Bundle analysis with webpack-bundle-analyzer

### Environment Management

**Environment Variables:**
```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.electrical-orchestrator.com
NEXT_PUBLIC_WS_URL=wss://ws.electrical-orchestrator.com
NEXT_PUBLIC_STORAGE_URL=https://storage.electrical-orchestrator.com
NEXT_PUBLIC_SENTRY_DSN=https://sentry.electrical-orchestrator.com
AUTH_SECRET=complex-auth-secret-key
DATABASE_URL=postgresql://user:pass@localhost:5432/electrical_orchestrator
```

**Build Scripts:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "type-check": "tsc --noEmit",
    "build:analyze": "ANALYZE=true next build"
  }
}
```

### Deployment Strategy

**Production Deployment:**
- Vercel deployment with automatic preview environments
- Edge deployment for global performance
- CDN integration for static asset delivery
- Progressive Web App (PWA) support for offline access

**Performance Monitoring:**
- Core Web Vitals tracking with Vercel Analytics
- Real User Monitoring (RUM) with Sentry
- Bundle size monitoring with continuous integration
- Performance budgets with automated alerts

## Frontend Testing Strategy

### Testing Philosophy

**Testing Pyramid:**
- Unit tests for utilities, hooks, and pure functions (70%)
- Integration tests for component interactions (20%)
- End-to-end tests for critical user journeys (10%)

**Testing Objectives:**
- Ensure electrical domain logic correctness
- Validate user interaction patterns
- Verify accessibility compliance
- Confirm responsive behavior across devices

### Testing Tools & Configuration

**Unit Testing:**
```javascript
// Jest Configuration
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

**Component Testing:**
```typescript
// React Testing Library Example
import { render, screen, fireEvent } from '@testing-library/react';
import { CircuitViewer } from '@/components/electrical/CircuitViewer';

describe('CircuitViewer', () => {
  it('highlights selected components correctly', () => {
    const mockComponent = { id: '1', type: 'transformer' };
    render(<CircuitViewer selectedComponent={mockComponent} />);
    
    const highlightedElement = screen.getByTestId('component-1');
    expect(highlightedElement).toHaveClass('component-highlighted');
  });
});
```

**E2E Testing:**
```typescript
// Playwright Configuration
import { test, expect } from '@playwright/test';

test('complete estimation workflow', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('[data-testid="upload-drawing"]');
  await page.setInputFiles('[data-testid="file-input"]', 'sample-drawing.pdf');
  await page.click('[data-testid="analyze-circuit"]');
  await expect(page.locator('[data-testid="estimation-result"]')).toBeVisible();
});
```

### Test Data Management

**Mock Data Strategy:**
- Realistic electrical component specifications
- Sample PDF drawings for testing circuit analysis
- Historical estimation data for comparison testing
- User role variations for permission testing

**API Mocking:**
- MSW (Mock Service Worker) for realistic API simulation
- Deterministic test data for consistent results
- Error scenario simulation for robust error handling
- Performance testing with delayed responses

## Performance Considerations

### Loading Performance

**Critical Resource Optimization:**
- Preload critical CSS and JavaScript bundles
- Optimize font loading with font-display: swap
- Compress images with WebP format and responsive sizing
- Minimize cumulative layout shift (CLS) with size hints

**Code Splitting Strategy:**
```typescript
// Route-based Code Splitting
const CircuitWorkspace = lazy(() => import('@/components/electrical/CircuitWorkspace'));
const ReportDashboard = lazy(() => import('@/components/reports/ReportDashboard'));

// Feature-based Code Splitting
const PdfViewer = lazy(() => import('@/components/pdf/PdfViewer'));
const ChartComponents = lazy(() => import('@/components/charts'));
```

**Resource Prioritization:**
- Critical path CSS inlined in document head
- Non-critical CSS loaded asynchronously
- JavaScript bundles loaded with appropriate priority
- PDF.js worker loaded on-demand for circuit analysis

### Runtime Performance

**Rendering Optimization:**
```typescript
// React.memo for expensive components
const CircuitAnalysisPanel = React.memo(({ 
  circuitData, 
  onComponentSelect 
}) => {
  // Expensive component logic
}, (prevProps, nextProps) => {
  return prevProps.circuitData.id === nextProps.circuitData.id;
});

// useMemo for expensive calculations
const estimationSummary = useMemo(() => {
  return calculateComplexEstimation(circuitData, historicalData);
}, [circuitData.id, historicalData.version]);

// useCallback for stable references
const handleComponentSelect = useCallback((componentId: string) => {
  setSelectedComponent(components.find(c => c.id === componentId));
}, [components]);
```

**State Update Optimization:**
- Batch state updates to minimize re-renders
- Virtualization for large component lists
- Debounced search inputs to reduce API calls
- Optimistic updates for immediate user feedback

### Memory Management

**Large File Handling:**
- PDF streaming for large electrical drawings
- Image lazy loading with intersection observer
- Component unmounting cleanup for event listeners
- Canvas memory management for circuit visualization

**Cache Management:**
- LRU cache for recently viewed drawings
- Selective state persistence to reduce memory footprint
- Garbage collection assistance with object pooling
- Background cleanup of unused resources

---

*Frontend Architecture Document v1.0 - Created following BMAD methodology by Design Architect (Millie)*