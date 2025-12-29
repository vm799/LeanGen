#!/bin/bash

echo "🚀 LeadGenius Setup Script"
echo "=========================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. You'll need to install it separately."
fi

# Check if Redis is installed
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis not found. You'll need to install it separately."
fi

echo ""
echo "📦 Installing backend dependencies..."
cd backend
cp .env.example .env
npm install
echo "✅ Backend dependencies installed"
echo ""

echo "📦 Installing frontend dependencies..."
cd ../frontend
cp .env.example .env
npm install
echo "✅ Frontend dependencies installed"
echo ""

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit backend/.env with your API keys"
echo "2. Edit frontend/.env with your API keys"
echo "3. Start PostgreSQL and Redis"
echo "4. Run 'cd backend && npm run dev' in one terminal"
echo "5. Run 'cd frontend && npm run dev' in another terminal"
echo "6. Open http://localhost:5173 in your browser"
echo ""
echo "📖 Read README.md for detailed setup instructions"
