// The engine's smoke: `npm test`. Boots the sample room (tests/sample) in a hidden Electron window and runs tests/sample.smoke.js in it.
'use strict';
const path = require('path');
const { run } = require('../tools/smoke-runner');
run({ page: path.join(__dirname, 'sample', 'index.html'), handle: 'CO_SAMPLE', userDataPrefix: 'co-engine-test', scenarios: [{ name: 'the sample room', body: require('./sample.smoke.js') }] });
