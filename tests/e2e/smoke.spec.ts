import { test, expect } from '@playwright/test';

/**
 * Critical-path smoke journeys. These don't assert on live data (the test env may have
 * none) — they assert the app renders, navigates, and degrades gracefully.
 */

test('landing page renders the hero and CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /view trending/i })).toBeVisible();
});

test('navigates from landing to trending', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /view trending/i }).click();
  await expect(page).toHaveURL(/\/trending/);
  await expect(page.getByRole('heading', { name: /trending/i })).toBeVisible();
});

test('radar shows search controls', async ({ page }) => {
  await page.goto('/radar');
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.getByLabel(/language filter/i)).toBeVisible();
});

test('feed prompts unauthenticated users to sign in', async ({ page }) => {
  await page.goto('/feed');
  await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible();
});

test('unknown route renders 404', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('404')).toBeVisible();
});

test('security headers are present', async ({ page }) => {
  const res = await page.goto('/');
  const headers = res?.headers() ?? {};
  expect(headers['content-security-policy']).toBeTruthy();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
});
