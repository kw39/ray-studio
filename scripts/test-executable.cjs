const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..'),
  { version } = require('../package.json');
async function main() {
  const source = path.join(root, 'dist', `Ray-Studio-${version}-windows-x64`, 'Ray Studio.exe');
  const isolated = fs.mkdtempSync(path.join(root, '.build', 'standalone-test-'));
  const exe = path.join(isolated, 'Ray Studio.exe');
  fs.copyFileSync(source, exe);
  // Deliberately omit Node and npm from PATH. No app assets are next to this copy.
  const env = {
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    PATH: path.join(process.env.SystemRoot, 'System32'),
    PORT: '0',
  };
  const info = spawnSync(exe, ['--version'], {
    cwd: isolated,
    env,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(info.status, 0);
  assert.match(info.stdout, new RegExp(version.replaceAll('.', '\\.')));
  const child = spawn(exe, ['--no-open'], { cwd: isolated, env, windowsHide: true });
  let output = '';
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Executable startup timed out')), 15000);
      child.on('error', reject);
      child.on('exit', (code) => {
        clearTimeout(timer);
        reject(Error(`Executable exited (${code}): ${output}`));
      });
      child.stderr.on('data', (b) => (output += b));
      child.stdout.on('data', (b) => {
        output += b;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
    });
    for (const file of ['index.html', 'app.js', 'styles.css', 'project-schema.mjs']) {
      const res = await fetch(`${url}/${file}`);
      assert.equal(res.status, 200);
      assert.deepEqual(
        Buffer.from(await res.arrayBuffer()),
        fs.readFileSync(path.join(root, file)),
      );
    }
    assert.equal((await fetch(url + '/.git/config')).status, 404);
    const result = await new Promise((resolve) => {
      const p = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test'], {
        cwd: root,
        env: { ...process.env, TEST_APP_URL: url },
        stdio: 'inherit',
        windowsHide: true,
      });
      p.on('error', () => resolve(1));
      p.on('exit', resolve);
    });
    assert.equal(result, 0, 'Browser journeys against standalone executable');
    console.log(
      'PASS: isolated executable with no Node on PATH; embedded assets and browser journeys verified.',
    );
  } finally {
    child.kill();
  }
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
