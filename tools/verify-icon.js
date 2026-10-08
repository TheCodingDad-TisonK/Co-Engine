// Refuse to build an installer without the app icon: node verify-icon.js [--game <dir>]
// electron-builder does not treat a missing icon as an error: it logs "default Electron icon is used" and carries on, so a
// broken brand step ships a generic Electron app and nobody notices until it is on someone's desktop. This runs between the
// brand render and electron-builder, and fails the build instead.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), at = argv.indexOf('--game'), dir = path.resolve(at >= 0 ? argv[at + 1] : '.');
const ico = path.join(dir, 'build', 'icon.ico');
if (!fs.existsSync(ico)) { console.error('\n  build/icon.ico is missing. Run the brand step (npm run brand) and check it printed the build/icon.ico line.\n'); process.exit(1); }
const buf = fs.readFileSync(ico);
if (buf.length < 1000 || buf[0] !== 0 || buf[1] !== 0 || buf[2] !== 1 || buf[3] !== 0) { console.error('\n  build/icon.ico is not a usable icon file (' + buf.length + ' bytes).\n'); process.exit(1); }
const count = buf.readUInt16LE(4);
if (count < 4) { console.error('\n  build/icon.ico only holds ' + count + ' size(s); Windows wants the full set down to 16px.\n'); process.exit(1); }
console.log('icon check: build/icon.ico, ' + count + ' sizes, ' + buf.length + ' bytes');
