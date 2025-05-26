/**
 * Next.js Middleware for Route Protection
 * Handles authentication and authorization for protected routes
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Protected route patterns
const PROTECTED_ROUTES = [
  '/dashboard',
  '/workspace',
  '/projects',
  '/reports',
  '/settings',
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/',
];

interface TokenPayload {
  sub: string;
  role: string;
  permissions: string[];
  exp: number;
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route));
}

function getTokenFromRequest(request: NextRequest): string | null {
  // Try to get token from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try to get token from cookie
  const tokenCookie = request.cookies.get('auth-token');
  if (tokenCookie) {
    return tokenCookie.value;
  }

  return null;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = process.env.JWT_SECRET_KEY || 'fallback-secret-for-dev';
    const decoded = jwt.verify(token, secret) as TokenPayload;
    
    // Check if token is expired
    if (decoded.exp * 1000 < Date.now()) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  // System admin has all permissions
  if (userPermissions.includes('*')) {
    return true;
  }
  
  return userPermissions.includes(requiredPermission);
}

function getRequiredPermissionForRoute(pathname: string): string | null {
  // Define route-specific permissions
  const routePermissions: Record<string, string> = {
    '/dashboard': 'projects.read',
    '/workspace': 'circuits.read',
    '/projects': 'projects.read',
    '/reports': 'reports.read',
    '/settings': 'projects.read', // Basic permission for settings
  };

  for (const [route, permission] of Object.entries(routePermissions)) {
    if (pathname.startsWith(route)) {
      return permission;
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get token from request
  const token = getTokenFromRequest(request);

  // Handle protected routes
  if (isProtectedRoute(pathname)) {
    if (!token) {
      // No token, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(loginUrl);
    }

    // Check route-specific permissions
    const requiredPermission = getRequiredPermissionForRoute(pathname);
    if (requiredPermission && !hasPermission(payload.permissions, requiredPermission)) {
      // Insufficient permissions, redirect to unauthorized page
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Add user info to headers for use in components
    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.sub);
    response.headers.set('x-user-role', payload.role);
    response.headers.set('x-user-permissions', JSON.stringify(payload.permissions));
    
    return response;
  }

  // Handle authenticated users trying to access login page
  if (pathname === '/login' && token) {
    const payload = verifyToken(token);
    if (payload) {
      // Valid token, redirect to dashboard
      const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }

  // Allow access to public routes
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};