# SkyLite-UX Development Makefile
# Provides convenient commands for local development and testing

.PHONY: help install build dev test test-unit test-e2e test-all clean lint typecheck format

# Default target
help:
	@echo "SkyLite-UX Development Commands:"
	@echo ""
	@echo "  install     - Install dependencies"
	@echo "  build       - Build the application"
	@echo "  dev         - Start development server"
	@echo "  test        - Run all tests (unit + e2e)"
	@echo "  test-unit   - Run unit tests only"
	@echo "  test-e2e    - Run E2E tests only"
	@echo "  test-all    - Run all tests with build"
	@echo "  lint        - Run ESLint"
	@echo "  typecheck   - Run TypeScript type checking"
	@echo "  format      - Format code with Prettier"
	@echo "  clean       - Clean build artifacts"
	@echo ""

# Install dependencies
install:
	npm ci

# Build the application
build:
	npm run build

# Start development server
dev:
	npm run dev

# Run all tests
test:
	npm run test

# Run unit tests only
test-unit:
	npm run test:unit

# Run E2E tests only
test-e2e:
	npm run test:e2e

# Run all tests with build
test-all: build
	npm run test

# Run linting
lint:
	npm run lint

# Run type checking
typecheck:
	npm run typecheck

# Format code
format:
	npm run format

# Clean build artifacts
clean:
	rm -rf .output
	rm -rf .nuxt
	rm -rf node_modules/.cache
	rm -rf test-results
	rm -rf playwright-report

# Development workflow
dev-test-e2e: build
	@echo "Starting E2E test server..."
	npm run preview &
	@echo "Waiting for server to start..."
	sleep 5
	@echo "Running E2E tests..."
	npm run test:e2e
	@echo "Stopping test server..."
	pkill -f "nuxt preview" || true

# CI simulation
ci-simulate: clean install
	@echo "Simulating CI pipeline..."
	@echo "1. Typecheck..."
	npm run typecheck
	@echo "2. Lint..."
	npm run lint
	@echo "3. Build..."
	npm run build
	@echo "4. Unit tests..."
	npm run test:unit
	@echo "5. E2E tests..."
	npm run test:e2e
	@echo "CI simulation complete!"

# Docker development
docker-dev:
	docker-compose up -d
	@echo "Waiting for services to start..."
	sleep 10
	@echo "Services should be available at:"
	@echo "  - Application: http://localhost:3000"
	@echo "  - Database: localhost:5432"

docker-test:
	docker-compose exec skylite-app npm run test

docker-stop:
	docker-compose down
