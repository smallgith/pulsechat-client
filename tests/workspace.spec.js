import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { loginGoogle as login } from './support/google-login';

const chat = (page, name) =>
  page
    .locator('aside')
    .getByRole('button')
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
const attach = async (page, label) => {
  await page.getByRole('button', { name: 'Attach', exact: true }).click();
  await page
    .getByRole('menu', { name: 'Attachments' })
    .getByRole('menuitem', { name: label, exact: true })
    .click();
};
const card = (page, title) =>
  page
    .locator('.work-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test('workspace cards, drag/drop, resumable uploads, invites, themes and PIN lock are usable', async ({
  browser,
}) => {
  test.setTimeout(150000);
  const contextA = await browser.newContext({
    permissions: ['microphone', 'camera'],
    viewport: { width: 1440, height: 960 },
  });
  const contextB = await browser.newContext({
    permissions: ['microphone', 'camera'],
    viewport: { width: 1360, height: 900 },
  });
  const a = await contextA.newPage(),
    b = await contextB.newPage(),
    errors = [];
  a.on('pageerror', (e) => errors.push(e.message));
  b.on('pageerror', (e) => errors.push(e.message));
  const suffix = String(Date.now()).slice(-7),
    phoneA = `833${suffix}`,
    phoneB = `844${suffix}`;
  await login(a, phoneA, 'Nova Alice');
  await login(b, phoneB, 'Nova Bob');
  await chat(a, 'Nova Bob');
  await chat(b, 'Nova Alice');
  await attach(a, 'Poll');
  await a.getByLabel('Question', { exact: true }).fill('Where should we meet?');
  await a.getByLabel('Option 1', { exact: true }).fill('Studio');
  await a.getByLabel('Option 2', { exact: true }).fill('Online');
  await a.getByRole('button', { name: 'Create poll', exact: true }).click();
  await card(b, 'Where should we meet?')
    .getByRole('button', { name: /Studio/ })
    .click();
  await expect(
    card(a, 'Where should we meet?').getByText('1 voters', { exact: true })
  ).toBeVisible();
  await attach(a, 'Shared task');
  await a.getByLabel('Title', { exact: true }).fill('Review the design');
  await a.getByLabel('Assign to', { exact: true }).selectOption(`google:${phoneB}`);
  await a.getByLabel('Priority', { exact: true }).selectOption('high');
  await a.getByRole('button', { name: 'Create task', exact: true }).click();
  await card(b, 'Review the design')
    .getByLabel('Task status: Review the design')
    .selectOption('doing');
  await expect(
    card(a, 'Review the design').getByLabel('Task status: Review the design')
  ).toHaveValue('doing');
  await attach(a, 'Decision');
  await a.getByLabel('Title', { exact: true }).fill('We are shipping on Friday');
  await a.getByLabel('Why this decision?', { exact: true }).fill('The design review is ready.');
  await a.getByRole('button', { name: 'Record decision', exact: true }).click();
  await card(b, 'We are shipping on Friday')
    .getByRole('button', { name: /Acknowledged/ })
    .click();
  await expect(
    card(a, 'We are shipping on Friday').getByRole('button', { name: /Acknowledged · 2/ })
  ).toBeVisible();
  await attach(a, 'Event');
  await a.getByLabel('Title', { exact: true }).fill('Design review meeting');
  const future = new Date(Date.now() + 86400000);
  const localTime = new Date(future.getTime() - future.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await a.getByLabel('Date & time · your local time').fill(localTime);
  await a.getByLabel('Location or meeting link').fill('Studio room 2');
  await a.getByRole('button', { name: 'Create event', exact: true }).click();
  await card(b, 'Design review meeting').getByRole('button', { name: /Going/ }).click();
  const calendar = b.waitForEvent('download');
  await card(b, 'Design review meeting').getByRole('button', { name: 'Add to calendar' }).click();
  expect((await calendar).suggestedFilename()).toMatch(/\.ics$/);
  await attach(a, 'Contact');
  await a.getByLabel('Contact name', { exact: true }).fill('Nova Bob');
  await a.getByLabel('Phone number', { exact: true }).fill(phoneB);
  await a.getByRole('button', { name: 'Share in chat', exact: true }).click();
  await expect(
    b
      .locator('.work-card')
      .filter({ hasText: 'CONTACT' })
      .getByRole('heading', { name: 'Nova Bob' })
  ).toBeVisible();
  await attach(a, 'New sticker');
  await a.getByRole('button', { name: '🚀', exact: true }).click();
  await a.getByLabel('Your caption').fill('Ready to launch');
  await a.getByRole('button', { name: 'Share in chat', exact: true }).click();
  await expect(b.locator('.custom-sticker').getByText('Ready to launch')).toBeVisible();

  let release;
  const hold = new Promise((r) => {
    release = r;
  });
  let firstPatch;
  const firstRequest = new Promise((r) => {
    firstPatch = r;
  });
  let intercepted = false;
  await a.route('**/api/uploads/**', async (route) => {
    if (!intercepted && route.request().method() === 'PATCH') {
      intercepted = true;
      firstPatch();
      await hold;
    }
    await route.continue().catch(() => {});
  });
  await a.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(7 * 1024 * 1024).fill(9)], 'big-board.bin', {
        type: 'application/octet-stream',
      })
    );
    transfer.items.add(new File(['Project notes'], 'drop-notes.txt', { type: 'text/plain' }));
    const panel = document.querySelector('.chat-panel');
    panel.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
    panel.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await expect(a.getByRole('button', { name: 'Remove big-board.bin' })).toBeVisible();
  await expect(a.getByRole('button', { name: 'Remove drop-notes.txt' })).toBeVisible();
  await a.getByRole('button', { name: 'Send', exact: true }).click();
  await firstRequest;
  await a.getByRole('button', { name: 'Pause big-board.bin' }).click();
  await expect(a.getByRole('button', { name: 'Resume big-board.bin' })).toBeVisible();
  release();
  await a.getByRole('button', { name: 'Resume big-board.bin' }).click();
  await expect(b.getByRole('button', { name: /big-board.bin/ }).first()).toBeVisible();
  await expect(b.getByRole('button', { name: /drop-notes.txt/ }).first()).toBeVisible();
  await a.unroute('**/api/uploads/**');
  const fileDownload = b.waitForEvent('download');
  await b.getByRole('button', { name: /big-board.bin/ }).first().click();
  const downloaded = await fileDownload;
  const filePath = await downloaded.path();
  expect(fs.statSync(filePath).size).toBe(7 * 1024 * 1024);
  await attach(a, 'Camera');
  await a.getByRole('button', { name: 'Take photo', exact: true }).click();
  await a.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(b.locator('img[alt^="photo-"]')).toBeVisible();

  await a.getByRole('button', { name: 'Message templates', exact: true }).click();
  await a.getByRole('button', { name: 'Stand-up update', exact: true }).click();
  await expect(a.getByPlaceholder('Message', { exact: true })).toHaveValue(/Yesterday:/);
  await a.getByPlaceholder('Message', { exact: true }).fill('Send this tomorrow');
  await a.getByRole('button', { name: 'Schedule message', exact: true }).click();
  await a.getByLabel('Send at · your local time').fill(localTime);
  await a
    .getByRole('dialog')
    .getByRole('button', { name: 'Schedule message', exact: true })
    .click();
  await expect(a.getByPlaceholder('Message', { exact: true })).toHaveValue('');
  await a.getByRole('button', { name: 'Scheduled messages', exact: true }).click();
  await expect(a.getByRole('dialog').getByText('Send this tomorrow')).toBeVisible();
  await a.getByRole('button', { name: 'Cancel delivery' }).click();
  await expect(a.getByRole('dialog').getByText(/cancelled/)).toBeVisible();
  await a.getByRole('button', { name: 'Close dialog' }).click();
  await a.getByRole('button', { name: 'Workspace board', exact: true }).click();
  await expect(
    a.getByRole('dialog').getByRole('heading', { name: 'Review the design' })
  ).toBeVisible();
  await a.screenshot({ path: 'test-results/workspace-board.png', fullPage: true });
  await a.getByRole('button', { name: 'Close dialog' }).click();
  await a.keyboard.press('Control+k');
  await a.getByPlaceholder('Search conversations, messages or actions…').fill('Review the design');
  await expect(a.getByRole('dialog').getByText('☑ Review the design')).toBeVisible();
  await a.getByRole('button', { name: 'Close dialog' }).click();
  await a.getByRole('button', { name: 'Appearance', exact: true }).click();
  await a.getByRole('button', { name: /Midnight/ }).click();
  await expect(a.locator('html')).toHaveAttribute('data-theme', 'midnight');
  await a.screenshot({ path: 'test-results/midnight-theme.png', fullPage: true });
  await a.getByRole('button', { name: /Botanical/ }).click();
  await expect(a.locator('html')).toHaveAttribute('data-theme', 'sage');
  await a.getByRole('button', { name: /Daylight/ }).click();
  await a.getByRole('button', { name: 'Close dialog' }).click();

  await a.getByRole('button', { name: 'New group', exact: true }).click();
  await a.getByLabel('Group name').fill('Invite-only studio');
  await a.getByRole('checkbox', { name: /Nova Bob/ }).check();
  await a.getByRole('button', { name: 'Create group', exact: true }).click();
  await a.getByRole('button', { name: 'Contact info', exact: true }).click();
  await a.getByRole('button', { name: 'Invite to group via link', exact: true }).click();
  await expect(a.getByLabel('Group invite link')).toHaveValue(/\?invite=/);
  await a.getByLabel('Your member tag').fill('Design lead');
  await a.getByRole('button', { name: 'Save tag' }).click();
  await a.getByRole('checkbox', { name: 'Only admins can send messages' }).check();
  await a.getByRole('button', { name: 'Close dialog' }).click();
  await chat(b, 'Invite-only studio');
  await expect(b.getByPlaceholder('Message', { exact: true })).toBeDisabled();
  await chat(a, 'Nova Bob');
  await chat(b, 'Nova Alice');
  await a.getByRole('button', { name: 'App lock', exact: true }).click();
  await a.getByLabel('Choose a 6–8 digit PIN').fill('123456');
  await a.getByLabel('Confirm PIN', { exact: true }).fill('123456');
  await a.getByRole('button', { name: 'Enable app lock', exact: true }).click();
  await a.getByRole('button', { name: 'App lock', exact: true }).click();
  await expect(a.getByRole('button', { name: 'Unlock workspace' })).toBeVisible();
  await b.getByPlaceholder('Message', { exact: true }).fill('Waiting behind the lock');
  await b.getByRole('button', { name: 'Send', exact: true }).click();
  await a.bringToFront();
  const lockedMessage = b
    .locator('[id^="msg-"]')
    .filter({ has: b.getByText('Waiting behind the lock', { exact: true }) });
  await expect(lockedMessage.locator('[title="0 read · 1 delivered"]')).toBeVisible();
  await a.getByLabel('Your PIN', { exact: true }).fill('654321');
  await a.getByRole('button', { name: 'Unlock workspace' }).click();
  await expect(a.getByRole('alert')).toHaveText('Incorrect PIN');
  await a.getByLabel('Your PIN', { exact: true }).fill('123456');
  await a.getByRole('button', { name: 'Unlock workspace' }).click();
  await expect(a.getByText('Connected', { exact: true })).toBeVisible();
  await expect(lockedMessage.locator('[title="1 read · 1 delivered"]')).toBeVisible();
  await a.reload();
  await expect(a.getByRole('button', { name: 'Unlock workspace' })).toBeVisible();
  await a.getByLabel('Your PIN', { exact: true }).fill('123456');
  await a.getByRole('button', { name: 'Unlock workspace' }).click();
  await expect(a.getByText('Connected', { exact: true })).toBeVisible();
  await a.setViewportSize({ width: 390, height: 844 });
  await chat(a, 'Nova Bob');
  expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await a.getByRole('button', { name: 'Attach', exact: true }).click();
  await a.screenshot({ path: 'test-results/new-mobile-ui.png', fullPage: true });
  expect(errors).toEqual([]);
  await contextA.close();
  await contextB.close();
});
