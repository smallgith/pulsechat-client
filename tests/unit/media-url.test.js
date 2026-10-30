import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backendUrl, resolveMediaUrl } from '../../src/lib/media-url.js';

test('HTTPS frontend repairs a configured HTTP API and historical attachment URLs', () => {
  const page = {
    protocol: 'https:',
    hostname: 'sitfounder.netlify.app',
    href: 'https://sitfounder.netlify.app/',
  };
  const api = backendUrl('http://pulsechat-server.onrender.com/', page);
  assert.equal(api, 'https://pulsechat-server.onrender.com');
  const id = '45fa7412-0552-4f5a-80ce-3983fe9f1596';
  for (const old of [
    `http://pulsechat-server.onrender.com/api/files/${id}`,
    `http://localhost:5000//api/files/${id}/`,
    `/api/files/${id}`,
  ])
    assert.equal(resolveMediaUrl(old, api, 'https:'), `${api}/api/files/${id}`);
  assert.equal(
    backendUrl('http://localhost:5000', { protocol: 'http:', href: 'http://localhost:5173/' }),
    'http://localhost:5000'
  );
});
