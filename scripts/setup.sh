#!/bin/bash

# SaviSanju Backend Setup Script

echo "🚀 Setting up SaviSanju Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. You'll need to install PostgreSQL manually."
else
    echo "✅ Docker detected"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration"
else
    echo "✅ .env file already exists"
fi

# Generate JWT secret
echo "🔐 Generating JWT secret..."
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET" >> .env.local
echo "✅ JWT secret generated (saved to .env.local)"

# Start Docker containers
if command -v docker &> /dev/null; then
    echo "🐳 Starting Docker containers..."
    docker-compose up -d postgres redis
    echo "⏳ Waiting for database to be ready..."
    sleep 5
    echo "✅ Database is ready"
fi

# Run migrations
echo "🗄️  Running database migrations..."
if command -v psql &> /dev/null; then
    psql -U postgres -d savisanju -f migrations/001_initial_schema.sql
    echo "✅ Migrations completed"
else
    echo "⚠️  psql not found. Please run migrations manually:"
    echo "   psql -U postgres -d savisanju -f migrations/001_initial_schema.sql"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Generate admin password hash:"
echo "   node -e \"const bcrypt = require('bcryptjs'); bcrypt.hash('YourPassword', 10, (err, hash) => console.log(hash));\""
echo "3. Start development server:"
echo "   npm run dev"
echo ""
echo "API will be available at: http://localhost:5000"
