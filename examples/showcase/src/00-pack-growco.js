//@ Co Engine pack: Grow Co. Every prop the grow shop has (its counters, shelves, bins, vending and coffee machines, fridges, sofas, desks, screens, plants, racks, lockers and more), carried with the helpers, materials and textures they are drawn with, sealed in a scope of their own so nothing clashes with the game they land in. Shop logic stays behind: a prop that fills from the shop's stock stands empty, a machine you use says what it is. Generated from Grow Co's src/ by the Co Engine editor's pack tools; regenerate rather than edit.
  // the pack waits for the engine: a game part ahead of CO.setup runs it on the beforeBuild hook, the editor runs it at once
  var growcoPack = function (HOST_MAT, HOST_TEX) {
    // stand-ins for the shop systems the props reach for: harmless, empty, never saved
    var G_DEFS = {}, G_ORDER = [];
    var world = { group: CO.root || scene, interact: [], obstacles: [], lights: [], doors: [], fixtures: [], screens: [], reg: null, shelves: [], dyn: [] };
    var xs = function () { return { jobs: [], strains: [], stock: {}, flags: {}, owned: {}, upgrades: {}, dlc: {} }; };
    var dlcOn = function () { return true; }, dlcProp = function () { return true; }, unitIds = function () { return []; }, unitBase = function (id) { return id; };
    var drive = { on: false }, sec = { view: { on: false } }, deskBoard = { lastFetch: 0, data: null }, held = function () { return null; };
    var growDefProp = function (id, def) { G_DEFS[id] = def; G_ORDER.push(id); }, propExtra = function (id, fn) { var d = G_DEFS[id]; if (!d) return; var b = d.build; d.build = function (c, P) { b(c, P); try { fn(c, P); } catch (e) {} }; };
    var PROPS = G_DEFS, PROP_ORDER = G_ORDER;
    var G_FIX = [], fixtureFromBuild = function (id, label, yaw, fn) { G_FIX.push({ id: id, label: label, fn: fn }); }, fixtureAdd = function () {}, buildPos = function () {};
    // Grow's own carried code, in its part order
    /* 00-head.js */
    var money = function (n) { return '$' + Math.floor(n).toLocaleString('en-US'); };
    /* 00-head.js */
    var gram = function (n) { return (Math.round(n * 10) / 10) + 'g'; };
    /* 01-config.js */
    var STRAINS = [
        { id: 'sunflower', name: 'Sunflower Kush', emoji: '🌻', seed: 10,  growMs: 3600000, yield: 12, thc: 1.0, lvl: 1, bud: 0x7fc96b, hair: 0xffb347, leaf: 0x4caf50 },
        { id: 'amber',     name: 'Amber Haze',     emoji: '🍯', seed: 18,  growMs: 4320000, yield: 16, thc: 1.3, lvl: 2, bud: 0xa8c95a, hair: 0xff8c1a, leaf: 0x5cb85c },
        { id: 'widow',     name: 'Green Widow',    emoji: '🕸️', seed: 32,  growMs: 5040000, yield: 24, thc: 1.5, lvl: 4, bud: 0xd8e6c8, hair: 0xffd27f, leaf: 0x3d9a4a },
        { id: 'diesel',    name: 'Diesel Drift',   emoji: '⛽', seed: 48,  growMs: 5760000, yield: 18, thc: 1.9, lvl: 6, bud: 0x6fa85a, hair: 0xff5722, leaf: 0x2e7d32 },
        { id: 'runtz',     name: 'Rainbow Runtz',  emoji: '🌈', seed: 85,  growMs: 6480000, yield: 22, thc: 2.4, lvl: 9, bud: 0x9b6fd6, hair: 0xff69b4, leaf: 0x5a3f9e }
      ];
    /* 01-config.js */
    var strainById = function (id) { for (var i = 0; i < STRAINS.length; i++) if (STRAINS[i].id === id) return STRAINS[i]; return STRAINS[0]; };
    /* 01-config.js */
    var SUPPLIES = [
        { id: 'soil',      ico: '🪴', name: 'Bag of soil',      price: 4,  hint: 'One per planting' },
        { id: 'pot',       ico: '🫙', name: 'Grow pot',         price: 12, hint: 'A reusable grow slot' },
        { id: 'nutrients', ico: '🧪', name: 'Nutrients',        price: 6,  hint: 'Feed a plant: +yield, +quality' },
        { id: 'remedy',    ico: '🧴', name: 'Pest spray',       price: 9,  hint: 'Cures a pest or mould outbreak' },
        { id: 'bag',       ico: '🛍️', name: 'Baggies (×10)',    price: 8,  qty: 10, hint: 'Package eighths' },
        { id: 'paper',     ico: '📄', name: 'Papers (×20)',     price: 6,  qty: 20, hint: 'Roll joints' },
        { id: 'tip',       ico: '🚬', name: 'Filter tips (×20)', price: 4, qty: 20, hint: 'Roll joints' },
        { id: 'grinder',   ico: '⚙️', name: 'Grinder',          price: 60, tool: true, hint: 'Bought once. The workbench needs it to bag or roll' },
        { id: 'jar',       ico: '🏺', name: 'Curing jar',       price: 15, hint: 'One batch cures per jar, and two always can; the rest wait on the shelf' },
        { id: 'mix',       ico: '🍪', name: 'Cookie mix (6 cookies)', price: 8, hint: 'Bake edibles at the bench: one box + 1 g of stash' },
        { id: 'lighter',   ico: '🔥', name: 'Lighters (box of 20)', price: 10, qty: 20, stock: 'display', hint: 'Counter display · sells for $3' },
        { id: 'rpaper',    ico: '📄', name: 'Retail papers (×10)', price: 12, qty: 10, stock: 'display', hint: 'Counter display · sells for $4' },
        { id: 'rgrinder',  ico: '⚙️', name: 'Grinders (×5)',      price: 30, qty: 5,  stock: 'display', hint: 'Counter display · sells for $15' },
        { id: 'drink',     ico: '🥤', name: 'Drinks (case of 12)', price: 18, qty: 12, stock: 'vend', hint: 'Restock the vending machine' },
        { id: 'snack',     ico: '🍫', name: 'Snacks (box of 12)',  price: 15, qty: 12, stock: 'vend', hint: 'Restock the vending machine' },
        { id: 'cup',       ico: '🥡', name: 'Cups (sleeve of 50)', price: 10, qty: 50, stock: 'coffee', hint: 'For the lobby coffee machine' },
        { id: 'beans',     ico: '☕', name: 'Coffee beans (40 cups)', price: 30, qty: 40, stock: 'coffee', hint: 'For the lobby coffee machine' }
      ];
    /* 01-config.js */
    function supplyById(id) { for (var i = 0; i < SUPPLIES.length; i++) if (SUPPLIES[i].id === id) return SUPPLIES[i]; return null; }
    /* 01-config.js */
    function itemName(id) { if (id.indexOf('seed_') === 0) return strainById(id.slice(5)).name + ' seeds'; var it = supplyById(id); return it ? it.name.replace(/ \(.*\)$/, '') : id; }
    /* 01-config.js */
    function itemIcon(id) { if (id.indexOf('seed_') === 0) return strainById(id.slice(5)).emoji; var it = supplyById(id); return it ? it.ico : '📦'; }
    /* 01-config.js */
    function itemPack(id) { if (id.indexOf('seed_') === 0) return 5; var it = supplyById(id); return it && it.qty ? it.qty : 10; }
    /* 01-config.js */
    var LIGHTS = [
        { id: 'none', name: 'Windowsill', spd: 1.0,  qual: 0,  yld: 0.85, draw: 0,  price: 0,   color: 0xfff1d0, intensity: 0.0 },
        { id: 'cfl',  name: 'CFL lamp',   spd: 1.05, qual: 6,  yld: 0.95, draw: 0.8,  price: 60,  color: 0xfff4c8, intensity: 2.5 },
        { id: 'led',  name: 'LED panel',  spd: 1.12, qual: 12, yld: 1.15, draw: 1.8, price: 260, color: 0xd070ff, intensity: 4.5 },
        { id: 'hps',  name: 'HPS rig',    spd: 1.18, qual: 18, yld: 1.35, draw: 5.0, price: 800, color: 0xffb060, intensity: 6.0 },
        { id: 'qb',   name: 'Quantum board', spd: 1.26, qual: 26, yld: 1.55, draw: 3.6, price: 2600, color: 0xffe6ff, intensity: 7.5 },
        { id: 'array', name: 'Full-spectrum array', spd: 1.35, qual: 34, yld: 1.80, draw: 6.0, price: 7000, color: 0xfff8f0, intensity: 9.0 }
      ];
    /* 01-config.js */
    var TENTS = [
        { slots: 4,  price: 0,    cols: 2, rows: 2 },
        { slots: 6,  price: 240,  cols: 3, rows: 2 },
        { slots: 9,  price: 900,  cols: 3, rows: 3, lic: 'cult2' },
        { slots: 12, price: 2600, cols: 4, rows: 3, lic: 'cult2' },
        { slots: 16, price: 7000, cols: 4, rows: 4, lic: 'cult3' },
        { slots: 20, price: 16000, cols: 5, rows: 4, lic: 'cult3' }
      ];
    /* 01-config.js */
    var UPGRADES = [
        { id: 'autowater', ico: '💧', name: 'Auto-waterer',      price: 300, d: 'Plants never go thirsty again.' },
        { id: 'roller',    ico: '🤖', name: 'Rolling machine',   price: 360, d: 'Roll 5 joints at once, no paper/tip waste.' },
        { id: 'rack',      ico: '🗄️', name: 'Curing rack',       price: 220, d: 'Curing is 60% faster and reaches higher quality.' },
        { id: 'security',  ico: '🛡️', name: 'Security & sealing', price: 520, d: 'Halves the chance of pest and mould outbreaks.' },
        { id: 'dehumid',   ico: '🌬️', name: 'Industrial dehumidifiers', price: 320, d: 'Both units pull moisture twice as fast and can be set as low as 40%.' },
        { id: 'doser',     ico: '🧪', name: 'Nutrient doser',    price: 450, d: 'Every plant is fed automatically when it starts flowering.' },
        { id: 'trimmer',   ico: '✂️', name: 'Trimming machine',  price: 600, d: 'Cleaner harvests: +15% yield from every plant.' },
        { id: 'sign',      ico: '🪧', name: 'Neon sign & flyers', price: 380, d: 'Word gets round: customers turn up 35% more often.' },
        { id: 'lobby',     ico: '☕', name: 'Lobby coffee machine', price: 300, d: 'Customers wait 50% longer and tip a little rep.' },
        { id: 'robovac',   ico: '🤖', name: 'Robot vacuum',      price: 480, d: 'Dust builds up half as fast.' },
        { id: 'rack2',     ico: '🧊', name: 'Climate cure cabinet', price: 1800, req: 'rack', d: 'Curing 2.4× faster and +20 quality cap.' },
        { id: 'hydro',     ico: '💦', name: 'Hydroponic loop',   price: 4000, req: 'autowater', d: 'Plants grow 12% faster.' },
        { id: 'security2', ico: '📹', name: 'CCTV & alarms',     price: 2600, req: 'security', d: 'Outbreaks cut to a quarter.' },
        { id: 'panic',     ico: '🚨', name: 'Silent alarm',      price: 450, d: 'Press P during a robbery: police arrive in about 20 s and arrest whoever is still inside.' },
        { id: 'guardgun',  ico: '🦺', name: 'Armed guard',    price: 2400, d: 'Your guard carries a sidearm and stands up to armed robbers. Without it he almost never stops a gun. Only counts while you hold the firearms licence.' },
        { id: 'roller2',   ico: '🏭', name: 'Industrial roller', price: 1800, req: 'roller', d: 'Rolls 10 joints at a time.' },
        { id: 'hvac',      ico: '❄️', name: 'Climate control HVAC', price: 7000, req: 'dehumid', d: 'Humidity locks to target almost instantly and rooms run drier.' },
        { id: 'trimmer2',  ico: '🔪', name: 'Precision trimmer', price: 4200, req: 'trimmer', d: '+30% yield in total.' },
        { id: 'billboard', ico: '🛣️', name: 'Billboard & socials', price: 3600, req: 'sign', d: 'Customers turn up 60% more often in total.' },
        { id: 'lounge2',   ico: '🛋️', name: 'Lobby refit',       price: 2400, req: 'lobby', d: 'Customers wait twice as long and tip 2 rep.' },
        { id: 'genetics',  ico: '🧬', name: 'Genetics lab',      price: 12000, lvl: 8, d: 'Every new plant starts with +10 quality.' },
        { id: 'ownvan',    ico: '🚐', name: 'Own delivery van',  price: 16000, lvl: 6, d: 'Orders land in the back room within 20 seconds.' },
        { id: 'solar',     ico: '☀️', name: 'Solar roof',        price: 9000, d: 'Supplies cost 10% less (stacks with a wholesale account) and the power bill falls by 35%.' },
        { id: 'scale',     ico: '⚖️', name: 'Digital scale',     price: 260,  d: 'Eighths weigh out at 3.2 g instead of 3.5 g.' },
        { id: 'cones',     ico: '🍦', name: 'Pre-rolled cones',  price: 700,  d: 'Joints take 0.8 g instead of 1 g.' },
        { id: 'skylight',  ico: '🌤️', name: 'Skylight',          price: 2200, d: 'Plants grow 6% faster.' },
        { id: 'fintech',   ico: '💳', name: 'Payment terminal',  price: 1800,  d: 'Card sales pay 3% more and the ATM waives its fee.' },
        { id: 'ozone',     ico: '🫧', name: 'Ozone air scrubber', price: 700, d: 'Mould never takes hold, only pests.' },
        { id: 'tipjar',    ico: '🫙', name: 'Vintage tip jar',   price: 350,  d: 'Tips are doubled.' },
        { id: 'grinder2',  ico: '⚡', name: 'Electric grinder',  price: 400,  d: 'No more hand grinding before bagging or rolling.' },
        { id: 'bagger',    ico: '🏭', name: 'Auto-bagging line', price: 6000, req: 'scale', d: 'Bags weigh and seal themselves, so a whole stash bags in one go.' },
        { id: 'oven',      ico: '🔥', name: 'Convection oven',   price: 600,  d: 'Cookies bake themselves to the second, so a whole stash bakes in one go.' }
      ];
    /* 01-config.js */
    var LICENCES = [
        { id: 'retail',    ico: '🪪', name: 'Retail licence',       price: 800,  lvl: 2,  d: 'Customers may pay by card. Without it everyone pays cash.' },
        { id: 'catering',  ico: '☕', name: 'Vending & catering permit', price: 450, d: 'The vending machine and coffee machine may sell.' },
        { id: 'amusement', ico: '🕹️', name: 'Amusement permit',     price: 400,  d: 'The arcade cabinet may take coins.' },
        { id: 'lounge',    ico: '🛋️', name: 'Lounge licence',       price: 700,  rep: 200, d: 'Customers may sit and smoke in the lobby, and each one buys a joint off the goods shelf to do it.' },
        { id: 'cult2',     ico: '🌱', name: 'Cultivation permit II', price: 900, lvl: 3, d: 'Unlocks the ' + tentSizes('cult2') + ' tents and the roof greenhouse beds. Plants grow 5% faster.' },
        { id: 'cult3',     ico: '🌳', name: 'Cultivation permit III', price: 6000, lvl: 6, req: 'cult2', d: 'Unlocks the ' + tentSizes('cult3') + ' tents.' },
        { id: 'wholesale', ico: '📦', name: 'Wholesale account',    price: 3600, lvl: 4, d: 'Supplies 15% cheaper and the van comes twice as fast.' },
        { id: 'tobacco',   ico: '🚬', name: 'Tobacco manufacturing licence', price: 3000, lvl: 8, dlc: 'tobacco', d: 'Run the RF Smoking line in the basement: grow, cure, roll and pack your own cigarettes.' },
        { id: 'firearm',   ico: '🔫', name: 'Firearms licence',     price: 3000, lvl: 4, rep: 240, d: 'Lets you buy and carry the pistol and shotgun from the weapon locker. Shoot a bystander and it\'s revoked.' },
        { id: 'premium',   ico: '🎩', name: 'Connoisseur permit',   price: 3000, rep: 320, d: 'Connoisseurs visit and pay 2.2× for quality.' },
        { id: 'latehours', ico: '🌙', name: 'Late-hours licence',   price: 1000, rep: 400, d: 'From 20:00 to 02:00 customers come a third more often and pay 5% more.' },
        { id: 'brand',     ico: '®️', name: 'Brand registration',   price: 4000, rep: 480, d: '+4% on every price.' },
        { id: 'export',    ico: '🚢', name: 'Export licence',       price: 14000, lvl: 10, rep: 960, d: 'Bulk contracts under Bank on the office PC: sell up to 100 g of a strain at 70% of gram value, paid next day.' }
      ];
    /* 01-config.js */
    function tentSizes(lic) {   // '9 and 12-slot': read off the tent table, so a pack tent that needs the permit is named with the rest
        var n = TENTS.filter(function (t) { return t.lic === lic; }).map(function (t) { return t.slots; });
        return n.length ? (n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0]) + '-slot' : 'bigger';
      }
    /* 01-config.js */
    function licById(id) { for (var i = 0; i < LICENCES.length; i++) if (LICENCES[i].id === id) return LICENCES[i]; return null; }
    /* 01-config.js */
    function hasLic(id) { if (id === 'tobacco' && !dlcOn('tobacco')) return false; return !!(S.lic && S.lic[id]); }
    /* 01-config.js */
    var DLC_NAME = { tobacco: 'RF Smoking: the Tobacco Works', lab: 'The Extraction Lab', greenhouse: 'The Roof Greenhouse', dev: 'Dev Tools' };
    /* 01-config.js */
    function nightNow() { var h = gameHour(); return h >= 20 || h < 2; }
    /* 01-config.js */
    function bagGrams() { return S.upgrades.scale ? 3.2 : 3.5; }
    /* 01-config.js */
    function jointGrams() { return S.upgrades.cones ? 0.8 : 1; }
    /* 01-config.js */
    function supplyDisc() { return (hasLic('wholesale') ? 0.85 : 1) * (S.upgrades.solar ? 0.9 : 1); }
    /* 01-config.js */
    var DRY_MS_BASE = 135000, CURE_CAP_BASE = 22, THIRST_RATE = 1 / 450, HAZARD_CHANCE = 0.002;
    /* 02-state.js */
    var SAVE_V = 2;
    /* 02-state.js */
    function fresh() {
        return {
          v: SAVE_V, bank: 220, xp: 0, level: 1, rep: 0,
          till: 0, tips: 0, vault: 0, pocket: 0, pending: [], courier: null,   // cash lives in places until you move it
          units: { vending: 1, lobbyCoffee: 1, arcade: 1, fridge: 1 },   // how many of each machine the shop owns
          storage: {}, order: null, deliveries: [],
          display: { lighter: 6, rpaper: 4, rgrinder: 1 }, noCustomersUntil: 0, courierBanUntil: 0,
          stock: { bags: {}, joints: {}, cookies: {} }, staff: { worker: false, task: 'idle', guardTask: 'door' },   // the back-room stock cabinet for packed goods; who works here and what they are on
          hotbar: [null, null, null, null, null, null], slot: 0,   // what you carry: six slots, the active one is what E and G act on   // counter display stock; cooldowns after trouble   // the back room and what the machines hold
          supplies: { soil: 0, pot: 1, nutrients: 0, remedy: 0, bag: 0, paper: 0, tip: 0, grinder: 0, jar: 1 },
          light: 'none', tent: 0, upgrades: {}, lic: {},
          rh: { grow: 62, dry: 62 }, dehum: { grow: 55, dry: 55 },
          clock: 9, day: 1,   // in-game time of day (hours) and day counter for the day/night cycle   // room humidity and each dehumidifier's target (0 = off)
          plants: [], batches: [],
          cured: { g: 0, qSum: 0, thcSum: 0 },
          pkg: { bags: { n: 0, qSum: 0, thcSum: 0 }, joints: { n: 0, qSum: 0, thcSum: 0 }, cookies: { n: 0, qSum: 0, thcSum: 0 } },   // derived totals, kept in step with stash/lots by syncTotals()
          stash: {}, lots: { bags: {}, joints: {}, cookies: {} },   // per strain: stash[strain] = {g,qSum,thcSum}; lots[kind][strain] = {n,qSum,thcSum}
          market: 1.0, event: null, customer: null,
          log: [], stats: { harvested: 0, sold: 0, earned: 0, plants: 0 },
          books: { monthGross: 0, dayGross: 0, exciseDue: 0, lastDayCosts: 0, arrears: 0, month: 1, lastBill: null, dayOther: 0, monthOther: 0 },   // the ledger: what has been taken, what is owed
          lastTick: now(), lastEvent: now(), lastCustomer: now(), created: now(), steps3d: 0,
          intro: { i: 0, done: false, skipped: false },   // the guided intro, only for a brand new shop
          potSoil: {}, held: null,
          vip: null, car: null, flyerDay: 0,   // where the car was left and what is in its trunk
          tob: null, cigStock: {}, cigShutter: false,   // the basement line, the cabinet behind the counter and its roller shutter
          armory: { pepper: false, taser: false, pistol: false, shotgun: false, rifle: false, ak: false, spray: 0, rounds: 0, shells: 0, cartridges: 0, bullets: 0 }   // what the weapon locker holds
        };
      }
    /* 02-state.js */
    function slots() { return TENTS[S.tent].slots; }
    /* 02-state.js */
    function lightObj() { for (var i = 0; i < LIGHTS.length; i++) if (LIGHTS[i].id === S.light) return LIGHTS[i]; return LIGHTS[0]; }
    /* 02-state.js */
    function lightIdx() { for (var i = 0; i < LIGHTS.length; i++) if (LIGHTS[i].id === S.light) return i; return 0; }
    /* 02-state.js */
    function stashOf(id) { return S.stash[id] || (S.stash[id] = { g: 0, qSum: 0, thcSum: 0 }); }
    /* 02-state.js */
    function lotOf(kind, id) { return S.lots[kind][id] || (S.lots[kind][id] = { n: 0, qSum: 0, thcSum: 0 }); }
    /* 02-state.js */
    function plantAtSlot(slot) { for (var i = 0; i < S.plants.length; i++) if (S.plants[i].slot === slot) return S.plants[i]; return null; }
    /* 03-log-sound.js */
    var ECON = {
        baseGram: 5.5,        // $/g, plain low-grade flower at an average market
        gradeExp: 0.8,        // quality x potency, with diminishing returns
        repCap: 0.10,         // reputation is worth at most +10% on price; mostly it buys footfall
        brandBonus: 0.04, lateBonus: 0.05, chillBonus: 0.02,
        bagMarkup: 1.08,      // an eighth carries a packaging premium
        jointMarkup: 1.35,    // a pre-roll carries a convenience premium
        cookieShare: 0.40,    // one cookie is worth 0.40 x the gram it came from (six to a gram)
        excise: 0.15,         // sales tax inside the shelf price, held back and paid with the monthly bill
        taxRate: 0.10,        // business tax on the month's gross...
        taxHighRate: 0.20,    // ...and on the part of a big month over taxHighFrom, so a finished shop still has a bill that grows with it
        taxHighFrom: 60000
      };
    /* 03-log-sound.js */
    function gradeMult(q, thc) { return Math.pow((0.6 + (q / 100) * 0.8) * thc, ECON.gradeExp); }
    /* 03-log-sound.js */
    function premiumMult() { return 1 + Math.min(ECON.repCap, S.rep / 1000) + (hasLic('brand') ? ECON.brandBonus : 0) + (hasLic('latehours') && nightNow() ? ECON.lateBonus : 0) + (S.chill && S.chill.until > now() ? ECON.chillBonus : 0); }
    /* 03-log-sound.js */
    function repMult() { return premiumMult(); }
    /* 03-log-sound.js */
    function gramValue(q, thc) { return ECON.baseGram * gradeMult(q, thc) * S.market * premiumMult() * (shop().markup || 1); }
    /* 03-log-sound.js */
    function bagPrice(q, thc) { return gramValue(q, thc) * bagGrams() * ECON.bagMarkup; }
    /* 03-log-sound.js */
    function jointPrice(q, thc) { return gramValue(q, thc) * jointGrams() * ECON.jointMarkup; }
    /* 03-log-sound.js */
    function cookiePrice(q, thc) { return gramValue(q, thc) * ECON.cookieShare; }
    /* 03-log-sound.js */
    var COST = {
        rentBase: 20,          // the unit itself, per day
        rentPerSlot: 7,        // floor space for every tent slot
        rentBasement: 35,      // the tobacco works downstairs
        rentBranch: 90,        // the second shop
        branchManager: 120,    // the one person who runs it, a flat day rate
        guardWage: 60,         // the security guard on the door, for any day he is on shift
        driverKeep: 6,         // packs of each kind the driver leaves on the rack for round jobs
        rentFreeDays: 10,      // a fit-out period before the first rent falls, as a real lease gives you
        powerBase: 6,          // shop lights, fridge, till, security
        waterPerPlant: 0.4,
        payRate: 220,          // a day of one employee, fully loaded: wage, payroll tax and cover
        freeSlots: 8,          // up to eight slots is still a job one person can do
        slotsPerGrower: 3,     // past that, one more grower for every three further slots
        processPerGram: 0.55,  // trimming, lab testing and compliance on every gram harvested
        arrearsRep: 2,         // reputation lost for every day the bills go unpaid
        arrearsShare: 0.5      // at most this share of what the bank still holds after the bills goes on the arrears each morning, so one good day is never swept away whole
      };
    /* 03-log-sound.js */
    function headcount() {   // nobody runs a commercial grow room and a basement works on their own; the branch has its own manager on the bill
        return Math.max(0, Math.ceil((slots() - COST.freeSlots) / COST.slotsPerGrower)) + (hasLic('tobacco') ? 2 : 0);
      }
    /* 03-log-sound.js */
    function books() {
        if (!S.books) S.books = { monthGross: 0, dayGross: 0, exciseDue: 0, lastDayCosts: 0, arrears: 0, month: 1, lastBill: null, dayOther: 0, monthOther: 0 };
        if (S.books.dayOther === undefined) { S.books.dayOther = 0; S.books.monthOther = 0; }   // saves written before production costs existed
        return S.books;
      }
    /* 03-log-sound.js */
    function bookSale(total) {   // every dollar of trade passes through here; the taxman takes his cut of it later
        var B = books();
        S.stats.earned = (S.stats.earned || 0) + total;
        B.monthGross += total; B.dayGross += total; B.exciseDue += total * ECON.excise;
      }
    /* 03-log-sound.js */
    function billLines() {   // what the morning bill is made of, itemised so the P&L panel can show it
        var X = xs(), L = lightObj(), sl = slots(), solar = S.upgrades.solar ? 0.65 : 1;
        var free = (S.day || 1) <= COST.rentFreeDays;
        var rent = free ? 0 : COST.rentBase + sl * COST.rentPerSlot + (hasLic('tobacco') ? COST.rentBasement : 0) + (X.branch ? COST.rentBranch : 0);
        var power = (COST.powerBase + sl * (L.draw || 0) + (S.upgrades.hvac ? 8 : 0) + (S.upgrades.security2 ? 3 : 0) + (S.upgrades.bagline ? 4 : 0)) * solar;
        var roster = (X.staff.driver ? 1 : 0) + (X.staff.night ? 1 : 0) + (X.staff.labtech ? 1 : 0) + (X.staff.operator ? (hasLic('tobacco') ? 2 : 1) : 0);   /* roster hires are staff too; the operator runs the basement, which covers the two it needs */
        var hired = crewList().filter(function (w) { return !w.off; }).length + roster, need = headcount();
        var rows = [
          { k: 'Rent', v: rent, d: free ? 'fit-out period, rent free until day ' + (COST.rentFreeDays + 1) : sl + ' slots' + (X.branch ? ' + branch' : '') + (hasLic('tobacco') ? ' + basement' : '') },
          { k: 'Power', v: power, d: L.name + ' over ' + sl + ' slots' + (S.upgrades.solar ? ', solar roof taking 35% off' : '') },
          { k: 'Water', v: S.plants.length * COST.waterPerPlant, d: S.plants.length + ' plants in the tent' },
          { k: 'Payroll', v: Math.max(0, need - hired) * COST.payRate, d: need ? need + ' staff the place needs, ' + Math.min(need, hired) + ' of them covered by people you hired' : 'just you, for now' }
        ];
        if (!guardOff() && !free) rows.push({ k: 'Guard', v: COST.guardWage, d: 'the guard on the door. Send him home and there\'s no wage that day' });   /* his wage starts with the rent: a new shop has no takings yet */
        if (X.branch) rows.push({ k: 'Branch manager', v: COST.branchManager, d: 'runs Green Leaf for you, a flat day rate' });
        return rows;
      }
    /* 03-log-sound.js */
    function dailyFixed() { return billLines().reduce(function (a, r) { return a + r.v; }, 0); }
    /* 03-log-sound.js */
    function drawFunds(n) {   // a bill comes out of the bank first, then the vault, then the till
        var need = n, take;
        take = Math.min(S.bank, need); S.bank -= take; need -= take;
        if (need > 0) { take = Math.min(S.vault, need); S.vault -= take; need -= take; }
        if (need > 0) { take = Math.min(S.till, need); S.till -= take; need -= take; }
        return n - need;   // what was actually paid
      }
    /* 03-log-sound.js */
    function payBills(offline) {
        var B = books(), rows = billLines();
        var fixed = rows.reduce(function (a, r) { return a + r.v; }, 0);   // the staff the place needs; payWages then settles the named crew on top
        var paid = drawFunds(fixed), short = fixed - paid;
        B.lastBill = { day: S.day, rows: rows, paid: paid, short: short };
        B.lastDayCosts = fixed + B.dayOther; B.dayGross = 0; B.dayOther = 0;
        if (short > 0.5) {
          B.arrears += short; S.rep = Math.max(0, S.rep - COST.arrearsRep);
          logEvent('Bills came to ' + money(fixed) + ' and only ' + money(paid) + ' was there: ' + money(short) + ' into arrears, rep -' + COST.arrearsRep, 'bad');
          if (!offline) toast('Bills unpaid: ' + money(short) + ' into arrears', 'bad');
        } else {
          logEvent('Morning bills paid: ' + money(fixed) + ' (' + rows.slice(0, 3).map(function (r) { return r.k.toLowerCase() + ' ' + money(r.v); }).join(', ') + ')', '');
          if (B.arrears > 0.5) { var cl = drawFunds(Math.min(B.arrears, Math.floor(S.bank * COST.arrearsShare))); if (cl > 0.5) { B.arrears -= cl; var arrTxt = 'Paid ' + money(cl) + ' off the arrears' + (B.arrears > 0.5 ? ', ' + money(B.arrears) + ' still owing' : ', all square'); logEvent(arrTxt, B.arrears > 0.5 ? '' : 'good'); if (!offline) toast('🏦 ' + arrTxt, B.arrears > 0.5 ? '' : 'good'); } }   /* an instalment, never the whole balance: the rest of the debt waits for tomorrow */
        }
        payWages(offline);
        monthlyTax(offline);
      }
    /* 03-log-sound.js */
    function bizTax(gross) { return Math.min(gross, ECON.taxHighFrom) * ECON.taxRate + Math.max(0, gross - ECON.taxHighFrom) * ECON.taxHighRate; }
    /* 03-log-sound.js */
    function taxDue() { var B = books(); return Math.round(B.exciseDue + bizTax(B.monthGross)); }
    /* 03-log-sound.js */
    function taxDay() { return (Math.floor(((S.day || 1) - 1) / 28) + 1) * 28 + 1; }
    /* 03-log-sound.js */
    function monthlyTax(offline) {
        var B = books(), m = Math.floor(((S.day || 1) - 1) / 28) + 1;
        if (m === B.month) return;
        B.month = m;
        var bill = taxDue(), gross = B.monthGross;
        B.exciseDue = 0; B.monthGross = 0; B.monthOther = 0;
        if (bill <= 0) return;
        var paid = drawFunds(bill), short = bill - paid;
        if (short > 0.5) {
          B.arrears += short; S.rep = Math.max(0, S.rep - 5);
          logEvent('Tax on ' + money(gross) + ' of trade came to ' + money(bill) + ' and only ' + money(paid) + ' was there, rep -5', 'bad');
          if (!offline) toast('Tax bill short by ' + money(short), 'bad');
        } else {
          logEvent('Tax paid: ' + money(bill) + ' on ' + money(gross) + ' of trade last month', '');
          if (!offline) toast('Tax bill paid: ' + money(bill), '');
        }
      }
    /* 03-log-sound.js */
    function daysText(ms) {   // grow times span days now, so minutes stopped being the useful unit
        var d = ms / 60000 / (+SET.dayLength || 20);
        return d >= 1 ? (Math.round(d * 10) / 10) + ' days' : Math.ceil(ms / 60000) + ' min';
      }
    /* 03-log-sound.js */
    function unitPrice(kind, q, thc) { return kind === 'bags' ? bagPrice(q, thc) : kind === 'cookies' ? cookiePrice(q, thc) : jointPrice(q, thc); }
    /* 03-log-sound.js */
    function kindName(kind, n) { return kind === 'bags' ? (n === 1 ? 'bag' : 'bags') : kind === 'cookies' ? (n === 1 ? 'cookie' : 'cookies') : (n === 1 ? 'joint' : 'joints'); }
    /* 04-sim.js */
    function step(dt, offline) {
        var L = lightObj(); var auto = !!S.upgrades.autowater;
        { var dKey = SET.dayNight === 'cycle' ? 'clock' : 'dayAcc'; S[dKey] = (+S[dKey] || 0) + dt / 60 / (+SET.dayLength || 20) * 24;   /* with the sky pinned to one hour the days still pass, so rent, wages and tax still fall */ var rolled = 0; while (S[dKey] >= 24) { if (offline && rolled >= 1) { S[dKey] %= 24; break; }   /* time away turns the calendar one day at most: the bills fall once, not once for every day the window was shut */ rolled++; S[dKey] -= 24; S.day = (S.day || 1) + 1; S.regDay = S.day; S.regSold = 0; payBills(offline); expansionNewDay(offline); dlcNewDay(offline); if (binsFull()) { S.rep = Math.max(0, S.rep - 1); logEvent('🗑️ A full bin stood all night and the place smells of it (rep -1)', 'bad'); } if (!offline) { logEvent('🌅 Day ' + S.day + ' begins', ''); toast('🌅 Day ' + S.day, ''); sfx('chime'); } var loose = S.till + coinTotal() + S.tips; if (loose > 0) logEvent('🧾 Overnight: ' + money(S.till) + ' in the till, ' + money(coinTotal()) + ' in the machines, ' + money(S.tips) + ' in the tip jar. Empty them into the vault.', ''); } if (offline && rolled && S[dKey] > 8) S[dKey] = 8; }   /* back from time away, the day starts in the morning: the leftover clock used to land near midnight and the next bill fell minutes later */
        creditPending(offline); updateLogistics(dt, offline); dlcStep(dt, offline);
        // humidity: each room drifts toward its moisture load; a running dehumidifier pulls it down to its target
        var pull = S.upgrades.hvac ? 4.0 : S.upgrades.dehumid ? 1.6 : 0.8; var wetBatches = S.batches.filter(function (b) { return !b.cured; }).length;
        var loads = { grow: 60 + S.plants.length * 1.2, dry: 58 + wetBatches * 2.5 }; if (S.upgrades.hvac) { loads.grow -= 6; loads.dry -= 6; }
        ['grow', 'dry'].forEach(function (z) { var rh = S.rh[z]; rh += (loads[z] - rh) * Math.min(1, 0.03 * dt); var tgt = S.dehum[z]; if (tgt > 0 && rh > tgt) rh = Math.max(tgt, rh - pull * dt); S.rh[z] = clamp(rh, 30, 95); });
        for (var i = 0; i < S.plants.length; i++) {
          var p = S.plants[i];
          if (p.progress < 1) {
            var thirstPen = auto ? 1 : (p.thirst > 0.8 ? 0.35 : p.thirst > 0.5 ? 0.7 : 1);
            var rate = (1000 / strainById(p.strain).growMs) * L.spd * thirstPen * (S.upgrades.hydro ? 1.12 : 1) * (hasLic('cult2') ? 1.05 : 1) * (S.upgrades.skylight ? 1.06 : 1);
            var was = p.progress;
            p.progress = clamp(p.progress + rate * dt, 0, 1);
            if (!offline && was < 1 && p.progress >= 1) { logEvent('🌸 A ' + strainById(p.strain).name + ' is ready to harvest', 'good'); }
          }
          if (S.upgrades.doser && !p.fed && p.progress > 0.35) { p.fed = true; p.quality = clamp(p.quality + 12, 20, 100); if (!offline) logEvent('🧪 The doser fed a ' + strainById(p.strain).name, ''); }
          var thWas = p.thirst, thRate = THIRST_RATE * (S.rh.grow < 42 ? 1.3 : 1);
          if (!auto) p.thirst = clamp(p.thirst + thRate * dt, 0, 1);
          if (!auto && p.thirst > 0.7) { var dryDt = thWas > 0.7 ? dt : Math.max(0, dt - (0.7 - thWas) / thRate); p.quality = clamp(p.quality - 0.5 * dryDt, 20, 100); }   /* only the part of the step actually spent thirsty costs quality */
          if (p.hazard) p.quality = clamp(p.quality - 0.8 * dt, 20, 100);
          else if (!offline && p.progress > 0.4 && p.progress < 1) {
            var hc = HAZARD_CHANCE * (S.upgrades.security2 ? 0.25 : S.upgrades.security ? 0.5 : 1) * moldMult();
            if (Math.random() < hc * dt) { p.hazard = !S.upgrades.ozone && Math.random() < (S.rh.grow > 60 ? 0.7 : 0.4) ? 'mold' : 'pest'; logEvent('⚠ ' + (p.hazard === 'pest' ? 'Spider mites' : 'Mould') + ' hit a ' + strainById(p.strain).name + '. Spray it before it spreads.', 'bad'); toast('⚠ ' + (p.hazard === 'pest' ? 'Pest' : 'Mould') + ' outbreak', 'bad'); }
          }
        }
        var rackFast = S.upgrades.rack2 ? 2.4 : S.upgrades.rack ? 1.6 : 1, cureCap = CURE_CAP_BASE + (S.upgrades.rack2 ? 20 : S.upgrades.rack ? 10 : 0), jarsFree = cureSlots();
        for (var b = 0; b < S.batches.length; b++) {
          var batch = S.batches[b];
          if (batch.cured && jarsFree-- <= 0) continue;   /* no jar for this one yet: it waits, oldest batches cure first */
          if (!batch.cured) { if (batch.dry === undefined) batch.dry = clamp((now() - batch.startedAt) / dryMs(), 0, 1); batch.dry = clamp(batch.dry + (dt * 1000 / dryMs()) * dryFactor(), 0, 1); if (batch.dry >= 1) { batch.cured = true; if (!offline) logEvent('🏺 A batch has finished drying and gone to the curing shelf', ''); } }
          else { var gained = 0.5 * rackFast * dt; if (batch.quality < batch.baseQ + cureCap) batch.quality = clamp(batch.quality + gained, 0, Math.min(100, batch.baseQ + cureCap)); }
        }
        if (!offline) {
          var target = (S.event && S.event.mult) ? S.event.mult : 1.0;
          S.market += ((target - S.market) * 0.02 + (Math.random() - 0.5) * 0.03) * Math.min(dt, 3);
          S.market = clamp(S.market, 0.85, 1.20);
          if (S.event && now() > S.event.until) { logEvent(S.event.type === '420' ? '🔥 The 420 rush is over. Prices are back to normal.' : S.event.type === 'cup' ? '🏆 The Cannabis Cup has left town' : 'Over: ' + S.event.label, ''); S.event = null; }
          if (S.customer && now() > S.customer.until && (S.customer.arrived || S.customer.stage || now() - (S.customer.spawnedAt || 0) > 180000)) { if (S.customer.stage) { logEvent('🚶 ' + S.customer.who + ' got tired of waiting to pay and walked (rep -2)', 'bad'); S.rep = Math.max(0, S.rep - 2); if (!offline) toast('🚶 ' + S.customer.who + ' walked out without paying', 'bad'); } else if (!offline) logEvent('🚶 ' + S.customer.who + ' gave up waiting at the window and left', ''); S.customer = null; }
        }
        if (offline && !ui.started && dt > 2) offlineWorks(dt);   // the boot catch-up: the step at start-up is the only offline one before the start screen is passed
      }
    /* 04-sim.js */
    function offlineWorks(secs) {
        secs = clamp(secs, 0, 6 * 3600); if (secs <= 0) return;
        var T = tob(), busy = T.bays.some(function (b) { return b.stage === 'grow'; }) || T.kiln.on || T.shred.on || T.maker.on || T.packer.on;
        if (busy) { var fl = player.floor; player.floor = 0; for (var t = 0; t < secs; t += 0.25) updateTobacco(Math.min(0.25, secs - t)); player.floor = fl; }   /* a quarter second at a time, the packer's cycle is 1.2 s; off the basement floor the tick skips its animation */
        labTick(secs); roofTick(secs * 0.75, true);   /* the beds only grow in daylight, and night runs 20:00 to 02:00 */
        if (busy) logEvent('🏭 The basement line kept running while you were away', '');
      }
    /* 05-actions.js */
    function cashOnSite() { return S.till + coinTotal() + S.tips + S.vault + S.pocket; }
    /* 05-actions.js */
    function pendingDue(p) { return SET.dayNight === 'cycle' ? (S.day || 1) >= p.dueDay : now() >= p.dueAt; }
    /* 05-actions.js */
    function creditPending(offline) { if (!S.pending.length) return; var keep = []; S.pending.forEach(function (p) { if (pendingDue(p)) { S.bank += p.amount; logEvent('🏦 Bank deposit cleared: ' + money(p.amount), 'good'); if (!offline) toast('🏦 ' + money(p.amount) + ' landed in the bank', 'good'); } else keep.push(p); }); S.pending = keep; }
    /* 06-three.js */
    var ROOM = { x: 12, z: 9, h: 3.4 };
    /* 06-three.js */
    function makeTex(w, h, draw, repeat) {
        var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
        var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
      }
    /* 06-three.js */
    function noiseFill(ctx, w, h, base, amp, n) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        for (var i = 0; i < n; i++) { var v = Math.floor((Math.random() - 0.5) * amp); ctx.fillStyle = 'rgba(' + (v > 0 ? 255 : 0) + ',' + (v > 0 ? 255 : 0) + ',' + (v > 0 ? 255 : 0) + ',' + Math.abs(v) / 255 + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, randi(1, 4), randi(1, 4)); }
      }
    /* 06-three.js */
    function makeBump(w, h, draw, repeat) {
        var c = document.createElement('canvas'); c.width = w; c.height = h; var ctx = c.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); draw(ctx, w, h);
        var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; return t;
      }
    /* 06-three.js */
    function noiseGrain(ctx, w, h, n, alpha) { for (var i = 0; i < n; i++) { var v = Math.random(); ctx.fillStyle = 'rgba(' + (v > 0.5 ? '255,255,255' : '0,0,0') + ',' + (Math.abs(v - 0.5) * alpha) + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, randi(1, 3), randi(1, 3)); } }
    /* 06-three.js */
    function tileDraw(ctx, w, h, cols, rows, fill, grout, groutW, jitter) {
        ctx.fillStyle = grout; ctx.fillRect(0, 0, w, h); var tw = w / cols, th = h / rows;
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) { var f = typeof fill === 'function' ? fill(c, r) : fill; ctx.fillStyle = f; ctx.fillRect(c * tw + groutW / 2, r * th + groutW / 2, tw - groutW, th - groutW); if (jitter) { ctx.fillStyle = 'rgba(0,0,0,' + randf(0, jitter) + ')'; ctx.fillRect(c * tw + groutW / 2, r * th + groutW / 2, tw - groutW, th - groutW); } }
      }
    /* 06-three.js */
    function brickDraw(ctx, w, h, cols, rows, fill, grout, groutW, bump) {
        ctx.fillStyle = grout; ctx.fillRect(0, 0, w, h); var bw = w / cols, bh = h / rows;
        for (var r = 0; r < rows; r++) { var off = (r % 2) * bw / 2; for (var c = -1; c <= cols; c++) { var x = c * bw + off; ctx.fillStyle = bump ? ('rgb(' + [140, 150, 160][(c + r) % 3] + ',' + [140, 150, 160][(c + r) % 3] + ',' + [140, 150, 160][(c + r) % 3] + ')') : (typeof fill === 'function' ? fill(c, r) : fill); ctx.fillRect(x + groutW / 2, r * bh + groutW / 2, bw - groutW, bh - groutW); } }
      }
    /* 06-three.js */
    function plankDraw(ctx, w, h, bump) {
        var rows = 10, rh = h / rows, tones = ['#a9773f', '#9a6a3e', '#b0804a', '#946638', '#a57242', '#8d5f34', '#b68a54'], seed = [0.13, 0.62, 0.37, 0.81, 0.25, 0.7, 0.05, 0.5, 0.92, 0.44];
        if (bump) { ctx.fillStyle = '#8c8c8c'; ctx.fillRect(0, 0, w, h); }
        for (var r = 0; r < rows; r++) {
          var x = -seed[r] * w * 0.6, n = 0;
          while (x < w) {
            var len = w * (0.34 + ((r * 7 + n * 5) % 5) * 0.07), y = r * rh; n++;
            ctx.save(); ctx.beginPath(); ctx.rect(x, y, len, rh); ctx.clip();
            if (!bump) { ctx.fillStyle = tones[(r * 3 + n * 2) % tones.length]; ctx.fillRect(x, y, len, rh); }
            for (var i = 0; i < 26; i++) { var gy = y + Math.random() * rh, dk = Math.random() < 0.7; ctx.strokeStyle = (bump ? (dk ? 'rgba(0,0,0,' : 'rgba(255,255,255,') : (dk ? 'rgba(50,28,10,' : 'rgba(255,225,180,')) + randf(0.05, bump ? 0.16 : 0.22) + ')'; ctx.lineWidth = randf(0.6, 2.2); ctx.beginPath(); ctx.moveTo(x - 4, gy); ctx.bezierCurveTo(x + len * 0.3, gy + randf(-5, 5), x + len * 0.7, gy + randf(-5, 5), x + len + 4, gy + randf(-4, 4)); ctx.stroke(); }
            if (!bump && Math.random() < 0.3) { var kx = x + randf(0.2, 0.8) * len, ky = y + randf(0.3, 0.7) * rh; for (var k = 0; k < 5; k++) { ctx.strokeStyle = 'rgba(40,22,8,' + (0.3 - k * 0.05) + ')'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(kx, ky, 5 + k * 5, 3 + k * 2.4, 0, 0, 6.29); ctx.stroke(); } }
            ctx.restore();
            ctx.fillStyle = bump ? '#1c1c1c' : 'rgba(30,18,8,.85)'; ctx.fillRect(x, y, bump ? 4 : 3, rh); ctx.fillRect(x, y, len, bump ? 4 : 3);
            if (!bump) { ctx.fillStyle = 'rgba(255,235,200,.10)'; ctx.fillRect(x + 3, y + 3, len - 3, 2); }
            x += len;
          }
        }
      }
    /* 06-three.js */
    function woodDraw(ctx, w, h, base, inks, n, bump) {
        if (base) { ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); var tone = ctx.createLinearGradient(0, 0, 0, h); tone.addColorStop(0, 'rgba(255,230,190,.10)'); tone.addColorStop(0.5, 'rgba(0,0,0,.08)'); tone.addColorStop(1, 'rgba(255,230,190,.06)'); ctx.fillStyle = tone; ctx.fillRect(0, 0, w, h); }
        var drift = []; for (var k = 0; k < 4; k++) drift.push(randf(-10, 10));
        for (var i = 0; i < n; i++) { var y = Math.random() * h, dark = Math.random() < 0.72; ctx.strokeStyle = inks[dark ? 0 : 1] + (dark ? randf(0.05, bump ? 0.3 : 0.24) : randf(0.03, 0.1)) + ')'; ctx.lineWidth = randf(0.5, dark ? 2.2 : 1.2); ctx.beginPath(); ctx.moveTo(-4, y); ctx.bezierCurveTo(w * 0.3, y + drift[0] + randf(-3, 3), w * 0.65, y + drift[1] + randf(-3, 3), w + 4, y + drift[2] + randf(-3, 3)); ctx.stroke(); }
        for (var a = 0; a < 3; a++) { var cx = Math.random() * w, cy = Math.random() * h; for (var rr = 0; rr < 7; rr++) { ctx.strokeStyle = inks[0] + randf(0.06, 0.16) + ')'; ctx.lineWidth = randf(0.8, 1.8); ctx.beginPath(); ctx.ellipse(cx, cy, 40 + rr * 22, 5 + rr * 4.5, 0, 0, Math.PI * 2); ctx.stroke(); } }
        for (var p = 0; p < 900; p++) { ctx.fillStyle = inks[0] + randf(0.08, 0.22) + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, randf(3, 12), 1); }
      }
    /* 06-three.js */
    var TEX = {
        concrete: makeTex(512, 512, function (ctx, w, h) { noiseFill(ctx, w, h, '#6d6f6a', 30, 14000); for (var i = 0; i < 40; i++) { var bl = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); bl.addColorStop(0, 'rgba(' + (i % 2 ? '255,255,255,' : '0,0,0,') + randf(0.03, 0.08) + ')'); bl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.translate(Math.random() * w, Math.random() * h); ctx.scale(randf(30, 110), randf(20, 70)); ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.29); ctx.fill(); ctx.restore(); } ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);   /* a poured slab: cloudy, with a saw-cut joint round each bay */ }, [6, 4.5]),
        concreteBump: makeBump(512, 512, function (ctx, w, h) { noiseGrain(ctx, w, h, 9000, 0.35); ctx.strokeStyle = '#303030'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6); }, [6, 4.5]),
        wall: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#d9d5c9', 8, 2500); }, [4, 2]),
        wallBump: makeBump(256, 256, function (ctx, w, h) { noiseGrain(ctx, w, h, 5000, 0.18); }, [4, 2]),
        accent: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#2f5a45', 10, 2500); }, [4, 2]),
        brick: makeTex(512, 256, function (ctx, w, h) { brickDraw(ctx, w, h, 8, 8, function () { return pick(['#8a4a3a', '#95553f', '#7c4335', '#9a5c48', '#83483a']); }, '#c9c2b4', 6); noiseGrain(ctx, w, h, 6000, 0.25); }, [1, 1]),   /* repeat 1: box() sizes brick UVs in metres so every panel shows the same brick */
        brickBump: makeBump(512, 256, function (ctx, w, h) { brickDraw(ctx, w, h, 8, 8, null, '#303030', 6, true); noiseGrain(ctx, w, h, 4000, 0.2); }, [3, 1.5]),
        brickDark: makeTex(512, 256, function (ctx, w, h) { brickDraw(ctx, w, h, 8, 8, function () { return pick(['#2d3034', '#33363b', '#2a2c30', '#383b40']); }, '#4a4d52', 6); noiseGrain(ctx, w, h, 5000, 0.25); }, [1, 1]),
        tile: makeTex(512, 512, function (ctx, w, h) { tileDraw(ctx, w, h, 4, 4, function (c, r) { return (c + r) % 2 ? '#d7d2c4' : '#c8c2b2'; }, '#8d877b', 6, 0.06); noiseGrain(ctx, w, h, 8000, 0.2); }, [6, 2.5]),
        tileBump: makeBump(512, 512, function (ctx, w, h) { tileDraw(ctx, w, h, 4, 4, '#8a8a8a', '#2a2a2a', 6, 0); noiseGrain(ctx, w, h, 5000, 0.15); }, [6, 2.5]),
        planks: makeTex(1024, 1024, function (ctx, w, h) { plankDraw(ctx, w, h, false); }, [4, 4]),
        planksBump: makeBump(1024, 1024, function (ctx, w, h) { plankDraw(ctx, w, h, true); }, [4, 4]),
        rubber: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#2e3236', 14, 4000); ctx.fillStyle = 'rgba(255,255,255,.05)'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { ctx.beginPath(); ctx.arc(x + 8 + ((y / 16) % 2) * 0, y + 8, 3, 0, Math.PI * 2); ctx.fill(); } }, [10, 6]),
        rubberBump: makeBump(256, 256, function (ctx, w, h) { ctx.fillStyle = '#a8a8a8'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { ctx.beginPath(); ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2); ctx.fill(); } noiseGrain(ctx, w, h, 3000, 0.12); }, [10, 6]),
        ceiling: makeTex(512, 512, function (ctx, w, h) { tileDraw(ctx, w, h, 2, 2, '#e7e4dc', '#b9b5aa', 8, 0); for (var i = 0; i < 2600; i++) { ctx.fillStyle = 'rgba(0,0,0,' + randf(0.04, 0.16) + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [10, 7.5]),
        ceilingBump: makeBump(512, 512, function (ctx, w, h) { tileDraw(ctx, w, h, 2, 2, '#8a8a8a', '#3a3a3a', 8, 0); noiseGrain(ctx, w, h, 5000, 0.2); }, [10, 7.5]),
        wood: makeTex(512, 512, function (ctx, w, h) { woodDraw(ctx, w, h, '#946a3f', ['rgba(60,34,12,', 'rgba(255,220,170,'], 150, false); }, [2, 1]),
        woodBump: makeBump(512, 512, function (ctx, w, h) { woodDraw(ctx, w, h, null, ['rgba(0,0,0,', 'rgba(255,255,255,'], 110, true); }, [2, 1]),
        darkwood: makeTex(512, 512, function (ctx, w, h) { woodDraw(ctx, w, h, '#432d1c', ['rgba(0,0,0,', 'rgba(255,200,150,'], 170, false); }, [2, 1]),
        stone: makeTex(512, 512, function (ctx, w, h) { noiseFill(ctx, w, h, '#e9e6de', 16, 9000); for (var i = 0; i < 26; i++) { ctx.strokeStyle = 'rgba(90,96,100,' + randf(0.05, 0.2) + ')'; ctx.lineWidth = randf(0.6, 2.4); ctx.beginPath(); var x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); for (var s = 0; s < 5; s++) { x += randf(-90, 90); y += randf(30, 110); ctx.lineTo(x, y); } ctx.stroke(); } for (var f = 0; f < 500; f++) { ctx.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '60,60,64' : '255,255,255') + ',' + randf(0.1, 0.35) + ')'; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, randf(0.5, 1.8), 0, 6.29); ctx.fill(); } }, [1, 1]),
        brushed: makeTex(256, 256, function (ctx, w, h) { ctx.fillStyle = '#9ea4ac'; ctx.fillRect(0, 0, w, h); for (var y = 0; y < h; y++) { ctx.fillStyle = 'rgba(' + (Math.random() > 0.5 ? '255,255,255' : '0,0,0') + ',' + randf(0.02, 0.12) + ')'; ctx.fillRect(0, y, w, 1); } }, [1, 1]),
        fabric: makeTex(128, 128, function (ctx, w, h) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) { ctx.fillStyle = 'rgba(0,0,0,' + (((x + y) / 2) % 2 ? 0.14 : 0.04) + ')'; ctx.fillRect(x, y, 2, 2); } }, [6, 6]),
        tent: makeTex(128, 128, function (ctx, w, h) { noiseFill(ctx, w, h, '#1c1f24', 10, 800); ctx.strokeStyle = 'rgba(255,255,255,.06)'; for (var i = 0; i < w; i += 8) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); } }, [3, 3]),
        mylar: makeTex(128, 128, function (ctx, w, h) { var g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c9ccd2'); g.addColorStop(.5, '#f2f3f5'); g.addColorStop(1, '#b9bcc4'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); for (var i = 0; i < 40; i++) { ctx.strokeStyle = 'rgba(255,255,255,' + randf(0.1, 0.4) + ')'; ctx.lineWidth = randf(1, 3); ctx.beginPath(); var x = Math.random() * w; ctx.moveTo(x, 0); ctx.lineTo(x + randf(-30, 30), h); ctx.stroke(); } }, [2, 2]),
        soil: makeTex(128, 128, function (ctx, w, h) { noiseFill(ctx, w, h, '#3a2a1c', 50, 3000); ctx.fillStyle = 'rgba(230,220,200,.5)'; for (var i = 0; i < 40; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }),
        terracotta: makeTex(128, 128, function (ctx, w, h) { noiseFill(ctx, w, h, '#b35a2a', 26, 3000); }, [2, 1]),
        grass: makeTex(512, 512, function (ctx, w, h) { noiseFill(ctx, w, h, '#4f7f3b', 26, 16000); var cols = ['#3f6f2e', '#5c8f44', '#6f9a4a', '#45752f', '#7ea25a']; for (var i = 0; i < 2600; i++) { var x = Math.random() * w, y = Math.random() * h; ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = randf(0.8, 1.6); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + randf(-4, 4), y - randf(4, 9), x + randf(-6, 6), y - randf(8, 16)); ctx.stroke(); } ctx.fillStyle = 'rgba(70,50,30,.16)'; for (var d = 0; d < 14; d++) { ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, randf(14, 40), randf(8, 22), Math.random() * 3, 0, 6.29); ctx.fill(); } }, [52, 52]),
        foliage: makeTex(256, 256, function (ctx, w, h) { ctx.fillStyle = '#4c7f36'; ctx.fillRect(0, 0, w, h); var cols = ['#3f6f2c', '#5a9040', '#6fa64b', '#4a7d33', '#87b85a', '#356a27']; for (var i = 0; i < 900; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, randf(5, 11), randf(3, 6), Math.random() * 3.2, 0, 6.29); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,220,.10)'; for (var j = 0; j < 300; j++) { ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, randf(2, 5), randf(1.5, 3), Math.random() * 3.2, 0, 6.29); ctx.fill(); } }, [2, 2]),
        pine: makeTex(256, 256, function (ctx, w, h) { ctx.fillStyle = '#2d5a2a'; ctx.fillRect(0, 0, w, h); var cols = ['#254d22', '#38703a', '#2f6330', '#457f45', '#1f4520']; for (var i = 0; i < 2400; i++) { ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 1; var x = Math.random() * w, y = Math.random() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + randf(-3, 3), y + randf(4, 10)); ctx.stroke(); } }, [2, 2]),
        bark: makeTex(128, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#5a4330', 24, 3000); ctx.strokeStyle = 'rgba(0,0,0,.35)'; for (var i = 0; i < 90; i++) { ctx.lineWidth = randf(1, 3); var x = Math.random() * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + randf(-6, 6), h * .3, x + randf(-6, 6), h * .7, x + randf(-4, 4), h); ctx.stroke(); } ctx.strokeStyle = 'rgba(255,230,200,.12)'; for (var j = 0; j < 40; j++) { var x2 = Math.random() * w; ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2 + randf(-3, 3), h); ctx.stroke(); } }, [1, 2]),
        tuft: makeAlphaTex(128, 128, function (ctx, w, h) { var cols = ['#4a8a34', '#5f9e42', '#3d7a2c', '#78b04e', '#8cc25a']; for (var i = 0; i < 46; i++) { ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = randf(1.5, 3.5); var x0 = w / 2 + randf(-22, 22), x1 = x0 + randf(-30, 30), y1 = randf(4, 50); ctx.beginPath(); ctx.moveTo(x0, h); ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.3, h * 0.55, x1, y1); ctx.stroke(); } }),
        flower: makeAlphaTex(64, 64, function (ctx, w, h) { ctx.strokeStyle = '#4b6b3a'; ctx.lineWidth = 2; [[20, 30], [32, 22], [44, 30]].forEach(function (p) { ctx.beginPath(); ctx.moveTo(p[0] + (32 - p[0]) * 0.5, h); ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.fillStyle = '#ffffff'; for (var k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(p[0] + Math.cos(k * 1.256) * 5, p[1] + Math.sin(k * 1.256) * 5, 4, 3, k * 1.256, 0, 6.29); ctx.fill(); } ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 6.29); ctx.fill(); }); }),
        frond: makeAlphaTex(128, 512, function (ctx, w, h) { ctx.strokeStyle = '#2f5f2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, 6); ctx.stroke(); for (var i = 0; i < 26; i++) { var t = i / 26, y = h - 18 - t * (h - 40), len = (8 + Math.sin(Math.min(1, t * 1.25) * Math.PI) * 50) * (1 - t * 0.25); [-1, 1].forEach(function (sd) { var gr = ctx.createLinearGradient(w / 2, y, w / 2 + sd * len, y - 12); gr.addColorStop(0, '#2f6e30'); gr.addColorStop(1, i % 2 ? '#6fb45a' : '#58a048'); ctx.fillStyle = gr; ctx.save(); ctx.translate(w / 2, y); ctx.rotate(sd * -0.5); ctx.beginPath(); ctx.ellipse(sd * len / 2, 0, len / 2, 6.5 - t * 3, 0, 0, 6.29); ctx.fill(); ctx.restore(); }); } }),
        bigleaf: makeAlphaTex(256, 512, function (ctx, w, h) { var gr = ctx.createLinearGradient(0, h, w, 0); gr.addColorStop(0, '#1f5a2c'); gr.addColorStop(0.6, '#2f7a3a'); gr.addColorStop(1, '#4f9a4c'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(w / 2, h - 4); ctx.bezierCurveTo(w * 1.05, h * 0.82, w * 1.0, h * 0.25, w / 2, 6); ctx.bezierCurveTo(0, h * 0.25, -w * 0.05, h * 0.82, w / 2, h - 4); ctx.fill(); ctx.strokeStyle = 'rgba(190,230,170,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, h - 4); ctx.lineTo(w / 2, 14); ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(190,230,170,.3)'; for (var i = 1; i < 11; i++) { var y = h - i * (h / 11.5); [-1, 1].forEach(function (sd) { ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.quadraticCurveTo(w / 2 + sd * w * 0.25, y - 26, w / 2 + sd * w * 0.42, y - 62); ctx.stroke(); }); } }),
        asphalt: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#34363b', 26, 9000); }, [30, 4]),
        pavement: makeTex(256, 256, function (ctx, w, h) { tileDraw(ctx, w, h, 2, 2, function (c, r) { return pick(['#a3a39d', '#9c9c96', '#a9a9a2']); }, '#7a7a74', 4, 0.05); noiseGrain(ctx, w, h, 4000, 0.2); }, [45, 1.6]),
        pavementBump: makeBump(256, 256, function (ctx, w, h) { tileDraw(ctx, w, h, 2, 2, '#8a8a8a', '#303030', 4, 0); noiseGrain(ctx, w, h, 3000, 0.15); }, [45, 1.6]),
        leaf: makeTex(256, 512, function (ctx, w, h) {
          ctx.clearRect(0, 0, w, h);
          // seven serrated leaflets fanning from the base
          var cx = w / 2, cy = h * 0.92;
          var lens = [0.32, 0.55, 0.8, 0.9, 0.8, 0.55, 0.32];
          var angs = [-1.25, -0.85, -0.42, 0, 0.42, 0.85, 1.25];
          for (var i = 0; i < 7; i++) {
            var L = lens[i] * h, a = angs[i];
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
            var grd = ctx.createLinearGradient(0, 0, 0, -L); grd.addColorStop(0, '#2a6e30'); grd.addColorStop(0.55, '#4f9f48'); grd.addColorStop(1, '#8ad474');
            ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(0, 0);
            var steps = 18;
            for (var s = 1; s <= steps; s++) { var t = s / steps; var wdt = Math.sin(t * Math.PI) * L * 0.11 + (s % 2 ? L * 0.025 : 0); ctx.lineTo(wdt, -t * L); }
            for (var s2 = steps; s2 >= 1; s2--) { var t2 = s2 / steps; var wdt2 = Math.sin(t2 * Math.PI) * L * 0.11 + (s2 % 2 ? L * 0.025 : 0); ctx.lineTo(-wdt2, -t2 * L); }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(200,240,180,.55)'; ctx.lineWidth = Math.max(1, w / 128); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L); ctx.stroke(); ctx.strokeStyle = 'rgba(20,60,20,.4)'; ctx.lineWidth = Math.max(1, w / 180);
            for (var v = 1; v < 6; v++) { var vy = -L * v / 6; ctx.beginPath(); ctx.moveTo(0, vy); ctx.lineTo(L * 0.09, vy - L * 0.06); ctx.moveTo(0, vy); ctx.lineTo(-L * 0.09, vy - L * 0.06); ctx.stroke(); }
            ctx.restore();
          }
        }),
        bud: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#8ccf78', 50, 7000); for (var c = 0; c < 70; c++) { var cx = Math.random() * w, cy = Math.random() * h, cr = randf(8, 20), cg = ctx.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, 1, cx, cy, cr); cg.addColorStop(0, 'rgba(225,255,200,.5)'); cg.addColorStop(0.6, 'rgba(90,150,70,.25)'); cg.addColorStop(1, 'rgba(30,70,30,.4)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, 6.29); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,.75)'; for (var i = 0; i < 700; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); ctx.fillStyle = 'rgba(255,150,60,.55)'; for (var j = 0; j < 30; j++) { ctx.beginPath(); var x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); ctx.lineTo(x + randf(-6, 6), y + randf(-6, 6)); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,150,60,.6)'; ctx.stroke(); } }, [2, 2]),
        poster1: makeTex(256, 384, function (ctx, w, h) { ctx.fillStyle = '#12261a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#6fdc8c'; ctx.font = '600 44px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GROW', w / 2, 90); ctx.fillText('LOCAL', w / 2, 140); ctx.font = '22px "Segoe UI",sans-serif'; ctx.fillStyle = '#c9e8d0'; ctx.fillText('small batch · hand cured', w / 2, 200); ctx.fillStyle = '#6fdc8c'; for (var i = 0; i < 7; i++) { ctx.save(); ctx.translate(w / 2, 300); ctx.rotate((i - 3) * 0.4); ctx.fillRect(-4, -70, 8, 70); ctx.restore(); } }),
        poster2: makeTex(256, 384, function (ctx, w, h) { ctx.fillStyle = '#3a2a1e'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ffc857'; ctx.font = '600 40px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GROW CO.', w / 2, 80); ctx.font = '600 92px "Segoe UI",sans-serif'; ctx.fillText('420', w / 2, 210); ctx.font = '20px "Segoe UI",sans-serif'; ctx.fillStyle = '#f0e0c0'; ctx.fillText('prices up every rush', w / 2, 260); ctx.fillText('ask at the window', w / 2, 290); ctx.strokeStyle = '#ffc857'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, w - 28, h - 28); }),
        poster3: makeTex(256, 384, function (ctx, w, h) { ctx.fillStyle = '#1a1c2e'; ctx.fillRect(0, 0, w, h); var g = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.4, 150); g.addColorStop(0, '#ff69b4'); g.addColorStop(0.5, '#7a4aa8'); g.addColorStop(1, '#1a1c2e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ffffff'; ctx.font = '600 34px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RAINBOW', w / 2, 300); ctx.fillText('RUNTZ', w / 2, 340); ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText('level 9 unlock', w / 2, 370); })
      };
    /* 06-three.js */
    function emojiTex(emoji, size, bg) {
        var c = document.createElement('canvas'); c.width = c.height = size || 128; var ctx = c.getContext('2d');
        if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(c.width / 2, c.height / 2, c.width / 2 - 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.font = Math.floor(c.width * 0.62) + 'px "Segoe UI Emoji","Apple Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emoji, c.width / 2, c.height / 2 + c.width * 0.04);
        var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
      }
    /* 06-three.js */
    var SIGN_FONT = 'Bahnschrift,"DIN Alternate","Segoe UI Variable Display","Segoe UI",system-ui,sans-serif';
    /* 06-three.js */
    function signTex(lines, w, h, opts) {
        opts = opts || {}; var K = 2, c = document.createElement('canvas'); c.width = w * K; c.height = h * K; var ctx = c.getContext('2d'); ctx.scale(K, K);
        var own = opts.bg !== undefined, r = Math.min(16, h * 0.2), accent = opts.titleColor || '#6fdc8c';
        if (own) { ctx.fillStyle = opts.bg; roundRect(ctx, 2, 2, w - 4, h - 4, r); ctx.fill(); ctx.strokeStyle = opts.line || 'rgba(111,220,140,.6)'; ctx.lineWidth = 3; roundRect(ctx, 2, 2, w - 4, h - 4, r); ctx.stroke(); }
        else {   /* the shop's own sign plate: near-black enamel, a hairline of the sign's colour set in from the edge */
          var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b211f'); g.addColorStop(1, '#0a0d0c'); ctx.fillStyle = g; roundRect(ctx, 1, 1, w - 2, h - 2, r); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; roundRect(ctx, 1, 1, w - 2, h - 2, r); ctx.stroke();
          ctx.strokeStyle = opts.line || accent; ctx.globalAlpha = opts.line ? 1 : 0.55; ctx.lineWidth = 1.5; roundRect(ctx, 6, 6, w - 12, h - 12, Math.max(2, r - 4)); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var fs = opts.size || 30, rows = lines.map(function (l, i) {
          var title = i === 0 && lines.length > 1, size = title ? fs * 1.1 : (lines.length > 1 && !own ? fs * 0.86 : fs), wt = opts.bold || title || (lines.length === 1 && !own) ? '600 ' : '';
          ctx.font = wt + size + 'px ' + SIGN_FONT; var tw = ctx.measureText(l).width, max = w - (own ? 10 : 22); if (tw > max) size = Math.max(6, size * max / tw);
          return { t: l, size: size, wt: wt, col: i === 0 && opts.titleColor ? opts.titleColor : (opts.color || (i === 0 ? '#f3eee0' : '#b9c2b6')) };
        });
        var total = rows.reduce(function (a, rw) { return a + rw.size * 1.22; }, 0), y = h / 2 - total / 2;
        rows.forEach(function (rw) { ctx.font = rw.wt + rw.size + 'px ' + SIGN_FONT; ctx.fillStyle = rw.col; ctx.fillText(rw.t, w / 2, y + rw.size * 0.64); y += rw.size * 1.22; });
        var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
      }
    /* 06-three.js */
    function signBack(m, w, h) {
        var pl = new THREE.Mesh(bevelGeo(w + 0.024, h + 0.024, 0.014, 0.005), MAT.gunmetal); pl.position.z = -0.0085; pl.castShadow = true; pl.userData.noDefight = true; m.add(pl);
        if (w > 0.5 && h > 0.2) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { var st = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), MAT.chrome); st.rotation.x = Math.PI / 2; st.position.set(s[0] * (w / 2 - 0.028), s[1] * (h / 2 - 0.028), 0.003); m.add(st); });
        return m;
      }
    /* 06-three.js */
    var MAT = {
        floor: new THREE.MeshStandardMaterial({ map: TEX.concrete, bumpMap: TEX.concreteBump, bumpScale: 0.02, roughness: 0.85, metalness: 0.05 }),
        tile: new THREE.MeshStandardMaterial({ map: TEX.tile, bumpMap: TEX.tileBump, bumpScale: 0.03, roughness: 0.35, metalness: 0.05 }),
        planks: new THREE.MeshStandardMaterial({ map: TEX.planks, bumpMap: TEX.planksBump, bumpScale: 0.025, roughness: 0.55 }),
        rubber: new THREE.MeshStandardMaterial({ map: TEX.rubber, bumpMap: TEX.rubberBump, bumpScale: 0.03, roughness: 0.9 }),
        wall: new THREE.MeshStandardMaterial({ map: TEX.wall, bumpMap: TEX.wallBump, bumpScale: 0.01, roughness: 0.92 }),
        accent: new THREE.MeshStandardMaterial({ map: TEX.accent, bumpMap: TEX.wallBump, bumpScale: 0.01, roughness: 0.9 }),
        brick: new THREE.MeshStandardMaterial({ map: TEX.brick, bumpMap: TEX.brickBump, bumpScale: 0.06, roughness: 0.95 }),
        brickDark: new THREE.MeshStandardMaterial({ map: TEX.brickDark, bumpMap: TEX.brickBump, bumpScale: 0.06, roughness: 0.9 }),
        ceiling: new THREE.MeshStandardMaterial({ map: TEX.ceiling, bumpMap: TEX.ceilingBump, bumpScale: 0.02, roughness: 1 }),
        trim: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5 }),
        wood: new THREE.MeshStandardMaterial({ map: TEX.wood, bumpMap: TEX.woodBump, bumpScale: 0.006, roughness: 0.52 }),
        darkwood: new THREE.MeshStandardMaterial({ map: TEX.darkwood, bumpMap: TEX.woodBump, bumpScale: 0.006, roughness: 0.48 }),
        metal: new THREE.MeshStandardMaterial({ map: TEX.brushed, color: 0xd0d4da, roughness: 0.4, metalness: 0.85 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.15, metalness: 1.0 }),
        black: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 }),
        plastic: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.05 }),
        tent: new THREE.MeshStandardMaterial({ map: TEX.tent, roughness: 0.9, side: THREE.DoubleSide }),
        mylar: new THREE.MeshStandardMaterial({ map: TEX.mylar, roughness: 0.25, metalness: 0.35, side: THREE.BackSide }),
        pot: new THREE.MeshStandardMaterial({ map: TEX.terracotta, roughness: 0.85 }),
        soil: new THREE.MeshStandardMaterial({ map: TEX.soil, roughness: 1 }),
        stem: new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.8 }),
        leaf: new THREE.MeshStandardMaterial({ map: TEX.leaf, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }),
        glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }),
        screenGlass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.04, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false }),   /* the sheet of glass over a lit screen: nearly invisible head on, a highlight at an angle */
        steel: new THREE.MeshStandardMaterial({ map: TEX.brushed, color: 0x8b929b, roughness: 0.34, metalness: 0.9 }),
        gunmetal: new THREE.MeshStandardMaterial({ map: TEX.brushed, color: 0x4a5058, roughness: 0.38, metalness: 0.85 }),
        alu: new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.28, metalness: 0.92 }),
        gloss: new THREE.MeshPhysicalMaterial({ color: 0x14171b, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }),   /* piano-black plastic: bezels, device shells */
        soft: new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.82, metalness: 0.0 }),   /* soft-touch rubberised plastic: keys, grips, feet */
        brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 1.0 }),
        jar: new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.35, roughness: 0.05 }),
        jarLid: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.4 }),
        bud: new THREE.MeshStandardMaterial({ map: TEX.bud, color: 0x7fc96b, roughness: 0.9 }),
        grass: new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 }),
        foliage: new THREE.MeshStandardMaterial({ map: TEX.foliage, roughness: 0.95 }),
        pine: new THREE.MeshStandardMaterial({ map: TEX.pine, roughness: 0.95 }),
        bark: new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95 }),
        frond: new THREE.MeshStandardMaterial({ map: TEX.frond, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 }),
        bigleaf: new THREE.MeshPhysicalMaterial({ map: TEX.bigleaf, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
        ceramic: new THREE.MeshPhysicalMaterial({ color: 0xeee9dc, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
        tuft: new THREE.MeshStandardMaterial({ map: TEX.tuft, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }),
        flower: new THREE.MeshStandardMaterial({ map: TEX.flower, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
        asphalt: new THREE.MeshStandardMaterial({ map: TEX.asphalt, roughness: 1 }),
        pavement: new THREE.MeshStandardMaterial({ map: TEX.pavement, bumpMap: TEX.pavementBump, bumpScale: 0.03, roughness: 0.95 }),
        tree: new THREE.MeshStandardMaterial({ color: 0x2f6b33, roughness: 1 }),
        trunk: new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 1 }),
        screen: new THREE.MeshStandardMaterial({ color: 0x0b1a12, emissive: 0x2dd67a, emissiveIntensity: 0.6, roughness: 0.3 }),
        counter: new THREE.MeshStandardMaterial({ map: TEX.darkwood, bumpMap: TEX.woodBump, bumpScale: 0.006, color: 0x8a9a8a, roughness: 0.55 }),
        counterTop: new THREE.MeshPhysicalMaterial({ map: TEX.stone, color: 0xd6d1c6, roughness: 0.22, metalness: 0.02, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
        register: new THREE.MeshStandardMaterial({ color: 0x3b4650, roughness: 0.4, metalness: 0.3 }),
        rope: new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }),
        fabric: new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x4a3b5c, roughness: 0.95 }),
        white: new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.6 }),
        highlight: new THREE.MeshBasicMaterial({ color: 0x6fdc8c, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
        none: new THREE.MeshBasicMaterial({ visible: false })
      };
    /* 06-three.js */
    var disposeKeep = { set: null, sig: '' };
    /* 06-three.js */
    function disposeShared() {
        var tabs = [MAT, TEX, typeof PROD_M === 'object' ? PROD_M : null, typeof faceCache === 'object' ? faceCache : null, typeof HUMAN_GEO === 'object' ? HUMAN_GEO : null];
        var geos = [typeof FROND_GEO === 'object' ? FROND_GEO : null, typeof BIGLEAF_GEO === 'object' ? BIGLEAF_GEO : null, typeof LEAF_GEO === 'object' ? LEAF_GEO : null, typeof LEAF_GEO_SM === 'object' ? LEAF_GEO_SM : null, typeof BUD_GEO === 'object' ? BUD_GEO : null];
        var sig = tabs.map(function (tb) { return tb ? Object.keys(tb).length : '-'; }).join(',') + '/' + geos.map(function (g) { return g ? 1 : 0; }).join('');
        if (disposeKeep.set && disposeKeep.sig === sig) return disposeKeep.set;
        var set = new Set();
        tabs.forEach(function (tb) { if (tb) for (var k in tb) { var v = tb[k]; if (v && typeof v === 'object') { set.add(v); if (v.map) set.add(v.map); } } });
        geos.forEach(function (g) { if (g) set.add(g); });
        disposeKeep.set = set; disposeKeep.sig = sig; return set;
      }
    /* 06-three.js */
    function dropTree(root) {
        if (!root || !root.traverse) return; var keep = disposeShared();
        root.traverse(function (o) {
          if (o.geometry && o.geometry.dispose && !o.isSprite && !keep.has(o.geometry) && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();   /* the engine's cached geometries are shared by every mesh built from them */   /* every sprite shares three.js's one quad */
          var ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          ms.forEach(function (m) { if (!m || keep.has(m)) return; if (m.map && m.map.isCanvasTexture && !keep.has(m.map)) m.map.dispose(); if (m.dispose) m.dispose(); });
        });
      }
    /* 06-three.js */
    function dropKids(g) { while (g.children.length) { var ch = g.children[0]; g.remove(ch); dropTree(ch); } }
    /* 06-three.js */
    function colorMat(hex, rough, metal, extra) { var m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough === undefined ? 0.7 : rough, metalness: metal || 0 }); if (extra) for (var k in extra) m[k] = extra[k]; return m; }
    /* 06-three.js */
    function fabricMat(hex) { var m = MAT.fabric.clone(); m.color.setHex(hex); return m; }
    /* 06-three.js */
    function emitMat(hex, intensity) { return new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: intensity || 1.5, roughness: 0.4 }); }
    /* 06-three.js */
    var BLOB_TEX = makeAlphaTex(128, 128, function (ctx, w, h) { ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(0,0,0,.92)'; roundRect(ctx, 34, 34, w - 68, h - 68, 10); ctx.fill(); ctx.fill(); });
    /* 06-three.js */
    var BLOB_MAT = new THREE.MeshBasicMaterial({ map: BLOB_TEX, color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    /* 06-three.js */
    function floorBlob(w, d, x, y, z, parent, k) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.55 + 0.16, d * 1.55 + 0.16), BLOB_MAT); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 1; m.userData.noDefight = true; m.userData.soft = true; m.userData.blob = true; m.raycast = function () {};
        if (k) { m.material = BLOB_MAT.clone(); m.material.opacity = k; } (parent || world.group).add(m); return m;
      }
    /* 06-three.js */
    function archLeafGeo(w, len, bow, fold) { var g = new THREE.PlaneGeometry(w, len, 2, 8); g.translate(0, len / 2, 0); var p = g.attributes.position; for (var i = 0; i < p.count; i++) { var t = p.getY(i) / len, x = p.getX(i); p.setXYZ(i, x, p.getY(i) * (1 - 0.16 * t * t), t * t * bow - Math.abs(x) * fold); } g.computeVertexNormals(); return g; }
    /* 06-three.js */
    var FROND_GEO = archLeafGeo(0.2, 0.78, 0.34, 0.35), BIGLEAF_GEO = archLeafGeo(0.3, 0.52, 0.16, 0.25);
    /* 06-three.js */
    function leafAt(geo, mat, x, y, z, yaw, tilt, sc, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.rotation.set(tilt, yaw, 0); m.scale.setScalar(sc); m.castShadow = true; parent.add(m); return m; }
    /* 06-three.js */
    function bevelSkip(mat) { return !mat || mat === MAT.none || mat === MAT.wall || mat === MAT.accent || mat === MAT.trim || mat === MAT.ceiling || mat === MAT.floor || mat === MAT.tile || mat === MAT.planks || mat === MAT.rubber || mat === MAT.asphalt || mat === MAT.pavement || mat === MAT.grass || mat === MAT.glass || mat.visible === false || !!(mat.userData && mat.userData.tile); }
    /* 06-three.js */
    function interactable(mesh, data) { mesh.userData.interact = data; world.interact.push(mesh); return mesh; }
    /* 06-three.js */
    var tentLight = new THREE.SpotLight(0xffffff, 0, 9, Math.PI / 3.2, 0.5, 1.2);
    /* 06-three.js */
    var tentFill = new THREE.PointLight(0xffffff, 0, 8, 1.5);
    /* 07-building.js */
    var WALL_T = 0.2;
    /* 07-building.js */
    function signPlane(lines, w, h, x, y, z, rotY, opts) {
        opts = opts || {}; var tex = signTex(lines, Math.round(w * 320), Math.round(h * 320), Object.assign({ size: Math.round(h * 48) }, opts));
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); m.position.set(x, y, z); m.rotation.y = rotY || 0; world.group.add(m); if (opts.bg === undefined) signBack(m, w, h); fixtureSign(m, lines); return m;
      }
    /* 08-tent-plants-shelves.js */
    var TENT_ORIGIN = { x: -6.6, z: -6.1 };
    /* 08-tent-plants-shelves.js */
    function tentSize() { var t = TENTS[S.tent]; var big = t.rows >= 4 || t.cols >= 5; var pitch = big ? 1.15 : 1.3, m = big ? 0.5 : 0.6; return { w: t.cols * pitch + m, d: t.rows * pitch + m, cols: t.cols, rows: t.rows, pitch: pitch, m: m }; }
    /* 08-tent-plants-shelves.js */
    function slotPos(i) {
        var ts = tentSize(); var c = i % ts.cols, r = Math.floor(i / ts.cols);
        return { x: TENT_ORIGIN.x - ts.w / 2 + ts.m / 2 + ts.pitch / 2 + c * ts.pitch, z: TENT_ORIGIN.z - ts.d / 2 + ts.m / 2 + ts.pitch / 2 + r * ts.pitch };
      }
    /* 08-tent-plants-shelves.js */
    function makePot(parent, hasSoil) {
        var pot = new THREE.Mesh(roundCylGeo(0.26, 0.2, 0.3, 24), MAT.pot); pot.position.y = 0.15; pot.castShadow = true; pot.receiveShadow = true; parent.add(pot);
        var rim = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.02, 8, 24), MAT.pot); rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; parent.add(rim);
        var band = new THREE.Mesh(roundCylGeo(0.262, 0.262, 0.05, 24), colorMat(0x9a4a22, 0.9)); band.position.y = 0.26; parent.add(band);
        var saucer = new THREE.Mesh(roundCylGeo(0.3, 0.27, 0.025, 24), colorMat(0x8a4020, 0.9)); saucer.position.y = 0.0125; saucer.receiveShadow = true; parent.add(saucer);
        var soil = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.soil); soil.scale.y = 0.12; soil.position.y = 0.285; soil.visible = !!hasSoil; parent.add(soil);
        return { pot: pot, soil: soil };
      }
    /* 08-tent-plants-shelves.js */
    function buildTent() {
        if (world.tentGroup) { world.group.remove(world.tentGroup); dropTree(world.tentGroup); world.interact = world.interact.filter(function (m) { return !m.userData.tent; }); world.obstacles = world.obstacles.filter(function (o) { return o.tag !== 'tent' && o.tag !== 'pot'; }); }
        var g = new THREE.Group(); world.tentGroup = g; world.group.add(g);
        var ts = tentSize(); var h = 2.4; var ox = TENT_ORIGIN.x, oz = TENT_ORIGIN.z;
        // tent shell: back + two sides + roof, open front (toward +z). Mylar inside.
        var back = box(ts.w, h, 0.03, MAT.tent, ox, h / 2, oz - ts.d / 2, { parent: g, solid: true, tag: 'tent' }); back.material = MAT.tent;
        box(0.03, h, ts.d, MAT.tent, ox - ts.w / 2, h / 2, oz, { parent: g, solid: true, tag: 'tent' });
        box(0.03, h, ts.d, MAT.tent, ox + ts.w / 2, h / 2, oz, { parent: g, solid: true, tag: 'tent' });
        box(ts.w, 0.03, ts.d, MAT.tent, ox, h, oz, { parent: g });
        // front top valance so it reads as a tent with a rolled-up door, zipper tapes down both front edges
        box(ts.w, 0.4, 0.03, MAT.tent, ox, h - 0.2, oz + ts.d / 2, { parent: g });
        var roll = new THREE.Mesh(roundCylGeo(0.09, 0.09, ts.w - 0.1, 12), MAT.tent); roll.rotation.z = Math.PI / 2; roll.position.set(ox, h - 0.42, oz + ts.d / 2); g.add(roll);
        var zipM = colorMat(0x8a8d93, 0.5, 0.3); [-1, 1].forEach(function (sd) { var zt = new THREE.Mesh(bevelGeo(0.03, h - 0.4, 0.012), zipM); zt.position.set(ox + sd * (ts.w / 2 - 0.05), (h - 0.4) / 2, oz + ts.d / 2 + 0.02); g.add(zt); var pull = new THREE.Mesh(bevelGeo(0.02, 0.05, 0.02), MAT.chrome); pull.position.set(ox + sd * (ts.w / 2 - 0.05), h - 0.5, oz + ts.d / 2 + 0.03); g.add(pull); });
        // metal frame: corner poles, top rails, a wider foot on each corner
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { cyl(0.022, 0.022, h, MAT.metal, ox + c[0] * ts.w / 2, h / 2, oz + c[1] * ts.d / 2, g, 10); cyl(0.05, 0.06, 0.03, MAT.plastic, ox + c[0] * ts.w / 2, 0.015, oz + c[1] * ts.d / 2, g, 12); var cn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), MAT.plastic); cn.position.set(ox + c[0] * ts.w / 2, h, oz + c[1] * ts.d / 2); g.add(cn); });
        [-1, 1].forEach(function (sd) { var r1 = new THREE.Mesh(roundCylGeo(0.018, 0.018, ts.w, 8), MAT.metal); r1.rotation.z = Math.PI / 2; r1.position.set(ox, h, oz + sd * ts.d / 2); g.add(r1); var r2 = new THREE.Mesh(roundCylGeo(0.018, 0.018, ts.d, 8), MAT.metal); r2.rotation.x = Math.PI / 2; r2.position.set(ox + sd * ts.w / 2, h, oz); g.add(r2); });
        // side vents with mesh, an inline fan + carbon filter hanging under the roof at the back
        [-1, 1].forEach(function (sd) { var vt = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), MAT.tent); vt.rotation.y = Math.PI / 2; vt.position.set(ox + sd * ts.w / 2, 0.7, oz - ts.d / 4); g.add(vt); var mesh = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); mesh.rotation.y = Math.PI / 2; mesh.position.copy(vt.position); g.add(mesh); });
        var cf = new THREE.Mesh(roundCylGeo(0.15, 0.15, 0.55, 16), colorMat(0xe6e6e6, 0.9)); cf.rotation.z = Math.PI / 2; cf.position.set(ox - ts.w / 2 + 0.5, h - 0.25, oz - ts.d / 2 + 0.3); g.add(cf);
        var inl = new THREE.Mesh(roundCylGeo(0.1, 0.1, 0.35, 14), MAT.plastic); inl.rotation.z = Math.PI / 2; inl.position.set(ox - ts.w / 2 + 1.0, h - 0.25, oz - ts.d / 2 + 0.3); g.add(inl);
        var duct2 = new THREE.Mesh(roundCylGeo(0.075, 0.075, ts.w - 1.4, 10), colorMat(0xc5c8cd, 0.4, 0.6)); duct2.rotation.z = Math.PI / 2; duct2.position.set(ox + 0.5, h - 0.25, oz - ts.d / 2 + 0.3); g.add(duct2);
        [0.5, 1.0].forEach(function (dx) { [-0.12, 0.12].forEach(function (dz) { var strap = new THREE.Mesh(bevelGeo(0.02, 0.2, 0.02), MAT.black); strap.position.set(ox - ts.w / 2 + dx, h - 0.1, oz - ts.d / 2 + 0.3 + dz); g.add(strap); }); });
        // mylar liner: a box slightly inside with BackSide material
        var liner = new THREE.Mesh(bevelGeo(ts.w - 0.02, h - 0.02, ts.d - 0.02), [MAT.mylar, MAT.mylar, MAT.mylar, MAT.mylar, MAT.none, MAT.mylar]); liner.position.set(ox, h / 2, oz); g.add(liner);
        // tray floor with a lip, a power strip along the back edge
        box(ts.w - 0.06, 0.03, ts.d - 0.06, MAT.black, ox, 0.015, oz, { parent: g, cast: false });
        box(ts.w - 0.06, 0.05, 0.02, MAT.plastic, ox, 0.025, oz + ts.d / 2 - 0.04, { parent: g, cast: false });
        box(0.3, 0.04, 0.06, MAT.white, ox + ts.w / 2 - 0.4, 0.05, oz - ts.d / 2 + 0.1, { parent: g, cast: false }); for (var ps = 0; ps < 4; ps++) { var sk = new THREE.Mesh(roundCylGeo(0.012, 0.012, 0.01, 8), MAT.black); sk.position.set(ox + ts.w / 2 - 0.51 + ps * 0.07, 0.075, oz - ts.d / 2 + 0.1); g.add(sk); }
        // light rig
        world.lampGroup = new THREE.Group(); g.add(world.lampGroup);
        var L = lightObj(), li = lightIdx();
        var rail = new THREE.Mesh(bevelGeo(ts.w - 0.4, 0.04, 0.04), MAT.metal); rail.position.set(ox, h - 0.1, oz); world.lampGroup.add(rail);
        if (li === 0) {
          // windowsill tier: no lamp; a dangling empty hook and a note
          cyl(0.01, 0.01, 0.4, MAT.metal, ox, h - 0.32, oz, world.lampGroup, 6);
          var hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), MAT.metal); hook.position.set(ox, h - 0.52, oz); world.lampGroup.add(hook);
          var note = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.38), new THREE.MeshBasicMaterial({ map: signTex(['no lamp yet', 'plants use the window'], 512, 160, { size: 42, color: '#ffc857' }), transparent: true, side: THREE.DoubleSide })); note.position.set(ox, h - 0.62, oz); world.lampGroup.add(note);
        } else {
          var lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: L.color, emissiveIntensity: 1.6 + li * 0.4 });
          var n = li === 1 ? 2 : 1; var lw = li === 1 ? 0.25 : Math.min(ts.w - 0.8, 0.6 + ts.cols * 0.35);
          for (var k = 0; k < n; k++) {
            var lx = ox + (n === 1 ? 0 : (k === 0 ? -ts.w / 4 : ts.w / 4));
            // ratchet hangers: two straps with a small buckle each
            [-0.15, 0.15].forEach(function (dz) { cyl(0.006, 0.006, 0.3, MAT.black, lx + dz * (li === 1 ? 0 : lw * 1.5), h - 0.27, oz + (li === 1 ? dz * 0.3 : 0), world.lampGroup, 6); var bk = new THREE.Mesh(bevelGeo(0.03, 0.04, 0.02), MAT.plastic); bk.position.set(lx + dz * (li === 1 ? 0 : lw * 1.5), h - 0.2, oz + (li === 1 ? dz * 0.3 : 0)); world.lampGroup.add(bk); });
            if (li === 1) { var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), lampMat); bulb.position.set(lx, h - 0.5, oz); world.lampGroup.add(bulb); var hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide })); hood.position.set(lx, h - 0.38, oz); world.lampGroup.add(hood); var sock = new THREE.Mesh(roundCylGeo(0.03, 0.03, 0.06, 10), MAT.black); sock.position.set(lx, h - 0.3, oz); world.lampGroup.add(sock); }
            else {
              var dd = li === 2 ? 0.5 : 0.36; var housing = new THREE.Mesh(bevelGeo(lw, 0.08, dd), colorMat(li === 2 ? 0x2a2d33 : 0xd8dce0, 0.4, 0.5)); housing.position.set(lx, h - 0.46, oz); world.lampGroup.add(housing);
              for (var fin = 0; fin < 7; fin++) { var f = new THREE.Mesh(bevelGeo(lw - 0.06, 0.05, 0.01), colorMat(0x8a8f96, 0.4, 0.6)); f.position.set(lx, h - 0.39, oz - dd / 2 + 0.05 + fin * (dd - 0.1) / 6); world.lampGroup.add(f); }
              if (li === 2) { for (var bar = 0; bar < 4; bar++) { var strip = new THREE.Mesh(bevelGeo(lw - 0.08, 0.015, 0.05), lampMat); strip.position.set(lx, h - 0.505, oz - dd / 2 + 0.08 + bar * (dd - 0.16) / 3); world.lampGroup.add(strip); } for (var dio = 0; dio < 10; dio++) { for (var bar2 = 0; bar2 < 4; bar2++) { var d = new THREE.Mesh(bevelGeo(0.02, 0.01, 0.02), colorMat(0xffffff, 0.2, 0.2, { emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.5 })); d.position.set(lx - (lw - 0.14) / 2 + dio * (lw - 0.14) / 9, h - 0.514, oz - dd / 2 + 0.08 + bar2 * (dd - 0.16) / 3); world.lampGroup.add(d); } } }
              else { var refl = new THREE.Mesh(bevelGeo(lw - 0.04, 0.02, dd - 0.04), lampMat); refl.position.set(lx, h - 0.51, oz); world.lampGroup.add(refl); var tube = new THREE.Mesh(roundCylGeo(0.02, 0.02, lw - 0.2, 10), emitMat(0xffd080, 2.2)); tube.rotation.z = Math.PI / 2; tube.position.set(lx, h - 0.53, oz); world.lampGroup.add(tube); var ball = new THREE.Mesh(bevelGeo(0.18, 0.1, 0.12), MAT.plastic); ball.position.set(lx + lw / 2 + 0.1, h - 0.46, oz); world.lampGroup.add(ball); }
            }
          }
          tentLight.color.setHex(L.color);
        }
        tentLight.intensity = L.intensity; tentLight.position.set(ox, h - 0.5, oz); tentLight.target.position.set(ox, 0, oz); tentLight.distance = 7; tentLight.angle = Math.PI / (li >= 2 ? 2.6 : 3.4);
        tentFill.color.setHex(li === 0 ? 0xfff1d0 : L.color); tentFill.intensity = li === 0 ? 0.45 : 0.35 + li * 0.35; tentFill.position.set(ox, h - 0.7, oz); tentFill.distance = Math.max(ts.w, ts.d) + 2;
        // thermometer / hygrometer on the back wall of the tent
        var hyg = new THREE.Mesh(bevelGeo(0.12, 0.08, 0.02), MAT.white); hyg.position.set(ox + ts.w / 2 - 0.4, 1.5, oz - ts.d / 2 + 0.04); g.add(hyg); var hs = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.04), new THREE.MeshBasicMaterial({ map: signTex(['24° 58%'], 160, 80, { size: 40, bg: '#101410', titleColor: '#6fdc8c', line: 'rgba(0,0,0,0)' }) })); hs.position.set(ox + ts.w / 2 - 0.4, 1.5, oz - ts.d / 2 + 0.051); g.add(hs);
        // pots
        for (var i = 0; i < ts.cols * ts.rows; i++) {
          var sp = slotPos(i); var hasPot = i < (S.supplies.pot || 0) || !!plantAtSlot(i);
          var slotG = new THREE.Group(); slotG.position.set(sp.x, 0, sp.z); g.add(slotG);
          if (hasPot) {
            var pm = makePot(slotG, S.potSoil[i] || plantAtSlot(i));
            interactable(pm.pot, { kind: 'slot', slot: i, label: 'Empty pot', tent: true }); pm.pot.userData.tent = true;
            world.obstacles.push({ x1: sp.x - 0.2, x2: sp.x + 0.2, z1: sp.z - 0.2, z2: sp.z + 0.2, tag: 'pot' });   // slim enough to squeeze between the rows of a packed tent
            if (S.upgrades.autowater) { var stake = new THREE.Mesh(roundCylGeo(0.006, 0.006, 0.2, 6), MAT.plastic); stake.position.set(0.15, 0.38, 0.1); slotG.add(stake); var dripper = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), MAT.plastic); dripper.position.set(0.15, 0.48, 0.1); slotG.add(dripper); }
          } else {
            var marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 24), MAT.highlight); marker.rotation.x = -Math.PI / 2; marker.position.y = 0.04; slotG.add(marker);
            var markerHit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), MAT.none); markerHit.position.y = 0.15; slotG.add(markerHit);
            interactable(markerHit, { kind: 'slot', slot: i, label: 'Empty slot (no pot)', tent: true, noPot: true }); markerHit.userData.tent = true;
          }
          slotG.userData.slot = i;
        }
        // drip lines when auto-waterer owned: a manifold along the back with a feed line to every pot, and the reservoir
        if (S.upgrades.autowater) {
          var tubeM = colorMat(0x222a33, 0.6); var tube = new THREE.Mesh(roundCylGeo(0.015, 0.015, ts.w - 0.3, 6), tubeM); tube.rotation.z = Math.PI / 2; tube.position.set(ox, 0.36, oz - ts.d / 2 + 0.2); g.add(tube);
          for (var q = 0; q < ts.cols * ts.rows; q++) { var qp = slotPos(q); var len = qp.z + 0.1 - (oz - ts.d / 2 + 0.2); var ft = new THREE.Mesh(roundCylGeo(0.006, 0.006, len, 5), tubeM); ft.rotation.x = Math.PI / 2; ft.position.set(qp.x + 0.15, 0.36, oz - ts.d / 2 + 0.2 + len / 2); g.add(ft); }
          var res = box(0.4, 0.6, 0.4, colorMat(0x2b6fb3, 0.4), ox + ts.w / 2 + 0.35, 0.3, oz - ts.d / 2 + 0.3, { parent: g }); box(0.42, 0.04, 0.42, colorMat(0x1f4f80, 0.5), ox + ts.w / 2 + 0.35, 0.62, oz - ts.d / 2 + 0.3, { parent: g }); box(0.14, 0.1, 0.1, MAT.plastic, ox + ts.w / 2 + 0.35, 0.69, oz - ts.d / 2 + 0.3, { parent: g });
          var lvl = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.4), new THREE.MeshBasicMaterial({ color: 0x9fd8ff })); lvl.position.set(ox + ts.w / 2 + 0.35, 0.3, oz - ts.d / 2 + 0.505); g.add(lvl);
          world.obstacles.push({ x1: ox + ts.w / 2 + 0.1, x2: ox + ts.w / 2 + 0.6, z1: oz - ts.d / 2 + 0.05, z2: oz - ts.d / 2 + 0.55, tag: 'tent' });
        }
        // security camera when owned
        if (S.upgrades.security) { var cam = box(0.16, 0.1, 0.24, MAT.black, ox + ts.w / 2 - 0.15, h - 0.15, oz + ts.d / 2 - 0.15, { parent: g }); cam.rotation.y = -0.6; var lens = new THREE.Mesh(roundCylGeo(0.03, 0.04, 0.04, 12), MAT.black); lens.rotation.x = Math.PI / 2; lens.rotation.y = -0.6; lens.position.set(ox + ts.w / 2 - 0.22, h - 0.15, oz + ts.d / 2 - 0.05); g.add(lens); var led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), emitMat(0xff0000, 2)); led.position.set(ox + ts.w / 2 - 0.05, h - 0.15, oz + ts.d / 2 - 0.05); g.add(led); }
        // tent sign
        var tentSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: signTex(['GROW TENT', ts.cols * ts.rows + ' slots · ' + L.name], 512, 170, { size: 40, titleColor: '#6fdc8c' }), transparent: true })); tentSign.position.set(ox, h - 0.2, oz + ts.d / 2 + 0.03); g.add(tentSign);
        g.traverse(function (o) { if (o.isMesh) o.userData.propId = 'tent'; });
        // rebuild plants
        for (var pid in world.plants) { var pm2 = world.plants[pid]; if (pm2.parent) pm2.parent.remove(pm2); }
        world.plants = {};
        syncPlants();
      }
    /* 08-tent-plants-shelves.js */
    var LEAF_GEO = archLeafGeo(0.27, 0.48, -0.13, -0.16);
    /* 08-tent-plants-shelves.js */
    var LEAF_GEO_SM = archLeafGeo(0.17, 0.31, -0.08, -0.14);
    /* 08-tent-plants-shelves.js */
    var BUD_GEO = (function () { var g = new THREE.IcosahedronGeometry(0.05, 2), p = g.attributes.position; for (var i = 0; i < p.count; i++) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.2 * Math.sin(x * 95 + 1) * Math.sin(y * 85 + 2) * Math.sin(z * 75 + 3) + 0.1 * Math.sin(x * 210) * Math.sin(z * 190); p.setXYZ(i, x * k, y * k * 1.15, z * k); } g.computeVertexNormals(); return g; })();
    /* 08-tent-plants-shelves.js */
    function makePlantMesh(p) {
        var st = strainById(p.strain); var g = new THREE.Group();
        var stemM = MAT.stem.clone(); stemM.color.setHex(st.leaf).lerp(new THREE.Color(0x6a5a3a), 0.35);
        var stem = new THREE.Mesh(roundCylGeo(0.01, 0.024, 1, 10), stemM); stem.castShadow = true; g.add(stem);
        var leafMat = MAT.leaf.clone(); leafMat.color.setHex(st.leaf); g.userData.leafMat = leafMat;
        var leaves = new THREE.Group(); g.add(leaves);
        // nodes climb the stem; each carries two opposite fan leaves and, higher up, a short side branch with its own leaf
        var NODES = 7;
        for (var i = 0; i < NODES; i++) {
          var node = new THREE.Group(); node.rotation.y = i * 2.4 + Math.random() * 0.3; node.userData.h = 0.12 + (i / (NODES - 1)) * 0.82; node.userData.order = i; leaves.add(node);
          [0, Math.PI].forEach(function (side) {
            var holder = new THREE.Group(); holder.rotation.y = side; node.add(holder);
            var lf = new THREE.Mesh(LEAF_GEO, leafMat); lf.castShadow = true; lf.position.set(0, 0, 0.02); lf.rotation.x = -1.0 - Math.random() * 0.3; holder.add(lf); holder.userData.tilt = lf;
            var petiole = new THREE.Mesh(roundCylGeo(0.004, 0.006, 0.12, 5), stemM); petiole.position.set(0, 0.02, 0.06); petiole.rotation.x = -1.1; holder.add(petiole);
          });
          if (i >= 2) {
            var br = new THREE.Group(); br.rotation.y = Math.PI / 2 + Math.random() * 0.4; node.add(br); node.userData.branch = br;
            var bl = 0.14 + (NODES - i) * 0.03; var bs = new THREE.Mesh(roundCylGeo(0.005, 0.009, bl, 6), stemM); bs.position.set(0, bl * 0.35, bl * 0.35); bs.rotation.x = -0.8; br.add(bs);
            var bh = new THREE.Group(); bh.position.set(0, bl * 0.7, bl * 0.7); br.add(bh); var blf = new THREE.Mesh(LEAF_GEO_SM, leafMat); blf.rotation.x = -0.9; blf.castShadow = true; bh.add(blf); bh.userData.tilt = blf;
            var sb = new THREE.Group(); sb.position.copy(bh.position); br.add(sb); node.userData.sideBuds = sb;
            for (var q2 = 0; q2 < 3; q2++) { var sbud = new THREE.Mesh(BUD_GEO, null); sbud.position.set((Math.random() - 0.5) * 0.04, q2 * 0.035, (Math.random() - 0.5) * 0.04); sbud.userData.base = sbud.position.clone(); sb.add(sbud); }
          }
        }
        g.userData.leaves = leaves;
        // main cola: a stack of calyx clusters with pistils, denser toward the top
        var buds = new THREE.Group(); g.add(buds);
        var budMat = MAT.bud.clone(); budMat.color.setHex(st.bud); g.userData.budMat = budMat;
        var hairMat = new THREE.MeshStandardMaterial({ color: st.hair, roughness: 1 }); g.userData.hairMat = hairMat;
        for (var b = 0; b < 11; b++) {
          var bud = new THREE.Mesh(BUD_GEO, budMat); bud.castShadow = true; bud.rotation.set(Math.random() * 3, Math.random() * 6.28, Math.random() * 3);
          var ba = b * 2.4, brad = 0.06 * (1 - b / 14); bud.position.set(Math.cos(ba) * brad, 0.72 + b * 0.04, Math.sin(ba) * brad);   /* a spiral up the cola, drawing in toward the tip */ bud.userData.base = bud.position.clone(); bud.userData.rs = 0.75 + Math.random() * 0.5;
          for (var hh = 0; hh < 3; hh++) { var hair = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.05, 5), hairMat); var ha = Math.random() * 6.28; hair.position.set(Math.cos(ha) * 0.04, 0.01 + Math.random() * 0.03, Math.sin(ha) * 0.04); hair.rotation.set(Math.random() - 0.5, 0, Math.random() - 0.5); bud.add(hair); }
          var sugar = new THREE.Mesh(LEAF_GEO_SM, leafMat); sugar.scale.set(0.45, 0.45, 0.45); sugar.position.set(0.03, -0.02, 0); sugar.rotation.set(-0.6, Math.random() * 6.28, 0); bud.add(sugar);
          buds.add(bud);
        }
        g.userData.buds = buds;
        g.traverse(function (o) { if (o.isMesh && o.material === null) o.material = budMat; });
        // trichome sparkle when ready
        var spN = 40, spPos = new Float32Array(spN * 3); for (var s = 0; s < spN; s++) { spPos[s * 3] = (Math.random() - 0.5) * 0.24; spPos[s * 3 + 1] = Math.random() * 0.4; spPos[s * 3 + 2] = (Math.random() - 0.5) * 0.24; }
        var spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
        var sparkle = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.0, depthWrite: false })); sparkle.visible = false; g.add(sparkle); g.userData.sparkle = sparkle;
        // hazard visuals
        var pests = new THREE.Group(); g.add(pests);
        for (var k = 0; k < 12; k++) { var m = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), colorMat(0x3a2a1a, 1)); m.scale.set(1, 0.7, 1.3); m.userData.a = Math.random() * 6.28; m.userData.r = 0.1 + Math.random() * 0.2; m.userData.h = 0.2 + Math.random() * 0.6; pests.add(m); }
        var web = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); web.position.set(0.1, 0.5, 0.1); web.rotation.set(-0.4, 0.5, 0.3); pests.add(web);
        pests.visible = false; g.userData.pests = pests;
        var mold = new THREE.Group(); g.add(mold);
        for (var q = 0; q < 8; q++) { var mm = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd8dcd0, roughness: 1, transparent: true, opacity: 0.85 })); mm.scale.y = 0.5; mm.position.set((Math.random() - 0.5) * 0.24, 0.3 + Math.random() * 0.55, (Math.random() - 0.5) * 0.24); mold.add(mm); }
        mold.visible = false; g.userData.mold = mold;
        // status label sprite
        var label = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex([''], 8, 8), transparent: true, depthWrite: false })); label.scale.set(0.9, 0.36, 1); label.position.y = 1.55; g.add(label); g.userData.label = label; g.userData.labelKey = '';
        g.userData.plantId = p.id;
        return g;
      }
    /* 08-tent-plants-shelves.js */
    function syncPlants() {
        // ensure every plant has a mesh in the right slot; remove stale
        var seen = {};
        for (var i = 0; i < S.plants.length; i++) {
          var p = S.plants[i]; seen[p.id] = true; var sp = slotPos(p.slot);
          var m = world.plants[p.id];
          if (!m) { m = makePlantMesh(p); world.plants[p.id] = m; world.tentGroup.add(m); interactable(m.children[0], { kind: 'plant', pid: p.id, tent: true }); m.children[0].userData.tent = true; m.userData.hit = m.children[0]; }
          m.position.set(sp.x, 0.3, sp.z);
          m.userData.slot = p.slot;
        }
        for (var pid in world.plants) if (!seen[pid]) { var mm = world.plants[pid]; world.tentGroup.remove(mm); dropTree(mm); world.interact = world.interact.filter(function (x) { return x !== mm.userData.hit; }); delete world.plants[pid]; }
      }
    /* 08-tent-plants-shelves.js */
    var GOODS_ROWS = 3, GOODS_CELL = 0.85;
    /* 08-tent-plants-shelves.js */
    function goodsCols() { return Math.max(2, Math.ceil(STRAINS.length / GOODS_ROWS)); }
    /* 08-tent-plants-shelves.js */
    function goodsWidth() { return goodsCols() * GOODS_CELL; }
    /* 08-tent-plants-shelves.js */
    function syncGoods() {
        var inst = propInst.goodsShelf; if (!inst) return;
        var gg = inst.ctx.dynGroup(); var gate = gg.userData.shutter; dropKids(gg); if (gate) gg.add(gate);   /* restocking must not throw the roll gate away with the goods */
        world.interact = world.interact.filter(function (m) { return m.userData.dynGroup !== 'goods'; });
        var cellW = 0.8, cellY = [0.185, 0.76, 1.32], cols = goodsCols();
        STRAINS.forEach(function (st, i) {
          var col = i % cols, row = Math.floor(i / cols); if (row > GOODS_ROWS - 1) return;
          var cx = (col - (cols - 1) / 2) * GOODS_CELL, cy = cellY[2 - row]; var bags = lotOf('bags', st.id), joints = lotOf('joints', st.id), stash = stashOf(st.id);
          var cookies = lotOf('cookies', st.id); var any = bags.n > 0 || joints.n > 0 || cookies.n > 0 || stash.g > 0;
          // price card on the back panel
          var bq = bags.n ? bags.qSum / bags.n : 0, jq = joints.n ? joints.qSum / joints.n : 0;
          var lines = [st.emoji + ' ' + st.name, any ? ('bags ' + bags.n + (bags.n ? ' · ' + money(bagPrice(bq, bags.thcSum / bags.n)) : '') + '   joints ' + joints.n + (joints.n ? ' · ' + money(jointPrice(jq, joints.thcSum / joints.n)) : '') + (cookies.n ? '   cookies ' + cookies.n + ' · ' + money(cookiePrice(cookies.qSum / cookies.n, cookies.thcSum / cookies.n)) : '')) : 'sold out'];
          var card = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.12), new THREE.MeshBasicMaterial({ map: signTex(lines, 448, 78, { size: 26, bg: any ? '#f3e9cf' : '#d9d2c2', color: '#222', titleColor: any ? '#1a6a2a' : '#666', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide })); card.position.set(cx, cy - 0.075, 0.222); card.rotation.x = -0.35; gg.add(card);   // price tag hangs off the front lip of each shelf, tilted up so the low rows read from standing height
          // bags: stacked flat, three per layer
          for (var b = 0; b < Math.min(bags.n, 9); b++) { var bm = productBaggie(st, 1.15); bm.position.set(cx - 0.26 + (b % 3) * 0.11, cy + 0.05 + Math.floor(b / 3) * 0.05, 0.02 + (b % 2) * 0.03); bm.rotation.set(-1.35, (b % 3 - 1) * 0.12, 0); gg.add(bm); }   /* the same baggie the customer is handed */
          if (bags.n > 0) { var bh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.3), MAT.none); bh.position.set(cx - 0.16, cy + 0.14, 0.02); gg.add(bh); interactable(bh, { kind: 'lot', item: 'bags', strain: st.id }); bh.userData.dynGroup = 'goods'; bh.userData.propId = 'goodsShelf'; }
          // cookies: a small jar in the middle of the cell
          if (cookies.n > 0) { var cj = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 14, 1, true), MAT.jar); cj.position.set(cx + 0.02, cy + 0.07, 0.06); gg.add(cj); var cjl = new THREE.Mesh(roundCylGeo(0.058, 0.058, 0.015, 14), MAT.jarLid); cjl.position.set(cx + 0.02, cy + 0.145, 0.06); gg.add(cjl); for (var ck2 = 0; ck2 < Math.min(cookies.n, 6); ck2++) { var cm = new THREE.Mesh(roundCylGeo(0.04, 0.04, 0.012, 10), colorMat(0xb5763a, 0.9)); cm.position.set(cx + 0.02, cy + 0.012 + ck2 * 0.018, 0.06); cm.rotation.y = ck2 * 0.5; gg.add(cm); } var ch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.16), MAT.none); ch.position.set(cx + 0.02, cy + 0.1, 0.06); gg.add(ch); interactable(ch, { kind: 'lot', item: 'cookies', strain: st.id }); ch.userData.dynGroup = 'goods'; ch.userData.propId = 'goodsShelf'; }
          // joints: standing in a glass tube
          var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 14, 1, true), MAT.jar); tube.position.set(cx + 0.2, cy + 0.1, 0.03); gg.add(tube);
          var tbase = new THREE.Mesh(roundCylGeo(0.062, 0.062, 0.015, 14), MAT.darkwood); tbase.position.set(cx + 0.2, cy + 0.008, 0.03); gg.add(tbase);
          for (var j = 0; j < Math.min(joints.n, 12); j++) { var ja = j / 12 * Math.PI * 2, jr = j < 6 ? 0.02 : 0.04; var jm = productJoint(1.7); jm.position.set(cx + 0.2 + Math.cos(ja) * jr, cy + 0.1, 0.03 + Math.sin(ja) * jr); jm.rotation.z = (j % 2 ? 1 : -1) * 0.08; gg.add(jm); }
          if (joints.n > 0) { var jh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.3), MAT.none); jh.position.set(cx + 0.2, cy + 0.14, 0.02); gg.add(jh); interactable(jh, { kind: 'lot', item: 'joints', strain: st.id }); jh.userData.dynGroup = 'goods'; jh.userData.propId = 'goodsShelf'; }
        });
        gg.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'goodsShelf'; });
      }
    /* 08-tent-plants-shelves.js */
    var RACK = { cols: 6, y: [0.12, 0.66, 1.2, 1.74], w: 3.0 };
    /* 08-tent-plants-shelves.js */
    function rackBayX(i) { return -RACK.w / 2 + RACK.w / RACK.cols * (i % RACK.cols + 0.5); }
    /* 08-tent-plants-shelves.js */
    function rackBayY(i) { return RACK.y[Math.floor(i / RACK.cols)]; }
    /* 08-tent-plants-shelves.js */
    function rackBayCode(i) { return 'ABCD'.charAt(Math.floor(i / RACK.cols)) + (i % RACK.cols + 1); }
    /* 08-tent-plants-shelves.js */
    function rackBays() {   // item -> bay, kept in the save; a bay is freed when its item runs out
        var X = xs(); if (!X.bays || typeof X.bays !== 'object') X.bays = {};
        var B = X.bays, n = RACK.cols * RACK.y.length;
        Object.keys(B).forEach(function (k) { if (!((S.storage[k] || 0) > 0) || !(B[k] >= 0 && B[k] < n)) delete B[k]; });
        Object.keys(S.storage).forEach(function (k) {
          if (!((S.storage[k] || 0) > 0) || B[k] !== undefined) return;
          var used = {}; Object.keys(B).forEach(function (q) { used[B[q]] = true; });
          for (var i = 0; i < n; i++) if (!used[i]) { B[k] = i; break; }
        });
        return B;
      }
    /* 08-tent-plants-shelves.js */
    function crateMesh(id, w, h, d) {   // a taped kraft carton with the item's icon on its face
        var G = new THREE.Group();
        var body = new THREE.Mesh(bevelGeo(w, h, d), prodMat('crateKraft', function () { return new THREE.MeshStandardMaterial({ color: 0xa8804a, roughness: 0.9 }); })); body.castShadow = true; G.add(body);
        var tape = new THREE.Mesh(bevelGeo(w + 0.01, 0.025, d + 0.01), prodMat('crateTape', function () { return new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }); })); G.add(tape);
        var face = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, h) * 0.7, Math.min(w, h) * 0.7), prodMat('crateIco' + id, function () { return new THREE.MeshBasicMaterial({ map: signTex([itemIcon(id)], 96, 96, { size: 64, bg: '#f3e9cf', line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        face.position.z = d / 2 + 0.002; G.add(face);
        return G;
      }
    /* 08-tent-plants-shelves.js */
    function syncStorage() {
        var inst = propInst.storeRack; if (!inst) return;
        var gg = inst.ctx.dynGroup(); dropKids(gg);
        world.interact = world.interact.filter(function (m) { return m.userData.dynGroup !== 'storage'; });
        var B = rackBays(), byBay = {}; Object.keys(B).forEach(function (k) { byBay[B[k]] = k; });
        var plateOpt = { size: 30, bg: '#f7f3e6', color: '#1c1f24', titleColor: '#1c1f24', line: 'rgba(0,0,0,0)' };
        for (var i = 0; i < RACK.cols * RACK.y.length; i++) {
          var x = rackBayX(i), y = rackBayY(i), id = byBay[i], code = rackBayCode(i);
          var plateM = id ? new THREE.MeshBasicMaterial({ map: signTex([code + '  ' + itemIcon(id) + ' ' + itemName(id) + '  ×' + S.storage[id]], 500, 90, plateOpt) })
            : prodMat('bayPlate' + code, function () { return new THREE.MeshBasicMaterial({ map: signTex([code + '  empty'], 500, 90, Object.assign({}, plateOpt, { color: '#8a8f96', titleColor: '#8a8f96' })) }); });
          var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.09), plateM); plate.position.set(x, y - 0.035, 0.296); gg.add(plate);
          if (!id) continue;
          var stacks = Math.min(2, Math.ceil(S.storage[id] / itemPack(id)));
          for (var s = 0; s < stacks; s++) { var cr = crateMesh(id, 0.36, 0.2, 0.3); cr.position.set(x, y + 0.11 + s * 0.21, 0.04); gg.add(cr); }
          var hit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.21 * stacks + 0.1, 0.42), MAT.none); hit.position.set(x, y + 0.105 * stacks + 0.05, 0.02); gg.add(hit); interactable(hit, { kind: 'storeItem', item: id, bay: i }); hit.userData.dynGroup = 'storage'; hit.userData.propId = 'storeRack';
        }
        gg.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'storeRack'; });
      }
    /* 08-tent-plants-shelves.js */
    function syncDisplay() {
        var dg = world.displayGroup; if (!dg) return; dropKids(dg); var d = S.display || {};
        for (var i = 0; i < Math.min(d.lighter || 0, 8); i++) { var lt = new THREE.Mesh(bevelGeo(0.025, 0.07, 0.012), colorMat([0xc94a3a, 0x2f6b9a, 0x3aa36a, 0xffd166, 0xf2f2f2, 0x7a5aa8][i % 6], 0.4)); lt.position.set(0.73 + i * 0.045, 1.12, 4.32); dg.add(lt); var cap = new THREE.Mesh(bevelGeo(0.025, 0.015, 0.012), MAT.chrome); cap.position.set(0.73 + i * 0.045, 1.163, 4.32); dg.add(cap); }
        for (var p = 0; p < Math.min(d.rpaper || 0, 5); p++) { var pk = new THREE.Mesh(bevelGeo(0.05, 0.075, 0.012), colorMat(p % 2 ? 0xf5f0e0 : 0xd9b36a, 0.8)); pk.position.set(0.75 + p * 0.065, 1.195, 4.18); pk.rotation.x = 0.15; dg.add(pk); }
        for (var q = 0; q < Math.min(d.rgrinder || 0, 3); q++) { var gr = new THREE.Mesh(roundCylGeo(0.028, 0.028, 0.03, 12), colorMat([0x2a2d33, 0x8a6a2a, 0x3a3f46][q], 0.4, 0.6)); gr.position.set(1.07 + q * 0.065, 1.1, 4.3); dg.add(gr); }
        dg.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = 'counter'; } });
      }
    /* 08-tent-plants-shelves.js */
    function syncShelf() {
        if (!propInst.cureShelf || !propInst.dryRack || !propInst.bench) return;
        var g = propInst.cureShelf.ctx.dynGroup(); dropKids(g);
        var lg = propInst.dryRack.ctx.dynGroup(); dropKids(lg);
        var bg = propInst.bench.ctx.dynGroup(); dropKids(bg);
        world.interact = world.interact.filter(function (m) { return m.userData.dynGroup !== 'shelf' && m.userData.dynGroup !== 'bench'; });
        syncGoods(); syncStorage(); syncDisplay();
        var jarsOwned = S.supplies.jar || 0;
        var cured = S.batches.filter(function (b) { return b.cured; }); var drying = S.batches.filter(function (b) { return !b.cured; });
        var total = Math.max(jarsOwned, cured.length);
        for (var i = 0; i < Math.min(total, 24); i++) {
          var row = Math.floor(i / 6), col = i % 6; var x = -1.25 + col * 0.5, y = 0.52 + row * 0.55, z = 0;
          var filled = i < cured.length;
          var jar = new THREE.Mesh(roundCylGeo(0.09, 0.09, 0.2, 14), MAT.jar); jar.position.set(x, y + 0.1, z); g.add(jar);
          if (filled) { var jh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), MAT.none); jh.position.set(x, y + 0.12, z); g.add(jh); interactable(jh, { kind: 'jar', bid: cured[i].id }); jh.userData.dynGroup = 'shelf'; jh.userData.propId = 'cureShelf'; }
          var lid = new THREE.Mesh(roundCylGeo(0.095, 0.095, 0.025, 14), MAT.jarLid); lid.position.set(x, y + 0.21, z); g.add(lid);
          if (filled) { var b = cured[i]; var bst2 = strainById(b.strain || 'sunflower'), fl2 = clamp(b.grams / 24, 0.3, 1); var nugM2 = prodMat('jarnug' + bst2.id, function () { return new THREE.MeshStandardMaterial({ color: bst2.bud, roughness: 0.9 }); }); var nugD2 = prodMat('jarnugd' + bst2.id, function () { return new THREE.MeshStandardMaterial({ color: mixHex(bst2.bud, 0x30401f, 0.38), roughness: 0.95 }); }); for (var nz2 = 0; nz2 < Math.round(5 + fl2 * 13); nz2++) { var na2 = nz2 * 2.399, nr2 = 0.05 * Math.sqrt(((nz2 % 7) / 7) + 0.14); var nm2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.019 + (nz2 % 3) * 0.005, 0), nz2 % 4 === 0 ? nugD2 : nugM2); nm2.position.set(x + Math.cos(na2) * nr2, y + 0.025 + (nz2 % 5) * 0.026 * fl2, z + Math.sin(na2) * nr2); nm2.scale.set(1, 0.8, 1); nm2.rotation.set(na2, na2 * 1.7, 0.3); nm2.castShadow = false; g.add(nm2); } var waits = i >= cureSlots(); var lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: signTex(waits ? [gram(b.grams) + ' q' + Math.round(b.quality), 'waiting for a jar'] : [gram(b.grams) + ' q' + Math.round(b.quality)], 160, 60, { size: waits ? 18 : 30, bg: waits ? '#f3d9b0' : '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,0)' }) })); lbl.position.set(x, y + 0.1, z + 0.095); g.add(lbl); }
        }
        if (S.upgrades.rack) { var rack = new THREE.Mesh(bevelGeo(3.0, 0.02, 0.45), MAT.metal); rack.position.set(0, 2.75, 0); g.add(rack); }
        var hw = 3.25, ly = 2.1; var n = drying.length;
        for (var d = 0; d < n; d++) {
          var bx = -hw + 0.4 + (d % 14) * ((hw * 2 - 0.8) / 13); var b2 = drying[d];
          var peg = new THREE.Mesh(bevelGeo(0.02, 0.07, 0.015), new THREE.MeshStandardMaterial({ color: 0xd9c9a0 })); peg.position.set(bx, ly - 0.14, 0); lg.add(peg);
          var str = new THREE.Mesh(roundCylGeo(0.006, 0.006, 0.12, 4), MAT.rope); str.position.set(bx, ly - 0.23, 0); lg.add(str);
          var bunch = new THREE.Group(); bunch.position.set(bx, ly - 0.3, 0); lg.add(bunch);
          var col2 = strainById(b2.strain || 'sunflower');
          for (var k = 0; k < 5; k++) { var bb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + Math.random() * 0.03, 1), new THREE.MeshStandardMaterial({ color: col2.bud, roughness: 1 })); bb.position.set((Math.random() - 0.5) * 0.08, -k * 0.07, (Math.random() - 0.5) * 0.08); bb.castShadow = true; bunch.add(bb); }
          var lp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.3), MAT.leaf); lp.position.set(0.02, -0.2, 0.03); lp.rotation.x = Math.PI; bunch.add(lp);
        }
        // bench contents (local: bench runs along x, working side is +z; the stash jar sits left, packed goods pile right)
        var by = 0.93;
        if (S.supplies.grinder) { var gr = new THREE.Mesh(roundCylGeo(0.06, 0.06, 0.05, 20), MAT.chrome); gr.position.set(-0.45, by + 0.025, 0.1); bg.add(gr); var grTop = new THREE.Mesh(roundCylGeo(0.06, 0.06, 0.02, 20), colorMat(0x3a3f46, 0.4, 0.6)); grTop.position.set(-0.45, by + 0.06, 0.1); bg.add(grTop); for (var gt = 0; gt < 8; gt++) { var tooth = new THREE.Mesh(bevelGeo(0.012, 0.012, 0.012), MAT.chrome); var ga = gt / 8 * Math.PI * 2; tooth.position.set(-0.45 + Math.cos(ga) * 0.035, by + 0.075, 0.1 + Math.sin(ga) * 0.035); bg.add(tooth); } var gl = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshBasicMaterial({ map: signTex(['GRIND'], 80, 30, { size: 20, bg: 'rgba(0,0,0,0)', color: '#e8f1ea', titleColor: '#e8f1ea', line: 'rgba(0,0,0,0)' }), transparent: true })); gl.position.set(-0.45, by + 0.025, 0.161); bg.add(gl); }
        if (S.upgrades.roller) { var rm = new THREE.Mesh(bevelGeo(0.34, 0.14, 0.22), colorMat(0x2a2d33, 0.4, 0.3)); rm.position.set(0.55, by + 0.07, -0.05); bg.add(rm); var rmTop = new THREE.Mesh(bevelGeo(0.3, 0.02, 0.18), MAT.chrome); rmTop.position.set(0.55, by + 0.15, -0.05); bg.add(rmTop); var slot = new THREE.Mesh(bevelGeo(0.2, 0.03, 0.03), MAT.black); slot.position.set(0.55, by + 0.1, 0.07); bg.add(slot); var rmled = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), emitMat(0x00ff66, 2)); rmled.position.set(0.68, by + 0.12, 0.065); bg.add(rmled); }
        if ((S.supplies.bag || 0) > 0) { var bagbox = new THREE.Mesh(bevelGeo(0.16, 0.1, 0.1), colorMat(0xe8e8ee, 0.6)); bagbox.position.set(-0.15, by + 0.05, -0.22); bg.add(bagbox); var bagLbl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshBasicMaterial({ map: signTex(['BAGGIES'], 120, 50, { size: 24, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,0)' }) })); bagLbl.position.set(-0.15, by + 0.05, -0.169); bg.add(bagLbl); }
        if ((S.supplies.paper || 0) > 0) { var pp = new THREE.Mesh(bevelGeo(0.08, 0.02, 0.05), colorMat(0xffffff, 0.6)); pp.position.set(0.05, by + 0.01, -0.22); bg.add(pp); var pp2 = new THREE.Mesh(bevelGeo(0.08, 0.02, 0.05), colorMat(0xd8c8a0, 0.6)); pp2.position.set(0.14, by + 0.01, -0.2); pp2.rotation.y = 0.3; bg.add(pp2); }
        var toShelf = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.07), new THREE.MeshBasicMaterial({ map: signTex(['packed goods → shelf'], 300, 70, { size: 24, bg: '#f3e9cf', color: '#222', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }), transparent: true })); toShelf.position.set(1.0, by + 0.001, 0.2); toShelf.rotation.x = -Math.PI / 2; bg.add(toShelf);
        var stash = new THREE.Mesh(roundCylGeo(0.11, 0.11, 0.26, 20), MAT.jar); stash.position.set(-0.85, by + 0.13, -0.12); bg.add(stash); var stashLid = new THREE.Mesh(roundCylGeo(0.115, 0.115, 0.03, 20), MAT.jarLid); stashLid.position.set(-0.85, by + 0.275, -0.12); bg.add(stashLid);
        if (S.cured.g > 0) { var fill = clamp(S.cured.g / 60, 0.08, 1); var sm = new THREE.Mesh(roundCylGeo(0.095, 0.095, 0.22 * fill, 14), MAT.bud); sm.position.set(-0.85, by + 0.02 + 0.11 * fill, -0.12); bg.add(sm); }
        var stashLbl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07), new THREE.MeshBasicMaterial({ map: signTex(['STASH', gram(S.cured.g)], 160, 70, { size: 26, bg: '#f3e9cf', color: '#222', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }), transparent: true })); stashLbl.position.set(-0.85, by + 0.12, -0.12 + 0.111); bg.add(stashLbl);
        bg.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'bench'; }); g.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'cureShelf'; }); lg.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'dryRack'; });
      }
    /* 09-humans-guard.js */
    var SKINS = [0xf1c9a5, 0xe0ac7e, 0xc68642, 0x8d5524, 0xffdbb4, 0x5c3a1e];
    /* 09-humans-guard.js */
    var HAIRS = [0x2b1b12, 0x5a3a1a, 0xc08a2a, 0x9a2f1a, 0x222222, 0xb9b9b9, 0x7a4a9a, 0x3a1a0a];
    /* 09-humans-guard.js */
    var SHIRTS = [0x4a7fbf, 0xd64a9a, 0x3aa36a, 0xe0c25a, 0xc94a3a, 0x7a5aa8, 0xf2f2f2, 0x2a2a2a, 0xff8c42];
    /* 09-humans-guard.js */
    var PANTS = [0x2a3a5a, 0x333333, 0x6a5a4a, 0x8a8a8a, 0x3a5a3a];
    /* 09-humans-guard.js */
    var faceCache = {};
    /* 09-humans-guard.js */
    function personFace(mood, glasses, spec, blink) {
        spec = spec || {}; var key = mood + (glasses ? 'g' : '') + (spec.lipstick ? 'l' : '') + (spec.freckles ? 'f' : '') + (spec.eyeColor || '') + (blink ? 'b' : ''); if (faceCache[key]) return faceCache[key];
        var c = document.createElement('canvas'); c.width = c.height = 256; var ctx = c.getContext('2d'); ctx.clearRect(0, 0, 256, 256);
        var eyeY = 112, iris = spec.eyeColor || '#3a5a8a', closed = blink || mood === 'sleepy', squint = mood === 'happy' ? 12 : mood === 'angry' ? 12.5 : 15;
        [84, 172].forEach(function (x, i) {
          var sd = i ? 1 : -1, px = x + (mood === 'shifty' ? 8 : 0);
          if (closed) { ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 21, eyeY + 1); ctx.quadraticCurveTo(x, eyeY + 9, x + 21, eyeY + 1); ctx.stroke(); return; }
          ctx.save(); ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = '#fbf8f2'; ctx.fillRect(x - 24, eyeY - 18, 48, 36);
          var ig = ctx.createRadialGradient(px, eyeY + 1, 2, px, eyeY + 1, 11); ig.addColorStop(0, iris); ig.addColorStop(0.75, iris); ig.addColorStop(1, 'rgba(10,15,25,.9)'); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(px, eyeY + 1, 10.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(px, eyeY + 1, 4.8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(px + 4, eyeY - 4, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(px - 4, eyeY + 5, 1.6, 0, Math.PI * 2); ctx.fill();
          var lid = ctx.createLinearGradient(0, eyeY - squint, 0, eyeY - squint + 12); lid.addColorStop(0, 'rgba(40,20,10,.5)'); lid.addColorStop(1, 'rgba(40,20,10,0)'); ctx.fillStyle = lid; ctx.fillRect(x - 24, eyeY - squint, 48, 12);   /* the lid's shadow on the eye */
          ctx.restore();
          ctx.strokeStyle = '#2f2019'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
          ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,35,25,.45)'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
          ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f2019'; ctx.beginPath(); ctx.moveTo(x + sd * 21, eyeY - 3); ctx.lineTo(x + sd * 27, eyeY - 8); ctx.stroke();   /* one lash at the outer corner */
        });
        // brows: thick at the nose, fine at the temple
        ctx.fillStyle = spec.browColor || '#2a1a10'; var tilt = mood === 'angry' ? 12 : mood === 'sad' ? -10 : mood === 'happy' ? -3 : 0;
        [[58, 110, 1], [198, 146, -1]].forEach(function (b) { var y0 = 84 - tilt * b[2] * (b[2] > 0 ? 1 : 1), y1 = 84 + tilt; ctx.beginPath(); ctx.moveTo(b[0], 84 - tilt + 2); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 72, b[1], 84 + tilt - 4); ctx.lineTo(b[1], 84 + tilt + 5); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 80, b[0], 84 - tilt + 4); ctx.closePath(); ctx.fill(); });
        // the nose is modelled: only the shadow under its tip is drawn
        ctx.fillStyle = 'rgba(70,35,20,.22)'; ctx.beginPath(); ctx.ellipse(128, 166, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
        // mouth
        var lip = spec.lipstick ? '#c02040' : '#8a4536'; ctx.strokeStyle = lip; ctx.lineCap = 'round'; ctx.lineWidth = spec.lipstick ? 8 : 4.5; ctx.beginPath();
        if (mood === 'happy') { ctx.fillStyle = '#4a1a1a'; ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.quadraticCurveTo(128, 194, 96, 186); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(102, 188.5); ctx.quadraticCurveTo(128, 196, 154, 188.5); ctx.quadraticCurveTo(128, 203, 102, 188.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.stroke(); }
        else if (mood === 'sad') { ctx.moveTo(100, 200); ctx.quadraticCurveTo(128, 182, 156, 200); ctx.stroke(); }
        else if (mood === 'angry') { ctx.moveTo(100, 196); ctx.quadraticCurveTo(128, 186, 156, 192); ctx.stroke(); }
        else if (mood === 'talk') { ctx.fillStyle = '#3a1a1a'; ctx.beginPath(); ctx.ellipse(128, 194, 16, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0605a'; ctx.beginPath(); ctx.ellipse(128, 200, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.moveTo(104, 192); ctx.quadraticCurveTo(128, 199, 152, 192); ctx.stroke(); }
        if (mood !== 'talk' && mood !== 'happy') { ctx.strokeStyle = 'rgba(90,40,30,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(114, 205); ctx.quadraticCurveTo(128, 210, 142, 205); ctx.stroke(); }   /* the shade under the lower lip */
        ctx.fillStyle = 'rgba(255,110,110,' + (mood === 'happy' ? 0.26 : 0.12) + ')'; [62, 194].forEach(function (x) { var bl = ctx.createRadialGradient(x, 152, 2, x, 152, 22); bl.addColorStop(0, ctx.fillStyle); bl.addColorStop(1, 'rgba(255,110,110,0)'); ctx.save(); ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(x, 152, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
        if (spec.freckles) { ctx.fillStyle = 'rgba(120,70,40,.5)'; for (var f = 0; f < 22; f++) { ctx.beginPath(); ctx.arc(60 + Math.random() * 136, 136 + Math.random() * 30, 1.6, 0, Math.PI * 2); ctx.fill(); } }
        var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; faceCache[key] = t; return t;
      }
    /* 09-humans-guard.js */
    var HUMAN_GEO = {
        thigh: roundCylGeo(0.088, 0.068, 0.42, 18), shin: roundCylGeo(0.064, 0.046, 0.4, 18), knee: new THREE.SphereGeometry(0.068, 14, 10),
        shoe: bevelGeo(0.12, 0.085, 0.27, 0.036, 3), sole: bevelGeo(0.128, 0.03, 0.285, 0.012, 1), toe: new THREE.SphereGeometry(0.056, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        hips: bevelGeo(0.36, 0.18, 0.22, 0.08, 3), torso: taperGeo(bevelGeo(0.4, 0.5, 0.24, 0.1, 3), 0.5, 0.86, 0.9), chest: bevelGeo(0.44, 0.26, 0.26, 0.11, 3),
        upperArm: roundCylGeo(0.054, 0.044, 0.3, 14), foreArm: roundCylGeo(0.044, 0.034, 0.3, 14), elbow: new THREE.SphereGeometry(0.047, 12, 10), shoulder: new THREE.SphereGeometry(0.072, 14, 10),
        hand: bevelGeo(0.075, 0.1, 0.036, 0.016, 2), thumb: roundCylGeo(0.012, 0.012, 0.05, 8), cuff: roundCylGeo(0.043, 0.04, 0.035, 14), hem: roundCylGeo(0.058, 0.056, 0.04, 16), collar: bevelGeo(0.085, 0.036, 0.012, 0.004, 1),
        neck: roundCylGeo(0.05, 0.062, 0.1, 14), head: new THREE.SphereGeometry(0.17, 28, 20), ear: new THREE.SphereGeometry(0.03, 10, 8), nose: new THREE.SphereGeometry(0.021, 12, 10),
        hairCap: new THREE.SphereGeometry(0.17, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairLong: new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), afro: new THREE.SphereGeometry(0.17, 20, 14), scalp: new THREE.SphereGeometry(0.17, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        skirt: roundCylGeo(0.2, 0.32, 0.4, 20), coat: bevelGeo(0.46, 0.66, 0.28, 0.08, 3)
      };
    /* 09-humans-guard.js */
    function makePerson(spec) {
        spec = spec || {};
        var skin = new THREE.MeshStandardMaterial({ color: spec.skin || pick(SKINS), roughness: 0.75 });
        var shirt = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.shirt || pick(SHIRTS), roughness: 0.9 });
        var pants = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.pants || pick(PANTS), roughness: 0.9 });
        var hairM = new THREE.MeshStandardMaterial({ color: spec.hair || pick(HAIRS), roughness: 0.62 }), hairSide = hairM.clone(); hairSide.side = THREE.DoubleSide;
        var shoeM = new THREE.MeshStandardMaterial({ color: spec.shoes || pick([0x1e1a18, 0x3a2a1a, 0xf2f2f2, 0xc94a3a, 0x2f6b9a]), roughness: 0.6 });
        var soleM = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.9 });
        var g = new THREE.Group(); var P = { mood: 'neutral' }; g.userData.parts = P; g.userData.spec = spec;
        floorBlob(0.36, 0.3, 0, 0.012, 0.02, g, 0.5);   /* a shadow at the feet: the lamps indoors cast none */
        function mesh(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; }
        // legs: hip pivot → thigh → knee pivot → shin → shoe
        function leg(side) {
          var hip = new THREE.Group(); hip.position.set(side * 0.1, 0.86, 0); g.add(hip);
          mesh(HUMAN_GEO.thigh, pants, 0, -0.21, 0, hip);
          var knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee); hip.userData.knee = knee;
          mesh(HUMAN_GEO.knee, pants, 0, 0, 0, knee); mesh(HUMAN_GEO.shin, pants, 0, -0.2, 0, knee);
          var shoe = mesh(HUMAN_GEO.shoe, shoeM, 0, -0.4, 0.05, knee); mesh(HUMAN_GEO.sole, soleM, 0, -0.445, 0.05, knee); mesh(HUMAN_GEO.hem, pants, 0, -0.35, 0, knee);
          mesh(bevelGeo(0.1, 0.02, 0.06), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, -0.36, 0.12, knee);   // laces patch
          if (spec.socks) mesh(roundCylGeo(0.052, 0.052, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), 0, -0.34, 0, knee);
          return hip;
        }
        P.lLeg = leg(-1); P.rLeg = leg(1);
        // torso: hips block, shirt torso, chest, shoulders; collar, buttons, belt, pockets
        P.torso = new THREE.Group(); P.torso.position.y = 0.86; g.add(P.torso);
        mesh(HUMAN_GEO.hips, pants, 0, 0.02, 0, P.torso);
        mesh(bevelGeo(0.38, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: spec.belt || 0x3a2a1a, roughness: 0.5 }), 0, 0.1, 0, P.torso); mesh(bevelGeo(0.05, 0.04, 0.02), MAT.chrome, 0, 0.1, 0.125, P.torso);
        mesh(HUMAN_GEO.torso, shirt, 0, 0.36, 0, P.torso); P.chest = mesh(HUMAN_GEO.chest, shirt, 0, 0.52, 0, P.torso);
        if (!spec.coat) [-1, 1].forEach(function (sd) { var cl = mesh(HUMAN_GEO.collar, shirt, sd * 0.05, 0.648, 0.118, P.torso); cl.rotation.set(-0.35, sd * -0.25, sd * -0.62); });
        if (!spec.coat) { mesh(bevelGeo(0.12, 0.05, 0.03), shirt, 0, 0.62, 0.13, P.torso); for (var b = 0; b < 4; b++) mesh(roundCylGeo(0.008, 0.008, 0.006, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), 0, 0.2 + b * 0.11, 0.125, P.torso).rotation.x = Math.PI / 2; mesh(bevelGeo(0.1, 0.1, 0.005), new THREE.MeshStandardMaterial({ map: TEX.fabric, color: shirt.color.clone().multiplyScalar(0.85), roughness: 0.9 }), -0.11, 0.48, 0.125, P.torso); }
        if (spec.coat) { var coatM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.coat, roughness: 0.9 }); var coat = mesh(HUMAN_GEO.coat, coatM, 0, 0.33, -0.02, P.torso); [-1, 1].forEach(function (s) { var lapel = mesh(bevelGeo(0.09, 0.28, 0.015), coatM, s * 0.09, 0.5, 0.135, P.torso); lapel.rotation.z = s * 0.35; }); mesh(bevelGeo(0.06, 0.34, 0.02), shirt, 0, 0.42, 0.13, P.torso); }
        if (spec.skirt) { mesh(HUMAN_GEO.skirt, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.skirt, roughness: 0.9 }), 0, -0.14, 0, P.torso); }
        if (spec.logo) { var lg = mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: signTex([spec.logo], 128, 128, { size: 70, bg: 'rgba(0,0,0,0)', line: 'rgba(0,0,0,0)', color: '#fff' }), transparent: true }), 0, 0.42, 0.126, P.torso); lg.castShadow = false; }
        // arms: shoulder pivot → upper arm → elbow pivot → forearm → hand with thumb; sleeve depends on longSleeve
        function arm(side) {
          var sh = new THREE.Group(); sh.position.set(side * 0.27, 0.6, 0); P.torso.add(sh);
          mesh(HUMAN_GEO.shoulder, shirt, 0, 0, 0, sh);
          var sleeveM = spec.longSleeve === false ? skin : shirt; mesh(HUMAN_GEO.upperArm, sleeveM, 0, -0.16, 0, sh);
          if (spec.longSleeve === false) mesh(roundCylGeo(0.056, 0.05, 0.1, 10), shirt, 0, -0.06, 0, sh);
          var el = new THREE.Group(); el.position.set(0, -0.31, 0); sh.add(el); sh.userData.elbow = el;
          mesh(HUMAN_GEO.elbow, sleeveM, 0, 0, 0, el); mesh(HUMAN_GEO.foreArm, spec.longSleeve === false || spec.rolled ? skin : shirt, 0, -0.15, 0, el);
          if (spec.watch && side > 0) mesh(roundCylGeo(0.045, 0.045, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x1c1c22 }), 0, -0.27, 0, el);
          if (!(spec.longSleeve === false || spec.rolled)) mesh(HUMAN_GEO.cuff, shirt, 0, -0.285, 0, el);
          var hand = mesh(HUMAN_GEO.hand, skin, 0, -0.35, 0, el); var th = mesh(HUMAN_GEO.thumb, skin, side * 0.04, -0.33, 0.01, el); th.rotation.z = side * 0.6;
          sh.userData.hand = hand; return sh;
        }
        P.lArm = arm(-1); P.rArm = arm(1);
        // head: neck, skull, ears, face decal, hair style, facial hair, glasses frames
        P.head = new THREE.Group(); P.head.position.set(0, 0.66, 0); P.torso.add(P.head);
        mesh(HUMAN_GEO.neck, skin, 0, 0.04, 0, P.head); var headM = mesh(HUMAN_GEO.head, skin, 0, 0.24, 0, P.head); mesh(HUMAN_GEO.nose, skin, 0, 0.222, 0.164, P.head);
        [-1, 1].forEach(function (s) { mesh(HUMAN_GEO.ear, skin, s * 0.165, 0.24, -0.01, P.head); if (spec.earrings) mesh(new THREE.SphereGeometry(0.012, 6, 6), MAT.chrome, s * 0.17, 0.2, -0.01, P.head); });
        var style = spec.hairStyle || (spec.ponytail ? 'ponytail' : pick(['short', 'short', 'long', 'bun', 'afro', 'ponytail', 'mohawk']));
        if (!spec.bald) {
          var hy = 0.24;
          function strands(n, y0, len, r, back) { for (var i = 0; i < n; i++) { var a = back ? Math.PI * 0.55 + (i / (n - 1)) * Math.PI * 0.9 : (i % 2 ? 1 : -1) * (0.9 + Math.floor(i / 2) * 0.35); var st = mesh(bevelGeo(0.07, len, 0.06), hairM, Math.sin(a) * r, y0 - len / 2, Math.cos(a) * r, P.head); st.rotation.y = a; st.rotation.x = 0.05; } }
          if (style === 'afro') { mesh(HUMAN_GEO.afro, hairM, 0, hy + 0.05, -0.02, P.head); for (var q = 0; q < 10; q++) { var pf = mesh(new THREE.SphereGeometry(0.07, 8, 6), hairM, (Math.random() - 0.5) * 0.4, hy + 0.1 + (Math.random() - 0.5) * 0.3, -0.02 + (Math.random() - 0.5) * 0.36, P.head); } }
          else if (style === 'long') { mesh(HUMAN_GEO.hairLong, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.fringe, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.hairFall, hairSide, 0, hy - 0.16, -0.012, P.head); mesh(HUMAN_GEO.sideL, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideR, hairM, 0, hy, 0, P.head); }
          else if (style === 'bun') { mesh(HUMAN_GEO.hairCap, hairM, 0, hy, 0, P.head); mesh(new THREE.SphereGeometry(0.075, 12, 10), hairM, 0, hy + 0.14, -0.14, P.head); mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 14), new THREE.MeshStandardMaterial({ color: 0xc94a3a }), 0, hy + 0.14, -0.14, P.head).rotation.x = Math.PI / 2; mesh(HUMAN_GEO.fringe, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideL, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideR, hairM, 0, hy, 0, P.head); }
          else if (style === 'mohawk') { mesh(HUMAN_GEO.scalp, new THREE.MeshStandardMaterial({ color: skin.color.clone().multiplyScalar(0.82), roughness: 0.8 }), 0, hy, 0, P.head); for (var mk = 0; mk < 6; mk++) { var sp = mesh(bevelGeo(0.05, 0.13 + (mk === 2 || mk === 3 ? 0.04 : 0), 0.05), hairM, 0, hy + 0.24, 0.14 - mk * 0.056, P.head); sp.rotation.x = -0.15 + mk * 0.06; } }
          else if (style === 'ponytail') { mesh(HUMAN_GEO.hairCap, hairM, 0, hy, 0, P.head); var tail = mesh(roundCylGeo(0.05, 0.028, 0.36, 10), hairM, 0, hy - 0.08, -0.2, P.head); tail.rotation.x = 0.35; mesh(new THREE.SphereGeometry(0.055, 10, 8), hairM, 0, hy + 0.08, -0.16, P.head); mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 12), new THREE.MeshStandardMaterial({ color: 0xc94a3a }), 0, hy + 0.08, -0.17, P.head).rotation.x = 0.4; mesh(HUMAN_GEO.fringe, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideL, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideR, hairM, 0, hy, 0, P.head); }
          else { mesh(HUMAN_GEO.hairCap, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.fringe, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideL, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideR, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.nape, hairM, 0, hy, 0, P.head); }   // short: cap, fringe, sideburns, nape
        }
        if (spec.beard) { mesh(HUMAN_GEO.beard, hairSide, 0, 0.24, 0, P.head); }
        if (spec.moustache) { mesh(bevelGeo(0.12, 0.025, 0.03), hairM, 0, 0.175, 0.168, P.head); }
        P.face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: personFace(spec.mood || 'neutral', false, spec), transparent: true, depthWrite: false })); P.face.position.set(0, 0.245, 0.17); P.head.add(P.face);
        if (spec.glasses) { var fr = new THREE.MeshStandardMaterial({ color: spec.glassColor || 0x222222, roughness: 0.4, metalness: 0.5 }); [-0.06, 0.06].forEach(function (x) { var ring = mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), fr, x, 0.255, 0.178, P.head); var lens = mesh(new THREE.CircleGeometry(0.036, 16), new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.25, roughness: 0.05 }), x, 0.255, 0.176, P.head); lens.castShadow = false; }); mesh(bevelGeo(0.03, 0.006, 0.006), fr, 0, 0.26, 0.178, P.head); [-1, 1].forEach(function (s) { var tmp = mesh(bevelGeo(0.006, 0.006, 0.16), fr, s * 0.1, 0.255, 0.085, P.head); }); }
        // hats / accessories
        var capM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.capColor || 0xc94a3a, roughness: 0.9 });
        if (spec.hat === 'straw') { var sm = new THREE.MeshStandardMaterial({ color: 0xd9b46a, roughness: 1 }); mesh(roundCylGeo(0.31, 0.31, 0.02, 18), sm, 0, 0.36, 0, P.head); mesh(roundCylGeo(0.15, 0.18, 0.12, 16), sm, 0, 0.42, 0, P.head); mesh(new THREE.TorusGeometry(0.165, 0.012, 6, 16), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }), 0, 0.38, 0, P.head).rotation.x = Math.PI / 2; }
        if (spec.hat === 'cap') { mesh(new THREE.SphereGeometry(0.182, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.26, 0, P.head); var peak = mesh(bevelGeo(0.2, 0.015, 0.14), capM, 0, 0.28, 0.2, P.head); peak.rotation.x = 0.15; mesh(new THREE.SphereGeometry(0.02, 8, 6), capM, 0, 0.44, 0, P.head); }
        if (spec.hat === 'nurse') { mesh(bevelGeo(0.22, 0.09, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, 0.4, -0.02, P.head); mesh(bevelGeo(0.1, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0xe03030 }), 0, 0.41, 0.065, P.head); mesh(bevelGeo(0.03, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: 0xe03030 }), 0, 0.41, 0.065, P.head); }
        if (spec.hat === 'flowers') { for (var f = 0; f < 8; f++) { var a = f / 8 * Math.PI * 2; mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshStandardMaterial({ color: [0xff6b9d, 0xffd166, 0x9ad0ff, 0xf2f2f2][f % 4] }), Math.cos(a) * 0.17, 0.36, Math.sin(a) * 0.17, P.head); mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffd166 }), Math.cos(a) * 0.17, 0.36, Math.sin(a) * 0.17 + 0.03, P.head); } mesh(new THREE.TorusGeometry(0.17, 0.01, 6, 20), new THREE.MeshStandardMaterial({ color: 0x3a8f40 }), 0, 0.36, 0, P.head).rotation.x = Math.PI / 2; }
        if (spec.hat === 'beanie') { mesh(new THREE.SphereGeometry(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), capM, 0, 0.25, 0, P.head); mesh(new THREE.TorusGeometry(0.175, 0.03, 8, 20), capM, 0, 0.26, 0, P.head).rotation.x = Math.PI / 2; mesh(new THREE.SphereGeometry(0.04, 8, 8), capM, 0, 0.45, 0, P.head); }
        if (spec.bowtie) { mesh(bevelGeo(0.05, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xc94a3a }), -0.04, 0.63, 0.13, P.torso).rotation.z = 0.3; mesh(bevelGeo(0.05, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xc94a3a }), 0.04, 0.63, 0.13, P.torso).rotation.z = -0.3; mesh(new THREE.SphereGeometry(0.014, 6, 6), new THREE.MeshStandardMaterial({ color: 0x8a2a2a }), 0, 0.63, 0.14, P.torso); }
        if (spec.necklace) { mesh(new THREE.TorusGeometry(0.08, 0.006, 6, 16, Math.PI), MAT.chrome, 0, 0.62, 0.11, P.torso).rotation.z = Math.PI; }
        if (spec.backpack) { var bpM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.backpackColor || 0x2f6b9a, roughness: 0.9 }); mesh(bevelGeo(0.3, 0.4, 0.14), bpM, 0, 0.4, -0.19, P.torso); mesh(bevelGeo(0.2, 0.14, 0.05), bpM, 0, 0.3, -0.28, P.torso); [-0.12, 0.12].forEach(function (x) { mesh(bevelGeo(0.05, 0.4, 0.02), bpM, x, 0.42, 0.13, P.torso); }); }
        var rh = P.rArm.userData.elbow, lh = P.lArm.userData.elbow;
        if (spec.prop === 'cane') { var cane = mesh(roundCylGeo(0.012, 0.012, 0.85, 8), new THREE.MeshStandardMaterial({ color: 0x5a3d22 }), 0, -0.6, 0.05, rh); cane.rotation.x = 0.1; mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5a3d22 }), 0, -0.2, 0.05, rh).rotation.z = Math.PI; mesh(roundCylGeo(0.02, 0.02, 0.03, 8), MAT.black, 0, -1.02, 0.09, rh); }
        if (spec.prop === 'board') { var bd2 = mesh(bevelGeo(0.2, 0.025, 0.75), new THREE.MeshStandardMaterial({ color: 0x4a2a6a }), 0.06, -0.3, 0, lh); bd2.rotation.z = 0.15; mesh(new THREE.PlaneGeometry(0.16, 0.5), new THREE.MeshBasicMaterial({ map: signTex(['SK8'], 100, 300, { size: 60, bg: 'rgba(0,0,0,0)', line: 'rgba(0,0,0,0)', color: '#ffd166' }), transparent: true }), 0.075, -0.3, 0, lh).rotation.set(0, Math.PI / 2, -0.15 + Math.PI / 2); [0.25, -0.25].forEach(function (z) { [0.05, -0.05].forEach(function (dx) { mesh(roundCylGeo(0.03, 0.03, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0xffd166 }), 0.09 + dx * 0.3, -0.3 - 0.02, z, lh).rotation.z = Math.PI / 2; }); mesh(bevelGeo(0.04, 0.03, 0.12), MAT.chrome, 0.1, -0.31, z, lh); }); }
        if (spec.prop === 'book') { mesh(bevelGeo(0.16, 0.22, 0.05), new THREE.MeshStandardMaterial({ color: 0x8a2a2a }), 0.02, -0.34, 0.08, lh); mesh(bevelGeo(0.15, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xf0e8d8 }), 0.03, -0.34, 0.085, lh); }
        if (spec.prop === 'bag') { var bagM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x6a4a2a, roughness: 0.9 }); mesh(bevelGeo(0.2, 0.24, 0.1), bagM, 0, -0.5, 0.02, rh); mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 12, Math.PI), bagM, 0, -0.38, 0.02, rh); mesh(bevelGeo(0.18, 0.06, 0.11), new THREE.MeshStandardMaterial({ color: 0x4a3a2a }), 0, -0.41, 0.02, rh); }
        if (spec.prop === 'phone') { mesh(bevelGeo(0.07, 0.13, 0.01), new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, -0.36, 0.05, rh); mesh(new THREE.PlaneGeometry(0.06, 0.11), new THREE.MeshStandardMaterial({ color: 0x223355, emissive: 0x3355aa, emissiveIntensity: 0.9 }), 0, -0.36, 0.056, rh).castShadow = false; }
        if (spec.prop === 'coffee') { mesh(roundCylGeo(0.035, 0.03, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), 0, -0.36, 0.05, rh); mesh(roundCylGeo(0.037, 0.037, 0.015, 12), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }), 0, -0.3, 0.05, rh); mesh(roundCylGeo(0.037, 0.037, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xc8a97a }), 0, -0.37, 0.05, rh); }
        if (spec.hunch) P.torso.rotation.x = 0.18;
        g.userData.skinMat = skin; g.userData.glasses = !!spec.glasses;
        g.userData.setMood = function (mood) { if (P.mood === mood) return; P.mood = mood; P.face.material.map = personFace(mood, false, spec); P.face.material.needsUpdate = true; P.blinking = false; };
        g.userData.blinkT = 1 + Math.random() * 4;
        g.userData.phase = Math.random() * 6.28; g.userData.phase0 = g.userData.phase;
        return g;
      }
    /* 09-humans-guard.js */
    var guard = { h: null, bubble: null, sayT: 0, state: 'idle', armT: 0 };
    /* 10-staff-paths.js */
    var WORKER_HIRE = 400, WORKER_WAGE = COST.payRate, CREW_MAX = 3;
    /* 10-staff-paths.js */
    var CREW_LOOK = [
        { name: 'Jo',   skin: 0xf1c27d, hair: 0x5a3a1a, hairStyle: 'ponytail', shirt: 0x2f6b4a, at: [-1.5, 1.2] },
        { name: 'Mika', skin: 0xc68642, hair: 0x1c1c22, shirt: 0x2f5b8a, at: [-2.5, 1.5] },
        { name: 'Sam',  skin: 0xe0ac7e, hair: 0x8a6a3a, shirt: 0x8a5a2f, at: [-0.5, 1.6] }
      ];
    /* 10-staff-paths.js */
    function crewHireCost() { return Math.round(WORKER_HIRE * Math.pow(1.6, crewList().length)); }
    /* 10-staff-paths.js */
    function crewList() {   // the saved crew, migrating the single assistant that used to live on a boolean
        if (!S.staff) S.staff = {};
        if (!Array.isArray(S.staff.crew)) {
          S.staff.crew = S.staff.worker ? [{ look: 0, task: S.staff.task || 'idle' }] : [];
        }
        if (S.staff.crew.length > CREW_MAX) S.staff.crew.length = CREW_MAX;   /* keep the same array: callers hold on to it */
        S.staff.crew.forEach(function (c, i) { if (typeof c.look !== 'number') c.look = i; if (!c.task) c.task = 'idle'; });
        S.staff.worker = S.staff.crew.length > 0;   /* a few places still ask the old question */
        return S.staff.crew;
      }
    /* 10-staff-paths.js */
    function crewName(i) { var c = crewList()[i]; return c ? CREW_LOOK[c.look % CREW_LOOK.length].name : 'nobody'; }
    /* 10-staff-paths.js */
    var WORKER_TASKS = [['serve', '🛎️ Serve the window'], ['restock', '📦 Restock the supply rack and machines'], ['clean', '🧹 Sweep the floors'], ['water', '💧 Tend the plants'], ['idle', '☕ Take a break']];
    /* 10-staff-paths.js */
    var GUARD_TASKS = [['door', '🪪 Watch the door'], ['patrol', '🚶 Patrol the lobby'], ['sweep', '🧹 Sweep the lobby'], ['restock', '📦 Restock the counter display']];
    /* 10-staff-paths.js */
    function taskWords(label) { return String(label).replace(/^[^A-Za-z]+/, ''); }
    /* 10-staff-paths.js */
    function workerTaskLabel(i) { var c = crewList()[i === undefined ? (worker ? worker.idx : 0) : i]; var t = WORKER_TASKS.filter(function (x) { return x[0] === ((c && c.task) || 'idle'); })[0]; return t ? taskWords(t[1]) : 'Take a break'; }
    /* 10-staff-paths.js */
    var WORKER_NONE = { g: null, h: null, state: 'idle', path: [], t: 0, job: null, bubble: null, sayT: 0, idleT: 0, coolT: 0, hasBroom: false, idx: 0 };
    /* 10-staff-paths.js */
    var crew = [];
    /* 10-staff-paths.js */
    var worker = WORKER_NONE;
    /* 10-staff-paths.js */
    function buildWorker(rec) {
        if (!rec || rec.g) return;
        var L = CREW_LOOK[rec.look % CREW_LOOK.length];
        var g = new THREE.Group(); g.position.set(L.at[0], 0, L.at[1]); world.group.add(g); rec.g = g;
        rec.h = makePerson({ skin: L.skin, hair: L.hair, hairStyle: L.hairStyle, shirt: L.shirt, pants: 0x2a2d33, shoes: 0x333333, watch: true, logo: '🌿', mood: 'happy' }); g.add(rec.h);
        var badge = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: signTex(['STAFF'], 160, 60, { size: 30, bg: '#6fdc8c', color: '#062010', line: 'rgba(0,0,0,0)' }) })); badge.position.set(0.1, 0.5, 0.148); rec.h.userData.parts.torso.add(badge);
        rec.bubble = sprite(signTex(['…'], 512, 160, { size: 44 }), 1.4, 0.44, 0, 2.25, 0, g); rec.bubble.visible = false;
        var hb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.5), MAT.none); hb.position.y = 1.25; rec.h.add(hb); interactable(hb, { kind: 'worker', idx: rec.idx });
      }
    /* 10-staff-paths.js */
    function removeWorker(rec) {
        rec = rec || worker; carryBack(rec, true); if (!rec.g) return;   /* a crate in their arms goes back into storage; the caller settles the saved record */
        rec.hasBroom = false; rec.broomMesh = null; syncBroom();
        world.group.remove(rec.g); dropTree(rec.g);
        world.interact = world.interact.filter(function (m) { var d = m.userData.interact; return !(d && d.kind === 'worker' && (d.idx || 0) === (rec.idx || 0)); });   /* this one's hit box, not everybody's */
        rec.g = null; rec.h = null; rec.bubble = null; rec.state = 'idle'; rec.job = null; rec.path = [];
      }
    /* 10-staff-paths.js */
    function crewSync() {   // runtime records follow the saved crew: build the new ones, clear out the gone ones
        var list = crewList();
        crew.filter(function (r) { return r.idx >= list.length; }).forEach(function (r) { removeWorker(r); });
        crew = crew.filter(function (r) { return r.idx < list.length; });
        list.forEach(function (c, i) {
          var r = crew.filter(function (x) { return x.idx === i; })[0];
          if (!r) { r = { idx: i, look: c.look, g: null, h: null, state: 'idle', path: [], t: 0, job: null, bubble: null, sayT: 0, idleT: 0, coolT: 0, hasBroom: false }; crew.push(r); if (c.carry) { S.storage[c.carry.item] = (S.storage[c.carry.item] || 0) + c.carry.n; syncStorage(); } c.carry = null; }   /* a crate that was in their arms when the game was saved is back on the racking */
          r.look = c.look;
          if (c.off) { removeWorker(r); c.carry = null; r.job = null; r.path = []; r.state = 'idle'; } else buildWorker(r);
        });
        crew.sort(function (a, b) { return a.idx - b.idx; });
        worker = crew[0] || WORKER_NONE;
      }
    /* 10-staff-paths.js */
    function payWages(offline) {
        var list = crewList(); if (!list.length) return;
        for (var i = list.length - 1; i >= 0; i--) {
          if (list[i].off) { logEvent('🏠 ' + crewName(i) + ' was off, no wage', ''); continue; }   /* sent home means sent home: no work, no pay, no quitting over it */
          if (S.bank + S.vault + S.till >= WORKER_WAGE) { drawFunds(WORKER_WAGE); logEvent('💸 Paid ' + crewName(i) + ' ' + money(WORKER_WAGE), ''); }
          else {
            var nm = crewName(i); list.splice(i, 1);
            if (!offline) { toast('👋 ' + nm + ' quit. There wasn\'t enough for the wage.', 'bad'); }
            logEvent('👋 ' + nm + ' walked out: there wasn\'t enough for the wage', 'bad');
          }
        }
        S.staff.worker = list.length > 0; crewSync();
      }
    /* 10-staff-paths.js */
    function guardOff() { if (!S.staff) S.staff = {}; return !!S.staff.guardOff; }
    /* 10-staff-paths.js */
    function carrySet(rec, c, unsaved) {   // what a crew member has in their arms; kept on their saved record so a reload never loses it
        var saved = !unsaved && crewList()[rec.idx]; if (saved) saved.carry = c ? { item: c.item, n: c.n } : null;
        if (rec.carryMesh && rec.carryMesh.parent) { rec.carryMesh.parent.remove(rec.carryMesh); dropTree(rec.carryMesh); }
        rec.carryMesh = null; rec.carry = c || null;
        if (c && rec.h) { var m = crateMesh(c.item, 0.4, 0.26, 0.32); m.position.set(0, 0.3, 0.3); rec.h.userData.parts.torso.add(m); rec.carryMesh = m; }
      }
    /* 10-staff-paths.js */
    function carryBack(rec, unsaved) {   // a crate still in their arms goes back into storage
        if (!rec || !rec.carry) return; var c = rec.carry; S.storage[c.item] = (S.storage[c.item] || 0) + c.n; carrySet(rec, null, unsaved); syncStorage();
      }
    /* 12-logistics-bat.js */
    var ORDER_WAIT = 15000, VAN_TRIP = 75000;
    /* 12-logistics-bat.js */
    function orderSummary(items) { return Object.keys(items).map(function (k) { return items[k] + '× ' + itemName(k); }).join(', '); }
    /* 12-logistics-bat.js */
    function storageAdd(items) { Object.keys(items).forEach(function (k) { S.storage[k] = (S.storage[k] || 0) + items[k]; }); world.dirtyStorage = true; }
    /* 12-logistics-bat.js */
    var courier = { g: null, h: null, state: 'away', path: [], t: 0, bubble: null };
    /* 12-logistics-bat.js */
    function updateLogistics(dt, offline) {
        // an open order closes a few seconds after the last click and becomes a delivery on its way
        if (S.order && now() - S.order.at > ORDER_WAIT) { S.deliveries.push({ items: S.order.items, due: now() + (S.upgrades.ownvan ? 20000 : hasLic('wholesale') ? VAN_TRIP / 2 : VAN_TRIP) }); logEvent('🚚 Order dispatched: ' + orderSummary(S.order.items), ''); if (!offline) toast('🚚 Order dispatched. The supplier\'s van is on its way to the back door.', ''); S.order = null; }
        // deliveries that came due while the window was closed just land in storage
        if (offline) { var keep = []; S.deliveries.forEach(function (d) { if (now() >= d.due) { storageAdd(d.items); logEvent('📦 Delivered while you were away: ' + orderSummary(d.items), 'good'); } else keep.push(d); }); S.deliveries = keep; }
        // courier: called from the bank app, turns up a minute or two later
        if (S.courier && S.courier.state === 'called' && now() >= S.courier.at && !offline) { S.courier.state = 'arriving'; courierArrive(); }   // a courier that came due while the game was closed simply turns up on the next live tick
        if (S.courier && S.courier.state !== 'called' && courier.state === 'away' && !offline && ui.started) { courierArrive(); }   // booked and supposedly here but no body (reload mid-visit): walk them in again instead of blocking the bank app forever
      }
    /* 12-logistics-bat.js */
    function rollerSet(open) { if (world.rollerOpen !== open && world.rollerDoor) sfx('roller'); world.rollerOpen = open; world.obstacles = world.obstacles.filter(function (o) { return o.tag !== 'roller'; }); if (!open) world.obstacles.push({ x1: 3.0, x2: 6.0, z1: -12.75, z2: -12.35, tag: 'roller', floorLevel: 0 }); }
    /* 12-logistics-bat.js */
    function gateSet(open) { if (world.gateOpen !== open && world.yardGate) sfx('gate'); world.gateOpen = open; world.obstacles = world.obstacles.filter(function (o) { return o.tag !== 'gate'; }); if (!open) world.obstacles.push({ x1: 3.0, x2: 6.0, z1: (world.yardGateZ || -18) - 0.15, z2: (world.yardGateZ || -18) + 0.15, tag: 'gate', floorLevel: 0 }); }
    /* 12-logistics-bat.js */
    function courierArrive() {
        if (!courier.g) { courier.g = new THREE.Group(); world.group.add(courier.g); courier.bubble = sprite(signTex(['…'], 512, 160, { size: 44 }), 1.5, 0.58, 0, 2.25, 0, courier.g); }
        if (courier.h) { courier.g.remove(courier.h); dropTree(courier.h); }
        courier.h = makePerson({ skin: 0xe0ac7e, hair: 0x2b1b12, shirt: 0x1f3a5f, pants: 0x1f3a5f, hat: 'cap', capColor: 0x1f3a5f, longSleeve: true, hairStyle: 'short', watch: true, shoes: 0x111111, logo: '🏦', mood: 'neutral' });
        courier.g.add(courier.h); var el = courier.h.userData.parts.lArm.userData.elbow; var cs = new THREE.Mesh(bevelGeo(0.3, 0.22, 0.1), colorMat(0x1a1c20, 0.5, 0.3)); cs.position.set(0, -0.45, 0.02); el.add(cs);
        var hb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.5), MAT.none); hb.position.y = 1.25; hb.userData.courier = true; courier.h.add(hb); interactable(hb, { kind: 'courier' });
        courier.g.position.set(4.5, 0, -21); courier.g.visible = true; courier.state = 'in'; courier.path = [{ x: 4.5, z: -16 }, { x: 4.5, z: -11.6 }]; gateSet(true); rollerSet(true);
        courier.bubble.visible = false; toast('🏦 The bank courier is at the back gate', ''); logEvent('🏦 Bank courier arrived for a ' + money(S.courier.amount) + ' pickup', '');
      }
    /* 13-basement.js */
    var CIG_SKUS = {
        cigNS: { name: 'RF Smoking 10s',       type: 'normal', size: 10, price: 7,  col: 0xb5121b, top: 0xf4f1ea },
        cigNB: { name: 'RF Smoking 20s',       type: 'normal', size: 20, price: 13, col: 0xb5121b, top: 0xf4f1ea },
        cigLS: { name: 'RF Smoking Light 10s', type: 'light',  size: 10, price: 8,  col: 0xdfe6ee, top: 0x2f6b9a },
        cigLB: { name: 'RF Smoking Light 20s', type: 'light',  size: 20, price: 14, col: 0xdfe6ee, top: 0x2f6b9a }
      };
    /* 13-basement.js */
    var TOB = { wholesale: 0.5, driverShare: 0.45, growT: 200, sowCost: 20, bayKg: 2, kilnMax: 8, kilnT: 60, cureYield: 0.2, shredKgS: 0.02, stickKg: { normal: 0.0008, light: 0.0006 }, sticksS: 6, packS: 1.2, matCost: 50, matUnits: 100, carton: 10 };
    /* 13-basement.js */
    var tobUI = { signs: {}, bays: [], beacons: {}, spin: [], beltItems: [], rackG: null, kilnGlow: null, t: 0, fade: null };
    /* 13-basement.js */
    function tobFresh() { return { bays: [{ stage: 'empty', t: 0 }, { stage: 'empty', t: 0 }, { stage: 'empty', t: 0 }, { stage: 'empty', t: 0 }], leaf: 0, kiln: { on: false, kg: 0, t: 0 }, cured: 0, shred: { on: false }, cut: 0, maker: { on: false, mode: 'normal' }, sticks: { normal: 0, light: 0 }, packer: { on: false, size: 10, type: 'normal', t: 0 }, mat: 0, packs: { cigNS: 0, cigNB: 0, cigLS: 0, cigLB: 0 }, made: 0 }; }
    /* 13-basement.js */
    function tob() { if (!S.tob || !S.tob.bays) S.tob = tobFresh(); return S.tob; }
    /* 13-basement.js */
    function skuOf(type, size) { return 'cig' + (type === 'light' ? 'L' : 'N') + (size === 20 ? 'B' : 'S'); }
    /* 13-basement.js */
    function kg(n) { return (Math.round(n * 100) / 100) + ' kg'; }
    /* 13-basement.js */
    function syncTobRack() {
        var g = tobUI.rackG; if (!g) return; dropKids(g); var T = tob();
        CIG_KEYS.forEach(function (k, i) { var K = CIG_SKUS[k]; var cartons = Math.min(8, Math.ceil(T.packs[k] / TOB.carton)); for (var c = 0; c < cartons; c++) { var w = K.size === 20 ? 0.3 : 0.24; var m = new THREE.Mesh(bevelGeo(w, 0.1, 0.4), colorMat(K.col, 0.6)); m.position.set(-0.75 + (c % 4) * 0.5, [0.37, 0.92, 1.47, 2.02][i] + Math.floor(c / 4) * 0.105, 0); g.add(m); var band = new THREE.Mesh(bevelGeo(w + 0.004, 0.03, 0.404), colorMat(K.top, 0.6)); band.position.copy(m.position); band.position.y += 0.03; g.add(band); } });
      }
    /* 13-basement.js */
    function setTobSign(key, lines) { var s = tobUI.signs[key]; if (!s) return; var txt = lines.join('|'); if (s.txt === txt) return; s.txt = txt; var ob = s.mesh.material.map; s.mesh.material.map = signTex(lines, s.w, s.h, s.opts); s.mesh.material.needsUpdate = true; if (ob) ob.dispose(); }
    /* 13-basement.js */
    function packerReady(T) { var P = T.packer; return T.sticks[P.type] >= P.size && T.mat >= (P.size === 20 ? 2 : 1); }
    /* 13-basement.js */
    function updateTobacco(dt) {
        var T = tob();
        T.bays.forEach(function (b, i) { if (b.stage !== 'grow') return; b.t += dt; if (b.t >= TOB.growT) { b.stage = 'ready'; toast('🌿 Tobacco bay ' + (i + 1) + ' is ready to harvest', 'good'); save(); } });
        var K = T.kiln; if (K.on) { if (K.kg <= 0 && T.leaf >= 1) { K.kg = Math.min(TOB.kilnMax, T.leaf); T.leaf -= K.kg; K.t = 0; } if (K.kg > 0) { K.t += dt; if (K.t >= TOB.kilnT) { T.cured += K.kg * TOB.cureYield; logEvent('🔥 Kiln finished a load: ' + kg(K.kg * TOB.cureYield) + ' of cured leaf', ''); K.kg = 0; K.t = 0; save(); } } }
        if (T.shred.on && tobSpare(T) > 0) { var c = Math.min(tobSpare(T), TOB.shredKgS * dt); T.cured -= c; T.cut += c; }
        if (T.maker.on && T.cut > 0) { var per = TOB.stickKg[T.maker.mode]; var n = Math.min(TOB.sticksS * dt, T.cut / per); T.cut = Math.max(0, T.cut - n * per); T.sticks[T.maker.mode] += n; }
        var P = T.packer; if (P.on && packerReady(T)) { P.t += dt; if (P.t >= TOB.packS) { P.t = 0; T.sticks[P.type] -= P.size; T.mat -= P.size === 20 ? 2 : 1; var sku = skuOf(P.type, P.size); T.packs[sku]++; T.made++; if (T.packs[sku] % TOB.carton === 1 || T.packs[sku] % TOB.carton === 0) syncTobRack(); } }
        if (player.floor !== -1) return;
        // everything below is only what you can see from the floor
        var run = { kiln: K.on && K.kg > 0, shred: T.shred.on && tobSpare(T) > 0, maker: T.maker.on && T.cut > 0, packer: P.on && packerReady(T) }; var armed = { kiln: K.on, shred: T.shred.on, maker: T.maker.on, packer: P.on };
        tobUI.spin.forEach(function (s) { if (run[s.key]) s.g.rotation[s.axis] += s.speed * dt; });
        tobUI.t += dt; var blink = Math.sin(tobUI.t * 6) > 0;
        Object.keys(tobUI.beacons).forEach(function (k) { var m = tobUI.beacons[k].material; m.emissiveIntensity = run[k] ? (blink ? 2.2 : 0.6) : armed[k] ? 0.7 : 0.08; m.color.setHex(run[k] ? 0x39d353 : 0xff8a1c); m.emissive.setHex(run[k] ? 0x39d353 : 0xff8a1c); });
        if (tobUI.kilnGlow) tobUI.kilnGlow.material.emissiveIntensity = run.kiln ? 1.6 + Math.sin(tobUI.t * 3) * 0.4 : 0.05;
        tobUI.beltItems.forEach(function (o) { var on = o.lane === 0 ? run.shred : run.maker; o.m.visible = on; if (!on) return; var r = o.lane === 0 ? [3.6, 1.9] : [-0.35, -1.75]; var f = (tobUI.t * 0.35 + o.off) % 1; o.m.position.x = r[0] + (r[1] - r[0]) * f; });
        T.bays.forEach(function (b, i) { var g = tobUI.bays[i]; if (!g) return; g.visible = b.stage !== 'empty'; var gr = b.stage === 'ready' ? 1 : clamp(b.t / TOB.growT, 0, 1); var sc = 0.12 + gr * 0.88; g.scale.set(sc, sc, sc); });
        tobUI.signT = (tobUI.signT || 0) - dt; if (tobUI.signT > 0) return; tobUI.signT = 0.5;
        T.bays.forEach(function (b, i) { setTobSign('bay' + i, ['BAY ' + (i + 1), b.stage === 'empty' ? 'empty · E to sow' : b.stage === 'ready' ? 'ready · E to cut' : 'growing ' + Math.round(b.t / TOB.growT * 100) + '%']); });
        setTobSign('kiln', ['KILN', !K.on ? 'off' : K.kg > 0 ? 'curing ' + kg(K.kg) : 'waiting for leaf', K.kg > 0 ? Math.ceil(TOB.kilnT - K.t) + ' s left' : 'leaf in: ' + kg(T.leaf)]);
        setTobSign('shred', ['SHREDDER', !T.shred.on ? 'off' : run.shred ? 'cutting' : 'idle', 'cured: ' + kg(T.cured)]);
        setTobSign('maker', ['MAKER', (T.maker.mode === 'light' ? 'LIGHT' : 'NORMAL') + (T.maker.on ? run.maker ? ' · rolling' : ' · idle' : ' · off'), 'cut: ' + kg(T.cut), 'N ' + Math.floor(T.sticks.normal) + ' · L ' + Math.floor(T.sticks.light)]);
        setTobSign('packer', ['PACKER', (P.type === 'light' ? 'LIGHT ' : 'NORMAL ') + P.size + 's' + (P.on ? run.packer ? ' · packing' : ' · starved' : ' · off'), 'materials: ' + T.mat, 'packed: ' + T.made]);
        setTobSign('rack', ['FINISHED GOODS', CIG_KEYS.map(function (k) { return (CIG_SKUS[k].type === 'light' ? 'L' : 'N') + CIG_SKUS[k].size + ': ' + T.packs[k]; }).join('   ')]);
      }
    /* 13-basement.js */
    function cigStock(k) { if (!S.cigStock) S.cigStock = {}; return S.cigStock[k] || 0; }
    /* 13-basement.js */
    function syncCigCab() {
        var inst = propInst.cigCabinet; if (!inst) return; var g = inst.ctx.dynGroup(); var keep = g.userData.shutter; dropKids(g); if (keep) g.add(keep);
        Object.keys(CIG_SKUS).forEach(function (k, i) { var K = CIG_SKUS[k], n = Math.min(i < 4 ? 5 : K.shape === 'cigar' ? 2 : 3, cigStock(k)), big = K.size === 20; for (var p = 0; p < n; p++) { var w = big ? 0.075 : 0.06, hh = big ? 0.11 : 0.09; var m = productCigPack(K, big ? 1.3 : 1.25); m.position.set((i < 4 ? -0.47 : i < 8 ? -0.03 : 0.25) + p * (K.shape === 'cigar' ? 0.11 : 0.082), [1.62, 1.27, 0.92, 0.57][i % 4] + (K.shape ? 0.05 : hh / 2), 0.06);   /* three columns: what the packer makes, what the lab makes, and the cigars and the honey */ m.traverse(function (o) { if (o.isMesh) o.castShadow = false; }); g.add(m); } });   /* the cabinet shows the same pack you hand over */
        g.traverse(function (o) { if (o.isMesh) o.userData.propId = 'cigCabinet'; });
      }
    /* 14-city.js */
    function vehState(id) {   /* S.car and S.van: where it stands, what is in the back, lights, handbrake, odometer, which parts are open */
        var d = id === 'van' ? { x: 7.0, z: -15.3 } : { x: 12.8, z: -18.25 };   /* the van is 5 m long: at 7.0 its tail clears the garage wall */
        if (!S[id] || typeof S[id].x !== 'number') S[id] = { x: d.x, z: d.z, h: Math.PI / 2, trunk: {} }; if (!S[id].trunk) S[id].trunk = {};
        if (typeof S[id].lights !== 'number') S[id].lights = 0; if (typeof S[id].brake !== 'boolean') S[id].brake = true; if (typeof S[id].odo !== 'number') S[id].odo = 0;
        if (!S[id].open) S[id].open = { doorL: false, doorR: false, boot: false, bonnet: false, hatch: false, counter: false };
        if (!S[id].cigs || typeof S[id].cigs !== 'object') S[id].cigs = {};   /* cartons ride in whichever vehicle they were loaded into */
        return S[id];
      }
    /* 14-city.js */
    function carState() { return vehState(drive.veh || 'car'); }
    /* 14-city.js */
    var FLORA = { seed: 91, sets: {}, _m: new THREE.Matrix4(), _p: new THREE.Vector3(), _q: new THREE.Quaternion(), _s: new THREE.Vector3(), _c: new THREE.Color(), _e: new THREE.Euler(), UP: new THREE.Vector3(0, 1, 0) };
    /* 14-city.js */
    function frnd() { FLORA.seed = (FLORA.seed * 1103515245 + 12345) & 0x7fffffff; return FLORA.seed / 0x7fffffff; }
    /* 14-city.js */
    function fr(a, b) { return a + (b - a) * frnd(); }
    /* 16-town-van.js */
    function carNear(x, z, r) { return Math.hypot(drive.g.position.x - x, drive.g.position.z - z) < r; }
    /* 17-upstairs-expansion.js */
    var DIVX = 2.0;
    /* 17-upstairs-expansion.js */
    var CIG_KEYS = ['cigNS', 'cigNB', 'cigLS', 'cigLB'];
    /* 17-upstairs-expansion.js */
    var exp = { zoneLight: null, zone: '', wx: null, wxKind: '', beacon: null, dropHit: null, getaway: null, opT: 0, heatBand: 0, roofBeds: [], roofSigns: [], genLed: null };
    /* 17-upstairs-expansion.js */
    function powerOn() { return !!S.upgrades.generator || now() > (xs().blackoutUntil || 0); }
    /* 17-upstairs-expansion.js */
    function seasonLabel() { return ['Spring', 'Summer', 'Autumn', 'Winter'][Math.floor(((S.day || 1) - 1) / 7) % 4]; }
    /* 17-upstairs-expansion.js */
    function weekend() { var d = (S.day || 1) % 7; return d === 6 || d === 0; }
    /* 17-upstairs-expansion.js */
    function labTick(dt) {   // a lab batch runs down its timer; the caller decides whether there is power
        if (!dlcOn('lab')) return;   /* switched off: a running batch waits */
        var X = xs(), J = X.lab.job; if (J) { J.t += dt; if (J.t >= J.dur) { labShelve(J); X.lab.job = null; sfx('ok'); toast('🧪 Lab batch done: ' + J.n + ' × ' + CIG_SKUS[J.sku].name + ' waiting on the lab shelf', 'good'); save(); } }
      }
    /* 17-upstairs-expansion.js */
    function roofTick(dt, catchUp) {   // catchUp: time already scaled for the daylight share, so the hour it happens to be now does not matter
        var X = xs(), W = X.weather, gh = dlcOn('greenhouse');   /* switched off: the beds wait as they are */
        X.roof.forEach(function (b, i) { if (gh && b.stage === 'grow' && (catchUp || !nightNow())) { b.t += dt * (W.kind === 'rain' || roofWatered() ? 1.5 : 1) * (seasonLabel() === 'Winter' ? 0.5 : 1); if (b.t >= 260) { b.stage = 'ready'; toast('🌿 Roof bed ' + (i + 1) + ' is ready', 'good'); } } var g = exp.roofBeds[i]; if (g) { g.visible = gh && b.stage !== 'empty'; var sc = b.stage === 'ready' ? 1 : 0.1 + clamp(b.t / 260, 0, 1) * 0.9; g.scale.set(1, sc, 1); } });
      }
    /* 18-deliveries.js */
    var BRANCH_PAY = 9, BRANCH_CAP = 60;
    /* 18-deliveries.js */
    function jobsOf(via) { return xs().jobs.filter(function (j) { return j.via === via; }); }
    /* 18-deliveries.js */
    function jobGoods(j) { return j.via === 'branch' ? 'goods for the branch' : j.via === 'tablet' ? CIG_SKUS[j.sku].name : kindName(j.kind, j.qty); }
    /* 18-deliveries.js */
    function tabletHas() { for (var i = 0; i < 6; i++) if (S.hotbar[i] && S.hotbar[i].kind === 'tablet') return true; return false; }
    /* 18-deliveries.js */
    function tabletHere() { var X = xs(); if (!hasLic('tobacco')) return false; if (X.tablet === 'car') return drive.on || carNear(player.pos.x, player.pos.z, 11); return X.tablet === 'hand' && tabletHas(); }
    /* 18-deliveries.js */
    function paneJobs(tab) {
        var X = xs(), list = jobsOf(tab), rows = [], pos = drive.on ? drive.g.position : player.pos, bj = jobsOf('branch')[0];
        var br = bj ? '<p class="g3-sub2">🏪 <b>Green Leaf, your branch</b> (#' + (X.jobs.indexOf(bj) + 1) + ' on the map, ' + Math.round(Math.hypot(bj.x - pos.x, bj.z - pos.z)) + ' m away): carry bags, joints or cookies to the blue beacon out front and press <b>E</b>. It pays ' + money(BRANCH_PAY) + ' a unit each morning for up to ' + BRANCH_CAP + ' a day (' + (X.branchUnits || 0) + ' dropped off today).</p>' : '';
        if (tab === 'tablet' && !hasLic('tobacco')) return br + '<p class="g3-empty">The RF Smoking round needs the tobacco licence. Buy it at the office PC, and the tablet on the office dock wakes up.</p>';
        if (tab === 'tablet' && !tabletHere()) return br + '<p class="g3-empty">The tablet is ' + (X.tablet === 'car' ? 'in the car, and the car isn\'t here' : 'on its dock in the office') + '. Fetch it, and it rides in the car once you drive off with it.</p>';
        if (!list.length) return br + '<p class="g3-empty">' + (tab === 'tablet' ? 'No round jobs right now. They come in while the shop is open, once the basement is making packs.' : 'Nobody is ringing. Pack some joints or bags and the phone starts going.') + '</p>';
        list.forEach(function (j) {
          var n = X.jobs.indexOf(j) + 1, left = Math.max(0, Math.round((j.until - now()) / 1000)), km = Math.round(Math.hypot(j.x - pos.x, j.z - pos.z)) + ' m';
          var have = j.via === 'tablet' ? ((carState().cigs[j.sku] || 0) + ' in the car · ' + tob().packs[j.sku] + ' on the rack') : (S.pkg[j.kind].n + ' packed');
          rows.push('<tr><td><b>#' + n + '</b></td><td><b>' + j.addr + '</b><br><small>' + km + ' away · ' + have + '</small></td>' +
            '<td>' + j.qty + ' × ' + jobGoods(j) + '</td>' +
            '<td class="' + (left < 60 ? 'bad' : '') + '">' + Math.floor(left / 60) + ' min ' + (left % 60) + ' s</td>' +
            '<td><b>' + (j.via === 'tablet' ? money(j.pay) : '~' + money(Math.round(unitPrice(j.kind, 60, 1.2) * j.qty * 1.6))) + '</b><br><small>' + (j.via === 'tablet' ? 'to the bank' : 'cash, +heat') + '</small></td></tr>');
        });
        return br + '<p class="g3-sub2">' + (tab === 'tablet' ? 'Load packs into the car or the van at home (Shift+E on it), drive the round, and press <b>E</b> at each beacon. Numbers match the map on <b>M</b>.' : 'Carry the goods in your hands and press <b>E</b> at the beacon. Cash goes in your pocket and it raises your heat.') + '</p>' +
          '<table class="g3-jobs"><tr><th></th><th>Address</th><th>Order</th><th>Left</th><th>Pays</th></tr>' + rows.join('') + '</table>';
      }
    /* 18-deliveries.js */
    function expansionNewDay(offline) {
        var X = xs(), wages = (X.staff.driver ? 90 : 0) + (X.staff.operator ? 80 : 0) + (X.staff.night ? 70 : 0) + (X.staff.labtech ? LAB_TECH.wage : 0); if (wages) { var wPaid = drawFunds(wages); if (wages - wPaid > 0.5) books().arrears += wages - wPaid; if (!offline) logEvent('💼 Extra staff wages: ' + money(wages), ''); }
        if (X.staff.driver) { var T = tob(), val = 0, n = 0; CIG_KEYS.forEach(function (k) { var sell = Math.max(0, T.packs[k] - COST.driverKeep); n += sell; val += sell * CIG_SKUS[k].price * TOB.driverShare; T.packs[k] -= sell; });   /* a little under the tobacconist: he saves you the drive */   /* he leaves a few of each kind on the rack so the round jobs can still be filled */ if (n) { S.bank += Math.round(val); bookSale(Math.round(val)); syncTobRack(); if (!offline) { logEvent('🚚 Your driver sold ' + n + ' packs wholesale for ' + money(Math.round(val)), 'good'); toast('🚚 Driver: ' + n + ' packs wholesaled · ' + money(Math.round(val)), 'good'); } } }
        if (X.branch) { var bu = Math.min(BRANCH_CAP, X.branchUnits || 0), inc = Math.round(bu * BRANCH_PAY + Math.max(0, S.rep) * 2); X.branchUnits = 0; S.bank += inc; bookSale(inc); logEvent('🏪 Green Leaf (your branch) sent over ' + money(inc) + ': ' + bu + ' units you dropped off at ' + money(BRANCH_PAY) + ' each, plus ' + money(Math.max(0, S.rep) * 2) + ' on your name', inc > 0 ? 'good' : ''); if (!offline) toast('🏪 Branch takings: ' + money(inc) + (bu ? '' : ' (nothing dropped off yesterday, stock it at the blue beacon)'), bu ? 'good' : ''); }
        if (!offline && weekend()) toast('📅 It\'s the weekend. Expect more people through the door.', ''); if (!offline && (S.day % 28) === 25) toast('🎉 Holiday week starts. Footfall is up by half.', 'rare');
      }
    /* 19-doors-fixtures-intro.js */
    var FIXTURES = [], fxById = {}, fxSignCount = {}, fxRay = new THREE.Raycaster(), fxTick = 0;
    /* 19-doors-fixtures-intro.js */
    function fixtureSign(m, lines) { var key = 'sign:' + String(lines && lines[0] || 'sign').slice(0, 32); fxSignCount[key] = (fxSignCount[key] || 0) + 1; fixtureAdd(key + '#' + fxSignCount[key], 'sign “' + String(lines && lines[0] || '').slice(0, 24) + '”', [m], 0); }
    /* 22-dehum-street-rooms.js */
    function syncRack() {
        if (!propInst.rack) return; var g = propInst.rack.ctx.dynGroup(); dropKids(g);
        world.interact = world.interact.filter(function (m) { return m.userData.dynGroup !== 'rack'; });
        var rx = 0, rz = 0;
        var soil = Math.min(S.supplies.soil || 0, 6);
        for (var i = 0; i < soil; i++) { var sack = productSoilSack(1.5); sack.position.set(rx - 0.32 + (i % 3) * 0.3, 0.41, rz - 0.1 + Math.floor(i / 3) * 0.2); sack.rotation.y = ((i % 3) - 1) * 0.08; sack.rotation.y = (i % 2) * 0.2; sack.castShadow = true; g.add(sack); }
        var nut = Math.min(S.supplies.nutrients || 0, 5), spr = Math.min(S.supplies.remedy || 0, 4);
        for (var n = 0; n < nut; n++) { var bt = productNutrientBottle(1.35); bt.position.set(rx - 0.36 + n * 0.1, 0.88, rz - 0.1); bt.rotation.y = n * 0.5; g.add(bt); }
        for (var sI = 0; sI < spr; sI++) { var sb = productSprayBottle(1.3); sb.position.set(rx + 0.1 + sI * 0.1, 0.9, rz + 0.1); sb.rotation.y = Math.PI + sI * 0.3; g.add(sb); }
        if ((S.supplies.bag || 0) > 0) { var bx = cartonBox(0.22, 0.14, 0.16, ['BAGGIES', 'x100'], 0xe8e8ee, '#3a4a42'); bx.position.set(rx - 0.3, 1.44, rz + 0.1); g.add(bx); }
        if ((S.supplies.paper || 0) > 0) { var px = cartonBox(0.16, 0.08, 0.12, ['PAPERS', 'king size'], 0xf5e6c8, '#5a4a2a'); px.position.set(rx, 1.41, rz + 0.12); g.add(px); }
        if ((S.supplies.tip || 0) > 0) { var tx = cartonBox(0.12, 0.08, 0.12, ['TIPS', 'filter'], 0xc8b48a, '#4a3a22'); tx.position.set(rx + 0.25, 1.41, rz + 0.12); g.add(tx); }
        var spare = Math.min(Math.max(0, (S.supplies.pot || 0) - S.plants.length), 4);
        for (var pI = 0; pI < spare; pI++) { var pt = new THREE.Mesh(roundCylGeo(0.11, 0.09, 0.14, 14), MAT.pot); pt.position.set(rx - 0.3 + pI * 0.2, 1.93, rz); g.add(pt); }
        var jars = Math.min(S.supplies.jar || 0, 3); for (var jI = 0; jI < jars; jI++) { var jr = new THREE.Mesh(roundCylGeo(0.06, 0.06, 0.14, 12), MAT.jar); jr.position.set(rx + 0.2 + jI * 0.14, 1.93, rz + 0.12); g.add(jr); }
        var sx2 = 0; STRAINS.forEach(function (st) { var n = S.supplies['seed_' + st.id] || 0; if (!n) return; var pk = productSeedPacket(st, 1.35); pk.position.set(rx - 0.36 + (sx2 % 6) * 0.16, 1.48 - Math.floor(sx2 / 6) * 0.19, rz - 0.15);   /* six to a row, then the next shelf down */ pk.rotation.x = -0.35; g.add(pk); var ph = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.12), MAT.none); ph.position.copy(pk.position); g.add(ph); interactable(ph, { kind: 'rackItem', item: 'seed_' + st.id, label: st.name + ' seed' }); ph.userData.dynGroup = 'rack'; ph.userData.propId = 'rack'; sx2++; });
        if (soil > 0) { var sh = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.3, 0.44), MAT.none); sh.position.set(rx, 0.42, rz); g.add(sh); interactable(sh, { kind: 'rackItem', item: 'soil', label: 'bag of soil' }); sh.userData.dynGroup = 'rack'; sh.userData.propId = 'rack'; }
        if (nut > 0) { var nh = new THREE.Mesh(new THREE.BoxGeometry(0.1 * nut + 0.04, 0.18, 0.1), MAT.none); nh.position.set(rx - 0.36 + (nut - 1) * 0.05, 0.9, rz - 0.1); g.add(nh); interactable(nh, { kind: 'rackItem', item: 'nutrients', label: 'nutrients' }); nh.userData.dynGroup = 'rack'; nh.userData.propId = 'rack'; }
        if (spr > 0) { var rh = new THREE.Mesh(new THREE.BoxGeometry(0.1 * spr + 0.04, 0.22, 0.1), MAT.none); rh.position.set(rx + 0.1 + (spr - 1) * 0.05, 0.94, rz + 0.1); g.add(rh); interactable(rh, { kind: 'rackItem', item: 'remedy', label: 'pest spray' }); rh.userData.dynGroup = 'rack'; rh.userData.propId = 'rack'; }
          g.traverse(function (o) { if (o.isMesh) o.userData.propId = 'rack'; });
      }
    /* 23-board.js */
    var DESK_PAGES = ['overview', 'prs', 'seats', 'fleet', 'watch'];
    /* 23-board.js */
    var DESK_PAGE_LABEL = { overview: 'Overview', prs: 'Stock', seats: 'Staff', fleet: 'Production', watch: 'Security' };
    /* 23-board.js */
    var DESK_INK = '#e8f1ea', DESK_DIM = '#8fa596', DESK_MUTE = '#4d5e52', DESK_OK = '#6fdc8c', DESK_WARN = '#ffc857', DESK_BAD = '#ff6b6b';
    /* 23-board.js */
    function deskTrim(ctx, text, maxW) { text = String(text || ''); if (ctx.measureText(text).width <= maxW) return text; while (text.length > 4 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -2); return text + '…'; }
    /* 23-board.js */
    function dashRows() {
        var X = typeof xs === 'function' ? xs() : { heat: 0, staff: {}, weather: { kind: 'clear' } }, T = typeof tob === 'function' ? tob() : null, packs = T ? CIG_KEYS.reduce(function (a, k) { return a + T.packs[k]; }, 0) : 0;
        var staffN = crewList().length + 1 + (X.staff.driver ? 1 : 0) + (X.staff.operator ? 1 : 0) + (X.staff.night ? 1 : 0);
        return {
          overview: [['Bank', money(S.bank), 'cash on site ' + money(cashOnSite())], ['Rep', String(Math.round(S.rep)), 'level ' + S.level], ['Market', (S.market || 1).toFixed(2) + '×', shop().open ? 'shop is open' : 'shop is closed'], ['Day', String(S.day || 1), (typeof seasonLabel === 'function' ? seasonLabel() : '') + ' · ' + X.weather.kind]],
          prs: [['Cured stash', Math.round(S.cured.g) + ' g', 'ready to pack'], ['Eighth bags', String(S.pkg.bags.n), 'on the goods shelf'], ['Joints', String(S.pkg.joints.n), 'on the goods shelf'], ['Cookies', String(S.pkg.cookies.n), 'on the goods shelf']],
          seats: [['People on the payroll', String(staffN), 'guard included'], ['Driver', X.staff.driver ? 'hired' : 'none', 'wholesale and deliveries'], ['Basement operator', X.staff.operator ? 'hired' : 'none', 'keeps the line running'], ['Night guard', X.staff.night ? 'hired' : 'none', 'stops break-ins']],
          fleet: [['Cigarette packs', String(packs), 'on the basement rack'], ['Plants growing', String(S.plants.length), 'in the tent'], ['Roof beds', String((X.roof || []).filter(function (b) { return b.stage !== 'empty'; }).length), 'sown'], ['Lab', X.lab && X.lab.job ? 'running' : 'idle', 'extraction and edibles']],
          watch: [['Heat', Math.round(X.heat) + ' / 100', X.heat >= 60 ? 'inspections likely' : X.heat >= 30 ? 'noticed' : 'quiet'], ['Robberies', String(S.stats.heists || 0), (S.stats.foiled || 0) + ' foiled'], ['Lost to robbers', money(S.stats.robbed || 0), 'all time'], ['Power', typeof powerOn === 'function' && !powerOn() ? 'CUT' : 'on', S.upgrades.generator ? 'generator standing by' : 'no generator']]
        };
      }
    /* 23-board.js */
    var DESK_TAB_X = 470, DESK_TAB_W = 170, DESK_TAB_H = 44, DESK_TAB_Y = 30, DESK_FONT = '"Segoe UI",system-ui,sans-serif';
    /* 23-screen-kit.js */
    var SCR_MONO = '"Cascadia Mono",Consolas,monospace', SCR_EMOJI = '"Segoe UI Emoji","Segoe UI Symbol","Apple Color Emoji",sans-serif';
    /* 23-screen-kit.js */
    function tCursor(sc, ctx) {
        var c = sc.cur, t = now();
        if (sc.tapAt && t - sc.tapAt < 350) { var k = (t - sc.tapAt) / 350; ctx.strokeStyle = 'rgba(111,220,140,' + (1 - k).toFixed(2) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sc.tapX, sc.tapY, 10 + k * 40, 0, Math.PI * 2); ctx.stroke(); }
        if (!c) return; var r = Math.max(8, Math.round(sc.w / 110));
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6;
        ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = sc.hotZone ? DESK_OK : 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    /* 23-screen-kit.js */
    function tDraw(sc) { var ctx = sc.canvas.getContext('2d'); ctx.setTransform(sc.scale, 0, 0, sc.scale, 0, 0); sc.zones = []; sc.drawAt = now(); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; sc.draw(sc, ctx); tCursor(sc, ctx); sc.tex.needsUpdate = true; }
    /* 23-screen-kit.js */
    function scrRgba(hex, a) { var n = parseInt(String(hex).slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
    /* 23-screen-kit.js */
    function scrBg(ctx, W, H, accent) {   // near black, the accent bleeding in from the top left, a fine dot grid, darker corners
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0e1613'); g.addColorStop(1, '#060a08'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var r = ctx.createRadialGradient(W * 0.1, -H * 0.15, 10, W * 0.1, -H * 0.15, W * 0.8); r.addColorStop(0, scrRgba(accent, 0.24)); r.addColorStop(1, scrRgba(accent, 0)); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,.04)'; var st = Math.max(14, Math.round(W / 40)); for (var y = st; y < H; y += st) for (var x = st; x < W; x += st) ctx.fillRect(x, y, 1.5, 1.5);
        var v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }
    /* 23-screen-kit.js */
    function scrCard(ctx, x, y, w, h, o) {
        o = o || {}; var r = o.r || 14, g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.tint ? scrRgba(o.tint, 0.16) : 'rgba(255,255,255,.065)'); g.addColorStop(1, o.tint ? scrRgba(o.tint, 0.05) : 'rgba(255,255,255,.025)');
        ctx.fillStyle = g; roundRect(ctx, x, y, w, h, r); ctx.fill(); ctx.strokeStyle = o.tint ? scrRgba(o.tint, 0.45) : 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5; ctx.stroke();
        if (o.bar) { ctx.fillStyle = o.bar; roundRect(ctx, x + 7, y + 12, 4, h - 24, 2); ctx.fill(); }
      }
    /* 23-screen-kit.js */
    function scrStat(ctx, x, y, w, h, label, value, col) {
        scrCard(ctx, x, y, w, h, { r: Math.min(12, h / 4) }); var fs = Math.round(h * 0.4);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = DESK_DIM; ctx.font = '600 ' + Math.round(h * 0.25) + 'px ' + DESK_FONT; ctx.fillText(deskTrim(ctx, label, w - 16), x + Math.round(h * 0.22), y + Math.round(h * 0.12));
        ctx.fillStyle = col || DESK_INK; ctx.font = '700 ' + fs + 'px ' + SCR_MONO; ctx.fillText(deskTrim(ctx, String(value), w - 16), x + Math.round(h * 0.22), y + Math.round(h * 0.46));
      }
    /* 23-screen-kit.js */
    function scrMeter(ctx, x, y, w, h, frac, col) {
        ctx.fillStyle = 'rgba(255,255,255,.08)'; roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); var fw = Math.max(h, w * clamp(frac, 0, 1));
        var g = ctx.createLinearGradient(x, 0, x + fw, 0); g.addColorStop(0, scrRgba(col, 0.55)); g.addColorStop(1, col); ctx.fillStyle = g; roundRect(ctx, x, y, fw, h, h / 2); ctx.fill();
      }
    /* 23-screen-kit.js */
    function scrLcd(ctx, W, H, accent) {
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c1511'); g.addColorStop(1, '#050907'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = scrRgba(accent, 0.08); for (var y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
        ctx.strokeStyle = scrRgba(accent, 0.45); ctx.lineWidth = 2; roundRect(ctx, 3, 3, W - 6, H - 6, 8); ctx.stroke(); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      }
    /* 23-screen-kit.js */
    function screenShell(g, pw, ph, o) {
        o = o || {}; var bz = o.bezel === undefined ? 0.02 : o.bezel, th = o.depth || 0.026, rim = o.rim === undefined ? 0.005 : o.rim, led = o.led === undefined ? 0x6fdc8c : o.led;
        var back = new THREE.Mesh(bevelGeo(pw + 2 * (bz + rim), ph + 2 * (bz + rim), th, Math.min(0.01, th * 0.42)), o.rimMat || MAT.alu); back.position.z = -th / 2 - 0.0035; back.castShadow = true; g.add(back);
        var bezel = new THREE.Mesh(bevelGeo(pw + 2 * bz, ph + 2 * bz, 0.008, 0.003), MAT.gloss); bezel.position.z = -0.0046; bezel.userData.noDefight = true; g.add(bezel);
        if (bz >= 0.012) {
          var cam = new THREE.Mesh(new THREE.CircleGeometry(Math.min(0.004, bz * 0.22), 10), colorMat(0x05070a, 0.15, 0.6)); cam.position.set(0, ph / 2 + bz / 2, 0.0002); g.add(cam);
          if (led) { var l = new THREE.Mesh(new THREE.CircleGeometry(Math.min(0.0035, bz * 0.18), 8), new THREE.MeshBasicMaterial({ color: led, toneMapped: false })); l.position.set(pw / 2 - 0.01, -ph / 2 - bz / 2, 0.0002); g.add(l); }
        }
        return { back: back, bezel: bezel };
      }
    /* 23-screen-kit.js */
    function litPlane(canvas, pw, ph) { var tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8; var m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.userData.tex = tex; return m; }
    /* 24-screens.js */
    function drawRegister() { if (world.reg && world.reg.sc) tDraw(world.reg.sc); }
    /* 24-screens.js */
    function drawPcScreen() {
        var P = world.pcScr; if (!P) return; P.at = now(); var ctx = P.canvas.getContext('2d'), W = 960, H = 540; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        if (typeof powerOn === 'function' && !powerOn()) { ctx.fillStyle = '#020303'; ctx.fillRect(0, 0, W, H); P.mesh.userData.tex.needsUpdate = true; return; }
        var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#12271f'); g.addColorStop(0.55, '#0a1712'); g.addColorStop(1, '#050b08'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var r1 = ctx.createRadialGradient(W * 0.8, H * 1.1, 10, W * 0.8, H * 1.1, 560); r1.addColorStop(0, 'rgba(111,220,140,.34)'); r1.addColorStop(1, 'rgba(111,220,140,0)'); ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
        var r2 = ctx.createRadialGradient(W * 0.1, -40, 10, W * 0.1, -40, 520); r2.addColorStop(0, 'rgba(124,196,255,.26)'); r2.addColorStop(1, 'rgba(124,196,255,0)'); ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(4,9,7,.62)'; ctx.fillRect(0, 0, W, 30); ctx.fillStyle = DESK_INK; ctx.font = '600 15px ' + DESK_FONT; ctx.textBaseline = 'middle'; ctx.fillText('🌿 Grow Co. OS', 14, 16);
        ctx.textAlign = 'right'; ctx.fillStyle = DESK_DIM; ctx.font = '600 15px ' + SCR_MONO; ctx.fillText(clockText() + ' · day ' + (S.day || 1), W - 14, 16); ctx.textAlign = 'left';
        var cols = ['#2f6d4a', '#7a6a2a', '#4a5560', '#2f5f8a', '#8a4a3a', '#5d4a8a'];
        pcApps().slice(0, 8).forEach(function (a, i) { var x = 26 + Math.floor(i / 4) * 96, y = 52 + (i % 4) * 104; var ig = ctx.createLinearGradient(x, y, x + 58, y + 58); ig.addColorStop(0, cols[i % 6]); ig.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = cols[i % 6]; roundRect(ctx, x, y, 58, 58, 16); ctx.fill(); ctx.fillStyle = ig; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.textAlign = 'center'; ctx.font = '30px ' + SCR_EMOJI; ctx.fillStyle = '#fff'; ctx.fillText(a[1], x + 29, y + 31); ctx.font = '500 13px ' + DESK_FONT; ctx.fillStyle = DESK_INK; ctx.fillText(a[2], x + 29, y + 74); ctx.textAlign = 'left'; });
        // the open window: today's figures
        var wx = 250, wy = 56, ww = 680, wh = 400; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = '#0f1c16'; roundRect(ctx, wx, wy, ww, wh, 14); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.5; roundRect(ctx, wx, wy, ww, wh, 14); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.3)'; roundRect(ctx, wx, wy, ww, 38, 14); ctx.fill(); ctx.fillStyle = DESK_INK; ctx.font = '600 16px ' + DESK_FONT; ctx.fillText('📊 Dashboard', wx + 16, wy + 20);
        [DESK_BAD, DESK_WARN, DESK_OK].forEach(function (c2, i) { ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(wx + ww - 22 - i * 20, wy + 19, 6, 0, Math.PI * 2); ctx.fill(); });
        ctx.textBaseline = 'top'; var X = xs(), st = [['Bank', money(S.bank), DESK_OK], ['Cash on site', money(cashOnSite()), DESK_INK], ['Rep', String(Math.floor(S.rep)), DESK_WARN], ['Market', (S.market || 1).toFixed(2) + '×', DESK_INK]], sw = (ww - 40 - 3 * 10) / 4;
        st.forEach(function (s, i) { scrStat(ctx, wx + 20 + i * (sw + 10), wy + 54, sw, 70, s[0], s[1], s[2]); });
        scrCard(ctx, wx + 20, wy + 138, 400, 244, { r: 12 }); ctx.fillStyle = DESK_DIM; ctx.font = '600 14px ' + DESK_FONT; ctx.fillText('On the shelf', wx + 36, wy + 150);
        var bars = [['Bags', S.pkg.bags.n, '#6fdc8c'], ['Joints', S.pkg.joints.n, '#f0b94d'], ['Cookies', S.pkg.cookies.n, '#7cc4ff'], ['Cured, g', Math.round(S.cured.g), '#c9a0ff']], mx = Math.max(10, bars[0][1], bars[1][1], bars[2][1], bars[3][1]);
        bars.forEach(function (b, i) { var by = wy + 186 + i * 47; ctx.fillStyle = DESK_INK; ctx.font = '15px ' + DESK_FONT; ctx.fillText(b[0], wx + 36, by); ctx.textAlign = 'right'; ctx.font = '700 15px ' + SCR_MONO; ctx.fillText(String(b[1]), wx + 404, by); ctx.textAlign = 'left'; scrMeter(ctx, wx + 36, by + 24, 368, 8, b[1] / mx, b[2]); });
        scrCard(ctx, wx + 434, wy + 138, 226, 244, { r: 12, tint: shop().open ? DESK_OK : DESK_BAD }); ctx.fillStyle = DESK_DIM; ctx.font = '600 14px ' + DESK_FONT; ctx.fillText('The shop', wx + 450, wy + 150);
        ctx.fillStyle = shop().open ? DESK_OK : DESK_BAD; ctx.font = '800 44px ' + DESK_FONT; ctx.fillText(shop().open ? 'Open' : 'Closed', wx + 450, wy + 174);
        ctx.fillStyle = DESK_INK; ctx.font = '15px ' + DESK_FONT; [['Level', String(S.level || 1)], ['Plants', String(S.plants.length)], ['Heat', Math.round(X.heat) + ' / 100'], ['Crew', String(crewList().length)]].forEach(function (l, i) { var ly = wy + 240 + i * 32; ctx.fillStyle = DESK_DIM; ctx.fillText(l[0], wx + 450, ly); ctx.textAlign = 'right'; ctx.fillStyle = DESK_INK; ctx.font = '700 15px ' + SCR_MONO; ctx.fillText(l[1], wx + 644, ly); ctx.textAlign = 'left'; ctx.font = '15px ' + DESK_FONT; });
        // the dock
        var dn = Math.min(pcApps().length, 10), dw = dn * 46 + 96, dx = (W - dw) / 2, dy = H - 62; ctx.fillStyle = 'rgba(4,9,7,.7)'; roundRect(ctx, dx, dy, dw, 50, 16); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; ctx.stroke();
        var sg = ctx.createLinearGradient(0, dy + 8, 0, dy + 42); sg.addColorStop(0, '#7fe79a'); sg.addColorStop(1, '#3fb865'); ctx.fillStyle = sg; roundRect(ctx, dx + 8, dy + 8, 80, 34, 10); ctx.fill(); ctx.fillStyle = '#04210f'; ctx.font = '700 15px ' + DESK_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Start', dx + 48, dy + 26);
        ctx.font = '24px ' + SCR_EMOJI; ctx.fillStyle = '#fff'; pcApps().slice(0, dn).forEach(function (a, i) { ctx.fillText(a[1], dx + 96 + i * 46 + 21, dy + 27); }); ctx.fillStyle = DESK_OK; ctx.fillRect(dx + 96 + 7 * 46 + 12, dy + 44, 18, 3);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; P.mesh.userData.tex.needsUpdate = true;
      }
    /* 24-screens.js */
    var PC_APPS = [
        ['shop', '🛒', 'Supplies', function () { return paneShop(); }],
        ['seeds', '🌱', 'Seed bank', function () { return paneSeeds(); }],
        ['gear', '⚙️', 'Gear', function () { return paneUpgrades(); }],
        ['lic', '🪪', 'Licences', function () { return paneLicences(); }],
        ['staff', '🧑‍🔧', 'Staff', function () { return paneStaff(); }],
        ['bank', '🏦', 'Bank', function () { return paneBank(); }],
        ['jobs', '🚚', 'Deliveries', function () { return '<div class="g3-box">' + paneJobs(hasLic('tobacco') && tabletHere() ? 'tablet' : 'phone') + '</div>'; }],
        ['desk', '🖥️', typeof drawShopBoard === 'function' ? 'Live desk' : 'Dashboard', function () { return paneDesk(); }],
        ['diary', '📒', 'Diary', function () { return paneLog(); }],
        ['stats', '📊', 'Stats', function () { return paneStats(); }],
        ['settings', '⚙', 'Settings', function () { return '<div class="g3-box">' + growSettingsHtml() + '</div>'; }],
        ['guide', '📖', 'Guide', function () { return '<div class="g3-box g3-menu-body" style="margin:0;padding:12px 14px">' + guideHtml() + '</div>'; }],
        ['finance', '💰', 'Finance', function () { return paneFinance(); }, 'finance'],
        ['merch', '👕', 'Merch', function () { return paneMerch(); }, 'merch'],
        ['cup', '🏆', 'The Cup', function () { return paneCup(); }, 'cup'],
        ['breed', '🧬', 'Cultivars', function () { return paneBreed(); }, 'breeding'],
        ['upgrades', '⬆️', 'DLC upgrades', function () { return paneDlcUpg(); }]
      ];
    /* 24-screens.js */
    function pcApps() { return PC_APPS.filter(function (a) { return !a[4] || dlcOn(a[4]); }); }
    /* 24-screens.js */
    var wheel = { open: false, el: null, items: [] };
    /* 24-screens.js */
    function paneDesk() {
        var all = dashRows(); var h = '<div class="g3-box"><div class="g3-chips">' + DESK_PAGES.map(function (p, i) { return '<button class="g3-btn' + (i === deskBoard.page ? ' primary' : '') + '" data-act="deskPage" data-id="' + i + '">' + DESK_PAGE_LABEL[p] + '</button>'; }).join('') + '</div></div>';
        (all[DESK_PAGES[deskBoard.page]] || []).forEach(function (r) { h += '<div class="g3-row"><span class="ico">📊</span><span class="meta"><span class="n">' + esc(r[0]) + ' · ' + esc(r[1]) + '</span><span class="own">' + esc(r[2]) + '</span></span></div>'; });
        return h;
      }
    /* 25-shop-controls.js */
    function shop() { if (!S.shop) S.shop = { open: true, lights: true, radio: 'off', volume: 0.5, curtains: {}, staffDoor: false }; if (!S.shop.curtains) S.shop.curtains = {}; if (!S.shop.rooms) S.shop.rooms = {}; if (typeof S.shop.markup !== 'number') S.shop.markup = 1; if (typeof S.shop.volume !== 'number') S.shop.volume = 0.5; return S.shop; }
    /* 26-radio-dust-tv.js */
    function tone(type, freq, t, dur, gain, dest, attack) { var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + (attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); }
    /* 26-radio-dust-tv.js */
    function binsFull() { var M = xs().mach || {}; return Object.keys(M).some(function (k) { return M[k] && typeof M[k] === 'object' && (M[k].trash || 0) >= 12; }); }
    /* 26-radio-dust-tv.js */
    function syncBroom() { var onWall = !(held() && held().kind === 'broom') && !crew.some(function (r) { return r.hasBroom; }); (world.broomMeshes || []).forEach(function (m) { m.visible = onWall; }); }
    /* 28-props.js */
    function unitCount(base) { var d = PROPS[base]; if (!d || !d.multi) return 1; var n = (S.units && S.units[base]) || 1; return clamp(Math.round(n), 1, d.multi.max); }
    /* 28-props.js */
    function machCost(base, n) { return Math.round(PROPS[base].multi.price * Math.pow(1.35, n - 2)); }
    /* 28-props.js */
    function upgById(id) { for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) return UPGRADES[i]; return { name: id }; }
    /* 28-props.js */
    function unitLock(base) { var m = PROPS[base].multi; if (m.lic && !hasLic(m.lic)) return licById(m.lic).name; if (m.upg && !S.upgrades[m.upg]) return upgById(m.upg).name; return null; }
    /* 28-props.js */
    function growPropPlacement(id) {
        var d = PROPS[id]; var o = (S.layout && S.layout[id]) || {}; var base = unitBase(id), L = (CO.layout && CO.layout().props[id]) || {};   /* the layout the editor shipped sits between the definition and the save */
        var owned = base === id || unitIds(base).indexOf(id) >= 0;   /* a unit you sold or reset away keeps its prop record but builds nothing */
        return { x: typeof o.x === 'number' ? o.x : (typeof L.x === 'number' ? L.x : d.x), z: typeof o.z === 'number' ? o.z : (typeof L.z === 'number' ? L.z : d.z), rot: typeof o.rot === 'number' ? o.rot : (typeof L.rot === 'number' ? L.rot : (d.rot || 0)), floor: d.floor || 0, unit: d.unit || 1, hidden: !!o.hidden || !owned || !dlcProp(id) };
      }
    /* 28-props.js */
    function growPropCtx(g, id, floorLevel) {
        var obs = [];
        var ctx = {
          box: function (w, h, d, mat, x, y, z, opts) { opts = opts || {}; var m = new THREE.Mesh(opts.sharp || bevelSkip(mat) ? new THREE.BoxGeometry(w, h, d) : bevelGeo(w, h, d, opts.r), mat); m.position.set(x, y, z); m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false; g.add(m); if (opts.solid) obs.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 }); return m; },
          cyl: function (rt, rb, h, mat, x, y, z, seg) { var m = new THREE.Mesh(roundCylGeo(rt, rb, h, seg || 18), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; },
          add: function (m) { g.add(m); return m; },
          hit: function (w, h, d, x, y, z, data) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.none); m.position.set(x, y, z); g.add(m); if (data) data.propId = id;   /* the prompt has to know WHICH machine it is looking at, not just what kind */ interactable(m, data); m.userData.propId = id; return m; },
          sign: function (lines, w, h, x, y, z, rotY, opts) { opts = opts || {}; var tex = signTex(lines, Math.round(w * 320), Math.round(h * 320), Object.assign({ size: Math.round(h * 48) }, opts)); var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); m.position.set(x, y, z); m.rotation.y = rotY || 0; g.add(m); if (opts.bg === undefined && h >= 0.15) signBack(m, w, h); return m; },
          placard: function (lines, w, h, x, y, z, opts) {   /* a counter sign: a weighted foot, two slim posts, the plate between them */
            var by = y - h / 2 - 0.245; ctx.box(Math.min(w * 0.7, 0.34), 0.014, 0.09, MAT.gunmetal, x, by + 0.007, z - 0.01, { cast: false });
            [-1, 1].forEach(function (sd) { var st = new THREE.Mesh(roundCylGeo(0.006, 0.006, 0.25 + h * 0.5, 8), MAT.chrome); st.position.set(x + sd * Math.min(w * 0.3, 0.14), by + (0.25 + h * 0.5) / 2, z - 0.012); g.add(st); });
            return ctx.sign(lines, w, h, x, y, z, 0, opts); },
          solid: function (x1, x2, z1, z2) { obs.push({ x1: x1, x2: x2, z1: z1, z2: z2 }); },
          fern: function (x, z, s, y0) {   /* a fern in a glazed pot on a saucer: two rings of fronds, the outer ones lying lower */
            y0 = y0 || 0; var at = function (yy) { return y0 + yy * s; };
            ctx.cyl(0.2 * s, 0.205 * s, 0.025 * s, colorMat(0xd8d2c2, 0.4), x, at(0.0125), z, 28); ctx.cyl(0.2 * s, 0.15 * s, 0.36 * s, MAT.ceramic, x, at(0.2), z, 28); ctx.cyl(0.215 * s, 0.205 * s, 0.045 * s, MAT.ceramic, x, at(0.385), z, 28); ctx.cyl(0.185 * s, 0.185 * s, 0.012 * s, MAT.soil, x, at(0.402), z, 20);
            for (var i = 0; i < 17; i++) { var a = i * 2.399, ring = i % 3; leafAt(FROND_GEO, MAT.frond, x + Math.cos(a) * 0.04 * s, at(0.4), z + Math.sin(a) * 0.04 * s, Math.PI / 2 - a, 0.25 + ring * 0.38 + ((i * 7) % 5) * 0.03, s * (1.05 - ring * 0.12 + ((i * 3) % 4) * 0.04), g); }
            obs.push({ x1: x - 0.25, x2: x + 0.25, z1: z - 0.25, z2: z + 0.25 }); },
          lit: function (col, w, h, x, y, z, ry, rx) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); g.add(m); return m; },   /* a lit strip or a pilot light: shown in its own colour whatever the room is doing */
          group: g, obstacles: obs, floor: floorLevel, dyn: null
        };
        ctx.dynGroup = function () { if (!ctx.dyn) { ctx.dyn = new THREE.Group(); ctx.dyn.userData.dyn = true; g.add(ctx.dyn); } return ctx.dyn; };   /* what a sync() refills is never baked */
        return ctx;
      }
    /* 28-props.js */
    function growPropWorld(id, lx, lz) { var inst = propInst[id]; inst.g.updateMatrixWorld(true); var v = new THREE.Vector3(lx, 0, lz); inst.g.localToWorld(v); return v; }
    /* 29-prop-defs.js */
    function legs4(c, w, d, h, mat, inset, thick) { inset = inset || 0.06; thick = thick || 0.05; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (l) { c.box(thick, h - 0.012, thick, mat, l[0] * (w / 2 - inset), h / 2 + 0.006, l[1] * (d / 2 - inset)); c.box(thick + 0.012, 0.012, thick + 0.012, MAT.soft, l[0] * (w / 2 - inset), 0.006, l[1] * (d / 2 - inset), { cast: false }); }); }
    /* 29-prop-defs.js */
    function drawer(c, w, h, d, x, y, z, mat) {
        c.box(w, h, d, mat || MAT.darkwood, x, y, z); var f = z + d / 2;
        c.box(w - 0.012, h - 0.012, 0.004, MAT.black, x, y, f + 0.001, { cast: false }); c.box(w - 0.026, h - 0.026, 0.016, MAT.wood, x, y, f + 0.008, { cast: false });
        var hw = Math.min(0.2, w * 0.45); [-1, 1].forEach(function (sd) { c.cyl(0.005, 0.005, 0.022, MAT.chrome, x + sd * hw * 0.42, y, f + 0.026, 8).rotation.x = Math.PI / 2; });
        c.cyl(0.006, 0.006, hw, MAT.chrome, x, y, f + 0.038, 10).rotation.z = Math.PI / 2;
      }
    /* 29-prop-defs.js */
    function chair(c, x, z, rotY, seatM, frameM) {
        var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY || 0; c.add(g);
        function m(geo, mat, px, py, pz) { var mm = new THREE.Mesh(geo, mat); mm.position.set(px, py, pz); mm.castShadow = true; g.add(mm); return mm; }
        m(bevelGeo(0.44, 0.05, 0.44), seatM, 0, 0.45, 0); m(bevelGeo(0.44, 0.06, 0.4), seatM, 0, 0.5, 0.01);
        var back = m(bevelGeo(0.42, 0.42, 0.04), seatM, 0, 0.74, -0.2); back.rotation.x = -0.08;
        [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(function (l) { m(roundCylGeo(0.018, 0.018, 0.45, 8), frameM || MAT.chrome, l[0], 0.225, l[1]); });
        c.solid(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
        return g;
      }
    /* 29-prop-defs.js */
    function officeChairBuild(c) {
        var seatM = fabricMat(0x24272c), meshM = fabricMat(0x15171a), shellM = MAT.soft;
        c.cyl(0.05, 0.06, 0.05, MAT.chrome, 0, 0.115, 0, 14); c.cyl(0.024, 0.024, 0.2, MAT.chrome, 0, 0.24, 0, 12); c.cyl(0.034, 0.034, 0.14, MAT.soft, 0, 0.37, 0, 12);
        for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; var arm = c.box(0.3, 0.026, 0.046, MAT.alu, Math.cos(a) * 0.16, 0.085, Math.sin(a) * 0.16); arm.rotation.y = -a; c.cyl(0.014, 0.014, 0.05, MAT.soft, Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3, 8); var wh = c.cyl(0.03, 0.03, 0.04, MAT.black, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3, 12); wh.rotation.z = Math.PI / 2; wh.rotation.y = -a; }
        c.box(0.3, 0.04, 0.3, shellM, 0, 0.445, 0);                                                      /* the mechanism under the seat */
        c.box(0.5, 0.07, 0.5, seatM, 0, 0.5, -0.01, { r: 0.03 }); c.box(0.44, 0.03, 0.12, seatM, 0, 0.525, -0.2, { r: 0.012 });   /* the pad, with a waterfall front edge */
        c.box(0.05, 0.36, 0.03, shellM, 0, 0.64, 0.27).rotation.x = 0.16;                                /* the spine the back hangs on */
        var back = c.box(0.46, 0.56, 0.035, meshM, 0, 0.86, 0.275, { r: 0.016 }); back.rotation.x = 0.12;
        [-0.235, 0.235].forEach(function (x) { c.box(0.022, 0.58, 0.05, shellM, x, 0.86, 0.275).rotation.x = 0.12; });   /* the frame round the mesh */
        c.box(0.5, 0.024, 0.05, shellM, 0, 1.147, 0.31).rotation.x = 0.12; c.box(0.36, 0.07, 0.05, seatM, 0, 0.72, 0.245, { r: 0.02 }).rotation.x = 0.12;   /* top rail, lumbar pad */
        c.box(0.03, 0.12, 0.024, shellM, 0, 1.2, 0.325).rotation.x = 0.12; c.box(0.3, 0.13, 0.06, seatM, 0, 1.29, 0.33, { r: 0.025 }).rotation.x = 0.05;   /* headrest */
        [-0.29, 0.29].forEach(function (x) { c.box(0.03, 0.2, 0.04, shellM, x, 0.6, 0.02); c.box(0.03, 0.03, 0.14, shellM, x, 0.5, 0.05); c.box(0.07, 0.03, 0.27, seatM, x, 0.712, -0.02, { r: 0.012 }); });
        c.solid(-0.3, 0.3, -0.3, 0.3);
      }
    /* 29-prop-defs.js */
    function bookshelfBuild(c, w, h, rows) {
        // open carcass (sides, base, back) so the books on the shelves are actually visible; the old solid block hid them
        [-1, 1].forEach(function (sd) { c.box(0.06, h, 0.3, MAT.darkwood, sd * (w / 2 - 0.03), h / 2, 0); }); c.box(w, 0.08, 0.3, MAT.darkwood, 0, 0.04, 0); c.box(w, h, 0.05, MAT.darkwood, 0, h / 2, -0.125); c.box(w - 0.12, h - 0.12, 0.01, colorMat(0x2a1c10, 0.8), 0, h / 2, -0.097, { cast: false }); c.solid(-w / 2, w / 2, -0.15, 0.15);
        for (var r = 0; r < rows; r++) { var sy = 0.3 + r * ((h - 0.4) / rows); c.box(w - 0.06, 0.025, 0.28, MAT.wood, 0, sy, 0.01, { cast: false }); var bx = -w / 2 + 0.06; var lean = 0; while (bx < w / 2 - 0.12) { var bw = randf(0.035, 0.08), bh = randf(0.2, 0.32); var bk = c.box(bw, bh, randf(0.16, 0.22), colorMat(pick([0xc94a3a, 0x2f6b9a, 0x3aa36a, 0xe0c25a, 0x7a5aa8, 0xf2f2f2, 0x8a4a2a, 0x1c1c22]), 0.9), bx + bw / 2, sy + bh / 2 + 0.012, 0.03, { cast: false }); if (Math.random() < 0.15 && bx > -w / 2 + 0.2) { bk.rotation.z = 0.18; bk.position.x += 0.02; bx += 0.03; } bx += bw + 0.008; if (Math.random() < 0.12) bx += randf(0.05, 0.12); } if (r === rows - 1) { c.cyl(0.05, 0.04, 0.12, MAT.jar, w / 2 - 0.15, sy + 0.07, 0.05, 12); } }
        c.box(w, 0.06, 0.32, MAT.darkwood, 0, h - 0.03, 0.005);
      }
    /* 29-prop-defs.js */
    function sofaBuild(c, w, seatM, pipeM) {
        // upholstery is soft, so every cushion is a box with a generous radius: a plinth, seat pads, back pads that lean, rolled arms, turned feet
        var d = 0.85; c.box(w, 0.22, d, pipeM, 0, 0.2, 0, { solid: true, r: 0.03 }); c.box(w - 0.04, 0.04, d - 0.04, MAT.black, 0, 0.07, 0, { cast: false });
        var n = Math.max(1, Math.round(w / 0.62)); for (var i = 0; i < n; i++) { var cx = -w / 2 + 0.15 + (w - 0.3) * (i + 0.5) / n; var cw = (w - 0.3) / n - 0.012; c.box(cw, 0.17, d - 0.26, seatM, cx, 0.39, 0.09, { r: 0.05 }); c.box(cw, 0.44, 0.17, seatM, cx, 0.63, -0.3, { r: 0.06 }).rotation.x = -0.14; }
        c.box(w, 0.52, 0.13, pipeM, 0, 0.55, -0.39, { r: 0.04 }); [-1, 1].forEach(function (sd) { c.box(0.15, 0.36, d, seatM, sd * (w / 2 - 0.075), 0.5, 0, { r: 0.06 }); var roll = c.cyl(0.085, 0.085, d - 0.02, seatM, sd * (w / 2 - 0.075), 0.69, 0, 20); roll.rotation.x = Math.PI / 2; });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (l) { c.cyl(0.028, 0.018, 0.09, MAT.darkwood, l[0] * (w / 2 - 0.1), 0.045, l[1] * (d / 2 - 0.1), 12); });
      }
    /* 29-prop-defs.js */
    function coffeeTableBuild(c, x, z, w, d) { c.box(w, 0.035, d, MAT.wood, x, 0.42, z, { solid: true }); c.box(w - 0.1, 0.02, d - 0.1, MAT.darkwood, x, 0.2, z, { cast: false }); legs4({ box: function (a, b, e, m, px, py, pz) { return c.box(a, b, e, m, px + x, py, pz + z); } }, w, d, 0.4, MAT.chrome, 0.06, 0.03); }
    /* 29-prop-defs.js */
    function crateBuild(c, x, y, z, s) {   // a slatted pine crate: corner posts, three boards a side with gaps you can see through, a lid of planks, rope handles
        s = s || 0.55; var hgt = s * 0.9, pine = MAT.wood, inner = colorMat(0x2a1c10, 0.9);
        c.box(s - 0.05, hgt - 0.04, s - 0.05, inner, x, y + hgt / 2, z, { cast: false });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { c.box(0.045, hgt, 0.045, pine, x + p[0] * (s / 2 - 0.0225), y + hgt / 2, z + p[1] * (s / 2 - 0.0225)); });
        for (var b = 0; b < 3; b++) { var by = y + hgt * (0.17 + b * 0.33); [-1, 1].forEach(function (d) { c.box(s, hgt * 0.27, 0.018, pine, x, by, z + d * (s / 2 - 0.004)); c.box(0.018, hgt * 0.27, s, pine, x + d * (s / 2 - 0.004), by, z); }); }
        for (var l = 0; l < 4; l++) c.box(s / 4 - 0.008, 0.018, s, pine, x - s / 2 + s / 8 + l * s / 4, y + hgt + 0.004, z, { cast: false });
        [-1, 1].forEach(function (d) { var h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), MAT.rope); h.position.set(x + d * (s / 2 + 0.004), y + hgt * 0.62, z); h.rotation.set(0, Math.PI / 2, Math.PI); c.add(h); });
      }
    /* 29-prop-defs.js */
    function lobbyBench(c) { for (var s = -0.7; s <= 0.7; s += 0.14) c.box(0.12, 0.05, 0.45, MAT.wood, s, 0.55, 0); c.box(1.6, 0.05, 0.45, MAT.none, 0, 0.55, 0, { solid: true, cast: false }); for (var b = 0; b < 3; b++) c.box(1.6, 0.09, 0.03, MAT.wood, 0, 0.72 + b * 0.12, -0.2 - b * 0.02); [-0.65, 0.65].forEach(function (x) { c.box(0.05, 0.55, 0.45, colorMat(0x2a2d33, 0.4, 0.6), x, 0.275, 0); c.box(0.05, 0.5, 0.05, colorMat(0x2a2d33, 0.4, 0.6), x, 0.8, -0.2); }); }
    /* 29-prop-defs.js */
    var ROPE_COLORS = { red: 0xc94a3a, navy: 0x2a3a6a, black: 0x1a1a1c, gold: 0xc9a44a, green: 0x2e7d4f }, ROPE_POSTS = { chrome: [0xd8dde2, 0.25, 0.95], brass: [0xb8913a, 0.35, 0.85], black: [0x1a1a1c, 0.4, 0.6] }, ROPE_LENS = [1.2, 1.8, 2.4, 3.0];
    /* 29-prop-defs.js */
    function ropeStyle(id) { if (!S.ropes) S.ropes = {}; var st = S.ropes[id] || {}; return { color: ROPE_COLORS[st.color] ? st.color : 'red', len: ROPE_LENS.indexOf(st.len) >= 0 ? st.len : 1.8, posts: ROPE_POSTS[st.posts] ? st.posts : 'chrome', kind: st.kind === 'belt' ? 'belt' : 'rope', open: !!st.open }; }
    /* 29-prop-defs.js */
    function ropeBuild(c) {   // two posts and a velvet rope (or a retractable belt) clipped between them, along local x; unhooked, it hangs down the far post
        var id = c.group.userData.propId, st = ropeStyle(id), hx = st.len / 2, pf = ROPE_POSTS[st.posts], postM = colorMat(pf[0], pf[1], pf[2]), bandM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: ROPE_COLORS[st.color], roughness: 1 });
        [-hx, hx].forEach(function (x) { c.cyl(0.025, 0.025, 0.95, postM, x, 0.475, 0, 12); c.cyl(0.16, 0.18, 0.03, postM, x, 0.015, 0, 20); var ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), postM); ball.position.set(x, 0.98, 0); ball.castShadow = true; c.add(ball); c.solid(x - 0.15, x + 0.15, -0.15, 0.15); });
        var piv = new THREE.Group(); piv.position.set(-hx, 0.93, 0); c.add(piv);
        if (st.kind === 'belt') { var belt = new THREE.Mesh(bevelGeo(st.len - 0.05, 0.05, 0.006), bandM); belt.position.set(hx, -0.03, 0); belt.castShadow = true; piv.add(belt); }
        else { var rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(hx, -0.12 * st.len, 0), new THREE.Vector3(st.len, 0, 0)), 20, 0.022, 8, false), bandM); rope.castShadow = true; piv.add(rope); }
        var clip = new THREE.Mesh(bevelGeo(0.05, 0.035, 0.03), postM); clip.position.set(st.len - 0.03, st.kind === 'belt' ? -0.03 : 0, 0); piv.add(clip);
        var G = ropeGate(id); G.pivot = piv; G.len = st.len; ropePose(G);
        c.hit(st.len + 0.3, 1.05, 0.35, 0, 0.52, 0, { kind: 'rope' });
      }
    /* 29-prop-defs.js */
    var ropeGates = {}, ropeSegList = [];
    /* 29-prop-defs.js */
    function ropeGate(id) { return ropeGates[id] || (ropeGates[id] = { open: 0, clip: false, want: false, waitT: 0, idleT: 0, pivot: null, len: 1.8 }); }
    /* 29-prop-defs.js */
    function ropePose(G) { if (!G.pivot) return; G.pivot.rotation.z = -G.open * Math.PI / 2; G.pivot.scale.x = 1 + (Math.min(1, 0.86 / G.len) - 1) * G.open; }
    /* 29-prop-defs.js */
    function warmStrip(c, w, x, y, z) { return c.box(w, 0.012, 0.02, emitMat(0xffe2b0, 1.2), x, y, z, { cast: false, sharp: true }); }
    /* 29-prop-defs.js */
    function lobbyBenchExtra(c) {
        var iron = colorMat(0x2a2d33, 0.4, 0.6);
        [-0.65, 0.65].forEach(function (x) { c.box(0.075, 0.032, 0.46, MAT.wood, x, 0.815, 0.0, { r: 0.012 }); c.box(0.05, 0.25, 0.05, iron, x, 0.675, 0.19); c.box(0.07, 0.02, 0.54, iron, x, 0.01, 0, { cast: false }); var sc = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 18, Math.PI), iron); sc.position.set(x, 0.3, 0); sc.rotation.y = Math.PI / 2; c.add(sc); });
        c.box(1.26, 0.035, 0.035, iron, 0, 0.3, 0.0, { cast: false }); c.box(1.6, 0.05, 0.035, MAT.wood, 0, 1.06, -0.245, { r: 0.012 });
        for (var b = 0; b < 3; b++) [-0.5, 0, 0.5].forEach(function (x) { c.cyl(0.008, 0.008, 0.008, MAT.brass, x, 0.72 + b * 0.12, -0.182 - b * 0.02, 8).rotation.x = Math.PI / 2; });
      }
    /* 29-prop-defs.js */
    function bookshelfExtra(w, h) { return function (c) {
        c.box(w + 0.1, 0.05, 0.38, MAT.darkwood, 0, h + 0.025, 0.02, { r: 0.012 }); c.box(w + 0.05, 0.035, 0.35, MAT.darkwood, 0, h - 0.015, 0.012, { cast: false }); c.box(w + 0.04, 0.1, 0.02, MAT.darkwood, 0, 0.05, 0.16, { cast: false });
        [-1, 1].forEach(function (sd) { c.box(0.07, h - 0.1, 0.012, MAT.darkwood, sd * (w / 2 - 0.03), h / 2, 0.156, { cast: false }); });
        c.box(w - 0.14, 0.012, 0.02, emitMat(0xffe2b0, 1.0), 0, h - 0.075, 0.12, { cast: false, sharp: true });
        c.cyl(0.05, 0.04, 0.07, MAT.ceramic, -w / 2 + 0.2, h + 0.085, 0.02, 16); for (var i = 0; i < 7; i++) leafAt(LEAF_GEO_SM, MAT.bigleaf, -w / 2 + 0.2, h + 0.12, 0.02, i * 0.9, 0.5 + (i % 3) * 0.2, 0.26, c.group);
        c.box(0.2, 0.03, 0.14, colorMat(0x8a2a2a, 0.8), w / 2 - 0.25, h + 0.065, 0.02).rotation.y = 0.3; c.box(0.18, 0.025, 0.13, colorMat(0x2f6b9a, 0.8), w / 2 - 0.25, h + 0.093, 0.02).rotation.y = -0.1;
      }; }
    /* 30-edit-player-hands.js */
    function freeSlot() { if (!S.hotbar[S.slot]) return S.slot; for (var i = 0; i < 6; i++) if (!S.hotbar[i]) return i; return -1; }
    /* 31-models-machines.js */
    var PROD_M = {};
    /* 31-models-machines.js */
    function prodMat(key, make) { return PROD_M[key] || (PROD_M[key] = make()); }
    /* 31-models-machines.js */
    function productJoint(s) {   // a tapered cone of paper: card roach, twisted tail, scorched tip
        var G = new THREE.Group();
        var paperM = prodMat('paper', function () { return new THREE.MeshStandardMaterial({ color: 0xf7f3e6, roughness: 0.95 }); });
        var roachM = prodMat('roach', function () { return new THREE.MeshStandardMaterial({ color: 0xc19a63, roughness: 0.9 }); });
        var ashM = prodMat('ash', function () { return new THREE.MeshStandardMaterial({ color: 0x3a3330, roughness: 1 }); });
        var b = new THREE.Mesh(roundCylGeo(0.0074 * s, 0.005 * s, 0.084 * s, 8), paperM); b.position.y = 0.012 * s; G.add(b);
        var r = new THREE.Mesh(roundCylGeo(0.0051 * s, 0.0051 * s, 0.02 * s, 8), roachM); r.position.y = -0.04 * s; G.add(r);
        var t = new THREE.Mesh(new THREE.ConeGeometry(0.0074 * s, 0.017 * s, 8), paperM); t.position.y = 0.0625 * s; G.add(t);
        var a = new THREE.Mesh(roundCylGeo(0.0076 * s, 0.0076 * s, 0.004 * s, 8), ashM); a.position.y = 0.0535 * s; G.add(a);
        return G;
      }
    /* 31-models-machines.js */
    function productBaggie(st, s) {   // a zip-lock you can see the bud through, with the strain on the label
        var G = new THREE.Group();
        var filmM = prodMat('film', function () { return new THREE.MeshStandardMaterial({ color: 0xeef7f0, roughness: 0.12, transparent: true, opacity: 0.4 }); });
        var zipM = prodMat('zip', function () { return new THREE.MeshStandardMaterial({ color: 0xf7fbf8, roughness: 0.5 }); });
        var nugM = prodMat('nug' + st.id, function () { return new THREE.MeshStandardMaterial({ color: st.bud, roughness: 0.9 }); });
        G.add(new THREE.Mesh(bevelGeo(0.076 * s, 0.062 * s, 0.017 * s), filmM));
        for (var q = 0; q < 5; q++) { var n = new THREE.Mesh(new THREE.IcosahedronGeometry((0.0105 + (q % 3) * 0.0022) * s, 0), nugM); n.position.set((-0.021 + (q % 3) * 0.021) * s, (-0.014 + Math.floor(q / 3) * 0.015) * s, 0); n.scale.set(1, 0.85, 0.7); n.rotation.set(q, q * 1.4, 0.4); G.add(n); }
        var zip = new THREE.Mesh(bevelGeo(0.078 * s, 0.006 * s, 0.019 * s), zipM); zip.position.y = 0.027 * s; G.add(zip);
        var lip = new THREE.Mesh(bevelGeo(0.078 * s, 0.008 * s, 0.013 * s), filmM); lip.position.y = 0.035 * s; G.add(lip);
        var lab = new THREE.Mesh(new THREE.PlaneGeometry(0.056 * s, 0.019 * s), prodMat('lab' + st.id, function () { return new THREE.MeshBasicMaterial({ map: signTex([st.name], 260, 88, { size: 34, bg: '#f4efdf', color: '#2a2a2a', titleColor: '#2a2a2a', line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        lab.position.set(0, 0.0125 * s, 0.0091 * s); G.add(lab);
        return G;
      }
    /* 31-models-machines.js */
    function productCigPack(K, s) {   // a hinge-lid pack: foil collar, lid seam, printed face and a health band
        if (K.shape === 'cigar') return productCigar(K, s); if (K.shape === 'jar') return productHoneyJar(K, s);
        var G = new THREE.Group(), big = K.size === 20;
        var w = (big ? 0.056 : 0.046) * s, ht = (big ? 0.088 : 0.074) * s, d = (big ? 0.023 : 0.019) * s;
        var bodyM = prodMat('cig' + K.name, function () { return new THREE.MeshStandardMaterial({ color: K.col, roughness: 0.55 }); });
        var lidM = prodMat('cigl' + K.name, function () { return new THREE.MeshStandardMaterial({ color: mixHex(K.col, 0x000000, 0.25), roughness: 0.55 }); });
        var foilM = prodMat('foil', function () { return new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.8 }); });
        G.add(new THREE.Mesh(bevelGeo(w, ht * 0.72, d), bodyM));
        var lid = new THREE.Mesh(bevelGeo(w * 1.008, ht * 0.28, d * 1.008), lidM); lid.position.y = ht * 0.5; G.add(lid);
        var seam = new THREE.Mesh(bevelGeo(w * 1.012, 0.0015 * s, d * 1.012), foilM); seam.position.y = ht * 0.36; G.add(seam);
        var face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, ht * 0.5), prodMat('cigf' + K.name, function () { return new THREE.MeshBasicMaterial({ map: signTex(['RF', K.type === 'light' ? 'LIGHT' : 'SMOKING', K.size + 's'], 200, 260, { size: 44, bg: '#' + ('000000' + K.col.toString(16)).slice(-6), color: '#' + ('000000' + K.top.toString(16)).slice(-6), titleColor: '#' + ('000000' + K.top.toString(16)).slice(-6), line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        face.position.set(0, -ht * 0.03, d / 2 + 0.0004 * s); G.add(face);
        var band = new THREE.Mesh(bevelGeo(w * 0.94, ht * 0.16, 0.0008 * s), prodMat('cigb', function () { return new THREE.MeshStandardMaterial({ color: 0x14181b, roughness: 0.9 }); }));
        band.position.set(0, -ht * 0.27, d / 2 + 0.0006 * s); G.add(band);
        return G;
      }
    /* 31-models-machines.js */
    function productSoilSack(s) {   /* heat-sealed compost sack with a printed front */
        var G = new THREE.Group();
        var sackM = prodMat('sack', function () { return new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }); });
        var foldM = prodMat('sackfold', function () { return new THREE.MeshStandardMaterial({ color: 0x3a291b, roughness: 1 }); });
        G.add(new THREE.Mesh(bevelGeo(0.15 * s, 0.17 * s, 0.095 * s), sackM));
        [1, -1].forEach(function (e) { var fo = new THREE.Mesh(bevelGeo(0.155 * s, 0.022 * s, 0.03 * s), foldM); fo.position.y = e * 0.093 * s; G.add(fo); });
        var fc = new THREE.Mesh(new THREE.PlaneGeometry(0.125 * s, 0.105 * s), prodMat('sacklab', function () { return new THREE.MeshBasicMaterial({ map: signTex(['GROW CO.', 'potting soil', '20 L'], 250, 210, { size: 40, bg: '#6d4f30', color: '#e9dcc2', titleColor: '#9ff0b5', line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        fc.position.set(0, 0.006 * s, 0.0481 * s); G.add(fc); return G;
      }
    /* 31-models-machines.js */
    function productNutrientBottle(s) {   /* shoulder, neck, ribbed cap, wrapped label */
        var G = new THREE.Group();
        var botM = prodMat('nutbot', function () { return new THREE.MeshStandardMaterial({ color: 0xcdea55, roughness: 0.35, transparent: true, opacity: 0.94 }); });
        var capM = prodMat('nutcap', function () { return new THREE.MeshStandardMaterial({ color: 0x2a2f26, roughness: 0.6 }); });
        var b1 = new THREE.Mesh(roundCylGeo(0.029 * s, 0.031 * s, 0.105 * s, 14), botM); b1.position.y = -0.005 * s; G.add(b1);
        var sh = new THREE.Mesh(roundCylGeo(0.014 * s, 0.029 * s, 0.026 * s, 14), botM); sh.position.y = 0.061 * s; G.add(sh);
        var nk = new THREE.Mesh(roundCylGeo(0.013 * s, 0.013 * s, 0.016 * s, 12), capM); nk.position.y = 0.082 * s; G.add(nk);
        var cp = new THREE.Mesh(roundCylGeo(0.0155 * s, 0.0155 * s, 0.011 * s, 16), capM); cp.position.y = 0.094 * s; G.add(cp);
        var lb = new THREE.Mesh(new THREE.CylinderGeometry(0.0305 * s, 0.0305 * s, 0.05 * s, 16, 1, true), prodMat('nutlab', function () { return new THREE.MeshBasicMaterial({ map: signTex(['BLOOM', 'nutrients'], 300, 120, { size: 44, bg: '#1f3a14', color: '#cdea55', titleColor: '#ffffff', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide }); }));
        lb.position.y = -0.006 * s; G.add(lb); return G;
      }
    /* 31-models-machines.js */
    function productSprayBottle(s) {   /* trigger sprayer with the fluid line showing through the tank */
        var G = new THREE.Group();
        var tankM = prodMat('spraytank', function () { return new THREE.MeshStandardMaterial({ color: 0xe8f2ee, roughness: 0.18, transparent: true, opacity: 0.55 }); });
        var fluidM = prodMat('sprayfluid', function () { return new THREE.MeshStandardMaterial({ color: 0x8fd6b0, roughness: 0.3, transparent: true, opacity: 0.85 }); });
        var headM = prodMat('sprayhead', function () { return new THREE.MeshStandardMaterial({ color: 0x2f3a36, roughness: 0.7 }); });
        var t1 = new THREE.Mesh(roundCylGeo(0.029 * s, 0.032 * s, 0.115 * s, 14), tankM); t1.position.y = -0.012 * s; G.add(t1);
        var fl = new THREE.Mesh(roundCylGeo(0.026 * s, 0.029 * s, 0.055 * s, 12), fluidM); fl.position.y = -0.04 * s; G.add(fl);
        var nk2 = new THREE.Mesh(roundCylGeo(0.016 * s, 0.016 * s, 0.02 * s, 12), headM); nk2.position.y = 0.055 * s; G.add(nk2);
        var hd = new THREE.Mesh(bevelGeo(0.03 * s, 0.036 * s, 0.048 * s), headM); hd.position.set(0, 0.082 * s, -0.012 * s); G.add(hd);
        var nz = new THREE.Mesh(bevelGeo(0.012 * s, 0.01 * s, 0.03 * s), headM); nz.position.set(0, 0.095 * s, -0.04 * s); G.add(nz);
        var tg = new THREE.Mesh(bevelGeo(0.016 * s, 0.026 * s, 0.008 * s), prodMat('spraytrig', function () { return new THREE.MeshStandardMaterial({ color: 0x59d08a, roughness: 0.6 }); })); tg.position.set(0, 0.068 * s, 0.016 * s); G.add(tg);
        var lb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0325 * s, 0.0325 * s, 0.05 * s, 16, 1, true), prodMat('spraylab', function () { return new THREE.MeshBasicMaterial({ map: signTex(['PEST OFF', 'ready to use'], 300, 120, { size: 40, bg: '#123a2a', color: '#bfeed6', titleColor: '#ffffff', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide }); }));
        lb2.position.y = 0.006 * s; G.add(lb2); return G;
      }
    /* 31-models-machines.js */
    function productSeedPacket(st, s) {   /* foil sachet, heat-sealed top, tear notch, printed front */
        var G = new THREE.Group();
        var foilM = prodMat('seedfoil', function () { return new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.3, metalness: 0.55 }); });
        var sealM = prodMat('seedseal', function () { return new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.4 }); });
        G.add(new THREE.Mesh(bevelGeo(0.072 * s, 0.098 * s, 0.009 * s), foilM));
        var sl = new THREE.Mesh(bevelGeo(0.074 * s, 0.014 * s, 0.004 * s), sealM); sl.position.y = 0.054 * s; G.add(sl);
        var nt = new THREE.Mesh(bevelGeo(0.006 * s, 0.008 * s, 0.005 * s), sealM); nt.position.set(0.033 * s, 0.05 * s, 0); G.add(nt);
        var fa = new THREE.Mesh(new THREE.PlaneGeometry(0.064 * s, 0.086 * s), prodMat('seedlab' + st.id, function () { return new THREE.MeshBasicMaterial({ map: signTex([st.emoji, st.name, 'feminised'], 210, 285, { size: 30, bg: '#f4efdf', color: '#3a4a36', titleColor: '#1a6a2a', line: 'rgba(0,0,0,.18)' }), transparent: true }); }));
        fa.position.z = 0.0047 * s; G.add(fa); return G;
      }
    /* 31-models-machines.js */
    function cartonBox(w, h2, d, lines, hex, ink) {   /* a plain box with its front printed, for the small consumables */
        var G = new THREE.Group();
        G.add(new THREE.Mesh(bevelGeo(w, h2, d), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 })));
        var key = 'carton' + lines.join('|');
        var face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, h2 * 0.74), prodMat(key, function () { return new THREE.MeshBasicMaterial({ map: signTex(lines, 260, 150, { size: 46, bg: 'rgba(0,0,0,0)', color: ink, titleColor: ink, line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        face.position.z = d / 2 + 0.001; G.add(face); return G;
      }
    /* 31-models-machines.js */
    function machState(id) {
        var X = xs(); if (!X.mach || typeof X.mach !== 'object') X.mach = {};
        if (!X.mach.perUnit) {   /* saves from before there could be two machines kept every machine's state in one object; split it out by prop */
          var o = X.mach; X.mach = { perUnit: true };
          X.mach.vending = { vendDoor: !!o.vendDoor, tray: Array.isArray(o.tray) ? o.tray : [] };
          X.mach.lobbyCoffee = { coffDoor: !!o.coffDoor, cup: o.cup || 0 };
          X.mach.fridge = { fridgeDoor: !!o.fridgeDoor, fridge: typeof o.fridge === 'number' ? o.fridge : 6 };   /* the fridge you start with comes stocked; any you buy later start empty */
        }
        if (!X.mach.own) {   /* saves from before 1.25 kept one coin box and one stock for every machine of a kind: both go to the first machine of the kind */
          X.mach.own = true; var ob = S.box || {}, first = function (b) { return X.mach[b] || (X.mach[b] = {}); };
          [['vending', ob.vend], ['lobbyCoffee', ob.coffee], ['arcade', ob.arcade]].forEach(function (p) { if (p[1] > 0) { var u = first(p[0]); u.box = (u.box || 0) + p[1]; } });
          first('vending').stock = Object.assign({}, S.vendStock || { drink: 12, snack: 12 });   /* a new shop's first machine comes stocked, as it always has */
          first('lobbyCoffee').stock = Object.assign({}, S.coffeeStock || { cup: 40, beans: 40 });
          delete S.box; delete S.vendStock; delete S.coffeeStock;
        }
        var m = X.mach[id || 'vending'] || (X.mach[id || 'vending'] = {});
        if (!Array.isArray(m.tray)) m.tray = [];
        if (typeof m.cup !== 'number') m.cup = 0;
        if (typeof m.fridge !== 'number') m.fridge = 0;
        if (!m.stock || typeof m.stock !== 'object') m.stock = {};
        return m;
      }
    /* 31-models-machines.js */
    function machStock(id) { return machState(id).stock; }
    /* 31-models-machines.js */
    function stockTotal(base, k) { return unitIds(base).reduce(function (a, u) { return a + (machStock(u)[k] || 0); }, 0); }
    /* 31-models-machines.js */
    function coinBox(id) { return machState(id).box || 0; }
    /* 31-models-machines.js */
    function coinTotal(base) { var t = 0; (base ? [base] : ['vending', 'lobbyCoffee', 'fridge', 'arcade']).forEach(function (b) { unitIds(b).forEach(function (u) { t += coinBox(u); }); }); return t; }
    /* 31-models-machines.js */
    function fridgeParts(id) {
        var inst = propInst[id || 'fridge']; if (!inst) return null; var p = inst.g.userData.frParts;
        if (!p || !p.door || !p.door.parent) { p = {}; inst.g.traverse(function (o) { if (o.userData.fridgeDoor) p.door = o; if (o.userData.fridgeShelves) p.shelves = o; }); inst.g.userData.frParts = p; }
        return p.door ? p : null;
      }
    /* 31-models-machines.js */
    function coffParts(id) {
        var inst = propInst[id || 'lobbyCoffee']; if (!inst) return null; var p = inst.g.userData.cfParts;
        if (!p || !p.cups || !p.cups.parent) { p = {}; inst.g.traverse(function (o) { if (o.userData.coffCups) p.cups = o; if (o.userData.coffBrew) p.brew = o; if (o.userData.coffLid) p.lid = o; if (o.userData.coffBeans) p.beans = o; if (o.userData.coffCupHit) p.cupHit = o; }); inst.g.userData.cfParts = p; }
        return p.cups ? p : null;
      }
    /* 31-models-machines.js */
    function cupMesh(s2, full) {   // a paper cup, with a lid and a sleeve once it is poured
        var G = new THREE.Group();
        var paper = prodMat('cuppaper', function () { return new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.85 }); });
        G.add(new THREE.Mesh(roundCylGeo(0.035 * s2, 0.027 * s2, 0.095 * s2, 14), paper));
        if (full) {
          var lidM = prodMat('cuplid', function () { return new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6 }); });
          var l = new THREE.Mesh(roundCylGeo(0.037 * s2, 0.037 * s2, 0.012 * s2, 14), lidM); l.position.y = 0.052 * s2; G.add(l);
          var sip = new THREE.Mesh(roundCylGeo(0.008 * s2, 0.008 * s2, 0.012 * s2, 8), lidM); sip.position.set(0.022 * s2, 0.06 * s2, 0); G.add(sip);
          var slv = new THREE.Mesh(new THREE.CylinderGeometry(0.0365 * s2, 0.031 * s2, 0.04 * s2, 14, 1, true), prodMat('cupslv', function () { return new THREE.MeshBasicMaterial({ map: signTex(['GROW CO.'], 300, 110, { size: 44, bg: '#6d4f30', color: '#f4e8d2', titleColor: '#f4e8d2', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide }); }));
          slv.position.y = -0.006 * s2; G.add(slv);
        }
        return G;
      }
    /* 31-models-machines.js */
    function syncFridge(id) {
        if (!id) { unitIds('fridge').forEach(function (u) { syncFridge(u); }); return; }
        var p = fridgeParts(id); if (!p || !p.shelves) return;
        (p.shelves.userData.slots || []).forEach(function (m) { p.shelves.remove(m); });
        p.shelves.userData.slots = [];
        var n = Math.min(machState(id).fridge || 0, 16);
        for (var i = 0; i < n; i++) {
          var col = i % 4, row = Math.floor(i / 4);
          var d = drinkMesh(1); d.position.set(-0.24 + col * 0.16, 0.445 + row * 0.36, -0.02 + (i % 2) * 0.12);
          p.shelves.add(d); p.shelves.userData.slots.push(d);
        }
        p.shelves.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
      }
    /* 31-models-machines.js */
    function syncCoffee(id) {
        if (!id) { unitIds('lobbyCoffee').forEach(function (u) { syncCoffee(u); }); return; }
        var p = coffParts(id); if (!p) return;
        (p.cups.userData.slots || []).forEach(function (m) { p.cups.remove(m); });
        p.cups.userData.slots = [];
        var st = machStock(id), stack = Math.min(Math.ceil((st.cup || 0) / 6), 7);
        for (var i = 0; i < stack; i++) { var cu = cupMesh(1, false); cu.position.y = i * 0.022; p.cups.add(cu); p.cups.userData.slots.push(cu); }
        if (p.beans) { var lvl = clamp((st.beans || 0) / 40, 0.05, 1); p.beans.scale.y = lvl; p.beans.position.y = 1.40 + 0.06 * lvl; p.beans.visible = (st.beans || 0) > 0; }
        dropKids(p.brew);
        if (machState(id).cup > 0) { var c2 = cupMesh(1, true); p.brew.add(c2); }
        if (p.cupHit) p.cupHit.position.y = machState(id).cup > 0 ? 1.02 : -50;
        p.cups.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
        p.brew.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
      }
    /* 31-models-machines.js */
    function vendParts(id) {
        var inst = propInst[id || 'vending']; if (!inst) return null;
        var p = inst.g.userData.vendParts;
        if (!p || !p.door || !p.door.parent) {
          p = {}; inst.g.traverse(function (o) {
            if (o.userData.vendDoor) p.door = o; if (o.userData.vendRacks) p.racks = o;
            if (o.userData.vendTray) p.tray = o; if (o.userData.vendFlap) p.flap = o; if (o.userData.vendDisp) p.disp = o;
          });
          inst.g.userData.vendParts = p;
        }
        return p.door ? p : null;
      }
    /* 31-models-machines.js */
    function drinkMesh(s2) {   // a can: tapered body, a printed wrap, a chamfered top and a ring pull
        var G = new THREE.Group();
        var canM = prodMat('canbody', function () { return new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.3, metalness: 0.75 }); });
        var b = new THREE.Mesh(roundCylGeo(0.031 * s2, 0.031 * s2, 0.1 * s2, 14), canM); G.add(b);
        var top = new THREE.Mesh(roundCylGeo(0.026 * s2, 0.031 * s2, 0.012 * s2, 14), canM); top.position.y = 0.056 * s2; G.add(top);
        var bot = new THREE.Mesh(roundCylGeo(0.031 * s2, 0.026 * s2, 0.012 * s2, 14), canM); bot.position.y = -0.056 * s2; G.add(bot);
        var wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.0315 * s2, 0.0315 * s2, 0.072 * s2, 16, 1, true), prodMat('canwrap', function () { return new THREE.MeshBasicMaterial({ map: signTex(['GROW', 'COLA'], 300, 170, { size: 60, bg: '#1d6fd6', color: '#ffffff', titleColor: '#ffd166', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide }); }));
        G.add(wrap);
        var tab = new THREE.Mesh(new THREE.TorusGeometry(0.008 * s2, 0.0018 * s2, 4, 8), canM); tab.position.y = 0.063 * s2; tab.rotation.x = Math.PI / 2; G.add(tab);
        return G;
      }
    /* 31-models-machines.js */
    function snackMesh(s2) {   // a flow-wrapped bar, crimped at both ends
        var G = new THREE.Group();
        var wrapM = prodMat('snackwrap', function () { return new THREE.MeshStandardMaterial({ color: 0x6b2f8a, roughness: 0.45, metalness: 0.25 }); });
        G.add(new THREE.Mesh(bevelGeo(0.105 * s2, 0.018 * s2, 0.05 * s2), wrapM));
        [-1, 1].forEach(function (e) { var cr = new THREE.Mesh(bevelGeo(0.018 * s2, 0.011 * s2, 0.052 * s2), wrapM); cr.position.x = e * 0.06 * s2; G.add(cr); });
        var fa = new THREE.Mesh(new THREE.PlaneGeometry(0.086 * s2, 0.04 * s2), prodMat('snackface', function () { return new THREE.MeshBasicMaterial({ map: signTex(['GROW BAR'], 280, 120, { size: 52, bg: '#6b2f8a', color: '#ffd166', titleColor: '#ffd166', line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        fa.position.z = 0.0255 * s2; G.add(fa);
        return G;
      }
    /* 31-models-machines.js */
    function syncVending(id) {   // the coils hold exactly what the machine is stocked with
        if (!id) { unitIds('vending').forEach(function (u) { syncVending(u); }); return; }
        var p = vendParts(id); if (!p || !p.racks) return;
        var racks = p.racks;
        (racks.userData.slots || []).forEach(function (m) { racks.remove(m); });
        racks.userData.slots = [];
        var st = machStock(id), drinks = Math.min(st.drink || 0, 8), snacks = Math.min(st.snack || 0, 8);
        for (var i = 0; i < drinks; i++) {
          var col = i % 4, row = Math.floor(i / 4);
          var d = drinkMesh(1); d.position.set(-0.225 + col * 0.15, 0.585 - row * 0.29, 0.02); racks.add(d); racks.userData.slots.push(d);
        }
        for (var j = 0; j < snacks; j++) {
          var c2 = j % 4, r2 = Math.floor(j / 4);
          var sn = snackMesh(1); sn.position.set(-0.225 + c2 * 0.15, -0.02 - r2 * 0.29, 0.02); sn.rotation.z = Math.PI / 2; racks.add(sn); racks.userData.slots.push(sn);
        }
        racks.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
        syncTray(id);
      }
    /* 31-models-machines.js */
    function syncTray(id) {   // whatever has dropped sits in the delivery tray until you take it
        id = id || 'vending';
        var p = vendParts(id); if (!p || !p.tray) return;
        dropKids(p.tray);
        var M = machState(id);
        M.tray.slice(0, 4).forEach(function (it, i) {
          var m = it === 'drink' ? drinkMesh(1) : snackMesh(1);
          m.position.set(-0.16 + i * 0.11, 0.035, 0);
          if (it === 'drink') m.rotation.z = Math.PI / 2; else m.rotation.y = 0.3;
          p.tray.add(m);
        });
        p.tray.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
        if (!p.trayHit) { var inst2 = propInst[id]; if (inst2) inst2.g.traverse(function (o) { if (o.userData.interact && o.userData.interact.kind === 'vendTray') p.trayHit = o; }); }
        if (p.trayHit) p.trayHit.position.y = M.tray.length ? 0.42 : -50;   /* an empty tray must not swallow the machine's prompt */
      }
    /* 31-models-machines.js */
    function take(item) { var i = freeSlot(); if (i < 0) { toast('Your hands are full. G puts something down, 1 to 6 picks a slot.', 'bad'); return false; } S.hotbar[i] = item; S.slot = i; sfx(item.kind === 'crate' ? 'crate' : 'pickup'); return true; }
    /* 31-models-machines.js */
    function starterCost() { var d = supplyDisc(); return Math.round(supplyById('soil').price * d) + Math.round(strainById('sunflower').seed * d) + Math.round(supplyById('nutrients').price * d); }
    /* 32-interaction.js */
    function dryMs() { return DRY_MS_BASE; }
    /* 32-interaction.js */
    function gameHour() { if (SET.dayNight === 'day') return 13; if (SET.dayNight === 'evening') return 19.2; if (SET.dayNight === 'night') return 1; if (SET.dayNight === 'cycle') return S.clock || 0; var d = new Date(); return d.getHours() + d.getMinutes() / 60; }
    /* 32-interaction.js */
    function clockText() { var h = gameHour(); var hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }
    /* 32-interaction.js */
    function dryFactor() { return clamp(1 + (55 - S.rh.dry) / 40, 0.5, 1.4); }
    /* 32-interaction.js */
    function moldMult() { var r = S.rh.grow; return r > 60 ? 1 + (r - 60) / 12 : r < 45 ? 0.6 : 1; }
    /* 32-interaction.js */
    function cureSlots() { return Math.max(2, S.supplies.jar || 0); }
    /* 34-processing-panes.js */
    function paneShop() {
        var h = '<div class="g3-grid"><div class="g3-box"><h3>🛒 Supplies</h3><div class="desc">Paid from the bank (' + money(S.bank) + '). Orders are boxed up and the supplier\'s van drops them in the back room a couple of minutes later. Carry crates from there to the supply rack or the machines.</div>' + (S.order ? '<div class="g3-chips"><span class="g3-chip amber">open order: ' + esc(orderSummary(S.order.items)) + '</span></div>' : '') + (S.deliveries.length ? '<div class="g3-chips">' + S.deliveries.map(function (d) { return '<span class="g3-chip">🚚 ' + esc(orderSummary(d.items)) + ' · ~' + Math.max(0, Math.ceil((d.due - now()) / 1000)) + ' s</span>'; }).join('') + '</div>' : '');
        SUPPLIES.forEach(function (it) { var own = it.tool ? (S.supplies[it.id] ? 'owned' : 'not yet') : (S.supplies[it.id] || 0); h += '<div class="g3-row"><span class="ico">' + it.ico + '</span><span class="meta"><span class="n">' + it.name + '</span><span class="own">' + (it.stock === 'vend' ? 'machines: ' + stockTotal('vending', it.id) : it.stock === 'coffee' ? 'machines: ' + stockTotal('lobbyCoffee', it.id) : 'rack: ' + own) + ((S.storage[it.id] || 0) ? ' · back room: ' + S.storage[it.id] : '') + ' · ' + it.hint + '</span></span><span class="price">' + money(Math.round(it.price * supplyDisc())) + '</span><button class="g3-btn" data-act="buy" data-id="' + it.id + '"' + (it.tool && S.supplies[it.id] ? ' disabled' : '') + '>Buy</button></div>'; });
        h += '</div><div class="g3-box"><h3>🌿 Grow room</h3><div class="desc">What you have on hand right now.</div><div class="g3-chips">' +
          chip('cash', money(S.bank)) + chip('soil', S.supplies.soil || 0) + chip('pots free', (S.supplies.pot || 0) - S.plants.length) + chip('nutrients', S.supplies.nutrients || 0) + chip('spray', S.supplies.remedy || 0) + chip('baggies', S.supplies.bag || 0) + chip('papers', S.supplies.paper || 0) + chip('tips', S.supplies.tip || 0) + chip('jars', S.supplies.jar || 0) + '</div>' +
          '<div class="desc">Seeds in stock:</div><div class="g3-chips">' + STRAINS.map(function (s) { return chip(s.emoji + ' ' + s.name, S.supplies['seed_' + s.id] || 0); }).join('') + '</div>' +
          '<div class="desc" style="margin-top:10px">Starter kit: soil + a pot per plant, a seed, then water till harvest. Cure it, grind it, bag or roll it, sell it at the window.</div>' +
          '<button class="g3-btn primary wide" data-act="starter">🧰 Buy starter bundle · ' + money(starterCost()) + ' <small>(soil + Sunflower Kush seed + nutrients)</small></button>' +
          '</div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function chip(k, v) { return '<span class="g3-chip">' + k + ' <b>' + v + '</b></span>'; }
    /* 34-processing-panes.js */
    function paneSeeds() {
        var h = '<div class="g3-box"><h3>🌱 Seed bank</h3><div class="desc">Higher strains unlock as you level up. Grow time is at windowsill speed; lamps make it faster.</div><div class="g3-strains">';
        STRAINS.forEach(function (s) { var locked = S.level < s.lvl; h += '<div class="g3-strain ' + (locked ? 'locked' : '') + '"><div class="top"><span class="emoji">' + s.emoji + '</span><span class="nm">' + s.name + '</span></div><div class="traits"><span>⏱ <b>' + daysText(s.growMs) + '</b></span><span>🌾 <b>' + s.yield + 'g</b></span><span>💪 <b>' + s.thc.toFixed(1) + '×</b></span></div><div class="traits"><span><i class="sw" style="background:#' + s.bud.toString(16).padStart(6, '0') + '"></i>bud</span><span>seeds: <b>' + (S.supplies['seed_' + s.id] || 0) + '</b></span></div>' + (locked ? '<div class="g3-tier">🔒 level ' + s.lvl + '</div>' : '<button class="g3-btn primary wide" data-act="buySeed" data-id="' + s.id + '">Buy seed · ' + money(Math.round(s.seed * supplyDisc())) + '</button>') + '</div>'; });
        return h + '</div></div>';
      }
    /* 34-processing-panes.js */
    function paneLicences() {
        var h = '<div class="g3-grid"><div class="g3-box"><h3>🪪 Licences & permits</h3><div class="desc">Paid from the bank (' + money(S.bank) + '). Some need a level or some rep first. Level ' + S.level + ' · rep ' + Math.floor(S.rep) + '.</div>';
        LICENCES.forEach(function (L) {
          if (L.dlc && !dlcOn(L.dlc)) return;   /* a DLC that is switched off: its licence isn't for sale */
          var own = hasLic(L.id); var why = !own && (L.req && !hasLic(L.req) ? 'needs ' + licById(L.req).name : L.lvl && S.level < L.lvl ? 'level ' + L.lvl : L.rep && S.rep < L.rep ? 'rep ' + L.rep : '');
          h += '<div class="g3-row"><span class="ico">' + L.ico + '</span><span class="meta"><span class="n">' + L.name + '</span><span class="own">' + (L.id === 'cult2' && !dlcOn('greenhouse') ? L.d.replace(' and the roof greenhouse beds', '') : L.d) + '</span></span>' + (own ? '<span class="g3-tier">✓ held</span>' : why ? '<span class="g3-tier">🔒 ' + why + '</span>' : '<button class="g3-btn primary" data-act="buyLic" data-id="' + L.id + '">' + money(L.price) + '</button>') + '</div>';
        });
        h += '</div><div class="g3-box"><h3>📋 What you can do</h3><div class="g3-chips">' + chip('card payments', hasLic('retail') ? 'yes' : 'cash only') + chip('connoisseurs', hasLic('premium') ? 'visit' : 'no') + chip('lounge', hasLic('lounge') ? 'open' : 'closed') + chip('machines', hasLic('catering') ? 'selling' : 'off') + chip('arcade', hasLic('amusement') ? 'on' : 'off') + chip('tent limit', TENTS.filter(function (t) { return !t.lic || hasLic(t.lic); }).reduce(function (m, t) { return Math.max(m, t.slots); }, 0) + ' slots') + chip('supply discount', Math.round((1 - supplyDisc()) * 100) + '%') + chip('export', hasLic('export') ? 'contracts open' : 'no') + '</div><div class="desc" style="margin-top:8px">Shops that were already trading when licensing arrived kept the retail, catering, amusement and lounge permits.</div></div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function paneUpgrades() {
        var L = lightObj(); var li = lightIdx(); var nextL = LIGHTS[li + 1]; var nextT = TENTS[S.tent + 1];
        var h = '<div class="g3-grid"><div class="g3-box"><h3>⚙️ Gear upgrades</h3><div class="desc">Every upgrade shows up in the room.</div>';
        h += '<div class="g3-row"><span class="ico">💡</span><span class="meta"><span class="n">Lighting</span><span class="own">Faster growth + higher quality. now: ' + L.name + '</span></span>' + (nextL ? '<button class="g3-btn primary" data-act="buyLight">' + nextL.name + ' · ' + money(nextL.price) + '</button>' : '<span class="g3-tier">maxed</span>') + '</div>';
        h += '<div class="g3-row"><span class="ico">⛺</span><span class="meta"><span class="n">Grow tent</span><span class="own">More plant slots. now: ' + slots() + ' slots</span></span>' + (nextT ? (nextT.lic && !hasLic(nextT.lic) ? '<span class="g3-tier">🔒 ' + nextT.slots + ' slots needs ' + licById(nextT.lic).name + '</span>' : '<button class="g3-btn primary" data-act="buyTent">' + nextT.slots + ' slots · ' + money(nextT.price) + '</button>') : '<span class="g3-tier">maxed</span>') + '</div>';
        UPGRADES.forEach(function (u) { var why = !S.upgrades[u.id] && (u.req && !S.upgrades[u.req] ? 'needs ' + (UPGRADES.filter(function (x) { return x.id === u.req; })[0] || { name: u.req }).name : u.lvl && S.level < u.lvl ? 'level ' + u.lvl : ''); h += '<div class="g3-row"><span class="ico">' + u.ico + '</span><span class="meta"><span class="n">' + u.name + '</span><span class="own">' + u.d + '</span></span>' + (S.upgrades[u.id] ? '<span class="g3-tier">✓ installed</span>' : why ? '<span class="g3-tier">🔒 ' + why + '</span>' : '<button class="g3-btn primary" data-act="buyUpg" data-id="' + u.id + '">' + money(u.price) + '</button>') + '</div>'; });
        h += '</div><div class="g3-box"><h3>🥤 Machines</h3><div class="desc">Buy another and it lands beside the one you have. Press <b>F2</b> to drag it anywhere you like. They share the shop\'s stock and float.</div>';
        ['vending', 'lobbyCoffee', 'arcade', 'fridge', 'queueRope'].forEach(function (base) {
          var d = PROPS[base]; if (!d || !d.multi) return;
          var have = unitCount(base), full = have >= d.multi.max, locked = unitLock(base);
          h += '<div class="g3-row"><span class="ico">' + d.multi.ico + '</span><span class="meta"><span class="n">' + (d.multi.name || d.label.replace(/^./, function (m2) { return m2.toUpperCase(); })) + '</span><span class="own">' + have + ' of ' + d.multi.max +
            (locked ? ' · needs the ' + locked : full ? ' · the shop is full' : '') + (base === 'fridge' ? ' · one stood in the lobby sells cold drinks to customers at $2 a can, with the catering permit' : '') + '</span></span>' +
            (full || locked ? '<span class="g3-tier">' + (full ? 'max' : '🔒') + '</span>' : '<button class="g3-btn primary" data-act="buyUnit" data-id="' + base + '">' + money(machCost(base, have + 1)) + '</button>') + '</div>';
        });
        var rDown = unitIds('queueRope').filter(function (u) { return growPropPlacement(u).hidden; }).length; if (rDown) h += '<div class="g3-row"><span class="ico">🪢</span><span class="meta"><span class="n">Rope lines taken down</span><span class="own">' + rDown + ' in the back, free to put up again where they stood</span></span><button class="g3-btn" data-act="ropeUp">Put one back up</button></div>';
        h += '</div><div class="g3-box"><h3>📈 Business</h3><div class="g3-chips">' + chip('market', S.market.toFixed(2) + '×') + chip('rep', Math.floor(S.rep)) + chip('price mult', '×' + repMult().toFixed(2)) + chip('level', S.level) + '</div><div class="desc">Rep adds up to 10% to a price and brings people through the door. Connoisseurs (🎩) pay 2.2× for quality 70+.</div>' + paneStatsInner() + '</div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function moneyRows() {
        return '<div class="g3-chips">' + chip('bank', money(S.bank)) + chip('vault', money(S.vault)) + chip('pocket', money(S.pocket)) + '</div><div class="g3-chips">' + chip('till', money(S.till)) + chip('vending', money(coinTotal('vending'))) + chip('fridges', money(coinTotal('fridge'))) + chip('coffee', money(coinTotal('lobbyCoffee'))) + chip('arcade', money(coinTotal('arcade'))) + chip('tip jar', money(S.tips)) + '</div>';
      }
    /* 34-processing-panes.js */
    function paneLedger() {
        var B = books(), rows = billLines(), L = B.lastBill, daily = dailyFixed();
        function row(ico, n, own) { return '<div class="g3-row"><span class="ico">' + ico + '</span><span class="meta"><span class="n">' + n + '</span><span class="own">' + own + '</span></span></div>'; }
        var h = '<h3>Profit &amp; loss</h3><div class="desc">The bills fall every morning whether or not there is anything ready to sell. Tax is settled on the first of each month.</div>';
        h += rows.map(function (r) { return row('−', r.k + ' ' + money(r.v), esc(r.d)); }).join('');
        h += row('=', money(daily) + ' a day', 'what the business costs to stand still');
        h += row('$', money(B.dayGross) + ' taken today', money(B.monthGross) + ' so far this month');
        h += row('−', money(B.dayOther) + ' spent on the crop today', 'trimming, testing and compliance at $' + COST.processPerGram.toFixed(2) + ' a gram, ' + money(B.monthOther) + ' this month');
        h += row('%', money(taxDue()) + ' tax owed', Math.round(ECON.excise * 100) + '% excise sits inside every sale, plus ' + Math.round(ECON.taxRate * 100) + '% on the month, and ' + Math.round(ECON.taxHighRate * 100) + '% on what the month takes over ' + money(ECON.taxHighFrom) + '. Due on day ' + taxDay() + '.');
        if (B.arrears > 0.5) h += row('!', money(B.arrears) + ' in arrears', 'unpaid bills, paid down by instalment on each morning the bills clear. Rep falls on any morning they cannot be paid');
        if (L && L.short > 0.5) h += '<div class="desc">Day ' + L.day + ': ' + money(L.short) + ' of that morning\'s bill went unpaid.</div>';
        return h;
      }
    /* 34-processing-panes.js */
    function paneBank() {
        var h = '<div class="g3-grid"><div class="g3-box"><h3>🏦 Bank · ' + money(S.bank) + '</h3><div class="desc">Online orders and upgrades are paid from the bank. Card sales land here straight away. Cash has to be collected: book a courier, meet them at the back door with the money in your pocket, and it clears the next morning.</div>' + moneyRows();
        h += '<div class="desc" style="margin-top:10px">Book a cash pickup</div><div class="g3-chips">' + [100, 500, 1000, 2500, 5000, 10000, 25000, 50000].map(function (a) { return '<button class="g3-btn' + (a <= S.vault + S.pocket ? ' primary' : '') + '" data-act="courierCall" data-id="' + a + '"' + (S.courier ? ' disabled' : '') + '>' + money(a) + '</button>'; }).join('') + '<button class="g3-btn" data-act="courierCall" data-id="all"' + (S.courier || S.vault + S.pocket < 50 ? ' disabled' : '') + '>all cash on hand · ' + money(S.vault + S.pocket) + '</button></div>';
        if (S.courier) h += '<div class="desc" style="margin-top:8px">Courier booked for <b>' + money(S.courier.amount) + '</b> · ' + (S.courier.state === 'called' ? 'arriving at the back gate shortly' : 'waiting in the back room now') + '</div>';
        if (hasLic('export')) { h += '<div class="desc" style="margin-top:10px">Bulk contracts (70% of gram value, paid tomorrow)</div>'; var anyX = false; STRAINS.forEach(function (st) { var sg = stashOf(st.id).g; if (sg < 20) return; anyX = true; var q = stashOf(st.id).qSum / sg, thc = stashOf(st.id).thcSum / sg; h += '<div class="g3-row"><span class="ico">' + st.emoji + '</span><span class="meta"><span class="n">' + st.name + ' · ' + gram(sg) + ' in the stash</span><span class="own">' + money(gramValue(q, thc) * 0.7) + ' per gram</span></span></div><div class="g3-chips">' + [20, 50, 100].filter(function (n) { return n <= sg; }).map(function (n) { return '<button class="g3-btn" data-act="exportSell" data-id="' + st.id + ':' + n + '">sell ' + n + ' g · ' + money(gramValue(q, thc) * 0.7 * n) + '</button>'; }).join('') + '</div>'; }); if (!anyX) h += '<div class="g3-empty">no strain has 20 g cured yet</div>'; }
        h += '</div><div class="g3-box">' + paneLedger() + '<h3 style="margin-top:12px">📒 In transit</h3>' + (S.pending.length ? S.pending.map(function (p) { return '<div class="g3-row"><span class="ico">🚚</span><span class="meta"><span class="n">' + money(p.amount) + '</span><span class="own">clears ' + (SET.dayNight === 'cycle' ? 'on day ' + p.dueDay : 'tomorrow') + '</span></span></div>'; }).join('') : '<div class="g3-empty">nothing in transit</div>');
        h += '<h3 style="margin-top:12px">🚚 Deliveries</h3>' + (S.order ? '<div class="g3-row"><span class="ico">🛒</span><span class="meta"><span class="n">Open order</span><span class="own">' + esc(orderSummary(S.order.items)) + ' · dispatches in a moment</span></span></div>' : '') + (S.deliveries.length ? S.deliveries.map(function (d) { return '<div class="g3-row"><span class="ico">🚚</span><span class="meta"><span class="n">' + esc(orderSummary(d.items)) + '</span><span class="own">van arrives in ~' + Math.max(0, Math.ceil((d.due - now()) / 1000)) + ' s at the back door</span></span></div>'; }).join('') : (S.order ? '' : '<div class="g3-empty">no deliveries on the road</div>')) + '</div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function paneStaff() {
        var st = S.staff, list = crewList();
        var h = '<div class="g3-grid"><div class="g3-box"><h3>🧑‍🔧 Shop floor · ' + list.length + ' of ' + CREW_MAX + '</h3>';
        h += '<div class="desc">Your crew serve the window, restock the supply rack and the machines, sweep and tend the plants. Each one takes ' + money(WORKER_WAGE) + ' a day at the morning bill (the bank first, then the vault, then the till), and walks if it isn\'t there. Give orders with <b>Shift+E</b> on them, or from here.</div>';
        if (!list.length) h += '<div class="g3-empty">Nobody on the floor but you.</div>';
        list.forEach(function (c, i) {
          h += '<div class="g3-row"><span class="ico">' + (c.off ? '🏠' : '🧑‍🔧') + '</span><span class="meta"><span class="n">' + crewName(i) + '</span><span class="own">' + (c.off ? 'at home · no wage while they are off' : workerTaskLabel(i) + (c.post ? ' · posted at ' + c.post.x.toFixed(0) + ', ' + c.post.z.toFixed(0) : '') + ' · ' + money(WORKER_WAGE) + ' a day') + '</span></span><button class="g3-btn' + (c.off ? ' primary' : '') + '" data-act="crewShift" data-id="' + i + '">' + (c.off ? '📞 Call in' : '🏠 Send home') + '</button><button class="g3-btn" data-act="fire" data-id="' + i + '">Let go</button></div>';
          if (!c.off) h += '<div class="g3-chips">' + WORKER_TASKS.map(function (t) { return '<button class="g3-btn' + (c.task === t[0] ? ' primary' : '') + '" data-act="workerTask" data-id="' + i + '|' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
        });
        if (list.length < CREW_MAX) h += '<button class="g3-btn primary wide" data-act="hire">🤝 Hire ' + CREW_LOOK[Math.min(list.length, CREW_LOOK.length - 1)].name + ' · ' + money(crewHireCost()) + ' now + ' + money(WORKER_WAGE) + ' a day</button>';
        else h += '<div class="desc">That\'s as many as the shop floor will take.</div>';
        h += '</div><div class="g3-box"><h3>🛡️ The guard · ' + (guardOff() ? 'off shift' : 'on the door') + '</h3>' +
          '<button class="g3-btn wide' + (guardOff() ? ' primary' : '') + '" data-act="guardShift">' + (guardOff() ? '📞 Call the guard in' : '🏠 Send the guard home') + '</button>' +
          '<div class="desc">The guard checks IDs at the door by default. Send him on a patrol to keep robbers away and break up fights faster, or give him a chore. He always comes back to the door when someone walks in. <b>Shift+E</b> on him works too. He draws ' + money(COST.guardWage) + ' a day on the morning bill while he\'s on shift. He and the crew carry a key to every door you leave marked staff key on the control box, and lock it again behind them.</div><div class="g3-chips">' + GUARD_TASKS.map(function (t) { return '<button class="g3-btn' + (st.guardTask === t[0] ? ' primary' : '') + '" data-act="guardTask" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function paneLog() { return '<div class="g3-box"><h3>📜 Grow diary</h3>' + paneLogInner(60) + '</div>'; }
    /* 34-processing-panes.js */
    function paneLogInner(n) { if (!S.log.length) return '<div class="g3-empty">Your grow diary will fill up here.</div>'; return '<div class="g3-log">' + S.log.slice(0, n).map(function (e) { return '<div class="' + e.kind + '"><span class="t">' + e.t + '</span>' + e.msg + '</div>'; }).join('') + '</div>'; }
    /* 34-processing-panes.js */
    function paneStats() { return '<div class="g3-box"><h3>📊 Lifetime stats</h3>' + paneStatsInner() + '</div>'; }
    /* 34-processing-panes.js */
    function paneStatsInner() { var days = Math.max(1, Math.floor((now() - (S.created || now())) / 86400000) + 1); return '<div class="g3-chips">' + chip('planted', S.stats.plants) + chip('harvested', gram(S.stats.harvested)) + chip('units sold', S.stats.sold) + chip('earned', money(S.stats.earned)) + chip('day', days) + chip('level', S.level) + chip('rep', Math.floor(S.rep)) + '</div>'; }
    /* 34-processing-panes.js */
    function growSettingsHtml() {
        return '<h4>Settings</h4><div id="g3-settings">' +
          slider('Field of view', 'fov', 60, 110, 1, SET.fov, '°') +
          slider('Mouse sensitivity', 'sens', 0.3, 2.5, 0.1, SET.sens, '×') +
          check('Invert mouse Y', 'invertY', SET.invertY) +
          check('Head bob', 'headBob', SET.headBob) +
          check('Sound effects', 'sound', SET.sound) +
          check('Show FPS', 'fps', SET.fps) +
          select('Graphics quality', 'quality', [['high', 'High (shadows, full res)'], ['medium', 'Medium (soft shadows off)'], ['low', 'Low (no shadows, half res)']], SET.quality) +
          select('Time of day', 'dayNight', [['cycle', 'Day/night cycle'], ['clock', 'Follow the real clock'], ['day', 'Always day'], ['evening', 'Golden hour'], ['night', 'Always night']], SET.dayNight) +
          select('Day length', 'dayLength', [['10', '10 real minutes'], ['20', '20 real minutes'], ['40', '40 real minutes'], ['60', '1 real hour']], SET.dayLength) +
          '</div><p style="margin-top:8px">Settings apply live and are remembered.</p>';
      }
    /* 34-processing-panes.js */
    function slider(label, key, min, max, step, val, unit) { return '<div class="g3-slider"><label>' + label + '</label><input type="range" data-set="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"><small>' + val + unit + '</small></div>'; }
    /* 34-processing-panes.js */
    function check(label, key, val) { return '<div class="g3-slider"><label>' + label + '</label><input type="checkbox" data-set="' + key + '"' + (val ? ' checked' : '') + '></div>'; }
    /* 34-processing-panes.js */
    function select(label, key, opts, val) { return '<div class="g3-slider"><label>' + label + '</label><select data-set="' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>'; }
    /* 34-processing-panes.js */
    function guideHtml() {
        if (window.RF_GUIDE) return window.RF_GUIDE.map(function (c) { return '<h4>' + c.icon + ' ' + c.title + '</h4>' + c.html; }).join('');   /* standalone: the full guide, same text as the main menu */
        return '<h4>Your hands do the work</h4><p>Everything is carried. <b>E</b> picks a thing up, or uses what you\'re holding on what you look at. <b>G</b> puts it back. One thing at a time.</p>' +
          '<h4>The loop</h4><p>The <b>office PC</b> in the office: order soil and baggies under Supplies, a seed in the Seed bank, and a grinder. Orders land on the <b>supply rack</b> next to it, or as crates in the back room. Take a bag of soil to the <b>tent</b>, fill a pot, fetch a seed and plant it. Grab the <b>watering can</b> by the tent when a plant says it\'s thirsty, feed it <b>nutrients</b> once for quality, and <b>spray</b> pests or mould fast.</p>' +
          '<h4>Harvest</h4><p>A plant that\'s ready glows. Harvest it with empty hands, carry the bunch to the <b>drying line</b> in the dry room and hang it. Dry batches go to the <b>curing shelf</b> in jars and keep gaining quality. Take a jar to the <b>workbench</b>, empty it into your stash, then bag, roll or bake there. Finished goods go on the <b>goods shelf</b>.</p>' +
          '<h4>Money</h4><p>Customers come to <b>the window</b>. Take what they want off the goods shelf and hand it over. They pay when the order is complete, and you take the money at the <b>till</b>. Connoisseurs (🎩) pay 2.2× for quality 70+. Goods rung up at the till as a walk-up sale fetch 85% of the board price, 12 a day.</p>' +
          '<h4>Build mode</h4><p>Press <b>F2</b> (or Build mode in this menu) to rearrange the place: look at any piece of furniture, a sign or a screen, <b>E</b> grabs it, carry it to a spot, <b>R</b> turns it, <b>E</b> drops it, <b>Backspace</b> puts it back where it came from and <b>Del</b> removes it. <b>C</b> opens the catalogue: furniture to buy and shapes to build your own, which take <b>[ ]</b> to scale, <b>P</b> to paint and <b>X</b> to copy. Your layout is saved.</p>' +
          '<h4>Upstairs</h4><p>The stairs in the office lead to your <b>flat</b>: a kitchen (fridge snacks, eat at the table), a couch and a <b>big TV</b> (E cycles: shop dashboard, grow cam, house news), and a bed. Eating gives you a speed boost for 10 min.</p>' +
          '<h4>The shop</h4><p>The <b>control box</b> in the security room opens or closes the shop, runs the lights and picks a radio station. The <b>front panel</b> behind the till and the <b>office panel</b> do part of the same job where you stand. <b>Curtains</b> on every window and the door open with E. The <b>staff door</b> opens with E and shuts itself 4 s after people are through. Dust settles on the floors, and the <b>broom</b> hangs in the processing room.</p>' +
          '<h4>Keys</h4><p><b>WASD</b> move · <b>Shift</b> run · <b>Space</b> jump · <b>Ctrl</b> crouch · <b>E</b> or click: pick up, use, talk · <b>Shift+E</b> the second action · <b>Ctrl+E</b> sends a crew member home · <b>G</b> put back · <b>I</b> inventory · <b>Tab</b> quick wheel · <b>F</b> phone · <b>Esc</b> pause</p>';
      }
    /* 35-dlc-kit.js */
    var DLCX = { list: [], kinds: {} };
    /* 35-dlc-kit.js */
    function dlcState(id, defaults) {
        if (!S.dlc || typeof S.dlc !== 'object' || Array.isArray(S.dlc)) S.dlc = {}; var st = S.dlc[id]; if (!st || typeof st !== 'object') st = S.dlc[id] = {};
        for (var k in defaults) if (st[k] === undefined || st[k] === null && defaults[k] !== null && typeof defaults[k] === 'object') st[k] = JSON.parse(JSON.stringify(defaults[k]));
        return st;
      }
    /* 35-dlc-kit.js */
    function dlcEach(fn, a, b) { DLCX.list.forEach(function (o) { if (o[fn] && dlcOn(o.id)) { try { o[fn](a, b); } catch (e) { console.error('[dlc ' + o.id + '] ' + fn, e); } } }); }
    /* 35-dlc-kit.js */
    function dlcStep(dt, offline) { dlcEach('tick', dt, offline); }
    /* 35-dlc-kit.js */
    function dlcNewDay(offline) { dlcEach('newDay', offline); }
    /* 35-dlc-kit.js */
    function strainsWithSeed(n) { return STRAINS.filter(function (st) { return (S.supplies['seed_' + st.id] || 0) >= (n || 1); }); }
    /* 35-dlc-kit.js */
    function minsLeft(sec) { sec = Math.max(0, Math.ceil(sec)); return sec >= 90 ? Math.round(sec / 60) + ' min' : sec + ' s'; }
    /* 35-dlc-kit.js */
    function barHtml(frac, cls) { return '<div class="g3-bar' + (cls ? ' ' + cls : '') + '"><span style="width:' + Math.round(clamp(frac, 0, 1) * 100) + '%"></span></div>'; }
    /* 35-dlc-kit.js */
    function notFitted(c, w, d, lines, kind) {
        var tape = colorMat(0xe3b52c, 0.7); c.box(w, 0.006, 0.05, tape, 0, 0.006, d / 2, { cast: false, sharp: true }); c.box(w, 0.006, 0.05, tape, 0, 0.006, -d / 2, { cast: false, sharp: true }); c.box(0.05, 0.006, d, tape, -w / 2, 0.006, 0, { cast: false, sharp: true }); c.box(0.05, 0.006, d, tape, w / 2, 0.006, 0, { cast: false, sharp: true });
        c.cyl(0.12, 0.14, 0.03, MAT.gunmetal, 0, 0.015, 0, 20); c.cyl(0.012, 0.012, 1.25, MAT.alu, 0, 0.64, 0, 10); c.sign(lines, 0.7, 0.3, 0, 1.4, 0.012, 0, { titleColor: '#f0b94d' });
        c.hit(w, 1.7, d, 0, 0.85, 0, { kind: kind });
      }
    /* 35-dlc-kit.js */
    function plantFigure(st) {
        var g = new THREE.Group(), stemM = MAT.stem.clone(), leafM = MAT.leaf.clone(), budM = MAT.bud.clone(); stemM.color.setHex(st.leaf).lerp(new THREE.Color(0x6a5a3a), 0.35); leafM.color.setHex(st.leaf); budM.color.setHex(st.bud);
        var stem = new THREE.Mesh(roundCylGeo(0.008, 0.018, 1, 8), stemM); stem.castShadow = true; g.add(stem);
        var nodes = [], buds = [];
        for (var i = 0; i < 6; i++) { var n = new THREE.Group(); n.rotation.y = i * 2.4; [0, Math.PI].forEach(function (sd) { var hld = new THREE.Group(); hld.rotation.y = sd; var lf = new THREE.Mesh(LEAF_GEO, leafM); lf.rotation.x = -1.05; lf.castShadow = true; hld.add(lf); n.add(hld); }); g.add(n); nodes.push(n); }
        for (var b = 0; b < 7; b++) { var bd = new THREE.Mesh(BUD_GEO, budM); bd.rotation.set(b, b * 2.1, b * 0.7); bd.castShadow = true; g.add(bd); buds.push(bd); }
        g.userData.set = function (pr, size) {
          size = size || 1; pr = clamp(pr, 0, 1); var hgt = (0.06 + pr * 0.8) * size; stem.scale.set(0.5 + pr * 0.8, hgt, 0.5 + pr * 0.8); stem.position.y = hgt / 2;
          nodes.forEach(function (n, k) { var on = k < Math.floor(1 + pr * 6.5) && pr > 0.04; n.visible = on; if (!on) return; n.position.y = Math.min(hgt - 0.02, (0.14 + k / 5 * 0.8) * hgt); n.scale.setScalar(clamp((pr * 6.5 - k) / 1.5, 0.15, 1) * (0.4 + pr * 0.6) * (1 - k / 14) * size); });
          var ft = clamp((pr - 0.62) / 0.38, 0, 1);
          buds.forEach(function (bd, b) { var t = clamp(ft * 1.5 - b * 0.08, 0, 1); bd.visible = t > 0; var s = (0.4 + t * 1.1) * (1 - b * 0.06) * size; bd.scale.set(s, s * 1.2, s); var a = b * 2.4, r = 0.045 * (1 - b / 9) * size; bd.position.set(Math.cos(a) * r, hgt * (0.62 + b * 0.065), Math.sin(a) * r); });
        };
        g.userData.set(0); return g;
      }
    /* 35-dlc-kit.js */
    function readout(pw, ph, accent) {
        var cv = document.createElement('canvas'); cv.width = 384; cv.height = Math.round(384 * ph / pw); var m = litPlane(cv, pw, ph), last = '';
        m.userData.draw = function (lines, col) { var key = lines.join('|') + (col || ''); if (key === last) return; last = key; var ctx = cv.getContext('2d'), W = cv.width, H = cv.height; scrLcd(ctx, W, H, col || accent || DESK_OK); ctx.fillStyle = col || accent || DESK_OK; ctx.font = '700 30px ' + DESK_FONT; ctx.fillText(deskTrim(ctx, lines[0] || '', W - 36), 18, 16); ctx.fillStyle = DESK_INK; ctx.font = '24px ' + DESK_FONT; for (var i = 1; i < lines.length; i++) ctx.fillText(deskTrim(ctx, lines[i], W - 36), 18, 22 + i * 34); m.userData.tex.needsUpdate = true; };
        return m;
      }
    /* 35-dlcx-breeding.js */
    var BREED = { fee: 150, ms: 480000, seeds: 6, max: 12, price: 900 };
    /* 35-dlcx-breeding.js */
    function breedState() { return dlcState('breeding', { owned: false, strains: [], job: null, pickA: '', pickB: '', name: '' }); }
    /* 35-dlcx-breeding.js */
    function breedStats(st) { return 'strength ' + st.thc.toFixed(2) + '× · ' + st.yield + ' g a plant · ' + Math.round(st.growMs / 60000) + ' min · seed ' + money(st.seed); }
    /* 35-dlcx-breeding.js */
    function paneBreed() {
        var B = breedState(), h = '<div class="g3-grid"><div class="g3-box"><h3>🧬 The cross</h3>';
        if (B.job) {
          var J = B.job, a = strainById(J.a), b = strainById(J.b), k = clamp(J.t / (BREED.ms / 1000), 0, 1);
          h += '<div class="g3-customer"><span class="avatar">' + a.emoji + '</span><div><span class="who">' + esc(a.name) + ' × ' + esc(b.name) + '</span><span class="req">' + (k >= 1 ? 'The pods have split: the seed is ready.' : 'Pollinated. ' + minsLeft((1 - k) * BREED.ms / 1000) + ' until the seed is ripe.') + '</span></div><span class="avatar">' + b.emoji + '</span></div>' + barHtml(k, 'q');
          if (k >= 1) h += '<div class="desc" style="margin-top:12px">What came out: <b>' + breedStats(J.child) + '</b>' + (J.child.star ? '. One plant in the tray stood out, and you kept that one.' : '.') + ' Give it a name.</div><div class="g3-slider"><label>Name</label><input type="text" data-breed="name" maxlength="24" value="' + esc(B.name) + '" style="flex:2;background:#0c1712;color:var(--ink);border:1px solid var(--panel-line);border-radius:8px;padding:7px 10px"></div><button class="g3-btn primary wide" data-act="breedFinish">🧬 Name it and take the ' + BREED.seeds + ' seeds</button>';
        } else {
          var have = strainsWithSeed(1);
          h += '<div class="desc">Pick a mother and a father. The seed takes after both: strength, yield and how long it takes to grow land somewhere between them, give or take. It costs a seed of each and ' + money(BREED.fee) + ' for the lab work.</div>';
          if (have.length < 2) h += '<div class="g3-empty">You need seeds of two different strains on the supply rack. The Seed bank on the office PC sells them.</div>';
          else {
            [['pickA', 'Mother'], ['pickB', 'Father']].forEach(function (p) { h += '<div class="desc" style="margin:10px 0 2px">' + p[1] + '</div><div class="g3-chips">' + have.map(function (st) { return '<button class="g3-btn' + (B[p[0]] === st.id ? ' primary' : '') + '" data-act="breedPick" data-id="' + p[0] + ':' + st.id + '">' + st.emoji + ' ' + esc(st.name) + '</button>'; }).join('') + '</div>'; });
            var ok = B.pickA && B.pickB && B.pickA !== B.pickB;
            h += '<button class="g3-btn primary wide" data-act="breedStart"' + (ok && B.strains.length < BREED.max ? '' : ' disabled') + '>🧬 Start the cross · ' + money(BREED.fee) + ' · about ' + Math.round(BREED.ms / 60000) + ' min</button>';
          }
        }
        h += '</div><div class="g3-box"><h3>📚 Your cultivars · ' + B.strains.length + ' of ' + BREED.max + '</h3><div class="desc">Everything you have bred. The Seed bank sells more seed of each, and customers ask for them by name.</div>';
        if (!B.strains.length) h += '<div class="g3-empty">Nothing yet. Your first cross goes here.</div>';
        B.strains.forEach(function (st) { var pa = strainById(st.parents[0]), pb = strainById(st.parents[1]); h += '<div class="g3-row"><span class="ico"><i class="sw" style="display:block;width:18px;height:18px;border-radius:50%;background:#' + ('000000' + st.bud.toString(16)).slice(-6) + '"></i></span><span class="meta"><span class="n">' + esc(st.name) + (st.star ? ' ★' : '') + '</span><span class="own">' + breedStats(st) + '</span><span class="own">' + esc(pa.name) + ' × ' + esc(pb.name) + ' · ' + (S.supplies['seed_' + st.id] || 0) + ' seeds on the rack</span></span></div>'; });
        return h + '</div></div>';
      }
    /* 35-dlcx-cup.js */
    var CUP = { every: 7, grams: 10, rivals: ['Green Leaf', 'Uptown Buds', 'Old Mill Farms', 'Harbour Hydro', 'The Potting Shed'], metal: { gold: 0xd9b23a, silver: 0xc4c9cf, bronze: 0xb0703a }, shelf: 9 };
    /* 35-dlcx-cup.js */
    function cupState() { return dlcState('cup', { entry: null, trophies: [], history: [] }); }
    /* 35-dlcx-cup.js */
    function cupNext() { var d = S.day || 1; return Math.ceil((d + 0.001) / CUP.every) * CUP.every; }
    /* 35-dlcx-cup.js */
    function cupScore(q, thc) { return q * 0.62 + (thc - 1) * 22; }
    /* 35-dlcx-cup.js */
    function cupGolds() { return cupState().trophies.filter(function (t) { return t.metal === 'gold'; }).length; }
    /* 35-dlcx-cup.js */
    function paneCup() {
        var C = cupState(), next = cupNext(), left = next - (S.day || 1), h = '<div class="g3-grid"><div class="g3-box"><h3>🏆 The next Cup · day ' + next + '</h3><div class="desc">' + (left === 1 ? 'Judging is tomorrow morning.' : 'Judging is in ' + left + ' days.') + ' Three judges score one jar from every grower in town on how well it was grown, how strong it is and how it was cured. You enter ' + CUP.grams + ' g of one strain.</div>';
        if (C.entry) { var st = strainById(C.entry.strain); h += '<div class="g3-customer premium"><span class="avatar">' + st.emoji + '</span><div><span class="who">' + esc(st.name) + '</span><span class="req">quality ' + C.entry.q + ' · strength ' + C.entry.thc.toFixed(2) + '× · in the entry jar</span></div></div><button class="g3-btn wide" data-act="cupWithdraw">Take it back into the stash</button>'; }
        else h += '<div class="g3-empty">No jar entered yet.</div>';
        var can = STRAINS.filter(function (st) { return stashOf(st.id).g >= CUP.grams; });
        h += '<div class="desc" style="margin-top:12px">' + (C.entry ? 'Enter a different jar instead' : 'Enter a jar') + '</div>';
        if (!can.length) h += '<div class="g3-empty">You need ' + CUP.grams + ' g of one cured strain in the stash.</div>';
        can.sort(function (a, b) { var sa = stashOf(a.id), sb = stashOf(b.id); return cupScore(sb.qSum / sb.g, sb.thcSum / sb.g) - cupScore(sa.qSum / sa.g, sa.thcSum / sa.g); }).forEach(function (st) { var s = stashOf(st.id), q = s.qSum / s.g, t = s.thcSum / s.g; h += '<div class="g3-row"><span class="ico">' + st.emoji + '</span><span class="meta"><span class="n">' + esc(st.name) + '</span><span class="own">quality ' + Math.round(q) + ' · strength ' + t.toFixed(2) + '× · ' + gram(s.g) + ' in the stash</span></span><button class="g3-btn" data-act="cupEnter" data-id="' + st.id + '">Enter ' + CUP.grams + ' g</button></div>'; });
        h += '</div><div class="g3-box"><h3>🥇 The cabinet</h3><div class="g3-chips">' + ['gold', 'silver', 'bronze'].map(function (m) { return chip(m, C.trophies.filter(function (t) { return t.metal === m; }).length); }).join('') + '</div><div class="desc">Every gold cup in the cabinet brings more people through the door: ' + Math.round((cupFootfall() - 1) * 100) + '% more at the moment, up to 15%.</div>';
        if (!C.history.length) h += '<div class="g3-empty">No Cup has been judged yet.</div>';
        C.history.forEach(function (r) { h += '<div class="g3-row"><span class="ico">' + (['·', '🥇', '🥈', '🥉'][r.place] || '·') + '</span><span class="meta"><span class="n">Day ' + r.day + '</span><span class="own">' + esc(r.note) + '</span></span></div>'; });
        return h + '</div></div>';
      }
    /* 35-dlcx-cup.js */
    function cupFootfall() { return 1 + Math.min(0.15, cupGolds() * 0.03); }
    /* 35-dlcx-cup.js */
    function trophyMesh(metal, s) {   // a two-handled cup on a stepped base
        var g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: CUP.metal[metal], roughness: 0.22, metalness: 1 }), wood = MAT.darkwood;
        function add(geo, mat, y) { var x = new THREE.Mesh(geo, mat); x.position.y = y; x.castShadow = true; g.add(x); return x; }
        add(roundCylGeo(0.05, 0.055, 0.03, 20), wood, 0.015); add(roundCylGeo(0.036, 0.042, 0.016, 20), m, 0.038); add(roundCylGeo(0.01, 0.014, 0.06, 12), m, 0.076); add(new THREE.SphereGeometry(0.016, 12, 10), m, 0.082);
        var bowl = add(new THREE.CylinderGeometry(0.052, 0.022, 0.085, 24, 1, true), m, 0.148); bowl.material = m.clone(); bowl.material.side = THREE.DoubleSide; add(new THREE.TorusGeometry(0.052, 0.004, 8, 24), m, 0.19).rotation.x = Math.PI / 2; add(roundCylGeo(0.024, 0.02, 0.01, 16), m, 0.108);
        [-1, 1].forEach(function (sd) { var h = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0045, 8, 16, Math.PI), m); h.position.set(sd * 0.05, 0.15, 0); h.rotation.z = sd * -Math.PI / 2; g.add(h); });
        g.scale.setScalar(s || 1); return g;
      }
    /* 35-dlcx-finance.js */
    var FIN = { rate: 0.005, cap: 500, loans: [{ id: 'small', name: 'Starter loan', sum: 2000, lvl: 1 }, { id: 'mid', name: 'Business loan', sum: 6000, lvl: 4 }, { id: 'big', name: 'Expansion loan', sum: 15000, lvl: 8 }], days: 10, interest: 0.12,
        cover: [{ id: 'robbery', ico: '🦹', name: 'Robbery cover', day: 35, d: 'Pays back 75% of whatever robbers got away with, the morning after.' }, { id: 'power', ico: '⚡', name: 'Power cover', day: 12, d: 'Pays $150 for every power cut, for the stock that spoils and the trade you lose.' }, { id: 'stock', ico: '🌙', name: 'Break-in cover', day: 18, d: 'Pays $400 after a night break-in.' }] };
    /* 35-dlcx-finance.js */
    function finState() { var F = dlcState('finance', { savings: 0, earned: 0, loan: null, cover: {}, claims: [], seen: null }); if (!F.seen) F.seen = { robbed: S.stats.robbed || 0, breakins: S.stats.breakins || 0, cuts: 0 }; return F; }
    /* 35-dlcx-finance.js */
    function paneFinance() {
        var F = finState(), h = '<div class="g3-grid"><div class="g3-box"><h3>💰 Savings · ' + money(F.savings) + '</h3><div class="desc">Money you don\'t need this week earns ' + (FIN.rate * 100).toFixed(1) + '% a day here, up to ' + money(FIN.cap) + ' a day. Robbers can\'t reach it and the morning bills don\'t draw on it. Interest so far: ' + money(F.earned) + '.</div>';
        h += '<div class="desc">Pay in from the bank (' + money(S.bank) + ')</div><div class="g3-chips">' + [100, 500, 1000, 5000].map(function (n) { return '<button class="g3-btn" data-act="finIn" data-id="' + n + '"' + (S.bank >= n ? '' : ' disabled') + '>' + money(n) + '</button>'; }).join('') + '<button class="g3-btn" data-act="finIn" data-id="all"' + (S.bank >= 1 ? '' : ' disabled') + '>all of it</button></div>';
        h += '<div class="desc">Take out</div><div class="g3-chips">' + [100, 500, 1000, 5000].map(function (n) { return '<button class="g3-btn" data-act="finOut" data-id="' + n + '"' + (F.savings >= n ? '' : ' disabled') + '>' + money(n) + '</button>'; }).join('') + '<button class="g3-btn" data-act="finOut" data-id="all"' + (F.savings >= 1 ? '' : ' disabled') + '>all of it</button></div>';
        h += '<h3 style="margin-top:16px">🏦 Borrowing</h3>';
        if (F.loan) h += '<div class="g3-customer premium"><span class="avatar">📄</span><div><span class="who">' + F.loan.name + ' · ' + money(F.loan.left) + ' to pay</span><span class="req">' + money(F.loan.daily) + ' every morning' + (F.loan.missed ? ' · ' + F.loan.missed + ' payment' + (F.loan.missed === 1 ? '' : 's') + ' missed' : '') + '</span></div></div>' + barHtml(1 - F.loan.left / (F.loan.sum * (1 + FIN.interest)), 'q') + '<button class="g3-btn wide" data-act="finSettle">Pay it off now · ' + money(Math.round(F.loan.left * 0.95)) + '</button>';
        else { h += '<div class="desc">One loan at a time. It costs ' + Math.round(FIN.interest * 100) + '% and goes back in ' + FIN.days + ' daily payments. A morning you can\'t pay costs you rep and adds to the debt.</div>'; FIN.loans.forEach(function (L) { var ok = (S.level || 1) >= L.lvl; h += '<div class="g3-row"><span class="ico">💵</span><span class="meta"><span class="n">' + L.name + ' · ' + money(L.sum) + '</span><span class="own">' + (ok ? money(Math.ceil(L.sum * (1 + FIN.interest) / FIN.days)) + ' a day for ' + FIN.days + ' days' : 'from level ' + L.lvl) + '</span></span><button class="g3-btn" data-act="finBorrow" data-id="' + L.id + '"' + (ok ? '' : ' disabled') + '>Borrow</button></div>'; }); }
        h += '</div><div class="g3-box"><h3>🛡️ Insurance</h3><div class="desc">The premium goes out with the morning bills. A claim is paid into the bank the morning after.</div>';
        FIN.cover.forEach(function (c) { var on = !!F.cover[c.id]; h += '<div class="g3-row"><span class="ico">' + c.ico + '</span><span class="meta"><span class="n">' + c.name + ' · ' + money(c.day) + ' a day</span><span class="own">' + c.d + '</span></span><button class="g3-btn' + (on ? ' primary' : '') + '" data-act="finCover" data-id="' + c.id + '">' + (on ? 'Covered' : 'Take it out') + '</button></div>'; });
        h += '<h3 style="margin-top:16px">📬 Statements</h3>'; if (!F.claims.length) h += '<div class="g3-empty">Nothing has been paid out yet.</div>';
        F.claims.forEach(function (c) { h += '<div class="g3-row"><span class="ico">📄</span><span class="meta"><span class="n">Day ' + c.day + ' · ' + money(c.sum) + '</span><span class="own">' + esc(c.text) + '</span></span></div>'; });
        return h + '</div></div>';
      }
    /* 35-dlcx-hydro.js */
    var HYDRO = { sites: 8, price: 1800, spd: 1.8, slow: 0.45, phLo: 5.5, phHi: 6.5, feedCost: 14, phCost: 5, phDrift: 0.00022, feedUse: 0.018 };
    /* 35-dlcx-hydro.js */
    function hydroState() { var H = dlcState('hydrobay', { owned: false, sites: [], ph: 6.0, feed: 100 }); while (H.sites.length < HYDRO.sites) H.sites.push(null); return H; }
    /* 35-dlcx-hydro.js */
    function hydroSitePos(i) { return { x: -0.9 + (i % 4) * 0.6, y: i < 4 ? 0.8 : 1.42, z: 0.02 }; }
    /* 35-dlcx-hydro.js */
    function hydroSync() {   // what stands in the channels, rebuilt from the save
        var W = world.hydro; if (!W || !W.dyn || !W.dyn.parent) return; dropKids(W.dyn); W.figs = [];
        hydroState().sites.forEach(function (p, i) { if (!p) return; var f = plantFigure(strainById(p.strain)), s = hydroSitePos(i); f.position.set(s.x, s.y + 0.04, s.z); f.userData.set(p.progress, 0.62); f.userData.site = i; W.dyn.add(f); W.figs.push(f); });
      }
    /* 35-dlcx-merch.js */
    var MERCH = { price: 600, lot: 10, wait: 90, items: [
        { id: 'tee', ico: '👕', name: 'T-shirt', one: 'a T-shirt', cost: 9, sell: 24 }, { id: 'cap', ico: '🧢', name: 'Cap', one: 'a cap', cost: 7, sell: 18 },
        { id: 'mug', ico: '☕', name: 'Mug', one: 'a mug', cost: 5, sell: 14 }, { id: 'tote', ico: '👜', name: 'Tote bag', one: 'a tote bag', cost: 4, sell: 12 }],
        levels: [0, 10, 30, 60, 100, 150, 210, 280, 360, 450, 550], tiers: [[0.8, 'keen', 1.35], [1, 'fair', 1], [1.25, 'dear', 0.6]] };
    /* 35-dlcx-merch.js */
    function merchState() { var M = dlcState('merch', { owned: false, stock: {}, tier: 1, brand: 0, sold: 0, takings: 0, orders: [], t: 0 }); if (typeof M.stock.hoodie !== 'number') M.stock.hoodie = 0; MERCH.items.forEach(function (it) { if (typeof M.stock[it.id] !== 'number') M.stock[it.id] = 0; }); return M; }
    /* 35-dlcx-merch.js */
    function merchLevel() { var b = merchState().brand, l = 0; MERCH.levels.forEach(function (n, i) { if (b >= n) l = i; }); return l; }
    /* 35-dlcx-merch.js */
    function merchPrice(it) { return Math.round(it.sell * MERCH.tiers[merchState().tier][0]); }
    /* 35-dlcx-merch.js */
    function paneMerch() {
        var M = merchState(), lv = merchLevel(), nextAt = MERCH.levels[lv + 1], h = '<div class="g3-grid"><div class="g3-box"><h3>👕 The stand</h3>';
        if (!M.owned) return h + '<div class="g3-empty">The merch stand is not in the lobby yet. E on its outline fits it for ' + money(MERCH.price) + '.</div></div></div>';
        h += '<div class="desc">People in the lobby buy while they wait, and the money goes in the till. A box is ' + MERCH.lot + ' of one thing, printed with the shop\'s mark.</div>';
        MERCH.items.forEach(function (it) { var due = M.orders.filter(function (o) { return o.id === it.id; }).length * MERCH.lot; h += '<div class="g3-row"><span class="ico">' + it.ico + '</span><span class="meta"><span class="n">' + it.name + ' · ' + M.stock[it.id] + ' on the stand' + (due ? ' <small>' + due + ' on the way</small>' : '') + '</span><span class="own">costs ' + money(it.cost) + ' · sells for ' + money(merchPrice(it)) + '</span></span><button class="g3-btn" data-act="merchOrder" data-id="' + it.id + '">Order ' + MERCH.lot + ' · ' + money(it.cost * MERCH.lot) + '</button></div>'; });
        h += '<div class="desc" style="margin-top:12px">Prices</div><div class="g3-chips">' + MERCH.tiers.map(function (t, i) { return '<button class="g3-btn' + (M.tier === i ? ' primary' : '') + '" data-act="merchTier" data-id="' + i + '">' + Math.round(t[0] * 100) + '% · ' + t[1] + '</button>'; }).join('') + '</div><div class="desc">Keen prices sell faster and spread the name sooner. Dear ones earn more on each and sell slowly.</div>';
        h += '</div><div class="g3-box"><h3>📣 The brand · level ' + lv + '</h3><div class="desc">Every sale puts the shop\'s name on somebody\'s back. Each level brings 2% more people through the door, up to 20%.</div>' + (nextAt ? barHtml((M.brand - MERCH.levels[lv]) / (nextAt - MERCH.levels[lv]), 'q') + '<div class="desc" style="margin-top:6px">' + (nextAt - M.brand) + ' more sales to level ' + (lv + 1) + '</div>' : '<div class="desc">As well known as a shop this size gets.</div>');
        h += '<div class="g3-chips" style="margin-top:12px">' + chip('sold', M.sold) + chip('takings', money(M.takings)) + chip('footfall', '+' + (lv * 2) + '%') + '</div></div></div>';
        return h;
      }
    /* 35-dlcx-merch.js */
    function teeGeo() {   // a T-shirt cut flat: body, sleeves, a scooped neck
        var s = new THREE.Shape(), P = [[-0.17, -0.26], [0.17, -0.26], [0.17, 0.1], [0.28, 0.03], [0.34, 0.12], [0.2, 0.26], [0.08, 0.26]]; s.moveTo(P[0][0], P[0][1]); for (var i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]);
        s.quadraticCurveTo(0, 0.18, -0.08, 0.26); [[-0.2, 0.26], [-0.34, 0.12], [-0.28, 0.03], [-0.17, 0.1]].forEach(function (p) { s.lineTo(p[0], p[1]); }); s.closePath();
        return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
      }
    /* 35-dlcx-merch.js */
    var TEE_GEO = teeGeo(), MERCH_COLS = [0x15171b, 0xf3eee0, 0x2f6b4a, 0x6fdc8c, 0x7a2f3a];
    /* 35-dlcx-merch.js */
    function merchMark(w) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: emojiTex('🌿', 96, '#0f1a15'), transparent: true })); return m; }
    /* 35-dlcx-merch.js */
    function merchSync() {
        var W = world.merch; if (!W || !W.dyn || !W.dyn.parent) return; dropKids(W.dyn); var M = merchState(), g = W.dyn;
        function add(geo, mat, x, y, z, ry) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry || 0; m.castShadow = true; g.add(m); return m; }
        [1, -1].forEach(function (face) {
          var ry = face > 0 ? 0 : Math.PI, z0 = face * 0.06;
          for (var i = 0; i < Math.min(5, Math.ceil(M.stock.tee / 4)); i++) { var t = add(TEE_GEO, fabricMat(MERCH_COLS[(i + (face > 0 ? 0 : 2)) % 5]), face * (-0.56 + i * 0.28), 1.42, z0 + face * (0.05 + (i % 2) * 0.03), ry); t.rotation.y += face * 0.18; t.scale.setScalar(0.78); var mk = merchMark(0.12); mk.position.set(0, 0.02, 0.018); t.add(mk); add(roundCylGeo(0.004, 0.004, 0.16, 6), MAT.chrome, t.position.x, 1.66, t.position.z - face * 0.0, 0).rotation.x = Math.PI / 2; }
          for (var hd2 = 0; hd2 < Math.min(3, Math.ceil((M.stock.hoodie || 0) / 5)); hd2++) { var hm = fabricMat([0x15171b, 0x2f6b4a, 0x7a2f3a][hd2]), hx = face * (-0.5 + hd2 * 0.5), hb2 = add(TEE_GEO, hm, hx, 1.06, z0 + face * 0.06, ry); hb2.scale.set(0.9, 0.95, 1.6); var hood = add(new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm, hx, 1.24, z0 + face * 0.05, ry); hood.scale.set(1, 1.1, 0.7); var mk3 = merchMark(0.1); mk3.position.set(0, 0.0, 0.012); hb2.add(mk3); }
          for (var c2 = 0; c2 < Math.min(4, Math.ceil(M.stock.cap / 5)); c2++) { var cm = fabricMat(MERCH_COLS[(c2 + 1) % 5]), cx = face * (-0.5 + c2 * 0.33), cap = add(new THREE.SphereGeometry(0.085, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cm, cx, 1.875, z0 + face * 0.1, ry); var pk = add(bevelGeo(0.13, 0.012, 0.09, 0.005), cm, cx, 1.88, z0 + face * 0.19, ry); pk.rotation.x = face * 0.12; }
          for (var m2 = 0; m2 < Math.min(5, Math.ceil(M.stock.mug / 4)); m2++) { var mm = colorMat(MERCH_COLS[(m2 + 3) % 5], 0.25), mx = face * (-0.56 + m2 * 0.28); add(roundCylGeo(0.04, 0.036, 0.09, 18), mm, mx, 0.795, z0 + face * 0.14, ry); var hd = add(new THREE.TorusGeometry(0.024, 0.007, 8, 14, Math.PI), mm, mx + 0.042, 0.795, z0 + face * 0.14, 0); hd.rotation.z = -Math.PI / 2; }
          for (var b = 0; b < Math.min(3, Math.ceil(M.stock.tote / 6)); b++) { var bm = fabricMat(b % 2 ? 0xe9dfc6 : 0x2f6b4a), bx = face * (-0.4 + b * 0.4), bag = add(bevelGeo(0.26, 0.3, 0.03, 0.01), bm, bx, 0.36, z0 + face * 0.16, ry); var mk2 = merchMark(0.13); mk2.position.set(0, -0.02, 0.0165); bag.add(mk2); var hl = add(new THREE.TorusGeometry(0.06, 0.006, 6, 14, Math.PI), bm, bx, 0.51, z0 + face * 0.16, ry); }
        });
      }
    /* 35-dlcy-cigars.js */
    var CIGAR = { leaf: 0.02, lot: 5, rollS: 40, ageS: 480, cap: 40, keep: [0, 0.5, 1, 2], take: 10 };
    /* 35-dlcy-cigars.js */
    function cigarState() { var C = dlcState('cigars', { job: null, humidor: [], keep: 0.5, rolled: 0 }); if (CIGAR.keep.indexOf(C.keep) < 0) C.keep = 0.5; return C; }
    /* 35-dlcy-cigars.js */
    function tobSpare(T) { return Math.max(0, T.cured - (dlcOn('tobacco') ? cigarState().keep : 0)); }
    /* 35-dlcy-cigars.js */
    function cigarModel(s) {   // one cigar: a tapered body, a rounded head and a band
        var G = new THREE.Group(), wrap = colorMat(0x5a3a1e, 0.75), b = new THREE.Mesh(roundCylGeo(0.0085 * s, 0.0095 * s, 0.125 * s, 12), wrap); b.rotation.z = Math.PI / 2; b.castShadow = true; G.add(b);
        var hd = new THREE.Mesh(new THREE.SphereGeometry(0.0085 * s, 10, 8), wrap); hd.position.x = -0.0625 * s; hd.scale.x = 1.4; G.add(hd);
        var bd = new THREE.Mesh(new THREE.CylinderGeometry(0.0092 * s, 0.0094 * s, 0.018 * s, 12), colorMat(0xb5121b, 0.5)); bd.rotation.z = Math.PI / 2; bd.position.x = -0.03 * s; G.add(bd);
        var gd = new THREE.Mesh(new THREE.CylinderGeometry(0.0094 * s, 0.0096 * s, 0.004 * s, 12), MAT.brass); gd.rotation.z = Math.PI / 2; gd.position.x = -0.03 * s; G.add(gd);
        return G;
      }
    /* 35-dlcy-cigars.js */
    function productCigar(K, s) {   // what you hold and what stands in the cabinet: three cigars in an open cedar tray
        var G = new THREE.Group(), cedar = colorMat(0x9a6a3a, 0.7); var tray = new THREE.Mesh(bevelGeo(0.075 * s, 0.012 * s, 0.14 * s), cedar); tray.position.y = -0.03 * s; G.add(tray);
        for (var i = 0; i < 3; i++) { var c = cigarModel(s); c.rotation.y = Math.PI / 2; c.position.set((i - 1) * 0.022 * s, -0.014 * s, 0); G.add(c); }
        return G;
      }
    /* 35-dlcy-lab.js */
    var LAB_TECH = { wage: 85, maxQ: 60, grams: 10, stock: 24 };
    /* 35-dlcy-lab.js */
    function labState() { var L = xs().lab; if (!L.q || typeof L.q !== 'object') L.q = {}; if (typeof L.honey !== 'number') L.honey = 0; return L; }
    /* 35-dlcy-lab.js */
    function mixQ(qa, na, qb, nb) { if (qa === undefined || na <= 0) return qb; if (qb === undefined || nb <= 0) return qa; return (qa * na + qb * nb) / (na + nb); }
    /* 35-dlcy-lab.js */
    function labShelve(J) { var L = labState(); if (typeof J.q === 'number') L.q[J.sku] = mixQ(L.q[J.sku], L.out[J.sku] || 0, J.q, J.n); L.out[J.sku] = (L.out[J.sku] || 0) + J.n; }
    /* 35-dlcy-roof.js */
    function roofxState() { return dlcState('roofkit', { water: 60, honey: 0 }); }
    /* 35-dlcy-roof.js */
    function roofWatered() { return dlcHas('greenhouse', 'barrels') && roofxState().water > 1; }
    /* 35-dlcy-roof.js */
    function productHoneyJar(K, s) {
        var G = new THREE.Group(), glass = new THREE.MeshPhysicalMaterial({ color: 0xe0a028, transparent: true, opacity: 0.9, roughness: 0.12 });
        var body = new THREE.Mesh(roundCylGeo(0.024 * s, 0.022 * s, 0.06 * s, 16), glass); body.castShadow = true; G.add(body);
        var lid = new THREE.Mesh(roundCylGeo(0.025 * s, 0.025 * s, 0.012 * s, 16), MAT.brass); lid.position.y = 0.036 * s; G.add(lid);
        var lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0245 * s, 0.0245 * s, 0.028 * s, 16, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ map: signTex(['HONEY', 'from the roof'], 180, 90, { size: 30, bg: '#fff3c8', color: '#5a3a0a', titleColor: '#5a3a0a', line: 'rgba(0,0,0,0)' }) })); G.add(lab);
        return G;
      }
    /* 35-dlcy-upgrades.js */
    var DLC_UPG = {}, DLC_UPG_ORDER = [];
    /* 35-dlcy-upgrades.js */
    function dlcUpgState() { if (!S.dlcUpg || typeof S.dlcUpg !== 'object' || Array.isArray(S.dlcUpg)) S.dlcUpg = {}; return S.dlcUpg; }
    /* 35-dlcy-upgrades.js */
    function dlcOwns(dlc, id) { var u = dlcUpgState()[dlc]; return !!(u && u[id]); }
    /* 35-dlcy-upgrades.js */
    function dlcHas(dlc, id) { return dlcOwns(dlc, id) && dlcOn(dlc); }
    /* 35-dlcy-upgrades.js */
    function paneDlcUpg() {
        var h = '', any = false;
        DLC_UPG_ORDER.forEach(function (dlc) {
          if (!dlcOn(dlc)) return; any = true;
          var G = DLC_UPG[dlc], own = G.list.filter(function (u) { return dlcOwns(dlc, u.id); }).length;
          h += '<div class="g3-box"><h3>' + G.ico + ' ' + esc(DLC_NAME[dlc] || dlc) + ' · ' + own + ' of ' + G.list.length + '</h3>';
          G.list.forEach(function (u) {
            var has = dlcOwns(dlc, u.id), lv = (S.level || 1) >= (u.lvl || 1), ok = !has && lv && S.bank >= u.price;
            h += '<div class="g3-row"><span class="ico">' + u.ico + '</span><span class="meta"><span class="n">' + u.name + (has ? '' : ' · ' + money(u.price)) + '</span><span class="own">' + u.d + (has || lv ? '' : ' From level ' + u.lvl + '.') + '</span></span><button class="g3-btn' + (has ? ' primary' : '') + '" data-act="dlcUpgBuy" data-id="' + dlc + ':' + u.id + '"' + (ok ? '' : ' disabled') + '>' + (has ? 'Fitted' : 'Buy') + '</button></div>';
          });
          h += '</div>';
        });
        if (!any) return '<div class="g3-grid"><div class="g3-box"><h3>⬆️ Upgrades</h3><div class="g3-empty">Every DLC has three upgrades of its own, and no DLC is switched on. Switch one on under Workshop and DLC in the main menu.</div></div></div>';
        return '<div class="desc" style="margin:0 0 12px">Three upgrades for every DLC you have switched on. They are paid from the bank and last for good. The bank holds ' + money(S.bank) + '.</div><div class="g3-grid">' + h + '</div>';
      }
    // the shop state the props read at build time: a sandboxed fresh Grow save with every upgrade on, never the host game's save
    var S = fresh(); S.upgrades = S.upgrades || {}; ['lobby', 'generator', 'lights', 'vip', 'arcade', 'vault'].forEach(function (k) { S.upgrades[k] = true; }); S.dlc = { breeding: { owned: true }, hydrobay: { owned: true }, merch: { owned: true }, cup: { owned: true } };
    for (var hk in HOST_MAT) if (MAT[hk] === undefined) MAT[hk] = HOST_MAT[hk]; for (var tk in HOST_TEX) if (TEX[tk] === undefined) TEX[tk] = HOST_TEX[tk];
    // the defs and their add-ons, each in a guard: a def whose part reads shop state at load is left out rather than breaking the pack
    try { growDefProp('officeDesk', { label: 'office desk', x: -ROOM.x + 0.55, z: 1.0, rot: 1, build: function (c) {
          // desk along local x, laptop faces the chair at +z; drawers on the right, cable tidy, lamp, mug, notepad
          c.box(1.6, 0.05, 0.72, MAT.wood, 0, 0.78, 0, { solid: true }); c.box(1.62, 0.02, 0.74, MAT.darkwood, 0, 0.745, 0, { cast: false });
          c.box(0.06, 0.78, 0.06, MAT.metal, -0.74, 0.39, -0.3); c.box(0.06, 0.78, 0.06, MAT.metal, -0.74, 0.39, 0.3); c.box(0.06, 0.02, 0.6, MAT.metal, -0.74, 0.01, 0);
          c.box(0.45, 0.7, 0.66, MAT.darkwood, 0.55, 0.36, 0, { cast: false }); drawer(c, 0.41, 0.18, 0.62, 0.55, 0.6, 0); drawer(c, 0.41, 0.18, 0.62, 0.55, 0.38, 0); drawer(c, 0.41, 0.18, 0.62, 0.55, 0.16, 0);
          // the PC: a widescreen monitor on an aluminium stand with its desktop on it, a keyboard and mouse on a desk mat, and a
          // tower under the desk. The picture is live: the clock runs and the figures are the shop's own. E on it sits you down.
          c.box(0.24, 0.012, 0.18, MAT.alu, -0.15, 0.811, -0.19, { cast: false, r: 0.005 }); c.box(0.055, 0.26, 0.018, MAT.alu, -0.15, 0.94, -0.225);
          var mg = new THREE.Group(); mg.position.set(-0.15, 1.115, -0.19); mg.rotation.x = -0.06; c.add(mg);
          screenShell(mg, 0.6, 0.3375, { bezel: 0.008, depth: 0.022, rim: 0.003, rimMat: MAT.gunmetal });
          var chin = new THREE.Mesh(bevelGeo(0.616, 0.022, 0.012, 0.004), MAT.gloss); chin.position.set(0, -0.188, -0.004); mg.add(chin);
          var pled = new THREE.Mesh(new THREE.CircleGeometry(0.003, 8), new THREE.MeshBasicMaterial({ color: 0x6fdc8c, toneMapped: false })); pled.position.set(0.28, -0.188, 0.0025); mg.add(pled);
          var hub = new THREE.Mesh(bevelGeo(0.12, 0.12, 0.03), MAT.gunmetal); hub.position.set(0, -0.03, -0.038); mg.add(hub);
          var pcv = document.createElement('canvas'); pcv.width = 960; pcv.height = 540; var pcScr = litPlane(pcv, 0.6, 0.3375); pcScr.position.z = 0.0005; mg.add(pcScr);
          var pgl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3375), MAT.screenGlass); pgl.position.z = 0.0016; mg.add(pgl);
          world.pcScr = { canvas: pcv, mesh: pcScr, at: 0 }; drawPcScreen();
          c.light(new THREE.PointLight(0x9fd8ff, 0.16, 1.4), -0.15, 1.1, 0.2);
          c.box(0.78, 0.006, 0.32, MAT.soft, -0.05, 0.809, 0.12, { cast: false });                                                   /* desk mat */
          var kbM = colorMat(0x2a2f36, 0.5, 0.2), keyM = colorMat(0x16181c, 0.6), keyL = colorMat(0x3a4048, 0.55);
          c.box(0.4, 0.016, 0.135, kbM, -0.15, 0.817, 0.12, { cast: false, r: 0.006 });
          for (var kr = 0; kr < 4; kr++) for (var kc = 0; kc < 13; kc++) c.box(0.025, 0.006, 0.024, (kr + kc) % 7 === 0 ? keyL : keyM, -0.327 + kc * 0.0295, 0.828, 0.072 + kr * 0.0285, { cast: false });
          c.box(0.15, 0.006, 0.022, keyM, -0.15, 0.828, 0.186, { cast: false }); c.box(0.05, 0.006, 0.022, keyL, -0.3, 0.828, 0.186, { cast: false }); c.box(0.05, 0.006, 0.022, keyL, 0.0, 0.828, 0.186, { cast: false });
          var mouse = c.box(0.058, 0.03, 0.105, MAT.gloss, 0.17, 0.824, 0.12, { r: 0.014 }); mouse.rotation.y = 0.12; c.box(0.006, 0.006, 0.02, colorMat(0x6fdc8c, 0.4, 0, { emissive: new THREE.Color(0x6fdc8c), emissiveIntensity: 0.8 }), 0.167, 0.838, 0.095, { cast: false });
          c.box(0.19, 0.44, 0.44, MAT.gloss, -0.35, 0.23, -0.05, { r: 0.012 }); c.box(0.004, 0.36, 0.36, MAT.glass, -0.253, 0.23, -0.05, { cast: false });   /* the tower, with a window in its side */
          c.box(0.004, 0.3, 0.012, emitMat(0x6fdc8c, 1.4), -0.256, 0.23, 0.1, { cast: false }); c.cyl(0.05, 0.05, 0.02, colorMat(0x22262b, 0.4, 0.6), -0.3, 0.3, -0.05, 18).rotation.z = Math.PI / 2;
          c.box(0.012, 0.012, 0.004, emitMat(0x6fdc8c, 1.2), -0.35, 0.42, 0.172, { cast: false }); c.light(new THREE.PointLight(0x6fdc8c, 0.12, 1.0), -0.2, 0.25, 0.1);
          c.hit(0.66, 0.46, 0.3, -0.15, 1.08, -0.12, { kind: 'laptop', label: 'PC', prompt: 'Use the PC' });
          c.cyl(0.075, 0.08, 0.018, MAT.gunmetal, -0.65, 0.814, -0.22, 24); var la1 = c.box(0.016, 0.36, 0.016, MAT.alu, -0.65, 0.99, -0.26, { sharp: true }); la1.rotation.x = -0.22; var la2 = c.box(0.016, 0.34, 0.016, MAT.alu, -0.65, 1.2, -0.17, { sharp: true }); la2.rotation.x = 1.05;
          c.cyl(0.013, 0.013, 0.03, MAT.soft, -0.65, 1.16, -0.3, 10).rotation.z = Math.PI / 2; var lh = c.box(0.05, 0.014, 0.26, MAT.gunmetal, -0.65, 1.27, 0.02, { r: 0.005 }); lh.rotation.x = 0.12; c.lit(0xfff0cc, 0.036, 0.22, -0.65, 1.2615, 0.02, 0, Math.PI / 2 + 0.12);
          c.light(new THREE.PointLight(0xffe0a8, 0.35, 2.5), -0.6, 1.15, -0.1);
          c.cyl(0.04, 0.035, 0.09, colorMat(0xf5f5f0, 0.5), 0.2, 0.85, -0.2, 14); var hdl = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI), colorMat(0xf5f5f0, 0.5)); hdl.position.set(0.24, 0.85, -0.2); hdl.rotation.y = Math.PI / 2; c.add(hdl);
          c.box(0.16, 0.01, 0.22, MAT.white, 0.5, 0.81, 0.15, { cast: false }); c.box(0.14, 0.002, 0.2, new THREE.MeshBasicMaterial({ map: signTex(['to do', 'water · feed', 'order soil', 'call supplier'], 140, 200, { size: 24, bg: '#fffbe6', color: '#333', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }) }), 0.5, 0.816, 0.15, { cast: false }); var pen = c.cyl(0.005, 0.005, 0.14, colorMat(0x2a4a8a, 0.4), 0.62, 0.815, 0.15, 6); pen.rotation.set(Math.PI / 2, 0, 0.3);
          c.box(0.24, 0.12, 0.16, MAT.plastic, -0.55, 0.86, 0.22); c.box(0.2, 0.01, 0.12, MAT.white, -0.55, 0.925, 0.22, { cast: false }); c.box(0.02, 0.01, 0.06, emitMat(0x6fdc8c, 1), -0.45, 0.925, 0.28, { cast: false });   // small printer
          c.box(0.1, 0.06, 0.04, MAT.black, -0.1, 0.5, -0.33, { cast: false }); c.cyl(0.008, 0.008, 0.5, MAT.black, -0.1, 0.25, -0.35, 5);   // cable tidy + power lead
          c.box(1.62, 0.05, 0.05, MAT.darkwood, 0, 0.755, -0.37, { cast: false });
          officeChairBuild({ box: function (w, h, d, mat, x, y, z, o) { return c.box(w, h, d, mat, x, y + 0, z + 0.75, o); }, cyl: function (rt, rb, h, mat, x, y, z, s) { return c.cyl(rt, rb, h, mat, x, y, z + 0.75, s); }, solid: function (a, b, d, e) { c.solid(a, b, d + 0.75, e + 0.75); } });
          // a name plate where the sign on a stick used to stand: a wedge of dark wood with a brass plate
          var npl = c.box(0.24, 0.06, 0.05, MAT.darkwood, 0.55, 0.835, -0.24, { r: 0.01 }); npl.rotation.x = -0.35;
          var npf = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.04), new THREE.MeshStandardMaterial({ map: signTex(['GROW CO. · OFFICE'], 420, 80, { size: 40, bold: true, bg: '#c9a24a', color: '#2a2210', titleColor: '#2a2210', line: 'rgba(60,45,10,.6)' }), roughness: 0.35, metalness: 0.7 })); npf.position.set(0.55, 0.838, -0.213); npf.rotation.x = -0.35; c.add(npf);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "officeDesk" + ": " + e.message); }
    try { growDefProp('tabletDock', { label: 'tablet dock', x: -10.4, z: 3.55, rot: 2, build: function (c) {
          // a charging plinth against the office wall: the tablet stands in the cradle, screen out, until you take it
          var body = colorMat(0x2b2f35, 0.55, 0.3);
          c.box(0.52, 0.05, 0.36, MAT.darkwood, 0, 0.93, 0, { cast: false }); c.box(0.54, 0.02, 0.38, MAT.darkwood, 0, 0.955, 0, { cast: false });
          c.box(0.44, 0.9, 0.3, body, 0, 0.47, 0.02, { cast: true }); c.box(0.56, 0.04, 0.4, MAT.metal, 0, 0.03, 0.02, { cast: false });
          c.box(0.46, 0.5, 0.02, colorMat(0x1b1f24, 0.7), 0, 0.5, -0.16, { cast: false });   /* recessed back so the plinth is not one flat slab */
          c.box(0.36, 0.035, 0.11, MAT.metal, 0, 0.965, -0.05, { cast: false });   /* the cradle lip the tablet leans in */
          var lit = hasLic('tobacco'), inDock = xs().tablet === 'dock';
          var tg = new THREE.Group(); tg.position.set(0, 0.975, -0.05); tg.rotation.x = -0.3; tg.userData.tabletBody = true; tg.userData.builtLit = lit; c.add(tg);
          var shell = new THREE.Mesh(bevelGeo(0.38, 0.28, 0.016), colorMat(0x1b1f24, 0.4, 0.5)); shell.position.y = 0.13; shell.castShadow = true; tg.add(shell);
          var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.345, 0.245), lit ? new THREE.MeshBasicMaterial({ map: signTex(['RF SMOKING', 'delivery round'], 300, 210, { size: 34, bg: '#0d1511', color: '#8fa596', titleColor: '#ffc857' }) }) : MAT.screen);
          scr.position.set(0, 0.13, 0.01); tg.add(scr);
          c.cyl(0.016, 0.016, 0.02, emitMat(lit ? 0x6fdc8c : 0xd0201a, 1.4), 0.21, 0.962, 0.1, 10);   /* charge light: green once the licence is in */
          c.sign(['DELIVERY ROUND'], 0.40, 0.072, 0, 0.74, 0.178, 0, { size: 13, titleColor: '#ffc857', bg: '#141a16' });   /* the plinth front face is at z 0.17, and the plate is only 128 px wide: one short line at 13 px is what fits */
          c.solid(-0.27, 0.27, -0.2, 0.2);
          c.hit(0.56, 0.9, 0.44, 0, 0.72, 0.02, { kind: 'tabletDock' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "tabletDock" + ": " + e.message); }
    try { growDefProp('rack', { label: 'supply rack', x: -ROOM.x + 0.45, z: -1.0, rot: 1, build: function (c) {
          // boltless steel shelving: decks with a rolled lip, punched uprights, a cross brace at the back, levelling feet
          var shelfM = MAT.steel, postM = MAT.gunmetal; for (var s = 0; s < 4; s++) { var sy = 0.25 + s * 0.55; c.box(0.9, 0.03, 0.5, shelfM, 0, sy, 0); c.box(0.9, 0.05, 0.016, postM, 0, sy - 0.006, 0.25, { cast: false }); c.box(0.9, 0.05, 0.016, postM, 0, sy - 0.006, -0.25, { cast: false }); [-0.445, 0.445].forEach(function (x) { c.box(0.016, 0.05, 0.5, postM, x, sy - 0.006, 0, { cast: false }); }); c.sign([['SOIL', 'FEED · SPRAY', 'PAPERS · BAGS', 'POTS · JARS'][s]], 0.16, 0.03, -0.32, sy - 0.006, 0.2595, 0, { size: 13, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,.3)' }); }
          [[-0.44, -0.24], [0.44, -0.24], [-0.44, 0.24], [0.44, 0.24]].forEach(function (p) { c.box(0.04, 2.0, 0.04, postM, p[0], 1.0, p[1]); for (var h = 0; h < 12; h++) c.box(0.012, 0.03, 0.042, MAT.black, p[0], 0.1 + h * 0.16, p[1], { cast: false, sharp: true }); c.cyl(0.03, 0.036, 0.024, MAT.soft, p[0], 0.012, p[1], 12); });
          [1, -1].forEach(function (sd) { var br = c.box(0.014, 1.36, 0.006, postM, 0, 1.05, -0.262, { cast: false, sharp: true }); br.rotation.z = sd * 0.68; }); c.cyl(0.012, 0.012, 0.012, MAT.chrome, 0, 1.05, -0.268, 10).rotation.x = Math.PI / 2;
          c.box(0.9, 0.03, 0.03, postM, 0, 2.0, -0.24); c.box(0.9, 0.03, 0.03, postM, 0, 2.0, 0.24);
          c.solid(-0.5, 0.5, -0.3, 0.3); c.hit(0.9, 2.0, 0.5, 0, 1.0, 0, { kind: 'inventory', label: 'Supply rack', prompt: 'Check stock' });
          c.sign(['SUPPLIES', 'soil · nutrients · spray · seeds'], 0.9, 0.3, 0, 2.2, 0.02, 0, { titleColor: '#6fdc8c' }); c.dynGroup();
        }, after: function () { syncRack(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "rack" + ": " + e.message); }
    try { growDefProp('cabinet', { label: 'filing cabinet', x: -4.6, z: 3.3, rot: 3, build: function (c) {
          // three drawers, each with a pull, a card in a holder and its own shadow gap; a lock at the top corner
          var cabM = colorMat(0x70777f, 0.4, 0.55), frontM = colorMat(0x7d848c, 0.36, 0.55); c.box(0.5, 1.16, 0.6, cabM, 0, 0.62, 0, { solid: true }); c.box(0.46, 0.04, 0.56, MAT.soft, 0, 0.02, 0, { cast: false });
          [0.24, 0.62, 1.0].forEach(function (y) { c.box(0.46, 0.35, 0.006, MAT.black, 0, y, 0.302, { cast: false, sharp: true }); c.box(0.445, 0.335, 0.024, frontM, 0, y, 0.312, { r: 0.006 }); c.box(0.2, 0.022, 0.014, MAT.black, 0, y + 0.1, 0.325, { cast: false, sharp: true }); c.box(0.2, 0.008, 0.022, MAT.chrome, 0, y + 0.113, 0.33, { cast: false, sharp: true }); c.box(0.11, 0.055, 0.004, MAT.chrome, 0, y - 0.04, 0.326, { cast: false, sharp: true }); c.box(0.098, 0.043, 0.004, MAT.white, 0, y - 0.04, 0.3275, { cast: false, sharp: true }); });
          c.cyl(0.012, 0.012, 0.008, MAT.chrome, 0.18, 1.14, 0.327, 12).rotation.x = Math.PI / 2;
          c.box(0.36, 0.006, 0.26, MAT.white, 0, 1.204, 0.05, { cast: false }); c.box(0.3, 0.02, 0.2, colorMat(0xf5f5f0), 0, 1.21, 0.05, { cast: false });   // paper tray
          c.fern(0, 0, 0.4, 1.21);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "cabinet" + ": " + e.message); }
    try { growDefProp('bookshelf', { label: 'bookshelf', x: -4.3, z: -0.9, rot: 3, build: function (c) { bookshelfBuild(c, 1.0, 1.8, 4); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bookshelf" + ": " + e.message); }
    try { growDefProp('fernOffice', { label: 'fern', x: -11.5, z: 3.4, build: function (c) { c.fern(0, 0, 1.0); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fernOffice" + ": " + e.message); }
    try { growDefProp('fernHall', { label: 'fern', x: 3.6, z: 3.5, build: function (c) { c.fern(0, 0, 0.9); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fernHall" + ": " + e.message); }
    try { growDefProp('fernLobby', { label: 'fern', x: 10.8, z: 5.0, build: function (c) { c.fern(0, 0, 1.1); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fernLobby" + ": " + e.message); }
    try { growDefProp('sofa', { label: 'sofa + coffee table', x: -2.4, z: -1.3, rot: 0, build: function (c) {
          var seatM = fabricMat(0x4a3b5c), pipeM = fabricMat(0x352a42);
          sofaBuild(c, 1.9, seatM, pipeM);
          [-0.5, 0.5].forEach(function (x) { var cu = c.box(0.4, 0.13, 0.4, fabricMat(x < 0 ? 0xe0c25a : 0x3aa36a), x, 0.62, -0.14, { r: 0.055 }); cu.rotation.set(1.05, x < 0 ? 0.2 : -0.15, 0); });
          coffeeTableBuild(c, 0, 1.15, 1.0, 0.6);
          c.box(0.3, 0.02, 0.22, new THREE.MeshBasicMaterial({ map: signTex(['GROW', 'monthly'], 150, 110, { size: 30, bg: '#6fdc8c', color: '#062010', titleColor: '#062010', line: 'rgba(0,0,0,0)' }) }), -0.15, 0.45, 1.15, { cast: false }); c.box(0.26, 0.015, 0.2, colorMat(0xffc857), -0.05, 0.462, 1.2, { cast: false }).rotation.y = 0.2;
          c.cyl(0.05, 0.04, 0.12, MAT.jar, 0.3, 0.5, 1.25); c.cyl(0.03, 0.03, 0.06, colorMat(0x8a2a2a, 0.5), 0.3, 0.47, 1.25, 10);
          var cst = c.cyl(0.14, 0.12, 0.12, colorMat(0x2a2d33, 0.5), 0.32, 0.5, 1.05, 16); c.box(0.16, 0.16, 0.16, colorMat(0x1a1c1e, 0.5), 0.32, 0.5, 1.05).visible = false;
          c.hit(2.0, 1.2, 1.0, 0, 0.6, 0, { kind: 'couch', seat: 'sofa' });
        }, after: function (c, P) { var v = growPropWorld('sofa', 0, 0.1); world.sofaSeat = { x: v.x, z: v.z, yaw: P.rot * Math.PI / 2 - Math.PI }; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "sofa" + ": " + e.message); }
    try { growDefProp('fridge', { label: 'drinks fridge', x: 3.3, z: -1.5, rot: 0, multi: { max: 3, price: 500, gap: 1.0, ico: '🧊' }, build: function (c) {
          // a shop's display fridge: a black cabinet, a lit header, light strips up both sides of a white interior, a louvred kick plate
          // and a hinged glass door in a black frame. The shelves hold what is actually in it.
          var shellM = MAT.gloss, inner = colorMat(0xf2f5f7, 0.6), frameM = colorMat(0x15181b, 0.35, 0.4);
          c.box(0.8, 1.9, 0.06, inner, 0, 0.95, -0.32, { cast: false });
          c.box(0.06, 1.9, 0.7, shellM, -0.37, 0.95, 0);
          c.box(0.06, 1.9, 0.7, shellM, 0.37, 0.95, 0);
          [-1, 1].forEach(function (sd) { c.box(0.004, 1.44, 0.6, inner, sd * 0.338, 0.97, 0, { cast: false, sharp: true }); c.lit(0xeaf6ff, 0.02, 1.4, sd * 0.334, 0.97, 0.26, -sd * Math.PI / 2); });
          c.box(0.8, 0.06, 0.7, shellM, 0, 1.87, 0, { cast: false });
          c.box(0.8, 0.22, 0.7, frameM, 0, 0.11, 0); for (var lv = 0; lv < 6; lv++) c.box(0.6, 0.012, 0.01, MAT.black, 0, 0.05 + lv * 0.026, 0.352, { cast: false, sharp: true });
          [[-0.34, -0.3], [0.34, -0.3], [-0.34, 0.3], [0.34, 0.3]].forEach(function (f) { c.cyl(0.03, 0.03, 0.02, MAT.soft, f[0], 0.005, f[1], 12); });
          c.solid(-0.42, 0.42, -0.36, 0.36);
          c.box(0.72, 0.17, 0.03, frameM, 0, 1.78, 0.345, { cast: false }); c.lit(0x0d2b3a, 0.66, 0.13, 0, 1.78, 0.3615);
          c.sign(['ICE COLD'], 0.46, 0.11, 0, 1.78, 0.366, 0, { size: 34, bold: true, bg: 'rgba(0,0,0,0)', titleColor: '#7fe0ff', line: 'rgba(0,0,0,0)' });
          c.lit(0xeaf6ff, 0.6, 0.02, 0, 1.675, 0.28, 0, Math.PI / 2);
          var door = new THREE.Group(); door.position.set(-0.35, 0.96, 0.33); c.add(door); door.userData.fridgeDoor = true;
          function fb(w, h2, d2, m, x, y, z, noCast) { var b = new THREE.Mesh(bevelGeo(w, h2, d2), m); b.position.set(x, y, z); b.castShadow = !noCast; door.add(b); return b; }
          fb(0.04, 1.5, 0.05, frameM, 0, 0, 0); fb(0.04, 1.5, 0.05, frameM, 0.7, 0, 0);
          fb(0.74, 0.04, 0.05, frameM, 0.35, 0.735, 0, true); fb(0.74, 0.04, 0.05, frameM, 0.35, -0.735, 0, true);
          var gl = new THREE.Mesh(new THREE.PlaneGeometry(0.67, 1.44), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.16, roughness: 0.02, clearcoat: 1, side: THREE.DoubleSide }));
          gl.position.set(0.35, 0, 0.004); gl.castShadow = false; door.add(gl);
          var hdl = new THREE.Mesh(roundCylGeo(0.012, 0.012, 0.5, 12), MAT.alu); hdl.position.set(0.665, 0, 0.06); door.add(hdl); [-0.2, 0.2].forEach(function (y) { var hp = new THREE.Mesh(bevelGeo(0.02, 0.02, 0.04), MAT.alu); hp.position.set(0.665, y, 0.04); door.add(hp); });
          var shelves = new THREE.Group(); c.add(shelves); shelves.userData.fridgeShelves = true; shelves.userData.slots = [];
          for (var r = 0; r < 4; r++) { var sh = new THREE.Mesh(bevelGeo(0.66, 0.014, 0.55), MAT.alu); sh.position.set(0, 0.38 + r * 0.36, 0); sh.castShadow = false; shelves.add(sh); var tag = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.028, 0.004), colorMat(0xf5f5f0, 0.6)); tag.position.set(0, 0.375 + r * 0.36, 0.278); shelves.add(tag); }
          c.light(new THREE.PointLight(0xbfe8ff, 0.55, 2.6), 0, 1.45, 0.15);
          c.hit(0.82, 1.9, 0.72, 0, 0.95, 0, { kind: 'fridge' });
        }, after: function (c, P, inst, id) { syncFridge(id); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fridge" + ": " + e.message); }
    try { growDefProp('coffeeBar', { label: 'coffee bar', x: 1.2, z: -1.7, rot: 0, build: function (c) {
          c.box(1.2, 0.9, 0.5, MAT.darkwood, 0, 0.45, 0, { solid: true }); c.box(1.26, 0.04, 0.56, MAT.counterTop, 0, 0.92, 0, { cast: false }); c.box(1.2, 0.06, 0.02, MAT.chrome, 0, 0.03, 0.25, { cast: false });
          drawer(c, 0.5, 0.2, 0.02, -0.3, 0.7, 0.24); drawer(c, 0.5, 0.2, 0.02, 0.3, 0.7, 0.24);
          // the espresso machine: a polished body on four feet, a group head with its portafilter, a steam wand, a gauge, and cups warming on top
          var body = MAT.steel, dark = MAT.gloss;
          c.box(0.36, 0.3, 0.3, body, -0.28, 1.13, -0.04, { r: 0.02 }); c.box(0.36, 0.05, 0.34, dark, -0.28, 1.3, -0.03, { r: 0.012 }); c.box(0.36, 0.04, 0.32, dark, -0.28, 0.975, -0.03); [[-0.43, -0.16], [-0.13, -0.16], [-0.43, 0.1], [-0.13, 0.1]].forEach(function (f) { c.cyl(0.018, 0.022, 0.03, MAT.chrome, f[0], 0.952, f[1], 10); });
          c.box(0.3, 0.012, 0.13, MAT.chrome, -0.28, 0.958, 0.14, { cast: false }); for (var gs = 0; gs < 7; gs++) c.box(0.28, 0.006, 0.006, MAT.black, -0.28, 0.966, 0.085 + gs * 0.018, { cast: false, sharp: true });   /* drip tray */
          c.cyl(0.034, 0.038, 0.04, MAT.chrome, -0.34, 1.1, 0.13, 16); c.cyl(0.036, 0.03, 0.022, MAT.chrome, -0.34, 1.07, 0.13, 16); var pf = c.box(0.022, 0.018, 0.14, MAT.black, -0.34, 1.07, 0.22, { r: 0.006 });   /* group head, portafilter and its handle */
          var wand = c.cyl(0.006, 0.006, 0.16, MAT.chrome, -0.15, 1.06, 0.14, 8); wand.rotation.z = -0.25; c.cyl(0.014, 0.014, 0.03, MAT.soft, -0.17, 1.14, 0.14, 10);
          c.cyl(0.03, 0.03, 0.012, MAT.chrome, -0.22, 1.2, 0.113, 18).rotation.x = Math.PI / 2; c.cyl(0.025, 0.025, 0.004, MAT.white, -0.22, 1.2, 0.121, 18).rotation.x = Math.PI / 2; c.box(0.003, 0.02, 0.002, colorMat(0xc0271b, 0.5), -0.215, 1.206, 0.124, { cast: false, sharp: true }).rotation.z = -0.6;
          c.lit(0xff5040, 0.012, 0.012, -0.4, 1.2, 0.112); c.lit(0x6fdc8c, 0.012, 0.012, -0.37, 1.2, 0.112);
          [[-0.38, 0], [-0.3, 0.02], [-0.22, -0.01], [-0.34, -0.1]].forEach(function (p, i) { c.cyl(0.034, 0.026, 0.06, MAT.ceramic, p[0], 1.355, p[1] - 0.04, 16); });
          // the grinder beside it, with beans in the hopper
          c.box(0.13, 0.26, 0.17, dark, -0.0, 1.07, -0.08, { r: 0.015 }); c.cyl(0.075, 0.045, 0.13, MAT.jar, 0.0, 1.27, -0.08, 18); c.cyl(0.062, 0.04, 0.08, colorMat(0x3a2210, 1), 0.0, 1.255, -0.08, 14); c.cyl(0.078, 0.078, 0.014, dark, 0.0, 1.342, -0.08, 18); c.box(0.06, 0.012, 0.08, MAT.chrome, 0.0, 1.0, 0.03, { cast: false });
          for (var cI = 0; cI < 4; cI++) { var mc = [0xf5f5f0, 0x6fdc8c, 0xffc857, 0x9ad0ff][cI]; c.cyl(0.035, 0.03, 0.08, colorMat(mc, 0.3), 0.16 + cI * 0.095, 0.98, 0.1, 16); var hd = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 12, Math.PI), colorMat(mc, 0.3)); hd.position.set(0.195 + cI * 0.095, 0.98, 0.1); hd.rotation.z = -Math.PI / 2; c.add(hd); }
          c.cyl(0.06, 0.05, 0.16, MAT.jar, 0.47, 1.02, -0.12, 18); c.cyl(0.05, 0.045, 0.1, colorMat(0x4a2a12, 1), 0.47, 0.995, -0.12, 14); c.cyl(0.062, 0.062, 0.015, MAT.jarLid, 0.47, 1.108, -0.12, 18);
          c.box(0.1, 0.12, 0.07, MAT.ceramic, 0.3, 1.0, -0.15, { r: 0.012 }); c.sign(['sugar'], 0.08, 0.04, 0.3, 1.0, -0.114, 0, { size: 20, bg: 'rgba(0,0,0,0)', color: '#333', titleColor: '#333', line: 'rgba(0,0,0,0)' });
          c.placard(['COFFEE', 'help yourself'], 0.42, 0.16, 0.36, 1.22, 0.2, { titleColor: '#ffc857' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "coffeeBar" + ": " + e.message); }
    try { growDefProp('waterCooler', { label: 'water cooler', x: -3.6, z: 3.5, rot: 3, build: function (c) {
          // a white tower with a dark alcove the cups stand in, two taps over a gridded drip tray, the bottle upside down on top, a cup tube on the side
          var white = colorMat(0xeef0f2, 0.35, 0.05), grey = colorMat(0xc9cdd2, 0.4, 0.1);
          c.box(0.34, 0.92, 0.34, white, 0, 0.47, 0, { r: 0.03 }); c.box(0.36, 0.03, 0.36, MAT.soft, 0, 0.015, 0, { cast: false }); c.box(0.3, 0.26, 0.02, colorMat(0x1a1d21, 0.5), 0, 0.68, 0.168, { cast: false }); c.box(0.26, 0.012, 0.11, grey, 0, 0.555, 0.2, { cast: false }); for (var gs = 0; gs < 6; gs++) c.box(0.24, 0.005, 0.006, MAT.black, 0, 0.563, 0.158 + gs * 0.017, { cast: false, sharp: true });
          [[-0.06, 0x3a7fd6], [0.06, 0xd63a2a]].forEach(function (t) { c.box(0.028, 0.05, 0.05, grey, t[0], 0.77, 0.2, { r: 0.006 }); c.box(0.034, 0.018, 0.04, colorMat(t[1], 0.4), t[0], 0.805, 0.205, { r: 0.005 }); c.cyl(0.008, 0.008, 0.03, MAT.chrome, t[0], 0.735, 0.21, 8); });
          c.lit(0x6fdc8c, 0.01, 0.01, 0.12, 0.86, 0.1715); c.lit(0xff5040, 0.01, 0.01, 0.1, 0.86, 0.1715);
          c.cyl(0.11, 0.13, 0.05, grey, 0, 0.95, 0, 24);
          var bottle = new THREE.Mesh(roundCylGeo(0.14, 0.14, 0.4, 28), MAT.jar); bottle.position.set(0, 1.19, 0); c.add(bottle); c.cyl(0.14, 0.06, 0.07, MAT.jar, 0, 0.965, 0, 24); [1.08, 1.22].forEach(function (y) { var rib = new THREE.Mesh(new THREE.TorusGeometry(0.141, 0.006, 6, 28), MAT.jar); rib.rotation.x = Math.PI / 2; rib.position.y = y; c.add(rib); });
          var water = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.3, 24), new THREE.MeshPhysicalMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.55, roughness: 0.1 })); water.position.set(0, 1.15, 0); c.add(water);
          var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.34, 14, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide })); tube.position.set(-0.205, 0.72, 0.08); c.add(tube); for (var k = 0; k < 6; k++) c.cyl(0.03, 0.025, 0.05, colorMat(0xffffff, 0.6), -0.205, 0.59 + k * 0.045, 0.08, 12); c.box(0.02, 0.3, 0.05, grey, -0.18, 0.72, 0.08, { cast: false });
          c.hit(0.5, 1.5, 0.5, 0, 0.75, 0, { kind: 'cooler' }); c.solid(-0.2, 0.2, -0.2, 0.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "waterCooler" + ": " + e.message); }
    try { growDefProp('bench', { label: 'workbench', x: ROOM.x - 0.6, z: 1.0, rot: 3, build: function (c) {
          // bench runs along local x, the working side faces +z (into the room after rot 3); tools on the back rail
          c.box(2.4, 0.06, 0.8, MAT.wood, 0, 0.9, 0, { solid: true }); c.box(2.4, 0.85, 0.7, MAT.darkwood, 0, 0.45, 0, { cast: false }); c.box(2.4, 0.03, 0.03, MAT.chrome, 0, 0.93, 0.4, { cast: false });
          drawer(c, 0.5, 0.2, 0.02, -0.9, 0.7, 0.34); drawer(c, 0.5, 0.2, 0.02, -0.3, 0.7, 0.34); c.box(0.9, 0.5, 0.02, MAT.wood, 0.6, 0.45, 0.34, { cast: false }); c.box(0.12, 0.018, 0.02, MAT.chrome, 0.6, 0.55, 0.36, { cast: false });
          c.hit(2.4, 0.02, 0.8, 0, 0.93, 0, { kind: 'bench', label: 'Workbench', prompt: 'Grind, bag & roll' });
          var mat = c.box(0.7, 0.01, 0.45, MAT.black, 0, 0.935, 0.05, { cast: false }); interactable(mat, { kind: 'bench', label: 'Workbench', prompt: 'Grind, bag & roll' }); c.box(0.68, 0.002, 0.43, colorMat(0x2a2d33, 0.9), 0, 0.941, 0.05, { cast: false });
          // stool, back rail with tools, a lamp, a scale, a tray of tips
          c.cyl(0.18, 0.18, 0.06, fabricMat(0x24272c), -1.0, 0.57, 0.65, 24); c.cyl(0.16, 0.16, 0.02, MAT.black, -1.0, 0.535, 0.65, 24); c.cyl(0.024, 0.024, 0.52, MAT.chrome, -1.0, 0.27, 0.65, 12); var fr = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 8, 28), MAT.chrome); fr.rotation.x = Math.PI / 2; fr.position.set(-1.0, 0.24, 0.65); c.add(fr); [0, 1.57].forEach(function (a) { c.box(0.3, 0.012, 0.012, MAT.chrome, -1.0, 0.24, 0.65, { sharp: true, cast: false }).rotation.y = a; }); c.cyl(0.19, 0.21, 0.025, MAT.chrome, -1.0, 0.0125, 0.65, 28); c.solid(-1.2, -0.8, 0.45, 0.85);
          c.box(2.44, 0.54, 0.02, MAT.darkwood, 0, 1.35, -0.392, { cast: false }); c.box(0.16, 0.1, 0.12, MAT.gunmetal, 1.12, 0.98, 0.3, { r: 0.012 }); c.box(0.05, 0.11, 0.13, MAT.gunmetal, 1.12, 0.985, 0.42); c.cyl(0.008, 0.008, 0.22, MAT.chrome, 1.12, 0.96, 0.44, 8).rotation.x = Math.PI / 2; c.cyl(0.006, 0.006, 0.12, MAT.chrome, 1.12, 0.96, 0.545, 8).rotation.z = Math.PI / 2;   /* the pegboard's frame, and a vise on the corner */
          c.box(2.4, 0.5, 0.03, colorMat(0x8a6a4a, 0.9), 0, 1.35, -0.38); for (var px = -1.1; px <= 1.1; px += 0.08) for (var py = 1.15; py <= 1.55; py += 0.08) { var hole = c.cyl(0.005, 0.005, 0.04, MAT.black, px, py, -0.38, 5); hole.rotation.x = Math.PI / 2; }
          var sc = c.cyl(0.006, 0.006, 0.2, MAT.chrome, -0.9, 1.35, -0.35, 6); sc.rotation.z = 0.4; var sc2 = c.cyl(0.006, 0.006, 0.2, MAT.chrome, -0.9, 1.35, -0.35, 6); sc2.rotation.z = -0.4; c.cyl(0.02, 0.02, 0.01, colorMat(0xc94a3a, 0.5), -0.9, 1.25, -0.35, 8);   // scissors
          c.box(0.03, 0.22, 0.01, MAT.chrome, -0.6, 1.35, -0.35); c.box(0.04, 0.06, 0.012, MAT.black, -0.6, 1.25, -0.35);   // knife
          [0.3, 0.45, 0.6].forEach(function (x, i) { c.cyl(0.022, 0.022, 0.16, colorMat([0xd9ff5a, 0xffffff, 0x3ad0ff][i], 0.5), x, 1.24, -0.34, 10); });   // bottles on the rail
          c.box(0.3, 0.03, 0.3, MAT.metal, -0.75, 0.945, -0.1); c.box(0.12, 0.03, 0.08, MAT.black, -0.75, 0.96, 0.06); c.box(0.08, 0.002, 0.03, MAT.screen, -0.75, 0.976, 0.06, { cast: false });   // scale
          c.cyl(0.07, 0.075, 0.02, MAT.gunmetal, 1.05, 0.94, -0.3, 20); var ba1 = c.box(0.018, 0.5, 0.018, MAT.alu, 1.0, 1.18, -0.3, { sharp: true }); ba1.rotation.z = 0.2; var ba2 = c.box(0.018, 0.42, 0.018, MAT.alu, 0.83, 1.5, -0.24, { sharp: true }); ba2.rotation.z = 1.0; ba2.rotation.y = -0.3; c.cyl(0.014, 0.014, 0.034, MAT.soft, 0.95, 1.42, -0.3, 10).rotation.x = Math.PI / 2;
          var bsh = c.box(0.3, 0.02, 0.07, MAT.gunmetal, 0.62, 1.44, -0.16, { r: 0.006 }); bsh.rotation.z = 0.12; c.lit(0xfff0cc, 0.27, 0.05, 0.62, 1.4285, -0.16, 0, Math.PI / 2).rotation.z = 0; c.light(new THREE.PointLight(0xfff0d0, 0.4, 2.6), 0.62, 1.3, -0.05);
          c.box(0.2, 0.03, 0.14, MAT.plastic, 0.9, 0.945, 0.15); for (var t = 0; t < 8; t++) c.cyl(0.006, 0.006, 0.03, colorMat(0xd8c8a0, 0.8), 0.83 + (t % 4) * 0.045, 0.975, 0.12 + Math.floor(t / 4) * 0.06, 5);   // tip tray
          c.placard(['PROCESSING', 'grind · bag · roll'], 0.6, 0.2, -0.95, 1.1, 0.2, { titleColor: '#ffc857' }); c.dynGroup();
        }, after: function () { syncShelf(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bench" + ": " + e.message); }
    try { growDefProp('trash', { label: 'bin', x: ROOM.x - 0.6, z: -1.4, build: function (c) {
          // a brushed steel pedal bin: a black foot ring, a band round the rim, a domed lid on a hinge at the back, a pedal at the front
          c.cyl(0.17, 0.155, 0.5, MAT.steel, 0, 0.26, 0, 28); c.cyl(0.162, 0.168, 0.03, MAT.soft, 0, 0.015, 0, 28); c.cyl(0.176, 0.176, 0.025, MAT.chrome, 0, 0.5, 0, 28); c.box(0.09, 0.012, 0.07, MAT.soft, 0, 0.02, 0.2, { cast: false }); c.box(0.02, 0.012, 0.08, MAT.chrome, 0, 0.03, 0.15, { cast: false, sharp: true });
          var lidG = new THREE.Group(); lidG.position.set(0, 0.515, -0.17); c.add(lidG);   /* hinged at the back edge so E can lift it */ var lidTop = new THREE.Mesh(new THREE.SphereGeometry(0.182, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.steel); lidTop.scale.y = 0.28; lidTop.position.z = 0.17; lidTop.castShadow = true; lidG.add(lidTop); var knob = new THREE.Mesh(roundCylGeo(0.18, 0.18, 0.012, 28), MAT.chrome); knob.position.set(0, -0.004, 0.17); lidG.add(knob); var hinge = new THREE.Mesh(roundCylGeo(0.012, 0.012, 0.1, 10), MAT.soft); hinge.rotation.z = Math.PI / 2; lidG.add(hinge);
          var hm = c.hit(0.5, 0.75, 0.5, 0, 0.36, 0, { kind: 'trash' }); (world.trashLids = world.trashLids || {})[hm.userData.propId] = lidG; c.solid(-0.2, 0.2, -0.2, 0.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "trash" + ": " + e.message); }
    try { growDefProp('crates', { label: 'crates', x: 5.3, z: -1.4, build: function (c) { crateBuild(c, -0.3, 0, 0); crateBuild(c, -0.3, 0.5, 0, 0.5); crateBuild(c, 0.3, 0, 0.05); c.solid(-0.6, 0.6, -0.3, 0.35); c.sign(['FRAGILE'], 0.3, 0.1, 0.3, 0.35, 0.33, 0, { size: 30, bg: '#f0e0c0', color: '#c9302c', titleColor: '#c9302c', line: 'rgba(0,0,0,0)' }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "crates" + ": " + e.message); }
    try { growDefProp('cureShelf', { label: 'curing shelf', x: 6.5, z: -ROOM.z + 0.35, rot: 0, build: function (c) {
          for (var i = 0; i < 4; i++) { c.box(3.0, 0.04, 0.4, MAT.wood, 0, 0.5 + i * 0.55, 0); c.box(3.0, 0.04, 0.02, MAT.darkwood, 0, 0.5 + i * 0.55, 0.2, { cast: false }); }
          c.box(0.06, 2.3, 0.4, MAT.darkwood, -1.5, 1.15, 0); c.box(0.06, 2.3, 0.4, MAT.darkwood, 1.5, 1.15, 0); c.box(0.06, 2.3, 0.4, MAT.darkwood, 0, 1.15, 0); c.box(3.0, 2.3, 0.02, colorMat(0x2a1c10, 0.8), 0, 1.15, -0.19, { cast: false }); c.solid(-1.5, 1.5, -0.2, 0.25);
          c.hit(3.0, 2.3, 0.5, 0, 1.15, 0, { kind: 'shelf', label: 'Curing shelf', prompt: 'Curing jars' });
          for (var s = 0; s < 4; s++) c.sign([['SHELF A', 'SHELF B', 'SHELF C', 'SHELF D'][s]], 0.3, 0.06, 1.3, 0.48 + s * 0.55, 0.212, 0, { size: 24, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,.3)' });
          var hyg = c.box(0.14, 0.09, 0.02, MAT.white, -1.3, 2.0, 0.2); c.sign(['62% RH'], 0.1, 0.05, -1.3, 2.0, 0.212, 0, { size: 28, bg: '#101410', titleColor: '#6fdc8c', line: 'rgba(0,0,0,0)' });
          c.sign(['CURING SHELF', 'jars gain quality while they sit'], 1.4, 0.4, 0, 2.55, 0.05, 0, { titleColor: '#6fdc8c' }); c.dynGroup();
        }, after: function () { syncShelf(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "cureShelf" + ": " + e.message); }
    try { growDefProp('dryRack', { label: 'drying line', x: 6.25, z: -5.2, rot: 0, build: function (c) {
          var hw = 3.25, ly = 2.1;
          [-hw, hw].forEach(function (px) { c.box(0.08, ly + 0.1, 0.08, MAT.wood, px, (ly + 0.1) / 2, 0); c.box(0.7, 0.06, 0.12, MAT.wood, px, 0.03, 0); c.box(0.12, 0.06, 0.7, MAT.wood, px, 0.03, 0); var b1 = c.box(0.06, 0.9, 0.06, MAT.wood, px, 0.55, 0.28); b1.rotation.x = 0.55; var b2 = c.box(0.06, 0.9, 0.06, MAT.wood, px, 0.55, -0.28); b2.rotation.x = -0.55; c.box(0.1, 0.1, 0.1, MAT.plastic, px, ly, 0); c.solid(px - 0.36, px + 0.36, -0.36, 0.36); });
          var bar = new THREE.Mesh(roundCylGeo(0.03, 0.03, hw * 2, 12), MAT.wood); bar.rotation.z = Math.PI / 2; bar.position.set(0, ly, 0); bar.castShadow = true; c.add(bar);
          var wire = new THREE.Mesh(roundCylGeo(0.008, 0.008, hw * 2, 6), MAT.metal); wire.rotation.z = Math.PI / 2; wire.position.set(0, ly - 0.12, 0); c.add(wire);
          for (var pg = 0; pg < 12; pg++) c.box(0.02, 0.06, 0.015, colorMat(0xd9c9a0, 0.9), -hw + 0.3 + pg * 0.55, ly - 0.14, 0, { cast: false });
          c.hit(hw * 2, 0.9, 0.3, 0, ly - 0.4, 0, { kind: 'line', label: 'Drying line', prompt: 'Hang harvests here' });
          // a clip fan on the post keeps the air moving
          var fanG = new THREE.Group(); fanG.position.set(-hw + 0.1, 1.4, 0.1); fanG.rotation.y = 0.8; c.add(fanG); var fb = new THREE.Mesh(roundCylGeo(0.1, 0.1, 0.06, 16), MAT.plastic); fb.rotation.x = Math.PI / 2; fanG.add(fb); var cage = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 24), MAT.chrome); cage.position.z = 0.05; fanG.add(cage); var blades = new THREE.Group(); blades.position.z = 0.04; fanG.add(blades); for (var b = 0; b < 3; b++) { var blm = new THREE.Mesh(bevelGeo(0.05, 0.14, 0.004), colorMat(0xe0e0e0, 0.5)); blm.position.y = 0.08; var hold = new THREE.Group(); hold.rotation.z = b * Math.PI * 2 / 3; hold.add(blm); blades.add(hold); } c.box(0.06, 0.1, 0.08, MAT.plastic, -hw + 0.06, 1.3, 0.02); world.clipFan = blades;
          c.sign(['DRYING LINE', 'hang fresh harvests here · ~45 s'], 1.4, 0.4, 0, ly + 0.35, 0, 0, { titleColor: '#6fdc8c' }); c.dynGroup();
        }, after: function () { syncShelf(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "dryRack" + ": " + e.message); }
    try { growDefProp('dryTable', { label: 'scale table', x: 1.2, z: -3.2, rot: 0, build: function (c) { c.box(0.9, 0.05, 0.6, MAT.wood, 0, 0.78, 0, { solid: true }); legs4(c, 0.9, 0.6, 0.76, MAT.metal); c.box(0.3, 0.03, 0.3, MAT.metal, 0, 0.82, 0); c.box(0.12, 0.025, 0.08, MAT.black, 0, 0.85, 0.15); c.box(0.08, 0.002, 0.03, MAT.screen, 0, 0.864, 0.15, { cast: false }); c.box(0.2, 0.01, 0.28, MAT.white, -0.3, 0.81, 0.05, { cast: false }); c.cyl(0.005, 0.005, 0.12, colorMat(0x2a4a8a, 0.4), -0.25, 0.815, 0.1, 6).rotation.set(Math.PI / 2, 0, 0.5); c.cyl(0.06, 0.06, 0.14, MAT.jar, 0.3, 0.88, -0.15, 12); c.cyl(0.062, 0.062, 0.015, MAT.jarLid, 0.3, 0.955, -0.15, 12); c.box(0.16, 0.1, 0.16, colorMat(0xe8e8ee, 0.6), 0.32, 0.86, 0.15); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "dryTable" + ": " + e.message); }
    try { growDefProp('jarBoxes', { label: 'jar boxes', x: 10.6, z: -8.2, build: function (c) { var bxM = colorMat(0xc8a97a, 1); [[0.3, 0, 0], [0.3, 0, 0.42], [-0.3, 0, 0]].forEach(function (b) { c.box(0.5, 0.4, 0.5, bxM, b[0], 0.2 + b[2], b[1], { solid: b[2] === 0 }); c.box(0.52, 0.03, 0.52, colorMat(0xb08c5a, 1), b[0], 0.4 + b[2], b[1], { cast: false }); c.box(0.5, 0.06, 0.02, colorMat(0xb08c5a, 1), b[0], 0.2 + b[2], b[1] + 0.25, { cast: false }); c.sign(['JARS ×12'], 0.3, 0.08, b[0], 0.15 + b[2], b[1] + 0.26, 0, { size: 24, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,.3)' }); }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "jarBoxes" + ": " + e.message); }
    try { growDefProp('hose', { label: 'hose reel + watering can', x: -ROOM.x + 0.55, z: -3.0, rot: 1, build: function (c) {
          c.box(0.5, 0.06, 0.5, MAT.metal, -0.15, 0.03, 0); c.box(0.06, 1.8, 0.06, MAT.metal, -0.15, 0.9, 0); c.box(0.2, 0.06, 0.06, MAT.metal, -0.15, 1.1, -0.15);
          var reel = c.cyl(0.28, 0.28, 0.14, colorMat(0x2f7a34, 0.6), -0.15, 1.1, 0.08); reel.rotation.x = Math.PI / 2; for (var r = 0; r < 5; r++) { var loop = new THREE.Mesh(new THREE.TorusGeometry(0.2 + r * 0.015, 0.012, 6, 24), colorMat(0x3a8f40, 0.7)); loop.position.set(-0.15, 1.1, 0.08 + (r - 2) * 0.03); c.add(loop); }
          var hub = c.cyl(0.16, 0.16, 0.18, MAT.metal, -0.15, 1.1, 0.08); hub.rotation.x = Math.PI / 2; var crank = c.box(0.03, 0.14, 0.03, MAT.black, -0.06, 1.17, 0.19); var knob = c.cyl(0.015, 0.015, 0.08, MAT.plastic, -0.06, 1.24, 0.23, 8); knob.rotation.x = Math.PI / 2;
          var nozzle = c.cyl(0.02, 0.03, 0.14, colorMat(0xffc857, 0.4), -0.35, 0.6, 0.1, 8); nozzle.rotation.z = 0.5; var hoseTail = c.cyl(0.012, 0.012, 0.5, colorMat(0x3a8f40, 0.7), -0.3, 0.82, 0.1, 6); hoseTail.rotation.z = 0.3;
          var tap = c.box(0.06, 0.06, 0.06, MAT.chrome, -0.15, 0.45, -0.28); var wheel = c.cyl(0.04, 0.04, 0.02, colorMat(0xc94a3a, 0.5), -0.15, 0.5, -0.28, 12);
          var canM = colorMat(0x3a8fd6, 0.45, 0.35);
          c.cyl(0.13, 0.15, 0.3, canM, 0.35, 0.15, 0.1, 20); c.cyl(0.14, 0.14, 0.02, colorMat(0x2a6fb0, 0.45, 0.35), 0.35, 0.3, 0.1, 20); c.cyl(0.05, 0.05, 0.04, canM, 0.35, 0.32, 0.1, 12);
          var spout = c.cyl(0.018, 0.028, 0.36, canM, 0.55, 0.3, 0.1, 8); spout.rotation.z = -0.95; var rose = c.cyl(0.05, 0.035, 0.05, canM, 0.69, 0.42, 0.1, 12); rose.rotation.z = -0.95; c.cyl(0.048, 0.048, 0.01, colorMat(0x8a8f96, 0.5, 0.5), 0.71, 0.435, 0.1, 12).rotation.z = -0.95;
          var handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 8, 20, Math.PI), canM); handle.position.set(0.35, 0.3, 0.1); c.add(handle); var handle2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 16, Math.PI * 0.6), canM); handle2.position.set(0.26, 0.2, 0.1); handle2.rotation.z = Math.PI * 0.35; c.add(handle2);
          c.hit(0.5, 0.55, 0.5, 0.35, 0.27, 0.1, { kind: 'water', label: 'Watering can', prompt: 'Water a plant' }); c.solid(-0.4, 0.15, -0.3, 0.3);
          c.sign(['WATER', 'grab the can · E on a plant'], 0.6, 0.2, -0.15, 1.68, 0.1, 0, { titleColor: '#6fc3ff' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "hose" + ": " + e.message); }
    try { growDefProp('fan', { label: 'floor fan', x: -2.0, z: -7.9, rot: 0, build: function (c) {
          var fbase = new THREE.Mesh(roundCylGeo(0.2, 0.22, 0.04, 20), MAT.black); fbase.position.y = 0.02; c.add(fbase); c.box(0.06, 0.03, 0.06, colorMat(0x8a8f96, 0.5), 0.1, 0.05, 0.1, { cast: false });
          var fpole = new THREE.Mesh(roundCylGeo(0.02, 0.02, 0.9, 10), MAT.chrome); fpole.position.y = 0.47; c.add(fpole); c.cyl(0.03, 0.03, 0.05, MAT.plastic, 0, 0.5, 0, 10);
          world.fanHead = new THREE.Group(); world.fanHead.position.y = 0.95; c.add(world.fanHead);
          var motor = new THREE.Mesh(roundCylGeo(0.06, 0.06, 0.16, 14), MAT.plastic); motor.rotation.x = Math.PI / 2; motor.position.z = -0.1; world.fanHead.add(motor);
          world.fanHead.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 28), MAT.chrome)); var cageBack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 28, 1, true), MAT.chrome); cageBack.rotation.x = Math.PI / 2; cageBack.position.z = -0.05; world.fanHead.add(cageBack);
          for (var w = 0; w < 12; w++) { var wire = new THREE.Mesh(bevelGeo(0.004, 0.44, 0.004), MAT.chrome); wire.rotation.z = w * Math.PI / 12; wire.position.z = 0.02; world.fanHead.add(wire); }
          var hubc = new THREE.Mesh(roundCylGeo(0.03, 0.03, 0.03, 12), MAT.plastic); hubc.rotation.x = Math.PI / 2; hubc.position.z = 0.02; world.fanHead.add(hubc);
          world.fanBlades = new THREE.Group(); world.fanHead.add(world.fanBlades);
          for (var b = 0; b < 3; b++) { var bl = new THREE.Mesh(bevelGeo(0.08, 0.19, 0.005), colorMat(0xdddddd, 0.5)); bl.position.y = 0.1; bl.rotation.y = 0.3; var holder = new THREE.Group(); holder.rotation.z = b * Math.PI * 2 / 3; holder.add(bl); world.fanBlades.add(holder); }
          c.solid(-0.22, 0.22, -0.22, 0.22);
        }, after: function (c, P) { world.fanBaseYaw = Math.atan2(TENT_ORIGIN.x - P.x, TENT_ORIGIN.z - P.z) - P.rot * Math.PI / 2; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fan" + ": " + e.message); }
    try { growDefProp('soilSacks', { label: 'soil sacks', x: -11.3, z: -5.2, build: function (c) { var sackM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x5a3a22, roughness: 1 }); [[0, 0, 0, 0.1], [0, 0, 0.3, -0.2], [0.55, 0, 0, 0.3]].forEach(function (b) { var s = c.box(0.5, 0.28, 0.35, sackM, b[0], 0.14 + b[2], b[1], { solid: b[2] === 0, r: 0.09 }); s.rotation.y = b[3]; c.sign(['POTTING SOIL', '25 L'], 0.3, 0.12, b[0], 0.14 + b[2], b[1] + 0.176, b[3], { size: 26, bg: '#e8dcc0', color: '#3a2a1a', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }); }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "soilSacks" + ": " + e.message); }
    try { growDefProp('bucket', { label: 'bucket', x: -11.2, z: -3.9, build: function (c) { c.cyl(0.16, 0.13, 0.3, colorMat(0x2f7a34, 0.6), 0, 0.15, 0); c.cyl(0.165, 0.165, 0.02, colorMat(0x255f2a, 0.6), 0, 0.3, 0); var hd = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 20, Math.PI), MAT.chrome); hd.position.y = 0.3; hd.rotation.z = 0; c.add(hd); c.cyl(0.14, 0.14, 0.01, new THREE.MeshPhysicalMaterial({ color: 0x6fb0e0, transparent: true, opacity: 0.6 }), 0, 0.25, 0, 20); c.solid(-0.2, 0.2, -0.2, 0.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bucket" + ": " + e.message); }
    try { growDefProp('potShelf', { label: 'pot shelf', x: -9.5, z: -ROOM.z + 0.3, rot: 0, build: function (c) { [0.4, 1.0, 1.6].forEach(function (y) { c.box(1.2, 0.03, 0.3, MAT.wood, 0, y, 0); c.box(1.2, 0.03, 0.02, MAT.darkwood, 0, y, 0.15, { cast: false }); }); [-0.55, 0.55].forEach(function (x) { c.box(0.04, 1.7, 0.3, MAT.metal, x, 0.85, 0); }); for (var p = 0; p < 3; p++) { for (var st = 0; st < 3; st++) { c.cyl(0.12 - st * 0.01, 0.09, 0.14, MAT.pot, -0.4 + p * 0.4, 1.69 + st * 0.03, 0, 16); } c.cyl(0.12, 0.09, 0.16, MAT.pot, -0.4 + p * 0.4, 1.1, 0, 16); c.cyl(0.125, 0.125, 0.02, MAT.pot, -0.4 + p * 0.4, 1.18, 0, 16); } c.box(0.3, 0.2, 0.2, colorMat(0xe8e8ee, 0.6), -0.3, 0.52, 0); c.cyl(0.08, 0.08, 0.2, MAT.jar, 0.3, 0.52, 0, 12); c.sign(['POTS', 'spares'], 0.4, 0.12, 0, 1.85, 0.02, 0, { titleColor: '#6fdc8c' }); c.solid(-0.6, 0.6, -0.15, 0.15); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "potShelf" + ": " + e.message); }
    try { growDefProp('tent', { label: 'grow tent', x: -6.6, z: -6.1, rot: 0, build: function (c, P) { TENT_ORIGIN.x = P.x; TENT_ORIGIN.z = P.z; buildTent(); if (world.tentGroup) world.tentGroup.traverse(function (o) { if (o.isMesh) o.userData.propId = 'tent'; }); }, after: function () { if (propInst.fan) { var f = propInst.fan; world.fanBaseYaw = Math.atan2(TENT_ORIGIN.x - f.P.x, TENT_ORIGIN.z - f.P.z) - f.P.rot * Math.PI / 2; } } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "tent" + ": " + e.message); }
    try { growDefProp('lobbyBenchL', { label: 'lobby bench', x: -8.5, z: 8.2, rot: 2, build: lobbyBench }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "lobbyBenchL" + ": " + e.message); }
    try { growDefProp('lobbyBenchR', { label: 'lobby bench', x: 8.5, z: 8.2, rot: 2, build: lobbyBench }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "lobbyBenchR" + ": " + e.message); }
    try { growDefProp('magTable', { label: 'magazine table', x: -6.6, z: 7.6, build: function (c) { c.cyl(0.32, 0.32, 0.03, MAT.wood, 0, 0.45, 0, 24); c.cyl(0.03, 0.03, 0.44, MAT.chrome, 0, 0.22, 0, 10); c.cyl(0.2, 0.22, 0.02, MAT.chrome, 0, 0.01, 0, 24); c.box(0.3, 0.01, 0.22, new THREE.MeshBasicMaterial({ map: signTex(['HIGH', 'times'], 150, 110, { size: 34, bg: '#6fdc8c', color: '#062010', titleColor: '#062010', line: 'rgba(0,0,0,0)' }) }), -0.05, 0.47, 0, { cast: false }); c.box(0.3, 0.01, 0.22, new THREE.MeshBasicMaterial({ map: signTex(['GROW', 'weekly'], 150, 110, { size: 34, bg: '#ffc857', color: '#332200', titleColor: '#332200', line: 'rgba(0,0,0,0)' }) }), 0.1, 0.48, -0.05, { cast: false }).rotation.y = 0.3; c.solid(-0.33, 0.33, -0.33, 0.33); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "magTable" + ": " + e.message); }
    try { growDefProp('queueRope', { label: 'rope line', x: 0.35, z: 7.45, rot: 0, multi: { max: 8, price: 40, gap: 2.2, ico: '🪢', name: 'Rope line' }, build: ropeBuild }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "queueRope" + ": " + e.message); }
    try { growDefProp('lobbyPlant', { label: 'lobby plant', x: -10.5, z: 5.0, build: function (c) {
          // a rubber plant in a tall charcoal planter: a woody stem, glossy leaves climbing it in a spiral
          c.cyl(0.26, 0.2, 0.5, colorMat(0x2a2d33, 0.35, 0.1), 0, 0.26, 0, 32); c.cyl(0.275, 0.262, 0.04, colorMat(0x1f2226, 0.35, 0.1), 0, 0.5, 0, 32); c.cyl(0.21, 0.21, 0.025, MAT.soft, 0, 0.0125, 0, 28); c.cyl(0.24, 0.24, 0.02, MAT.soil, 0, 0.51, 0, 24);
          c.cyl(0.014, 0.024, 1.1, MAT.bark, 0, 1.05, 0, 10); c.cyl(0.01, 0.014, 0.5, MAT.bark, 0.05, 1.5, 0.02, 8).rotation.z = -0.22; c.cyl(0.01, 0.014, 0.45, MAT.bark, -0.05, 1.35, -0.03, 8).rotation.z = 0.3;
          for (var i = 0; i < 18; i++) { var a = i * 2.399, y = 0.75 + i * 0.058; leafAt(BIGLEAF_GEO, MAT.bigleaf, Math.cos(a) * 0.03, y, Math.sin(a) * 0.03, Math.PI / 2 - a, 0.7 + (i % 4) * 0.12 - i * 0.02, 0.85 + (i % 3) * 0.12, c.group); }
          c.solid(-0.3, 0.3, -0.3, 0.3); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "lobbyPlant" + ": " + e.message); }
    try { growDefProp('lobbyCoffee', { label: 'lobby coffee machine', x: ROOM.x - 0.4, z: 8.1, rot: 3, multi: { max: 4, price: 600, gap: 0.95, ico: '☕', lic: 'catering', upg: 'lobby', name: 'Coffee machine' }, build: function (c) {
          if (!S.upgrades.lobby) return;   // stand + machine appear with the upgrade
          c.box(0.6, 0.9, 0.5, MAT.darkwood, 0, 0.45, 0, { solid: true }); c.box(0.66, 0.04, 0.56, MAT.counterTop, 0, 0.92, 0, { cast: false });
          // a bean-to-cup machine: the upper half overhangs a brew bay, the cup stands on a grille under two nozzles, a lit screen and
          // three buttons on the fascia. It stands against a back board that carries the sign, so nothing is propped up in front of it.
          var body = colorMat(0x16171b, 0.25, 0.4), chrome = MAT.chrome, fascia = MAT.steel;
          c.box(0.64, 1.0, 0.03, MAT.darkwood, 0, 1.44, -0.262, { cast: false }); c.box(0.68, 0.05, 0.08, MAT.darkwood, 0, 1.96, -0.24, { r: 0.012 });
          c.box(0.36, 0.18, 0.24, body, 0, 1.03, -0.11, { r: 0.012 }); c.box(0.36, 0.28, 0.38, body, 0, 1.26, -0.04, { r: 0.03 });                                  /* the foot, and the head that overhangs it */
          [-0.165, 0.165].forEach(function (x) { c.box(0.03, 0.18, 0.15, body, x, 1.03, 0.075, { r: 0.008 }); });                                                        /* cheeks either side of the bay */
          c.box(0.3, 0.17, 0.006, fascia, 0, 1.03, 0.013, { cast: false, sharp: true });                                                                                 /* the back of the bay */
          c.box(0.09, 0.035, 0.07, chrome, 0, 1.105, 0.095, { cast: false, r: 0.008 }); [-0.02, 0.02].forEach(function (x) { c.cyl(0.007, 0.005, 0.03, chrome, x, 1.075, 0.1, 8); });   /* the spout and its two nozzles */
          c.box(0.34, 0.034, 0.17, body, 0, 0.957, 0.075, { r: 0.008 }); for (var gs = 0; gs < 7; gs++) c.box(0.27, 0.004, 0.012, chrome, 0, 0.976, 0.015 + gs * 0.02, { cast: false, sharp: true });   /* the drip tray and its grille */
          c.box(0.33, 0.24, 0.008, fascia, 0, 1.265, 0.151, { cast: false, r: 0.006 }); c.box(0.36, 0.012, 0.006, chrome, 0, 1.135, 0.152, { cast: false });
          c.box(0.215, 0.13, 0.008, MAT.gloss, -0.04, 1.29, 0.157, { cast: false, r: 0.006 });
          var cscr = new THREE.Mesh(new THREE.PlaneGeometry(0.195, 0.11), new THREE.MeshBasicMaterial({ map: signTex(['COFFEE', 'espresso · latte · tea'], 312, 176, { size: 44, bg: '#0a1410', color: '#9fd8b4', titleColor: '#f0b94d', line: 'rgba(0,0,0,0)' }), toneMapped: false })); cscr.position.set(-0.04, 1.29, 0.1615); c.add(cscr);
          [[1.335, 0x6fdc8c], [1.29, 0xf0b94d], [1.245, 0xe8eef4]].forEach(function (k) { var bt = c.cyl(0.015, 0.015, 0.012, colorMat(k[1], 0.3), 0.125, k[0], 0.157, 14); bt.rotation.x = Math.PI / 2; });
          c.lit(0x6fdc8c, 0.012, 0.012, 0.125, 1.2, 0.1565); c.box(0.12, 0.014, 0.004, chrome, -0.04, 1.2, 0.156, { cast: false });
          c.cyl(0.108, 0.112, 0.02, body, 0, 1.408, -0.04, 24);                                                                                                         /* the collar the hopper sits in */
          // the bean hopper on top: a clear cone you can see the level in, with a lid that lifts
          var hop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.096, 0.17, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.28, roughness: 0.05, side: THREE.DoubleSide }));
          hop.position.set(0, 1.49, -0.04); hop.castShadow = false; c.add(hop);
          var lid = new THREE.Group(); lid.position.set(0, 1.575, -0.15); c.add(lid); lid.userData.coffLid = true;
          var lm = new THREE.Mesh(roundCylGeo(0.104, 0.104, 0.018, 24), body); lm.position.set(0, 0, 0.11); lid.add(lm); var lk = new THREE.Mesh(roundCylGeo(0.018, 0.022, 0.02, 12), MAT.chrome); lk.position.set(0, 0.018, 0.11); lid.add(lk);
          var beans = new THREE.Mesh(roundCylGeo(0.093, 0.09, 0.12, 20), new THREE.MeshStandardMaterial({ map: TEX.soil || null, color: 0x3a2010, roughness: 1 }));
          beans.position.set(0, 1.46, -0.04); beans.castShadow = false; c.add(beans); beans.userData.coffBeans = true;
          // the cup stack beside it, and the cup that lands under the spout
          var cups = new THREE.Group(); cups.position.set(0.21, 0.96, -0.08); c.add(cups); cups.userData.coffCups = true; cups.userData.slots = [];
          var brewG = new THREE.Group(); brewG.position.set(0, 1.026, 0.095); c.add(brewG); brewG.userData.coffBrew = true;
          c.hit(0.72, 1.6, 0.62, 0, 0.8, 0, { kind: 'lobbyCoffee' });
          var cupHit = c.hit(0.24, 0.2, 0.22, 0, 1.02, 0.12, { kind: 'coffeeCup' }); cupHit.userData.coffCupHit = true;   /* parked out of the world while there is no cup, so it never steals the machine's own prompt */
          c.sign(['COFFEE', 'help yourself · $2 a cup'], 0.5, 0.16, 0, 1.8, -0.244, 0, { titleColor: '#ffc857' });
        }, after: function (c, P, inst, id) { syncCoffee(id); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "lobbyCoffee" + ": " + e.message); }
    try { growDefProp('vending', { label: 'vending machine', x: ROOM.x - 0.5, z: 6.8, rot: 3, multi: { max: 4, price: 900, gap: 1.15, ico: '🥤', lic: 'catering' }, build: function (c, P) {
          var SKIN = [[0x8f1f1a, '#ffc857'], [0x14507a, '#8fd0ff'], [0x1d6b45, '#b6f2c9'], [0x2b2f36, '#e8eef4']];   /* a row of identical red machines would read as a copy-paste, so every unit gets its own livery */
          var sk = SKIN[(((P && P.unit) || 1) - 1) % SKIN.length];
          var shell = colorMat(sk[0], 0.45, 0.25), dark = colorMat(0x1a1d21, 0.6), steel = colorMat(0x9aa0a6, 0.35, 0.7), inner = colorMat(0x23272c, 0.8);
          // a shell, not a block: the front-left is left open so you can see the stock behind the glass
          c.box(0.95, 1.95, 0.06, inner, 0, 0.975, -0.33, { cast: false });          /* back */
          c.box(0.06, 1.95, 0.72, shell, -0.445, 0.975, 0);                          /* left side */
          c.box(0.06, 1.95, 0.72, shell, 0.445, 0.975, 0);                           /* right side */
          c.box(0.95, 0.06, 0.72, shell, 0, 1.92, 0, { cast: false });               /* top */
          c.box(0.95, 0.16, 0.72, dark, 0, 0.08, 0);                                 /* kick plate */
          c.box(0.26, 1.78, 0.72, shell, 0.315, 1.03, 0);                            /* the keypad pillar */
          c.box(0.62, 0.04, 0.68, inner, -0.13, 0.62, 0.01, { cast: false });        /* floor of the cabinet */
          c.solid(-0.48, 0.48, -0.37, 0.37);
          c.box(0.99, 0.05, 0.76, dark, 0, 1.97, 0, { cast: false });
          c.box(0.86, 0.24, 0.03, dark, 0, 1.79, 0.355, { cast: false });
          c.sign(['SNACKS & DRINKS'], 0.78, 0.15, 0, 1.79, 0.373, 0, { size: 30, bold: true, bg: '#101812', titleColor: sk[1], line: 'rgba(255,255,255,.35)' });
      
          // the glazed service door, hinged on the left upright
          var door = new THREE.Group(); door.position.set(-0.43, 1.12, 0.345); c.add(door); door.userData.vendDoor = true;
          function dbox(w, h2, d2, m, x, y, z, noCast) { var b = new THREE.Mesh(bevelGeo(w, h2, d2), m); b.position.set(x, y, z); b.castShadow = !noCast; door.add(b); return b; }
          dbox(0.04, 1.42, 0.05, shell, 0, 0, 0);
          dbox(0.04, 1.42, 0.05, shell, 0.6, 0, 0);
          dbox(0.64, 0.05, 0.05, shell, 0.3, 0.685, 0, true);
          dbox(0.64, 0.05, 0.05, shell, 0.3, -0.685, 0, true);
          var glass = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.36), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0.05, side: THREE.DoubleSide }));
          glass.position.set(0.3, 0, 0.004); glass.castShadow = false; door.add(glass);
          var handle = new THREE.Mesh(bevelGeo(0.025, 0.3, 0.05), steel); handle.position.set(0.56, 0, 0.05); door.add(handle);
      
          // the racks, which ride out with the door
          var racks = new THREE.Group(); racks.position.set(-0.13, 1.06, 0.02); c.add(racks); racks.userData.vendRacks = true;
          for (var r = 0; r < 4; r++) {
            var sy = 0.5 - r * 0.29;
            var shelf = new THREE.Mesh(bevelGeo(0.6, 0.012, 0.4), colorMat(0x3a3d42, 0.5)); shelf.position.set(0, sy, 0); shelf.castShadow = false; racks.add(shelf);
            for (var k = 0; k < 4; k++) {
              var coil = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0032, 5, 10), steel);
              coil.position.set(-0.215 + k * 0.143, sy + 0.032, 0.13); coil.rotation.x = Math.PI / 2; coil.castShadow = false; racks.add(coil);
            }
          }
          racks.userData.slots = [];
      
          // the delivery tray, its flap, and the hit box you press E on to reach in
          c.box(0.62, 0.03, 0.34, dark, -0.13, 0.3, 0.08, { cast: false });
          c.box(0.66, 0.02, 0.36, dark, -0.13, 0.58, 0.08, { cast: false });
          var flap = new THREE.Mesh(bevelGeo(0.56, 0.24, 0.012), new THREE.MeshPhysicalMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.5, roughness: 0.2 }));
          flap.position.set(-0.13, 0.44, 0.358); flap.castShadow = false; c.add(flap); flap.userData.vendFlap = true;
          c.hit(0.6, 0.3, 0.34, -0.13, 0.42, 0.2, { kind: 'vendTray' });
          var tray = new THREE.Group(); tray.position.set(-0.13, 0.33, 0.1); c.add(tray); tray.userData.vendTray = true;
      
          // the panel
          c.box(0.2, 0.14, 0.02, MAT.screen, 0.315, 1.6, 0.362, { cast: false });
          var disp = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshBasicMaterial({ map: signTex(['READY'], 200, 130, { size: 48, bg: '#08120c', color: '#6fdc8c', titleColor: '#6fdc8c', line: 'rgba(0,0,0,0)' }), transparent: true }));
          disp.position.set(0.315, 1.6, 0.3735); disp.castShadow = false; c.add(disp); disp.userData.vendDisp = true;
          for (var bq = 0; bq < 6; bq++) {
            var bx2 = 0.265 + (bq % 2) * 0.1, by2 = 1.4 - Math.floor(bq / 2) * 0.12;
            c.box(0.075, 0.075, 0.018, colorMat(bq === 0 ? 0x6fdc8c : 0xd8dce0, 0.4), bx2, by2, 0.366, { cast: false });
          }
          c.box(0.1, 0.014, 0.02, MAT.chrome, 0.315, 1.05, 0.368, { cast: false });
          c.box(0.07, 0.06, 0.02, dark, 0.315, 0.92, 0.368, { cast: false });
          c.hit(0.95, 1.95, 0.75, 0, 0.97, 0, { kind: 'vending' });
          c.light(new THREE.PointLight(0xbfe8ff, 0.5, 2.6), -0.13, 1.5, 0.2);
        }, after: function (c, P, inst, id) { syncVending(id); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "vending" + ": " + e.message); }
    try { growDefProp('menuScreen', { label: 'menu screen', x: 4.0, z: 4 + WALL_T / 2 + 0.05, rot: 0, build: function (c) {
          // the menu board over the lobby: a lit panel in the same housing as every other screen in the shop
          var mg = new THREE.Group(); mg.position.set(0, 2.05, 0.03); c.add(mg); screenShell(mg, 1.3, 0.72, { bezel: 0.03, depth: 0.04 });
          var cv = document.createElement('canvas'); cv.width = 1040; cv.height = 576; var x2 = cv.getContext('2d'); scrBg(x2, 1040, 576, DESK_OK);
          x2.textAlign = 'left'; x2.textBaseline = 'top'; x2.fillStyle = DESK_OK; x2.font = '700 84px ' + SIGN_FONT; x2.fillText('Today', 60, 48); x2.fillStyle = scrRgba(DESK_OK, 0.5); x2.fillRect(60, 156, 920, 3);
          [['Eighths', 'bagged fresh at the bench'], ['Joints', 'rolled by hand, one strain each'], ['Top shelf', 'on request at the window']].forEach(function (r, i) { var y = 186 + i * 104; x2.fillStyle = DESK_INK; x2.font = '600 54px ' + SIGN_FONT; x2.fillText(r[0], 60, y); x2.fillStyle = DESK_DIM; x2.font = '32px ' + SIGN_FONT; x2.fillText(r[1], 62, y + 58); });
          x2.fillStyle = DESK_WARN; x2.font = '600 34px ' + SIGN_FONT; x2.textAlign = 'right'; x2.fillText('ID required', 980, 72);
          var scr = litPlane(cv, 1.3, 0.72); scr.position.z = 0.0005; mg.add(scr); var gl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.72), MAT.screenGlass); gl.position.z = 0.0016; mg.add(gl); c.light(new THREE.PointLight(0x6fdc8c, 0.25, 3), 0, 2.0, 0.4);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "menuScreen" + ": " + e.message); }
    try { growDefProp('goodsShelf', { label: 'goods shelf', x: 6.5, z: 3.55, rot: 2, build: function (c) {
          var wood = MAT.darkwood, w = goodsWidth(), d = 0.42, cols = goodsCols();
          c.box(w, 0.05, d, wood, 0, 0.16, 0, { solid: true }); [0.74, 1.3, 1.86].forEach(function (y) { c.box(w, 0.035, d, wood, 0, y, 0); });
          c.box(w, 2.0, 0.03, colorMat(0x2b2119, 0.9), 0, 1.0, -d / 2 + 0.015, { cast: false });   // back panel
          [-1, 1].forEach(function (s) { c.box(0.05, 2.0, d, wood, s * (w / 2 - 0.025), 1.0, 0); });
          for (var dv = 1; dv < cols; dv++) c.box(0.05, 1.8, d, wood, (dv - cols / 2) * GOODS_CELL, 1.06, 0);   // uprights, and a divider between every pair of cells
          c.box(w, 0.06, d + 0.02, wood, 0, 2.03, 0);
          c.sign(['GROW CO.', 'house menu · bags & joints'], Math.min(w - 0.2, 2.2), 0.3, 0, 2.2, 0.0, 0, { titleColor: '#6fdc8c', bg: '#0f1a12' });
          for (var i = 0; i < cols + 1; i++) c.add(spot(0xfff1d0, 0.35, 1.2, (i - cols / 2) * GOODS_CELL, 1.98, 0.12));   // a downlight over every divider
          var gg = c.dynGroup(); var gsh = new THREE.Group(); var gst = colorMat(0xa7adb4, 0.35, 0.8), gdk = colorMat(0x5b6168, 0.4, 0.7);
          var gpanel = new THREE.Mesh(bevelGeo(w - 0.12, 1.9, 0.014), gst); gsh.add(gpanel);
          for (var gs = 0; gs < 17; gs++) { var gbar = new THREE.Mesh(bevelGeo(w - 0.12, 0.012, 0.02), gdk); gbar.position.y = -0.9 + gs * 0.113; gsh.add(gbar); }
          var ghd = new THREE.Mesh(bevelGeo(0.3, 0.035, 0.035), gdk); ghd.position.set(0, -0.86, 0.02); gsh.add(ghd);
          gsh.position.set(0, 1.02, d / 2 + 0.05);   /* in front of the price cards, which hang off the shelf lips */ gg.userData.shutter = gsh; gg.add(gsh);
          var fz = d / 2 + 0.05, fd = 0.1;   /* the gate cannot sit flush without clipping the price cards, so an outer frame closes the slot it leaves at the edges */
          [-1, 1].forEach(function (s) { c.box(0.05, 2.0, fd, wood, s * (w / 2 - 0.025), 1.0, fz); }); c.box(w, 0.2, fd, wood, 0, 1.9, fz); c.box(w, 0.08, fd, wood, 0, 0.04, fz); c.box(w + 0.03, 0.06, fd + 0.04, wood, 0, 2.03, fz);   /* jambs, a head box hiding the rolled-up gate, a sill it lands on, and the shelf top carried over the frame */
          c.hit(w, 2.0, d, 0, 1.0, 0, { kind: 'goodsShelf' });
          function spot(col, inten, dist, x, y, z) { var l = new THREE.PointLight(col, inten, dist); l.position.set(x, y, z); return l; }
        }, after: function () { syncGoods(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "goodsShelf" + ": " + e.message); }
    try { growDefProp('stockCabinet', { label: 'stock cabinet', x: 7.55, z: -11.9, rot: 3, build: function (c) {
          // a steel security cabinet: two doors with pressed panels and louvres, bar handles, three hinges a side, a keypad lock, a plinth
          var steel = colorMat(0x505761, 0.42, 0.65), doorM = colorMat(0x5b626c, 0.38, 0.65), dark = colorMat(0x2a2d33, 0.5, 0.5);
          c.box(1.2, 1.94, 0.55, steel, 0, 1.03, 0, { solid: true }); c.box(1.24, 0.04, 0.59, dark, 0, 2.02, 0); c.box(1.16, 0.06, 0.51, dark, 0, 0.03, 0);
          [-0.3, 0.3].forEach(function (x) { var sd = x < 0 ? -1 : 1; c.box(0.575, 1.86, 0.006, MAT.black, x, 1.03, 0.277, { cast: false, sharp: true }); c.box(0.56, 1.845, 0.024, doorM, x, 1.03, 0.287, { r: 0.006 }); c.box(0.44, 0.7, 0.008, steel, x, 0.62, 0.301, { cast: false, r: 0.003 }); c.box(0.44, 0.62, 0.008, steel, x, 1.42, 0.301, { cast: false, r: 0.003 }); for (var v = 0; v < 5; v++) c.box(0.3, 0.014, 0.006, MAT.black, x, 1.78 + v * 0.03, 0.302, { cast: false, sharp: true });
            c.cyl(0.009, 0.009, 0.3, MAT.chrome, x - sd * 0.23, 1.05, 0.325, 10); [-0.12, 0.12].forEach(function (dy) { c.box(0.016, 0.016, 0.03, MAT.chrome, x - sd * 0.23, 1.05 + dy, 0.31, { cast: false, sharp: true }); }); [0.3, 1.03, 1.76].forEach(function (y) { c.cyl(0.012, 0.012, 0.09, dark, x + sd * 0.285, y, 0.29, 10); }); });
          c.box(0.09, 0.13, 0.03, MAT.gloss, 0, 1.3, 0.305, { r: 0.006 }); for (var kk = 0; kk < 9; kk++) c.box(0.016, 0.016, 0.004, colorMat(0xb9c0c6, 0.5), -0.024 + (kk % 3) * 0.024, 1.3 - Math.floor(kk / 3) * 0.024, 0.3215, { cast: false, sharp: true }); c.lit(0x6fdc8c, 0.012, 0.012, 0.024, 1.345, 0.3205); c.lit(0x5a1a1a, 0.012, 0.012, -0.024, 1.345, 0.3205);   // keypad lock
          c.sign(['STOCK', 'packed goods · locked'], 0.4, 0.13, 0.3, 1.62, 0.306, 0, { size: 22, bg: '#f3e9cf', color: '#222', titleColor: '#1a6a2a', line: 'rgba(0,0,0,.3)' });
          c.hit(1.3, 2.0, 0.8, 0, 1.0, 0.1, { kind: 'stock' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "stockCabinet" + ": " + e.message); }
    try { growDefProp('storeRack', { label: 'storage racking', x: 0.5, z: -10.85, rot: 1, build: function (c) {
          var frameM = colorMat(0x2a5aa8, 0.45, 0.5), beamM = colorMat(0xe07a1f, 0.45, 0.4), deckM = colorMat(0x9aa0a6, 0.4, 0.8);
          [-1.5, 0, 1.5].forEach(function (x) { [-0.26, 0.26].forEach(function (z) { c.box(0.06, 2.3, 0.06, frameM, x, 1.15, z); }); for (var b = 0; b < 5; b++) c.box(0.03, 0.03, 0.5, frameM, x, 0.25 + b * 0.45, 0); });   /* uprights with their cross braces */
          RACK.y.forEach(function (y) { [-0.27, 0.27].forEach(function (z) { c.box(3.06, 0.07, 0.04, beamM, 0, y - 0.035, z); }); c.box(2.96, 0.015, 0.5, deckM, 0, y + 0.005, 0); });
          c.solid(-1.55, 1.55, -0.32, 0.32); c.hit(3.1, 2.3, 0.6, 0, 1.15, 0, { kind: 'storage' });
          c.sign(['STORAGE', 'deliveries land here · E takes a crate · E with a crate racks it'], 1.9, 0.32, 0, 2.5, 0.02, 0, { titleColor: '#ffc857' }); c.dynGroup();
        }, after: function () { syncStorage(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "storeRack" + ": " + e.message); }
    try { growDefProp('bagLine', { label: 'trim & bag line', x: 4.5, z: 2.9, rot: 1, build: function (c) {
          // a bench-top line: a hopper over a trimming drum, a short belt on rollers, a control box with a stop button, a chute into the bag holder
          var st = MAT.steel, dk = MAT.gunmetal, belt = colorMat(0x16181b, 0.85);
          c.box(1.2, 0.06, 0.6, st, 0, 0.87, 0, { solid: true }); c.box(1.14, 0.5, 0.54, dk, 0, 0.6, 0, { cast: false }); [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].forEach(function (l) { c.box(0.05, 0.84, 0.05, st, l[0], 0.42, l[1]); c.cyl(0.035, 0.04, 0.02, MAT.soft, l[0], 0.01, l[1], 12); }); c.box(1.1, 0.03, 0.5, st, 0, 0.2, 0, { cast: false });
          c.box(0.5, 0.42, 0.46, dk, -0.3, 1.11, 0, { r: 0.02 }); var drum = c.cyl(0.17, 0.17, 0.4, st, -0.3, 1.13, 0.0, 24); drum.rotation.x = Math.PI / 2; c.lit(0x0c0f0d, 0.3, 0.2, -0.3, 1.13, 0.232); for (var sl = 0; sl < 5; sl++) c.box(0.26, 0.008, 0.006, st, -0.3, 1.06 + sl * 0.035, 0.234, { cast: false, sharp: true });
          c.cyl(0.26, 0.15, 0.32, st, -0.3, 1.49, 0, 28); c.cyl(0.272, 0.272, 0.02, MAT.chrome, -0.3, 1.655, 0, 28); c.cyl(0.24, 0.24, 0.01, colorMat(0x3f7a3a, 1), -0.3, 1.6, 0, 20);
          c.box(0.6, 0.02, 0.36, belt, 0.28, 0.93, 0, { cast: false }); [0.0, 0.56].forEach(function (x) { var rl = c.cyl(0.03, 0.03, 0.38, MAT.chrome, x, 0.92, 0, 14); rl.rotation.x = Math.PI / 2; }); [-0.19, 0.19].forEach(function (z) { c.box(0.62, 0.05, 0.016, st, 0.28, 0.93, z, { cast: false }); });
          c.box(0.16, 0.2, 0.1, MAT.gloss, 0.2, 1.1, -0.26, { r: 0.01 }); c.lit(0x6fdc8c, 0.02, 0.02, 0.16, 1.15, -0.2095); c.lit(0xf0b94d, 0.02, 0.02, 0.2, 1.15, -0.2095); c.cyl(0.022, 0.022, 0.024, colorMat(0xd0201a, 0.35), 0.24, 1.08, -0.2, 16).rotation.x = Math.PI / 2; c.cyl(0.03, 0.03, 0.008, colorMat(0xe3b52c, 0.5), 0.24, 1.08, -0.208, 16).rotation.x = Math.PI / 2;
          var ch = c.box(0.2, 0.012, 0.3, st, 0.66, 0.84, 0, { sharp: true }); ch.rotation.z = -0.55; c.box(0.2, 0.25, 0.04, MAT.white, 0.72, 0.62, 0.1, { cast: false });
          c.sign(['TRIM & BAG'], 0.6, 0.12, 0, 0.6, 0.272, 0, { size: 26, titleColor: '#6fdc8c', bg: '#101410' }); c.hit(1.3, 1.8, 0.8, 0, 0.9, 0.05, { kind: 'bagLine' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bagLine" + ": " + e.message); }
    try { growDefProp('vipTable', { label: 'lounge table + armchairs', floor: 1, x: 7.4, z: -1.6, rot: 0, build: function (c) {
          var velvet = colorMat(0x5a1f3a, 0.95), brass = colorMat(0xc9a24a, 0.35, 0.8);
          c.cyl(0.45, 0.45, 0.05, MAT.darkwood, 0, 0.62, 0, 20); c.cyl(0.05, 0.05, 0.6, brass, 0, 0.3, 0, 10); c.cyl(0.28, 0.3, 0.04, brass, 0, 0.02, 0, 16); c.cyl(0.07, 0.05, 0.03, MAT.jar, 0.1, 0.66, 0.05, 12); c.cyl(0.015, 0.015, 0.2, colorMat(0xfff3c8, 0.4), -0.12, 0.75, -0.08, 8);
          [-0.95, 0.95].forEach(function (x) { c.box(0.7, 0.35, 0.7, velvet, x, 0.28, 0); c.box(0.14, 0.75, 0.7, velvet, x + (x > 0 ? 0.3 : -0.3), 0.6, 0); c.box(0.7, 0.3, 0.12, velvet, x, 0.58, -0.32); c.box(0.7, 0.3, 0.12, velvet, x, 0.58, 0.32); [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(function (l) { c.box(0.05, 0.12, 0.05, brass, x + l[0], 0.06, l[1]); }); });
          c.solid(-1.3, 1.3, -0.4, 0.4);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "vipTable" + ": " + e.message); }
    try { growDefProp('cellarHatch', { label: 'basement hatch', x: 3.3, z: -0.4, rot: 3, build: function (c) {
          var st = colorMat(0x8d949c, 0.35, 0.8), dk = colorMat(0x2b2f35, 0.5, 0.6);
          c.box(1.3, 0.04, 1.3, dk, 0, 0.02, 0, { cast: false }); c.box(1.1, 0.012, 1.1, MAT.black, 0, 0.042, 0, { cast: false });
          var lid = c.box(1.2, 0.05, 1.2, st, 0, 0.64, -0.6); lid.rotation.x = -Math.PI / 2 + 0.06;   // the lid stands open flat against the wall, the ladder comes up in front of it
          [-0.4, 0.4].forEach(function (x) { c.cyl(0.022, 0.022, 1.1, colorMat(0xf2c21a, 0.6), x, 0.55, -0.42, 8); }); for (var r = 0; r < 3; r++) c.box(0.8, 0.03, 0.03, st, 0, 0.12 + r * 0.3, -0.42, { cast: false });
          c.sign(['RF SMOKING ↓', 'basement works'], 0.9, 0.26, 0, 1.45, -0.6, 0, { size: 26, bg: '#14100c', titleColor: '#e8c27a', color: '#b9a88a', line: 'rgba(232,194,122,.5)' }); c.box(0.04, 1.5, 0.04, dk, 0, 0.75, -0.63);
          c.solid(-0.65, 0.65, -0.8, -0.55); c.hit(1.3, 1.5, 1.3, 0, 0.75, 0, { kind: 'cellarDown' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "cellarHatch" + ": " + e.message); }
    try { growDefProp('cigCabinet', { label: 'cigarette cabinet', x: 2.5, z: 3.68, rot: 2, build: function (c) {
          var m = colorMat(0x2b2f35, 0.5, 0.5), inner = colorMat(0xe9e4d8, 0.8), st = colorMat(0xa7adb4, 0.35, 0.8), dk = colorMat(0x5b6168, 0.4, 0.7);
          c.box(1.2, 2.0, 0.05, m, 0, 1.0, -0.175); c.box(0.05, 2.0, 0.4, m, -0.6, 1.0, 0); c.box(0.05, 2.0, 0.4, m, 0.6, 1.0, 0); c.box(1.2, 0.06, 0.4, m, 0, 1.97, 0); c.box(1.2, 0.42, 0.4, m, 0, 0.21, 0); c.box(1.1, 1.5, 0.01, inner, 0, 1.17, -0.145, { cast: false });
          [0.57, 0.92, 1.27, 1.62].forEach(function (y) { c.box(1.1, 0.025, 0.3, m, 0, y - 0.013, 0, { cast: false }); }); c.box(1.2, 0.14, 0.1, m, 0, 1.9, 0.22); c.box(0.03, 1.5, 0.03, st, -0.565, 1.15, 0.2, { cast: false }); c.box(0.03, 1.5, 0.03, st, 0.565, 1.15, 0.2, { cast: false });
          c.sign(['RF SMOKING'], 0.7, 0.1, 0, 1.9, 0.272, 0, { size: 26, bg: '#14100c', titleColor: '#e8c27a', line: 'rgba(0,0,0,0)' });
          var g = c.dynGroup(); var sh = new THREE.Group(); var panel = new THREE.Mesh(bevelGeo(1.1, 1.45, 0.014), st); sh.add(panel); for (var s = 0; s < 14; s++) { var gr = new THREE.Mesh(bevelGeo(1.1, 0.012, 0.02), dk); gr.position.y = -0.69 + s * 0.105; sh.add(gr); } var hd = new THREE.Mesh(bevelGeo(0.3, 0.035, 0.035), dk); hd.position.set(0, -0.66, 0.02); sh.add(hd); sh.position.set(0, 1.145, 0.2); g.userData.shutter = sh; g.add(sh);
          c.solid(-0.6, 0.6, -0.2, 0.2); c.hit(1.25, 2.0, 0.5, 0, 1.0, 0.03, { kind: 'cigCab' });
        }, after: function () { syncCigCab(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "cigCabinet" + ": " + e.message); }
    try { growDefProp('gunLocker', { label: 'weapon locker', x: -2.6, z: 3.68, rot: 2, build: function (c) {
          // a gun cabinet: heavy gauge steel, two doors with louvres and recessed pulls, a hasp and padlock, hazard tape along the plinth
          var m = colorMat(0x3b4048, 0.42, 0.75), m2 = colorMat(0x454b54, 0.38, 0.75);
          c.box(0.8, 1.44, 0.36, m, 0, 0.78, 0, { solid: true }); c.box(0.78, 0.06, 0.34, MAT.soft, 0, 0.03, 0, { cast: false }); c.box(0.84, 0.03, 0.4, m, 0, 1.515, 0);
          [-0.2, 0.2].forEach(function (x) { var sd = x < 0 ? -1 : 1; c.box(0.385, 1.36, 0.006, MAT.black, x, 0.78, 0.182, { cast: false, sharp: true }); c.box(0.372, 1.345, 0.02, m2, x, 0.78, 0.19, { r: 0.005 }); for (var v = 0; v < 4; v++) { c.box(0.2, 0.014, 0.006, MAT.black, x, 1.26 + v * 0.035, 0.2015, { cast: false, sharp: true }); c.box(0.2, 0.014, 0.006, MAT.black, x, 0.2 + v * 0.035, 0.2015, { cast: false, sharp: true }); } c.box(0.03, 0.12, 0.006, MAT.black, x - sd * 0.14, 0.8, 0.2015, { cast: false, sharp: true }); c.box(0.012, 0.12, 0.012, MAT.chrome, x - sd * 0.15, 0.8, 0.206, { cast: false, sharp: true }); [0.25, 0.78, 1.31].forEach(function (y) { c.cyl(0.01, 0.01, 0.08, MAT.soft, x + sd * 0.192, y, 0.192, 10); }); });
          c.box(0.07, 0.04, 0.008, MAT.chrome, 0, 0.62, 0.205, { cast: false, sharp: true }); c.box(0.04, 0.05, 0.022, MAT.brass, 0, 0.575, 0.212, { r: 0.006 }); var shk = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 12, Math.PI), MAT.chrome); shk.position.set(0, 0.6, 0.212); c.add(shk);
          for (var hz = 0; hz < 8; hz++) c.box(0.05, 0.03, 0.004, colorMat(hz % 2 ? 0x15171b : 0xe3b52c, 0.5), -0.35 + hz * 0.1, 0.09, 0.184, { cast: false, sharp: true });
          c.sign(['WEAPONS', 'staff only'], 0.5, 0.16, 0, 1.62, -0.17, 0, { size: 26, titleColor: '#ff6b6b', bg: '#101410' });
          c.hit(0.85, 1.5, 0.46, 0, 0.75, 0, { kind: 'locker' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "gunLocker" + ": " + e.message); }
    try { growDefProp('vault', { label: 'vault', x: -ROOM.x + 0.45, z: 2.4, rot: 1, build: function (c) {
          // a safe worth the name: a body on four feet, a door proud of its frame on two barrel hinges, a five-spoke wheel, a combination dial, a brass plate
          var m = colorMat(0x2a2d33, 0.42, 0.7), m2 = colorMat(0x353940, 0.36, 0.75);
          c.box(0.7, 0.9, 0.7, m, 0, 0.5, 0, { solid: true, r: 0.02 }); [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(function (f) { c.cyl(0.04, 0.045, 0.05, MAT.soft, f[0], 0.025, f[1], 14); });
          c.box(0.64, 0.84, 0.01, MAT.black, 0, 0.5, 0.352, { cast: false, sharp: true }); c.box(0.6, 0.8, 0.05, m2, 0, 0.5, 0.375, { r: 0.012 }); c.box(0.5, 0.7, 0.008, m, 0, 0.5, 0.402, { cast: false, r: 0.003 });
          [0.24, 0.76].forEach(function (y) { c.cyl(0.022, 0.022, 0.14, MAT.steel, -0.315, y, 0.375, 14); c.cyl(0.026, 0.026, 0.012, MAT.chrome, -0.315, y + 0.076, 0.375, 14); });
          var wheel = new THREE.Group(); wheel.position.set(0.1, 0.46, 0.43); c.add(wheel); var rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.011, 10, 36), MAT.chrome); rim.castShadow = true; wheel.add(rim); for (var sp = 0; sp < 5; sp++) { var spoke = new THREE.Mesh(roundCylGeo(0.007, 0.007, 0.11, 8), MAT.chrome); spoke.rotation.z = sp * Math.PI * 2 / 5; spoke.position.set(-Math.sin(spoke.rotation.z) * 0.055, Math.cos(spoke.rotation.z) * 0.055, 0); wheel.add(spoke); } var hubw = new THREE.Mesh(roundCylGeo(0.03, 0.034, 0.04, 20), MAT.steel); hubw.rotation.x = Math.PI / 2; hubw.position.z = -0.008; wheel.add(hubw);
          var dial = new THREE.Mesh(roundCylGeo(0.06, 0.066, 0.03, 32), MAT.steel); dial.rotation.x = Math.PI / 2; dial.position.set(-0.14, 0.64, 0.418); c.add(dial); var dk = new THREE.Mesh(roundCylGeo(0.026, 0.03, 0.03, 20), MAT.chrome); dk.rotation.x = Math.PI / 2; dk.position.set(-0.14, 0.64, 0.445); c.add(dk);
          for (var t = 0; t < 24; t++) { var tk = c.box(0.003, t % 6 ? 0.008 : 0.014, 0.002, MAT.white, -0.14 + Math.cos(t / 24 * Math.PI * 2) * 0.05, 0.64 + Math.sin(t / 24 * Math.PI * 2) * 0.05, 0.4345, { cast: false, sharp: true }); tk.rotation.z = t / 24 * Math.PI * 2 + Math.PI / 2; }
          c.lit(0xff5040, 0.012, 0.012, -0.14, 0.73, 0.4075);
          c.sign(['VAULT'], 0.26, 0.06, 0, 0.84, 0.4075, 0, { size: 22, bold: true, bg: '#c9a24a', color: '#2a2210', titleColor: '#2a2210', line: 'rgba(60,45,10,.6)' });
          c.hit(0.8, 1.0, 0.8, 0, 0.5, 0, { kind: 'vault' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "vault" + ": " + e.message); }
    try { growDefProp('arcade', { label: 'arcade cabinet', x: -ROOM.x + 0.45, z: 6.4, rot: 1, multi: { max: 4, price: 750, gap: 1.0, ico: '🕹️', lic: 'amusement' }, build: function (c) {
          // an upright cabinet with the proper silhouette: two side panels cut to the classic profile, a lit marquee, a screen leaning
          // back behind its bezel, a sloped control deck with a stick and six buttons, a coin door with two slots
          var body = colorMat(0x15171b, 0.45, 0.1), trim = colorMat(0x6fdc8c, 0.4, 0, { emissive: new THREE.Color(0x2f8a4a), emissiveIntensity: 0.6 });
          var sh = new THREE.Shape(); [[-0.35, 0], [0.35, 0], [0.35, 0.92], [0.5, 1.0], [0.5, 1.12], [0.3, 1.18], [0.24, 1.6], [0.4, 1.66], [0.4, 1.86], [-0.35, 1.86]].forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); }); sh.closePath();
          [-0.34, 0.34].forEach(function (x) { var side = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }), body); side.rotation.y = -Math.PI / 2; side.position.set(x + 0.015, 0, 0); side.castShadow = true; c.add(side); var edge = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }), trim); edge.rotation.y = -Math.PI / 2; edge.scale.set(1.012, 1.006, 1); edge.position.set(x + (x < 0 ? -0.013 : 0.019), -0.004, 0.004); c.add(edge); });
          c.box(0.65, 1.84, 0.04, body, 0, 0.93, -0.33); c.box(0.65, 0.92, 0.04, body, 0, 0.46, 0.33); c.box(0.65, 0.04, 0.72, body, 0, 1.85, 0.02); c.box(0.65, 0.06, 0.66, MAT.soft, 0, 0.03, 0, { cast: false }); c.solid(-0.37, 0.37, -0.36, 0.5);
          c.lit(0xe8fff0, 0.62, 0.18, 0, 1.76, 0.402); var marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.17), new THREE.MeshBasicMaterial({ map: signTex(['GROW RUSH'], 300, 85, { size: 46, bold: true, bg: '#0d2a18', titleColor: '#6fdc8c', line: 'rgba(111,220,140,.8)' }), toneMapped: false })); marquee.position.set(0, 1.76, 0.404); c.add(marquee);
          var sg = new THREE.Group(); sg.position.set(0, 1.39, 0.255); sg.rotation.x = -0.14; c.add(sg); screenShell(sg, 0.52, 0.39, { bezel: 0.04, depth: 0.03, rimMat: body, led: 0 });
          var gv = document.createElement('canvas'); gv.width = 416; gv.height = 312; var gx = gv.getContext('2d'); gx.fillStyle = '#06130c'; gx.fillRect(0, 0, 416, 312); gx.fillStyle = '#0d2a18'; for (var gy = 0; gy < 312; gy += 26) gx.fillRect(0, gy, 416, 1); gx.fillStyle = '#6fdc8c'; gx.font = '700 40px ' + SCR_MONO; gx.textAlign = 'center'; gx.fillText('GROW RUSH', 208, 64); gx.font = '20px ' + SCR_MONO; gx.fillStyle = '#f0b94d'; gx.fillText('HI 042000', 208, 96);
          [[60, 230, '#6fdc8c'], [130, 200, '#6fdc8c'], [200, 240, '#f0b94d'], [270, 190, '#6fdc8c'], [340, 225, '#ff6b5e']].forEach(function (p) { gx.fillStyle = '#5a3a22'; gx.fillRect(p[0] - 14, p[1] + 24, 28, 22); gx.fillStyle = p[2]; for (var lf = 0; lf < 5; lf++) gx.fillRect(p[0] - 3 + (lf - 2) * 9, p[1] - Math.abs(lf - 2) * -8, 6, 26); });
          gx.fillStyle = '#e8f1ea'; gx.font = '18px ' + SCR_MONO; gx.fillText('INSERT COIN', 208, 294);
          var gs = litPlane(gv, 0.52, 0.39); gs.position.z = 0.0005; sg.add(gs); var gg = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.39), MAT.screenGlass); gg.position.z = 0.0016; sg.add(gg);
          var deck = new THREE.Group(); deck.position.set(0, 1.06, 0.4); deck.rotation.x = 0.42; c.add(deck); var dp = new THREE.Mesh(bevelGeo(0.65, 0.03, 0.26), colorMat(0x1f2226, 0.5)); dp.castShadow = true; deck.add(dp);
          var stick = new THREE.Mesh(roundCylGeo(0.008, 0.008, 0.09, 8), MAT.chrome); stick.position.set(-0.17, 0.06, 0); deck.add(stick); var ball = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), colorMat(0xc94a3a, 0.25)); ball.position.set(-0.17, 0.115, 0); deck.add(ball); var boot = new THREE.Mesh(roundCylGeo(0.02, 0.034, 0.014, 16), MAT.soft); boot.position.set(-0.17, 0.022, 0); deck.add(boot);
          [[0.02, -0.03, 0xffd166], [0.1, -0.05, 0xff6b5e], [0.18, -0.03, 0x7cc4ff], [0.04, 0.045, 0x6fdc8c], [0.12, 0.025, 0xf3eee0], [0.2, 0.045, 0xc9a0ff]].forEach(function (b) { var ring = new THREE.Mesh(roundCylGeo(0.024, 0.026, 0.008, 18), MAT.black); ring.position.set(b[0], 0.019, b[1]); deck.add(ring); var bt = new THREE.Mesh(roundCylGeo(0.019, 0.019, 0.016, 18), colorMat(b[2], 0.3)); bt.position.set(b[0], 0.028, b[1]); deck.add(bt); });
          c.box(0.34, 0.3, 0.012, colorMat(0x22262b, 0.4, 0.6), 0, 0.56, 0.356, { r: 0.004 }); [-0.07, 0.07].forEach(function (x) { c.lit(0xff5040, 0.05, 0.07, x, 0.62, 0.3625); c.box(0.004, 0.036, 0.004, MAT.black, x, 0.62, 0.3635, { cast: false, sharp: true }); }); c.box(0.1, 0.04, 0.01, MAT.chrome, 0, 0.5, 0.366, { cast: false, sharp: true }); c.cyl(0.01, 0.01, 0.008, MAT.chrome, 0.13, 0.56, 0.366, 10).rotation.x = Math.PI / 2;   // coin door
          c.light(new THREE.PointLight(0x6fdc8c, 0.4, 3), 0, 1.4, 0.7);
          c.hit(0.8, 2.0, 0.9, 0, 1.0, 0.1, { kind: 'arcade' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "arcade" + ": " + e.message); }
    try { growDefProp('procShelf', { label: 'storage shelf', x: 8.5, z: -1.55, rot: 0, build: function (c) {
          var shelfM = colorMat(0x8a8f96, 0.35, 0.8); for (var s = 0; s < 4; s++) c.box(1.6, 0.03, 0.45, shelfM, 0, 0.3 + s * 0.5, 0);
          [[-0.78, -0.2], [0.78, -0.2], [-0.78, 0.2], [0.78, 0.2]].forEach(function (p) { c.box(0.035, 1.9, 0.035, shelfM, p[0], 0.95, p[1]); });
          c.box(0.5, 0.3, 0.35, colorMat(0xc8a97a, 1), -0.45, 0.47, 0); c.box(0.4, 0.25, 0.3, colorMat(0xe8e8ee, 0.7), 0.35, 0.44, 0); c.sign(['BAGGIES'], 0.3, 0.08, 0.35, 0.44, 0.152, 0, { size: 26, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,.3)' });
          for (var j = 0; j < 6; j++) { c.cyl(0.06, 0.06, 0.14, MAT.jar, -0.6 + j * 0.24, 0.89, 0, 12); c.cyl(0.062, 0.062, 0.015, MAT.jarLid, -0.6 + j * 0.24, 0.965, 0, 12); }
          c.box(0.6, 0.2, 0.3, colorMat(0x3a5a3a, 0.9), -0.4, 1.42, 0); c.box(0.3, 0.14, 0.2, colorMat(0xf5e6c8, 0.8), 0.3, 1.39, 0); c.box(0.5, 0.08, 0.3, MAT.white, 0.4, 1.86, 0); c.cyl(0.09, 0.09, 0.2, colorMat(0x2b6fb3, 0.4), -0.5, 1.92, 0, 14);
          c.solid(-0.8, 0.8, -0.25, 0.25);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "procShelf" + ": " + e.message); }
    try { growDefProp('hallClockTable', { label: 'side table', x: -3.5, z: 1.6, rot: 1, build: function (c) { c.box(0.5, 0.04, 0.5, MAT.wood, 0, 0.7, 0, { solid: true }); legs4(c, 0.5, 0.5, 0.68, MAT.darkwood, 0.05, 0.04); c.box(0.44, 0.03, 0.44, MAT.wood, 0, 0.25, 0, { cast: false }); c.cyl(0.06, 0.05, 0.16, colorMat(0xf5f5f0, 0.5), -0.1, 0.8, 0, 14); for (var i = 0; i < 5; i++) { var fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), colorMat([0xff6b9d, 0xffd166, 0x9ad0ff, 0xff8c42, 0xf2f2f2][i], 0.8)); fl.position.set(-0.1 + Math.cos(i * 1.3) * 0.05, 0.95 + (i % 2) * 0.04, Math.sin(i * 1.3) * 0.05); c.add(fl); var st = c.cyl(0.004, 0.004, 0.14, MAT.stem, -0.1 + Math.cos(i * 1.3) * 0.03, 0.88, Math.sin(i * 1.3) * 0.03, 5); } c.box(0.14, 0.2, 0.03, MAT.darkwood, 0.14, 0.82, -0.05); c.box(0.11, 0.16, 0.005, new THREE.MeshBasicMaterial({ map: signTex(['📷', 'the crew'], 110, 160, { size: 30, bg: '#f0ead8', color: '#333', titleColor: '#333', line: 'rgba(0,0,0,0)' }) }), 0.14, 0.82, -0.032, { cast: false }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "hallClockTable" + ": " + e.message); }
    try { growDefProp('floorLamp', { label: 'floor lamp', x: -1.2, z: -1.6, rot: 0, build: function (c) {
          // a drum-shade floor lamp: a stone foot, a brass stem with a collar, a linen shade with a diffuser under it
          c.cyl(0.17, 0.18, 0.04, colorMat(0x2a2c2f, 0.3, 0.05), 0, 0.02, 0, 32); c.cyl(0.012, 0.012, 1.56, MAT.brass, 0, 0.82, 0, 12); c.cyl(0.024, 0.024, 0.05, MAT.brass, 0, 0.07, 0, 14); c.cyl(0.02, 0.02, 0.04, MAT.brass, 0, 1.5, 0, 14);
          var shM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0xf3ead2, side: THREE.DoubleSide, emissive: 0xffe0a0, emissiveIntensity: 0.55, roughness: 0.95 }); var sh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 32, 1, true), shM); sh.position.y = 1.7; c.add(sh);
          [1.85, 1.55].forEach(function (y, i) { var rg = new THREE.Mesh(new THREE.TorusGeometry(i ? 0.22 : 0.2, 0.005, 6, 32), MAT.brass); rg.rotation.x = Math.PI / 2; rg.position.y = y; c.add(rg); }); c.cyl(0.19, 0.19, 0.006, new THREE.MeshBasicMaterial({ color: 0xfff1cf, toneMapped: false }), 0, 1.57, 0, 24); c.cyl(0.035, 0.035, 0.1, emitMat(0xffe9b0, 1.6), 0, 1.68, 0, 12);
          c.light(new THREE.PointLight(0xffe0a0, 0.45, 5), 0, 1.6, 0); c.solid(-0.2, 0.2, -0.2, 0.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "floorLamp" + ": " + e.message); }
    try { growDefProp('guardBoard', { label: 'notice board', x: 5.0, z: ROOM.z - 0.13, rot: 2, build: function (c) { c.box(1.0, 0.7, 0.03, colorMat(0x8a6a4a, 0.9), 0, 1.7, 0); c.box(1.04, 0.74, 0.02, MAT.darkwood, 0, 1.7, -0.01, { cast: false }); [['NO ID', 'NO ENTRY', '#fff', '#c9302c'], ['LOST', 'grey cat, answers to Kush', '#333', '#f0ead8'], ['BAND', 'friday · the dry room', '#062010', '#6fdc8c'], ['WANTED', 'trimmers · ask inside', '#332200', '#ffc857']].forEach(function (n, i) { var x = -0.32 + (i % 2) * 0.36, y = 1.86 - Math.floor(i / 2) * 0.32; var note = c.sign([n[0], n[1]], 0.3, 0.24, x, y, 0.02, 0, { size: 22, bg: n[3], color: n[2], titleColor: n[2], line: 'rgba(0,0,0,.2)' }); note.rotation.z = (i % 2 ? -0.06 : 0.05); var pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), colorMat([0xc94a3a, 0x3a7fd6, 0xffd166, 0x3aa36a][i], 0.4)); pin.position.set(x, y + 0.1, 0.03); c.add(pin); }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "guardBoard" + ": " + e.message); }
    try { growDefProp('dining', { label: 'dining set', floor: 1, x: -4, z: -5.6, rot: 0, build: function (c) {
          c.box(1.6, 0.05, 0.9, MAT.wood, 0, 0.75, 0, { solid: true }); c.box(1.5, 0.04, 0.8, MAT.darkwood, 0, 0.72, 0, { cast: false }); legs4(c, 1.6, 0.9, 0.72, MAT.darkwood, 0.1, 0.06);
          chair(c, -0.5, -0.8, 0, fabricMat(0x3a5a3a), MAT.darkwood); chair(c, 0.5, -0.8, 0, fabricMat(0x3a5a3a), MAT.darkwood); chair(c, -0.5, 0.8, Math.PI, fabricMat(0x3a5a3a), MAT.darkwood); chair(c, 0.5, 0.8, Math.PI, fabricMat(0x3a5a3a), MAT.darkwood);
          c.hit(1.8, 0.8, 1.1, 0, 0.7, 0, { kind: 'eatspot', label: 'dining table' });
          [-0.35, 0.35].forEach(function (x) { c.cyl(0.14, 0.12, 0.012, colorMat(0xf5f5f0, 0.4), x, 0.786, 0, 20); c.cyl(0.05, 0.045, 0.1, MAT.jar, x + 0.2, 0.83, -0.2, 12); c.box(0.02, 0.005, 0.14, MAT.chrome, x - 0.18, 0.783, 0, { cast: false }); c.box(0.02, 0.005, 0.14, MAT.chrome, x + 0.18, 0.783, 0, { cast: false }); });
          var vase = new THREE.Mesh(roundCylGeo(0.05, 0.035, 0.18, 12), MAT.jar); vase.position.set(0, 0.87, 0); c.add(vase); for (var f = 0; f < 4; f++) { c.cyl(0.004, 0.004, 0.2, MAT.stem, Math.cos(f * 1.6) * 0.02, 1.02, Math.sin(f * 1.6) * 0.02, 5); var fl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), colorMat([0xff6b9d, 0xffd166, 0xf2f2f2, 0xff8c42][f], 0.8)); fl.position.set(Math.cos(f * 1.6) * 0.04, 1.12, Math.sin(f * 1.6) * 0.04); c.add(fl); }
          c.box(0.24, 0.005, 0.24, colorMat(0xe0c25a, 1), -0.35, 0.78, 0, { cast: false }); c.box(0.24, 0.005, 0.24, colorMat(0xe0c25a, 1), 0.35, 0.78, 0, { cast: false });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "dining" + ": " + e.message); }
    try { growDefProp('couchUp', { label: 'couch + coffee table', floor: 1, x: DIVX - 3.7, z: 0.5, rot: 1, build: function (c) {
          // built along local x with the back at -z; rot 1 turns the back to the wall side (-x) so it faces the TV on the right wall
          var seatM = fabricMat(0x3b4a5c), pipeM = fabricMat(0x2a3542);
          sofaBuild(c, 2.4, seatM, pipeM);
          [-0.6, 0.6].forEach(function (x) { var cu = c.box(0.42, 0.13, 0.42, fabricMat(x < 0 ? 0xe0c25a : 0xc94a3a), x, 0.62, -0.14, { r: 0.055 }); cu.rotation.set(1.05, x < 0 ? -0.2 : 0.25, 0); });
          c.box(1.2, 0.14, 0.3, fabricMat(0x8a8a8a), 0.2, 0.34, 0.0).rotation.z = 0.02;   // throw blanket
          c.hit(2.5, 1.2, 1.2, 0, 0.6, 0, { kind: 'couch', seat: 'couchUp' });
          coffeeTableBuild(c, 0, 1.3, 1.2, 0.7);
          c.box(0.16, 0.16, 0.12, MAT.black, 0.3, 0.52, 1.3); c.box(0.14, 0.02, 0.1, MAT.plastic, 0.3, 0.6, 1.3, { cast: false }); var mug = new THREE.Mesh(roundCylGeo(0.04, 0.035, 0.09, 12), colorMat(0x6fdc8c, 0.5)); mug.position.set(-0.3, 0.49, 1.2); c.add(mug); c.box(0.18, 0.02, 0.12, MAT.black, -0.1, 0.45, 1.4, { cast: false }); for (var b = 0; b < 12; b++) c.box(0.012, 0.005, 0.012, colorMat(0x8a8f96), -0.16 + (b % 6) * 0.024, 0.462, 1.38 + Math.floor(b / 6) * 0.03, { cast: false });   // remote
          c.box(0.24, 0.02, 0.3, colorMat(0xe8e8ee, 0.7), 0.35, 0.45, 1.15, { cast: false }); c.box(0.2, 0.01, 0.26, new THREE.MeshBasicMaterial({ map: signTex(['grow', 'notes'], 100, 130, { size: 26, bg: '#f0ead8', color: '#333', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }) }), 0.35, 0.462, 1.15, { cast: false });
          c.box(4.5, 0.02, 3.6, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x5a3a2a, roughness: 1 }), 0, 0.01, 1.4, { cast: false }); c.box(4.2, 0.005, 3.3, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x7a4a34, roughness: 1 }), 0, 0.022, 1.4, { cast: false });
          c.box(0.03, 1.7, 0.03, MAT.chrome, -1.6, 0.85, -0.2); c.cyl(0.14, 0.16, 0.02, MAT.black, -1.6, 0.01, -0.2, 18); var lshade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.32, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xf1e7c8, side: THREE.DoubleSide, emissive: 0xffe0a0, emissiveIntensity: 0.4 })); lshade.position.set(-1.6, 1.8, -0.2); c.add(lshade); c.light(new THREE.PointLight(0xffe0a0, 0.4, 5), -1.6, 1.7, -0.2);
        }, after: function (c, P) { var v = growPropWorld('couchUp', 0, 0.1); world.couchSeat = { x: v.x, z: v.z, yaw: -Math.PI / 2 + P.rot * Math.PI / 2 - Math.PI / 2 }; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "couchUp" + ": " + e.message); }
    try { growDefProp('bed', { label: 'bed', floor: 1, x: -8.5, z: 6.9, rot: 0, build: function (c) {
          c.box(1.6, 0.4, 2.1, MAT.darkwood, 0, 0.2, 0, { solid: true }); c.box(1.5, 0.22, 2.0, fabricMat(0xe8e8ee), 0, 0.51, 0); c.box(1.52, 0.02, 2.02, colorMat(0xd0d0d8, 0.9), 0, 0.51, 0, { cast: false });
          var duvet = c.box(1.54, 0.18, 1.25, fabricMat(0x3a6a4a), 0, 0.68, 0.38); c.box(1.54, 0.04, 0.2, fabricMat(0x2f5a3c), 0, 0.78, -0.2, { cast: false });
          [-0.38, 0.38].forEach(function (x) { c.box(0.62, 0.14, 0.42, fabricMat(0xffffff), x, 0.69, -0.78).rotation.y = x < 0 ? 0.05 : -0.05; });
          c.box(1.6, 0.9, 0.08, MAT.darkwood, 0, 0.6, -1.05); for (var s = -0.65; s <= 0.65; s += 0.26) c.box(0.16, 0.5, 0.02, MAT.wood, s, 0.7, -1.0, { cast: false });
          c.box(0.5, 0.55, 0.45, MAT.darkwood, 1.1, 0.275, -0.9, { solid: true }); drawer(c, 0.42, 0.18, 0.02, 1.1, 0.4, -0.67); drawer(c, 0.42, 0.18, 0.02, 1.1, 0.17, -0.67);
          c.cyl(0.08, 0.06, 0.03, MAT.black, 1.1, 0.57, -0.9, 14); c.cyl(0.012, 0.012, 0.22, MAT.chrome, 1.1, 0.68, -0.9, 8); var sh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.14, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xf1e7c8, side: THREE.DoubleSide, emissive: 0xffe0a0, emissiveIntensity: 0.3 })); sh.position.set(1.1, 0.82, -0.9); c.add(sh); c.light(new THREE.PointLight(0xffe0a0, 0.3, 3), 1.1, 0.8, -0.9);
          c.box(0.1, 0.16, 0.06, MAT.black, 0.95, 0.63, -0.8); c.box(0.08, 0.05, 0.005, MAT.screen, 0.95, 0.66, -0.768, { cast: false }); c.box(0.12, 0.18, 0.03, colorMat(0x8a2a2a, 0.8), 1.25, 0.64, -0.95).rotation.z = 0.1;
          c.hit(1.8, 1.0, 2.3, 0, 0.5, 0, { kind: 'bed' });
          c.box(1.2, 0.02, 0.6, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x6a5a4a, roughness: 1 }), 0, 0.01, 1.4, { cast: false });
        }, after: function (c, P) { var v = growPropWorld('bed', 0, 0.3); world.bedSpot = { x: v.x, z: v.z, yaw: Math.PI + P.rot * Math.PI / 2 }; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bed" + ": " + e.message); }
    try { growDefProp('upBooks', { label: 'bookshelf', floor: 1, x: 4.0, z: -8.6, rot: 0, build: function (c) { bookshelfBuild(c, 1.6, 2.0, 4); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upBooks" + ": " + e.message); }
    try { growDefProp('windowSeat', { label: 'window seat', floor: 1, x: -2.0, z: ROOM.z - 0.5, rot: 0, build: function (c) { c.box(6.0, 0.45, 0.6, MAT.wood, 0, 0.225, 0, { solid: true }); c.box(6.0, 0.08, 0.6, fabricMat(0x3a5a3a), 0, 0.49, 0); for (var k = 0; k < 4; k++) { var cu = c.box(0.5, 0.14, 0.5, fabricMat([0xe0c25a, 0x6fdc8c, 0xd64a9a, 0x3ad0ff][k]), -2.2 + k * 1.4, 0.6, 0); cu.rotation.y = (k % 2 ? 0.2 : -0.15); } c.box(0.4, 0.03, 0.28, colorMat(0x8a2a2a, 0.8), 1.2, 0.545, 0.1, { cast: false }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "windowSeat" + ": " + e.message); }
    try { growDefProp('upPlant1', { label: 'plant', floor: 1, x: -8.5, z: -8.3, build: function (c) { c.fern(0, 0, 1.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upPlant1" + ": " + e.message); }
    try { growDefProp('upPlant2', { label: 'plant', floor: 1, x: 11.2, z: -8.3, build: function (c) { c.fern(0, 0, 1.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upPlant2" + ": " + e.message); }
    try { growDefProp('upPlant3', { label: 'plant', floor: 1, x: 11.2, z: 5.0, build: function (c) { c.fern(0, 0, 1.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upPlant3" + ": " + e.message); }
    try { growDefProp('upRug', { label: 'rug', floor: 1, x: -4, z: 0.5, rot: 0, build: function (c) { c.box(3.6, 0.02, 2.6, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x4a3b5c, roughness: 1 }), 0, 0.01, 0, { cast: false }); c.box(3.2, 0.005, 2.2, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x6a4f7a, roughness: 1 }), 0, 0.022, 0, { cast: false }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upRug" + ": " + e.message); }
    try { growDefProp('upDresser', { label: 'dresser', floor: 1, x: -11.4, z: 4.5, rot: 1, build: function (c) { c.box(1.2, 0.9, 0.5, MAT.darkwood, 0, 0.45, 0, { solid: true }); c.box(1.24, 0.04, 0.54, MAT.wood, 0, 0.92, 0, { cast: false }); for (var r = 0; r < 3; r++) for (var q = 0; q < 2; q++) drawer(c, 0.52, 0.22, 0.02, -0.29 + q * 0.58, 0.2 + r * 0.27, 0.24); c.box(0.5, 0.6, 0.03, MAT.darkwood, 0.2, 1.3, -0.2); c.box(0.44, 0.54, 0.005, new THREE.MeshPhysicalMaterial({ color: 0xdfe8f0, roughness: 0.05, metalness: 0.9 }), 0.2, 1.3, -0.18, { cast: false }); c.cyl(0.05, 0.04, 0.12, MAT.jar, -0.4, 1.0, 0, 12); c.box(0.2, 0.25, 0.02, colorMat(0x8a2a2a, 0.8), -0.35, 1.06, -0.15).rotation.z = 0.1; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upDresser" + ": " + e.message); }
    try { growDefProp('breedBench', { label: 'breeding bench', x: -3.8, z: -ROOM.z + 0.45, rot: 0, build: function (c) {
          var B = breedState(); if (!B.owned) { notFitted(c, 1.7, 0.7, ['BREEDING BENCH', 'E to fit it · ' + money(BREED.price)], 'breedBench'); return; }
          // a steel bench with a lit hood over two mother-plant bays, a seed tray, a magnifier lamp and a read-out
          c.box(1.7, 0.05, 0.7, MAT.steel, 0, 0.9, 0, { solid: true }); c.box(1.6, 0.03, 0.6, MAT.gunmetal, 0, 0.3, 0, { cast: false }); [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].forEach(function (l) { c.box(0.045, 0.88, 0.045, MAT.steel, l[0], 0.44, l[1]); c.cyl(0.03, 0.035, 0.02, MAT.soft, l[0], 0.01, l[1], 12); });
          drawer(c, 0.5, 0.16, 0.02, -0.5, 0.78, 0.33, MAT.gunmetal); drawer(c, 0.5, 0.16, 0.02, 0.05, 0.78, 0.33, MAT.gunmetal);
          [[-0.84, -0.32], [0.18, -0.32], [-0.84, 0.2], [0.18, 0.2]].forEach(function (p) { c.box(0.025, 0.95, 0.025, MAT.alu, p[0], 1.4, p[1], { sharp: true }); }); c.box(1.06, 0.04, 0.56, MAT.gunmetal, -0.33, 1.88, -0.06); c.lit(0xf6e8ff, 0.9, 0.06, -0.33, 1.855, -0.06, 0, Math.PI / 2); c.lit(0xffd9f2, 0.9, 0.06, -0.33, 1.855, 0.08, 0, Math.PI / 2);
          c.box(1.04, 0.95, 0.006, MAT.glass, -0.33, 1.4, -0.325, { cast: false, sharp: true }); c.light(new THREE.PointLight(0xf2d8ff, 0.5, 2.2), -0.33, 1.6, 0.1);
          var J = B.job, k = J ? clamp(J.t / (BREED.ms / 1000), 0, 1) : 0; world.breed = { figs: [], pods: null, scr: null };
          [[-0.62, J ? J.a : ''], [-0.04, J ? J.b : '']].forEach(function (p) { var pg = new THREE.Group(); pg.position.set(p[0], 0.925, -0.06); pg.scale.setScalar(0.62); c.add(pg); makePot(pg, !!J); if (J) { var f = plantFigure(strainById(p[1])); f.position.y = 0.3; pg.add(f); f.userData.set(0.75 + k * 0.25, 1.15); world.breed.figs.push(f); } });
          c.box(0.34, 0.03, 0.24, MAT.soft, 0.52, 0.94, 0.12, { r: 0.008 }); for (var s = 0; s < 12; s++) { var sd = c.cyl(0.016, 0.014, 0.02, colorMat(0x3a2a1c, 1), 0.4 + (s % 4) * 0.08, 0.965, 0.04 + Math.floor(s / 4) * 0.08, 10); if (J && k >= 1) c.cyl(0.006, 0.006, 0.012, colorMat(0xc9a66a, 0.6), 0.4 + (s % 4) * 0.08, 0.982, 0.04 + Math.floor(s / 4) * 0.08, 8); }
          c.cyl(0.04, 0.035, 0.1, MAT.jar, 0.74, 0.975, -0.2, 14); [-0.012, 0.012, 0].forEach(function (dx, i) { c.cyl(0.003, 0.003, 0.16, MAT.wood, 0.74 + dx, 1.02, -0.2 + (i - 1) * 0.01, 6).rotation.z = dx * 8; });
          c.cyl(0.06, 0.065, 0.016, MAT.gunmetal, 0.62, 0.933, -0.24, 18); var arm = c.box(0.014, 0.34, 0.014, MAT.alu, 0.58, 1.08, -0.24, { sharp: true }); arm.rotation.z = 0.3; var ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 8, 24), MAT.gunmetal); ring.position.set(0.5, 1.25, -0.2); ring.rotation.x = Math.PI / 2 - 0.5; c.add(ring); var lens = new THREE.Mesh(new THREE.CircleGeometry(0.058, 20), MAT.jar); lens.position.copy(ring.position); lens.rotation.x = -0.5 - Math.PI / 2; c.add(lens);
          var scr = readout(0.36, 0.2, '#c9a0ff'), sg = new THREE.Group(); sg.position.set(0.55, 1.5, -0.3); c.add(sg); screenShell(sg, 0.36, 0.2, { bezel: 0.012, depth: 0.02, led: 0xc9a0ff }); scr.position.z = 0.0005; sg.add(scr); c.box(0.03, 0.5, 0.03, MAT.gunmetal, 0.55, 1.2, -0.325); world.breed.scr = scr;
          c.sign(['BREEDING BENCH', 'two parents, one new strain'], 0.9, 0.3, -0.33, 2.15, -0.3, 0, { titleColor: '#c9a0ff' });
          c.hit(1.7, 1.2, 0.7, 0, 1.4, 0, { kind: 'breedBench' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "breedBench" + ": " + e.message); }
    try { growDefProp('trophyCase', { label: 'trophy cabinet', x: -5.25, z: 4 + WALL_T / 2 + 0.24, rot: 0, build: function (c) {
          // a glazed cabinet in dark wood: three lit glass shelves, the entry jar on a stand in the middle of the top one
          var C = cupState(), w = 1.3, d = 0.42;
          c.box(w, 0.5, d, MAT.darkwood, 0, 0.25, 0, { solid: true }); drawer(c, 0.56, 0.3, 0.02, -0.31, 0.27, d / 2 - 0.01); drawer(c, 0.56, 0.3, 0.02, 0.31, 0.27, d / 2 - 0.01); c.box(w + 0.04, 0.04, d + 0.04, MAT.darkwood, 0, 0.52, 0); c.box(w + 0.04, 0.06, d + 0.04, MAT.darkwood, 0, 2.0, 0);
          c.box(w, 1.46, 0.02, colorMat(0x16241c, 0.9), 0, 1.26, -d / 2 + 0.01, { cast: false }); [-1, 1].forEach(function (sd) { c.box(0.04, 1.46, d, MAT.darkwood, sd * (w / 2 - 0.02), 1.26, 0); c.box(0.006, 1.4, d - 0.06, MAT.glass, sd * (w / 2 - 0.05), 1.26, 0, { cast: false, sharp: true }); });
          var gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 1.42), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.12, roughness: 0.02, clearcoat: 1, side: THREE.DoubleSide })); gl.position.set(0, 1.26, d / 2 - 0.01); c.add(gl); c.box(0.03, 1.46, 0.03, MAT.darkwood, 0, 1.26, d / 2 - 0.01); c.cyl(0.008, 0.008, 0.12, MAT.brass, 0.05, 1.2, d / 2 + 0.012, 8);
          var ys = [0.56, 1.04, 1.52]; ys.forEach(function (y) { if (y > 0.6) c.box(w - 0.1, 0.012, d - 0.06, MAT.glass, 0, y, 0, { cast: false, sharp: true }); c.lit(0xfff1cf, w - 0.14, 0.014, 0, y + 0.455, d / 2 - 0.05, 0, Math.PI / 2); });
          c.light(new THREE.PointLight(0xffe9b0, 0.5, 2.4), 0, 1.5, 0.5);
          var show = C.trophies.slice(-CUP.shelf).reverse(), order = { gold: 0, silver: 1, bronze: 2 }; show.sort(function (a, b) { return order[a.metal] - order[b.metal]; });
          show.forEach(function (t, i) { var row = Math.floor(i / 3), col = i % 3, tm = trophyMesh(t.metal, t.metal === 'gold' ? 1.35 : 1.15); tm.position.set(-0.4 + col * 0.4, [1.532, 1.052, 0.572][row], -0.04); c.add(tm); c.sign([t.strain, 'day ' + t.day], 0.26, 0.07, -0.4 + col * 0.4, [1.532, 1.052, 0.572][row] + 0.036, 0.13, 0, { size: 17, bg: '#c9a24a', color: '#2a2210', titleColor: '#2a2210', line: 'rgba(60,45,10,.6)' }); });
          if (!show.length) c.sign(['No cups yet', 'enter a jar and win one'], 0.6, 0.18, 0, 1.2, 0.0, 0, { size: 26, bg: 'rgba(0,0,0,0)', color: '#a2ad9c', titleColor: '#f3eee0', line: 'rgba(0,0,0,0)' });
          if (C.entry) { var st = strainById(C.entry.strain); c.cyl(0.07, 0.08, 0.03, MAT.darkwood, 0.45, 0.595, 0.1, 18); c.cyl(0.05, 0.05, 0.11, MAT.jar, 0.45, 0.665, 0.1, 18); c.cyl(0.042, 0.042, 0.07, colorMat(st.bud, 0.9), 0.45, 0.65, 0.1, 12); c.cyl(0.052, 0.052, 0.014, MAT.jarLid, 0.45, 0.727, 0.1, 18); }
          c.sign(['THE CANNABIS CUP', 'next judging: day ' + cupNext()], 1.1, 0.3, 0, 2.22, -0.1, 0, { titleColor: '#f0b94d' });
          c.hit(w, 2.0, d + 0.1, 0, 1.0, 0.03, { kind: 'trophyCase' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "trophyCase" + ": " + e.message); }
    try { growDefProp('hydroBay', { label: 'hydroponics bay', x: ROOM.x - 0.55, z: -5.9, rot: 3, build: function (c) {
          var H = hydroState(); world.hydro = null; if (!H.owned) { notFitted(c, 2.5, 0.7, ['HYDROPONICS BAY', 'E to fit it · ' + money(HYDRO.price)], 'hydroTank'); return; }
          // a rack on castors: two tiers of white channels with net pots, a light bar over each tier, the tank and pump underneath, a controller on the end
          var white = colorMat(0xf2f4f5, 0.35, 0.02), pipe = colorMat(0x2f6fb0, 0.4, 0.1);
          [[-1.2, -0.3], [1.2, -0.3], [-1.2, 0.3], [1.2, 0.3]].forEach(function (p) { c.box(0.045, 2.0, 0.045, MAT.alu, p[0], 1.04, p[1], { sharp: true }); c.cyl(0.035, 0.035, 0.04, MAT.soft, p[0], 0.02, p[1], 12); });
          [0.06, 0.62, 1.24, 2.02].forEach(function (y) { [-0.3, 0.3].forEach(function (z) { c.box(2.44, 0.035, 0.035, MAT.alu, 0, y, z, { sharp: true }); }); [-1.2, 1.2].forEach(function (x) { c.box(0.035, 0.035, 0.6, MAT.alu, x, y, 0, { sharp: true }); }); });
          [0.76, 1.38].forEach(function (y, t) {
            c.box(2.36, 0.09, 0.2, white, 0, y, 0.02, { r: 0.02 }); c.box(0.03, 0.11, 0.22, white, -1.19, y, 0.02); c.box(0.03, 0.11, 0.22, white, 1.19, y, 0.02);
            for (var i = 0; i < 4; i++) { var x = -0.9 + i * 0.6; c.cyl(0.06, 0.045, 0.05, MAT.black, x, y + 0.035, 0.02, 16); c.cyl(0.052, 0.052, 0.012, colorMat(0x8a5a3a, 1), x, y + 0.062, 0.02, 14); c.hit(0.5, 0.56, 0.5, x, y + 0.3, 0.04, { kind: 'hydroSite', i: t * 4 + i }); }
            c.box(2.3, 0.03, 0.12, MAT.gunmetal, 0, y + 0.56, 0.02, { r: 0.008 }); c.lit(0xfdf3ff, 2.2, 0.07, 0, y + 0.5435, 0.02, 0, Math.PI / 2); c.light(new THREE.PointLight(0xf6e8ff, 0.4, 2.0), 0, y + 0.4, 0.3);
            c.cyl(0.014, 0.014, 0.3, pipe, 1.12 - t * 0.06, y - 0.19, -0.12, 8);
          });
          c.box(1.5, 0.42, 0.5, colorMat(0x1f2a33, 0.45, 0.05), -0.3, 0.3, 0, { solid: true, r: 0.03 }); c.box(1.42, 0.02, 0.44, colorMat(0x3d7ab3, 0.15, 0.1, { transparent: true, opacity: 0.75 }), -0.3, 0.5, 0, { cast: false }); c.box(0.3, 0.02, 0.2, MAT.gunmetal, -0.8, 0.525, 0.05, { cast: false });
          c.box(0.22, 0.26, 0.24, MAT.gunmetal, 0.72, 0.22, 0, { r: 0.02 }); c.cyl(0.05, 0.05, 0.1, MAT.steel, 0.72, 0.4, 0, 14); c.cyl(0.016, 0.016, 1.2, pipe, 0.95, 0.9, -0.2, 8); c.cyl(0.016, 0.016, 0.5, pipe, 0.72, 0.5, -0.2, 8).rotation.z = 0.9; c.solid(-1.25, 1.25, -0.35, 0.35);
          var scr = readout(0.3, 0.2, '#7cc4ff'), sg = new THREE.Group(); sg.position.set(1.0, 1.05, 0.34); c.add(sg); c.box(0.36, 0.34, 0.06, MAT.gloss, 1.0, 1.0, 0.305, { r: 0.01 }); screenShell(sg, 0.3, 0.2, { bezel: 0.01, depth: 0.012, led: 0x7cc4ff }); scr.position.z = 0.0005; sg.add(scr); [[-0.07, 0x6fdc8c], [0, 0xf0b94d], [0.07, 0xff6b5e]].forEach(function (b) { c.cyl(0.014, 0.014, 0.012, colorMat(b[1], 0.35), 1.0 + b[0], 0.885, 0.34, 12).rotation.x = Math.PI / 2; });
          c.hit(1.6, 0.6, 0.6, -0.3, 0.3, 0.05, { kind: 'hydroTank' }); c.hit(0.4, 0.4, 0.2, 1.0, 1.0, 0.36, { kind: 'hydroTank' });
          c.sign(['HYDROPONICS', 'keep the tank at pH ' + HYDRO.phLo + ' to ' + HYDRO.phHi], 1.2, 0.3, 0, 2.25, 0.0, 0, { titleColor: '#7cc4ff' });
          world.hydro = { dyn: c.dynGroup(), figs: [], scr: scr };
        }, after: function () { hydroSync(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "hydroBay" + ": " + e.message); }
    try { growDefProp('merchStand', { label: 'merch stand', x: -8.6, z: 6.2, rot: 0, build: function (c) {
          var M = merchState(); world.merch = null; if (!M.owned) { notFitted(c, 1.8, 0.7, ['MERCH STAND', 'E to fit it · ' + money(MERCH.price)], 'merchStand'); return; }
          // a two-sided gondola: a slatted panel on a weighted base, a rail of shirts on each face, a shelf of caps above, mugs and totes below
          c.box(1.7, 0.1, 0.62, MAT.gunmetal, 0, 0.05, 0, { solid: true, r: 0.012 }); c.box(1.6, 1.9, 0.05, MAT.darkwood, 0, 1.05, 0); for (var s = 0; s < 15; s++) [1, -1].forEach(function (f) { c.box(1.58, 0.012, 0.004, MAT.black, 0, 0.2 + s * 0.12, f * 0.027, { cast: false, sharp: true }); });
          [-0.82, 0.82].forEach(function (x) { c.box(0.04, 1.96, 0.1, MAT.alu, x, 1.05, 0); }); c.box(1.7, 0.04, 0.12, MAT.alu, 0, 2.02, 0);
          [1, -1].forEach(function (f) { c.box(1.5, 0.02, 0.22, MAT.steel, 0, 1.78, f * 0.14, { cast: false }); c.box(1.5, 0.02, 0.24, MAT.steel, 0, 0.74, f * 0.15, { cast: false }); c.cyl(0.008, 0.008, 1.5, MAT.chrome, 0, 1.66, f * 0.1, 8).rotation.z = Math.PI / 2; [-0.7, 0.7].forEach(function (x) { c.box(0.012, 0.012, 0.1, MAT.chrome, x, 1.66, f * 0.06, { sharp: true, cast: false }); }); [-0.4, 0, 0.4].forEach(function (x) { c.cyl(0.005, 0.005, 0.12, MAT.chrome, x, 0.56, f * 0.09, 6).rotation.x = Math.PI / 2; }); });
          c.sign(['GROW CO. MERCH', 'pay at the window'], 1.2, 0.26, 0, 2.2, 0.062, 0, { titleColor: '#6fdc8c' }); c.sign(['GROW CO. MERCH', 'pay at the window'], 1.2, 0.26, 0, 2.2, -0.062, Math.PI, { titleColor: '#6fdc8c' });
          c.light(new THREE.PointLight(0xfff1cf, 0.35, 2.4), 0, 2.1, 0.6); c.hit(1.8, 2.0, 0.8, 0, 1.0, 0, { kind: 'merchStand' });
          world.merch = { dyn: c.dynGroup() };
        }, after: function () { merchSync(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "merchStand" + ": " + e.message); }
    try { fixtureFromBuild('counterTill', 'till', 0, function () {
          // the cash drawer cabinet: brushed steel on rubber feet, the terminal bolted to its lid
          var reg = box(0.5, 0.118, 0.46, MAT.gunmetal, -1.0, 1.127, 3.55, { r: 0.01 });
          [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]].forEach(function (f) { cyl(0.022, 0.026, 0.012, MAT.soft, -1.0 + f[0], 1.066, 3.55 + f[1], null, 12); });
          box(0.46, 0.004, 0.42, MAT.steel, -1.0, 1.1875, 3.55, { cast: false });
          // the till is a tablet on a stand: its screen is a touch screen (look at it, press E), and the cash drawer sits under it
          world.reg = { drawerT: 0, lastSale: null };
          buildPos(-1.0, 3.62);
          var scrGlow = new THREE.PointLight(0x6fdc8c, 0.12, 1.0); scrGlow.position.set(-1.0, 1.3, 3.5); world.group.add(scrGlow);   /* in the group, so the glow goes where the till goes */
          var drawer = new THREE.Group(); drawer.position.set(-1.0, 1.118, 3.55); world.group.add(drawer); world.reg.drawer = drawer;
          (function () {
            function dm(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); drawer.add(m); return m; }
            var trayM = colorMat(0x1a1d21, 0.7, 0.1), cupM = colorMat(0x2b3036, 0.6, 0.2);
            dm(bevelGeo(0.45, 0.07, 0.4), trayM, 0, 0, 0);
            var face = dm(bevelGeo(0.485, 0.102, 0.022, 0.007), MAT.steel, 0, 0, -0.233); face.castShadow = true;
            dm(new THREE.BoxGeometry(0.17, 0.016, 0.006), MAT.black, 0, -0.026, -0.2445); dm(new THREE.BoxGeometry(0.17, 0.005, 0.012), MAT.chrome, 0, -0.016, -0.248);   /* the finger pull and its lip */
            dm(new THREE.BoxGeometry(0.3, 0.004, 0.004), MAT.black, 0, 0.03, -0.2445);                                                                                   /* the slot cheques and big notes go through */
            var lock = dm(roundCylGeo(0.012, 0.012, 0.008, 16), MAT.brass, 0.19, 0.0, -0.246); lock.rotation.x = Math.PI / 2; dm(new THREE.BoxGeometry(0.003, 0.012, 0.003), MAT.black, 0.19, 0.0, -0.2505);
            /* inside, seen when it slides out: coin cups along the front, notes under sprung clips behind them */
            [[0x9ff0b5, 0], [0xe8e8ee, 1], [0xffd766, 2], [0x9ad0ff, 3], [0xf3b6c8, 4]].forEach(function (sl) {
              var x = -0.172 + sl[1] * 0.086;
              dm(new THREE.BoxGeometry(0.078, 0.004, 0.17), cupM, x, 0.037, 0.0); dm(new THREE.BoxGeometry(0.07, 0.014, 0.15), colorMat(sl[0], 0.85), x, 0.046, 0.0);
              dm(new THREE.BoxGeometry(0.06, 0.006, 0.012), MAT.chrome, x, 0.056, 0.035);
              if (sl[1] < 4) dm(new THREE.BoxGeometry(0.004, 0.026, 0.3), trayM, x + 0.043, 0.048, -0.04);
              dm(new THREE.BoxGeometry(0.078, 0.004, 0.085), cupM, x, 0.037, -0.145);
              var coinM = sl[1] % 3 === 0 ? MAT.chrome : sl[1] % 3 === 1 ? MAT.brass : colorMat(0xb87333, 0.35, 1);
              for (var cn = 0; cn < 2; cn++) dm(roundCylGeo(0.014, 0.014, 0.012 + ((sl[1] * 7 + cn * 3) % 4) * 0.005, 14), coinM, x - 0.017 + cn * 0.034, 0.048, -0.145 + (cn ? 0.012 : -0.012));
            });
            dm(new THREE.BoxGeometry(0.43, 0.026, 0.004), trayM, 0, 0.048, -0.095);
          })();
          drawRegister();
          // the receipt printer, with a length of paper curling out of it
          box(0.16, 0.12, 0.2, MAT.gloss, -0.66, 1.121, 3.68, { r: 0.012 }); box(0.15, 0.008, 0.11, MAT.plastic, -0.66, 1.183, 3.705, { cast: false }); box(0.1, 0.004, 0.006, MAT.black, -0.66, 1.1825, 3.638, { cast: false });
          (function () {
            var pg = new THREE.PlaneGeometry(0.08, 0.13, 1, 10), pp = pg.attributes.position;
            for (var i = 0; i < pp.count; i++) { var t = (pp.getY(i) + 0.065) / 0.13, a = t * 1.9; pp.setXYZ(i, pp.getX(i), Math.sin(a) * 0.055, -(1 - Math.cos(a)) * 0.055 - t * 0.012); }
            pg.computeVertexNormals(); var paper = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0xfbfaf4, roughness: 0.9, side: THREE.DoubleSide })); paper.position.set(-0.66, 1.184, 3.638); paper.castShadow = true; world.group.add(paper);
            var pl = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), new THREE.MeshBasicMaterial({ color: 0x6fdc8c, toneMapped: false })); pl.position.set(-0.6, 1.188, 3.75); pl.rotation.x = -Math.PI / 2; world.group.add(pl);
            cyl(0.008, 0.008, 0.004, MAT.soft, -0.62, 1.189, 3.75, null, 10);
          })();
          // the card reader on its stalk, facing the window
          (function () {
            cyl(0.04, 0.046, 0.012, MAT.soft, -0.44, 1.067, 3.79, null, 18); cyl(0.011, 0.011, 0.075, MAT.alu, -0.44, 1.108, 3.79, null, 10);
            var rg = new THREE.Group(); rg.position.set(-0.44, 1.165, 3.795); rg.rotation.x = -0.62; world.group.add(rg);
            var body = new THREE.Mesh(bevelGeo(0.084, 0.165, 0.028, 0.011), MAT.gloss); body.castShadow = true; rg.add(body);
            var rc = document.createElement('canvas'); rc.width = 264; rc.height = 176; var rx = rc.getContext('2d'); scrLcd(rx, 264, 176, DESK_OK); rx.textAlign = 'center'; rx.fillStyle = DESK_INK; rx.font = '700 34px ' + DESK_FONT; rx.fillText('Tap or insert', 132, 34); rx.strokeStyle = DESK_OK; rx.lineWidth = 6; rx.lineCap = 'round'; for (var w = 0; w < 4; w++) { rx.beginPath(); rx.arc(96, 122, 14 + w * 14, -0.75, 0.75); rx.stroke(); }
            var rs = litPlane(rc, 0.066, 0.044); rs.position.set(0, 0.05, 0.0145); rg.add(rs);
            for (var kr = 0; kr < 4; kr++) for (var kc = 0; kc < 3; kc++) { var km = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.012, 0.004), kr === 3 ? colorMat([0xd0352b, 0xe3b52c, 0x39a85a][kc], 0.5) : colorMat(0xb9c0c6, 0.5)); km.position.set(-0.022 + kc * 0.022, 0.008 - kr * 0.018, 0.0155); rg.add(km); }
            var slot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.006), MAT.black); slot.position.set(0, -0.078, 0.008); rg.add(slot);
          })();
          // the scanner in its cradle, on the cashier's side
          (function () {
            box(0.09, 0.02, 0.12, MAT.soft, -1.37, 1.071, 3.5, { r: 0.008 }); cyl(0.016, 0.02, 0.06, MAT.soft, -1.37, 1.11, 3.52, null, 12);
            var sg = new THREE.Group(); sg.position.set(-1.37, 1.15, 3.5); sg.rotation.set(0.5, 0.25, 0); world.group.add(sg);
            var grip = new THREE.Mesh(bevelGeo(0.036, 0.13, 0.044, 0.014), MAT.soft); grip.position.set(0, -0.02, 0.02); grip.castShadow = true; sg.add(grip);
            var head = new THREE.Mesh(bevelGeo(0.066, 0.05, 0.11, 0.016), MAT.gloss); head.position.set(0, 0.06, -0.015); head.castShadow = true; sg.add(head);
            var eye = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.026), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })); eye.position.set(0, 0.06, -0.0705); eye.rotation.y = Math.PI; sg.add(eye);
            var trig = new THREE.Mesh(bevelGeo(0.014, 0.03, 0.012, 0.004), colorMat(0xe3b52c, 0.5)); trig.position.set(0, 0.022, -0.006); sg.add(trig);
          })();
          interactable(reg, { kind: 'register', label: 'Till', prompt: 'Sell & serve' });
          }, { table: true, baseY: 1.06 }); } catch (e) {}
    try { fixtureFromBuild('tipJar', 'tip jar', 0, function () { cyl(0.08, 0.08, 0.18, MAT.jar, 1.2, 1.15, 3.55); cyl(0.09, 0.09, 0.02, MAT.jarLid, 1.2, 1.25, 3.55); interactable(box(0.22, 0.26, 0.22, MAT.none, 1.2, 1.15, 3.55, { cast: false }), { kind: 'tips' }); for (var c = 0; c < 6; c++) { var coin = cyl(0.02, 0.02, 0.004, MAT.chrome, 1.2 + randf(-0.04, 0.04), 1.07 + c * 0.006, 3.55 + randf(-0.04, 0.04), null, 10); coin.rotation.set(randf(-0.3, 0.3), 0, randf(-0.3, 0.3)); } }, { table: true, baseY: 1.06 }); } catch (e) {}
    try { fixtureFromBuild('bizCards', 'business cards', 0, function () { box(0.1, 0.03, 0.07, MAT.white, 0.8, 1.075, 3.5, { cast: false }); box(0.1, 0.005, 0.07, colorMat(0x6fdc8c), 0.8, 1.093, 3.5, { cast: false }); box(0.16, 0.08, 0.13, MAT.none, 0.8, 1.1, 3.5, { cast: false }); }, { table: true, baseY: 1.06 }); } catch (e) {}
    try { fixtureFromBuild('deskBell', 'desk bell', 0, function () { cyl(0.05, 0.06, 0.03, MAT.chrome, 0.4, 1.075, 3.5, null, 16); var bell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.chrome); bell.position.set(0.4, 1.09, 3.5); world.group.add(bell); cyl(0.008, 0.008, 0.02, MAT.black, 0.4, 1.14, 3.5, null, 8); box(0.16, 0.12, 0.16, MAT.none, 0.4, 1.12, 3.5, { cast: false }); }, { table: true, baseY: 1.06 }); } catch (e) {}
    try { fixtureFromBuild('keyHook', 'key hook', -Math.PI / 2, function () {
            var brass = colorMat(0xc9a24a, 0.35, 0.8), board = colorMat(0x6b4a2a, 0.8), hx = -4.13;
            box(0.03, 0.2, 0.26, board, hx, 1.5, -0.4, { cast: false });
            [-0.07, 0.07].forEach(function (dz) { var pin = cyl(0.008, 0.008, 0.05, brass, hx - 0.025, 1.48, -0.4 + dz, null, 8); pin.rotation.z = Math.PI / 2; cyl(0.012, 0.012, 0.012, brass, hx - 0.05, 1.465, -0.4 + dz, null, 8).rotation.z = Math.PI / 2; });
            signPlane(['KEYS'], 0.2, 0.05, hx - 0.016, 1.575, -0.4, -Math.PI / 2, { size: 24, bg: '#6b4a2a', titleColor: '#e8c27a', line: 'rgba(0,0,0,0)' });
            var ring = new THREE.Group(); ring.position.set(hx - 0.05, 0, -0.47); world.group.add(ring); world.keyRing = ring;
            var loop = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 8, 16), brass); loop.position.y = 1.45; loop.rotation.y = Math.PI / 2; ring.add(loop);
            for (var k = 0; k < 3; k++) { var b = new THREE.Mesh(bevelGeo(0.003, 0.045, 0.01), k === 1 ? colorMat(0x9aa0a6, 0.4, 0.7) : brass); b.position.set(0, 1.405, -0.015 + k * 0.015); ring.add(b); }
            var hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.42), MAT.none); hit.position.set(hx - 0.1, 1.48, -0.42); world.group.add(hit); interactable(hit, { kind: 'keyHook' });
          }); } catch (e) {}
    try { fixtureFromBuild('roster', 'staff roster', -Math.PI / 2, function () { box(0.04, 1.0, 1.2, colorMat(0x8a6a3a, 0.9), -4.13, 1.7, 2.35, { cast: false }); signPlane(['STAFF ROSTER', 'driver · operator · night guard · technician'], 1.1, 0.36, -4.16, 1.95, 2.35, -Math.PI / 2, { size: 24 }); hit(0.4, 1.2, 1.3, -4.25, 1.7, 2.35, { kind: 'roster' }); }); } catch (e) {}
    try { propExtra('tabletDock', function (c) {
          [-0.232, 0.232].forEach(function (x) { c.box(0.018, 0.9, 0.31, MAT.alu, x, 0.47, 0.02, { cast: false }); });
          c.lit(0x6fdc8c, 0.4, 0.006, 0, 0.9, 0.173); c.lit(0x6fdc8c, 0.4, 0.006, 0, 0.12, 0.173);
          c.cyl(0.006, 0.006, 0.5, MAT.black, 0.17, 0.3, -0.16, 6); c.box(0.07, 0.11, 0.03, MAT.white, 0.17, 0.58, -0.175, { cast: false });
        }); } catch (e) {}
    try { propExtra('cureShelf', function (c) {
          c.box(3.16, 0.07, 0.48, MAT.darkwood, 0, 2.335, 0.02); c.box(3.1, 0.04, 0.44, MAT.darkwood, 0, 2.285, 0.01, { cast: false }); c.box(3.06, 0.1, 0.4, MAT.darkwood, 0, 0.05, 0);
          [1.05, 1.6, 2.15].forEach(function (y) { warmStrip(c, 1.4, -0.75, y - 0.027, 0.16); warmStrip(c, 1.4, 0.75, y - 0.027, 0.16); }); warmStrip(c, 1.4, -0.75, 2.258, 0.16); warmStrip(c, 1.4, 0.75, 2.258, 0.16);
          [-1.5, 0, 1.5].forEach(function (x) { c.box(0.075, 2.2, 0.012, MAT.darkwood, x, 1.2, 0.206, { cast: false }); });
          var ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 24), MAT.brass); ring.position.set(-1.3, 2.0, 0.214); c.add(ring);
        }); } catch (e) {}
    try { propExtra('dryRack', function (c) {
          var hw = 3.25, ly = 2.1;
          c.box(hw * 2 - 0.9, 0.012, 0.8, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x3d342a, roughness: 1 }), 0, 0.006, 0, { cast: false, sharp: true });
          [-hw, hw].forEach(function (px) { c.box(0.13, 0.16, 0.13, MAT.gunmetal, px, ly - 0.02, 0, { r: 0.01 }); c.box(0.13, 0.12, 0.13, MAT.gunmetal, px, 0.12, 0, { r: 0.01 }); });
          for (var h = 0; h < 12; h++) { var hk = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 14, Math.PI * 1.5), MAT.chrome); hk.position.set(-hw + 0.3 + h * 0.55, ly - 0.05, 0); hk.rotation.y = Math.PI / 2; c.add(hk); }
          var dial = c.cyl(0.07, 0.07, 0.025, MAT.white, hw - 0.002, 1.5, 0.06, 24); dial.rotation.x = Math.PI / 2; var rim = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 24), MAT.brass); rim.position.set(hw - 0.002, 1.5, 0.075); c.add(rim); var nd = c.box(0.004, 0.05, 0.002, colorMat(0xc0271b, 0.5), hw + 0.008, 1.51, 0.075, { cast: false, sharp: true }); nd.rotation.z = -0.6;
        }); } catch (e) {}
    try { propExtra('dryTable', function (c) {
          c.box(0.84, 0.03, 0.54, MAT.wood, 0, 0.25, 0, { cast: false }); c.box(0.5, 0.1, 0.02, MAT.darkwood, 0, 0.7, 0.29); c.box(0.12, 0.015, 0.02, MAT.chrome, 0, 0.7, 0.306, { cast: false });
          c.cyl(0.13, 0.13, 0.012, MAT.chrome, 0, 0.843, 0, 28); c.cyl(0.03, 0.04, 0.012, MAT.gunmetal, 0, 0.836, 0, 12); c.lit(0x6fdc8c, 0.07, 0.022, 0, 0.8665, 0.15, 0, -Math.PI / 2);
          c.box(0.3, 0.2, 0.3, colorMat(0xc8a97a, 1), -0.22, 0.365, 0); for (var j = 0; j < 3; j++) { c.cyl(0.05, 0.05, 0.12, MAT.jar, 0.08 + j * 0.13, 0.325, 0.05, 14); c.cyl(0.052, 0.052, 0.014, MAT.jarLid, 0.08 + j * 0.13, 0.392, 0.05, 14); }
          var roll = c.cyl(0.045, 0.045, 0.2, colorMat(0xf4f4f0, 0.5, 0, { transparent: true, opacity: 0.85 }), -0.3, 0.855, -0.2, 16); roll.rotation.z = Math.PI / 2;
          var sc1 = c.box(0.012, 0.004, 0.13, MAT.chrome, 0.1, 0.808, 0.2, { cast: false }); sc1.rotation.y = 0.5; var sc2 = c.box(0.012, 0.004, 0.13, MAT.chrome, 0.11, 0.81, 0.2, { cast: false }); sc2.rotation.y = 0.2; [0.06, 0.1].forEach(function (x) { var lp = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), colorMat(0xd0201a, 0.5)); lp.rotation.x = Math.PI / 2; lp.position.set(x + 0.02, 0.81, 0.265); c.add(lp); });
        }); } catch (e) {}
    try { propExtra('jarBoxes', function (c) {
          var tape = colorMat(0xd9c28a, 0.45), bxM = colorMat(0xc8a97a, 1);
          [[0.3, 0, 0.42], [0.3, 0, 0]].forEach(function (b) { c.box(0.06, 0.004, 0.53, tape, b[0], 0.418 + b[2], b[1], { cast: false, sharp: true }); c.box(0.06, 0.12, 0.004, tape, b[0], 0.36 + b[2], b[1] + 0.262, { cast: false, sharp: true }); });
          [-1, 1].forEach(function (sd) { var fl = c.box(0.5, 0.008, 0.24, bxM, -0.3, 0.47, sd * 0.33); fl.rotation.x = sd * 0.95; var f2 = c.box(0.24, 0.008, 0.5, bxM, -0.3 + sd * 0.33, 0.47, 0); f2.rotation.z = -sd * 0.95; });
          for (var i = 0; i < 9; i++) { c.cyl(0.06, 0.06, 0.03, MAT.jar, -0.45 + (i % 3) * 0.15, 0.4, -0.15 + Math.floor(i / 3) * 0.15, 14); c.cyl(0.062, 0.062, 0.014, MAT.jarLid, -0.45 + (i % 3) * 0.15, 0.424, -0.15 + Math.floor(i / 3) * 0.15, 14); }
        }); } catch (e) {}
    try { propExtra('hose', function (c) {
          c.box(0.5, 1.0, 0.02, MAT.gunmetal, -0.15, 1.05, -0.52, { cast: false }); [[-0.35, 0.62], [0.05, 0.62], [-0.35, 1.48], [0.05, 1.48]].forEach(function (p) { c.cyl(0.012, 0.012, 0.012, MAT.chrome, p[0], p[1], -0.506, 8).rotation.x = Math.PI / 2; }); [0.85, 1.35].forEach(function (y) { c.box(0.03, 0.03, 0.5, MAT.gunmetal, -0.15, y, -0.27, { cast: false }); });
          c.box(0.62, 0.02, 0.44, MAT.gunmetal, 0.42, 0.01, 0.1, { cast: false }); c.box(0.62, 0.03, 0.015, MAT.gunmetal, 0.42, 0.025, 0.32, { cast: false }); c.box(0.62, 0.03, 0.015, MAT.gunmetal, 0.42, 0.025, -0.12, { cast: false });
          c.cyl(0.015, 0.015, 0.22, colorMat(0xb87333, 0.3, 1), -0.15, 0.45, -0.4, 10).rotation.x = Math.PI / 2; c.cyl(0.015, 0.015, 0.45, colorMat(0xb87333, 0.3, 1), -0.15, 0.225, -0.5, 10);
          c.box(0.22, 0.006, 0.22, MAT.black, -0.15, 0.064, 0.0, { cast: false, sharp: true });
        }); } catch (e) {}
    try { propExtra('fan', function (c) {
          c.cyl(0.022, 0.022, 0.02, MAT.chrome, -0.1, 0.05, 0.1, 12); c.lit(0x6fdc8c, 0.012, 0.012, 0.1, 0.0665, 0.1, 0, -Math.PI / 2);
          var cord = c.cyl(0.006, 0.006, 0.5, MAT.black, 0, 0.008, -0.4, 6); cord.rotation.x = Math.PI / 2;
        }); } catch (e) {}
    try { propExtra('soilSacks', function (c) {
          c.box(0.07, 0.008, 0.14, MAT.steel, 0.55, 0.287, 0.04, { cast: false }); var th = c.cyl(0.014, 0.012, 0.13, MAT.wood, 0.55, 0.296, -0.09, 10); th.rotation.x = Math.PI / 2;
          var heap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.soil); heap.scale.set(1, 0.35, 0.8); heap.position.set(0, 0.575, 0); c.add(heap);
          [[0, 0.3, -0.2], [0.55, 0, 0.3]].forEach(function (b) { var seam = c.box(0.02, 0.26, 0.33, colorMat(0x7a5634, 1), b[0] + 0.235, 0.14 + b[1], 0, { cast: false, sharp: true }); seam.rotation.y = b[2]; });
        }); } catch (e) {}
    try { propExtra('bucket', function (c) {
          c.cyl(0.014, 0.014, 0.1, MAT.white, 0, 0.46, 0, 10).rotation.z = Math.PI / 2; [0.1, 0.22].forEach(function (y) { var rb = new THREE.Mesh(new THREE.TorusGeometry(0.14 + y * 0.09, 0.005, 6, 28), colorMat(0x255f2a, 0.6)); rb.rotation.x = Math.PI / 2; rb.position.y = y; c.add(rb); });
          c.box(0.1, 0.04, 0.07, colorMat(0xf2d24a, 0.95), 0.27, 0.02, 0.08, { r: 0.012 }); var br = c.box(0.14, 0.03, 0.05, MAT.wood, 0.24, 0.04, -0.1); br.rotation.y = 0.5; var bs = c.box(0.13, 0.025, 0.045, colorMat(0xe8e0c8, 1), 0.24, 0.0125, -0.1, { cast: false, sharp: true }); bs.rotation.y = 0.5;
        }); } catch (e) {}
    try { propExtra('potShelf', function (c) {
          [-0.7, 0.7].forEach(function (a) { var br = c.box(0.02, 1.55, 0.015, MAT.metal, 0, 0.85, -0.14, { cast: false }); br.rotation.z = a; });
          [-0.55, 0.55].forEach(function (x) { c.box(0.08, 0.015, 0.32, MAT.black, x, 0.0075, 0, { cast: false }); });
          c.box(0.3, 0.05, 0.2, MAT.black, 0.03, 0.44, 0.03); c.box(0.27, 0.01, 0.17, MAT.soil, 0.03, 0.462, 0.03, { cast: false, sharp: true });
          for (var i = 0; i < 8; i++) { var sx = -0.075 + (i % 4) * 0.07, sz = -0.01 + Math.floor(i / 4) * 0.08; c.cyl(0.003, 0.003, 0.04, MAT.stem, sx, 0.485, sz, 5); leafAt(LEAF_GEO_SM, MAT.leaf, sx, 0.5, sz, i * 1.3, 0.9, 0.22, c.group); leafAt(LEAF_GEO_SM, MAT.leaf, sx, 0.5, sz, i * 1.3 + Math.PI, 0.9, 0.22, c.group); }
          [-0.4, 0, 0.4].forEach(function (x) { c.box(0.1, 0.035, 0.002, MAT.white, x, 1.0, 0.162, { cast: false, sharp: true }); });
        }); } catch (e) {}
    try { propExtra('lobbyBenchL', lobbyBenchExtra); } catch (e) {}
    try { propExtra('lobbyBenchR', lobbyBenchExtra); } catch (e) {}
    try { propExtra('magTable', function (c) {
          c.cyl(0.24, 0.24, 0.02, MAT.wood, 0, 0.2, 0, 24); var rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.01, 8, 40), MAT.brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.455; c.add(rim);
          c.cyl(0.05, 0.04, 0.07, MAT.ceramic, 0.17, 0.5, 0.15, 16); c.cyl(0.044, 0.044, 0.01, MAT.soil, 0.17, 0.532, 0.15, 12); for (var i = 0; i < 7; i++) leafAt(LEAF_GEO_SM, MAT.bigleaf, 0.17, 0.535, 0.15, i * 0.9, 0.5 + (i % 3) * 0.2, 0.2, c.group);
          var mg = c.box(0.28, 0.008, 0.2, colorMat(0x7cc4ff, 0.6), 0.02, 0.215, 0.03, { cast: false }); mg.rotation.y = -0.4; var mg2 = c.box(0.28, 0.008, 0.2, colorMat(0xe05a8a, 0.6), -0.02, 0.224, 0.0, { cast: false }); mg2.rotation.y = 0.2;
        }); } catch (e) {}
    try { propExtra('storeRack', function (c) {
          var guard = colorMat(0xf2c21a, 0.5, 0.2);
          [-1.5, 0, 1.5].forEach(function (x) { [-0.26, 0.26].forEach(function (z) { c.box(0.13, 0.012, 0.13, MAT.gunmetal, x, 0.006, z, { cast: false }); [[-0.04, -0.04], [0.04, 0.04]].forEach(function (b) { c.cyl(0.008, 0.008, 0.008, MAT.chrome, x + b[0], 0.016, z + b[1], 6); }); }); });
          [-1.5, 1.5].forEach(function (x) { c.box(0.11, 0.4, 0.05, guard, x, 0.2, 0.31, { r: 0.012 }); c.box(0.112, 0.06, 0.052, MAT.black, x, 0.3, 0.31, { cast: false, sharp: true }); c.box(0.112, 0.06, 0.052, MAT.black, x, 0.14, 0.31, { cast: false, sharp: true }); });
          for (var w = 0; w <= 24; w++) c.box(0.008, 2.2, 0.008, MAT.gunmetal, -1.5 + w * 0.125, 1.15, -0.3, { cast: false, sharp: true }); for (var hz = 0; hz < 9; hz++) c.box(3.0, 0.008, 0.008, MAT.gunmetal, 0, 0.15 + hz * 0.26, -0.3, { cast: false, sharp: true });
        }); } catch (e) {}
    try { propExtra('cellarHatch', function (c) {
          var yel = colorMat(0xf2c21a, 0.6), blk = colorMat(0x17181a, 0.7);
          for (var i = 0; i < 8; i++) { var m = i % 2 ? blk : yel, o = -0.56 + i * 0.16; c.box(0.16, 0.006, 0.08, m, o, 0.044, 0.6, { cast: false, sharp: true }); c.box(0.08, 0.006, 0.16, m, -0.6, 0.044, o, { cast: false, sharp: true }); c.box(0.08, 0.006, 0.16, m, 0.6, 0.044, o, { cast: false, sharp: true }); }
          [-0.4, 0.4].forEach(function (x) { var lp = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 16, Math.PI), yel); lp.position.set(x, 1.1, -0.51); lp.rotation.y = Math.PI / 2; c.add(lp); c.cyl(0.022, 0.022, 1.1, yel, x, 0.55, -0.6, 8); c.box(0.14, 0.04, 0.07, MAT.gunmetal, x, 0.06, -0.63, { cast: false }); });
          for (var r = 0; r < 3; r++) for (var t = 0; t < 5; t++) c.box(0.1, 0.004, 0.032, blk, -0.3 + t * 0.15, 0.137 + r * 0.3, -0.42, { cast: false, sharp: true });
          var strut = c.cyl(0.012, 0.012, 0.7, MAT.chrome, 0.56, 0.4, -0.35, 8); strut.rotation.x = 0.75;
        }); } catch (e) {}
    try { propExtra('cigCabinet', function (c) {
          var door = colorMat(0x353a41, 0.5, 0.5);
          warmStrip(c, 1.08, 0, 1.822, 0.245); c.box(1.2, 0.09, 0.012, MAT.steel, 0, 0.045, 0.206, { cast: false });
          [-0.29, 0.29].forEach(function (x) { c.box(0.55, 0.28, 0.014, door, x, 0.265, 0.206, { cast: false, r: 0.006 }); c.box(0.014, 0.12, 0.02, MAT.chrome, x - Math.sign(x) * 0.22, 0.27, 0.224, { cast: false }); });
          c.cyl(0.014, 0.014, 0.012, MAT.brass, 0, 0.36, 0.215, 12).rotation.x = Math.PI / 2;
          [-0.612, 0.612].forEach(function (x) { c.box(0.008, 1.5, 0.05, MAT.brass, x + Math.sign(x) * 0.018, 1.15, 0.18, { cast: false }); });
          c.sign(['18+', 'ID on request'], 0.26, 0.09, 0.4, 0.47, 0.214, 0, { size: 16, bg: '#f3e9cf', color: '#222', titleColor: '#c9302c', line: 'rgba(0,0,0,.25)' });
        }); } catch (e) {}
    try { propExtra('procShelf', function (c) {
          var shelfM = colorMat(0x8a8f96, 0.35, 0.8);
          [[-0.78, -0.2], [0.78, -0.2], [-0.78, 0.2], [0.78, 0.2]].forEach(function (p) { c.cyl(0.035, 0.035, 0.03, MAT.black, p[0], 0.035, p[1], 12).rotation.z = Math.PI / 2; c.box(0.05, 0.03, 0.05, MAT.gunmetal, p[0], 0.08, p[1], { cast: false }); });
          for (var s = 0; s < 4; s++) { c.box(1.6, 0.045, 0.012, shelfM, 0, 0.31 + s * 0.5, 0.228, { cast: false }); c.box(0.2, 0.03, 0.002, MAT.white, -0.5 + s * 0.3, 0.31 + s * 0.5, 0.236, { cast: false, sharp: true }); }
          [-0.7, 0.7].forEach(function (a) { var br = c.box(0.015, 1.9, 0.01, shelfM, 0, 0.95, -0.215, { cast: false }); br.rotation.z = a * 0.95; });
          c.box(0.2, 0.28, 0.008, colorMat(0x5a4632, 0.7), 0.805, 1.3, 0.0, { cast: false }).rotation.y = Math.PI / 2; c.box(0.17, 0.22, 0.002, MAT.white, 0.811, 1.29, 0.0, { cast: false, sharp: true }).rotation.y = Math.PI / 2; c.box(0.02, 0.025, 0.07, MAT.chrome, 0.812, 1.425, 0, { cast: false });
        }); } catch (e) {}
    try { propExtra('guardBoard', function (c) {
          [[0, 2.065, 1.06, 0.03], [0, 1.335, 1.06, 0.03]].forEach(function (f) { c.box(f[2], f[3], 0.035, MAT.alu, f[0], f[1], 0.005, { cast: false }); }); [-0.515, 0.515].forEach(function (x) { c.box(0.03, 0.76, 0.035, MAT.alu, x, 1.7, 0.005, { cast: false }); });
          c.box(0.5, 0.02, 0.09, MAT.alu, 0, 1.22, 0.045); c.box(0.5, 0.06, 0.008, MAT.alu, 0, 1.25, 0.088, { cast: false }); [[-0.15, 0x6fdc8c], [0.0, 0xffc857], [0.15, 0x7cc4ff]].forEach(function (l) { c.box(0.11, 0.16, 0.012, colorMat(l[1], 0.8), l[0], 1.31, 0.05, { cast: false }).rotation.x = -0.15; });
        }); } catch (e) {}
    try { propExtra('bookshelf', bookshelfExtra(1.0, 1.8)); } catch (e) {}
    try { propExtra('upBooks', bookshelfExtra(1.6, 2.0)); } catch (e) {}
    try { propExtra('lobbyCoffee', function (c) {
          if (!S.upgrades.lobby) return;
          var door = colorMat(0x2a1c10, 0.6);
          [-0.147, 0.147].forEach(function (x) { c.box(0.275, 0.72, 0.014, door, x, 0.5, 0.256, { cast: false, r: 0.006 }); c.box(0.012, 0.14, 0.02, MAT.chrome, x - Math.sign(x) * 0.1, 0.62, 0.272, { cast: false }); }); c.box(0.6, 0.08, 0.012, MAT.black, 0, 0.04, 0.256, { cast: false });
          var wand = c.cyl(0.006, 0.006, 0.15, MAT.chrome, -0.215, 1.08, 0.06, 8); wand.rotation.z = 0.22; c.cyl(0.012, 0.012, 0.02, MAT.black, -0.2, 1.15, 0.06, 10); c.cyl(0.009, 0.007, 0.02, MAT.chrome, -0.232, 1.0, 0.06, 8);
          [-0.182, 0.182].forEach(function (x) { for (var v = 0; v < 5; v++) c.box(0.004, 0.01, 0.2, MAT.black, x, 1.2 + v * 0.03, -0.06, { cast: false, sharp: true }); });
          c.box(0.13, 0.06, 0.1, MAT.gunmetal, -0.22, 0.97, -0.14, { r: 0.008 }); for (var s = 0; s < 5; s++) { var st = c.cyl(0.003, 0.003, 0.11, MAT.wood, -0.26 + s * 0.02, 1.03, -0.14, 5); st.rotation.z = (s - 2) * 0.08; }
        }); } catch (e) {}
    try { propExtra('vending', function (c) {
          var dark = colorMat(0x1a1d21, 0.6);
          c.box(0.012, 1.3, 0.02, emitMat(0xeaf6ff, 1.3), -0.405, 1.12, 0.27, { cast: false, sharp: true });
          c.box(0.012, 1.78, 0.012, MAT.chrome, 0.19, 1.03, 0.362, { cast: false }); c.box(0.99, 0.02, 0.02, MAT.chrome, 0, 1.935, 0.37, { cast: false });
          c.box(0.11, 0.15, 0.03, MAT.gloss, 0.315, 0.74, 0.368, { cast: false, r: 0.008 }); c.lit(0x39a0ff, 0.07, 0.05, 0.315, 0.765, 0.3845); c.lit(0x6fdc8c, 0.07, 0.008, 0.315, 0.69, 0.3845);
          for (var v = 0; v < 8; v++) { c.box(0.004, 0.014, 0.34, dark, 0.477, 0.3 + v * 0.045, 0, { cast: false, sharp: true }); c.box(0.004, 0.014, 0.34, dark, -0.477, 0.3 + v * 0.045, 0, { cast: false, sharp: true }); }
          [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(function (p) { c.box(0.1, 0.012, 0.1, MAT.black, p[0], 0.006, p[1] * 1.15, { cast: false, sharp: true }); });
          c.box(0.56, 0.035, 0.012, MAT.chrome, -0.13, 0.575, 0.362, { cast: false }); c.sign(['take it from the tray'], 0.4, 0.04, -0.13, 0.26, 0.362, 0, { size: 14, bg: '#1a1d21', titleColor: '#cfd6dc', line: 'rgba(0,0,0,0)' });
        }); } catch (e) {}
    try { propExtra('goodsShelf', function (c) {
          var w = goodsWidth(); [1.3, 1.86].forEach(function (y) { warmStrip(c, w - 0.2, 0, y - 0.026, 0.14); }); warmStrip(c, w - 0.2, 0, 1.99, 0.14);
          [-1, 1].forEach(function (s) { c.box(0.012, 1.9, 0.012, MAT.brass, s * (w / 2 + 0.002), 1.0, 0.31, { cast: false }); });
        }); } catch (e) {}
    try { propExtra('vipTable', function (c) {
          var brass = colorMat(0xc9a24a, 0.35, 0.8), plush = colorMat(0x6e2a4a, 0.95);
          var rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.012, 8, 44), brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.625; c.add(rim);
          c.box(3.3, 0.012, 1.9, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x2a1420, roughness: 1 }), 0, 0.006, 0, { cast: false, sharp: true }); c.box(3.0, 0.004, 1.6, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x4a2034, roughness: 1 }), 0, 0.014, 0, { cast: false, sharp: true });
          [-0.95, 0.95].forEach(function (x) { var sd = x > 0 ? 1 : -1; c.box(0.5, 0.1, 0.5, plush, x - sd * 0.06, 0.5, 0, { r: 0.04 }); var bc = c.box(0.1, 0.4, 0.48, plush, x + sd * 0.215, 0.76, 0, { r: 0.04 }); for (var b = 0; b < 4; b++) c.cyl(0.012, 0.012, 0.012, brass, x + sd * 0.16, 0.68 + Math.floor(b / 2) * 0.18, -0.12 + (b % 2) * 0.24, 8).rotation.z = Math.PI / 2; [-0.32, 0.32].forEach(function (z) { c.box(0.62, 0.02, 0.13, brass, x, 0.74, z, { cast: false, r: 0.008 }); }); });
          [[-0.28, 0.12], [0.26, -0.14]].forEach(function (g) { c.cyl(0.045, 0.045, 0.006, MAT.black, g[0], 0.648, g[1], 16); c.cyl(0.032, 0.026, 0.085, MAT.jar, g[0], 0.693, g[1], 14); c.cyl(0.028, 0.024, 0.03, colorMat(0xd9a23a, 0.3, 0, { transparent: true, opacity: 0.8 }), g[0], 0.667, g[1], 12); });
          c.cyl(0.06, 0.05, 0.02, MAT.gunmetal, 0.02, 0.655, -0.25, 16);
        }); } catch (e) {}
    try { propExtra('hallClockTable', function (c) {
          c.box(0.4, 0.1, 0.014, MAT.darkwood, 0, 0.63, 0.247, { cast: false, r: 0.006 }); c.cyl(0.012, 0.012, 0.02, MAT.brass, 0, 0.63, 0.262, 10).rotation.x = Math.PI / 2;
          var ck = c.cyl(0.055, 0.055, 0.035, MAT.brass, 0.13, 0.785, 0.14, 24); ck.rotation.x = Math.PI / 2; var cf = c.cyl(0.046, 0.046, 0.004, MAT.white, 0.13, 0.785, 0.159, 24); cf.rotation.x = Math.PI / 2; var h1 = c.box(0.004, 0.035, 0.002, MAT.black, 0.13, 0.797, 0.162, { cast: false, sharp: true }); var h2 = c.box(0.003, 0.028, 0.002, MAT.black, 0.141, 0.785, 0.162, { cast: false, sharp: true }); h2.rotation.z = Math.PI / 2; c.box(0.09, 0.012, 0.04, MAT.brass, 0.13, 0.726, 0.14, { cast: false });
          [[0.3, 0x8a2a2a], [0.26, 0x2f6b9a], [0.22, 0xe0c25a]].forEach(function (b, i) { c.box(b[0], 0.035, 0.2, colorMat(b[1], 0.85), 0.02, 0.284 + i * 0.036, 0, { cast: false }).rotation.y = (i - 1) * 0.15; });
        }); } catch (e) {}
    try { propExtra('dining', function (c) {
          [-0.38, 0.38].forEach(function (z) { c.box(1.38, 0.08, 0.03, MAT.darkwood, 0, 0.675, z, { cast: false }); }); [-0.72, 0.72].forEach(function (x) { c.box(0.03, 0.08, 0.74, MAT.darkwood, x, 0.675, 0, { cast: false }); });
          c.box(1.62, 0.004, 0.3, fabricMat(0xefe6d2), 0, 0.779, 0, { cast: false, sharp: true });
          [-0.35, 0.35].forEach(function (x) { var rng = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.006, 6, 28), colorMat(0x2f6b9a, 0.4)); rng.rotation.x = Math.PI / 2; rng.position.set(x, 0.794, 0); c.add(rng); c.box(0.1, 0.012, 0.1, fabricMat(0x3a5a3a), x - 0.3, 0.786, 0.22, { cast: false }).rotation.y = 0.4; });
          c.cyl(0.018, 0.016, 0.06, MAT.white, 0.13, 0.808, 0.12, 10); c.cyl(0.018, 0.016, 0.06, colorMat(0x3a3a3a, 0.5), 0.17, 0.808, 0.1, 10); c.cyl(0.019, 0.019, 0.012, MAT.chrome, 0.13, 0.842, 0.12, 10); c.cyl(0.019, 0.019, 0.012, MAT.chrome, 0.17, 0.842, 0.1, 10);
          c.box(0.34, 0.02, 0.2, MAT.wood, -0.02, 0.79, -0.26, { cast: false, r: 0.008 }).rotation.y = 0.2; var loaf = c.box(0.2, 0.08, 0.1, colorMat(0xb8793a, 0.9), -0.02, 0.84, -0.26, { r: 0.04 }); loaf.rotation.y = 0.2;
          c.box(2.6, 0.012, 2.4, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x3d4a3a, roughness: 1 }), 0, 0.006, 0, { cast: false, sharp: true });
        }); } catch (e) {}
    try { propExtra('couchUp', function (c) {
          c.box(0.45, 0.04, 0.45, MAT.wood, 1.6, 0.55, -0.1, { r: 0.012 }); legs4({ box: function (a, b, e, m, px, py, pz) { return c.box(a, b, e, m, px + 1.6, py, pz - 0.1); } }, 0.45, 0.45, 0.53, MAT.darkwood, 0.05, 0.035);
          c.cyl(0.06, 0.045, 0.09, MAT.ceramic, 1.6, 0.615, -0.1, 16); for (var i = 0; i < 9; i++) leafAt(LEAF_GEO_SM, MAT.bigleaf, 1.6, 0.66, -0.1, i * 0.7, 0.4 + (i % 3) * 0.22, 0.34, c.group);
          for (var f = 0; f < 30; f++) { c.box(0.012, 0.004, 0.09, colorMat(0xd8c9a8, 1), -2.2 + f * 0.152, 0.006, 3.24, { cast: false, sharp: true }); c.box(0.012, 0.004, 0.09, colorMat(0xd8c9a8, 1), -2.2 + f * 0.152, 0.006, -0.44, { cast: false, sharp: true }); }
          c.solid(1.35, 1.85, -0.35, 0.15);
        }); } catch (e) {}
    try { propExtra('bed', function (c) {
          c.box(1.72, 0.06, 0.13, MAT.wood, 0, 1.08, -1.05, { r: 0.02 }); c.box(1.64, 0.5, 0.06, MAT.darkwood, 0, 0.27, 1.07, { r: 0.012 }); c.box(1.7, 0.05, 0.09, MAT.wood, 0, 0.54, 1.07, { r: 0.015 });
          c.box(1.57, 0.035, 0.42, fabricMat(0xe0c25a), 0, 0.787, 0.76, { r: 0.015 }); c.box(1.58, 0.1, 0.03, fabricMat(0xe0c25a), 0, 0.73, 1.0, { cast: false });
          [-0.34, 0.34].forEach(function (x) { c.box(0.5, 0.1, 0.34, fabricMat(0x3a6a4a), x, 0.79, -0.6, { r: 0.045 }).rotation.x = 0.5; });
          c.box(0.55, 0.02, 0.5, MAT.wood, 1.1, 0.558, -0.9, { cast: false });
          [-0.34, -0.16].forEach(function (x, i) { var sl = c.box(0.1, 0.05, 0.26, fabricMat(0x8a4a2a), x, 0.045, 1.35, { r: 0.022 }); sl.rotation.y = i ? 0.08 : -0.12; c.box(0.1, 0.04, 0.12, fabricMat(0x6e3a20), x + (i ? 0.005 : -0.008), 0.075, 1.28, { r: 0.018 }).rotation.y = i ? 0.08 : -0.12; });
        }); } catch (e) {}
    try { propExtra('windowSeat', function (c) {
          for (var i = 0; i < 6; i++) { c.box(0.9, 0.3, 0.014, MAT.darkwood, -2.5 + i * 1.0, 0.245, 0.306, { cast: false, r: 0.008 }); c.cyl(0.014, 0.014, 0.02, MAT.brass, -2.5 + i * 1.0, 0.33, 0.32, 10).rotation.x = Math.PI / 2; }
          c.box(6.02, 0.07, 0.02, MAT.darkwood, 0, 0.035, 0.31, { cast: false }); c.box(6.04, 0.025, 0.64, MAT.wood, 0, 0.455, 0.0, { cast: false });
          [-2, -1, 0, 1, 2].forEach(function (x) { c.box(0.012, 0.082, 0.6, fabricMat(0x2f4a30), x, 0.49, 0, { cast: false, sharp: true }); }); c.box(6.0, 0.02, 0.02, fabricMat(0x2f4a30), 0, 0.52, 0.295, { cast: false });
          c.box(0.5, 0.09, 0.36, fabricMat(0xc9b28a), 2.7, 0.575, 0.0, { r: 0.03 }); c.box(0.5, 0.05, 0.36, fabricMat(0xb89a6e), 2.7, 0.64, 0.0, { r: 0.022 });
          c.cyl(0.04, 0.035, 0.09, colorMat(0x6fdc8c, 0.5), 1.55, 0.575, 0.12, 14);
        }); } catch (e) {}
    try { propExtra('upRug', function (c) {
          var cream = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0xd8c9a8, roughness: 1 });
          [-1.0, 1.0].forEach(function (z) { c.box(3.0, 0.004, 0.035, cream, 0, 0.026, z, { cast: false, sharp: true }); }); [-1.5, 1.5].forEach(function (x) { c.box(0.035, 0.004, 2.035, cream, x, 0.026, 0, { cast: false, sharp: true }); });
          var dia = c.box(0.9, 0.004, 0.9, cream, 0, 0.0255, 0, { cast: false, sharp: true }); dia.rotation.y = Math.PI / 4; var di2 = c.box(0.72, 0.004, 0.72, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x6a4f7a, roughness: 1 }), 0, 0.027, 0, { cast: false, sharp: true }); di2.rotation.y = Math.PI / 4;
          for (var f = 0; f < 26; f++) [-1.85, 1.85].forEach(function (x) { c.box(0.1, 0.004, 0.014, cream, x, 0.006, -1.25 + f * 0.1, { cast: false, sharp: true }); });
        }); } catch (e) {}
    try { propExtra('upDresser', function (c) {
          c.box(1.23, 0.07, 0.53, MAT.black, 0, 0.035, 0, { cast: false });
          [-0.055, 0.455].forEach(function (x) { c.box(0.015, 0.62, 0.035, MAT.brass, x, 1.3, -0.195, { cast: false }); }); [0.995, 1.605].forEach(function (y) { c.box(0.525, 0.015, 0.035, MAT.brass, 0.2, y, -0.195, { cast: false }); });
          c.box(0.3, 0.014, 0.2, MAT.brass, 0.3, 0.947, 0.1, { cast: false, r: 0.006 }); [[0.22, 0xe05a8a, 0.09], [0.3, 0x7cc4ff, 0.12], [0.38, 0xf0b94d, 0.07]].forEach(function (b) { c.cyl(0.022, 0.026, b[2], colorMat(b[1], 0.15, 0, { transparent: true, opacity: 0.8 }), b[0], 0.954 + b[2] / 2, 0.1, 12); c.cyl(0.01, 0.01, 0.025, MAT.brass, b[0], 0.966 + b[2], 0.1, 8); });
          c.box(0.22, 0.05, 0.16, colorMat(0x3a2418, 0.6), -0.1, 0.965, 0.12, { r: 0.012 });
        }); } catch (e) {}
    // each Grow prop as an engine prop: Grow's own build context on the prop's group, its obstacles as solids, a use that says what it is
    var LABEL_OVERRIDE = {};
    G_ORDER.forEach(function (gid) {
      var d = G_DEFS[gid]; if (!d || typeof d.build !== 'function') return;
      var label = LABEL_OVERRIDE[gid] || d.label || gid;
      defProp('gc' + gid.charAt(0).toUpperCase() + gid.slice(1), { extra: true, shop: false, label: label, cat: 'grow co', desc: 'From Grow Co.: ' + label + '.', build: function (c, P, inst) {
        var g = growPropCtx(c.group, c.id, 0), gh = g.hit; g.light = function (l, x, y, z) { l.position.set(x, y, z); c.group.add(l); return l; };
        g.hit = function (w, h, dd, x, y, z, data) { var m = gh.apply(g, arguments); c.hit(w, h, dd, x, y, z, { prompt: function () { return 'The ' + label; }, use: function () { toast('The ' + label + ' (from Grow Co.)', ''); } }); return m; };
        var oldWG = world.group; world.group = c.group; world.tentGroup = null;   /* a prop that builds into the shop's world (the tent) builds into its own group, at its own origin */
        try { d.build(g, Object.assign({}, P || {}, { x: 0, z: 0, rot: 0, floor: 0, unit: 1, hidden: false }), inst); } finally { world.group = oldWG; }
        (g.obstacles || []).forEach(function (o) { c.solid(Math.min(o.x1, o.x2), Math.max(o.x1, o.x2), Math.min(o.z1, o.z2), Math.max(o.z1, o.z2), 0, 2.4); });
      } });
    });
    // the fixtures: each builds into a scratch group (the shop built them straight into its world), which is re-centred on its footprint and set on the floor
    G_FIX.forEach(function (fx) {
      defProp('gc' + fx.id.charAt(0).toUpperCase() + fx.id.slice(1), { extra: true, shop: false, label: fx.label, cat: 'grow co', desc: 'From Grow Co.: the ' + fx.label + '. It sits on the floor: raise it onto a counter with PageUp or the height field.', build: function (c) {
        var tmp = new THREE.Group(), oldRoot = CO.root, oldWG = world.group; CO.root = tmp; world.group = tmp; world.reg = world.reg || { drawerT: 0, lastSale: null };
        try { fx.fn(); } catch (e) {} finally { CO.root = oldRoot; world.group = oldWG; }
        tmp.updateMatrixWorld(true); var b3 = new THREE.Box3().setFromObject(tmp); if (b3.isEmpty()) return; var cx = (b3.min.x + b3.max.x) / 2, cz = (b3.min.z + b3.max.z) / 2, y0 = b3.min.y;
        tmp.children.slice().forEach(function (ch) { ch.position.x -= cx; ch.position.z -= cz; ch.position.y -= y0; c.group.add(ch); });
        c.hit(Math.max(0.2, b3.max.x - b3.min.x), Math.max(0.2, b3.max.y - b3.min.y), Math.max(0.2, b3.max.z - b3.min.z), 0, (b3.max.y - b3.min.y) / 2, 0, { prompt: function () { return 'The ' + fx.label; }, use: function () { toast('The ' + fx.label + ' (from Grow Co.)', ''); } });
      } });
    });
    // the pack's own materials by name, for a prop read back as parts in the Model tab (Co Engine 0.8.0): a getter, so a cache filled later is seen
    CO.packMats = CO.packMats || {}; CO.packMats.growco = function () { return { money: money, gram: gram, STRAINS: STRAINS, strainById: strainById, SUPPLIES: SUPPLIES, LIGHTS: LIGHTS, TENTS: TENTS, UPGRADES: UPGRADES, LICENCES: LICENCES, DLC_NAME: DLC_NAME, DRY_MS_BASE: DRY_MS_BASE, CURE_CAP_BASE: CURE_CAP_BASE, THIRST_RATE: THIRST_RATE, HAZARD_CHANCE: HAZARD_CHANCE, SAVE_V: SAVE_V, ECON: ECON, COST: COST, ROOM: ROOM, TEX: TEX, SIGN_FONT: SIGN_FONT, MAT: MAT, disposeKeep: disposeKeep, BLOB_TEX: BLOB_TEX, BLOB_MAT: BLOB_MAT, FROND_GEO: FROND_GEO, BIGLEAF_GEO: BIGLEAF_GEO, tentLight: tentLight, tentFill: tentFill, WALL_T: WALL_T, TENT_ORIGIN: TENT_ORIGIN, LEAF_GEO: LEAF_GEO, LEAF_GEO_SM: LEAF_GEO_SM, BUD_GEO: BUD_GEO, GOODS_ROWS: GOODS_ROWS, GOODS_CELL: GOODS_CELL, RACK: RACK, SKINS: SKINS, HAIRS: HAIRS, SHIRTS: SHIRTS, PANTS: PANTS, faceCache: faceCache, HUMAN_GEO: HUMAN_GEO, guard: guard, WORKER_HIRE: WORKER_HIRE, WORKER_WAGE: WORKER_WAGE, CREW_MAX: CREW_MAX, CREW_LOOK: CREW_LOOK, WORKER_TASKS: WORKER_TASKS, GUARD_TASKS: GUARD_TASKS, WORKER_NONE: WORKER_NONE, crew: crew, worker: worker, ORDER_WAIT: ORDER_WAIT, VAN_TRIP: VAN_TRIP, courier: courier, CIG_SKUS: CIG_SKUS, TOB: TOB, tobUI: tobUI, FLORA: FLORA, DIVX: DIVX, CIG_KEYS: CIG_KEYS, exp: exp, BRANCH_PAY: BRANCH_PAY, BRANCH_CAP: BRANCH_CAP, FIXTURES: FIXTURES, fxById: fxById, fxSignCount: fxSignCount, fxRay: fxRay, fxTick: fxTick, DESK_PAGES: DESK_PAGES, DESK_PAGE_LABEL: DESK_PAGE_LABEL, DESK_INK: DESK_INK, DESK_DIM: DESK_DIM, DESK_MUTE: DESK_MUTE, DESK_OK: DESK_OK, DESK_WARN: DESK_WARN, DESK_BAD: DESK_BAD, DESK_TAB_X: DESK_TAB_X, DESK_TAB_W: DESK_TAB_W, DESK_TAB_H: DESK_TAB_H, DESK_TAB_Y: DESK_TAB_Y, DESK_FONT: DESK_FONT, SCR_MONO: SCR_MONO, SCR_EMOJI: SCR_EMOJI, PC_APPS: PC_APPS, wheel: wheel, ROPE_COLORS: ROPE_COLORS, ROPE_POSTS: ROPE_POSTS, ROPE_LENS: ROPE_LENS, ropeGates: ropeGates, ropeSegList: ropeSegList, PROD_M: PROD_M, DLCX: DLCX, BREED: BREED, CUP: CUP, FIN: FIN, HYDRO: HYDRO, MERCH: MERCH, TEE_GEO: TEE_GEO, MERCH_COLS: MERCH_COLS, CIGAR: CIGAR, LAB_TECH: LAB_TECH, DLC_UPG: DLC_UPG, DLC_UPG_ORDER: DLC_UPG_ORDER, S: S }; };
  };
  if (CO.cfg && typeof scene !== 'undefined' && scene) growcoPack(MAT, TEX); else hook('beforeBuild', function () { growcoPack(MAT, TEX); });
