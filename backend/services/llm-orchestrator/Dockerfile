# Multi-stage Dockerfile for LLM Orchestrator Service

# Development stage
FROM node:18-alpine AS development
WORKDIR /app

# Install system dependencies for image processing and ML
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pkgconfig

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Create directories
RUN mkdir -p /app/logs \
    && mkdir -p /app/storage/sessions \
    && chown -R node:node /app

USER node

EXPOSE 3002

# Development command (overridden in docker-compose.dev.yml)
CMD ["npm", "run", "dev"]

# Production build stage  
FROM node:18-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pkgconfig

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install production dependencies and ML libraries
RUN apk add --no-cache \
    python3 \
    py3-pip \
    cairo \
    jpeg \
    pango \
    giflib \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create and set permissions for directories
RUN mkdir -p /app/logs \
    && mkdir -p /app/storage/sessions \
    && chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3002/api/v1/health || exit 1

EXPOSE 3002

CMD ["node", "dist/app.js"]