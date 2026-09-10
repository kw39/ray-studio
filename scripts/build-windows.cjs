const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { inject } = require('postject');
const root = path.join(__dirname, '..');
const runtimeVersion = '24.19.0';
const { version } = require('../package.json');
const work = path.join(root, '.build', 'windows');
const output = path.join(root, 'dist', `Ray-Studio-${version}-windows-x64`);
const checksum = (data) => crypto.createHash('sha256').update(data).digest('hex');
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
async function build() {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw Error('Build on Windows x64. The executable targets Windows 10/11 x64.');
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(output, { recursive: true });
  const runtime = path.join(work, 'node.exe');
  const base = `https://nodejs.org/dist/v${runtimeVersion}/`;
  console.log(`Verifying official Node.js ${runtimeVersion} runtime…`);
  const sums = (await get(base + 'SHASUMS256.txt')).toString();
  const entry = sums.split(/\r?\n/).find((line) => line.trim().endsWith(' win-x64/node.exe'));
  if (!entry) throw Error('Runtime checksum not found.');
  const expected = entry.trim().split(/\s+/)[0];
  if (!fs.existsSync(runtime) || checksum(fs.readFileSync(runtime)) !== expected)
    fs.writeFileSync(runtime, await get(base + 'win-x64/node.exe'));
  if (checksum(fs.readFileSync(runtime)) !== expected)
    throw Error('Runtime checksum mismatch; build stopped.');
  const notices = await get(
    `https://raw.githubusercontent.com/nodejs/node/v${runtimeVersion}/LICENSE`,
  );
  fs.writeFileSync(path.join(work, 'NODE-LICENSE.txt'), notices);
  fs.writeFileSync(path.join(work, 'version.txt'), version);
  const assetNames = ['index.html', 'app.js', 'styles.css', 'project-schema.mjs'];
  const assets = Object.fromEntries(assetNames.map((name) => [name, path.join(root, name)]));
  assets.version = path.join(work, 'version.txt');
  assets['NODE-LICENSE.txt'] = path.join(work, 'NODE-LICENSE.txt');
  const blob = path.join(work, 'app.blob'),
    config = path.join(work, 'sea-config.json');
  fs.writeFileSync(
    config,
    JSON.stringify(
      {
        main: path.join(root, 'serve.cjs'),
        output: blob,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: false,
        execArgvExtension: 'none',
        assets,
      },
      null,
      2,
    ),
  );
  const prepare = spawnSync(runtime, ['--experimental-sea-config', config], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (prepare.status !== 0) throw Error('Executable preparation failed.');
  const exe = path.join(output, 'Ray Studio.exe');
  fs.copyFileSync(runtime, exe);
  await inject(exe, 'NODE_SEA_BLOB', fs.readFileSync(blob), {
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  });
  fs.writeFileSync(path.join(output, 'NODE-LICENSE.txt'), notices);
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
  fs.copyFileSync(
    path.join(root, 'docs', 'WINDOWS-QUICK-START.txt'),
    path.join(output, 'README.txt'),
  );
  fs.writeFileSync(
    path.join(output, 'SHA256SUMS.txt'),
    `${checksum(fs.readFileSync(exe))}  Ray Studio.exe\n`,
  );
  fs.writeFileSync(
    path.join(output, 'build-info.json'),
    JSON.stringify(
      {
        appVersion: version,
        runtimeVersion,
        platform: 'windows-x64',
        runtimeSha256: expected,
        assets: Object.fromEntries(
          assetNames.map((name) => [name, checksum(fs.readFileSync(path.join(root, name)))]),
        ),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Built ${exe}`);
}
build().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
