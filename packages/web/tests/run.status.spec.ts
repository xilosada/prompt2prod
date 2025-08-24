import { test, expect, request } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE ?? 'http://localhost:5173';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

test('run status UI updates from queued → running → done', async ({ page }) => {
  const api = await request.newContext();

  // 1) Create run via API
  const create = await api.post(`${API_BASE}/runs`, {
    headers: { 'content-type': 'application/json' },
    data: { agentId: 'qa-agent', repo: 'test/repo', base: 'main', prompt: 'test task' },
  });
  expect(create.ok()).toBeTruthy();
  const { id } = await create.json();

  // 2) Open UI and import the run by ID
  await page.goto(WEB_BASE);

  // Wait for the app to load - try a more robust approach
  await page.waitForLoadState('networkidle');

  // Try to find any element that indicates the app loaded
  await expect(page.locator('body')).toContainText('prompt2prod');

  // Import the run by ID
  await page.fill('input[placeholder="Import run by ID..."]', id);
  await page.click('button:has-text("Import")');

  // Wait for the run to be imported and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // queued expected initially
  await expect(page.getByTestId('run-status-chip')).toHaveText(/queued/i, { timeout: 10_000 });

  // 3) Set running via test-only route, then refresh status
  let res = await api.post(`${API_BASE}/__test/runs/${id}/status/running`);
  expect(res.ok()).toBeTruthy();
  await page.getByTestId('refresh-status').click();
  await expect(page.getByTestId('run-status-chip')).toHaveText(/running/i, { timeout: 10_000 });

  // 4) Set done, refresh & assert
  res = await api.post(`${API_BASE}/__test/runs/${id}/status/done`);
  expect(res.ok()).toBeTruthy();
  await page.getByTestId('refresh-status').click();
  await expect(page.getByTestId('run-status-chip')).toHaveText(/done/i, { timeout: 10_000 });
});
