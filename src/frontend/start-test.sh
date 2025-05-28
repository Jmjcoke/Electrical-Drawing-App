#!/bin/bash

echo "🚀 Starting Electrical Orchestrator Test Environment"
echo ""
echo "📋 Quick Start Guide:"
echo "1. Copy .env.example to .env.local"
echo "2. Add your API keys (optional for mock mode)"
echo "3. Visit http://localhost:3000/training"
echo "4. Click 'Test Extraction' button in bottom right"
echo ""
echo "🔑 API Key Setup (optional):"
echo "- OpenAI: https://platform.openai.com/api-keys"
echo "- Azure: https://portal.azure.com"
echo "- Google: https://console.cloud.google.com"
echo ""
echo "📦 Mock Mode: Works without API keys!"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "✅ Created .env.local - add your API keys here"
    echo ""
fi

# Start the development server
echo "Starting development server..."
npm run dev