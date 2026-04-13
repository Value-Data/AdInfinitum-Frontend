# Run AdInfinitum Frontend

## Prerequisites

- Node.js 18+

## Setup

```bash
# Install dependencies
npm install
```

## Run

```bash
# Development (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment

The API base URL is configured in `src/services/api.ts`. For local development the backend should be running on http://localhost:8000.

## Tests

```bash
# Watch mode
npm test

# Single run
npm run test:run
```
