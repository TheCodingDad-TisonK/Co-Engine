# Inventory 05: tooling and shells (Depot Co = A, Grow Co = B)

Read-only pass on 2026-10-08. Repos: `Depot Co` (A, v1.21.0) and `RF Grow Co` (B, v1.28.3). Every file named below was read in full, except the bodies of A's seven scenario files (head and tail of each) and B's 17 test bodies (two read).

## 1. Per-file comparison

| file | A lines | B lines | diff summary | verdict |
|---|---|---|---|---|
| tools/build-game.js | 47 | 108 | Both join `src/NN-*.js` in name order into one closure, drop `//@` lines, refuse a top-level function declared twice, and offer `--check`. B adds two build flavours: `.desk.js`/`.shop.js` parts, `//#if desk|shop ... //#else ... //#endif` blocks, a desk copy through `.desk-path`/`GROWCO_DESK`, a SHARED list of files copied to the desk, and `--stdout`. A has the stronger duplicate-function regex `^(?:  \|\}\s+)function`, which also catches a declaration after a closing brace on the same line (the 1.18.1 tableBuild bug). B's `^  function` misses that case. | Engine with a parameter. Take B's structure and port A's regex into it. Game-specific: the output file (`game/depot.js` / `game/grow3d.js`), the flavour list (none / desk+shop), the SHARED copy list, and the desk-path env var name. |
| tools/lint-gate.js | 106 | 106 | Byte-identical except one comment that names the bundle file. Scans `game/*.js` for control characters, `\n` inside `//` comments, and en or em dashes in string literals. | Engine as-is (either copy). The scanned directory can be a parameter, default `game/`. |
| tools/sync-version.js | 6 | 4 | Same job. A writes only when the content changed. B writes every time. The global differs: `window.DEPOT_VERSION` vs `window.RF_VERSION`. | Engine with a parameter: the version global name. Take A (write-if-changed). |
| tools/make-icon.js | 6 | 4 | png-to-ico from one PNG into `build/icon.ico`. A reads `game/logo.png` and is called by A's `icon`/`installer` scripts. B reads `game/rf-icon.png`, handles `mod.default \|\| mod`, and no script calls it, because B's render-brand writes the ico itself. | Drop from the engine. render-brand (B) covers it. |
| tools/render-brand.js | 51 | 62 | Different designs. A draws the logo and wordmark on a canvas inside the script (colours hardcoded: slate #1b232c, amber #f5b53d/#c8891f/#e0a02a, label #f3f4f6, subtitle #a0acb8; text "DEPOT" "CO." "FIRST-PERSON WAREHOUSE SIMULATOR") and writes 3 PNGs. B screenshots `brand/icon.html` and `brand/wordmark.html` at 9 icon sizes (a simplified mark at 32 px and below) plus 3 wordmarks, copies the results into `game/`, and writes a 7-image ico. B also carries the `window-all-closed` fix (CI once shipped the stock Electron icon). A's current ico holds 4 images; B's holds 7. | Engine as-is, take B. The brand pages `brand/icon.html` and `brand/wordmark.html` become game assets that hold the colours and text. A has to port its canvas drawing into those two pages. |
| tools/serve.js | 9 | 9 | Identical except the port (8430 / 8420) and the name in the log line. | Engine with a parameter: port and display name. |
| main.js (Electron shell) | 59 | 77 | Same shell: single-instance lock, maximized hidden-until-ready window, F11, Ctrl+Shift+I, Ctrl+R, http(s)-only external links, F12 PNG downloads saved under Pictures\<name>. A adds `--dev-link`, which loads with `?dev=1`. B adds `carryOldSavesOver()`, a one-time userData copy from "RF Grow Co" to "Grow Co". Background colours differ: #0b0f14 / #07110b. | Engine with a parameter: title ("Depot Co." / "Grow Co."), background colour, Pictures folder name, the dev-link flag on or off, and an optional list of legacy userData folders to migrate (B: `RF Grow Co`). |
| package.json | 62 | 70 | See section 2. The build section is structurally identical (nsis oneClick, per-user, x64, `files: main.js, game/**, package.json`). Differences: appId (`depotco` / `rfgrowco`), productName, shortcutName, artifactName (`Depot-Co-Setup-${version}.exe` / `Grow-Co-Setup-${version}.exe`). B adds repository and homepage fields and the `@electron/packager` devDependency. | Engine with a parameter: name, productName, appId, artifact prefix, description, repository. |
| .github/workflows/test.yml | 26 | 26 | Identical except the bundle name in a comment. | Engine as-is. |
| .github/workflows/release.yml | 41 | 40 | Identical, except A also runs `npm run devconsole:exe`, and the upload-artifact name differs (`Depot-Co-windows` / `Grow-Co-Setup`). | Engine with a parameter: artifact name and an optional extra-build step. |
| .github/workflows/wiki-sync.yml | 32 | 32 | Byte-identical. | Engine as-is. |
| .github/workflows/issue-triage.yml | none | 31 | B only. Labels player-report issues by area and severity from the form answers, tags `has-savegame`, assigns TheCodingDad-TisonK and thanks the reporter. The area map is Grow Co's (staff names, robberies, basement). | Engine with a parameter: the area map, the assignee and the thank-you text, read from a game data file. |
| tools/smoke.js (A runner) | 63 | none | See section 4. | Engine with a parameter (the runner core). The SCENARIOS list and OLD_SAVE are game-only. |
| tools/smoke-lib.js (A prologue) | 32 | none | See section 4. | Split: the generic part goes to the engine; mkOrder, quietDocks, clearOut, grabParcel, crewOff and climbTo stay with the game. |
| tools/smoke-{shed,small,hall,big,annex,far,old}.js | 93, 51, 42, 314, 45, 31, 17 | none | A's seven scenarios: stages 0 to 5, then the 1.20 migration. | Game-only. |
| tools/test/run.js (B runner) | none | 74 | See section 4. | Engine as-is, take B, as the base runner. |
| tools/test/preload.js (B) | none | 106 | Fake clock, fake timers, rAF stub, seeded Math.random, error capture, and the H helper set. Also a hardcoded DLC preset and Grow Co boot steps. | Split: the clock, seed, error capture and generic asserts go to the engine. The DLC preset and `boot()` details are game-only. |
| tests/*.test.js (B) | none | 17 files, about 1,260 lines | `test(name, async (h) => ...)` units. | Game-only. |
| tools/make-standalone.js | none | 58 | One-time converter from the desk build to the standalone, kept as a record. | Game-only history. Not in the engine. |
| tools/zip-dist.js | none | 5 | Zips the electron-packager output. Only the `dist` script path uses it; the release workflow does not. | Game-only, a candidate to retire. |
| tools/standalone-polish.js | none | 10 | Second one-time conversion pass, kept as a record. | Game-only history. |
| tools/verify-icon.js (B, load-bearing) | none | 26 | Fails the build when `build/icon.ico` is missing, under 1000 bytes, has a bad header, or holds fewer than 4 sizes. It exists because v1.3 to v1.8 shipped the stock Electron icon. | Engine as-is, take B. |

Other tools seen but not compared: A `shots.js` and `drivemap.js` (game-only playtest tools). B `balance/` (game-only, feeds a test), `report-relay/` (optional Cloudflare worker, could become engine later), `decode-report.js` (engine candidate if A adopts B's bug-report form), and `guide-to-md.js`, `docs-update-v1.js`, `wire-report-and-slots.js` (game-only or history).

**A's tools/devconsole/** (B has no equivalent):
- `server.js` (49 lines): a dependency-free Node HTTP and SSE server on 127.0.0.1:8432. The game side uses `/events`, `POST /state` and `POST /result`; the console side uses `/`, `/state`, `/ui` and `POST /cmd`. Answers CORS. Game-agnostic.
- `main.js` (36 lines): the Electron window that starts the server and shows the page. Its own app name and userData so it does not share the game's single-instance lock. Port from `DEPOT_DEV_PORT`.
- `index.html` (95 lines): the console UI. Game-specific: about 34 `data-cmd` buttons (truckin, setStage, tpBench, fork and so on) and readout fields (level, site, bank).
- `selftest.js` (55 lines): a no-Electron round trip with a fake game on the stream (command, readout, result, CORS, 404). Run by A's `npm test`.
- `builder.json` (35 lines): electron-builder config for a portable exe, `Depot-Co-DevConsole-${version}.exe`.

Engine view: `server.js` and `selftest.js` as-is; `main.js` and `builder.json` with parameters (name, port env var); `index.html` as an engine shell plus a game-provided command list. The game half lives in A's `src/14-devlink.js`.

## 2. package.json scripts side by side

| script | A (Depot Co) | B (Grow Co) |
|---|---|---|
| start | `electron .` | `electron .` |
| serve | `node tools/serve.js` | same |
| build | `build-game.js && sync-version.js` | `build-game.js` only (no version stamp) |
| version | none | `sync-version.js` |
| check | build-game --check, sync-version, lint-gate, `node --check` on depot.js, menu.js, main.js | the same chain with `node --check` on 6 game files plus main.js |
| test | build-game --check, devconsole selftest, `electron tools/smoke.js` | build-game --check, `electron tools/test/run.js` |
| brand | `electron tools/render-brand.js` | same |
| icon | `node tools/make-icon.js` | `electron tools/render-brand.js` (same command as brand) |
| installer | check, brand, icon, electron-builder nsis | check, icon (render-brand), verify-icon, electron-builder nsis |
| dist / zip | none | electron-packager with a long ignore list / zip-dist |
| dev | `electron . --dev-link` | none |
| devconsole / devconsole:exe | Electron console / portable exe | none |
| guide / balance | none | guide-to-md / balance report |

Notes:
- The name `icon` means different things in the two games.
- A's installer has no icon gate.
- B's `build` leaves `version.js` stale until `check` or `version` runs.
- Both hand-list their `node --check` targets, so a new game file can go unchecked.

**Proposed engine-provided set** (a game inherits these; `co` is the engine's bin or a path into it):
- `start`: `electron .`
- `dev`: `electron . --dev-link` (no-op unless the game ships the devlink part)
- `serve`: `co serve`
- `build`: `co build-game && co sync-version`
- `check`: `co build-game --check && co sync-version && co lint-gate && co check-syntax`. Here `check-syntax` runs `node --check` on every top-level `game/*.js` (not vendor/) plus `main.js`, which replaces the hand-kept lists.
- `test`: `co build-game --check && co test` (the devconsole selftest is included when the game opts into the devconsole)
- `brand`: `electron <engine>/tools/render-brand.js`
- `installer`: `npm run check && npm run brand && co verify-icon && electron-builder --win nsis --x64 --publish never`
- `devconsole` and `devconsole:exe`: opt-in

Game-only scripts stay in each game's package.json: B's `guide` and `balance`. B's `dist` and `zip` should retire (the release ships only the nsis installer). `icon` should be dropped as a separate verb.

## 3. Workflows

What runs today (identical in both unless noted):
- **Push to main:** `test.yml` (windows-latest, Node 20, `npm ci`, `npm run check`, `npm test` with CI=true, 20 minute timeout). `wiki-sync.yml` runs too when `docs/**` or the workflow itself changed (ubuntu, rsyncs docs/ into the wiki repo, commits as github-actions[bot]).
- **Pull request:** `test.yml`.
- **Tag `v*`:** `release.yml`. It checks the tag against package.json (accepts `vX.Y.Z`, or `vX.Y` when the patch is 0), runs `npm run installer`, uploads `dist/*.exe` as an artifact, and attaches it to a GitHub release with generated notes. A also builds and attaches the dev console portable exe.
- **Issue opened:** `issue-triage.yml` (B only).
- **Manual (workflow_dispatch):** test, release, wiki-sync.

**Proposed shared pair** for the engine template:
- `test.yml`: as-is, with the comment made generic.
- `release.yml`: as-is, with the artifact name taken from productName, plus one optional input or env `EXTRA_BUILD` (A sets `npm run devconsole:exe`). Upload `dist/*.exe` as today.

Ship `wiki-sync.yml` unchanged as a third file. Ship `issue-triage.yml` as an opt-in fourth that reads its area map, assignee and thank-you text from a game data file such as `.github/triage.json`, so the script stays shared.

## 4. Test harness

Shared ground: both runners use one hidden 1280x720 Electron window, a temp userData folder (`depotco-test-` / `growco-test-`), the swiftshader switch, hardware acceleration off under CI, and code injected with `executeJavaScript`.

**A (scenario chain):**
- 7 ordered scenarios. Each boots `game/index.html`, waits 1.2 s of real time, and runs one long body.
- State carries across the reloads: the shed plays a fresh save to level 5 and sleeps, and the next scenario boots whatever save that left in `depotco-slot1`.
- "Seed" means a seed *save*: OLD_SAVE for the migration scenario, or a bare stage save `{site, siteDue, level, bank, up}` when a scenario runs alone (`stage=N`, `file=` for bisecting). Math.random is not seeded, so a run is not reproducible draw for draw.
- Time is real. The sim advances through `T.run(sec)`, a synchronous loop of `tickWorld(0.05)`; the prologue throws if one call takes over 60 s of real time.
- The window is sandboxed with context isolation on and no preload.
- Page errors are caught by `console-message` level 2 and above, plus `render-process-gone`.
- `ok()` records and carries on, so one run lists every failure.
- The epilogue returns draw counts, the save and `rebuildPending`, and the runner notes when no rebuild was pending.
- Timeout is 240 s per scenario (`SMOKE_TIMEOUT`). On a timeout the runner reads `window.__smoke` to show the last checks reached.
- The T handle is `window.DEPOT.T`, with `DEPOT.enter()` and `DEPOT.bootSlot`. S is a Proxy over `T.S`, because `T.load()` swaps the state object.
- The prologue gives `ok`, `info`, `mkOrder`, `quietDocks`, `clearOut`, `grabParcel`, `crewOff` and `climbTo`.
- Scenario bodies are template literals, which forces the "no `\'` in the scenario" rule.

**B (isolated units):**
- 17 files of `test(name, fn)` calls. Names are discovered with `new Function`, and each test runs on a fresh page.
- The runner goes to `about:blank` first, so the outgoing save cannot leak into the next test, then clears localStorage and IndexedDB, then loads `?save=test&seed=<FNV-1a of file/name>`.
- `preload.js` (context isolation off) installs a fake Date, fake setTimeout/setInterval, a dead rAF, the seeded Math.random, and error capture (window error, unhandledrejection, console.error). It also force-enables every DLC.
- Time moves only through `h.frame` and `h.step` (50 ms per frame, `stepFrame()`). `boot()` clicks the start button, stubs `renderer.render`, and suppresses customers and events.
- Asserts throw (`ok`, `eq`, `near`, `until`), so the first failure ends the test.
- Timeout is 120 s per test.
- The filter is a substring of file plus test name. `TEST_VERBOSE` lengthens stacks. `// @include` pulls repo files into the page.
- Handles: `h.R` = `window.RFGROW`, `h.S`, `h.T` = `RFGROW.test`, `h.I` = `RFGROW.internal`.

**A shared engine smoke-lib would carry:**
1. **The runner core:** temp userData, GPU switches, the hidden window, the union of both error nets, per-unit timeout with a partial-progress readout, filtering, the summary and the exit code.
2. **Two modes:** "isolated" (B's flow: blank, clear storage, `?save=test&seed=`) and "chain" (A's flow: ordered units, a reload between them, the save carried or seeded into a named slot key).
3. **An opt-in deterministic preload:** fake clock and timers, seeded random, error capture. Opt-in because A's boot and its real-time waits have not been run under it.
4. **The generic asserts:** both styles (collecting `ok`/`info`, and throwing `eq`/`near`/`until`), plus `frame`/`step` bound to a game-declared step function, `random()` pinning, key and mouse dispatch, and A's live-state Proxy.
5. **Loading bodies from source text** (B's method) instead of template literals, which retires A's `\'` rule.
6. **A declared handle contract:** each game names its namespace (`DEPOT` / `RFGROW`), its state getter, its test handle, its step function (`T.run` / `stepFrame`), its boot function (`enter()` / the start button) and its save key prefix.

**Stays game scenario:** every scenario and test body, OLD_SAVE and the stage-seed builder, and A's domain helpers (`mkOrder`, `quietDocks`, `clearOut`, `grabParcel`, `crewOff`, and `climbTo` unless a level ladder moves into the engine). B's `arrive`, `validIds`, `patience`, `hold`, the DLC preset, and the details inside `boot()` also stay.

## Summary

1. lint-gate, serve, test.yml, wiki-sync and the electron-builder layout are already the same code in both games and can move to the engine almost unchanged.
2. build-game, main.js, sync-version and release.yml differ only by values: names, bundle file, port, colours, version global, artifact names. B's build-game is the superset, but A's duplicate-function regex has to go into it.
3. For the brand step, B's HTML-page approach plus verify-icon should be the engine's. A's inline canvas drawing has to become `brand/*.html`, and make-icon goes away.
4. The two test harnesses differ in design: A chains real-time scenarios across reloads with save seeds, while B runs isolated units on a fake clock with seeded random. The engine runner should offer both modes behind one handle contract.
5. A's devconsole is a clean, game-agnostic server with a self-test and a game-specific page, so it can be an opt-in engine module. B's standalone converters and zip path are history and stay out.

**Engine tools/ on day one:**
- `tools/build-game.js` (B's flavours plus A's regex, configured per game)
- `tools/lint-gate.js`
- `tools/check-syntax.js` (new; replaces the hand-listed `node --check` chains)
- `tools/sync-version.js` (A's write-if-changed, with a parameterized global)
- `tools/serve.js`
- `tools/render-brand.js` (B's)
- `tools/verify-icon.js` (B's)
- `tools/test/run.js` (runner with isolated and chain modes)
- `tools/test/preload.js` (opt-in clock, seed and error capture)
- `tools/test/smoke-lib.js` (generic prologue, asserts, live-state Proxy)
- `tools/devconsole/server.js`, `main.js`, `selftest.js`, `builder.json` (opt-in, parameterized)
- `shell/main.js` (the Electron shell, parameterized) and the template workflows `test.yml`, `release.yml`, `wiki-sync.yml`, `issue-triage.yml`
