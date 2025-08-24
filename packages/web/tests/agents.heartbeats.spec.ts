import { test, expect, request } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE ?? 'http://localhost:5173';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';
const AGENT_ID = 'qa-agent';

test('agents panel reflects online → stale transition', async ({ page }) => {
  // 1) seed one heartbeat via test-only endpoint
  const api = await request.newContext();
  const res = await api.post(`${API_BASE}/__test/agents/${AGENT_ID}/heartbeat`, {
    headers: { 'content-type': 'application/json' },
    data: { caps: { lang: 'node', ver: 'test' } },
  });
  expect(res.ok()).toBeTruthy();

  // 2) open UI, force refresh, expect ONLINE
  await page.goto(WEB_BASE);

  // Wait for the agents panel to be visible first
  await page.getByTestId('agents-panel').waitFor({ timeout: 10000 });

  // Click refresh and wait for it to complete
  await page.getByTestId('agents-refresh').click();

  // Wait until the agent item appears and shows online
  await page.getByTestId(`agent-item-${AGENT_ID}`).waitFor({ timeout: 20000 });

  // Add a small delay to ensure the status is updated
  await page.waitForTimeout(1000);

  await expect(page.getByTestId(`agent-status-${AGENT_ID}`)).toHaveText(/online/i);

  // 3) wait > ONLINE threshold (backend uses online ≤ 15s)
  await page.waitForTimeout(17000);

  // 4) refresh and expect STALE
  await page.getByTestId('agents-refresh').click();
  await expect(page.getByTestId(`agent-status-${AGENT_ID}`)).toHaveText(/stale/i, {
    timeout: 15000,
  });
});
