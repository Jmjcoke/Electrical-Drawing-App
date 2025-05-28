#!/bin/sh

# Development entrypoint for Next.js
cd /app/frontend

# Always install dependencies to ensure they're up to date
echo "Installing dependencies..."
npm install

# Start Next.js in development mode
echo "Starting Next.js development server..."
exec npm run dev