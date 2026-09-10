const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}
try {
  // Deploy committed main so local experiments cannot accidentally go live.
  if (git(root, 'branch', '--show-current') !== 'main')
    throw Error('Switch to main before publishing.');
  if (git(root, 'status', '--porcelain', '--untracked-files=no'))
    throw Error('Commit your tracked changes before publishing.');
  const remote = git(root, 'remote', 'get-url', 'origin');
  git(root, 'fetch', 'origin', 'main');
  const revision = git(root, 'rev-parse', 'HEAD');
  if (revision !== git(root, 'rev-parse', 'origin/main'))
    throw Error('Push main, or bring it up to date, before publishing.');
  const work = path.join(root, '.build');
  fs.mkdirSync(work, { recursive: true });
  const stage = fs.mkdtempSync(path.join(work, 'pages-'));
  git(stage, 'init');
  git(stage, 'remote', 'add', 'origin', remote);
  git(stage, 'config', 'user.name', git(root, 'log', '-1', '--format=%an'));
  git(stage, 'config', 'user.email', git(root, 'log', '-1', '--format=%ae'));
  if (git(root, 'ls-remote', '--heads', 'origin', 'gh-pages')) {
    git(stage, 'fetch', '--depth=1', 'origin', 'gh-pages');
    git(stage, 'checkout', '-b', 'gh-pages', 'FETCH_HEAD');
  } else {
    git(stage, 'checkout', '--orphan', 'gh-pages');
  }
  const files = ['index.html', 'app.js', 'styles.css', 'project-schema.mjs', 'LICENSE'];
  for (const file of files) {
    const content = execFileSync('git', ['show', `${revision}:${file}`], { cwd: root });
    fs.writeFileSync(path.join(stage, file), content);
  }
  fs.writeFileSync(path.join(stage, '.nojekyll'), '');
  git(stage, 'add', '--', ...files, '.nojekyll');
  if (git(stage, 'status', '--porcelain')) {
    git(stage, 'commit', '-m', `Publish Ray Studio from ${revision.slice(0, 7)}`);
    git(stage, 'push', 'origin', 'gh-pages');
  }
  console.log('Web files published to gh-pages. GitHub Pages may take a few minutes to update.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
