import { test, expect } from '@playwright/test';
test('anonymous visitor reaches accessible login screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
test('authenticated task creation, editing, workflow, effort and deletion', async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    'Supply a dedicated invited test account on a disposable installation.',
  );
  const title = `Browser task ${Date.now()}`;
  await page.goto('/login');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Main board.' })).toBeVisible();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByLabel('Task title').fill(title);
  await page.getByLabel('Description').fill('Test the complete flow');
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .click();
  await page.getByLabel('Workflow state').selectOption('in_progress');
  await expect(page.getByLabel('Workflow state')).toHaveValue('in_progress');
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  await page.getByLabel('Task title').fill(title + ' updated');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: /^Effort ·/ }).click();
  await page.getByLabel('Hours spent').fill('1.25');
  await page.getByLabel('What did you work on?').fill('Browser verification');
  await page.getByRole('button', { name: 'Log effort', exact: true }).click();
  await expect(page.getByText('Browser verification', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await page.getByLabel('Workflow state').selectOption('done');
  await expect(page.getByLabel('Workflow state')).toHaveValue('done');
  await page.getByRole('button', { name: 'Delete task', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: title + ' updated', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
