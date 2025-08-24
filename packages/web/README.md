# @prompt2prod/web

React-based web interface for monitoring and managing prompt2prod runs with live SSE logs and real-time agent monitoring.

## Development

```bash
# Start development server
VITE_API_BASE=http://localhost:3000 pnpm --filter @prompt2prod/web dev
```

The development server will be available at http://localhost:5173.

## Features

- **Runs List**: Import/create runs; view cached runs with import by ID functionality
- **Run Detail**: View run information and status with live SSE log streaming (Connect/Disconnect/Emit test)
- **Agents Panel**: Live polling (10s), status chips, last seen, filter runs by agent
- **Create Runs**: Form to create new runs with agent ID and JSON payload
- **Live Logs**: Real-time log streaming via Server-Sent Events (SSE)
- **Dev Tools**: "Emit test" button for development and testing

## Agents Panel

The Agents Panel provides real-time monitoring of agent status and activity:

### Features

- **Live Polling**: Automatically refreshes agent list every 10 seconds
- **Manual Refresh**: Click "Refresh" button for immediate update
- **Status Indicators**: Visual status chips (online/stale/offline) with tooltips
- **Last Seen**: Relative timestamps showing when each agent last heartbeated
- **Agent Filtering**: Click an agent to filter runs list by that agent
- **Clear Filter**: Remove agent filter to show all runs

### Agent Status

- **Online**: Agent heartbeated within last 15 seconds (green)
- **Stale**: Agent heartbeated 15-60 seconds ago (amber)
- **Offline**: Agent heartbeated more than 60 seconds ago or never seen (gray)

### Usage

1. **View Agents**: Agents panel shows in the sidebar above the runs list
2. **Filter Runs**: Click any agent to filter runs list to show only that agent's runs
3. **Clear Filter**: Click "Clear" button in the filter pill to remove the filter
4. **Monitor Status**: Watch status chips and last seen times for agent health

### Troubleshooting: No Agents?

If the agents panel shows "No agents — is any agent heartbeating?":

1. **Check Agent Process**: Ensure an agent is running and heartbeating
2. **API Connection**: Verify the API server is running and accessible
3. **Heartbeat Frequency**: Agents should heartbeat at least every 15 seconds to stay "online"
4. **Network Issues**: Check for network connectivity between agent and API server

Example agent heartbeat (using SDK):

```javascript
import { AgentClient, createMemoryTransport } from '@prompt2prod/sdk-agent-node';

const agent = new AgentClient({ agentId: 'my-agent-id', transport: createMemoryTransport() });
agent.heartbeat(); // Send heartbeat every 10-15 seconds
```

## Environment Variables

- `VITE_API_BASE`: API server URL (default: `http://localhost:3000`)
- `VITE_HIDE_DEV_TOOLS`: Hide development tools like "Emit test" button (default: `false`)

## Troubleshooting

### API Base Mismatch

If you see CORS errors or connection issues, ensure the API server is running and the `VITE_API_BASE` environment variable is set correctly:

```bash
# Set the correct API base URL
export VITE_API_BASE=http://localhost:3000

# Or create a .env file
echo "VITE_API_BASE=http://localhost:3000" > .env
```

### Logs Not Streaming

If logs are not streaming properly:

1. **Check API Server**: Ensure the API server is running at the correct URL
2. **CORS Issues**: Verify CORS is properly configured on the API server
3. **SSE Connection**: Check browser dev tools Network tab for SSE connection errors
4. **API Base**: Confirm `VITE_API_BASE` points to the correct API server

### SSE Disconnections

If you experience frequent SSE disconnections:

1. **Browser Network**: Check browser dev tools Network tab for connection errors
2. **API Server**: Ensure the API server is running and accessible
3. **CORS**: Verify CORS is properly configured on the API server
4. **Network**: Check for proxy/firewall issues that might interrupt long-lived connections

### Development Issues

- **Vite Cache**: Clear Vite cache if you see build issues: `rm -rf node_modules/.vite`
- **Port Conflicts**: Ensure ports 5173 (web) and 3000 (API) are available
- **Dependencies**: Run `pnpm install` if you see module resolution errors

### Windows Tips

On Windows, you may need to use PowerShell or WSL for some commands:

```powershell
# PowerShell alternative to curl -N
Invoke-WebRequest -Uri "http://localhost:3000/runs/<id>/logs/stream" -UseBasicParsing

# PowerShell JSON quoting (use single quotes for outer, double for inner)
curl -X POST http://localhost:3000/runs -H 'content-type: application/json' -d '{"agentId":"test","repo":"org/repo","base":"main","prompt":"hello"}'
```

For the best experience, consider using WSL (Windows Subsystem for Linux) for development.

## Build & Test

```bash
# Build for production
pnpm build

# Preview built app
pnpm preview

# Run E2E tests
pnpm test:e2e
```

## E2E Testing

The web interface includes comprehensive end-to-end tests using Playwright:

- **Headless Testing**: Automated tests run in CI to verify functionality
- **Agent Monitoring**: Tests verify agents panel shows online→stale transitions
- **Run Management**: Tests create→connect→emit workflow
- **Live Logs**: Verifies SSE log streaming functionality

Run E2E tests locally:

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
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
- `AgentsPanel.tsx`: Agent monitoring with status chips and heartbeat polling
- `RunList.tsx`: Sidebar with runs list and import functionality
- `RunLogs.tsx`: SSE log streaming with connect/disconnect controls
- `RunCreateForm.tsx`: Form for creating new runs
- `StatusChip.tsx`: Status indicator component for runs and agents

## API Integration

The web app integrates with the prompt2prod API:

- `GET /agents`: List all agents with status and heartbeat info
- `POST /runs`: Create new runs
- `GET /runs/:id`: Get run details
- `GET /runs/:id/logs/stream`: SSE endpoint for live logs
- `POST /runs/:id/logs/test`: Emit test log (dev tool)

## Local Storage

The app uses localStorage to persist:

- Cached runs (up to 100 most recent)
- Selected run ID
- User preferences
