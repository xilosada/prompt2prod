import { test, expect, request } from '@playwright/test';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

test('test-only run status endpoints work correctly', async () => {
  const api = await request.newContext();

  // 1) Create run via API
  const create = await api.post(`${API_BASE}/runs`, {
    headers: { 'content-type': 'application/json' },
    data: { agentId: 'qa-agent', repo: 'test/repo', base: 'main', prompt: 'test task' },
  });
  expect(create.ok()).toBeTruthy();
  const { id } = await create.json();

  // 2) Get initial run status
  const getInitial = await api.get(`${API_BASE}/runs/${id}`);
  expect(getInitial.ok()).toBeTruthy();
  const initialRun = await getInitial.json();
  expect(initialRun.status).toBe('dispatched'); // Should be dispatched initially

  // 3) Set status to running via test-only route
  const setRunning = await api.post(`${API_BASE}/__test/runs/${id}/status/running`);
  expect(setRunning.ok()).toBeTruthy();

  // 4) Verify status changed to running
  const getRunning = await api.get(`${API_BASE}/runs/${id}`);
  expect(getRunning.ok()).toBeTruthy();
  const runningRun = await getRunning.json();
  expect(runningRun.status).toBe('running');

  // 5) Set status to done via test-only route
  const setDone = await api.post(`${API_BASE}/__test/runs/${id}/status/done`);
  expect(setDone.ok()).toBeTruthy();

  // 6) Verify status changed to done
  const getDone = await api.get(`${API_BASE}/runs/${id}`);
  expect(getDone.ok()).toBeTruthy();
  const doneRun = await getDone.json();
  expect(doneRun.status).toBe('done');
});
