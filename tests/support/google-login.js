import { expect } from '@playwright/test';
import { googleCredential } from '../../../server/test/support/google-fixture.js';

export async function stubGoogle(page, subject = 'test-preview', name = 'Test user') {
  const credential = googleCredential(subject, name);
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: {
      initialize(options) { this.callback = options.callback; },
      renderButton(element) {
        const button = document.createElement('button');
        button.textContent = 'Continue with Google';
        button.onclick = () => this.callback({ credential: ${JSON.stringify(credential)} });
        element.appendChild(button);
      }
    } } };`,
    })
  );
}

export async function loginGoogle(page, subject, name) {
  await stubGoogle(page, subject, name);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  const dismiss = page.getByRole('button', { name: 'Dismiss notification prompt' });
  if (await dismiss.isVisible()) await dismiss.click();
}
