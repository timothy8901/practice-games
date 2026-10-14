/*
 * UNDERBYTE — js/engine.js
 * Owner: ENGINE ARCHITECT (do not edit from other modules).
 * Contract: CONTRACT.md §2 (tick/render order), §8 (UB.Engine / game API), §9 (UB.debug).
 * Design: DESIGN.md §3 (rules), §5.5 (exits, nodes, movers), §8.0 (boss sequence),
 *         §9 (pickups, vendor), §11.3 (camera, transitions), §12.18 (lore card trigger),
 *         §14 (save), §16.9 (debug API).
 *
 * The Game object owns: the screen state machine, the fixed-60 Hz logic tick
 * (driven by main.js's accumulator — nothing here reads wall-clock time),
 * room loading + runtime level state (crumble, movers, seals), the entity
 * lists, hit resolution, contact + hazards, pickups and drops, restore nodes,
 * the vendor (prompt, purchases, item effects), control hints and lore-card
 * triggers, exits + room transitions, boss fight sequencing, death/respawn,
 * save/load (with full validation), the camera, and rendering composition.
 * It never draws a character itself: characters/enemies/bosses/UI/FX draw
 * through their hooks.
 */
'use strict';
(function (UB) {
  const W = 960, H = 540, TILE = 30;
  const E = UB.Entity, FX = UB.FX, In = UB.Input, Au = UB.Audio, U = UB.Util, Wd = UB.World, R = UB.Render, UI = UB.UI, P = UB.Palette;
  const IDS = UB.IDS;
  const SAVE_KEY = 'underbyte.save', SETTINGS_KEY = 'underbyte.settings';
  const SAVE_VERSION = 1;
  const MAX_HITS = 64;
  const MAX_PROJECTILES = 64;   // oldest-first eviction (CONTRACT §7)
  const OFFROOM = 64;           // projectiles further than this outside the room are culled (px)
  const MAX_CORES = 4;          // HUD draws ≤ 9 hearts; base hp ≤ 6 (DESIGN §16.7) → at most 3 real cores (+1 debug)

  // Timings (frames) pinned by DESIGN.md.
  const T = {
    freeze: 6, slide: 18, settle: 4,
    hazardFreeze: 30, hazardFade: 10, hazardIFrames: 45, hazardHitstop: 6,
    deathFrames: 60, gameOverFade: 40, respawnFade: 20,
    bossIntro: 150, bossSeal: 12, pickupSeq: 120, bossDeath: 90,
    nodePulse: 30, crumbleShake: 20, crumbleGone: 180, crumbleBack: 6,
    zoneToast: 150, loreDelay: 90, loreHold: 240, selectFade: 20, chuteLaunch: 1.2, chuteIFrames: 20, topArrivalVy: 120,
    shopBanner: 150,
  };
  const BIT_VALUE = { small: 1, medium: 5, large: 20 };
  const PICKUP_SIZE = { bit: 10, heart: 14, spark: 12, shard: 12, core: 18, ability: 24 };
  const VENDOR = IDS.vendorItems;
  // save.hints (DESIGN §14.1): the control-hint strip's seven actions, plus `drop` — the one-time "Down + Jump drops
  // through" hint (playtest B19), which the UI shows once per run and records here so it survives a reload / CONTINUE
  const HINT_KEYS = ['move', 'jump', 'light', 'heavy', 'special', 'dash', 'overclock', 'drop'];
  // Ability banner lines (DESIGN §12.7 / §15.5). UI/WORLD implementers may replace via UB.Text later.
  const ABILITY_TEXT = {
    echoJump: ['ECHO JUMP ACQUIRED', 'Press JUMP again in the air', 'A second thought, taken mid-fall.'],
    burstLine: ['BURST LINE ACQUIRED', 'Press DASH (Shift / RB) to lunge 6 tiles — on the ground or once in the air', 'Skip the frames you do not need.'],
    gripProtocol: ['GRIP PROTOCOL ACQUIRED', 'Hold toward a wall in the air to cling · JUMP to kick off', 'The walls were never the problem.'],
  };
  // reducedFlashing (playtest B42, DESIGN §14.2): full-screen flashes become a thin edge pulse (UB.FX reads it live) at
  // half intensity (FX.setFlashScale, F02), and the hero / boss / enemy strobes hold steady.
  // steadySilhouette (F02): the i-frame blink never takes the hero away — the body stays drawn with a steady outline.
  // hazardOutline (F05): every hazard tile and every hazardous enemy/boss attack box gets a high-contrast hatched rim.
  // Old settings files simply lack the new keys: loadSettings fills every missing key with its default.
  const DEFAULT_SETTINGS = { version: 1, master: 8, music: 7, sfx: 8, screenShake: true, reducedFlashing: false, steadySilhouette: false,
    hazardOutline: false, showHitboxes: false, touchControls: 'auto' };
  const REDUCED_FLASH_SCALE = 0.5;   // FX.flashScale while REDUCED FLASHING is on (the edge pulse is also capped at α 0.45)
  // F06: a boss intro card the player has already sat through once can be skipped (confirm / jump / an attack press)
  const INTRO_SKIP_FROM = 4;          // frames into the intro before a skip press counts (a press that opened it never does)
  // F07 Restore Echo: a boss that has beaten the player this many times gets a recovered-memory tip at the next rest
  const ECHO_DEATHS = 2;
  const HAZARD_TINT = 3;   // F02: player.flash ≤ 4 draws the DANGER tint (no white); held through the hazard freeze when steady

  function warnOnce(key, msg) {
    warnOnce.seen = warnOnce.seen || Object.create(null);
    if (warnOnce.seen[key]) return;
    warnOnce.seen[key] = true;
    console.warn('[UB] ' + msg);
  }

  // =============================================================================================
  function Game(canvas) {
    this.canvas = canvas;
    this.mctx = canvas.getContext('2d');
    this.dpr = 1;
    this.world = R.makeCanvas(W, H); this.wctx = this.world.getContext('2d');
    this.snap = R.makeCanvas(W, H);
    this.screen = 'title'; this.overlay = null; this.overlayFrom = null; this.screenT = 0;
    // overlays stack (pause → settings → controls; lore → pause): closeOverlay() returns to the one below.
    // `overlayFrom` mirrors the top of this stack (the overlay a close returns to).
    this.overlayStack = [];
    this.busy = false;                 // a fade/transition owns the flow: menus ignore input
    this.frame = 0; this.fps = 0;
    this.save = null; this.savedData = null; this.settings = null;
    this.level = null; this.zone = null; this.player = null;
    this.enemies = []; this.boss = null; this.projectiles = []; this.pickups = [];
    this.hits = []; this.hitCount = 0;
    for (let i = 0; i < MAX_HITS; i++) this.hits.push(null);
    this.dbgHits = []; this.dbgHitCount = 0;
    for (let i = 0; i < MAX_HITS; i++) this.dbgHits.push({ x: 0, y: 0, w: 0, h: 0, owner: '' });
    this.cam = { x: 0, y: 0, px: 0, py: 0, look: 0 };
    this.mode = 'normal';              // normal|transition|hazard|nodeUse|bossIntro|pickupSeq|dying
    this.transition = { phase: '', timer: 0, exit: null, dx: 0, dy: 0 };
    this.hazard = { timer: 0, kind: null };
    this.hazardRespawn = { x: 0, y: 0, vy: 0, iframes: 0, pending: false };   // the arrival spawn incl. its launch; a chute arrival moves it to the first footing taken (DESIGN §3.3)
    this.hazardTo = { x: 0, y: 0, on: false };               // one-off respawn override (Corrosant's Flood → nearest grate, DESIGN §8.3)
    this.zoom = { x: 0, y: 0, t: 0 };                        // 1-frame 2 % impact zoom (DESIGN §11.3.3)
    this.curSong = null;                                     // the song loadRoom last chose (null = quiet room)
    this.bossFight = { state: 'none', timer: 0 };   // none|intro|fight|dying|reward|done
    this.pickupSeq = { timer: 0, pickup: null };
    this.nodeUse = { timer: 0, node: null };
    this.fadeLevel = 0; this.fadeTarget = 0; this.fadeStep = 0; this.fadeCb = null; this.fadeT = 0;
    this.god = false; this.logicPaused = false;
    this.promptObj = { text: '', x: 0, y: 0 }; this.prompt = null;   // game.prompt = promptObj while a prompt shows, else null
    this.nearNode = null; this.nearVendor = false;
    this.denyFlash = 0;
    this.loreTimer = 0; this.loreZone = null;       // pending zone lore card (DESIGN §12.18)
    this.loreCard = null;                            // the zone whose card the 'lore' overlay shows (UI reads it)
    this.shopBought = null;                          // item bought while the shop is open → banner on close
    this.ledgeOn = -1;                               // F04: index of the Signal Ledge that holds this visit's hazard respawn (−1 none)
    this.ledgeT = 0;                                 // frames since that ledge was lit (its touch pulse)
    this.introSkipped = false;                       // F06: this intro was skipped (the card exits early)
    this.lastFighter = 'tessik';
    this.rng = U.rng(0x5EED);
    this.scratch = { x: 0, y: 0 };
    this.box = { x: 0, y: 0, w: 0, h: 0 };
    this.hurtOpts = { hit: null };     // passed to player.hurt for registered hits (the descriptor; contact passes null)
  }
  Game.ABILITY_TEXT = ABILITY_TEXT;
  Game.VENDOR = VENDOR;

  Game.prototype.init = function () {
    this.loadSettings();
    FX.init();
    UI.init(this);
    In.onGesture(function () { Au.init(); });
    this.savedData = this.readSave();
    this.setScreen('title');
    Au.music('title');
  };
  /** main.js: set the device pixel ratio (canvas backing size) — cheap to call again on resize. */
  Game.prototype.setDpr = function (dpr) {
    dpr = Math.max(1, Math.min(2, dpr || 1));
    if (dpr === this.dpr && this.canvas.width === Math.round(W * dpr)) return;
    this.dpr = dpr;
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    this.canvas.width = bw; this.canvas.height = bh;
    this.world.width = bw; this.world.height = bh;
    this.snap.width = bw; this.snap.height = bh;
    R.setScale(dpr);   // backgrounds / fog / vignette caches follow the backing scale (no per-frame upscaling)
    if (this.level) R.buildTileCache(this.level, dpr);
  };

  // --- screens --------------------------------------------------------------------------------
  Game.prototype.setScreen = function (name) {
    this.screen = name; this.overlay = null; this.overlayFrom = null; this.overlayStack.length = 0; this.screenT = 0;
    UI.enter(name, this);
  };
  /**
   * Overlays: 'pause' | 'map' | 'settings' | 'shop' | 'lore' | 'controls' (F01) | 'archive' (F06). The UI handles their
   * input and drawing. Opening one over another stacks it (pause → settings → controls, lore → pause); closeOverlay()
   * returns to the one below, the base screen after the last.
   */
  Game.prototype.openOverlay = function (name) {
    if (this.overlay === name) return;
    if (this.overlay) this.overlayStack.push(this.overlay);
    this.overlayFrom = this.overlay; this.overlay = name; UI.enter(name, this);
    In.clearBuffers();   // a buffered jump/attack must not fire when play resumes (DESIGN §2.5)
    if (this.screen === 'play') { Au.duck(0.4, 0.17); Au.stopLoops(); }
  };
  Game.prototype.closeOverlay = function () {
    const was = this.overlay;
    this.overlay = this.overlayStack.length ? this.overlayStack.pop() : null;
    this.overlayFrom = this.overlayStack.length ? this.overlayStack[this.overlayStack.length - 1] : null;
    In.clearBuffers();   // the confirm key that closed the menu shares keys with jump/light: never carry it into play
    if (this.overlay) UI.enter(this.overlay, this);
    else { if (this.screen !== 'play') UI.enter(this.screen, this); Au.duck(1, 0.17); }
    if (was === 'shop' && this.shopBought) {   // DESIGN §9.5: the PURCHASED banner shows after the panel closes
      UI.banner(this.shopBought.name + ' PURCHASED', this.shopBought.effect, '', T.shopBanner);
      this.shopBought = null;
    }
  };
  Game.prototype.toTitle = function () {
    this.busy = false; this.mode = 'normal'; this.level = null; this.player = null; this.boss = null;
    this.enemies.length = 0; this.pickups.length = 0; this.dropProjectiles();
    this.loreTimer = 0; this.loreZone = null; this.shopBought = null; this.prompt = null; this.nearNode = null; this.nearVendor = false;
    // no fight, sequence or freeze outlives the run (playtest B22: a quit mid-fight left bossFight 'fight' on the title)
    this.bossFight.state = 'none'; this.bossFight.timer = 0; this.pickupSeq.timer = 0; this.pickupSeq.pickup = null;
    this.nodeUse.timer = 0; this.nodeUse.node = null; this.transition.phase = ''; this.transition.timer = 0;
    this.hazard.timer = 0; this.hazardTo.on = false; this.hazardRespawn.pending = false; this.zoom.t = 0; this.denyFlash = 0;
    this.ledgeOn = -1; this.ledgeT = 0; this.dbgHitCount = 0; this.introSkipped = false;
    FX.hitstopFrames = 0;
    FX.clear(); UI.clearMessages();
    this.savedData = this.readSave();
    this.setScreen('title'); Au.music('title'); Au.stopAmbient(); Au.stopLoops(); Au.duck(1, 0.2);
    this.fadeLevel = 0; this.fadeTarget = 0; this.fadeCb = null;
  };
  Game.prototype.toSelect = function () { this.setScreen('select'); };
  Game.prototype.hasSave = function () { return !!this.savedData; };
  Game.prototype.saveSummary = function () {
    const s = this.savedData; if (!s) return null;
    const room = Wd.rooms[s.roomId]; const zone = room ? Wd.zones[room.zone] : null;
    const f = UB.Characters.DATA[s.fighter];
    return (f ? f.name.toUpperCase() : s.fighter) + ' · ' + (zone ? zone.name : '?') + ' · ' + s.maxHearts + ' hearts · ' + U.fmtTime(s.playTimeFrames || 0);
  };
  /**
   * Start a new run with a fighter (from the select screen or UB.debug). fromMenu: the title's NEW GAME path — a
   * saved run was overwritten ("Overwrite the saved run?" → YES), so its slot is erased now, never outliving the answer.
   */
  Game.prototype.newGame = function (fighterId, fromMenu) {
    if (this.busy) return;
    const self = this;
    if (fromMenu && this.savedData) this.eraseSlot();
    this.busy = true;
    this.save = this.newSaveData(fighterId);
    this.lastFighter = this.save.fighter;
    this.createPlayer();
    this.fadeTo(1, T.selectFade, function () {
      self.zone = null;
      self.loadRoom(Wd.start.room, { start: true });
      self.player.respawn(self.player.x, self.player.y, { hp: self.player.maxHp, energy: 50, meter: 0 });
      self.mode = 'normal';
      self.setScreen('play');
      self.fadeTo(0, T.selectFade, function () { self.busy = false; });
    });
  };
  /** Continue from the saved slot (title → CONTINUE or UB.debug). */
  Game.prototype.continueGame = function () {
    if (this.busy) return false;
    const data = this.readSave();
    if (!data) return false;
    const self = this;
    this.busy = true;
    this.save = data;
    this.lastFighter = data.fighter;
    this.createPlayer();
    this.fadeTo(1, T.selectFade, function () {
      self.zone = null;
      self.loadRoom(self.save.roomId, { nodeId: self.save.spawn.nodeId });
      self.player.respawn(self.player.x, self.player.y, { hp: self.player.maxHp, energy: 50, meter: 0 });
      self.mode = 'normal';
      self.setScreen('play');
      self.fadeTo(0, T.selectFade, function () { self.busy = false; });
    });
    return true;
  };
  Game.prototype.createPlayer = function () {
    const s = this.save;
    this.player = UB.Characters.create(s.fighter, this);
    this.player.baseHp = s.baseHearts = this.player.data.hp;
    this.player.maxHp = s.maxHearts = s.baseHearts + s.cores.length;
    this.player.hp = this.player.maxHp;
    this.player.abilities = s.abilities;
    this.applyVendorEffects();
    this.cam.look = 0;
  };
  /** Persistent vendor effects on the player (DESIGN §9.5): Spare Cell → energyMax 125. Hot Clock lives in addMeter, Deep Ping in applyDeepPing. */
  Game.prototype.applyVendorEffects = function () {
    const pl = this.player; if (!pl) return;
    pl.energyMax = this.save.vendor.indexOf('spare_cell') >= 0 ? 125 : 100;
    if (pl.energy > pl.energyMax) pl.energy = pl.energyMax;
  };
  /** Game over → confirm: reload the last node with full HP, energy 50, meter 0. */
  Game.prototype.respawnAtNode = function () {
    if (this.busy) return;
    const self = this;
    this.busy = true;
    this.fadeTo(1, T.respawnFade, function () {
      self.loadRoom(self.save.roomId, { nodeId: self.save.spawn.nodeId });
      self.player.respawn(self.player.x, self.player.y, { hp: self.player.maxHp, energy: 50, meter: 0 });
      self.mode = 'normal'; self.bossFight.state = 'none';
      self.setScreen('play');
      // the game-over fade ducked the music to 0 and a boss death may have left 'boss' as the song: back to the zone
      self.playRoomMusic(); Au.duck(1, 0.5);
      self.restoreEcho();   // F07: waking at the node after a boss beat you twice recovers a memory of it
      self.fadeTo(0, T.respawnFade, function () { self.busy = false; });
    });
  };
  /** The final boss is down: record, save, show stats. */
  Game.prototype.victory = function () {
    const self = this;
    this.save.victory = true;
    // DESIGN §12.16: the cleared run resumes at Last Light (rw_rest) for free play, whichever node was used last
    const rest = Wd.rooms.rw_rest, node = rest && rest.nodes && rest.nodes[0];
    if (node) { this.save.roomId = rest.id; this.save.spawn.nodeId = node.id; }
    this.writeSave();
    this.busy = true;
    this.fadeTo(1, 60, function () {
      self.setScreen('victory'); self.fadeLevel = 0; self.fadeTarget = 0; self.busy = false;
      Au.music('victory');
    });
  };
  Game.prototype.victoryStats = function () {
    const s = this.save; const f = UB.Characters.DATA[s.fighter];
    let total = 0; for (const id in Wd.rooms) if (!Wd.rooms[id].debug) total++;
    let disc = 0; for (let i = 0; i < s.discovered.length; i++) if (Wd.rooms[s.discovered[i]] && !Wd.rooms[s.discovered[i]].debug) disc++;
    return { fighter: f ? f.name.toUpperCase() : s.fighter, time: U.fmtTime(s.playTimeFrames), deaths: s.deaths, bits: s.bitsLifetime,
      cores: s.cores.length + '/3', rooms: disc + '/' + total, enemies: s.enemiesPurged, bosses: s.bossesDefeated.length + '/4' };
  };
  /** Pause automatically (tab hidden, gamepad lost). */
  Game.prototype.autoPause = function () {
    if (this.screen === 'play' && !this.overlay && !this.busy) this.openOverlay('pause');
  };

  // --- fades -------------------------------------------------------------------------------------
  Game.prototype.fadeTo = function (target, frames, cb) {
    this.fadeTarget = target; this.fadeStep = Math.abs(target - this.fadeLevel) / Math.max(1, frames); this.fadeCb = cb || null; this.fadeT = frames;
  };
  Game.prototype.updateFade = function () {
    if (this.fadeLevel !== this.fadeTarget) {
      this.fadeLevel = U.approach(this.fadeLevel, this.fadeTarget, this.fadeStep);
      if (this.fadeT > 0) this.fadeT--;
      if (this.fadeLevel === this.fadeTarget && this.fadeCb) { const cb = this.fadeCb; this.fadeCb = null; this.fadeT = 0; cb(); }
    } else if (this.fadeCb) { const cb = this.fadeCb; this.fadeCb = null; this.fadeT = 0; cb(); }
  };

  // --- save / settings (DESIGN §14) ---------------------------------------------------------------
  Game.prototype.newSaveData = function (fighterId) {
    const f = UB.Characters.DATA[fighterId] ? fighterId : UB.Characters.list[0].id;
    const hp = UB.Characters.DATA[f].hp;
    return {
      version: SAVE_VERSION, fighter: f, roomId: Wd.start.room, spawn: { nodeId: Wd.start.nodeId },
      hearts: hp, maxHearts: hp, baseHearts: hp, cores: [],
      abilities: { echoJump: false, burstLine: false, gripProtocol: false },
      bits: 0, bitsLifetime: 0, discovered: [], visited: [], bossesDefeated: [], bitsCollected: [],
      vendor: [], nodesUsed: [], loreSeen: [],
      hints: { move: false, jump: false, light: false, heavy: false, special: false, dash: false, overclock: false, drop: false },
      enemiesPurged: 0, playTimeFrames: 0, deaths: 0, victory: false, savedAt: 0,
      // F06: bosses whose intro card has played through once (later intros may be skipped)
      introsSeen: [],
      // F07 Restore Echo, per boss id: {deaths: times it beat the player, tips: memories shown, at: deaths when the last showed}
      echo: {},
    };
  };
  /**
   * Read + validate localStorage; null = no usable save (DESIGN §14 rules). Every field is
   * checked for type AND contents against the world: a garbage value falls back to the fresh
   * value, cores ⊆ world core ids, bossesDefeated ⊆ boss ids, bitsCollected ⊆ placed-bit keys,
   * vendor ⊆ item ids, discovered/visited ⊆ room ids, nodesUsed ⊆ node ids, loreSeen ⊆ zone ids,
   * fighter ∈ roster, room/node pair valid. Any exception anywhere = no save. CONTINUE can
   * therefore never throw on a corrupt slot.
   */
  Game.prototype.readSave = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object' || Array.isArray(d) || d.version !== SAVE_VERSION) return null;
      return sanitizeSave(d, this.newSaveData(d.fighter));
    } catch (e) { return null; }
  };
  /** Pure validation of a parsed save object against `fresh` (a new save for the same fighter) and the world. */
  function sanitizeSave(d, fresh) {
    const out = fresh;
    const isObj = function (v) { return !!v && typeof v === 'object' && !Array.isArray(v); };
    const num = function (v, lo) { return typeof v === 'number' && isFinite(v) && v >= lo ? Math.floor(v) : null; };
    // string lists filtered to a validator (dedupe, preserve order)
    const strList = function (v, ok, cap) {
      const res = [];
      if (!Array.isArray(v)) return res;
      for (let i = 0; i < v.length && res.length < cap; i++) {
        const s = v[i];
        if (typeof s === 'string' && ok(s) && res.indexOf(s) < 0) res.push(s);
      }
      return res;
    };
    // world id sets
    const roomOk = function (id) { return !!Wd.rooms[id]; };
    const zoneOk = function (id) { return !!Wd.zones[id]; };
    const coreOk = function (id) { for (const rid in Wd.rooms) { const cs = Wd.rooms[rid].cores; for (let i = 0; i < cs.length; i++) if (cs[i].id === id) return true; } return false; };
    const nodeOk = function (id) { return !!Wd.findNode(id); };
    const bossOk = function (id) { if (IDS.bosses.indexOf(id) >= 0) return true; for (const rid in Wd.rooms) { const b = Wd.rooms[rid].boss; if (b && b.id === id) return true; } return false; };
    const bitOk = function (key) {
      const c = key.indexOf(':'); if (c < 0) return false;
      const room = Wd.rooms[key.slice(0, c)]; if (!room) return false;
      const xy = key.slice(c + 1);
      for (let i = 0; i < room.bits.length; i++) if (room.bits[i].x + ',' + room.bits[i].y === xy) return true;
      return false;
    };
    const vendorOk = function (id) { for (let i = 0; i < VENDOR.length; i++) if (VENDOR[i].id === id) return true; return false; };

    // fighter (fresh was already built for it when valid)
    if (typeof d.fighter === 'string' && UB.Characters.DATA[d.fighter]) out.fighter = d.fighter;
    // room + node: both must exist and the node must live in that room, else the start
    const nodeId = isObj(d.spawn) && typeof d.spawn.nodeId === 'string' ? d.spawn.nodeId : null;
    const found = nodeId ? Wd.findNode(nodeId) : null;
    if (typeof d.roomId === 'string' && Wd.rooms[d.roomId] && found && found.room === Wd.rooms[d.roomId]) { out.roomId = d.roomId; out.spawn.nodeId = nodeId; }
    out.cores = strList(d.cores, coreOk, MAX_CORES);
    if (isObj(d.abilities)) for (let i = 0; i < IDS.abilities.length; i++) out.abilities[IDS.abilities[i]] = d.abilities[IDS.abilities[i]] === true;
    out.bits = num(d.bits, 0) !== null ? num(d.bits, 0) : 0;
    out.bitsLifetime = Math.max(out.bits, num(d.bitsLifetime, 0) !== null ? num(d.bitsLifetime, 0) : 0);
    out.discovered = strList(d.discovered, roomOk, 4096);
    out.visited = strList(d.visited, roomOk, 4096);
    for (let i = 0; i < out.visited.length; i++) if (out.discovered.indexOf(out.visited[i]) < 0) out.discovered.push(out.visited[i]);
    out.bossesDefeated = strList(d.bossesDefeated, bossOk, 64);
    out.bitsCollected = strList(d.bitsCollected, bitOk, 4096);
    out.vendor = strList(d.vendor, vendorOk, VENDOR.length);
    out.nodesUsed = strList(d.nodesUsed, nodeOk, 256);
    out.loreSeen = strList(d.loreSeen, zoneOk, 64);
    out.introsSeen = strList(d.introsSeen, function (id) { return IDS.bosses.indexOf(id) >= 0; }, IDS.bosses.length);   // F06; absent in older saves → []
    if (isObj(d.echo)) {   // F07: only pinned boss ids, each a {deaths, tips, at} of whole numbers (older saves: none)
      for (let i = 0; i < IDS.bosses.length; i++) {
        const e = d.echo[IDS.bosses[i]];
        if (!isObj(e)) continue;
        const de = num(e.deaths, 0), ti = num(e.tips, 0), at = num(e.at, 0);
        if (de === null) continue;
        out.echo[IDS.bosses[i]] = { deaths: Math.min(de, 99999), tips: Math.min(ti === null ? 0 : ti, 99999), at: Math.min(at === null ? 0 : at, de) };
      }
    }
    if (isObj(d.hints)) for (let i = 0; i < HINT_KEYS.length; i++) out.hints[HINT_KEYS[i]] = d.hints[HINT_KEYS[i]] === true;
    out.enemiesPurged = num(d.enemiesPurged, 0) !== null ? num(d.enemiesPurged, 0) : 0;
    out.playTimeFrames = num(d.playTimeFrames, 0) !== null ? num(d.playTimeFrames, 0) : 0;
    out.deaths = num(d.deaths, 0) !== null ? num(d.deaths, 0) : 0;
    out.victory = d.victory === true;
    out.savedAt = num(d.savedAt, 0) !== null ? num(d.savedAt, 0) : 0;
    // hearts are recomputed on load (DESIGN §14): you always load at a node, full.
    out.baseHearts = UB.Characters.DATA[out.fighter].hp;
    out.maxHearts = out.baseHearts + out.cores.length;
    out.hearts = out.maxHearts;
    return out;
  }
  /** Write the in-memory save (node, boss pickup, vendor, victory). Returns true on success. */
  Game.prototype.writeSave = function () {
    const s = this.save; if (!s) return false;
    if (this.player) { s.hearts = this.player.hp; s.maxHearts = this.player.maxHp; s.baseHearts = this.player.baseHp; }
    s.savedAt = Date.now(); // metadata only; never used by logic
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }
    catch (e) { UI.toast('Could not save (storage blocked)', '', 90); return false; }
    this.savedData = this.readSave();
    return true;
  };
  /** Remove the save slot (no toast). */
  Game.prototype.eraseSlot = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.savedData = null;
  };
  /** Settings → RESET SAVE → YES. Returns false (no toast, nothing erased) when there is no saved run. */
  Game.prototype.resetSave = function () {
    if (!this.hasSave()) return false;
    this.eraseSlot();
    UI.toast('SAVE ERASED', '', 90);
    return true;
  };
  Game.prototype.loadSettings = function () {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { d = null; }
    this.settings = {};
    // every key is validated like the save (DESIGN §14.2): wrong type / out of range → the default
    for (const k in DEFAULT_SETTINGS) {
      const def = DEFAULT_SETTINGS[k];
      let v = d && typeof d === 'object' && !Array.isArray(d) ? d[k] : undefined;
      if (typeof def === 'number') v = typeof v === 'number' && isFinite(v) && v >= 0 && v <= 10 ? Math.round(v) : def;
      else if (typeof def === 'boolean') v = typeof v === 'boolean' ? v : def;
      else if (k === 'touchControls') v = v === 'auto' || v === 'on' || v === 'off' ? v : def;
      else v = v !== undefined ? v : def;
      this.settings[k] = v;
    }
    this.applySettings();
  };
  Game.prototype.setSetting = function (key, value) {
    this.settings[key] = value;
    this.applySettings();
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
  };
  Game.prototype.applySettings = function () {
    const st = this.settings;
    FX.setShakeEnabled(st.screenShake);
    Au.setVolumes({ master: st.master, music: st.music, sfx: st.sfx });
    // F02: REDUCED FLASHING drives the FX flash intensity hook (B42's FX.flashScale): every full-screen flash is an edge
    // pulse (FX.reducedFlashing) at half strength; the hero / boss / enemy strobes read the setting live
    FX.setFlashScale(st.reducedFlashing === true ? REDUCED_FLASH_SCALE : 1);
    // F05: the hatched hazard rims are painted into the static tile cache — repaint the room the setting changed in
    const outline = st.hazardOutline === true;
    if (R.setHazardOutline && R.setHazardOutline(outline) && this.level) R.buildTileCache(this.level, this.dpr);
  };
  /** Is a boolean comfort / readability setting on? (missing keys — an older settings file — read as off) */
  Game.prototype.setting = function (key) { return !!this.settings && this.settings[key] === true; };

  // --- rooms --------------------------------------------------------------------------------------
  function makeLevel(room) {
    const lv = {
      room: room, w: room.w, h: room.h, zone: Wd.zoneOf(room),
      gone: new Uint8Array(room.w * room.h), sealedMask: new Uint8Array(room.w * room.h),
      openings: [], platforms: [], crumble: [], tileCache: null, cacheScale: 1, sealedExits: [],
      boss: room.boss,   // the active boss spec (room.boss, or one synthesized by UB.debug.spawnBoss)
    };
    for (let i = 0; i < room.exits.length; i++) {
      const e = room.exits[i];
      lv.openings.push({ id: e.id, side: e.side, x: e.x, y: e.y, w: e.w, h: e.h, sealed: false });
    }
    for (let i = 0; i < room.platforms.length; i++) {
      const s = room.platforms[i];
      const p = { id: s.id, x: s.from.x * TILE, y: s.from.y * TILE, w: s.w * TILE, h: 8, px: 0, py: 0, dx: 0, dy: 0,
        fx: s.from.x * TILE, fy: s.from.y * TILE, tx: s.to.x * TILE, ty: s.to.y * TILE, speed: s.speed, wait: s.wait, waitT: 0, dir: 1, dist: 0 };
      p.px = p.x; p.py = p.y;
      p.len = Math.sqrt((p.tx - p.fx) * (p.tx - p.fx) + (p.ty - p.fy) * (p.ty - p.fy)) || 1;
      lv.platforms.push(p);
      for (let k = 0; k < i * 45; k++) stepPlatform(p); // phase offset index×45 f (DESIGN §5.5)
    }
    return lv;
  }
  function stepPlatform(p) {
    p.px = p.x; p.py = p.y;
    if (p.waitT > 0) { p.waitT--; }
    else {
      p.dist += p.speed * p.dir;
      if (p.dist >= p.len) { p.dist = p.len; p.dir = -1; p.waitT = p.wait; }
      else if (p.dist <= 0) { p.dist = 0; p.dir = 1; p.waitT = p.wait; }
      const k = p.dist / p.len;
      p.x = Math.round((p.fx + (p.tx - p.fx) * k) * 100) / 100; p.y = Math.round((p.fy + (p.ty - p.fy) * k) * 100) / 100;
    }
    p.dx = p.x - p.px; p.dy = p.y - p.py;
  }

  /**
   * Load a room and place the player. arrival: {exitId, side (exit side we LEFT through), vx, vy}
   * | {nodeId} | {x, y} | {start:true}. Marks visited/discovered, resets the room roster,
   * rebuilds the tile cache, snaps the camera, fires the zone toast on zone change.
   */
  Game.prototype.loadRoom = function (roomId, arrival) {
    const room = Wd.rooms[roomId];
    if (!room) throw new Error('UB: unknown room ' + roomId);
    arrival = arrival || {};
    const prevZone = this.zone;
    this.level = makeLevel(room);
    this.zone = this.level.zone;
    FX.clear(); Au.stopLoops();
    this.dropProjectiles();
    this.enemies.length = 0; this.pickups.length = 0;
    this.prompt = null; this.nearNode = null; this.nearVendor = false; this.hitCount = 0;
    // The static tile cache exists before anything (sealExits → redrawTiles) can touch it.
    R.buildTileCache(this.level, this.dpr);
    this.spawnRoomEnemies();
    this.boss = null; this.bossFight.state = 'none'; this.bossFight.timer = 0;
    if (room.boss && this.save.bossesDefeated.indexOf(room.boss.id) < 0) {
      this.boss = UB.Bosses.create(room.boss.id, room, this, room.boss);
      if (!this.boss) warnOnce('boss:' + room.boss.id, 'no boss for id ' + room.boss.id);
      // exits locked until the boss falls (e.g. the brine crust over bv_corrosant.B) are solid now
      if (room.boss.locked.length) this.sealExits(room.boss.locked, true);
    }
    for (let i = 0; i < room.bits.length; i++) {
      const b = room.bits[i], key = room.id + ':' + b.x + ',' + b.y;
      if (this.save.bitsCollected.indexOf(key) < 0) this.spawnPickup('bit', b.x * TILE + 15, b.y * TILE + 15 + PICKUP_SIZE.bit / 2, { size: b.size, placed: true, key: key });
    }
    for (let i = 0; i < room.cores.length; i++) {
      const c = room.cores[i];
      if (this.save.cores.indexOf(c.id) < 0) this.spawnPickup('core', c.x * TILE + 15, c.y * TILE + 15 + PICKUP_SIZE.core / 2, { placed: true, id: c.id });
    }
    // player placement
    const pos = this.scratch;
    let vx = 0, vy = 0, iframes = 0, airJumps = 1;
    if (arrival.exitId) {
      Wd.spawnPx(room, arrival.exitId, pos);
      if (arrival.side === 'left' || arrival.side === 'right') vx = arrival.vx || 0;
      if (arrival.side === 'bottom') vy = T.topArrivalVy;                 // we fell out of the bottom → arrive from the top
      if (arrival.side === 'top') { vy = -T.chuteLaunch * this.player.data.jumpVel; iframes = T.chuteIFrames; } // chute launch
    } else if (arrival.nodeId) {
      const n = Wd.findNode(arrival.nodeId);
      if (n && n.room === room) Wd.tilePx(n.node.x, n.node.y, pos); else Wd.spawnPx(room, null, pos);
    } else if (arrival.x !== undefined) { pos.x = arrival.x; pos.y = arrival.y; }
    else Wd.spawnPx(room, null, pos);
    this.player.place(pos.x, pos.y, { vx: vx, vy: vy, iframes: iframes, airJumps: airJumps });
    // DESIGN §3.3: a hazard respawns at the entry spawn; through a chute that spawn is only usable with its launch
    this.hazardRespawn.x = pos.x; this.hazardRespawn.y = pos.y; this.hazardRespawn.vy = vy; this.hazardRespawn.iframes = iframes;
    this.hazardRespawn.pending = arrival.side === 'top';   // a chute launch: the first solid footing inside the room becomes the respawn point
    this.hazardTo.on = false;
    this.ledgeOn = -1; this.ledgeT = 0;   // F04: Signal Ledges hold for one visit; every entry starts from the arrival again
    this.dbgHitCount = 0;                 // no attack box of the previous room is outlined / drawn here (F05, showHitboxes)
    // a boss beaten whose module was never collected (died during the reward, quit): the module waits at its pickup tile
    if (room.boss && !this.boss && this.save.bossesDefeated.indexOf(room.boss.id) >= 0 && !room.boss.final) {
      const ab = IDS.bossAbility[room.boss.id];
      if (ab && !this.save.abilities[ab] && room.boss.pickup) {
        const bd = UB.Bosses.DATA[room.boss.id];
        this.spawnPickup('ability', room.boss.pickup.x * TILE + TILE / 2, (room.boss.pickup.y + 1) * TILE, { ability: ab, bossId: room.boss.id, glow: bd ? bd.glow : null });
      }
    }
    // map bookkeeping
    const s = this.save;
    if (s.visited.indexOf(room.id) < 0) s.visited.push(room.id);
    if (s.discovered.indexOf(room.id) < 0) s.discovered.push(room.id);
    for (let i = 0; i < room.exits.length; i++) if (s.discovered.indexOf(room.exits[i].to.room) < 0) s.discovered.push(room.exits[i].to.room);
    if (this.hasDeepPing()) this.applyDeepPing();
    const song = this.roomSong();
    if (song === null) this.hideProp('throne', true);   // the cleared final arena: the throne stays collapsed (DESIGN §12.16)
    if (prevZone !== this.zone) {
      UI.toast(this.zone.name, this.zone.blurb, T.zoneToast);
      Au.music(song); this.curSong = song; Au.ambient(this.zone.id);
      // zone lore card (DESIGN §12.18): once per zone, after the toast settles; the UI draws overlay 'lore'.
      // A card still pending from the previous zone is dropped (it belongs to a zone we just left).
      this.loreZone = null; this.loreTimer = 0;
      if (this.zone.lore && !this.zone.debug && s.loreSeen.indexOf(this.zone.id) < 0) { this.loreZone = this.zone; this.loreTimer = T.loreDelay; }
    }
    else if (song !== this.curSong) { Au.music(song); this.curSong = song; }   // the quiet throne room ↔ the zone song
    this.snapCamera();
  };
  /** The song a room plays: the zone song, or none in a cleared final arena (DESIGN §12.16: rw_throne stays quiet after the victory). */
  Game.prototype.roomSong = function () {
    const room = this.level ? this.level.room : null;
    if (room && room.boss && room.boss.final && this.save && this.save.bossesDefeated.indexOf(room.boss.id) >= 0) return null;
    return this.zone ? this.zone.song : null;
  };
  /** (Re)start the current room's music after a respawn / boss (the engine's own calls, not a zone change). */
  Game.prototype.playRoomMusic = function () {
    const song = this.roomSong();
    Au.music(song); this.curSong = song;
    if (this.zone) Au.ambient(this.zone.id);
  };
  /**
   * Hide the composite zone prop(s) tagged `tag` in this room for the rest of the visit (Kernauth's throne
   * bursts at the phase change, DESIGN §8.4): the tile cache is repainted without them and chips fly.
   */
  Game.prototype.hideProp = function (tag, quiet) {
    const lv = this.level; if (!lv || !Wd.hideProp) return false;
    const rect = Wd.hideProp(lv, tag);
    if (!rect) return false;
    R.redrawTiles(lv, rect.x - 1, rect.y - 1, rect.x + rect.w, rect.y + rect.h);
    if (!quiet) FX.burst('chip', (rect.x + rect.w / 2) * TILE, (rect.y + rect.h / 2) * TILE, 24, { color: lv.zone.palette.accent });
    return true;
  };
  /** Clear the projectile list, flagging every object dead so pooled projectiles (characters) know they were dropped. */
  Game.prototype.dropProjectiles = function () {
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].dead = true;
    this.projectiles.length = 0;
  };
  Game.prototype.spawnRoomEnemies = function () {
    const room = this.level.room;
    this.enemies.length = 0;
    for (let i = 0; i < room.spawns.length; i++) {
      const sp = room.spawns[i];
      const e = UB.Enemies.create(sp.type, sp, room, this);
      if (e) { e.spawnIndex = i; this.enemies.push(e); }
      else warnOnce('enemy:' + sp.type, 'no enemy for type ' + sp.type);
    }
  };
  /**
   * Add an enemy at runtime (broodcell motes, UB.debug.spawnEnemy). tx, ty = feet tile
   * (flyers: centre tile); opts = extra spawn fields (patrol, variant, facing, …) merged into
   * the spawn record passed to UB.Enemies.create. Returns the enemy or null (unknown type).
   */
  Game.prototype.spawnEnemy = function (type, tx, ty, opts) {
    if (!this.level) return null;
    const sp = Object.assign({ type: type, x: tx, y: ty }, opts || null);   // a fresh record: creators may keep a reference
    const e = UB.Enemies.create(type, sp, this.level.room, this);
    if (!e) { warnOnce('enemy:' + type, 'no enemy for type ' + type); return null; }
    e.spawnIndex = -1; e.px = e.x; e.py = e.y;
    this.enemies.push(e);
    return e;
  };
  // --- vendor (DESIGN §9.5) ----------------------------------------------------------------------
  Game.prototype.hasDeepPing = function () { return !!this.save && this.save.vendor.indexOf('deep_ping') >= 0; };
  /** Deep Ping: every real room of a zone the player has set foot in counts as discovered (DESIGN §14). */
  Game.prototype.applyDeepPing = function () {
    const s = this.save; if (!s) return;
    for (const id in Wd.rooms) {
      const r = Wd.rooms[id];
      if (r.debug || s.discovered.indexOf(id) >= 0) continue;
      for (let i = 0; i < s.visited.length; i++) {
        const v = Wd.rooms[s.visited[i]];
        if (v && v.zone === r.zone) { s.discovered.push(id); break; }
      }
    }
  };
  /**
   * Buy a vendor item (UI calls this from the shop overlay). Returns 'bought' | 'poor' |
   * 'sold' | 'unknown'. On 'bought': this vendor room's price deducted (UB.Util.vendorPrice — Scrivvet's
   * Rootwell stand sells at `deepPrice`, playtest B25), save.vendor updated, the effect applied,
   * the save written, and the PURCHASED banner queued for when the panel closes.
   */
  Game.prototype.buy = function (itemId) {
    if (!this.save) return 'unknown';
    let item = null;
    for (let i = 0; i < VENDOR.length; i++) if (VENDOR[i].id === itemId) item = VENDOR[i];
    if (!item) return 'unknown';
    if (this.save.vendor.indexOf(itemId) >= 0) return 'sold';
    const price = U.vendorPrice(item, this.level ? this.level.room.id : null);   // the price the shop panel shows
    if (this.save.bits < price) return 'poor';
    this.save.bits -= price;
    this.save.vendor.push(itemId);
    this.applyVendorEffects();
    if (itemId === 'deep_ping') this.applyDeepPing();
    this.shopBought = item;
    this.writeSave();
    return 'bought';
  };

  // --- room transitions (DESIGN §11.3.2) -------------------------------------------------------------
  Game.prototype.checkExits = function () {
    const pl = this.player, room = this.level.room;
    const left = pl.x - pl.w / 2, right = pl.x + pl.w / 2, top = pl.y - pl.h;
    for (let i = 0; i < room.exits.length; i++) {
      const e = room.exits[i];
      if (this.level.openings[i].sealed) continue;
      const ox = e.x * TILE, oy = e.y * TILE, ow = e.w * TILE, oh = e.h * TILE;
      let hit = false;
      if (e.side === 'left') hit = pl.x < 0 && pl.y > oy && top < oy + oh;
      else if (e.side === 'right') hit = pl.x > room.w * TILE && pl.y > oy && top < oy + oh;
      else if (e.side === 'top') hit = top < -8 && right > ox && left < ox + ow;
      else if (e.side === 'bottom') hit = top > room.h * TILE && right > ox && left < ox + ow;
      if (hit) { this.startTransition(e); return true; }
    }
    return false;
  };
  Game.prototype.startTransition = function (exit) {
    const tr = this.transition;
    tr.phase = 'freeze'; tr.timer = T.freeze; tr.exit = exit;
    tr.dx = exit.side === 'left' ? -1 : (exit.side === 'right' ? 1 : 0);
    tr.dy = exit.side === 'top' ? -1 : (exit.side === 'bottom' ? 1 : 0);
    this.mode = 'transition';
    this.player.locked = true;
    const sc = this.snap.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, this.snap.width, this.snap.height);
    sc.drawImage(this.world, 0, 0);
  };
  Game.prototype.updateTransition = function () {
    const tr = this.transition;
    tr.timer--;
    if (tr.phase === 'freeze' && tr.timer <= 0) {
      const ex = tr.exit, pl = this.player;
      this.loadRoom(ex.to.room, { exitId: ex.to.exit, side: ex.side, vx: pl.vx, vy: pl.vy });
      this.player.locked = true;
      tr.phase = 'slide'; tr.timer = T.slide;
      Au.sfx('roomTransition');
    } else if (tr.phase === 'slide' && tr.timer <= 0) {
      tr.phase = 'settle'; tr.timer = T.settle;
    } else if (tr.phase === 'settle' && tr.timer <= 0) {
      tr.phase = ''; this.mode = 'normal'; this.player.locked = false;
    }
  };

  // --- hits (CONTRACT §7) ----------------------------------------------------------------------------
  /** Attackers call this every active frame with a UB.Entity.makeHit() descriptor. */
  Game.prototype.registerHit = function (hit) {
    if (this.hitCount >= MAX_HITS) return;
    this.hits[this.hitCount++] = hit;
  };
  /**
   * CONTRACT §7. A victim already in hit.hitList is skipped unless hit.multi; multi hits
   * never grow hitList (they rely on the victim's own i-frames / the attacker's cadence).
   * Player hits test enemies, the boss and destructible ENEMY-owned projectiles (never the
   * player's own). Enemy/boss hits test the player only in mode 'normal' (not at a node, in
   * a boss intro, the pickup sequence, a hazard freeze or a transition).
   */
  Game.prototype.resolveHits = function () {
    const pl = this.player;
    this.dbgHitCount = 0;
    for (let i = 0; i < this.hitCount; i++) {
      const h = this.hits[i];
      if (this.dbgHitCount < MAX_HITS) { const d = this.dbgHits[this.dbgHitCount++]; d.x = h.x; d.y = h.y; d.w = h.w; d.h = h.h; d.owner = h.owner; }
      if (h.owner === 'player') {
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          if (e.dead || (!h.multi && h.hitList.indexOf(e) >= 0)) continue;
          if (E.overlapBox(e, h.x, h.y, h.w, h.h)) this.hitEnemy(e, h);
        }
        const b = this.boss;
        if (b && b.active && !b.dead && (h.multi || h.hitList.indexOf(b) < 0) && E.overlapBox(b, h.x, h.y, h.w, h.h)) this.hitBoss(b, h);
        for (let j = 0; j < this.projectiles.length; j++) {
          const p = this.projectiles[j];
          if (!p.destructible || p.dead || p.owner === 'player' || h.hitList.indexOf(p) >= 0) continue;
          if (E.overlapBox(p, h.x, h.y, h.w, h.h)) {
            h.hitList.push(p); p.dead = true;
            this.addMeter(2, false); FX.burst('spark', p.x, p.cy(), 4, { color: P.PAPER });
            if (p.onPopped) p.onPopped(this);
            if (h.onHit) h.onHit(p, null, this);
          }
        }
      } else if (pl && !pl.dead && this.mode === 'normal' && !this.god && (h.multi || h.hitList.indexOf(pl) < 0) && E.overlapBox(pl, h.x, h.y, h.w, h.h)) {
        // opts.hit = the descriptor (flags / src) so a counter such as Korvask's Bulwark Catch can read it exactly
        this.hurtOpts.hit = h;
        const took = pl.hurt(h.dmg, this.knockOrigin(h, pl), this.hurtOpts);
        this.hurtOpts.hit = null;
        if (took) { if (!h.multi) h.hitList.push(pl); if (h.onHit) h.onHit(pl, null, this); }
      }
    }
    this.hitCount = 0;
  };
  /**
   * The x a registered enemy/boss hit knocks the fighter away from: the hit box centre, except for a melee box held out
   * in front of the attacker's own body (it touches the body — Tallock's Slab Swing): a fighter standing between that
   * body and the box centre is knocked away from the BODY, never into it (playtest B34's root). Projectiles (their
   * src is the shot, not a listed body) and boxes away from the body (spikes, needles) keep the box centre.
   */
  Game.prototype.knockOrigin = function (h, pl) {
    const bx = h.x + h.w / 2, s = h.src;
    if (!s || s === pl || !(s.w > 0) || (s !== this.boss && this.enemies.indexOf(s) < 0)) return bx;
    if (Math.abs(bx - s.x) - h.w / 2 > s.w / 2 + 8) return bx;   // the box does not reach the attacker's body
    return (pl.x - s.x) * (bx - pl.x) > 0 ? s.x : bx;
  };
  Game.prototype.hitEnemy = function (e, h) {
    if (!h.multi) h.hitList.push(e);
    const res = e.takeHit ? e.takeHit(h, this) : E.applyHit(e, h);
    const cx = Math.max(e.left(), h.x), cy = Math.max(e.top(), h.y);
    const ix = (cx + Math.min(e.right(), h.x + h.w)) / 2, iy = (cy + Math.min(e.y, h.y + h.h)) / 2;
    if (res.blocked) {
      FX.burst('spark', ix, iy, 3, { color: P.PAPER, dir: h.facing }); Au.sfx('whiff', e.x);
      this.addMeter(Math.floor(h.meter * 0.25), true);
      if (h.onHit) h.onHit(e, res, this);
      return;
    }
    // a pull (kbx < 0 — Korvask's Chain Haul) draws its victim in to the attacker's body edge, never into it:
    // the tick holds it there for the rest of its hitstun (no free contact hit from the fighter's own pull)
    if (h.owner === 'player' && h.kbx < 0 && h.src && h.src === this.player && e.hitstun > 0 && !res.killed) {
      e.pullBy = h.src; e.pullSide = U.sign(e.x - h.src.x) || h.facing;
    }
    FX.hitstop(h.hitstop);
    if (h.hitstop > 5) this.impactZoom(ix, iy);
    if (h.shake) FX.shake(h.shake, h.shakeFrames);
    const n = h.kind === 'heavy' ? 8 : (h.kind === 'special' ? 10 : (h.kind === 'ultimate' ? 16 : 4));
    FX.burst('spark', ix, iy, n, { color: this.player ? this.player.data.palette.glow : P.PAPER, dir: h.facing });
    if (h.kind === 'heavy' || h.tag === 'light3') FX.burst('ring', ix, iy, 1, { radius: 30 });
    Au.sfx(h.kind === 'heavy' ? 'heavyHit' : 'lightHit', e.x); Au.sfx('enemyHit', e.x);
    this.addEnergy(h.energy); this.addMeter(h.meter, true);
    if (h.onHit) h.onHit(e, res, this);
    if (res.killed) this.killEnemy(e, h);
  };
  /** Keep a pulled enemy (see hitEnemy) on its side of the puller's body, 1 px clear, until its hitstun ends. */
  Game.prototype.holdPulled = function (e) {
    const a = e.pullBy;
    if (e.hitstun <= 0 || a.dead || a !== this.player) { e.pullBy = null; return; }
    const min = a.w / 2 + e.w / 2 + 1;
    if ((e.x - a.x) * e.pullSide < min) {
      const nx = a.x + e.pullSide * min;
      if (e.collideTiles && E.overlapsSolid(this.level, nx - e.w / 2, e.y - e.h, e.w, e.h)) return;   // never into a wall
      e.x = nx; if (e.vx * e.pullSide < 0) e.vx = 0;
    }
  };
  Game.prototype.killEnemy = function (e, h) {
    e.dead = true;
    FX.hitstop((h ? h.hitstop : 0) + 2);
    FX.shake(2, 4);
    FX.burst('chip', e.x, e.cy(), 12, { color: e.accent || P.PAPER, dir: h ? h.facing : 0 });
    Au.sfx('enemyDeath', e.x);
    this.save.enemiesPurged++;
    this.rollDrops(e);
    if (e.onDeath) e.onDeath(this);
  };
  /**
   * Boss damage. A multi-phase boss (Kernauth) handles its phase change INSIDE takeHit:
   * refill hp/maxHp, set this.phase, give the player i-frames, play its own card/sfx —
   * the engine only starts the death sequence when takeHit returns with hp <= 0.
   */
  Game.prototype.hitBoss = function (b, h) {
    if (!h.multi) h.hitList.push(b);
    const res = b.takeHit ? b.takeHit(h, this) : E.applyHit(b, h);
    if (res.blocked) { if (h.onHit) h.onHit(b, res, this); return; }
    FX.hitstop(h.hitstop); FX.shake(1, 3);
    if (h.hitstop > 5) this.impactZoom(h.x + h.w / 2, h.y + h.h / 2);
    FX.burst('spark', h.x + h.w / 2, h.y + h.h / 2, 6, { color: this.player.data.palette.glow, dir: h.facing });
    Au.sfx('bossHit', b.x); Au.sfx(h.kind === 'heavy' ? 'heavyHit' : 'lightHit', b.x);
    this.addEnergy(h.energy); this.addMeter(h.meter, true);
    if (h.onHit) h.onHit(b, res, this);
    if (b.hp <= 0 && this.bossFight.state === 'fight') this.startBossDeath();
  };
  /**
   * Add a projectile (CONTRACT §7): a UB.Entity with owner 'player'|'enemy' (default 'enemy'),
   * update(game), draw(ctx, game, alpha), dead, optional destructible/onPopped. Cap 64:
   * the oldest is dropped. Projectiles further than 64 px outside the room are culled by the tick.
   */
  Game.prototype.spawnProjectile = function (obj) {
    if (!(obj instanceof E)) { warnOnce('proj:' + (obj && obj.constructor ? obj.constructor.name : typeof obj), 'spawnProjectile: not a UB.Entity'); return null; }
    if (obj.owner !== 'player' && obj.owner !== 'enemy') obj.owner = 'enemy';
    obj.px = obj.x; obj.py = obj.y;
    if (this.projectiles.indexOf(obj) >= 0) return obj;   // a pooled object re-spawned before the end-of-tick sweep: never listed twice
    if (this.projectiles.length >= MAX_PROJECTILES) { this.projectiles[0].dead = true; this.projectiles.shift(); }
    this.projectiles.push(obj);
    return obj;
  };
  /** DESIGN §11.3.3: hitstop > 5 f adds a one-frame 2 % zoom about the impact point (world px). */
  Game.prototype.impactZoom = function (x, y) { this.zoom.x = x; this.zoom.y = y; this.zoom.t = 1; };
  Game.prototype.addEnergy = function (n) { const pl = this.player; pl.energy = U.clamp(pl.energy + n, 0, pl.energyMax); };
  Game.prototype.addMeter = function (n, fromHit) {
    const pl = this.player;
    if (pl.ocActive || pl.ocTransform > 0) return;
    if (fromHit && this.save.vendor.indexOf('hot_clock') >= 0) n = Math.ceil(n * 1.5);
    pl.meter = U.clamp(pl.meter + n, 0, pl.meterMax);
  };
  Game.prototype.addBits = function (n) { this.save.bits += n; if (n > 0) this.save.bitsLifetime += n; };

  // --- pickups & drops (DESIGN §9) -------------------------------------------------------------------
  /**
   * opts: {size ('small'|'medium'|'large' for bits), placed (static, one-time, never expires),
   *        key (placed-bit save key), id (core id), ability + bossId + glow (ability module),
   *        permanent (never expires), vx, vy (px/frame)}
   */
  Game.prototype.spawnPickup = function (type, x, y, opts) {
    opts = opts || {};
    const sz = PICKUP_SIZE[type] || 12;
    const p = new E({ x: x, y: y, w: sz, h: sz, units: 'pxf', bounce: 0.5 });
    p.type = type; p.size = opts.size || 'small'; p.value = type === 'bit' ? BIT_VALUE[p.size] : 0;
    p.placed = !!opts.placed; p.key = opts.key || null; p.id = opts.id || null;
    p.ability = opts.ability || null; p.bossId = opts.bossId || null; p.glow = opts.glow || null;
    p.life = (p.placed || opts.permanent || type === 'ability' || type === 'core') ? -1 : 600;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.collideTiles = !p.placed;
    p.magnet = type === 'bit' || type === 'spark' || type === 'shard';
    this.pickups.push(p);
    return p;
  };
  Game.prototype.updatePickups = function () {
    const pl = this.player, ps = this.pickups;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.t++;
      if (!p.placed && p.type !== 'ability') {
        if (p.bounces >= 2) p.bounce = 0;
        let pulled = false;
        if (p.magnet && p.t > 20 && !pl.dead) {
          const dx = pl.x - p.x, dy = pl.cy() - p.cy(), d = Math.sqrt(dx * dx + dy * dy);
          if (d < 60 && d > 0.01) { p.x += dx / d * 4; p.y += dy / d * 4; pulled = true; }
        }
        if (!pulled) { p.gravity(0.3, 8); p.vx *= p.onGround ? 0.85 : 0.995; p.moveAndCollide(this.level); }
      }
      if (p.life > 0 && --p.life === 0) { ps.splice(i, 1); continue; }
      if (!pl.dead && this.mode !== 'hazard' && E.overlap(pl, p)) { this.collect(p); ps.splice(i, 1); }
    }
  };
  Game.prototype.collect = function (p) {
    const pl = this.player;
    if (p.type === 'bit') {
      this.addBits(p.value); this.addMeter(1, false);
      if (p.key) this.save.bitsCollected.push(p.key);
      FX.burst('glitter', p.x, p.cy(), 6, { color: P.BITS }); FX.text('+' + p.value, p.x, p.cy() - 8, P.BITS, 20);
      Au.sfx('pickupBit', p.x);
    } else if (p.type === 'heart') {
      pl.heal(1); FX.burst('heal', p.x, p.cy(), 6, { color: P.HEART }); Au.sfx('heal', p.x);
    } else if (p.type === 'spark') {
      this.addEnergy(25); this.addMeter(10, false); FX.burst('glitter', p.x, p.cy(), 10, { color: P.ENERGY }); Au.sfx('energy', p.x);
    } else if (p.type === 'shard') {
      this.addMeter(15, true); FX.burst('glitter', p.x, p.cy(), 8, { color: P.METER }); Au.sfx('energy', p.x);
    } else if (p.type === 'core') {
      if (p.id && this.save.cores.indexOf(p.id) < 0) this.save.cores.push(p.id);
      pl.maxHp++; pl.hp++; this.save.maxHearts = pl.maxHp; this.addMeter(25, false);
      FX.burst('glitter', p.x, p.cy(), 24, { color: P.CORE_HEART }); Au.sfx('core', p.x);
      UI.banner('CORE FOUND', 'Max hearts +1', 'A piece of the kingdom that never rotted.', 182);
      this.writeSave();
    } else if (p.type === 'ability') {
      this.startPickupSeq(p);
    }
  };
  /** Enemy death drops per DESIGN §9.2 (deterministic via the game rng). */
  Game.prototype.rollDrops = function (e) {
    const pl = this.player, rng = this.rng;
    let n = e.bits || 0, k = 0;
    while (n >= 5) { this.spawnPickup('bit', e.x, e.cy(), { size: 'medium', vx: (rng() - 0.5) * 5, vy: -4 - rng() * 2 }); n -= 5; k++; }
    while (n > 0) { this.spawnPickup('bit', e.x, e.cy(), { size: 'small', vx: (rng() - 0.5) * 6, vy: -4 - rng() * 2 }); n--; k++; }
    if (e.type === 'mote' || e.noDrops) return;   // DESIGN §9.2: motes drop their bit only, never hearts/orbs/shards
    const missing = pl.maxHp - pl.hp;
    if (missing > 0 && rng() < Math.min(0.4, 0.12 + 0.08 * missing)) this.spawnPickup('heart', e.x, e.cy(), { vx: (rng() - 0.5) * 3, vy: -5 });
    if (rng() < (pl.energy < pl.energyMax / 2 ? 0.25 : 0.05)) this.spawnPickup('spark', e.x, e.cy(), { vx: (rng() - 0.5) * 3, vy: -5 });
    if (e.dropShard || rng() < 0.08) this.spawnPickup('shard', e.x, e.cy(), { vx: (rng() - 0.5) * 3, vy: -5 });
  };

  // --- abilities, bosses (DESIGN §8.0) ------------------------------------------------------------------
  Game.prototype.grantAbility = function (id, on) {
    if (this.save.abilities[id] === undefined) return false;
    this.save.abilities[id] = on !== false;
    return true;
  };
  Game.prototype.sealExits = function (ids, sealed) {
    const lv = this.level, room = lv.room;
    for (let i = 0; i < ids.length; i++) {
      const ex = Wd.exit(room, ids[i]); if (!ex) continue;
      for (let j = 0; j < lv.openings.length; j++) if (lv.openings[j].id === ex.id) lv.openings[j].sealed = sealed;
      for (let y = ex.y; y < ex.y + ex.h; y++) for (let x = ex.x; x < ex.x + ex.w; x++) lv.sealedMask[y * room.w + x] = sealed ? 1 : 0;
      R.redrawTiles(lv, ex.x - 1, ex.y - 1, ex.x + ex.w, ex.y + ex.h);
    }
  };
  Game.prototype.startBossFight = function () {
    const b = this.boss, bf = this.bossFight, spec = this.level.boss;
    bf.state = 'intro'; bf.timer = T.bossIntro; this.mode = 'bossIntro';
    this.player.locked = true; this.player.vx = 0; this.player.cancelMove();
    if (spec.seal.length) this.sealExits(spec.seal, true);
    this.introSkipped = false;
    UI.bossCard(b.name, b.subtitle, T.bossIntro);
    Au.music('boss');
    if (b.onIntro) b.onIntro(this);
  };
  /**
   * F06: may this intro be skipped? Only once the player has sat through this boss's card in full (save.introsSeen),
   * and only after the first INTRO_SKIP_FROM frames (a press that walked the player into the bounds never skips).
   */
  Game.prototype.introSkippable = function () {
    const b = this.boss, bf = this.bossFight;
    return !!(b && bf.state === 'intro' && this.mode === 'bossIntro' && this.save && this.save.introsSeen &&
      this.save.introsSeen.indexOf(b.id) >= 0 && bf.timer <= T.bossIntro - INTRO_SKIP_FROM);
  };
  Game.prototype.updateBossIntro = function () {
    const bf = this.bossFight, st = In.state;
    // F06 retry flow: a confirm, jump or attack press ends a card already seen — straight into the fight
    if (this.introSkippable() && (st.confirm.pressed || st.jump.pressed || st.light.pressed || st.heavy.pressed || st.special.pressed)) {
      bf.timer = 1; this.introSkipped = true;
      UI.skipBossCard();
      In.clearBuffers();   // the skip press never becomes the fight's first jump / attack
    }
    bf.timer--;
    if (bf.timer === T.bossIntro - 8) { Au.sfx('bossRoar', this.boss.x); FX.shake(7, 12); }
    if (bf.timer <= 0) {
      bf.state = 'fight'; this.mode = 'normal'; this.player.locked = false;
      this.boss.active = true;
      // the card has now played once for this boss (in full, or skipped after a full viewing): later intros may be skipped
      const seen = this.save && this.save.introsSeen;
      if (seen && IDS.bosses.indexOf(this.boss.id) >= 0 && seen.indexOf(this.boss.id) < 0) seen.push(this.boss.id);
      if (this.boss.onFightStart) this.boss.onFightStart(this);
    }
  };
  Game.prototype.startBossDeath = function () {
    const b = this.boss, bf = this.bossFight;
    b.dead = true; b.active = false; b.t = 0; b.vx = 0; b.vy = 0;
    bf.state = 'dying'; bf.timer = b.deathFrames || T.bossDeath;
    FX.hitstop(10); FX.shake(12, 40); FX.flash('#FFFFFF', 0.6, 30);
    FX.burst('chip', b.x, b.cy(), 60, { color: b.accent || P.PAPER });
    for (let i = 0; i < 6; i++) FX.burst('ring', b.x, b.cy(), 1, { radius: 60 + i * 30, life: 12 + i * 10 });
    Au.sfx('bossDeath', b.x);
    Au.stopMusic(); this.curSong = null;
    // its shots die with it (nothing of a dead boss may still hurt the player, DESIGN §8.0)
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (p.owner !== 'player' && !p.dead) { p.dead = true; FX.burst('spark', p.x, p.cy(), 3, { color: P.PAPER }); }
    }
    // the defeat counts now (dying during the reward / quitting must not resurrect it); the module waits in the arena
    if (this.save.bossesDefeated.indexOf(b.id) < 0) { this.save.bossesDefeated.push(b.id); this.writeSave(); }
  };
  Game.prototype.updateBossDying = function () {
    const bf = this.bossFight;
    bf.timer--;
    if (bf.timer <= 0 || (bf.timer < (this.boss.deathFrames || T.bossDeath) - 30 && In.anyPressed)) {
      bf.state = 'reward';
      const b = this.boss;
      if (b.onDefeated) b.onDefeated(this);
      UI.toast(b.name + ' PURGED', '', 120);
      if (b.final) { this.finishBoss(b.id, null); this.victory(); }
    }
  };
  Game.prototype.startPickupSeq = function (p) {
    this.pickupSeq.timer = T.pickupSeq; this.pickupSeq.pickup = p;
    this.mode = 'pickupSeq';
    this.player.locked = true; this.player.vx = 0; this.player.iframes = T.pickupSeq + 10;
    const t = ABILITY_TEXT[p.ability] || [String(p.ability).toUpperCase() + ' ACQUIRED', '', ''];
    UI.banner(t[0], t[1], t[2], T.pickupSeq + 150);
    FX.burst('glitter', p.x, p.cy(), 10, { color: p.glow || P.CORE_HEART });
    Au.sfx('ability', p.x);
  };
  Game.prototype.updatePickupSeq = function () {
    const ps = this.pickupSeq;
    ps.timer--;
    if (ps.timer <= 0 || (ps.timer < T.pickupSeq - 30 && In.anyPressed)) {
      this.finishBoss(ps.pickup.bossId, ps.pickup.ability);
      this.mode = 'normal'; this.player.locked = false;
      ps.pickup = null;
    }
  };
  /**
   * Beat boss `bossId` the way its killing hit does (UB.debug.defeatBoss — playtest B22: the old shortcut left the boss
   * and its shots alive and skipped the reward and the finale). When it is live in this room: an intro in progress ends
   * (the fight starts), a multi-phase boss spends its remaining phases (Kernauth's throne bursts as at its phase change),
   * then startBossDeath runs — death FX, every boss shot popped, the defeat recorded and saved — and the dying → reward
   * flow plays on exactly as after a real kill (bits, sparks, the ability module; the final boss's victory). The debug
   * contract (DESIGN §16.9) adds: the ability is granted and this arena's seals and locked exits lift at once. A boss not
   * live here is recorded, its ability granted and the save written. Returns false for an unknown id.
   */
  Game.prototype.defeatBoss = function (bossId) {
    const s = this.save;
    if (!s || typeof bossId !== 'string' || !UB.Bosses.DATA[bossId]) return false;
    const b = this.boss, bf = this.bossFight;
    if (b && b.id === bossId && !b.dead) {
      let cleared = false;
      if (bf.state === 'intro' || this.mode === 'bossIntro') {
        bf.state = 'fight'; bf.timer = 0; b.active = true; cleared = true;
        if (this.mode === 'bossIntro') { this.mode = 'normal'; if (this.player) this.player.locked = false; }
      } else if (bf.state === 'none') bf.state = 'fight';
      for (let i = 0; i < 4 && b.nextPhase && b.nextPhase(this); i++) cleared = true;   // spend every remaining phase
      if (cleared) UI.clearMessages();   // no intro / phase card over the death
      b.hp = 0;
      this.startBossDeath();
    }
    if (s.bossesDefeated.indexOf(bossId) < 0) s.bossesDefeated.push(bossId);
    const ability = UB.Bosses.rewardFor(bossId).ability;
    if (ability) this.grantAbility(ability, true);
    const spec = this.level ? this.level.boss : null;
    if (spec && spec.id === bossId) { this.sealExits(spec.seal, false); this.sealExits(spec.locked, false); }
    this.writeSave();
    return true;
  };
  /** Grant the reward, unseal (fight seals + locked exits), record, save, restore zone music. */
  Game.prototype.finishBoss = function (bossId, ability) {
    if (ability) this.grantAbility(ability, true);
    if (bossId && this.save.bossesDefeated.indexOf(bossId) < 0) this.save.bossesDefeated.push(bossId);
    const rb = this.level.boss;
    if (rb) { this.sealExits(rb.seal, false); this.sealExits(rb.locked, false); }
    this.bossFight.state = 'done';
    this.boss = null;
    this.writeSave();
    this.playRoomMusic();
  };

  // --- hazards, nodes, death (DESIGN §3.2, §3.3, §5.5) -----------------------------------------------------
  Game.prototype.startHazard = function (kind) {
    const pl = this.player;
    pl.hurt(1, 0, { hazard: true });
    FX.hitstop(T.hazardHitstop); FX.flash('#FFFFFF', 0.5, 6); FX.shake(4, 8);
    Au.sfx('spike', pl.x);
    if (pl.dead) return;
    this.mode = 'hazard'; this.hazard.timer = 0; this.hazard.kind = kind;
    pl.vx = 0; pl.vy = 0; pl.cancelMove(); pl.flash = this.steadyHero() ? HAZARD_TINT : T.hazardFreeze;
  };
  /** F02: no strobing hero — REDUCED FLASHING or STEADY SILHOUETTE hold the hazard-freeze tint steady instead of blinking it. */
  Game.prototype.steadyHero = function () { return this.setting('reducedFlashing') || this.setting('steadySilhouette'); };
  Game.prototype.updateHazard = function () {
    const hz = this.hazard, pl = this.player;
    hz.timer++;
    pl.flash = this.steadyHero() ? HAZARD_TINT : ((hz.timer >> 2) & 1 ? 6 : 0);
    if (hz.timer === T.hazardFreeze) this.fadeTo(1, T.hazardFade, null);
    if (hz.timer >= T.hazardFreeze + T.hazardFade) {
      const hr = this.hazardRespawn, to = this.hazardTo;
      if (to.on) { to.on = false; pl.place(to.x, to.y, { iframes: T.hazardIFrames, airJumps: 1 }); }
      else pl.place(hr.x, hr.y, { vy: hr.vy, iframes: Math.max(T.hazardIFrames, hr.iframes), airJumps: 1 });
      pl.flash = 0;
      this.fadeTo(0, T.hazardFade, null);
      this.mode = 'normal';
      this.snapCamera();
    }
  };
  /**
   * A module-owned hazard (Corrosant's Flood, DESIGN §8.3): the full §3.3 hazard path (1 heart ignoring
   * i-frames, 30 f freeze, 10 f fade) but the respawn is (rx, ry) — bottom-centre px — instead of the room
   * entry. Ignored unless the player is alive, in normal play and not in god mode. Returns true when it fired.
   */
  Game.prototype.triggerHazard = function (kind, rx, ry) {
    const pl = this.player;
    if (!pl || pl.dead || this.god || this.mode !== 'normal' || !this.level) return false;
    this.hazardTo.x = rx; this.hazardTo.y = ry; this.hazardTo.on = true;
    this.startHazard(kind || 'pool');
    if (this.mode !== 'hazard') this.hazardTo.on = false;   // it was a death instead
    return true;
  };
  /** Restore node (▲ REST) and vendor (▲ TRADE) prompts + Up interaction (DESIGN §5.5, §9.5, §12.8). */
  Game.prototype.updateInteractions = function () {
    const pl = this.player, room = this.level.room;
    this.nearNode = null; this.nearVendor = false; this.prompt = null;
    for (let i = 0; i < room.nodes.length; i++) {
      const n = room.nodes[i];
      const nx = n.x * TILE + 15, ny = (n.y + 1) * TILE;
      if (Math.abs(pl.x - nx) <= TILE && pl.y <= ny + 4 && pl.y >= ny - 60) {
        this.nearNode = n; this.prompt = this.promptObj;
        this.prompt.text = 'REST'; this.prompt.x = nx; this.prompt.y = ny - 48;
        break;
      }
    }
    if (!this.nearNode && room.vendor) {
      const vx = room.vendor.x * TILE + 15, vy = (room.vendor.y + 1) * TILE;
      if (Math.abs(pl.x - vx) <= TILE && pl.y <= vy + 4 && pl.y >= vy - 60) {
        this.nearVendor = true; this.prompt = this.promptObj;
        this.prompt.text = 'TRADE'; this.prompt.x = vx; this.prompt.y = vy - 62;
      }
    }
    if ((this.nearNode || this.nearVendor) && pl.onGround && !pl.attacking() && In.state.up.pressed) {
      In.consume('jump'); In.consume('up');
      pl.vx = 0;
      if (this.nearNode) {
        this.mode = 'nodeUse'; this.nodeUse.timer = T.nodePulse; this.nodeUse.node = this.nearNode;
        Au.sfx('restore', pl.x);
      } else {
        this.openOverlay('shop');   // the UI draws the panel, navigates and calls game.buy()
      }
    }
  };
  /** Control hints (DESIGN §12.8): record the first use of each action in save.hints; the UI shows the strip until set. */
  Game.prototype.updateHints = function () {
    const h = this.save.hints, st = In.state, pl = this.player;
    if (!h.move && (st.left.down || st.right.down)) h.move = true;
    if (!h.jump && st.jump.pressed) h.jump = true;
    if (!h.light && st.light.pressed) h.light = true;
    if (!h.heavy && st.heavy.pressed) h.heavy = true;
    if (!h.special && st.special.pressed) h.special = true;
    if (!h.dash && st.dash.pressed && pl.abilities.burstLine) h.dash = true;
    if (!h.overclock && (pl.ocTransform > 0 || pl.ocActive)) h.overclock = true;
  };
  Game.prototype.updateNodeUse = function () {
    const nu = this.nodeUse, pl = this.player, n = nu.node;
    const nx = n.x * TILE + 15, ny = (n.y + 1) * TILE;
    if ((nu.timer & 3) === 0) FX.burst('heal', nx, ny - 20, 2, { color: P.CORE_HEART });
    if (--nu.timer <= 0) {
      pl.hp = pl.maxHp; pl.energy = pl.energyMax;
      const s = this.save;
      s.roomId = this.level.room.id; s.spawn.nodeId = n.id;
      if (s.nodesUsed.indexOf(n.id) < 0) s.nodesUsed.push(n.id);
      this.hazardRespawn.x = nx; this.hazardRespawn.y = ny; this.hazardRespawn.vy = 0; this.hazardRespawn.iframes = 0; this.hazardRespawn.pending = false;
      this.ledgeOn = -1;   // the node now holds the hazard respawn (F04)
      this.spawnRoomEnemies();
      this.writeSave();
      UI.banner('RESTORED', 'Saved · hearts full · energy full', '', 150);
      FX.burst('heal', nx, ny - 20, 16, { color: P.CORE_HEART }); FX.burst('ring', nx, ny - 20, 1, { radius: 40 });
      Au.sfx('save', pl.x);
      this.mode = 'normal';
      this.restoreEcho();
    }
  };
  /**
   * F07 Restore Echo. After ECHO_DEATHS defeats by the same unbeaten boss, the next rest at a restore node — a REST, or
   * waking there after SIGNAL LOST — recovers one short memory about that boss (UI.echo: a calm in-world panel that
   * never takes control or pauses play). One memory per rest, and another only after another defeat by it; each boss's
   * memories rotate. Returns the boss id whose memory showed, or null.
   */
  Game.prototype.restoreEcho = function () {
    const s = this.save; if (!s || !s.echo) return null;
    let best = null, bestD = 0;
    for (let i = 0; i < IDS.bosses.length; i++) {
      const id = IDS.bosses[i], e = s.echo[id];
      if (!e || s.bossesDefeated.indexOf(id) >= 0) continue;
      if (e.deaths >= ECHO_DEATHS && e.deaths > e.at && e.deaths > bestD) { best = id; bestD = e.deaths; }
    }
    if (!best) return null;
    const e = s.echo[best];
    UI.echo(best, e.tips);
    e.tips++; e.at = e.deaths;
    Au.sfx('memory');
    return best;
  };
  /** F07: the player died while this boss's fight (or intro) was live — count it toward its Restore Echo. */
  Game.prototype.noteBossDefeat = function () {
    const b = this.boss, bf = this.bossFight, s = this.save;
    if (!s || !b || b.dead || (bf.state !== 'fight' && bf.state !== 'intro') || IDS.bosses.indexOf(b.id) < 0) return;
    const e = s.echo[b.id] || (s.echo[b.id] = { deaths: 0, tips: 0, at: 0 });
    e.deaths++;
  };
  // --- Signal Ledges (F04) -----------------------------------------------------------------------------------------------
  const LEDGE_REACH = 6;   // px each side of the pad's tile that still counts as touching it
  /**
   * A Signal Ledge (room.ledges, DESIGN §5.6) lights when the fighter's body touches its tile (± LEDGE_REACH px): for the
   * rest of this visit a hazard respawns the fighter standing on it instead of at the room's entry. The most recent one
   * touched wins; a room entry starts from the arrival again.
   */
  Game.prototype.updateLedges = function () {
    const pl = this.player, ls = this.level.room.ledges;
    if (this.ledgeT > 0 && this.ledgeT < 600) this.ledgeT++;
    for (let i = 0; i < ls.length; i++) {
      if (i === this.ledgeOn) continue;
      const L = ls[i];
      if (E.overlapBox(pl, L.x * TILE - LEDGE_REACH, L.y * TILE, TILE + 2 * LEDGE_REACH, TILE)) this.lightLedge(i);
    }
  };
  Game.prototype.lightLedge = function (i) {
    const L = this.level.room.ledges[i], hr = this.hazardRespawn;
    if (!L) return false;
    this.ledgeOn = i; this.ledgeT = 1;
    hr.x = L.x * TILE + TILE / 2; hr.y = (L.y + 1) * TILE; hr.vy = 0; hr.iframes = 0; hr.pending = false;
    const glow = this.zone ? this.zone.palette.glow : P.ENERGY;
    FX.burst('ring', hr.x, hr.y - 6, 1, { radius: 28, color: glow });
    FX.burst('glitter', hr.x, hr.y - 10, 8, { color: glow });
    Au.sfx('signal', hr.x);
    return true;
  };
  /**
   * Crush test (DESIGN §3.3): a mover has pushed the body so that it overlaps solid tiles by more than
   * 6 px on both the top and bottom edges or both side edges (plain tile collision never does this).
   */
  Game.prototype.crushed = function (pl) {
    const lv = this.level, hw = pl.w / 2, top = pl.y - pl.h;
    const inSolid = function (x, y) { return E.solidAt(lv, Math.floor(x / TILE), Math.floor(y / TILE)); };
    const up = inSolid(pl.x, top + 3), down = inSolid(pl.x, pl.y - 3);
    const lf = inSolid(pl.x - hw + 3, pl.cy()), rt = inSolid(pl.x + hw - 3, pl.cy());
    return (up && down) || (lf && rt);
  };
  /** Is any live enemy or the boss inside tile (tx, ty)? (a crumble tile only returns into empty space) */
  Game.prototype.tileOccupied = function (tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    for (let i = 0; i < this.enemies.length; i++) { const e = this.enemies[i]; if (!e.dead && E.overlapBox(e, x, y, TILE, TILE)) return true; }
    const b = this.boss;
    return !!(b && !b.dead && E.overlapBox(b, x, y, TILE, TILE));
  };
  Game.prototype.updateCrumble = function () {
    const lv = this.level, room = lv.room, pl = this.player;
    // trigger: player standing on 'c' tiles
    if (pl.onGround && pl.groundTy >= 0 && !pl.dead) {
      for (let tx = pl.groundTx0; tx <= pl.groundTx1; tx++) {
        if (room.tiles[pl.groundTy] && room.tiles[pl.groundTy][tx] === 'c' && !lv.gone[pl.groundTy * room.w + tx]) {
          let found = false;
          for (let i = 0; i < lv.crumble.length; i++) if (lv.crumble[i].tx === tx && lv.crumble[i].ty === pl.groundTy) { found = true; break; }
          if (!found) lv.crumble.push({ tx: tx, ty: pl.groundTy, state: 1, timer: T.crumbleShake });
        }
      }
    }
    for (let i = lv.crumble.length - 1; i >= 0; i--) {
      const c = lv.crumble[i];
      if (--c.timer > 0) continue;
      if (c.state === 1) {
        c.state = 2; c.timer = T.crumbleGone; lv.gone[c.ty * room.w + c.tx] = 1;
        R.redrawTiles(lv, c.tx - 1, c.ty - 1, c.tx + 1, c.ty + 1);
        FX.burst('chip', c.tx * TILE + 15, c.ty * TILE + 15, 4, { color: lv.zone.palette.tileFill });
        Au.sfx('crumble', c.tx * TILE);
      } else if (c.state === 2) {
        if (this.tileOccupied(c.tx, c.ty)) { c.timer = T.crumbleBack; continue; }   // a returning plank never closes onto an enemy or the boss (the player is the crush hazard's business)
        c.state = 3; c.timer = T.crumbleBack; lv.gone[c.ty * room.w + c.tx] = 0;
        R.redrawTiles(lv, c.tx - 1, c.ty - 1, c.tx + 1, c.ty + 1);
      } else lv.crumble.splice(i, 1);
    }
  };

  // --- camera (DESIGN §11.3.1) ---------------------------------------------------------------------------
  // Boss framing (playtest B38): the view frames the boss's focus point (`boss.focusX/focusY`, DESIGN §8.0 — the body,
  // Corrosant's head, Kernauth's core; the body centre when a boss sets none) with the fighter. Horizontally it is the
  // midpoint, never leaving the fighter closer than BOSS_CAM_SIDE to a side edge (only when the two are too far apart to
  // share the view: in rw_throne's 1920 px the midpoint could otherwise put the fighter off-screen). Vertically the dead-band camera is kept
  // while the focus sits inside [FOCUS_TOP, H − FOCUS_BOTTOM] of the view; otherwise the view eases toward it as far as
  // the fighter allows: the feet stay above the boss bar (screen y ≤ H − FEET_BOTTOM) and the head FOCUS_TOP under the
  // top edge. From the floor of bv_corrosant that limit keeps today's framing and Corrosant's edge beacon marks the head;
  // from its grates the view rises to show the ceiling.
  const BOSS_CAM_SIDE = 40, FOCUS_TOP = 70, FOCUS_BOTTOM = 110, FEET_BOTTOM = 96;
  Game.prototype.bossCam = function () {
    return !!this.boss && (this.bossFight.state === 'intro' || this.bossFight.state === 'fight');
  };
  Game.prototype.cameraTarget = function (out) {
    const pl = this.player, cam = this.cam, b = this.boss;
    if (this.bossCam()) {
      cam.look = 0;
      const fx = typeof b.focusX === 'number' && b.focusX === b.focusX ? b.focusX : b.x;
      out.x = U.clamp((pl.x + fx) / 2 - W / 2, pl.x + BOSS_CAM_SIDE - W, pl.x - BOSS_CAM_SIDE);
    } else {
      const running = Math.abs(pl.vx) > 60 && !pl.clinging;
      const want = running ? 90 * pl.facing : (pl.clinging ? -90 * pl.wallDir : 0);
      cam.look = U.approach(cam.look, want, running || pl.clinging ? 90 / 20 : 90 / 30);
      out.x = pl.x + cam.look - W / 2;
    }
    out.y = pl.y - H / 2;
    return out;
  };
  Game.prototype.clampCamera = function () {
    const cam = this.cam, rw = this.level.w * TILE, rh = this.level.h * TILE;
    cam.x = rw <= W ? (rw - W) / 2 : U.clamp(cam.x, 0, rw - W);
    cam.y = rh <= H ? (rh - H) / 2 : U.clamp(cam.y, 0, rh - H);
  };
  Game.prototype.updateCamera = function () {
    const cam = this.cam, pl = this.player;
    cam.px = cam.x; cam.py = cam.y;
    const tg = this.cameraTarget(this.scratch);
    cam.x += (tg.x - cam.x) * 0.12;
    const cy = cam.y + H / 2;
    let dy = 0;
    if (pl.y < cy - 70) dy = pl.y - (cy - 70); else if (pl.y > cy + 110) dy = pl.y - (cy + 110);
    const ny = cam.y + dy * (pl.vy > 700 ? 0.30 : 0.18);
    const b = this.boss;
    const fy = this.bossCam() ? (typeof b.focusY === 'number' && b.focusY === b.focusY ? b.focusY : b.cy()) : NaN;
    if (fy === fy && (fy < ny + FOCUS_TOP || fy > ny + H - FOCUS_BOTTOM)) {   // the boss's focus would be out of frame
      const lo = pl.y + FEET_BOTTOM - H, hi = pl.y - pl.h - FOCUS_TOP;   // the fighter's own bounds win over the focus
      const want = U.clamp(fy < ny + FOCUS_TOP ? fy - FOCUS_TOP : fy - (H - FOCUS_BOTTOM), lo, hi);
      cam.y = U.clamp(cam.y + (want - cam.y) * 0.12, lo, hi);   // eased, but a fast fall / jump never outruns the view
    } else cam.y = ny;
    this.clampCamera();
  };
  Game.prototype.snapCamera = function () {
    const cam = this.cam;
    const tg = this.cameraTarget(this.scratch);
    cam.x = tg.x; cam.y = tg.y + 20;
    this.clampCamera();
    cam.px = cam.x; cam.py = cam.y;
  };

  // --- the logic tick (CONTRACT §2.1) ---------------------------------------------------------------------
  /**
   * Snapshot px/py = x/y for everything the renderer interpolates (player, enemies, boss,
   * projectiles, pickups, movers, camera). Called on every early return of a play tick
   * (overlay, transition, hitstop) so a frozen world renders at its final position whatever
   * the accumulator alpha is, instead of sliding/jittering one frame of motion.
   */
  Game.prototype.snapInterp = function () {
    const pl = this.player, lv = this.level;
    if (!pl || !lv) return;
    pl.px = pl.x; pl.py = pl.y;
    for (let i = 0; i < this.enemies.length; i++) { const e = this.enemies[i]; e.px = e.x; e.py = e.y; }
    if (this.boss) { this.boss.px = this.boss.x; this.boss.py = this.boss.y; }
    for (let i = 0; i < this.projectiles.length; i++) { const p = this.projectiles[i]; p.px = p.x; p.py = p.y; }
    for (let i = 0; i < this.pickups.length; i++) { const p = this.pickups[i]; p.px = p.x; p.py = p.y; }
    for (let i = 0; i < lv.platforms.length; i++) { const p = lv.platforms[i]; p.px = p.x; p.py = p.y; }
    this.cam.px = this.cam.x; this.cam.py = this.cam.y;
  };
  Game.prototype.tick = function () {
    In.freezeBuffers = FX.hitstopFrames > 0 && this.screen === 'play' && !this.overlay;
    In.update();
    Au.update();
    this.frame++; this.screenT++;
    UI.tick(this);
    this.updateFade();
    if (this.screen !== 'play' || this.overlay) {
      if (!this.busy) UI.update(this);
      FX.update();
      if (this.screen === 'play') this.snapInterp();
      return;
    }
    // --- play ---
    if (!this.busy && this.mode !== 'transition') {
      if (In.state.pause.pressed) { this.openOverlay('pause'); this.snapInterp(); return; }
      if (In.state.map.pressed) { this.openOverlay('map'); this.snapInterp(); return; }
      // pending zone lore card (DESIGN §12.18): opens once the toast has settled, only in normal play
      if (this.loreTimer > 0 && this.mode === 'normal' && !this.player.dead && --this.loreTimer === 0) {
        const z = this.loreZone; this.loreZone = null;
        if (z && this.save.loreSeen.indexOf(z.id) < 0) { this.save.loreSeen.push(z.id); this.loreCard = z; UI.clearMessages(); this.openOverlay('lore'); this.snapInterp(); return; }
      }
    }
    this.save.playTimeFrames++;
    if (this.mode === 'transition') { this.updateTransition(); FX.update(); this.snapInterp(); return; }
    if (FX.hitstopFrames > 0) { FX.hitstopFrames--; FX.update(); this.snapInterp(); return; }

    const pl = this.player, lv = this.level;
    // previous positions for render interpolation
    pl.px = pl.x; pl.py = pl.y;
    for (let i = 0; i < this.enemies.length; i++) { const e = this.enemies[i]; e.px = e.x; e.py = e.y; }
    if (this.boss) { this.boss.px = this.boss.x; this.boss.py = this.boss.y; }
    for (let i = 0; i < this.projectiles.length; i++) { const p = this.projectiles[i]; p.px = p.x; p.py = p.y; }
    for (let i = 0; i < this.pickups.length; i++) { const p = this.pickups[i]; p.px = p.x; p.py = p.y; }
    for (let i = 0; i < lv.platforms.length; i++) stepPlatform(lv.platforms[i]);

    // mode handlers
    if (this.mode === 'hazard') this.updateHazard();
    else if (this.mode === 'nodeUse') this.updateNodeUse();
    else if (this.mode === 'bossIntro') this.updateBossIntro();
    else if (this.mode === 'pickupSeq') this.updatePickupSeq();

    // Node/vendor interaction runs BEFORE the player so an Up press at a node rests instead of jumping (DESIGN §2.2).
    if (this.mode === 'normal' && !pl.dead) { this.updateInteractions(); if (!pl.locked) this.updateHints(); }
    if (this.overlay) { this.snapInterp(); return; }   // the vendor just opened the shop
    const playerFrozen = this.mode === 'hazard';
    if (!playerFrozen) pl.update(this);
    // after a chute launch the first solid footing (a '#' or '-' tile row, no mover, no crumble) is the hazard respawn
    if (this.hazardRespawn.pending && this.mode === 'normal' && pl.onGround && !pl.ground && pl.groundTy >= 0 && !pl.dead) {
      let solid = true;
      for (let tx = pl.groundTx0; tx <= pl.groundTx1; tx++) { const ch = E.tileAt(lv, tx, pl.groundTy); if (ch !== '#' && ch !== '-') solid = false; }
      if (solid && pl.y - pl.h > 0 && pl.y <= lv.h * TILE) { const hr = this.hazardRespawn; hr.x = pl.x; hr.y = pl.y; hr.vy = 0; hr.iframes = 0; hr.pending = false; }
    }
    // F04: a Signal Ledge touched in normal play becomes this visit's hazard respawn
    if (lv.room.ledges.length && this.mode === 'normal' && !pl.dead) this.updateLedges();

    // enemies / boss / projectiles
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      e.update(this, pl);
      if (e.pullBy) this.holdPulled(e);
    }
    if (this.boss) {
      const bs = this.bossFight.state;
      if (bs === 'fight') this.boss.update(this, pl);
      else if (bs === 'dying') { this.boss.t++; this.updateBossDying(); }
      else if (bs === 'none' || bs === 'intro') {   // idle: ground bosses settle under gravity; fliers/crawlers (boss.flying) hold their spot
        this.boss.t++;
        if (!this.boss.flying) { this.boss.gravity(0.5, 12); this.boss.moveAndCollide(lv); }
        if (this.boss.flash > 0) this.boss.flash--;
      }
    }
    const rw = lv.w * TILE + OFFROOM, rh = lv.h * TILE + OFFROOM;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (p.dead) continue;
      p.update(this);
      if (p.x < -OFFROOM || p.x > rw || p.y < -OFFROOM || p.y > rh) p.dead = true;   // off-room cull
    }

    // hits, contact, hazards
    this.resolveHits();
    // body contact: never on a pogo tick / active down-strike (the bounce wins, DESIGN §3.6) nor while a
    // special declares itself contact-immune (Brackmaw's dive, Korvask's press — the victim is being hit)
    if (!pl.dead && !this.god && this.mode === 'normal' && !pl.pogoActive && !pl.contactImmune) {
      let took = false;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead || e.noContact || !(e.contact > 0)) continue;
        if (E.overlap(pl, e) && pl.hurt(e.contact, e.x, null)) { took = true; break; }
      }
      const b = this.boss;
      if (!took && b && b.active && !b.dead && b.contact > 0 && E.overlap(pl, b)) took = pl.hurt(b.contact, b.x, null);
      if (took && FX.hitstopFrames > 5) this.impactZoom(pl.x, pl.cy());
    }
    if (!pl.dead && !this.god && this.mode === 'normal') {
      const hz = E.hazardAt(pl, lv, pl.pogoActive);
      if (hz) this.startHazard(hz);
      else if (lv.platforms.length && this.crushed(pl)) this.startHazard('crush');   // DESIGN §3.3: crush by moving geometry
    }
    // sweep the dead (an enemy that somehow left the room downward is dropped silently: no drops, no purge count)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.dead && e.y - e.h > rh + OFFROOM * 2) e.dead = true;
      if (e.dead) this.enemies.splice(i, 1);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].dead) this.projectiles.splice(i, 1);

    // pickups, crumble, nodes, exits, boss trigger
    if (this.mode === 'normal' || this.mode === 'nodeUse') this.updatePickups();
    this.updateCrumble();
    if (this.mode === 'normal' && !pl.dead) {
      if (this.checkExits()) { FX.update(); this.snapInterp(); return; }
      const rb = lv.boss;
      if (this.boss && this.bossFight.state === 'none' && rb) {
        const tx = pl.x / TILE;
        if (tx >= rb.bounds[0] && tx <= rb.bounds[1]) this.startBossFight();
      }
    }
    // death
    if (pl.dead && this.mode !== 'dying') { this.noteBossDefeat(); this.mode = 'dying'; this.save.deaths++; FX.shake(5, 20); }
    if (this.mode === 'dying' && pl.deathTimer >= T.deathFrames && !this.busy) {
      const self = this;
      this.busy = true;
      Au.duck(0, 0.6);
      this.fadeTo(1, T.gameOverFade, function () { self.setScreen('gameover'); self.fadeLevel = 0; self.fadeTarget = 0; self.busy = false; });
    }
    FX.update();
    this.updateCamera();
    // A hit this frame requested world hitstop: freeze at the impact position right away
    // (otherwise the render between this tick and the first frozen one would still slide).
    if (FX.hitstopFrames > 0) this.snapInterp();
  };

  // --- render (CONTRACT §2.2) ----------------------------------------------------------------------------
  Game.prototype.drawWorld = function (ctx, alpha) {
    const lv = this.level, zone = this.zone, pl = this.player;
    const cx = Math.round(U.lerp(this.cam.px, this.cam.x, alpha) + FX.shakeX), cy = Math.round(U.lerp(this.cam.py, this.cam.y, alpha) + FX.shakeY);
    R.drawBackground(ctx, zone, cx, cy);
    R.drawAmbient(ctx, zone, lv, this.frame, cx, cy);
    R.drawTileCache(ctx, lv, cx, cy);
    ctx.save();
    ctx.translate(-cx, -cy);
    R.drawDynamicTiles(ctx, lv, this.frame, cx, cy);
    for (let i = 0; i < lv.platforms.length; i++) R.drawPlatform(ctx, lv.platforms[i], zone, alpha);
    const room = lv.room;
    for (let i = 0; i < room.nodes.length; i++) {
      const n = room.nodes[i];
      const pulse = this.mode === 'nodeUse' && this.nodeUse.node === n ? 1 - this.nodeUse.timer / T.nodePulse : 0;
      R.drawNode(ctx, n.x * TILE + 15, (n.y + 1) * TILE, zone, this.save.nodesUsed.indexOf(n.id) >= 0, this.frame, pulse);
    }
    const ls = room.ledges;   // F04 Signal Ledges: the lit one holds this visit's hazard respawn
    for (let i = 0; i < ls.length; i++) R.drawLedge(ctx, ls[i].x * TILE + 15, (ls[i].y + 1) * TILE, zone, i === this.ledgeOn, this.frame, i === this.ledgeOn ? this.ledgeT : 0);
    if (room.vendor) R.drawVendor(ctx, room.vendor.x * TILE + 15, (room.vendor.y + 1) * TILE, zone, this.frame, pl.x);
    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if (p.x > cx - 80 && p.x < cx + W + 80 && p.y > cy - 80 && p.y < cy + H + 80) R.drawPickup(ctx, p, p.t, alpha);
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.x + e.w > cx - 80 && e.x - e.w < cx + W + 80 && e.y + e.h > cy - 80 && e.y - e.h < cy + H + 80) e.draw(ctx, this, alpha);
    }
    if (this.boss) this.boss.draw(ctx, this, alpha);
    if (pl) pl.draw(ctx, this, alpha);
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (p.x + p.w > cx - 80 && p.x - p.w < cx + W + 80 && p.y + p.h > cy - 80 && p.y - p.h < cy + H + 80) p.draw(ctx, this, alpha);
    }
    if (this.setting('hazardOutline')) this.drawHazardHits(ctx);   // F05: every hazardous enemy/boss box gets the hatched rim
    FX.draw(ctx);
    if (this.settings.showHitboxes) this.drawHitboxes(ctx);
    ctx.restore();
    const isBoss = !!lv.boss;
    R.drawFog(ctx, zone, pl.x - cx, pl.cy() - cy, isBoss);
    R.drawVignette(ctx);
    if (this.mode === 'pickupSeq') { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H); }
  };
  /**
   * HAZARD OUTLINE (F05): the attack boxes enemies, bosses and their shots registered on the last resolved tick (the
   * engine's copies in dbgHits — frozen with the world in hitstop and under an overlay) drawn with the shared
   * high-contrast hatched rim (UB.Render.hazardBox), so what hurts reads by shape and luminance, not hue.
   */
  Game.prototype.drawHazardHits = function (ctx) {
    for (let i = 0; i < this.dbgHitCount; i++) {
      const h = this.dbgHits[i];
      if (h.owner === 'player' || !(h.w > 0) || !(h.h > 0)) continue;
      R.hazardBox(ctx, h.x, h.y, h.w, h.h, this.frame);
    }
  };
  Game.prototype.drawHitboxes = function (ctx) {
    ctx.lineWidth = 1;
    const pl = this.player, b = this.box;
    ctx.strokeStyle = P.ENERGY; ctx.globalAlpha = 0.6; pl.box(b); ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = P.SELECT;
    for (let i = 0; i < this.enemies.length; i++) { this.enemies[i].box(b); ctx.strokeRect(b.x, b.y, b.w, b.h); }
    if (this.boss) { this.boss.box(b); ctx.strokeRect(b.x, b.y, b.w, b.h); }
    ctx.fillStyle = P.DANGER; ctx.globalAlpha = 0.25;
    for (let i = 0; i < this.dbgHitCount; i++) { const h = this.dbgHits[i]; ctx.fillRect(h.x, h.y, h.w, h.h); }
    ctx.strokeStyle = P.BITS; ctx.globalAlpha = 0.6;
    const room = this.level.room;
    for (let i = 0; i < room.exits.length; i++) { const e = room.exits[i]; ctx.strokeRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE); }
    ctx.globalAlpha = 1;
  };
  Game.prototype.render = function (alpha) {
    const dpr = this.dpr;
    const wc = this.wctx, mc = this.mctx;
    const inWorld = this.level && this.player && (this.screen === 'play');
    wc.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (inWorld && this.mode !== 'transition') { this.drawWorld(wc, alpha); }
    else if (inWorld && this.transition.phase !== 'freeze') { this.drawWorld(wc, 1); }
    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.fillStyle = P.LETTERBOX; mc.fillRect(0, 0, W, H);
    if (inWorld) {
      const tr = this.transition;
      if (this.mode === 'transition' && tr.phase === 'freeze') {
        mc.drawImage(this.snap, 0, 0, this.snap.width, this.snap.height, 0, 0, W, H);
      } else if (this.mode === 'transition' && tr.phase === 'slide') {
        const k = U.easeOutCubic(1 - tr.timer / T.slide);
        const ox = tr.dx * W * k, oy = tr.dy * H * k;
        mc.drawImage(this.snap, 0, 0, this.snap.width, this.snap.height, -ox, -oy, W, H);
        mc.drawImage(this.world, 0, 0, this.world.width, this.world.height, tr.dx * W - ox, tr.dy * H - oy, W, H);
      } else if (this.zoom.t > 0) {   // DESIGN §11.3.3: one frame at 102 % about the impact point
        this.zoom.t--;
        const zx = U.clamp(this.zoom.x - this.cam.x, 0, W), zy = U.clamp(this.zoom.y - this.cam.y, 0, H);
        mc.save(); mc.translate(zx, zy); mc.scale(1.02, 1.02); mc.translate(-zx, -zy);
        mc.drawImage(this.world, 0, 0, this.world.width, this.world.height, 0, 0, W, H);
        mc.restore();
      } else {
        mc.drawImage(this.world, 0, 0, this.world.width, this.world.height, 0, 0, W, H);
      }
      FX.drawScreen(mc);
      UI.drawHUD(mc, this);
    }
    // a fade caught in flight by an overlay (pause/map during the hazard fade, an auto-pause) stays UNDER the
    // overlay so the menu is readable; screen fades (title/select/game over) have no overlay and cover everything
    const fadeUnder = inWorld && this.overlay;
    if (fadeUnder && this.fadeLevel > 0) { mc.globalAlpha = this.fadeLevel; mc.fillStyle = '#07050A'; mc.fillRect(0, 0, W, H); mc.globalAlpha = 1; }
    UI.drawScreen(mc, this);
    if (!fadeUnder && this.fadeLevel > 0) { mc.globalAlpha = this.fadeLevel; mc.fillStyle = '#07050A'; mc.fillRect(0, 0, W, H); mc.globalAlpha = 1; }
    In.drawTouch(mc);
  };

  // --- debug / test API (DESIGN §16.9, CONTRACT §9) ------------------------------------------------------------
  function makeDebug(game) {
    const d = {};
    d.state = function () {
      const pl = game.player, s = game.save, b = game.boss;
      return {
        screen: game.overlay || game.screen, baseScreen: game.screen, overlay: game.overlay, mode: game.mode, busy: game.busy,
        roomId: game.level ? game.level.room.id : null, zoneId: game.zone ? game.zone.id : null,
        fighter: s ? s.fighter : null,
        x: pl ? pl.x : 0, y: pl ? pl.y : 0, vx: pl ? pl.vx : 0, vy: pl ? pl.vy : 0,
        hp: pl ? pl.hp : 0, maxHp: pl ? pl.maxHp : 0, energy: pl ? pl.energy : 0, meter: pl ? pl.meter : 0,
        abilities: s ? { echoJump: !!s.abilities.echoJump, burstLine: !!s.abilities.burstLine, gripProtocol: !!s.abilities.gripProtocol } : null,
        cores: s ? s.cores.slice() : [], bits: s ? s.bits : 0, bossesDefeated: s ? s.bossesDefeated.slice() : [],
        overclock: !!(pl && pl.ocActive), grounded: !!(pl && pl.onGround), playerState: pl ? pl.state : null,
        dead: !!(pl && pl.dead), locked: !!(pl && pl.locked), iframes: pl ? pl.iframes : 0,
        frame: game.frame, deaths: s ? s.deaths : 0, playTimeFrames: s ? s.playTimeFrames : 0,
        enemies: game.enemies.length, pickups: game.pickups.length,
        boss: b ? { id: b.id, hp: b.hp, maxHp: b.maxHp, phase: b.phase, state: b.state, attack: b.attack, active: b.active } : null,
        bossFight: game.bossFight.state, hazardFreeze: game.mode === 'hazard', transition: game.mode === 'transition',
        fade: game.fadeLevel, hitstop: FX.hitstopFrames, god: game.god, logicPaused: game.logicPaused,
        nearNode: game.nearNode ? game.nearNode.id : null, nearVendor: game.nearVendor, prompt: game.prompt ? game.prompt.text : null,
        projectiles: game.projectiles.length, vendor: s ? s.vendor.slice() : [], energyMax: pl ? pl.energyMax : 0,
        loreSeen: s ? s.loreSeen.slice() : [], hints: s ? Object.assign({}, s.hints) : null,
        ledge: game.ledgeOn, introsSeen: s && s.introsSeen ? s.introsSeen.slice() : [], echo: s && s.echo ? JSON.parse(JSON.stringify(s.echo)) : {},
        hasSave: game.hasSave(), savedRoom: game.savedData ? game.savedData.roomId : null,
      };
    };
    d.warp = function (roomId, exitIdOrPos) {
      if (!game.player) return false;
      let arrival;
      if (exitIdOrPos && typeof exitIdOrPos === 'object') arrival = { x: exitIdOrPos.x, y: exitIdOrPos.y };
      else if (typeof exitIdOrPos === 'string') {
        // Arriving through exit X means we left the previous room through the opposite side, so a
        // warp to a bottom exit gets the chute launch and a top exit the +120 px/s arrival, as in play.
        const room = Wd.rooms[roomId], ex = room ? Wd.exit(room, exitIdOrPos) : null;
        const OPP = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
        arrival = { exitId: exitIdOrPos, side: ex ? OPP[ex.side] : undefined };
      }
      else arrival = {};
      game.mode = 'normal'; game.player.locked = false; FX.hitstopFrames = 0; game.zoom.t = 0;
      if (game.transition.phase) { game.transition.phase = ''; game.transition.timer = 0; }
      game.loadRoom(roomId, arrival);
      return true;
    };
    d.teleport = function (x, y) { if (!game.player) return false; game.player.place(x, y, { airJumps: 1 }); game.snapCamera(); return true; };
    d.grant = function (id, on) { return game.save ? game.grantAbility(id, on !== false) : false; };
    d.setHp = function (n) { if (game.player) { game.player.hp = U.clamp(n | 0, 0, game.player.maxHp); if (game.player.hp <= 0) game.player.die(); } };
    d.setMaxHp = function (n) { if (game.player) { game.player.maxHp = Math.max(1, n | 0); game.save.maxHearts = game.player.maxHp; if (game.player.hp > n) game.player.hp = n; } };
    d.setEnergy = function (n) { if (game.player) game.player.energy = U.clamp(n, 0, game.player.energyMax); };
    d.setMeter = function (n) { if (game.player) game.player.meter = U.clamp(n, 0, game.player.meterMax); };
    d.addBits = function (n) { if (game.save) game.addBits(n | 0); };
    d.setBits = function (n) { if (game.save) game.save.bits = n | 0; };
    /**
     * defeatBoss(bossId?): the faithful defeat (Game.defeatBoss). With no id, the boss live in this room (else the room's
     * boss record while it is still unbeaten); false when there is nothing to defeat or the id is unknown.
     */
    d.defeatBoss = function (bossId) {
      if (!game.save) return false;
      if (bossId === undefined || bossId === null) {
        const b = game.boss, spec = game.level ? game.level.boss : null;
        bossId = b && !b.dead ? b.id : (spec && game.save.bossesDefeated.indexOf(spec.id) < 0 ? spec.id : null);
      }
      return game.defeatBoss(bossId);
    };
    d.killEnemies = function () { for (let i = 0; i < game.enemies.length; i++) game.enemies[i].dead = true; game.enemies.length = 0; };
    /** Place an enemy in the current room: type id, feet tile (tx, ty), opts = extra spawn fields. Returns {type,x,y,hp,state} or null. */
    d.spawnEnemy = function (type, tx, ty, opts) {
      if (!game.level) return null;
      const e = game.spawnEnemy(type, tx, ty, opts || null);
      return e ? { type: e.type, x: e.x, y: e.y, hp: e.hp, state: e.state } : null;
    };
    /**
     * Create a boss in the current room. opts: {x, y} feet tile (default: the room's boss
     * spawn, else 8 tiles right of the player), {fight:true} runs the full trigger flow
     * (seal → intro card → fight); default places it live (bossFight 'fight', active).
     * Rooms without a boss record get a synthesized spec (bounds = whole room, no seals,
     * pickup under the player). Returns d.boss() or null for an unknown id.
     */
    d.spawnBoss = function (bossId, opts) {
      if (!game.level || !game.player) return null;
      opts = opts || {};
      const room = game.level.room, pl = game.player;
      let spec = room.boss && room.boss.id === bossId ? room.boss : null;
      if (!spec) {
        const ptx = Math.floor(pl.x / TILE), pty = Math.floor((pl.y - 1) / TILE);
        spec = { id: bossId, bounds: [0, room.w - 1], seal: [], locked: [], final: !!UB.Bosses.rewardFor(bossId).final,
          pickup: { x: ptx, y: pty }, spawn: { x: Math.min(room.w - 2, ptx + 8), y: pty } };
      }
      if (opts.x !== undefined && opts.y !== undefined) spec = Object.assign({}, spec, { spawn: { x: opts.x, y: opts.y } });
      const b = UB.Bosses.create(bossId, room, game, spec);
      if (!b) return null;
      if (game.boss) game.boss.dead = true;
      game.level.boss = spec;
      game.boss = b; game.bossFight.state = 'none'; game.bossFight.timer = 0;
      game.mode = 'normal'; pl.locked = false;
      if (opts.fight) game.startBossFight();
      else { game.bossFight.state = 'fight'; b.active = true; if (b.onFightStart) b.onFightStart(game); }
      return d.boss();
    };
    /**
     * Fire a presentation effect from tests. type: a UB.FX.burst preset ('spark' 'chip' 'dust'
     * 'glitter' 'ring' 'pogo' 'heal' 'aura'; opts {n, color, dir, radius, life}), or 'shake'
     * {mag, frames}, 'flash' {color, alpha, frames}, 'hitstop' {frames}, 'text' {str, color, frames}.
     * x, y are world px. Returns the live particle count.
     */
    d.fx = function (type, x, y, opts) {
      opts = opts || {};
      if (type === 'shake') FX.shake(opts.mag || 5, opts.frames || 10);
      else if (type === 'flash') FX.flash(opts.color || '#FFFFFF', opts.alpha !== undefined ? opts.alpha : 0.5, opts.frames || 8);
      else if (type === 'hitstop') FX.hitstop(opts.frames || 4);
      else if (type === 'text') FX.text(opts.str || '+1', x, y, opts.color || P.PAPER, opts.frames || 20);
      else FX.burst(type, x, y, opts.n || 8, opts);
      return FX.count();
    };
    d.god = function (on) { game.god = on !== false; return game.god; };
    d.godmode = d.god;
    d.step = function (n) { n = n === undefined ? 1 : (n | 0); for (let i = 0; i < n; i++) game.tick(); return game.frame; };
    /**
     * Test-only timing probe: run n logic ticks each followed by a render, timed with
     * performance.now (presentation only — the logic itself never reads the clock).
     * Returns ms averages: {frames, avgTick, avgRender, avgTotal, maxTick, maxTotal}.
     */
    d.bench = function (n) {
      n = n === undefined ? 60 : (n | 0);
      let tick = 0, render = 0, maxTick = 0, maxTotal = 0;
      for (let i = 0; i < n; i++) {
        const t0 = performance.now(); game.tick(); const t1 = performance.now(); game.render(1); const t2 = performance.now();
        tick += t1 - t0; render += t2 - t1;
        if (t1 - t0 > maxTick) maxTick = t1 - t0;
        if (t2 - t0 > maxTotal) maxTotal = t2 - t0;
      }
      return { frames: n, avgTick: tick / n, avgRender: render / n, avgTotal: (tick + render) / n, maxTick: maxTick, maxTotal: maxTotal };
    };
    d.frame = function () { return d.step(1); };
    d.pauseLogic = function (on) { game.logicPaused = on !== false; return game.logicPaused; };
    d.pressed = function (action, frames) { In.press(action, frames || 1); };
    d.newGame = function (fighterId) { if (game.screen !== 'select') { game.toTitle(); game.setScreen('select'); } game.newGame(fighterId); };
    d.startGame = d.newGame;
    d.continueGame = function () { if (game.screen !== 'title') game.toTitle(); return game.continueGame(); };
    d.toTitle = function () { game.toTitle(); };
    d.skipTo = function (screen) {
      if (screen === 'title') game.toTitle();
      else if (screen === 'select') { if (game.screen !== 'select') { game.toTitle(); game.setScreen('select'); } }
      else if (screen === 'pause' || screen === 'map' || screen === 'settings' || screen === 'shop' || screen === 'lore' || screen === 'controls' || screen === 'archive') {
        if (game.screen === 'play') { if (screen === 'lore') game.loreCard = game.zone; game.openOverlay(screen); }
        else if (screen === 'settings' || screen === 'controls') game.openOverlay(screen);
      }
      else if (screen === 'play') { if (game.overlay) { game.overlay = null; game.overlayFrom = null; game.overlayStack.length = 0; } if (game.screen !== 'play' && game.player && game.level) game.setScreen('play'); }
      else if (screen === 'gameover' && game.player) { game.player.die(); }
      else if (screen === 'victory' && game.save) { game.victory(); }
      return game.overlay || game.screen;
    };
    d.save = function () { return game.writeSave(); };
    d.load = function () { return d.continueGame(); };
    d.reset = function () { if (!game.resetSave()) game.eraseSlot(); };   // always clears the slot (a stale one the title never read too)
    d.audio = function () { return Au.state(); };
    d.mute = function () { Au.mute(); };
    d.rooms = function () {
      const out = [];
      for (const id in Wd.rooms) { const r = Wd.rooms[id]; out.push({ id: id, zone: r.zone, w: r.w, h: r.h, exits: r.exits.map(function (e) { return { id: e.id, side: e.side, to: e.to }; }) }); }
      return out;
    };
    d.enemies = function () { return game.enemies.map(function (e) { return { type: e.type, x: e.x, y: e.y, hp: e.hp, state: e.state }; }); };
    d.pickups = function () { return game.pickups.map(function (p) { return { type: p.type, x: p.x, y: p.y, size: p.size }; }); };
    d.boss = function () { const b = game.boss; return b ? { id: b.id, hp: b.hp, maxHp: b.maxHp, phase: b.phase, state: b.state, attack: b.attack, fight: game.bossFight.state } : null; };
    d.showHitboxes = function (on) { game.setSetting('showHitboxes', on !== false); };
    d.worldErrors = function () { return Wd.validate(); };
    d.buy = function (itemId) { return game.buy(itemId); };
    d.game = game;
    return d;
  }

  UB.Engine = { Game: Game, makeDebug: makeDebug, T: T };
})(window.UB);
