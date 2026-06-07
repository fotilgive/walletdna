#!/bin/bash

echo ""
echo " ========================================"
echo "  WalletDNA - Smart Money Intelligence"
echo " ========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo " [ERROR] Node.js not found."
    echo ""
    echo " Please install Node.js from: https://nodejs.org"
    echo " Download the LTS version, then run this script again."
    echo ""
    exit 1
fi

echo " [OK] Node.js found: $(node --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo ""
    echo " Installing dependencies... (this happens only once)"
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo " [ERROR] npm install failed."
        exit 1
    fi
fi

# Build frontend if dist doesn't exist
if [ ! -d "dist" ]; then
    echo ""
    echo " Building frontend assets... (this happens only once)"
    echo ""
    npm run build
    if [ $? -ne 0 ]; then
        echo ""
        echo " [ERROR] Frontend build failed."
        exit 1
    fi
fi

echo ""
echo " ========================================"
echo "  WalletDNA is starting!"
echo "  Dashboard: http://localhost:3001"
echo " ========================================"
echo ""

# Wait 1s and open browser
sleep 1
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3001
else
    xdg-open http://localhost:3001 2>/dev/null || echo " Open http://localhost:3001 in your browser"
fi

# Start server (blocking process to keep script running)
node server.js
