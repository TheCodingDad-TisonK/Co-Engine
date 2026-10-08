//@ Co Engine, part 26: the day, the seasons, the weather, the sky and the light by the hour
  // ── The clock ─────────────────────────────────────────────────────
  // S.day and S.time (hours, 0 to 24) are the game's; the engine reads them. A week is CAL.week days, a season CAL.season days.
  var CAL = { week: 7, season: 7, seasons: ['spring', 'summer', 'autumn', 'winter'], dayStart: 6 };
  function nowAbs() { return (S ? (S.day || 1) * 24 + (S.time || 0) : 0); }
  function season() { return Math.floor((((S && S.day || 1) - 1) % (CAL.season * CAL.seasons.length)) / CAL.season); }
  function seasonName() { return CAL.seasons[season()]; }
  function weekday() { return ((S && S.day || 1) - 1) % CAL.week; }
  function isSunday() { return (S && S.day || 1) % CAL.week === 0; }
  // ── Weather ───────────────────────────────────────────────────────
  // S.weather = { kind, wet, snow, wind, until }. The table per season says how likely each kind is; a game may replace it on
  // WEATHER_TABLE. tickWeatherState(dt) rolls the weather on, wets and snows the ground, and flashes and thunders in a storm.
  var WEATHER_TABLE = {
    winter: [['snow', 0.32], ['overcast', 0.3], ['clear', 0.28], ['rain', 0.1]],
    summer: [['clear', 0.6], ['overcast', 0.18], ['rain', 0.12], ['storm', 0.1]],
    other: [['clear', 0.42], ['overcast', 0.26], ['rain', 0.22], ['storm', 0.1]]
  };
  var WEATHER_WORDS = { rain: 'Rain on the roof.', storm: 'A storm is rolling in.', snow: 'Snow. It will be slow outside.', overcast: 'Clouds have come over.', clear: 'The sky has cleared.' };
  var weatherFlash = 0;
  function pickWeather(first) {
    var table = WEATHER_TABLE[seasonName()] || WEATHER_TABLE.other, r = Math.random(), acc = 0, kind = table[table.length - 1][0];
    for (var i = 0; i < table.length; i++) { acc += table[i][1]; if (r < acc) { kind = table[i][0]; break; } }
    var prev = S.weather ? S.weather.kind : null;
    S.weather = { kind: kind, wet: S.weather ? S.weather.wet : 0, snow: S.weather ? S.weather.snow : 0, wind: kind === 'storm' ? randf(0.8, 1.2) : kind === 'clear' ? randf(0.1, 0.4) : randf(0.3, 0.7), until: nowAbs() + randf(2.5, 8) };
    if (!first && prev !== kind) logEvent(WEATHER_WORDS[kind] || kind, kind === 'storm' ? 'bad' : '');
    runHooks('weather', kind, prev);
  }
  function indoors(x, z) { return CO.game && CO.game.indoors ? CO.game.indoors(x, z) : false; }
  function tickWeatherState(dt) {
    if (!S.weather) pickWeather(true);
    var W = S.weather;
    if (nowAbs() > W.until) pickWeather(false);
    var raining = W.kind === 'rain' || W.kind === 'storm';
    W.wet = clamp(W.wet + (raining ? dt / 50 : -dt / 260), 0, 1);
    W.snow = clamp(W.snow + (W.kind === 'snow' ? dt / 90 : seasonName() === 'winter' ? -dt / 1200 : -dt / 200), 0, 1);
    if (W.kind === 'storm' && Math.random() < dt * 0.06) { weatherFlash = 1; var delay = randf(300, 1800); setTimeout(function () { sfx('thunder'); }, delay); }
    weatherFlash *= Math.max(0, 1 - 6 * dt); CO.flash = weatherFlash;
    var inside = player ? indoors(player.x, player.z) : true;
    ambience(raining ? (inside ? 0.05 : 0.14) * (W.kind === 'storm' ? 1.4 : 1) : 0);
  }
  // a looping band of filtered noise is the rain; its level follows whether you are under a roof
  var amb = { gain: null, src: null, want: 0 };
  function ambience(level) {
    amb.want = level;
    if (!AC) return;
    if (!amb.src) { var len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; var src = AC.createBufferSource(); src.buffer = buf; src.loop = true; var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; var g = AC.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); amb.src = src; amb.gain = g; }
    amb.gain.gain.setTargetAtTime(SET && SET.sound !== false ? level : 0, AC.currentTime, 0.4);
  }
  // ── The sky ───────────────────────────────────────────────────────
  // a dome with a zenith-to-horizon gradient, a sun and a moon that ride opposite each other, clouds that drift with the wind,
  // and the rain and snow as point clouds round the camera. buildSky(opt) makes them; tickSky(dt) moves them.
  var sky = { dome: null, mat: null, sunDisc: null, moon: null, clouds: [], rain: null, snow: null, windT: 0, y: 0, rainN: 7000, snowN: 3000 };
  function cloudTex() { return tex(256, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 14; i++) { var r = randf(18, 42), x = randf(r, w - r), y = randf(r * 0.6, h - r * 0.6); var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }); }
  function discTex(col) { return tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(0.45, col); g.addColorStop(0.6, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }
  function buildSky(opt) {
    opt = opt || {}; sky.y = opt.y || 0;
    var skyMat = new THREE.ShaderMaterial({ uniforms: { top: { value: new THREE.Color(0x4f7fb8) }, mid: { value: new THREE.Color(0x8fb0d4) }, bot: { value: new THREE.Color(0xd6e2ec) } }, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vW; void main() { vW = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vW; void main() { float h = clamp(vW.y, -0.05, 1.0); vec3 c = h < 0.12 ? mix(bot, mid, smoothstep(-0.05, 0.12, h)) : mix(mid, top, pow(smoothstep(0.12, 1.0, h), 0.6)); gl_FragColor = vec4(c, 1.0); }' });
    var dome = new THREE.Mesh(new THREE.SphereGeometry(opt.radius || 230, 32, 16), skyMat); dome.position.y = sky.y; dome.renderOrder = -10; dome.userData.noBake = true; dome.frustumCulled = false; scene.add(dome); sky.dome = dome; sky.mat = skyMat;
    var sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(255,244,214,1)'), transparent: true, depthWrite: false, fog: false })); sunSp.scale.set(26, 26, 1); scene.add(sunSp); sky.sunDisc = sunSp;
    var moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(225,230,240,0.9)'), transparent: true, depthWrite: false, fog: false })); moonSp.scale.set(12, 12, 1); scene.add(moonSp); sky.moon = moonSp;
    var ct = cloudTex();
    for (var k = 0; k < (opt.clouds === undefined ? 10 : opt.clouds); k++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85, fog: false })); var s = randf(50, 90); sp.scale.set(s, s * 0.5, 1); sp.position.set(randf(-150, 150), randf(70, 100), randf(-150, 150)); scene.add(sp); sky.clouds.push({ sp: sp, v: randf(0.6, 1.4) }); }
    if (opt.precipitation !== false) {
      var streak = tex(16, 64, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(210,225,240,0)'); g.addColorStop(0.5, 'rgba(210,225,240,0.9)'); g.addColorStop(1, 'rgba(210,225,240,0)'); c.fillStyle = g; c.fillRect(6, 0, 4, h); });
      var flake = tex(32, 32, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
      var mkPoints = function (n, size, map, range) { var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); for (var i = 0; i < n; i++) { pos[i * 3] = randf(-range, range); pos[i * 3 + 1] = randf(0, 16); pos[i * 3 + 2] = randf(-range, range); } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); var pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: map, size: size, transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.05 })); pts.visible = false; pts.frustumCulled = false; scene.add(pts); return pts; };
      sky.rainN = opt.rainN || 7000; sky.snowN = opt.snowN || 3000;
      sky.rain = mkPoints(sky.rainN, 0.26, streak, 24); sky.rain.material.opacity = 0.5; sky.rain.material.color.setHex(0xc7d3de); sky.snow = mkPoints(sky.snowN, 0.22, flake, 30);
    }
    return sky;
  }
  // the height of whatever is over a point: 0 outdoors, a roof height under a roof. The game answers CO.game.roofAt(x, z).
  function roofAt(x, z) { return CO.game && CO.game.roofAt ? CO.game.roofAt(x, z) : 0; }
  function tickSky(dt) {
    sky.windT += dt;
    var W = S && S.weather || { kind: 'clear', wet: 0, snow: 0, wind: 0.4 }, t = S ? S.time || 12 : 12;
    if (sky.dome) { sky.dome.position.x = camera.position.x; sky.dome.position.z = camera.position.z; }
    sky.clouds.forEach(function (c) { c.sp.position.x += c.v * dt * (0.5 + W.wind); if (c.sp.position.x > camera.position.x + 150) c.sp.position.x = camera.position.x - 150; });
    if (sky.sunDisc && sun) { _v.copy(sun.position).sub(sun.target.position).normalize(); var elv = Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1)); sky.sunDisc.position.copy(_v).multiplyScalar(200).add(camera.position); sky.sunDisc.material.opacity = clamp(elv * 4, 0, 1); sky.moon.position.copy(_v).multiplyScalar(-200).add(camera.position); sky.moon.position.y = Math.abs(sky.moon.position.y - camera.position.y) + camera.position.y + 20; sky.moon.material.opacity = clamp(0.9 - elv * 4, 0, 0.9); }
    var raining = W.kind === 'rain' || W.kind === 'storm', snowing = W.kind === 'snow', px = player ? player.x : camera.position.x, pz = player ? player.z : camera.position.z;
    if (sky.rain) {
      sky.rain.visible = raining; sky.snow.visible = snowing;
      if (raining) { var p = sky.rain.geometry.attributes.position.array, pn = Math.min(p.length, (CO.rainN || sky.rainN) * 3); for (var r = 0; r < pn; r += 3) { p[r + 1] -= (9 + (W.kind === 'storm' ? 4 : 0)) * dt; var roofY = roofAt(p[r], p[r + 2]); if (p[r + 1] < roofY + sky.y || Math.abs(p[r] - px) > 26 || Math.abs(p[r + 2] - pz) > 26) { p[r] = px + randf(-24, 24); p[r + 2] = pz + randf(-24, 24); var rf = roofAt(p[r], p[r + 2]); p[r + 1] = randf(rf ? rf + 0.6 : 6, 16); } } sky.rain.geometry.attributes.position.needsUpdate = true; }
      if (snowing) { var q = sky.snow.geometry.attributes.position.array, qn = Math.min(q.length, (CO.snowN || sky.snowN) * 3); for (var s = 0; s < qn; s += 3) { q[s + 1] -= 1.3 * dt; q[s] += Math.sin(sky.windT + s) * 0.4 * dt; var ry = roofAt(q[s], q[s + 2]); if (q[s + 1] < ry + sky.y || Math.abs(q[s] - px) > 32 || Math.abs(q[s + 2] - pz) > 32) { q[s] = px + randf(-30, 30); q[s + 2] = pz + randf(-30, 30); var sf = roofAt(q[s], q[s + 2]); q[s + 1] = randf(sf ? sf + 0.6 : 6, 16); } } sky.snow.geometry.attributes.position.needsUpdate = true; }
    }
    var overcast = raining ? 0.75 : snowing ? 0.6 : W.kind === 'overcast' ? 0.5 : 0;
    var cday = 0.12 + 0.88 * Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1)); sky.clouds.forEach(function (c) { c.sp.material.color.setScalar((1 - overcast * 0.55) * cday); c.sp.material.opacity = 0.5 + overcast * 0.5; });
    runHooks('sky', W, dt);
  }
  // ── Light by the hour ─────────────────────────────────────────────
  // the sun's angle, colour and strength, the sky bounce, the sky and fog colours, and the lamp materials follow S.time and the
  // weather. The game lights its own lamps in the 'lighting' hook, which gets (day, dawn, overcast, power) each tick.
  var skyNight = new THREE.Color(0x0b1020), skyDawn = new THREE.Color(0xd9916b), skyDay = new THREE.Color(0x8fb0d4), skyOvercast = new THREE.Color(0x6b7482), skyTmp = new THREE.Color(), lightT = 0;
  function powered() { return CO.game && CO.game.powered ? CO.game.powered() : true; }
  function lighting(dt) {
    lightT += dt; if (lightT < 0.1) return; lightT = 0;
    var t = S ? S.time || 12 : 12, day = clamp((t - 5.5) / 1.5, 0, 1) * clamp((21.5 - t) / 1.5, 0, 1), dawn = Math.max(0, 1 - Math.abs(t - 6.5) / 1.5) + Math.max(0, 1 - Math.abs(t - 20.5) / 1.5);
    var az = Math.PI * (t - 6) / 16, elev = Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1));
    var W = S && S.weather || { kind: 'clear' }, overcast = W.kind === 'overcast' ? 0.45 : W.kind === 'rain' ? 0.65 : W.kind === 'storm' ? 0.85 : W.kind === 'snow' ? 0.55 : 0;
    sun.position.set(Math.cos(az) * 60, 8 + elev * 80, 30 + Math.sin(az) * 20); sun.position.add(sun.target.position); sun.intensity = Math.max(0, elev) * 1.15 * (0.6 + 0.4 * day) * (1 - overcast * 0.8) + weatherFlash * 2.5;
    sun.color.setHSL(0.09, dawn * 0.6 * (1 - overcast), 0.95 - dawn * 0.15);
    skyTmp.copy(skyNight).lerp(skyDay, day); if (dawn > 0) skyTmp.lerp(skyDawn, dawn * 0.5 * (1 - day * 0.3));
    if (overcast) skyTmp.lerp(skyOvercast, overcast * day * 0.8); if (weatherFlash > 0.05) skyTmp.lerp(new THREE.Color(0xffffff), weatherFlash * 0.7);
    if (scene.background && scene.background.isColor) scene.background.copy(skyTmp); if (scene.fog) { scene.fog.color.copy(skyTmp); scene.fog.near = 70 - overcast * 30; scene.fog.far = 190 - overcast * 90; }
    if (sky.mat) { sky.mat.uniforms.top.value.copy(skyTmp).multiplyScalar(0.62 + overcast * 0.25); sky.mat.uniforms.mid.value.copy(skyTmp); sky.mat.uniforms.bot.value.copy(skyTmp).lerp(new THREE.Color(0xffffff), 0.4 * day * (1 - overcast * 0.5)); }
    hemi.intensity = 0.12 + day * 0.35 * (1 - overcast * 0.5) + weatherFlash;
    var power = powered();
    MAT.lamp.color.setHex(power ? 0xfff6e4 : 0x3a3a3a); MAT.skylight.color.setHex(0xffffff); MAT.skylight.color.multiplyScalar(0.04 + day * 0.96);
    runHooks('lighting', day, dawn, overcast, power);
  }
  // The sun's shadow map is a second full pass over every caster, so it is not redrawn every frame. It is redrawn four times a
  // second, at once when something flagged it dirty, and every frame while the game says something big is moving (CO.game.shadowLive()).
  function shadowTick(dt) {
    if (!renderer.shadowMap.enabled) return;
    shadowT += dt;
    var live = CO.game && CO.game.shadowLive ? CO.game.shadowLive() : false;
    if (shadowDirty || live || shadowT > 0.25) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowT = 0; }
  }
