//@ Co Engine, part 44: UI as data. CO.ui({ hud, panels, start, menuLine, guide }) describes HUD chips, panels with text and buttons, the start screen chips, the pause menu's line and the guide, without code: each value is an expression over the kit (S, money, fmtTime ...). The editor's UI tab edits it and writes src/00-ui.js. A game's own GAME.hud, GAME.panel, GAME.startStats, GAME.menuLine and GAME.guideHtml still win where they exist.
  // ── UI as data ────────────────────────────────────────────────────
  // hud: [{ label, value, color }]           chips in a row of their own under the engine's (value is an expression: 'S.day', 'money(S.bank)')
  // panels: { kind: { title, text, buttons: [{ label, action, primary }] } }   openPanel(kind) shows it; text is paragraphs and '- ' lists; an action is a dev command ('cash 500') or an expression
  // start: ['expression', ...]               the start screen's chips    menuLine: 'expression'    guide: 'text'
  var UI = { hud: [], panels: {}, start: [], menuLine: '', guide: '' }, uiFns = {};
  CO.ui = function (data) { if (!data) return UI; if (data.hud) UI.hud = data.hud.slice(); if (data.panels) { UI.panels = {}; for (var k in data.panels) UI.panels[k] = data.panels[k]; } if (data.start) UI.start = data.start.slice(); if (data.menuLine !== undefined) UI.menuLine = data.menuLine; if (data.guide !== undefined) UI.guide = data.guide; uiFns = {}; hudDirty = true; uiHudBuild(); return UI; };
  function uiEval(expr) {
    if (expr === undefined || expr === null || expr === '') return '';
    var fn = uiFns[expr]; if (!fn) { try { fn = uiFns[expr] = new Function('K', 'with (K) { return (' + expr + '\n); }'); } catch (e) { return '?'; } }
    try { var v = fn(editorKit()); return v === undefined || v === null ? '' : String(v); } catch (e2) { return '?'; }
  }
  function uiAction(action) {
    if (!action) return false; var sp = String(action).indexOf(' '), name = sp < 0 ? action : action.slice(0, sp), arg = sp < 0 ? undefined : action.slice(sp + 1).trim();
    if (devCommandList().indexOf(name) >= 0) { if (arg !== undefined && arg !== '' && !isNaN(arg)) arg = +arg; var r = devCommand(name, arg); hudDirty = true; return r; }   /* the engine's dev commands and the game's */
    try { new Function('K', 'with (K) { ' + action + '\n }')(editorKit()); hudDirty = true; save(); return true; } catch (e) { toast('The button failed: ' + e.message, 'bad'); return false; }
  }
  // the HUD chips: a row of their own under the engine's top row, made once and filled on every HUD refresh
  function uiHudBuild() {
    var hud = $('dc-hud'); if (!hud) return null; var row = $('h-ui');
    if (!row) { row = document.createElement('div'); row.id = 'h-ui'; row.style.cssText = 'position:absolute;top:52px;left:12px;display:flex;gap:8px;flex-wrap:wrap;max-width:60vw;pointer-events:none;font:13px/1.3 inherit'; hud.appendChild(row); }
    row.innerHTML = UI.hud.map(function (f, i) { return '<span data-ui="' + i + '" style="background:rgba(5,8,12,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:5px 10px' + (f.color ? ';color:' + f.color : '') + '"><span style="opacity:.6;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-right:6px">' + esc(f.label || '') + '</span><b></b></span>'; }).join('');
    return row;
  }
  function uiHudFill() { if (!UI.hud.length) return; var row = $('h-ui') || uiHudBuild(); if (!row) return; var bs = row.querySelectorAll('b'); UI.hud.forEach(function (f, i) { if (bs[i]) bs[i].textContent = uiEval(f.value); }); }
  function uiTextHtml(text) { return String(text || '').split(/\n\s*\n/).map(function (para) { var lines = para.split('\n'); if (lines.every(function (l) { return /^\s*-\s/.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + esc(l.replace(/^\s*-\s/, '')) + '</li>'; }).join('') + '</ul>'; return '<p>' + esc(para).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function uiPanelSpec(kind) { var p = UI.panels[kind]; if (!p) return null; return { title: uiEval(p.titleExpr) || p.title || kind, tabs: [], body: '<div class="dc-how">' + uiTextHtml(p.text) + '</div>' + (p.buttons && p.buttons.length ? '<div class="dc-menu-row" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' + p.buttons.map(function (b, i) { return '<button class="dc-btn ' + (b.primary ? 'primary' : '') + '" data-act="ui" data-arg="' + esc(kind + ':' + i) + '">' + esc(b.label || 'Button') + '</button>'; }).join('') + '</div>' : '') }; }
  function uiPanelAct(arg) { var at = String(arg || '').lastIndexOf(':'), kind = arg.slice(0, at), i = +arg.slice(at + 1), p = UI.panels[kind], b = p && p.buttons && p.buttons[i]; if (!b) return false; var r = uiAction(b.action); if (b.close) closePanel(); else renderPanel(); if (typeof r === 'string') toast(r, ''); return true; }
  function uiStartChips() { return UI.start.map(uiEval).filter(Boolean); }
  function uiData() { return JSON.parse(JSON.stringify(UI)); }
  function uiCode() {
    var empty = !UI.hud.length && !Object.keys(UI.panels).length && !UI.start.length && !UI.menuLine && !UI.guide; if (empty) return '';
    return '//@ the UI the editor saved: HUD chips, panels, the start screen chips, the pause line and the guide, as data over the kit. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.\n  CO.ui(' + JSON.stringify(UI, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
