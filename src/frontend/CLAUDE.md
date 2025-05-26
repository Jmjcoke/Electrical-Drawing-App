# Frontend Application - Claude Code Configuration

## Overview

Frontend for Electrical Orchestrator using Next.js 14 with App Router, React Server Components, and TypeScript, following BMAD Method development standards.

## BMAD Method Integration

### Frontend Development Persona
Use the **Frontend Developer Agent** persona from BMAD Orchestrator for frontend implementation:

```markdown
# Activate Frontend Developer Agent
I need to work on frontend components. Please activate the Frontend Dev (DevFE) persona specialized in NextJS, React, TypeScript, HTML, and Tailwind.
```

### Story Implementation Workflow
1. **Load Story**: Reference assigned story from `docs/stories/[epic].[story].story.md`
2. **UI/UX Context**: Review `docs/front-end-spec.md` and `docs/frontend-architecture.md`
3. **Component Development**: Follow React patterns and TypeScript best practices
4. **Testing**: Jest + React Testing Library for components, Playwright for E2E
5. **Documentation**: Storybook documentation for components

## Architecture Overview

### Application Structure
```
src/frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth route group
│   ├── (dashboard)/       # Dashboard route group
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   ├── electrical/       # Domain-specific components
│   ├── pdf/              # PDF-related components
│   ├── projects/         # Project management components
│   └── layout/           # Layout components
├── hooks/                # Custom React hooks
├── services/            # API and external services
│   ├── api/             # API client functions
│   ├── storage/         # Local storage utilities
│   └── websocket/       # WebSocket connections
├── stores/              # Global state management (Zustand)
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── tests/               # Test files
```

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **UI Library**: React 18 with Server Components
- **Language**: TypeScript with strict configuration
- **Styling**: Tailwind CSS with custom component library
- **State Management**: Zustand for global state, React Query for server state
- **Testing**: Jest + React Testing Library, Playwright for E2E
- **Build Tools**: Next.js built-in bundling with Turbopack

## Development Commands

### Environment Setup
```bash
cd src/frontend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with appropriate values

# Start development server
npm run dev

# Start with specific port
npm run dev -- --port 3001

# Start with turbopack (faster)
npm run dev -- --turbo
```

### Development Workflow
```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint
npm run type-check      # TypeScript type checking

# Testing
npm run test            # Run Jest tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
npm run e2e             # Run Playwright E2E tests
npm run e2e:ui          # Run E2E with UI

# Storybook (if configured)
npm run storybook       # Start Storybook dev server
npm run build-storybook # Build Storybook for deployment
```

## Code Standards & Patterns

### Component Structure (TypeScript)
```tsx
// ComponentName.tsx
'use client'; // Only if using client-side features

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Types
interface ComponentNameProps {
  title: string;
  items: Item[];
  onSelect?: (item: Item) => void;
  className?: string;
  children?: React.ReactNode;
}

interface Item {
  id: string;
  name: string;
  description?: string;
}

// Component
const ComponentName: React.FC<ComponentNameProps> = ({
  title,
  items,
  onSelect,
  className,
  children
}) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Event handlers
  const handleSelect = useCallback((item: Item) => {
    setSelectedItem(item);
    onSelect?.(item);
  }, [onSelect]);

  // Effects
  useEffect(() => {
    // Component initialization logic
    console.log('Component mounted with', items.length, 'items');
  }, [items]);

  // Render helpers
  const renderItem = (item: Item) => (
    <div
      key={item.id}
      onClick={() => handleSelect(item)}
      className="cursor-pointer p-2 hover:bg-gray-100 rounded"
    >
      <h3 className="font-semibold">{item.name}</h3>
      {item.description && (
        <p className="text-sm text-gray-600">{item.description}</p>
      )}
    </div>
  );

  return (
    <div className={cn('component-name', className)}>
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      
      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(renderItem)}
        </div>
      )}
      
      {children}
    </div>
  );
};

export default ComponentName;
```

### Server Component Pattern
```tsx
// app/dashboard/page.tsx - Server Component
import { Suspense } from 'react';
import { getDashboardData } from '@/services/api/dashboard';
import DashboardClient from './DashboardClient';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

// Server Component - runs on server
export default async function DashboardPage() {
  // Server-side data fetching
  const initialData = await getDashboardData();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <Suspense fallback={<LoadingSkeleton />}>
        <DashboardClient initialData={initialData} />
      </Suspense>
    </div>
  );
}

// Metadata export for SEO
export const metadata = {
  title: 'Dashboard - Electrical Orchestrator',
  description: 'Project management dashboard for electrical contractors'
};
```

### Client Component with Hooks
```tsx
// DashboardClient.tsx - Client Component
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getDashboardData } from '@/services/api/dashboard';

interface DashboardClientProps {
  initialData: DashboardData;
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const { user } = useAuthStore();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: getDashboardData,
    initialData,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (error) {
    return <div className="text-red-600">Error loading dashboard</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Dashboard content */}
    </div>
  );
}
```

### Custom Hooks
```tsx
// hooks/useComponentSelection.ts
import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { componentRecognitionService } from '@/services/api/componentRecognition';

interface UseComponentSelectionProps {
  imageUrl?: string;
  onSelectionChange?: (selections: ComponentSelection[]) => void;
}

interface ComponentSelection {
  id: string;
  boundingBox: BoundingBox;
  confidence: number;
  category: string;
}

export const useComponentSelection = ({
  imageUrl,
  onSelectionChange
}: UseComponentSelectionProps) => {
  const [selections, setSelections] = useState<ComponentSelection[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Query for component recognition
  const { data: recognitionResults, isLoading } = useQuery({
    queryKey: ['component-recognition', imageUrl],
    queryFn: () => componentRecognitionService.recognizeComponents(imageUrl!),
    enabled: !!imageUrl,
  });

  const addSelection = useCallback((selection: ComponentSelection) => {
    setSelections(prev => {
      const updated = [...prev, selection];
      onSelectionChange?.(updated);
      return updated;
    });
  }, [onSelectionChange]);

  const removeSelection = useCallback((id: string) => {
    setSelections(prev => {
      const updated = prev.filter(s => s.id !== id);
      onSelectionChange?.(updated);
      return updated;
    });
  }, [onSelectionChange]);

  const clearSelections = useCallback(() => {
    setSelections([]);
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  return {
    selections,
    isSelecting,
    isLoading,
    recognitionResults,
    canvasRef,
    addSelection,
    removeSelection,
    clearSelections,
    setIsSelecting
  };
};
```

### State Management (Zustand)
```tsx
// stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials) => {
        set({ isLoading: true });
        try {
          const response = await authService.login(credentials);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false
        });
      },

      refreshToken: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const response = await authService.refreshToken(token);
          set({ token: response.token });
        } catch (error) {
          // Token refresh failed, logout user
          get().logout();
          throw error;
        }
      },

      updateUser: (userData) => {
        set(state => ({
          user: state.user ? { ...state.user, ...userData } : null
        }));
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
```

### API Service Layer
```tsx
// services/api/componentRecognition.ts
import { ApiResponse, BoundingBox } from '@/types/api';

class ComponentRecognitionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  async recognizeComponents(
    imageFile: File,
    boundingBoxes: BoundingBox[]
  ): Promise<ApiResponse<ComponentRecognitionResult[]>> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('bounding_boxes', JSON.stringify(boundingBoxes));

      const response = await fetch(`${this.baseUrl}/api/v1/components/recognize`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Component recognition error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getToken(): string | null {
    // Get token from auth store or localStorage
    return localStorage.getItem('auth-token');
  }
}

export const componentRecognitionService = new ComponentRecognitionService();
```

## UI Component Library

### Base UI Components
```tsx
// components/ui/Button.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
            'border border-input bg-background hover:bg-accent hover:text-accent-foreground': variant === 'outline',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
            'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
            'text-primary underline-offset-4 hover:underline': variant === 'link'
          },
          {
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-11 rounded-md px-8': size === 'lg',
            'h-10 w-10': size === 'icon'
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
```

### Domain-Specific Components
```tsx
// components/electrical/ComponentInformationPanel.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';

interface ComponentInformationPanelProps {
  component: ElectricalComponent;
  className?: string;
}

export const ComponentInformationPanel: React.FC<ComponentInformationPanelProps> = ({
  component,
  className
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{component.name}</span>
          <Badge variant={component.status === 'active' ? 'default' : 'secondary'}>
            {component.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Component specifications */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Specifications</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Voltage:</span>
                <span className="ml-2 font-medium">{component.voltage}V</span>
              </div>
              <div>
                <span className="text-gray-600">Current:</span>
                <span className="ml-2 font-medium">{component.current}A</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Component details */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Details</h4>
            <p className="text-sm text-gray-600">{component.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

## Testing Standards

### Component Testing (Jest + RTL)
```tsx
// components/electrical/ComponentInformationPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { ComponentInformationPanel } from './ComponentInformationPanel';

const mockComponent = {
  id: '1',
  name: 'Test Component',
  voltage: 120,
  current: 15,
  status: 'active' as const,
  description: 'Test component description'
};

describe('ComponentInformationPanel', () => {
  it('renders component information correctly', () => {
    render(<ComponentInformationPanel component={mockComponent} />);
    
    expect(screen.getByText('Test Component')).toBeInTheDocument();
    expect(screen.getByText('120V')).toBeInTheDocument();
    expect(screen.getByText('15A')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('Test component description')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ComponentInformationPanel 
        component={mockComponent} 
        className="custom-class" 
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
```

### E2E Testing (Playwright)
```typescript
// tests/e2e/component-specification-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Component Specification Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should upload PDF and recognize components', async ({ page }) => {
    // Navigate to PDF upload
    await page.click('[data-testid="upload-pdf-button"]');
    
    // Upload PDF file
    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    await fileInput.setInputFiles('test-files/electrical-drawing.pdf');
    
    // Wait for processing
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-indicator"]')).not.toBeVisible({
      timeout: 30000
    });
    
    // Verify component recognition
    await expect(page.locator('[data-testid="component-list"]')).toBeVisible();
    
    const componentCount = await page.locator('[data-testid="component-item"]').count();
    expect(componentCount).toBeGreaterThan(0);
  });

  test('should display component specifications on selection', async ({ page }) => {
    // Assuming PDF is already uploaded and components are recognized
    await page.goto('/projects/1/drawings/1');
    
    // Select first component
    await page.click('[data-testid="component-item"]:first-child');
    
    // Verify specification panel appears
    await expect(page.locator('[data-testid="specification-panel"]')).toBeVisible();
    
    // Check specification details
    await expect(page.locator('[data-testid="component-name"]')).toHaveText(/\w+/);
    await expect(page.locator('[data-testid="component-voltage"]')).toHaveText(/\d+V/);
    await expect(page.locator('[data-testid="component-current"]')).toHaveText(/\d+A/);
  });
});
```

## Styling & Design System

### Tailwind Configuration
```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // Electrical Orchestrator brand colors
        electrical: {
          50: '#f0f9ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

### CSS Variables
```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.2 91.2% 59.8%;
  }
}

@layer utilities {
  .electrical-gradient {
    background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%);
  }
  
  .component-highlight {
    @apply ring-2 ring-blue-500 ring-opacity-50 bg-blue-50;
  }
}
```

## Performance Optimization

### Code Splitting & Lazy Loading
```tsx
// Dynamic imports for heavy components
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const PDFViewer = dynamic(() => import('@/components/pdf/PDFViewer'), {
  loading: () => <div>Loading PDF viewer...</div>,
  ssr: false // Disable SSR for client-only components
});

const ComponentRecognition = dynamic(
  () => import('@/components/electrical/ComponentRecognition'),
  { 
    loading: () => <div>Loading recognition engine...</div>
  }
);

// Usage with Suspense
export default function DrawingAnalysis() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <PDFViewer />
        <ComponentRecognition />
      </Suspense>
    </div>
  );
}
```

### Image Optimization
```tsx
// Next.js Image component with optimization
import Image from 'next/image';

export const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  width: number;
  height: number;
}> = ({ src, alt, width, height }) => {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      priority={false} // Only true for above-the-fold images
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
    />
  );
};
```

## Deployment Configuration

### Next.js Configuration
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  images: {
    domains: ['localhost', 'api.electrical-orchestrator.com'],
    formats: ['image/avif', 'image/webp'],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
```

### Environment Variables
```bash
# .env.example
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_APP_ENV=development

# Private (server-side only)
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-jwt-secret
```

This frontend configuration provides comprehensive guidance for developing React/Next.js applications following BMAD Method principles with Claude Code best practices.