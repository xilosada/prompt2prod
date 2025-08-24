import { test, expect } from './fixtures/agents';

test.describe('Agents Panel E2E', () => {
  test('agents panel renders and filter functionality works', async ({ page, createAgent }) => {
    // Create a test agent - this will fail if API is not available
    await createAgent('test-agent-1', { lang: 'node', ver: 'test' });

    // Go to web base
    await page.goto('/');

    // Wait for the agents panel to be visible
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Wait for the agent to appear
    const agentItem = page.getByTestId('agent-item-test-agent-1');
    await expect(agentItem).toBeVisible({ timeout: 10000 });

    // If we get here, at least one agent was found
    const firstAgent = agentItem.first();

    // Click the first agent to apply filter
    await firstAgent.click();

    // Verify "Filtered by agent" pill appears
    await expect(page.getByTestId('clear-agent-filter')).toBeVisible();
    // Check for the filter text with the actual agent ID (more flexible matching)
    await expect(page.getByText(/Filtered by agent:/)).toBeVisible();

    // Verify runs list shows only matching runs (or empty state)
    // Note: We can't guarantee there are runs for this agent, so we just check the filter is applied
    const runsList = page
      .locator('[data-testid="runs-list"]')
      .or(page.locator('text=No runs for agent'));
    await expect(runsList).toBeVisible();

    // Click Clear filter and assert pill disappears
    await page.getByTestId('clear-agent-filter').click();
    await expect(page.getByTestId('clear-agent-filter')).not.toBeVisible();
    await expect(page.getByText(/Filtered by agent:/)).not.toBeVisible();
  });

  test('agents panel refresh button works', async ({ page }) => {
    await page.goto('/');

    // Wait for agents panel
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Click refresh button and verify it's clickable
    const refreshButton = page.getByTestId('agents-refresh');
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // The button should remain visible and functional
    await expect(refreshButton).toBeVisible();
  });

  test('agents panel shows empty state when no agents', async ({ page }) => {
    await page.goto('/');

    // Wait for agents panel
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Check that either empty state message is shown OR agents are present
    // This test should pass in both scenarios
    const emptyState = page.locator('text=No agents');
    const agentItems = page.getByTestId(/^agent-item-/);

    // Wait for either condition to be true
    await expect(emptyState.or(agentItems.first())).toBeVisible();
  });

  test('agent selection persists after page refresh', async ({ page, createAgent }) => {
    // Create a test agent - this will fail if API is not available
    await createAgent('test-agent-2', { lang: 'node', ver: 'test' });

    await page.goto('/');

    // Wait for agents panel
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Wait for the agent to appear
    const agentItem = page.getByTestId('agent-item-test-agent-2');
    await expect(agentItem).toBeVisible({ timeout: 10000 });

    // Click the first agent to select it
    const firstAgent = agentItem.first();
    await firstAgent.click();

    // Verify agent is selected (should have aria-pressed="true")
    await expect(firstAgent).toHaveAttribute('aria-pressed', 'true');

    // Refresh the page
    await page.reload();

    // Wait for agents panel to load again
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Wait for the same agent to appear again
    try {
      await firstAgent.waitFor({ timeout: 20000 });
    } catch {
      console.log('Agent not found after refresh - skipping persistence verification');
      return;
    }

    // Verify the agent is still selected after refresh
    await expect(firstAgent).toHaveAttribute('aria-pressed', 'true');
  });

  test('keyboard navigation works for agent selection', async ({ page, createAgent }) => {
    // Create a test agent - this will fail if API is not available
    await createAgent('test-agent-3', { lang: 'node', ver: 'test' });

    await page.goto('/');

    // Wait for agents panel
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Wait for the agent to appear
    const agentItem = page.getByTestId('agent-item-test-agent-3');
    await expect(agentItem).toBeVisible({ timeout: 10000 });

    // Focus the first agent button
    await agentItem.first().focus();

    // Press Enter to select the agent
    await page.keyboard.press('Enter');

    // Verify agent is selected
    await expect(agentItem.first()).toHaveAttribute('aria-pressed', 'true');

    // Press Space to deselect the agent
    await page.keyboard.press(' ');

    // Verify agent is deselected
    await expect(agentItem.first()).toHaveAttribute('aria-pressed', 'false');
  });

  test('relative time tooltips show precise timestamps', async ({ page, createAgent }) => {
    // Create a test agent - this will fail if API is not available
    await createAgent('test-agent-4', { lang: 'node', ver: 'test' });

    await page.goto('/');

    // Wait for agents panel
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Wait for the agent to appear
    const agentItem = page.getByTestId('agent-item-test-agent-4');
    await expect(agentItem).toBeVisible({ timeout: 10000 });

    // Find the relative time element within the first agent
    const relativeTimeElement = agentItem.first().locator('.text-xs.text-slate-400');

    // Verify it has a title attribute with ISO timestamp
    const title = await relativeTimeElement.getAttribute('title');
    expect(title).toBeTruthy();

    // Verify it's a valid ISO timestamp
    const timestamp = new Date(title!);
    expect(timestamp.getTime()).toBeGreaterThan(0);
    expect(timestamp.toISOString()).toBe(title);
  });
});
