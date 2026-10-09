//@ Co Engine, part 45: the game's tuning tables. CO.table(name, obj, desc) registers a live table (prices, the economy, the ladder, the faults a car comes in with); CO.tune({ name: { 'path.to.field': value } }) holds the overrides the editor's Settings tab saved (src/00-tables.js, which runs first) and applies them the moment the table registers. The editor edits the leaves live.
  // ── Tuning tables ─────────────────────────────────────────────────
  var TABLES = {}, TABLE_ORDER = [], TUNE = {};
  function pathGet(o, p) { var k = String(p).split('.'); for (var i = 0; i < k.length; i++) { if (o == null) return undefined; o = o[k[i]]; } return o; }
  function pathSet(o, p, v) { var k = String(p).split('.'); for (var i = 0; i < k.length - 1; i++) { if (o[k[i]] == null) return false; o = o[k[i]]; } o[k[k.length - 1]] = v; return true; }
  // the leaves of a table worth editing: numbers, strings and booleans, by path, at most 400 of them
  function tableLeaves(obj) { var out = []; (function walk(o, pre, depth) { if (out.length >= 400 || depth > 5) return; Object.keys(o).forEach(function (k) { var v = o[k], p = pre ? pre + '.' + k : k; if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out.push({ path: p, value: v, type: typeof v }); else if (v && typeof v === 'object' && !v.isObject3D && !v.isMaterial && typeof v !== 'function') walk(v, p, depth + 1); }); })(obj, '', 0); return out; }
  CO.table = function (name, obj, desc) {
    if (!name) return TABLES; if (!obj || typeof obj !== 'object') return obj;
    if (!TABLES[name]) TABLE_ORDER.push(name);
    var defaults = {}; tableLeaves(obj).forEach(function (l) { defaults[l.path] = l.value; });
    TABLES[name] = { obj: obj, desc: desc || '', defaults: defaults };
    var t = TUNE[name]; if (t) for (var p in t) pathSet(obj, p, t[p]);
    return obj;
  };
  CO.tune = function (overrides) { for (var n in overrides) { TUNE[n] = TUNE[n] || {}; for (var p in overrides[n]) { TUNE[n][p] = overrides[n][p]; if (TABLES[n]) pathSet(TABLES[n].obj, p, overrides[n][p]); } } return TUNE; };
  function tablesList() { return TABLE_ORDER.map(function (n) { var T = TABLES[n]; return { name: n, desc: T.desc, fields: tableLeaves(T.obj).map(function (l) { return { path: l.path, value: l.value, type: l.type, changed: T.defaults[l.path] !== undefined && T.defaults[l.path] !== l.value, was: T.defaults[l.path] }; }) }; }); }
  function tableSet(name, path, value) {
    var T = TABLES[name]; if (!T) return { error: 'no table ' + name }; var was = pathGet(T.obj, path); if (was === undefined) return { error: 'no field ' + path + ' in ' + name };
    var v = typeof was === 'number' ? +value : typeof was === 'boolean' ? (value === true || value === 'true') : String(value); if (typeof was === 'number' && isNaN(v)) return { error: 'a number, please' };
    pathSet(T.obj, path, v); TUNE[name] = TUNE[name] || {}; if (T.defaults[path] === v) delete TUNE[name][path]; else TUNE[name][path] = v;
    hudDirty = true; screenDirtyAll();
    histPush(name + '.' + path, function () { pathSet(T.obj, path, was); if (T.defaults[path] === was) delete TUNE[name][path]; else TUNE[name][path] = was; hudDirty = true; screenDirtyAll(); }, function () { pathSet(T.obj, path, v); if (T.defaults[path] === v) delete TUNE[name][path]; else TUNE[name][path] = v; hudDirty = true; screenDirtyAll(); });
    return { ok: true, value: v };
  }
  function tablesCode() {
    var out = {}, any = false; for (var n in TUNE) { var keys = Object.keys(TUNE[n]); if (keys.length) { out[n] = TUNE[n]; any = true; } }
    if (!any) return '';
    return '//@ the tuning the editor saved: changes to the game\'s tables (prices, the economy, the ladder) over what the code says. Written by the Co Engine editor\'s Settings tab; it sorts first in src/ and applies as each table registers.\n  CO.tune(' + JSON.stringify(out, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
