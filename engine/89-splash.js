//@ Co Engine, part 89: the made-with splash. The game's index.html paints #co-splash as plain markup (the snippet sits in the
  // ── The made-with splash ─────────────────────────────────────────
  // template's index.html) so it is on screen from the first paint, before any script has run, ahead of the game's own splash
  // or start screen. This part plays it: it fills in the version line, holds the screen for a beat once the boot is done, or
  // gives it up the moment a click or a key arrives, fades it out, and fires the 'co-splash-end' hooks. A game whose own splash
  // script sits outside the closure (a menu.js) waits on window.coSplashWait(fn), which also answers at once when the page
  // mounts no #co-splash at all — so the games this part predates are left exactly as they were.
  var coSplash = document.getElementById('co-splash'), coSplashWaits = [];
  var coSplashDone = false;
  function coSplashFast() {   // a flagged reload skips the brand beat: a slot switch, a save import, 'start over', a quit to the menu — and the editor's viewport
    try { var p = CO.save && CO.save.prefix; if (p && (sessionStorage.getItem(p + '-skip-splash') === '1' || sessionStorage.getItem(p + '-autoplay') === '1')) return true; } catch (e) {}
    return /[?&]editor=1/.test(location.search);
  }
  function coSplashEnd() {
    if (coSplashDone) return;
    coSplashDone = true;
    window.removeEventListener('click', coSplashEnd, true);
    window.removeEventListener('keydown', coSplashEnd, true);
    if (coSplash) {
      if (coSplashFast()) { if (coSplash.parentNode) coSplash.parentNode.removeChild(coSplash); }
      else { coSplash.classList.add('co-splash-out'); setTimeout(function () { if (coSplash.parentNode) coSplash.parentNode.removeChild(coSplash); }, 600); }
    }
    runHooks('co-splash-end', null);
    while (coSplashWaits.length) setTimeout(coSplashWaits.pop(), 0);
  }
  function coSplashWait(fn) { if (typeof fn !== 'function') return; if (coSplashDone) setTimeout(fn, 0); else coSplashWaits.push(fn); }
  window.coSplashWait = coSplashWait;
  if (coSplash) {
    var coSplashVer = coSplash.querySelector('.co-splash-ver');
    if (coSplashVer) coSplashVer.textContent = 'v' + CO.version;
    var coSplashAuthor = coSplash.querySelector('.co-splash-author');
    if (coSplashAuthor) coSplashAuthor.textContent = 'by TheCodingDad';
    window.addEventListener('click', coSplashEnd, true);
    window.addEventListener('keydown', coSplashEnd, true);   // any click or key hands the screen back early
  }
  hook('boot', function () { if (coSplash && !coSplashDone) setTimeout(coSplashEnd, coSplashFast() ? 0 : 700); });
