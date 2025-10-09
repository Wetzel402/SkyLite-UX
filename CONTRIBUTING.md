# Contributing to SkyLite-UX

Thank you for your interest in contributing to SkyLite-UX! This document provides guidelines for contributing to the project.

## Development Setup

1. **Fork and clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env` and configure
4. **Start database**: `npm run db:up`
5. **Run migrations**: `npm run db:migrate`
6. **Start development server**: `npm run dev`

## Testing

### Unit Tests
```bash
npm run test:unit
```

### E2E Tests
```bash
npm run test:e2e
```

### Smoke Tests
```bash
# Test events API endpoint
npm run smoke:events

# Test sync functionality
npm run smoke
```

### Contract Testing
The `/api/events/week` endpoint has specific contract requirements:
- **Response Format**: Always returns an array (never wrapped in object)
- **Authentication**: Requires valid display token in kiosk mode
- **Cache Headers**: Must include `Cache-Control: public, max-age=15`
- **Error Handling**: Returns empty array on errors (never 500)
- **Overlap Predicate**: Events overlap if `start <= to AND end >= from`
- **Status Filtering**: Excludes events with `status = 'cancelled'`

## Code Style

- **TypeScript**: Use strict typing, avoid `any`
- **Vue.js**: Use Composition API with `<script setup>`
- **Styling**: Tailwind CSS utility-first approach
- **Commits**: Follow Conventional Commits specification

## Pull Request Process

1. **Create feature branch**: `git checkout -b feat/your-feature`
2. **Write tests**: Add unit, integration, and E2E tests
3. **Update documentation**: Update README, API docs as needed
4. **Run tests**: Ensure all tests pass
5. **Create PR**: Use the PR template and fill out all sections

## Database Migrations

- **Never use `prisma migrate reset`** in production
- **Use SQL migrations** for indexes and schema changes
- **Test migrations** on copy of production data
- **Use `CONCURRENTLY`** for index creation to avoid blocking

## Security Guidelines

- **No secret logging**: Never log passwords, tokens, or sensitive data
- **Kiosk authentication**: All kiosk endpoints require display token
- **Input validation**: Validate all user inputs
- **Rate limiting**: Implement appropriate rate limits for API endpoints

## Feature Flags

- **Default to disabled**: New features should be opt-in
- **Environment variables**: Use clear, documented env var names
- **Backward compatibility**: Don't break existing setups
- **Documentation**: Document all feature flags and their effects

## API Design

- **Consistent responses**: Use consistent response formats
- **Error handling**: Graceful degradation, never expose internals
- **Caching**: Appropriate cache headers for performance
- **Authentication**: Clear auth requirements in documentation

## Questions?

- **Discord**: Join our Discord server
- **Issues**: Create an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
