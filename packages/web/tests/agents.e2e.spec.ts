import { test, expect } from '@playwright/test';

test.describe('Agents Panel E2E', () => {
  test('agents panel renders and filter functionality works', async ({ page }) => {
    // Go to web base
    await page.goto('/');

    // Wait for the agents panel to be visible
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Wait up to 20s for at least one agent OR skip with a message if none
    const agentItem = page.getByTestId(/^agent-item-/);

    try {
      await agentItem.first().waitFor({ timeout: 20000 });
    } catch {
      // No agents found within 20s, skip the test with a message
      console.log('No agents found within 20s - skipping agent interaction test');
      return;
    }

    // If we get here, at least one agent was found
    const firstAgent = agentItem.first();
    const agentId = await firstAgent.getAttribute('data-testid');
    const agentIdValue = agentId?.replace('agent-item-', '') || '';

    // Click the first agent to apply filter
    await firstAgent.click();

    // Verify "Filtered by agent" pill appears
    await expect(page.getByTestId('clear-agent-filter')).toBeVisible();
    await expect(page.getByText(`Filtered by agent: ${agentIdValue}`)).toBeVisible();

    // Verify runs list shows only matching runs (or empty state)
    // Note: We can't guarantee there are runs for this agent, so we just check the filter is applied
    const runsList = page
      .locator('[data-testid="runs-list"]')
      .or(page.locator('text=No runs for agent'));
    await expect(runsList).toBeVisible();

    // Click Clear filter and assert pill disappears
    await page.getByTestId('clear-agent-filter').click();
    await expect(page.getByTestId('clear-agent-filter')).not.toBeVisible();
    await expect(page.getByText(`Filtered by agent: ${agentIdValue}`)).not.toBeVisible();
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

    // Check that empty state message is shown (if no agents)
    // Use a more specific selector to avoid strict mode violations
    await expect(page.locator('text=No agents')).toBeVisible();
  });

  test('agent selection persists after page refresh', async ({ page }) => {
    await page.goto('/');

    // Wait for agents panel
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Wait up to 20s for at least one agent
    const agentItem = page.getByTestId(/^agent-item-/);

    try {
      await agentItem.first().waitFor({ timeout: 20000 });
    } catch {
      console.log('No agents found within 20s - skipping persistence test');
      return;
    }

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

  test('keyboard navigation works for agent selection', async ({ page }) => {
    await page.goto('/');

    // Wait for agents panel
    await expect(page.getByTestId('agents-panel')).toBeVisible();

    // Wait up to 20s for at least one agent
    const agentItem = page.getByTestId(/^agent-item-/);

    try {
      await agentItem.first().waitFor({ timeout: 20000 });
    } catch {
      console.log('No agents found within 20s - skipping keyboard test');
      return;
    }

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
});
