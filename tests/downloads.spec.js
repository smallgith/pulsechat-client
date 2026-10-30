import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// Edge exposes its own downloads hub as a Page; it is not an attachment preview popup.
const webPages = (context) =>
  context
    .pages()
    .map((p) => p.url())
    .filter((url) => !url.startsWith('edge://downloads-hub'));

test('downloads cross-origin local attachments without leaving the chat', async ({ page }) => {
  await page.goto('/');
  const api = 'http://localhost:15800';
  const phone = `855${String(Date.now()).slice(-7)}`;
  await page.request.post(`${api}/api/send-otp`, { data: { phone } });
  const auth = await (
    await page.request.post(`${api}/api/verify-otp`, {
      data: { phone, otp: '111111' },
    })
  ).json();
  const bytes = Buffer.from('An actual cross-origin attachment');
  const uploaded = await (
    await page.request.post(`${api}/api/upload`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      multipart: { file: { name: 'report.txt', mimeType: 'text/plain', buffer: bytes } },
    })
  ).json();
  await page.evaluate(async (file) => {
    const { downloadAttachment } = await import('/src/lib/download-attachment.js');
    const button = document.createElement('button');
    button.textContent = 'Save test attachment';
    button.onclick = () => downloadAttachment(file);
    document.body.appendChild(button);
  }, uploaded);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save test attachment' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('report.txt');
  expect(fs.readFileSync(await download.path())).toEqual(bytes);
  expect(page.url()).toBe('http://localhost:5180/');
});

test('downloads hosted media bytes instead of opening a preview tab', async ({ page, context }) => {
  await page.goto('/');
  const pagesBefore = webPages(context);
  const url = 'https://media.example.test/sent-image.png';
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNioAAAAASUVORK5CYII=',
    'base64'
  );
  await context.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: bytes,
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  );
  await page.evaluate(async (url) => {
    const { downloadAttachment } = await import('/src/lib/download-attachment.js');
    const button = document.createElement('button');
    button.textContent = 'Save hosted image';
    button.onclick = () => downloadAttachment({ url, name: 'sent-image.png', mime: 'image/png' });
    document.body.appendChild(button);
  }, url);
  const downloadEvent = page.waitForEvent('download', { timeout: 5000 });
  await page.getByRole('button', { name: 'Save hosted image' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('sent-image.png');
  expect(fs.readFileSync(await download.path())).toEqual(bytes);
  await expect.poll(() => webPages(context)).toEqual(pagesBefore);
});

test('Cloudinary media uses streaming server downloads without CDN CORS or preview tabs', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const pagesBefore = webPages(context);
  const bytes = Buffer.from('Original hosted attachment bytes');
  const methods = [];
  await context.route('**/api/download?**', async (route) => {
    methods.push(route.request().method());
    const name = new URL(route.request().url()).searchParams.get('name');
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: route.request().method() === 'HEAD' ? undefined : bytes,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  });
  await page.evaluate(async () => {
    const { downloadAttachment } = await import('/src/lib/download-attachment.js');
    for (const [type, name] of [
      ['image', 'ફોટો.png'],
      ['video', 'clip.mp4'],
      ['raw', 'archive.zip'],
    ]) {
      const button = document.createElement('button');
      button.textContent = `Save ${type}`;
      button.onclick = () =>
        downloadAttachment({
          url: `https://res.cloudinary.com/pulsechat-test/${type}/upload/v1/file`,
          name,
        });
      document.body.appendChild(button);
    }
  });
  for (const [type, name] of [
    ['image', 'ફોટો.png'],
    ['video', 'clip.mp4'],
    ['raw', 'archive.zip'],
  ]) {
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: `Save ${type}`, exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(name);
    expect(fs.readFileSync(await download.path())).toEqual(bytes);
  }
  expect(methods).toEqual(['HEAD', 'GET', 'HEAD', 'GET', 'HEAD', 'GET']);
  await expect.poll(() => webPages(context)).toEqual(pagesBefore);
});

async function login(page, phone, name) {
  await page.goto('/');
  await page.getByPlaceholder('9876543210').fill(phone);
  await page.getByRole('button', { name: 'Send OTP' }).click();
  for (let i = 0; i < 6; i++) await page.locator('input[maxlength="1"]').nth(i).fill('1');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.getByPlaceholder('e.g. Aarav Patel').fill(name);
  await page.getByRole('button', { name: 'Start chatting' }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  const dismiss = page.getByRole('button', { name: 'Dismiss notification prompt' });
  if (await dismiss.isVisible()) await dismiss.click();
}

test('sender and recipient save image, video, audio and documents from chat and shared media', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const senderContext = await browser.newContext();
  const receiverContext = await browser.newContext();
  try {
    const sender = await senderContext.newPage(),
      receiver = await receiverContext.newPage();
    const suffix = String(Date.now()).slice(-7);
    await login(sender, `866${suffix}`, 'Download sender');
    await login(receiver, `877${suffix}`, 'Download receiver');
    for (const [page, name] of [
      [sender, 'Download receiver'],
      [receiver, 'Download sender'],
    ])
      await page
        .locator('aside')
        .getByRole('button')
        .filter({ has: page.getByText(name, { exact: true }) })
        .click();
    const senderPages = webPages(senderContext),
      receiverPages = webPages(receiverContext);
    const video = await sender.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const stream = canvas.captureStream(10),
        chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.start();
      canvas.getContext('2d').fillRect(0, 0, 64, 64);
      await new Promise((resolve) => setTimeout(resolve, 200));
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
    });
    const files = [
      {
        name: 'ફોટો.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNioAAAAASUVORK5CYII=',
          'base64'
        ),
      },
      { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from(video) },
      {
        name: 'recording.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.from(
          'RIFF\x28\0\0\0WAVEfmt \x10\0\0\0\x01\0\x01\0\x40\x1f\0\0\x80\x3e\0\0\x02\0\x10\0data\x04\0\0\0\0\0\0\0',
          'binary'
        ),
      },
      {
        name: 'report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'),
      },
      {
        name: 'archive.zip',
        mimeType: 'application/zip',
        buffer: Buffer.from('504b0506000000000000000000000000000000000000', 'hex'),
      },
      {
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Original notes. Exact contents must survive downloading.'),
      },
    ];
    await sender.locator('input[type="file"]').first().setInputFiles(files);
    await sender.getByRole('button', { name: 'Send', exact: true }).click();
    const bubble = (page, name) => page.locator('[id^="msg-"]').filter({ hasText: name });
    for (const page of [sender, receiver]) {
      for (const file of files) {
        const button = bubble(page, file.name).getByRole('button', {
          name: `Download ${file.name}`,
          exact: true,
        });
        await expect(button).toBeVisible();
        const downloadEvent = page.waitForEvent('download');
        await button.click();
        const download = await downloadEvent;
        expect(download.suggestedFilename()).toBe(file.name);
        expect(fs.readFileSync(await download.path())).toEqual(file.buffer);
      }
    }
    // The image preview's own save button must use the same download flow.
    await receiver.getByRole('img', { name: 'ફોટો.png', exact: true }).click();
    const previewDownload = receiver.waitForEvent('download');
    await receiver.getByTitle('Download image', { exact: true }).last().click();
    expect(fs.readFileSync(await (await previewDownload).path())).toEqual(files[0].buffer);
    await receiver.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 100 } });
    await receiver.getByRole('button', { name: 'Chat menu', exact: true }).click();
    await receiver.getByRole('menuitem', { name: 'Shared media & files', exact: true }).click();
    const sharedDownload = receiver.waitForEvent('download');
    await receiver
      .getByRole('dialog')
      .getByRole('button', { name: /Download.*report.pdf/ })
      .click();
    expect(fs.readFileSync(await (await sharedDownload).path())).toEqual(files[3].buffer);
    await receiver.getByRole('button', { name: 'Close dialog' }).click();

    // A missing attachment shows a useful error in chat, without navigating away.
    await receiver.route('**/api/files/**', (route) =>
      route.request().method() === 'HEAD'
        ? route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' } })
        : route.continue()
    );
    await bubble(receiver, 'notes.txt').getByTitle('Download attachment', { exact: true }).click();
    await expect(bubble(receiver, 'notes.txt').getByRole('alert')).toHaveText(
      /no longer available/
    );
    await expect.poll(() => webPages(senderContext)).toEqual(senderPages);
    await expect.poll(() => webPages(receiverContext)).toEqual(receiverPages);
  } finally {
    await senderContext.close();
    await receiverContext.close();
  }
});
