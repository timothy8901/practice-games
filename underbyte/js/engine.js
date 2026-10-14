/*
 * UNDERBYTE — js/engine.js
 * Owner: ENGINE ARCHITECT (do not edit from other modules).
 * Contract: CONTRACT.md §2 (tick/render order), §4.10 (UB.Engine / game API), §9 (UB.debug).
 * Design: DESIGN.md §3 (rules), §5.5 (exits, nodes, movers), §8.0 (boss sequence),
 *         §9 (pickups), §11.3 (camera, transitions), §14 (save), §16.9 (debug API).
 *
 * The Game object owns: the screen state machine, the fixed-60 Hz logic tick
 * (driven by main.js's accumulator — nothing here reads wall-clock time),
 * room loading + runtime level state (crumble, movers, seals), the entity
 * lists, hit resolution, contact + hazards, pickups and drops, restore nodes,
 * exits + room transitions, boss fight sequencing, death/respawn, save/load,
 * the camera, and rendering composition. It never draws a character itself:
 * characters/enemies/bosses/UI/FX draw through their hooks.
 */
'use strict';
(function (UB) {
  const W = 960, H = 540, TILE = 30;
  const E = UB.Entity, FX = UB.FX, In = UB.Input, Au = UB.Audio, U = UB.Util, Wd = UB.World, R = UB.Render, UI = UB.UI, P = UB.Palette;
  const SAVE_KEY = 'underbyte.save', SETTINGS_KEY = 'underbyte.settings';
  const SAVE_VERSION = 1;
  const MAX_HITS = 64;

  // Timings (frames) pinned by DESIGN.md.
  const T = {
    freeze: 6, slide: 18, settle: 4,
    hazardFreeze: 30, hazardFade: 10, hazardIFrames: 45, hazardHitstop: 6,
    deathFrames: 60, gameOverFade: 40, respawnFade: 20,
    bossIntro: 150, bossSeal: 12, pickupSeq: 120, bossDeath: 90,
    nodePulse: 30, crumbleShake: 20, crumbleGone: 180, crumbleBack: 6,
    zoneToast: 150, selectFade: 20, chuteLaunch: 1.2, chuteIFrames: 20, topArrivalVy: 120,
  };
  const BIT_VALUE = { small: 1, medium: 5, large: 20 };
  const PICKUP_SIZE = { bit: 10, heart: 14, spark: 12, shard: 12, core: 18, ability: 24 };
  // Ability banner lines (DESIGN §12.7 / §15.5). UI/WORLD implementers may replace via UB.Text later.
  const ABILITY_TEXT = {
    echoJump: ['ECHO JUMP ACQUIRED', 'Press JUMP again in the air', 'A second thought, taken mid-fall.'],
    burstLine: ['BURST LINE ACQUIRED', 'Press DASH to burst forward', 'Prefetch the ground before it arrives.'],
    gripProtocol: ['GRIP PROTOCOL ACQUIRED', 'Hold toward a wall to cling · JUMP to kick off', 'Nothing sheer is final.'],
  };
  const DEFAULT_SETTINGS = { version: 1, master: 8, music: 7, sfx: 8, screenShake: true, showHitboxes: false, touchControls: 'auto' };

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
    this.hazardRespawn = { x: 0, y: 0 };
    this.bossFight = { state: 'none', timer: 0 };   // none|intro|fight|dying|reward|done
    this.pickupSeq = { timer: 0, pickup: null };
    this.nodeUse = { timer: 0, node: null };
    this.fadeLevel = 0; this.fadeTarget = 0; this.fadeStep = 0; this.fadeCb = null; this.fadeT = 0;
    this.god = false; this.logicPaused = false;
    this.prompt = null; this.nearNode = null;
    this.denyFlash = 0;
    this.lastFighter = 'tessik';
    this.rng = U.rng(0x5EED);
    this.scratch = { x: 0, y: 0 };
    this.box = { x: 0, y: 0, w: 0, h: 0 };
  }
  Game.ABILITY_TEXT = ABILITY_TEXT;

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
    if (dpr === this.dpr && this.canvas.width === W * dpr) return;
    this.dpr = dpr;
    this.canvas.width = W * dpr; this.canvas.height = H * dpr;
    this.world.width = W * dpr; this.world.height = H * dpr;
    this.snap.width = W * dpr; this.snap.height = H * dpr;
    if (this.level) R.buildTileCache(this.level, dpr);
  };

  // --- screens --------------------------------------------------------------------------------
  Game.prototype.setScreen = function (name) {
    this.screen = name; this.overlay = null; this.overlayFrom = null; this.screenT = 0;
    UI.enter(name, this);
  };
  Game.prototype.openOverlay = function (name) {
    if (this.overlay === name) return;
    this.overlayFrom = this.overlay; this.overlay = name; UI.enter(name, this);
    if (this.screen === 'play') Au.duck(0.4, 0.17);
  };
  Game.prototype.closeOverlay = function () {
    this.overlay = this.overlayFrom; this.overlayFrom = null;
    if (this.overlay) UI.enter(this.overlay, this); else Au.duck(1, 0.17);
  };
  Game.prototype.toTitle = function () {
    this.busy = false; this.mode = 'normal'; this.level = null; this.player = null; this.boss = null;
    this.enemies.length = 0; this.pickups.length = 0; this.projectiles.length = 0;
    FX.clear(); UI.clearMessages();
    this.savedData = this.readSave();
    this.setScreen('title'); Au.music('title'); Au.stopAmbient(); Au.duck(1, 0.2);
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
  /** Start a new run with a fighter (from the select screen or UB.debug). */
  Game.prototype.newGame = function (fighterId) {
    if (this.busy) return;
    const self = this;
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
    this.cam.look = 0;
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
      self.fadeTo(0, T.respawnFade, function () { self.busy = false; });
    });
  };
  /** The final boss is down: record, save, show stats. */
  Game.prototype.victory = function () {
    const self = this;
    this.save.victory = true;
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
      hints: { move: false, jump: false, light: false, heavy: false, special: false, dash: false, overclock: false },
      enemiesPurged: 0, playTimeFrames: 0, deaths: 0, victory: false, savedAt: 0,
    };
  };
  /** Read + validate localStorage; null = no usable save. */
  Game.prototype.readSave = function () {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    let d = null;
    try { d = JSON.parse(raw); } catch (e) { return null; }
    if (!d || d.version !== SAVE_VERSION) return null;
    const fresh = this.newSaveData(d.fighter);
    for (const k in fresh) if (d[k] === undefined) d[k] = fresh[k];
    if (!UB.Characters.DATA[d.fighter]) d.fighter = UB.Characters.list[0].id;
    if (!Wd.rooms[d.roomId] || !d.spawn || !Wd.findNode(d.spawn.nodeId)) { d.roomId = Wd.start.room; d.spawn = { nodeId: Wd.start.nodeId }; }
    d.baseHearts = UB.Characters.DATA[d.fighter].hp;
    d.maxHearts = d.baseHearts + d.cores.length;
    d.hearts = d.maxHearts;
    return d;
  };
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
  Game.prototype.resetSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.savedData = null;
    UI.toast('SAVE ERASED', '', 90);
  };
  Game.prototype.loadSettings = function () {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { d = null; }
    this.settings = {};
    for (const k in DEFAULT_SETTINGS) this.settings[k] = d && d[k] !== undefined ? d[k] : DEFAULT_SETTINGS[k];
    this.applySettings();
  };
  Game.prototype.setSetting = function (key, value) {
    this.settings[key] = value;
    this.applySettings();
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
  };
  Game.prototype.applySettings = function () {
    FX.setShakeEnabled(this.settings.screenShake);
    Au.setVolumes({ master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx });
  };

  // --- rooms --------------------------------------------------------------------------------------
  function makeLevel(room) {
    const lv = {
      room: room, w: room.w, h: room.h, zone: Wd.zoneOf(room),
      gone: new Uint8Array(room.w * room.h), sealedMask: new Uint8Array(room.w * room.h),
      openings: [], platforms: [], crumble: [], tileCache: null, cacheScale: 1, sealedExits: [],
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
    FX.clear();
    this.enemies.length = 0; this.projectiles.length = 0; this.pickups.length = 0;
    this.prompt = null; this.nearNode = null; this.hitCount = 0;
    this.spawnRoomEnemies();
    this.boss = null; this.bossFight.state = 'none'; this.bossFight.timer = 0;
    if (room.boss && this.save.bossesDefeated.indexOf(room.boss.id) < 0) {
      this.boss = UB.Bosses.create(room.boss.id, room, this);
      if (!this.boss) warnOnce('boss:' + room.boss.id, 'no boss for id ' + room.boss.id);
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
    this.hazardRespawn.x = pos.x; this.hazardRespawn.y = pos.y;
    // map bookkeeping
    const s = this.save;
    if (s.visited.indexOf(room.id) < 0) s.visited.push(room.id);
    if (s.discovered.indexOf(room.id) < 0) s.discovered.push(room.id);
    for (let i = 0; i < room.exits.length; i++) if (s.discovered.indexOf(room.exits[i].to.room) < 0) s.discovered.push(room.exits[i].to.room);
    if (prevZone !== this.zone) {
      UI.toast(this.zone.name, this.zone.blurb, T.zoneToast);
      Au.music(this.zone.song); Au.ambient(this.zone.id);
    }
    R.buildTileCache(this.level, this.dpr);
    this.snapCamera();
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
          if (!p.destructible || p.dead || h.hitList.indexOf(p) >= 0) continue;
          if (E.overlapBox(p, h.x, h.y, h.w, h.h)) {
            h.hitList.push(p); p.dead = true;
            this.addMeter(2, false); FX.burst('spark', p.x, p.cy(), 4, { color: P.PAPER });
            if (p.onPopped) p.onPopped(this);
            if (h.onHit) h.onHit(p, null, this);
          }
        }
      } else if (pl && !pl.dead && h.hitList.indexOf(pl) < 0 && E.overlapBox(pl, h.x, h.y, h.w, h.h)) {
        if (!this.god && this.mode !== 'hazard') {
          if (pl.hurt(h.dmg, h.x + h.w / 2, null)) { h.hitList.push(pl); if (h.onHit) h.onHit(pl, null, this); }
        }
      }
    }
    this.hitCount = 0;
  };
  Game.prototype.hitEnemy = function (e, h) {
    h.hitList.push(e);
    const res = e.takeHit ? e.takeHit(h, this) : E.applyHit(e, h);
    const cx = Math.max(e.left(), h.x), cy = Math.max(e.top(), h.y);
    const ix = (cx + Math.min(e.right(), h.x + h.w)) / 2, iy = (cy + Math.min(e.y, h.y + h.h)) / 2;
    if (res.blocked) {
      FX.burst('spark', ix, iy, 3, { color: P.PAPER, dir: h.facing }); Au.sfx('whiff', e.x);
      this.addMeter(Math.floor(h.meter * 0.25), true);
      if (h.onHit) h.onHit(e, res, this);
      return;
    }
    FX.hitstop(h.hitstop);
    if (h.shake) FX.shake(h.shake, h.shakeFrames);
    const n = h.kind === 'heavy' ? 8 : (h.kind === 'special' ? 10 : (h.kind === 'ultimate' ? 16 : 4));
    FX.burst('spark', ix, iy, n, { color: this.player ? this.player.data.palette.glow : P.PAPER, dir: h.facing });
    if (h.kind === 'heavy' || h.tag === 'light3') FX.burst('ring', ix, iy, 1, { radius: 30 });
    Au.sfx(h.kind === 'heavy' ? 'heavyHit' : 'lightHit', e.x); Au.sfx('enemyHit', e.x);
    this.addEnergy(h.energy); this.addMeter(h.meter, true);
    if (h.onHit) h.onHit(e, res, this);
    if (res.killed) this.killEnemy(e, h);
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
  Game.prototype.hitBoss = function (b, h) {
    h.hitList.push(b);
    const res = b.takeHit ? b.takeHit(h, this) : E.applyHit(b, h);
    if (res.blocked) { if (h.onHit) h.onHit(b, res, this); return; }
    FX.hitstop(h.hitstop); FX.shake(1, 3);
    FX.burst('spark', h.x + h.w / 2, h.y + h.h / 2, 6, { color: this.player.data.palette.glow, dir: h.facing });
    Au.sfx('bossHit', b.x); Au.sfx(h.kind === 'heavy' ? 'heavyHit' : 'lightHit', b.x);
    this.addEnergy(h.energy); this.addMeter(h.meter, true);
    if (h.onHit) h.onHit(b, res, this);
    if (b.hp <= 0 && this.bossFight.state === 'fight') this.startBossDeath();
  };
  /** Add a projectile: an entity with update(game), draw(ctx, game, alpha), dead (+ destructible/onPopped). */
  Game.prototype.spawnProjectile = function (obj) { obj.px = obj.x; obj.py = obj.y; this.projectiles.push(obj); return obj; };
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
      UI.banner('CORE FOUND', '+1 max heart', 'Something the kingdom kept for itself.', 182);
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
    const b = this.boss, bf = this.bossFight;
    bf.state = 'intro'; bf.timer = T.bossIntro; this.mode = 'bossIntro';
    this.player.locked = true; this.player.vx = 0;
    if (this.level.room.boss.seal) this.sealExits(this.level.room.boss.seal, true);
    UI.bossCard(b.name, b.subtitle, T.bossIntro);
    Au.music('boss');
    if (b.onIntro) b.onIntro(this);
  };
  Game.prototype.updateBossIntro = function () {
    const bf = this.bossFight;
    bf.timer--;
    if (bf.timer === T.bossIntro - 8) { Au.sfx('bossRoar', this.boss.x); FX.shake(7, 12); }
    if (bf.timer <= 0) {
      bf.state = 'fight'; this.mode = 'normal'; this.player.locked = false;
      this.boss.active = true;
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
    Au.stopMusic();
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
  /** Grant the reward, unseal, record, save, restore zone music. */
  Game.prototype.finishBoss = function (bossId, ability) {
    if (ability) this.grantAbility(ability, true);
    if (bossId && this.save.bossesDefeated.indexOf(bossId) < 0) this.save.bossesDefeated.push(bossId);
    const rb = this.level.room.boss;
    if (rb && rb.seal) this.sealExits(rb.seal, false);
    this.bossFight.state = 'done';
    this.boss = null;
    this.writeSave();
    Au.music(this.zone.song);
  };

  // --- hazards, nodes, death (DESIGN §3.2, §3.3, §5.5) -----------------------------------------------------
  Game.prototype.startHazard = function (kind) {
    const pl = this.player;
    pl.hurt(1, 0, { hazard: true });
    FX.hitstop(T.hazardHitstop); FX.flash('#FFFFFF', 0.5, 6); FX.shake(4, 8);
    Au.sfx('spike', pl.x);
    if (pl.dead) return;
    this.mode = 'hazard'; this.hazard.timer = 0; this.hazard.kind = kind;
    pl.vx = 0; pl.vy = 0; pl.cancelMove(); pl.flash = T.hazardFreeze;
  };
  Game.prototype.updateHazard = function () {
    const hz = this.hazard, pl = this.player;
    hz.timer++;
    pl.flash = (hz.timer >> 2) & 1 ? 6 : 0;
    if (hz.timer === T.hazardFreeze) this.fadeTo(1, T.hazardFade, null);
    if (hz.timer >= T.hazardFreeze + T.hazardFade) {
      pl.place(this.hazardRespawn.x, this.hazardRespawn.y, { iframes: T.hazardIFrames, airJumps: 1 });
      pl.flash = 0;
      this.fadeTo(0, T.hazardFade, null);
      this.mode = 'normal';
      this.snapCamera();
    }
  };
  Game.prototype.updateInteractions = function () {
    const pl = this.player, room = this.level.room;
    this.nearNode = null; this.prompt = null;
    for (let i = 0; i < room.nodes.length; i++) {
      const n = room.nodes[i];
      const nx = n.x * TILE + 15, ny = (n.y + 1) * TILE;
      if (Math.abs(pl.x - nx) <= TILE && pl.y <= ny + 4 && pl.y >= ny - 60) {
        this.nearNode = n; this.prompt = this.promptObj || (this.promptObj = { text: '', x: 0, y: 0 });
        this.prompt.text = 'REST'; this.prompt.x = nx; this.prompt.y = ny - 48;
        break;
      }
    }
    if (this.nearNode && pl.onGround && !pl.attacking() && In.state.up.pressed) {
      In.consume('jump'); In.consume('up');
      this.mode = 'nodeUse'; this.nodeUse.timer = T.nodePulse; this.nodeUse.node = this.nearNode;
      pl.vx = 0; Au.sfx('restore', pl.x);
    }
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
      this.hazardRespawn.x = nx; this.hazardRespawn.y = ny;
      this.spawnRoomEnemies();
      this.writeSave();
      UI.banner('RESTORED', 'Progress saved · hearts and energy refilled', 'The node remembers you.', 150);
      FX.burst('heal', nx, ny - 20, 16, { color: P.CORE_HEART }); FX.burst('ring', nx, ny - 20, 1, { radius: 40 });
      Au.sfx('save', pl.x);
      this.mode = 'normal';
    }
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
        c.state = 3; c.timer = T.crumbleBack; lv.gone[c.ty * room.w + c.tx] = 0;
        R.redrawTiles(lv, c.tx - 1, c.ty - 1, c.tx + 1, c.ty + 1);
      } else lv.crumble.splice(i, 1);
    }
  };

  // --- camera (DESIGN §11.3.1) ---------------------------------------------------------------------------
  Game.prototype.cameraTarget = function (out) {
    const pl = this.player, cam = this.cam;
    const bossCam = this.boss && (this.bossFight.state === 'intro' || this.bossFight.state === 'fight');
    if (bossCam) { cam.look = 0; out.x = (pl.x + this.boss.x) / 2 - W / 2; }
    else {
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
    cam.y += dy * (pl.vy > 700 ? 0.30 : 0.18);
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
      return;
    }
    // --- play ---
    if (!this.busy && this.mode !== 'transition') {
      if (In.state.pause.pressed) { this.openOverlay('pause'); return; }
      if (In.state.map.pressed) { this.openOverlay('map'); return; }
    }
    this.save.playTimeFrames++;
    if (this.mode === 'transition') { this.updateTransition(); FX.update(); this.cam.px = this.cam.x; this.cam.py = this.cam.y; return; }
    if (FX.hitstopFrames > 0) { FX.hitstopFrames--; FX.update(); return; }

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
    if (this.mode === 'normal' && !pl.dead) this.updateInteractions();
    const playerFrozen = this.mode === 'hazard';
    if (!playerFrozen) pl.update(this);

    // enemies / boss / projectiles
    for (let i = 0; i < this.enemies.length; i++) { const e = this.enemies[i]; if (!e.dead) e.update(this, pl); }
    if (this.boss) {
      const bs = this.bossFight.state;
      if (bs === 'fight') this.boss.update(this, pl);
      else if (bs === 'dying') { this.boss.t++; this.updateBossDying(); }
      else if (bs === 'none' || bs === 'intro') { this.boss.t++; this.boss.gravity(0.5, 12); this.boss.moveAndCollide(lv); if (this.boss.flash > 0) this.boss.flash--; }
    }
    for (let i = 0; i < this.projectiles.length; i++) { const p = this.projectiles[i]; if (!p.dead) p.update(this); }

    // hits, contact, hazards
    this.resolveHits();
    if (!pl.dead && !this.god && this.mode === 'normal') {
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead || e.noContact || !(e.contact > 0)) continue;
        if (E.overlap(pl, e) && pl.hurt(e.contact, e.x, null)) break;
      }
      const b = this.boss;
      if (b && b.active && !b.dead && b.contact > 0 && E.overlap(pl, b)) pl.hurt(b.contact, b.x, null);
    }
    if (!pl.dead && !this.god && this.mode === 'normal') {
      const hz = E.hazardAt(pl, lv, pl.pogoActive);
      if (hz) this.startHazard(hz);
    }
    // sweep the dead
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead) this.enemies.splice(i, 1);
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].dead) this.projectiles.splice(i, 1);

    // pickups, crumble, nodes, exits, boss trigger
    if (this.mode === 'normal' || this.mode === 'nodeUse') this.updatePickups();
    this.updateCrumble();
    if (this.mode === 'normal' && !pl.dead) {
      if (this.checkExits()) { FX.update(); return; }
      const rb = lv.room.boss;
      if (this.boss && this.bossFight.state === 'none' && rb) {
        const tx = pl.x / TILE;
        if (tx >= rb.bounds[0] && tx <= rb.bounds[1]) this.startBossFight();
      }
    }
    // death
    if (pl.dead && this.mode !== 'dying') { this.mode = 'dying'; this.save.deaths++; FX.shake(5, 20); }
    if (this.mode === 'dying' && pl.deathTimer >= T.deathFrames && !this.busy) {
      const self = this;
      this.busy = true;
      Au.duck(0, 0.6);
      this.fadeTo(1, T.gameOverFade, function () { self.setScreen('gameover'); self.fadeLevel = 0; self.fadeTarget = 0; self.busy = false; });
    }
    FX.update();
    this.updateCamera();
  };

  // --- render (CONTRACT §2.2) ----------------------------------------------------------------------------
  Game.prototype.drawWorld = function (ctx, alpha) {
    const lv = this.level, zone = this.zone, pl = this.player;
    const cx = Math.round(U.lerp(this.cam.px, this.cam.x, alpha) + FX.shakeX), cy = Math.round(U.lerp(this.cam.py, this.cam.y, alpha) + FX.shakeY);
    R.drawBackground(ctx, zone, cx, cy);
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
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].draw(ctx, this, alpha);
    FX.draw(ctx);
    if (this.settings.showHitboxes) this.drawHitboxes(ctx);
    ctx.restore();
    const isBoss = !!room.boss;
    R.drawFog(ctx, zone, pl.x - cx, pl.cy() - cy, isBoss);
    R.drawVignette(ctx);
    if (this.mode === 'pickupSeq') { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H); }
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
        mc.drawImage(this.snap, 0, 0, W * dpr, H * dpr, 0, 0, W, H);
      } else if (this.mode === 'transition' && tr.phase === 'slide') {
        const k = U.easeOutCubic(1 - tr.timer / T.slide);
        const ox = tr.dx * W * k, oy = tr.dy * H * k;
        mc.drawImage(this.snap, 0, 0, W * dpr, H * dpr, -ox, -oy, W, H);
        mc.drawImage(this.world, 0, 0, W * dpr, H * dpr, tr.dx * W - ox, tr.dy * H - oy, W, H);
      } else {
        mc.drawImage(this.world, 0, 0, W * dpr, H * dpr, 0, 0, W, H);
      }
      FX.drawScreen(mc);
      UI.drawHUD(mc, this);
    }
    UI.drawScreen(mc, this);
    if (this.fadeLevel > 0) { mc.globalAlpha = this.fadeLevel; mc.fillStyle = '#07050A'; mc.fillRect(0, 0, W, H); mc.globalAlpha = 1; }
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
        nearNode: game.nearNode ? game.nearNode.id : null, hasSave: game.hasSave(), savedRoom: game.savedData ? game.savedData.roomId : null,
      };
    };
    d.warp = function (roomId, exitIdOrPos) {
      if (!game.player) return false;
      let arrival;
      if (exitIdOrPos && typeof exitIdOrPos === 'object') arrival = { x: exitIdOrPos.x, y: exitIdOrPos.y };
      else if (typeof exitIdOrPos === 'string') arrival = { exitId: exitIdOrPos };
      else arrival = {};
      game.mode = 'normal'; game.player.locked = false; FX.hitstopFrames = 0;
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
    d.defeatBoss = function (bossId) {
      if (!game.save) return false;
      const rw = UB.Bosses.rewardFor(bossId);
      if (game.save.bossesDefeated.indexOf(bossId) < 0) game.save.bossesDefeated.push(bossId);
      if (rw.ability) game.grantAbility(rw.ability, true);
      if (game.level && game.level.room.boss && game.level.room.boss.id === bossId) {
        if (game.level.room.boss.seal) game.sealExits(game.level.room.boss.seal, false);
        game.boss = null; game.bossFight.state = 'done'; if (game.mode === 'bossIntro') { game.mode = 'normal'; game.player.locked = false; }
      }
      return true;
    };
    d.killEnemies = function () { for (let i = 0; i < game.enemies.length; i++) game.enemies[i].dead = true; game.enemies.length = 0; };
    d.god = function (on) { game.god = on !== false; return game.god; };
    d.godmode = d.god;
    d.step = function (n) { n = n === undefined ? 1 : (n | 0); for (let i = 0; i < n; i++) game.tick(); return game.frame; };
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
      else if (screen === 'pause' || screen === 'map' || screen === 'settings') { if (game.screen === 'play') game.openOverlay(screen); else if (screen === 'settings') game.openOverlay('settings'); }
      else if (screen === 'play') { if (game.overlay) { game.overlay = null; game.overlayFrom = null; } if (game.screen !== 'play' && game.player && game.level) game.setScreen('play'); }
      else if (screen === 'gameover' && game.player) { game.player.die(); }
      else if (screen === 'victory' && game.save) { game.victory(); }
      return game.overlay || game.screen;
    };
    d.save = function () { return game.writeSave(); };
    d.load = function () { return d.continueGame(); };
    d.reset = function () { game.resetSave(); };
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
    d.game = game;
    return d;
  }

  UB.Engine = { Game: Game, makeDebug: makeDebug, T: T };
})(window.UB);
