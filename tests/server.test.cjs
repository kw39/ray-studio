const {test} = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const http = require('node:http');
const {spawn} = require('node:child_process');
const path = require('node:path');
const {startServer} = require('../serve.cjs');

test('opens only after listening, serves app assets, and reuses the running app', async t => {
  const opened = [];
  const server = startServer({port: 0, open: true, launchBrowser: url => {assert.ok(server.listening); opened.push(url);}});
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
    startServer({port: server.address().port, open: true, launchBrowser: reopened => {
      clearTimeout(timeout); assert.equal(reopened, url); resolve();
    }});
  });
});

test('reports an occupied port without opening an unrelated website', async t => {
  const other = http.createServer((req,res) => res.end('another app')).listen(0, '127.0.0.1');
  t.after(() => other.close());
  await once(other, 'listening');
  const child = spawn(process.execPath, ['serve.cjs', '--open'], {cwd:path.join(__dirname,'..'), env:{...process.env, PORT:String(other.address().port)}, windowsHide:true});
  let output = ''; child.stderr.on('data', chunk => output += chunk);
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(output, /being used by another server/);
});
