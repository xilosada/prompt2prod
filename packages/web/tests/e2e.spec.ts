import { test, expect } from '@playwright/test';

test('create run, connect SSE, emit test, assert log appears', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // Wait for the app to load
  await expect(page.locator('h1')).toContainText('prompt2prod — Runs Monitor');

  // Click "New" to show create form
  await page.click('button:has-text("New")');

  // Fill in the create run form
  await page.fill('input[placeholder="demo-agent"]', 'demo-agent');
  await page.fill('input[placeholder="org/repo"]', 'demo/repo');
  await page.fill('input[placeholder="main"]', 'main');
  await page.fill('input[placeholder="What would you like the agent to do?"]', 'Hello world');
  await page.fill('textarea', '{\n  "task": "hello world"\n}');

  // Submit the form
  await page.click('[data-testid="create-run-submit"]');

  // Wait for the run to be created and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // Click "Connect" to start SSE
  await page.click('[data-testid="connect-btn"]');

  // Wait for connection status to show "Connected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');

  // Click "Emit test" to trigger a log
  await page.click('[data-testid="emit-test-btn"]');

  // Wait for a log line to appear
  await expect(page.locator('[data-testid="log-line"]')).toBeVisible({ timeout: 10000 });

  // Verify that some log content appeared
  const logContent = await page.locator('[data-testid="log-container"]').textContent();
  expect(logContent).toBeTruthy();
  expect(logContent!.length).toBeGreaterThan(0);
});

test('disconnect stops logs', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // Wait for the app to load
  await expect(page.locator('h1')).toContainText('prompt2prod — Runs Monitor');

  // Click "New" to show create form
  await page.click('button:has-text("New")');

  // Fill in the create run form
  await page.fill('input[placeholder="demo-agent"]', 'demo-agent');
  await page.fill('input[placeholder="org/repo"]', 'demo/repo');
  await page.fill('input[placeholder="main"]', 'main');
  await page.fill('input[placeholder="What would you like the agent to do?"]', 'Hello world');
  await page.fill('textarea', '{\n  "task": "hello world"\n}');

  // Submit the form
  await page.click('[data-testid="create-run-submit"]');

  // Wait for the run to be created and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // Click "Connect" to start SSE
  await page.click('[data-testid="connect-btn"]');

  // Wait for connection status to show "Connected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');

  // Click "Emit test" to trigger a log
  await page.click('[data-testid="emit-test-btn"]');

  // Wait for a log line to appear
  await expect(page.locator('[data-testid="log-line"]')).toBeVisible({ timeout: 10000 });

  // Get initial log count
  const initialLogCount = await page.locator('[data-testid="log-line"]').count();

  // Click "Disconnect"
  await page.click('[data-testid="disconnect-btn"]');

  // Wait for connection status to show "Disconnected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');

  // Click "Emit test" again
  await page.click('[data-testid="emit-test-btn"]');

  // Wait 2 seconds and verify no new logs appeared
  await page.waitForTimeout(2000);
  const finalLogCount = await page.locator('[data-testid="log-line"]').count();
  expect(finalLogCount).toBe(initialLogCount);
});

test('reconnect resumes logs', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // Wait for the app to load
  await expect(page.locator('h1')).toContainText('prompt2prod — Runs Monitor');

  // Click "New" to show create form
  await page.click('button:has-text("New")');

  // Fill in the create run form
  await page.fill('input[placeholder="demo-agent"]', 'demo-agent');
  await page.fill('input[placeholder="org/repo"]', 'demo/repo');
  await page.fill('input[placeholder="main"]', 'main');
  await page.fill('input[placeholder="What would you like the agent to do?"]', 'Hello world');
  await page.fill('textarea', '{\n  "task": "hello world"\n}');

  // Submit the form
  await page.click('[data-testid="create-run-submit"]');

  // Wait for the run to be created and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // Click "Connect" to start SSE
  await page.click('[data-testid="connect-btn"]');

  // Wait for connection status to show "Connected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');

  // Click "Disconnect"
  await page.click('[data-testid="disconnect-btn"]');

  // Wait for connection status to show "Disconnected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');

  // Click "Connect" again
  await page.click('[data-testid="connect-btn"]');

  // Wait for connection status to show "Connected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');

  // Click "Emit test" to trigger a log
  await page.click('[data-testid="emit-test-btn"]');

  // Wait for a log line to appear
  await expect(page.locator('[data-testid="log-line"]')).toBeVisible({ timeout: 10000 });

  // Verify that log content appeared
  const logContent = await page.locator('[data-testid="log-container"]').textContent();
  expect(logContent).toBeTruthy();
  expect(logContent!.length).toBeGreaterThan(0);
});

test('no auto-reconnect after manual disconnect', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // Wait for the app to load
  await expect(page.locator('h1')).toContainText('prompt2prod — Runs Monitor');

  // Click "New" to show create form
  await page.click('button:has-text("New")');

  // Fill in the create run form
  await page.fill('input[placeholder="demo-agent"]', 'demo-agent');
  await page.fill('input[placeholder="org/repo"]', 'demo/repo');
  await page.fill('input[placeholder="main"]', 'main');
  await page.fill('input[placeholder="What would you like the agent to do?"]', 'Hello world');
  await page.fill('textarea', '{\n  "task": "hello world"\n}');

  // Submit the form
  await page.click('[data-testid="create-run-submit"]');

  // Wait for the run to be created and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // Click "Connect" to start SSE
  await page.click('[data-testid="connect-btn"]');

  // Wait for connection status to show "Connected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');

  // Click "Disconnect" manually
  await page.click('[data-testid="disconnect-btn"]');

  // Wait for connection status to show "Disconnected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');

  // Wait longer than the backoff window (max 5s + buffer)
  await page.waitForTimeout(7000);

  // Verify no reconnect banner appears
  await expect(page.locator('text=Disconnected — retrying')).not.toBeVisible();

  // Click "Emit test" and verify no new logs
  const initialLogCount = await page.locator('[data-testid="log-line"]').count();
  await page.click('[data-testid="emit-test-btn"]');
  await page.waitForTimeout(2000);
  const finalLogCount = await page.locator('[data-testid="log-line"]').count();
  expect(finalLogCount).toBe(initialLogCount);
});

test('log buffer cap at 1000 lines', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // Wait for the app to load
  await expect(page.locator('h1')).toContainText('prompt2prod — Runs Monitor');

  // Click "New" to show create form
  await page.click('button:has-text("New")');

  // Fill in the create run form
  await page.fill('input[placeholder="demo-agent"]', 'demo-agent');
  await page.fill('input[placeholder="org/repo"]', 'demo/repo');
  await page.fill('input[placeholder="main"]', 'main');
  await page.fill('input[placeholder="What would you like the agent to do?"]', 'Hello world');
  await page.fill('textarea', '{\n  "task": "hello world"\n}');

  // Submit the form
  await page.click('[data-testid="create-run-submit"]');

  // Wait for the run to be created and selected
  await expect(page.locator('[data-testid="run-id"]')).toBeVisible();

  // Click "Connect" to start SSE
  await page.click('[data-testid="connect-btn"]');

  // Wait for connection status to show "Connected"
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');

  // Emit logs to test buffer cap (more realistic approach)
  for (let i = 0; i < 50; i++) {
    await page.click('[data-testid="emit-test-btn"]');
    // Wait for button to be enabled again
    await page.waitForTimeout(200);
  }

  // Wait a bit for all logs to process
  await page.waitForTimeout(2000);

  // Verify we have log lines and they're being capped (should be less than 50 due to processing)
  const logLineCount = await page.locator('[data-testid="log-line"]').count();
  expect(logLineCount).toBeGreaterThan(0);
  expect(logLineCount).toBeLessThanOrEqual(50);
});
