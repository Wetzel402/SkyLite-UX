#!/bin/bash
# SkyLite-UX Development Environment Setup Script
# This script sets up the development environment for the SkyLite-UX project

set -e

echo "========================================"
echo "  SkyLite-UX Development Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
check_requirements() {
    echo "Checking requirements..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed. Please install Node.js 18+${NC}"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}Error: Node.js version 18+ is required. Current: $(node -v)${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is not installed.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ npm $(npm -v)${NC}"

    # Check for PostgreSQL client (optional but recommended)
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL client available${NC}"
    else
        echo -e "${YELLOW}! PostgreSQL client not found (optional)${NC}"
    fi

    echo ""
}

# Setup environment file
setup_env() {
    echo "Setting up environment..."

    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            echo -e "${YELLOW}! Created .env from .env.example - please configure it${NC}"
        else
            cat > .env << 'EOF'
# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/skylite?schema=public"

# Google OAuth Configuration (for Calendar and Photos integration)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/integrations/google-calendar/oauth/callback"

# OAuth Encryption Key (generate with: openssl rand -hex 32)
OAUTH_ENCRYPTION_KEY=""

# Optional: Timezone Configuration
NUXT_PUBLIC_TZ="America/Chicago"

# Optional: Log Level (trace, debug, info, warn, error)
NUXT_PUBLIC_LOG_LEVEL="info"

# Optional: Home Assistant Configuration
HOME_ASSISTANT_URL=""
HOME_ASSISTANT_TOKEN=""
EOF
            echo -e "${YELLOW}! Created .env file - please configure it with your settings${NC}"
        fi
    else
        echo -e "${GREEN}✓ .env file exists${NC}"
    fi

    echo ""
}

# Install dependencies
install_dependencies() {
    echo "Installing dependencies..."
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
}

# Setup database
setup_database() {
    echo "Setting up database..."

    # Generate Prisma client
    npx prisma generate
    echo -e "${GREEN}✓ Prisma client generated${NC}"

    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        source .env 2>/dev/null || true
    fi

    if [ -n "$DATABASE_URL" ]; then
        echo "Running database migrations..."
        npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate deploy
        echo -e "${GREEN}✓ Database migrations applied${NC}"
    else
        echo -e "${YELLOW}! DATABASE_URL not set - skipping migrations${NC}"
        echo -e "${YELLOW}  Run 'npx prisma migrate dev' after configuring .env${NC}"
    fi

    echo ""
}

# Start development server
start_dev() {
    echo "========================================"
    echo "  Setup Complete!"
    echo "========================================"
    echo ""
    echo "To start the development server, run:"
    echo -e "${GREEN}  npm run dev${NC}"
    echo ""
    echo "The application will be available at:"
    echo -e "${GREEN}  http://localhost:3000${NC}"
    echo ""
    echo "Other useful commands:"
    echo "  npm run build      - Build for production"
    echo "  npm run lint       - Run ESLint"
    echo "  npm run type-check - Run TypeScript checks"
    echo "  npx prisma studio  - Open Prisma database GUI"
    echo ""

    # Ask if user wants to start dev server
    read -p "Start development server now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting development server..."
        npm run dev
    fi
}

# Main execution
main() {
    check_requirements
    setup_env
    install_dependencies
    setup_database
    start_dev
}

# Run main function
main
