#!/bin/bash
# Setup script for Property Data Ingestion Tool

echo "🚀 Setting up Property Data Ingestion Tool..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm found: $(npm -v)"

# Install root dependencies
echo ""
echo "📦 Installing root dependencies..."
npm install

# Install client dependencies
echo ""
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your MariaDB credentials"
echo "2. Create the database: mysql -u root -p < server/config/schema.sql"
echo "3. Run 'npm run dev' to start the backend (Terminal 1)"
echo "4. Run 'npm run client' to start the frontend (Terminal 2)"
echo "5. Open http://localhost:3000 in your browser"
