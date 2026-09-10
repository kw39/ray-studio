const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const files = ['app.js', 'project-schema.mjs', 'serve.cjs', 'playwright.config.cjs'];
for (const folder of ['scripts', 'tests'])
  for (const name of fs.readdirSync(path.join(root, folder)))
    if (/\.(cjs|mjs|js)$/.test(name)) files.push(`${folder}/${name}`);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked: ${files.length} files`);
