import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';

// Add axe matcher
expect.extend(toHaveNoViolations);

const theme = createTheme();

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

/**
 * Test accessibility using axe-core
 */
export const testA11y = async (container: HTMLElement) => {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
};

/**
 * Mock ResizeObserver for tests
 */
export const mockResizeObserver = () => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
};

/**
 * Mock IntersectionObserver for tests
 */
export const mockIntersectionObserver = () => {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
};

/**
 * Mock clipboard API for tests
 */
export const mockClipboard = () => {
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined),
      readText: jest.fn().mockResolvedValue(''),
    },
  });
};

/**
 * Mock matchMedia for responsive testing
 */
export const mockMatchMedia = (matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

/**
 * Create mock WebSocket for testing
 */
export const createMockWebSocket = () => ({
  connected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: WebSocket.CONNECTING,
});

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Create mock file for testing file uploads
 */
export const createMockFile = (
  name: string = 'test.pdf',
  size: number = 1024,
  type: string = 'application/pdf'
) => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/**
 * Simulate user typing with realistic delays
 */
export const simulateTyping = async (element: HTMLElement, text: string) => {
  const { fireEvent } = await import('@testing-library/react');
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    fireEvent.keyDown(element, { key: char, charCode: char.charCodeAt(0) });
    fireEvent.keyPress(element, { key: char, charCode: char.charCodeAt(0) });
    fireEvent.input(element, { target: { value: text.slice(0, i + 1) } });
    fireEvent.keyUp(element, { key: char, charCode: char.charCodeAt(0) });
    
    // Small delay to simulate realistic typing
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

/**
 * Test component with different viewport sizes
 */
export const testResponsiveComponent = async (
  renderFn: () => any,
  breakpoints: { width: number; height: number; name: string }[] = [
    { width: 320, height: 568, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1024, height: 768, name: 'desktop' },
  ]
) => {
  const results: { [key: string]: any } = {};
  
  for (const breakpoint of breakpoints) {
    // Set viewport size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: breakpoint.width,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: breakpoint.height,
    });
    
    // Update matchMedia mock
    mockMatchMedia(breakpoint.width < 768);
    
    // Trigger resize event
    window.dispatchEvent(new Event('resize'));
    
    // Render component and store result
    results[breakpoint.name] = renderFn();
    
    // Test accessibility
    await testA11y(results[breakpoint.name].container);
  }
  
  return results;
};