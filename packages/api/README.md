# API Package

This package provides the backend API for the prompt2prod system.

## Test Endpoints

Test endpoints are available only when `ENABLE_TEST_ENDPOINTS=1`:

- `POST /__test/agents/:id/heartbeat` → upserts lastSeen for E2E testing

These endpoints are designed for end-to-end testing and should never be enabled in production environments.
