import { test, expect, request } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE ?? 'http://localhost:5173';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

test('approvals card shows task approvals for run', async ({ page }) => {
  const api = await request.newContext();

  // 1) Create a task with approval policy via API
  const taskCreate = await api.post(`${API_BASE}/tasks`, {
    headers: { 'content-type': 'application/json' },
    data: {
      title: 'Test Task with Approvals',
      goal: 'Test approval policy',
      targetRepo: 'https://github.com/test/repo',
      agents: ['demo-agent'],
      policy: {
        mode: 'allOf',
        rules: [{ provider: 'manual' }, { provider: 'checks' }],
      },
    },
  });
  expect(taskCreate.ok()).toBeTruthy();
  const task = await taskCreate.json();
  expect(task.runs).toHaveLength(1);
  const runId = task.runs[0].id;

  // 2) Open UI and import the run by ID
  await page.goto(WEB_BASE);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toContainText('prompt2prod');

  // Import the run by ID
  await page.fill('input[placeholder="Import run by ID..."]', runId);
  await page.click('button:has-text("Import")');

  // Wait for the run to be imported and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // 3) Wait for approvals card to load and verify it shows the correct data
  await expect(page.locator('h3:has-text("Approvals")')).toBeVisible({ timeout: 10000 });

  // Check that the approvals card is present
  const approvalsCard = page.locator('h3:has-text("Approvals")').locator('..');
  await expect(approvalsCard).toBeVisible();

  // Check that the aggregate badge is present (should be 'pending' for manual provider)
  await expect(approvalsCard.locator('text=pending')).toBeVisible();

  // Check that the rules are listed
  await expect(approvalsCard.locator('text=manual')).toBeVisible();
  await expect(approvalsCard.locator('text=checks')).toBeVisible();

  // Check that verdicts are shown (both pending and satisfied should be visible)
  await expect(approvalsCard.locator('text=satisfied')).toBeVisible();

  // Check that strict mode indicator is shown
  await expect(approvalsCard.locator('text=All rules must be satisfied')).toBeVisible();
});

test('approvals card shows error when run has no associated task', async ({ page }) => {
  const api = await request.newContext();

  // 1) Create a standalone run (not associated with any task)
  const runCreate = await api.post(`${API_BASE}/runs`, {
    headers: { 'content-type': 'application/json' },
    data: { agentId: 'demo-agent', repo: 'test/repo', base: 'main', prompt: 'test task' },
  });
  expect(runCreate.ok()).toBeTruthy();
  const { id: runId } = await runCreate.json();

  // 2) Open UI and import the run by ID
  await page.goto(WEB_BASE);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toContainText('prompt2prod');

  // Import the run by ID
  await page.fill('input[placeholder="Import run by ID..."]', runId);
  await page.click('button:has-text("Import")');

  // Wait for the run to be imported and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // 3) Wait for approvals card to load and verify it shows error
  await expect(page.locator('h3:has-text("Approvals")')).toBeVisible({ timeout: 10000 });

  // Check that the approvals card shows an error
  const approvalsCard = page.locator('h3:has-text("Approvals")').locator('..');
  await expect(approvalsCard).toBeVisible();
  await expect(approvalsCard.locator('text=Error:')).toBeVisible();
});

test('approvals card shows no policy message when task has no approval policy', async ({
  page,
}) => {
  const api = await request.newContext();

  // 1) Create a task without approval policy via API
  const taskCreate = await api.post(`${API_BASE}/tasks`, {
    headers: { 'content-type': 'application/json' },
    data: {
      title: 'Test Task without Approvals',
      goal: 'Test task without policy',
      targetRepo: 'https://github.com/test/repo',
      agents: ['demo-agent'],
      // No policy field
    },
  });
  expect(taskCreate.ok()).toBeTruthy();
  const task = await taskCreate.json();
  expect(task.runs).toHaveLength(1);
  const runId = task.runs[0].id;

  // 2) Open UI and import the run by ID
  await page.goto(WEB_BASE);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toContainText('prompt2prod');

  // Import the run by ID
  await page.fill('input[placeholder="Import run by ID..."]', runId);
  await page.click('button:has-text("Import")');

  // Wait for the run to be imported and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // 3) Wait for approvals card to load and verify it shows error about no policy
  await expect(page.locator('h3:has-text("Approvals")')).toBeVisible({ timeout: 10000 });

  // Check that the approvals card shows an error about no policy
  const approvalsCard = page.locator('h3:has-text("Approvals")').locator('..');
  await expect(approvalsCard).toBeVisible();
  await expect(approvalsCard.locator('text=Error:')).toBeVisible();
  await expect(approvalsCard.locator('text=no approval policy')).toBeVisible();
});
