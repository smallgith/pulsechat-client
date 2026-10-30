import { test, expect } from '@playwright/test';
import { loginGoogle } from './support/google-login';

const api = 'http://localhost:15800';
const chat = (page, name) =>
  page
    .locator('aside')
    .getByRole('button')
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
async function send(page, text) {
  await page.getByPlaceholder('Message', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const row = page
    .locator('[id^="msg-"]')
    .filter({ has: page.getByText(text, { exact: true }) })
    .last();
  await expect(row).toBeVisible();
  return (await row.getAttribute('id')).slice(4);
}
const identity = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pulsechat.user')));
async function replyData(context, receiver, sender, messageId) {
  const response = await context.request.post(`${api}/api/notifications/context`, {
    headers: { Authorization: `Bearer ${receiver.token}` },
    data: { chat: sender.phone, messageId },
  });
  expect(response.ok()).toBe(true);
  return {
    user: receiver.phone,
    chat: sender.phone,
    messageId,
    reply: (await response.json()).reply,
    url: `/?chat=${encodeURIComponent(sender.phone)}`,
    title: sender.name,
    body: 'Please reply',
    tag: `chat-${sender.phone}`,
  };
}
async function notificationWorker(page, context) {
  await page.evaluate(async () => {
    await (await import('/src/lib/push.js')).syncNotificationAccount();
  });
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  await worker.evaluate(() => {
    self.testNotifications = [];
    // OS rendering/clicks are emulated; real service-worker storage and backend requests are exercised.
    self.registration.showNotification = async (title, options) => {
      self.testNotifications.push({ title, options });
    };
    self.registration.getNotifications = async () => [];
    const match = self.clients.matchAll.bind(self.clients);
    self.clients.matchAll = async (options) =>
      (await match(options)).map((client) => {
        client.focus = async () => client;
        return client;
      });
  });
  return worker;
}
async function click(worker, data, reply, action = 'reply') {
  return worker.evaluate(
    async ({ data, reply, action }) => {
      const tasks = [],
        event = new Event('notificationclick');
      Object.assign(event, {
        action,
        reply,
        notification: { data, close() {} },
        waitUntil(promise) {
          tasks.push(promise);
        },
      });
      self.dispatchEvent(event);
      await Promise.all(tasks);
      return self.testNotifications.at(-1);
    },
    { data, reply, action }
  );
}

test('quick-reply draft survives later alerts and sends to its original conversation', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    const [a, b, c] = await Promise.all(contexts.map((context) => context.newPage()));
    const id = String(Date.now());
    await loginGoogle(a, `notify-a-${id}`, 'Notify Alice');
    await loginGoogle(b, `notify-b-${id}`, 'Notify Bob');
    await loginGoogle(c, `notify-c-${id}`, 'Notify Cara');
    await chat(a, 'Notify Bob');
    await chat(c, 'Notify Bob');
    await chat(b, 'Message yourself');
    await send(a, 'First alert from Alice');
    const toast = b.getByRole('status', { name: 'Message notification' });
    await expect(toast.getByText('First alert from Alice', { exact: true })).toBeVisible();
    await b.clock.install();
    await b.getByLabel('Quick reply', { exact: true }).fill('This reply belongs to Alice');
    await b.clock.fastForward(12000);
    await expect(b.getByLabel('Quick reply', { exact: true })).toHaveValue(
      'This reply belongs to Alice'
    );
    await toast.screenshot({ path: 'test-results/quick-reply-notification.png' });
    await send(c, 'A later alert from Cara');
    await expect(toast.getByText('First alert from Alice', { exact: true })).toBeVisible();
    await expect(b.getByLabel('Quick reply', { exact: true })).toHaveValue(
      'This reply belongs to Alice'
    );
    await b.getByRole('button', { name: 'Send quick reply' }).click();
    await expect(
      a.locator('[id^="msg-"]').getByText('This reply belongs to Alice', { exact: true })
    ).toBeVisible();
    await expect(c.getByText('This reply belongs to Alice', { exact: true })).toHaveCount(0);
    await expect(toast.getByText('A later alert from Cara', { exact: true })).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('native inline reply works with the app closed; network retry sends exactly once', async ({
  browser,
}) => {
  const aContext = await browser.newContext(),
    bContext = await browser.newContext();
  try {
    const a = await aContext.newPage(),
      b = await bContext.newPage();
    const id = String(Date.now());
    await loginGoogle(a, `native-a-${id}`, 'Native Alice');
    await loginGoogle(b, `native-b-${id}`, 'Native Bob');
    await chat(a, 'Native Bob');
    await chat(b, 'Message yourself');
    const sender = await identity(a),
      receiver = await identity(b);
    const sourceId = await send(a, 'Reply without opening the app');
    const data = await replyData(bContext, receiver, sender, sourceId);
    const worker = await notificationWorker(b, bContext);
    const shown = await worker.evaluate(async (data) => {
      const tasks = [],
        event = new Event('push');
      Object.assign(event, {
        data: { json: () => ({ ...data, type: 'message' }) },
        waitUntil(promise) {
          tasks.push(promise);
        },
      });
      self.dispatchEvent(event);
      await Promise.all(tasks);
      return self.testNotifications.at(-1);
    }, data);
    expect(shown.options.actions[0]).toMatchObject({
      action: 'reply',
      type: 'text',
      placeholder: 'Type a reply…',
    });
    await b.close();
    expect((await click(worker, data, 'Sent from the notification')).title).toBe('Reply sent');
    await expect(
      a.locator('[id^="msg-"]').getByText('Sent from the notification', { exact: true })
    ).toBeVisible();
    await click(worker, data, 'Sent from the notification');
    await expect(
      a.locator('[id^="msg-"]').getByText('Sent from the notification', { exact: true })
    ).toHaveCount(1);
    const secondId = await send(a, 'A reply that will need retry');
    const retryData = await replyData(bContext, receiver, sender, secondId);
    await worker.evaluate(() => {
      self.originalFetch = self.fetch;
      self.fetch = async () => {
        throw new TypeError('Offline');
      };
    });
    const failed = await click(worker, retryData, 'Saved while offline');
    expect(failed.title).toBe('Reply not sent');
    expect(failed.options.data.pendingReply).toBe('Saved while offline');
    await expect(
      a.locator('[id^="msg-"]').getByText('Saved while offline', { exact: true })
    ).toHaveCount(0);
    await worker.evaluate(() => {
      self.fetch = self.originalFetch;
    });
    expect((await click(worker, failed.options.data, undefined, 'retry')).title).toBe('Reply sent');
    await expect(
      a.locator('[id^="msg-"]').getByText('Saved while offline', { exact: true })
    ).toHaveCount(1);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('Reply action opens an in-app quick reply when native text entry is unavailable', async ({
  browser,
}) => {
  const aContext = await browser.newContext(),
    bContext = await browser.newContext();
  try {
    const a = await aContext.newPage(),
      b = await bContext.newPage(),
      id = String(Date.now());
    await loginGoogle(a, `fallback-a-${id}`, 'Fallback Alice');
    await loginGoogle(b, `fallback-b-${id}`, 'Fallback Bob');
    await chat(a, 'Fallback Bob');
    await chat(b, 'Message yourself');
    const sender = await identity(a),
      receiver = await identity(b);
    const sourceId = await send(a, 'Use the Reply action');
    const data = await replyData(bContext, receiver, sender, sourceId);
    const worker = await notificationWorker(b, bContext);
    await click(worker, data, undefined);
    await expect(b.getByLabel('Quick reply', { exact: true })).toBeFocused();
    await b.getByLabel('Quick reply', { exact: true }).fill('Reply from the fallback box');
    await b.getByRole('button', { name: 'Send quick reply' }).click();
    await expect(
      a.locator('[id^="msg-"]').getByText('Reply from the fallback box', { exact: true })
    ).toBeVisible();
    const lostSource = await send(a, 'Keep a reply after a lost acknowledgement');
    const lostData = await replyData(bContext, receiver, sender, lostSource);
    await worker.evaluate(() => {
      self.originalFetch = self.fetch;
      self.fetch = async (...args) => {
        await self.originalFetch(...args);
        throw new TypeError('Reply acknowledgement lost');
      };
    });
    const lost = await click(worker, lostData, 'Send this only once');
    expect(lost.title).toBe('Reply not sent');
    await expect(
      a.locator('[id^="msg-"]').getByText('Send this only once', { exact: true })
    ).toHaveCount(1);
    await worker.evaluate(() => {
      self.fetch = self.originalFetch;
    });
    await click(worker, lost.options.data, undefined, 'open');
    await expect(b.getByLabel('Quick reply', { exact: true })).toHaveValue('Send this only once');
    await b.getByRole('button', { name: 'Send quick reply' }).click();
    await expect(b.getByLabel('Quick reply', { exact: true })).toHaveCount(0);
    await expect(
      a.locator('[id^="msg-"]').getByText('Send this only once', { exact: true })
    ).toHaveCount(1);
    const privateNotice = await worker.evaluate(async (data) => {
      const tasks = [],
        event = new Event('push');
      Object.assign(event, {
        data: { json: () => ({ ...data, privateMode: true, body: 'Private message content' }) },
        waitUntil(promise) {
          tasks.push(promise);
        },
      });
      self.dispatchEvent(event);
      await Promise.all(tasks);
      return self.testNotifications.at(-1);
    }, data);
    expect(privateNotice.title).toBe('PulseChat');
    expect(privateNotice.options.body).not.toContain('Private message content');
    expect(privateNotice.options.actions.some((action) => action.action === 'reply')).toBe(false);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
