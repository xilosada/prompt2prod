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
  await page.click('button:has-text("Create Run")');

  // Wait for the run to be created and selected
  await expect(page.locator('.font-mono')).toBeVisible();

  // Click "Connect" to start SSE
  await page.click('button:has-text("Connect")');

  // Wait for connection status to show "Connected"
  await expect(page.locator('text=Connected')).toBeVisible();

  // Click "Emit test" to trigger a log
  await page.click('button:has-text("Emit test")');

  // Wait for a log line to appear (should contain "hello" or any output)
  await expect(page.locator('pre span')).toBeVisible({ timeout: 10000 });

  // Verify that some log content appeared
  const logContent = await page.locator('pre').textContent();
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
  await page.click('button:has-text("Create Run")');

  // Wait for the run to be created and selected
  await expect(page.locator('.font-mono')).toBeVisible();

  // Click "Connect" to start SSE
  await page.click('button:has-text("Connect")');

  // Wait for connection status to show "Connected"
  await expect(page.locator('text=Connected')).toBeVisible();

  // Click "Emit test" to trigger a log
  await page.click('button:has-text("Emit test")');

  // Wait for a log line to appear
  await expect(page.locator('pre span')).toBeVisible({ timeout: 10000 });

  // Get initial log count
  const initialLogCount = await page.locator('pre span').count();

  // Click "Disconnect"
  await page.click('button:has-text("Disconnect")');

  // Wait for connection status to show "Disconnected"
  await expect(page.locator('text=Disconnected')).toBeVisible();

  // Click "Emit test" again
  await page.click('button:has-text("Emit test")');

  // Wait 2 seconds and verify no new logs appeared
  await page.waitForTimeout(2000);
  const finalLogCount = await page.locator('pre span').count();
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
  await page.click('button:has-text("Create Run")');

  // Wait for the run to be created and selected
  await expect(page.locator('.font-mono')).toBeVisible();

  // Click "Connect" to start SSE
  await page.click('button:has-text("Connect")');

  // Wait for connection status to show "Connected"
  await expect(page.locator('text=Connected')).toBeVisible();

  // Click "Disconnect"
  await page.click('button:has-text("Disconnect")');

  // Wait for connection status to show "Disconnected"
  await expect(page.locator('text=Disconnected')).toBeVisible();

  // Click "Connect" again
  await page.click('button:has-text("Connect")');

  // Wait for connection status to show "Connected"
  await expect(page.locator('text=Connected')).toBeVisible();

  // Click "Emit test" to trigger a log
  await page.click('button:has-text("Emit test")');

  // Wait for a log line to appear
  await expect(page.locator('pre span')).toBeVisible({ timeout: 10000 });

  // Verify that log content appeared
  const logContent = await page.locator('pre').textContent();
  expect(logContent).toBeTruthy();
  expect(logContent!.length).toBeGreaterThan(0);
});
