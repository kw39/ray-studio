const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { startServer } = require('../serve.cjs');

test('opens only after listening, serves app assets, and reuses the running app', async (t) => {
  const opened = [];
  const server = startServer({
    port: 0,
    open: true,
    launchBrowser: (url) => {
      assert.ok(server.listening);
      opened.push(url);
    },
  });
  t.after(() => server.close());
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(opened, [url]);
  for (const file of ['/', '/app.js', '/styles.css']) {
    const response = await fetch(url + file);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-ray-studio'), '1');
    assert.ok((await response.text()).length > 0);
  }
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Existing server was not reopened')), 5000);
    startServer({
      port: server.address().port,
      open: true,
      launchBrowser: (reopened) => {
        clearTimeout(timeout);
        assert.equal(reopened, url);
        resolve();
      },
    });
  });
});

test('reports an occupied port without opening an unrelated website', async (t) => {
  const other = http.createServer((req, res) => res.end('another app')).listen(0, '127.0.0.1');
  t.after(() => other.close());
  await once(other, 'listening');
  const child = spawn(process.execPath, ['serve.cjs', '--open'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(other.address().port) },
    windowsHide: true,
  });
  let output = '';
  child.stderr.on('data', (chunk) => (output += chunk));
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(output, /being used by another server/);
});

test('serves only public assets and rejects nonlocal hosts and writes', async (t) => {
  const server = startServer({ port: 0 });
  t.after(() => server.close());
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const file of [
    '/.git/config',
    '/package.json',
    '/serve.cjs',
    '/README.md',
    '/tests/server.test.cjs',
    '/%2e%2e/.env',
    '/app.js%00',
  ])
    assert.equal((await fetch(url + file)).status, 404, file);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.ok(Number(head.headers.get('content-length')) > 0);
  assert.match(head.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(head.headers.get('x-content-type-options'), 'nosniff');
  const badHost = await new Promise((resolve) => {
    http.get(url, { headers: { Host: 'untrusted.example' } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
  });
  assert.equal(badHost, 403);
});
