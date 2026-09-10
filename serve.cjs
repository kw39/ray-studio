const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const {spawn} = require('node:child_process');
function openBrowser(url) {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], {stdio: 'ignore', windowsHide: true});
  child.on('error', () => console.log(`Open this address in your browser: ${url}`));
  child.unref();
}
function startServer({port = Number(process.env.PORT || 4173), open = false, launchBrowser = openBrowser} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('PORT must be a whole number from 0 to 65535.');
  const server = http.createServer((req, res) => {
    let file;
    try { file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); return res.end(); }
    file = path.resolve(__dirname, '.' + (file === '/' ? '/index.html' : file));
    if (!file.startsWith(__dirname + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, {'Content-Type': ({'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json'})[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Ray-Studio': '1'});
      res.end(data);
    });
  });
  server.on('error', err => {
    if (err.code !== 'EADDRINUSE' || !open) { console.error(`Could not start Ray Studio: ${err.message}`); process.exitCode = 1; return; }
    const url = `http://127.0.0.1:${port}`;
    const request = http.get(url, response => {
      response.resume();
      if (response.headers['x-ray-studio'] === '1') { console.log(`Ray Studio is already running: ${url}`); launchBrowser(url); }
      else { console.error(`Port ${port} is being used by another server. Close that server or set PORT to a different number and try again.`); process.exitCode = 1; }
    });
    request.setTimeout(3000, () => request.destroy(Error('Timed out checking the existing server.')));
    request.on('error', err => { console.error(err.message); process.exitCode = 1; });
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    console.log(`Ray Studio: ${url}\nKeep this window open while using the app. Close it or press Ctrl+C to stop.`);
    if (open) launchBrowser(url);
  });
  return server;
}
if (require.main === module) startServer({open: process.argv.includes('--open')});
module.exports = {startServer};
