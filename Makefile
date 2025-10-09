.PHONY: db-up db-down db-migrate db-reset-test db-psql db-status

# Database management
db-up:
	@echo "Starting development PostgreSQL..."
	docker compose -f docker-compose.dev.yml up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@timeout 30 bash -c 'until docker compose -f docker-compose.dev.yml exec postgres pg_isready -U postgres; do sleep 1; done'
	@echo "PostgreSQL is ready!"

db-down:
	@echo "Stopping development PostgreSQL..."
	docker compose -f docker-compose.dev.yml down -v

db-migrate:
	@echo "Running database migrations..."
	npx prisma migrate deploy

db-reset-test:
	@echo "Resetting test database..."
	docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS skylite_test;"
	docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -c "CREATE DATABASE skylite_test;"
	@echo "Test database reset complete"

db-psql:
	@echo "Connecting to PostgreSQL..."
	docker compose -f docker-compose.dev.yml exec postgres psql -U postgres

db-status:
	@echo "Checking database status..."
	docker compose -f docker-compose.dev.yml exec postgres pg_isready -U postgres

# Development workflow
dev-setup: db-up db-migrate
	@echo "Development environment ready!"

test-setup: db-up db-reset-test db-migrate
	@echo "Test environment ready!"

# Quick smoke test
smoke: dev-setup
	@echo "Running smoke test..."
	npm run smoke