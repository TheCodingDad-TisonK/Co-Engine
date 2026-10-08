// The game's smoke: `npm test`. Boots the page in a hidden Electron window and runs tests/room.smoke.js in it.
'use strict';
const path = require('path');
const { run } = require('co-engine/tools/smoke-runner');
run({ page: path.join(__dirname, '..', 'index.html'), handle: 'CO_SAMPLE', userDataPrefix: 'a-new-game-test', scenarios: [{ name: 'the room', body: require('./room.smoke.js') }] });
