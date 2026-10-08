// Renders a game's brand assets from its brand/icon.html and brand/wordmark.html with Electron, so every size comes out of one source.
//   electron render-brand.js [--game <dir>]
// Produces brand/png/icon-<size>.png, brand/png/wordmark*.png, game/logo.png, game/logo-256.png, game/wordmark.png and build/icon.ico.
// icon.html takes ?size=<px>&simple=<0|1> (simple: a plainer mark for the tiny sizes); wordmark.html takes ?w=<px>&dark=<0|1>
// and sets its document title to "<w>x<h>" once laid out, so the capture is cropped to the lockup.
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2), at = argv.indexOf('--game'), root = path.resolve(at >= 0 ? argv[at + 1] : '.');
const outDir = path.join(root, 'brand', 'png');
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const SIMPLE_AT_OR_BELOW = 32;
function url(file, query) { return 'file://' + path.join(root, 'brand', file).replace(/\\/g, '/') + '?' + query; }
async function shoot(win, address, w, h, outPath) {
  await win.setContentSize(w, h); await win.loadURL(address);
  await new Promise((r) => setTimeout(r, 140));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
  fs.writeFileSync(outPath, img.toPNG()); return outPath;
}
app.disableHardwareAcceleration();
// destroying the render window leaves Electron with no windows, and its default window-all-closed handler would quit before the ico is written
app.on('window-all-closed', function () {});
app.whenReady().then(async () => {
  if (!fs.existsSync(path.join(root, 'brand', 'icon.html'))) { console.error('render-brand: no brand/icon.html in ' + root); app.exit(1); return; }
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, backgroundColor: '#00000000', useContentSize: true, webPreferences: { offscreen: false } });
  for (const s of ICON_SIZES) { await shoot(win, url('icon.html', 'size=' + s + '&simple=' + (s <= SIMPLE_AT_OR_BELOW ? 1 : 0)), s, s, path.join(outDir, 'icon-' + s + '.png')); console.log('icon-' + s + '.png'); }
  if (fs.existsSync(path.join(root, 'brand', 'wordmark.html'))) {
    for (const [w, name] of [[1200, 'wordmark'], [600, 'wordmark@600'], [1200, 'wordmark-light']]) {
      const dark = name === 'wordmark-light' ? 0 : 1;
      await win.setContentSize(Math.round(w * 1.5), 600); await win.loadURL(url('wordmark.html', 'w=' + w + '&dark=' + dark));
      await new Promise((r) => setTimeout(r, 160));
      const [mw, mh] = (win.getTitle().match(/(\d+)x(\d+)/) || [0, w, 300]).slice(1).map(Number);
      const img = await win.webContents.capturePage({ x: 0, y: 0, width: mw, height: mh });
      fs.writeFileSync(path.join(outDir, name + '.png'), img.toPNG()); console.log(name + '.png  ' + mw + 'x' + mh);
    }
    fs.copyFileSync(path.join(outDir, 'wordmark.png'), path.join(root, 'game', 'wordmark.png'));
  }
  fs.mkdirSync(path.join(root, 'game'), { recursive: true });
  fs.copyFileSync(path.join(outDir, 'icon-512.png'), path.join(root, 'game', 'logo.png'));
  fs.copyFileSync(path.join(outDir, 'icon-256.png'), path.join(root, 'game', 'logo-256.png'));
  const mod = require('png-to-ico'); const pngToIco = mod.default || mod;
  const icoFrom = [16, 24, 32, 48, 64, 128, 256].map((s) => path.join(outDir, 'icon-' + s + '.png'));
  const buf = await pngToIco(icoFrom);
  fs.mkdirSync(path.join(root, 'build'), { recursive: true }); fs.writeFileSync(path.join(root, 'build', 'icon.ico'), buf);
  console.log('build/icon.ico  (' + icoFrom.length + ' sizes, ' + buf.length + ' bytes)');
  win.destroy(); app.quit();
}).catch((e) => { console.error(e); app.exit(1); });
