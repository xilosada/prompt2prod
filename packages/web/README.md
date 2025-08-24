# @prompt2prod/web

React-based web interface for monitoring and managing prompt2prod runs with live SSE logs.

## Features

- **Runs List**: View and manage cached runs with import by ID functionality
- **Run Detail**: View run information and status with live SSE log streaming
- **Create Runs**: Form to create new runs with agent ID and JSON payload
- **Live Logs**: Real-time log streaming via Server-Sent Events (SSE)
- **Dev Tools**: "Emit test" button for development and testing

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The development server will be available at http://localhost:5173.

## Environment Variables

- `VITE_API_BASE`: API server URL (default: `http://localhost:3000`)

## Build

```bash
# Build for production
pnpm build

# Preview built app
pnpm preview
```

## Testing

```bash
# Run end-to-end tests
pnpm test:e2e
```

## Architecture

- **React 18**: Modern React with hooks and functional components
- **Vite**: Fast build tool and development server
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Playwright**: End-to-end testing

## Components

- `App.tsx`: Main application shell with two-pane layout
- `RunList.tsx`: Sidebar with runs list and import functionality
- `RunLogs.tsx`: SSE log streaming with connect/disconnect controls
- `RunCreateForm.tsx`: Form for creating new runs
- `StatusChip.tsx`: Status indicator component

## API Integration

The web app integrates with the prompt2prod API:

- `POST /runs`: Create new runs
- `GET /runs/:id`: Get run details
- `GET /runs/:id/logs/stream`: SSE endpoint for live logs
- `POST /runs/:id/logs/test`: Emit test log (dev tool)

## Local Storage

The app uses localStorage to persist:

- Cached runs (up to 100 most recent)
- Selected run ID
- User preferences
