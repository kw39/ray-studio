const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path');
const { spawn } = require('node:child_process');
const sea = require('node:sea');
const version = sea.isSea() ? sea.getAsset('version', 'utf8') : require('./package.json').version;
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/project-schema.mjs', ['project-schema.mjs', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);
function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? 'explorer.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open';
  const child = spawn(command, [url], { stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log(`Open this address in your browser: ${url}`));
  child.on('exit', (code) => {
    if (code) console.log(`Open this address in your browser: ${url}`);
  });
  child.unref();
}
function startServer({
  port = Number(process.env.PORT || 4173),
  open = false,
  launchBrowser = openBrowser,
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw Error('PORT must be a whole number from 0 to 65535.');
  const server = http.createServer((req, res) => {
    const port = server.address().port;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) {
      res.writeHead(403);
      return res.end('Local access only');
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    let route;
    try {
      route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    const asset = publicFiles.get(route);
    if (!asset) {
      res.writeHead(404);
      return res.end('Not found');
    }
    try {
      const data = sea.isSea()
        ? Buffer.from(sea.getAsset(asset[0]))
        : fs.readFileSync(path.join(__dirname, asset[0]));
      res.writeHead(200, {
        'Content-Type': asset[1],
        'Content-Length': data.length,
        'Cache-Control': 'no-store',
        'X-Ray-Studio': '1',
        'X-Ray-Studio-Version': version,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Security-Policy':
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'",
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(500);
      res.end('App files are missing. Extract the complete download and try again.');
    }
  });
  server.on('error', (err) => {
    if (err.code !== 'EADDRINUSE' || !open) {
      console.error(`Could not start Ray Studio: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    const url = `http://127.0.0.1:${port}`;
    const request = http.get(url, (response) => {
      response.resume();
      if (response.headers['x-ray-studio'] === '1') {
        console.log(`Ray Studio is already running: ${url}`);
        launchBrowser(url);
      } else {
        console.error(
          `Port ${port} is being used by another server. Close that server or set PORT to a different number and try again.`,
        );
        process.exitCode = 1;
      }
    });
    request.setTimeout(3000, () =>
      request.destroy(Error('Timed out checking the existing server.')),
    );
    request.on('error', (err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    console.log(
      `Ray Studio: ${url}\nKeep this window open while using the app. Close it or press Ctrl+C to stop.`,
    );
    if (open) launchBrowser(url);
  });
  return server;
}
if (sea.isSea() || require.main === module) {
  if (process.argv.includes('--version')) console.log(`Ray Studio ${version}`);
  else if (process.argv.includes('--licenses') && sea.isSea())
    console.log(sea.getAsset('NODE-LICENSE.txt', 'utf8'));
  else {
    try {
      startServer({
        open:
          !process.argv.includes('--no-open') && (sea.isSea() || process.argv.includes('--open')),
      });
    } catch (err) {
      console.error(err.message);
      process.exitCode = 1;
    }
  }
}
if (sea.isSea() && !process.argv.includes('--no-open'))
  process.once('beforeExit', () => {
    if (process.exitCode) {
      console.log('Press Enter to close this window.');
      process.stdin.resume();
      process.stdin.once('data', () => process.exit(process.exitCode));
    }
  });
module.exports = { startServer };
