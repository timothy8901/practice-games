// ============ proximity interactions: doors, wall-buys, perks, power, PaP, traps ============
import * as THREE from 'three';
import { G } from './core.js';
import { MAP } from './mapdata.js';
import { WEAPONS, PERKS, PAP_COST, papStats } from './config.js';
import { makeWeapon } from './weapons.js';

export class Interact {
  constructor() {
    this.items = [];
    this.traps = {};
    this._build();
  }

  _build() {
    const P = () => G.player;
    // doors
    for (const door of MAP.doors) {
      this.items.push({
        pos: this._mid(door.rect), range: 2.6,
        prompt: () => door.open ? null : `[F] OPEN — ${door.cost}`,
        action: () => {
          if (!P().spend(door.cost)) return;
          door.open = true;
          MAP.rooms[door.a].open = true; MAP.rooms[door.b].open = true;
          G.world.openDoor(door.id); G.nav.rebuild();
          if (G.audio) G.audio.purchase();
          G.hud && G.hud.flash('AREA OPENED');
        },
      });
    }
    // wall-buys
    for (const wb of MAP.wallbuys) {
      const def = WEAPONS[wb.weapon];
      this.items.push({
        pos: new THREE.Vector3(wb.at[0], 0, wb.at[1]), range: 2.2,
        prompt: () => {
          const owned = P().weapons.find((w) => w.id === wb.weapon);
          if (owned) return `[F] ${def.name} AMMO — ${Math.round(def.wall / 2)}`;
          return `[F] ${def.name} — ${def.wall}`;
        },
        action: () => {
          const owned = P().weapons.find((w) => w.id === wb.weapon);
          const cost = owned ? Math.round(def.wall / 2) : def.wall;
          if (!P().spend(cost)) return;
          if (owned) { const f = makeWeapon(wb.weapon, owned.papped); owned.reserve = f.reserve; owned.mag = owned.def.mag; }
          else P().giveWeapon(wb.weapon, false);
          if (G.audio) G.audio.purchase();
        },
      });
    }
    // perks
    for (const p of MAP.perks) {
      const def = PERKS[p.perk];
      this.items.push({
        pos: new THREE.Vector3(p.at[0], 0, p.at[1]), range: 2.2,
        prompt: () => {
          if (P().perks.has(p.perk)) return null;
          if (def.needsPower && !G.powerOn) return '[ NEEDS POWER ]';
          return `[F] ${def.name} — ${def.cost}`;
        },
        action: () => {
          if (P().perks.has(p.perk)) return;
          if (def.needsPower && !G.powerOn) return;
          if (!P().spend(def.cost)) return;
          P().addPerk(p.perk);
        },
      });
    }
    // power switch
    this.items.push({
      pos: new THREE.Vector3(MAP.power.at[0], 0, MAP.power.at[1]), range: 2.4,
      prompt: () => G.powerOn ? null : '[F] TURN ON POWER',
      action: () => { if (G.powerOn) return; G.powerOn = true; G.world.setPowerOn(); if (G.audio) G.audio.power(); G.hud && G.hud.flash('POWER ON'); },
    });
    // teleporter mainframe (link -> enables PaP; once linked -> teleport back)
    this.items.push({
      pos: new THREE.Vector3(MAP.teleporter.mainframe[0], 0, MAP.teleporter.mainframe[1]), range: 2.6,
      prompt: () => { if (!G.powerOn) return '[ NEEDS POWER ]'; return G.papLinked ? '[F] TELEPORT TO PAD' : '[F] LINK MAINFRAME'; },
      action: () => {
        if (!G.powerOn) return;
        if (!G.papLinked) { G.papLinked = true; G.world.setPapLinked(); if (G.audio) G.audio.power(); G.hud && G.hud.flash('PACK-A-PUNCH ONLINE'); }
        else { P().pos.set(MAP.teleporter.pad[0], 0, MAP.teleporter.pad[1]); if (G.audio) G.audio.teleport(); }
      },
    });
    // teleporter pad
    this.items.push({
      pos: new THREE.Vector3(MAP.teleporter.pad[0], 0, MAP.teleporter.pad[1]), range: 2.0,
      prompt: () => G.powerOn ? '[F] TELEPORT TO MAINFRAME' : null,
      action: () => { if (!G.powerOn) return; P().pos.set(MAP.teleporter.mainframe[0] - 1.5, 0, MAP.teleporter.mainframe[1]); if (G.audio) G.audio.teleport(); },
    });
    // pack-a-punch
    this.items.push({
      pos: new THREE.Vector3(MAP.pap.at[0], 0, MAP.pap.at[1]), range: 2.4,
      prompt: () => {
        if (!G.papLinked) return null;
        const w = P().weapon();
        if (!w.def.pap) return null;
        return w.papped ? `[F] ${w.name} AMMO — 2500` : `[F] PACK-A-PUNCH — ${PAP_COST}`;
      },
      action: () => {
        const w = P().weapon();
        if (!G.papLinked || !w.def.pap) return;
        if (w.papped) { if (!P().spend(2500)) return; const f = makeWeapon(w.id, true); w.reserve = f.reserve; w.mag = w.def.mag; }
        else { if (!P().spend(PAP_COST)) return; const nw = makeWeapon(w.id, true); P().weapons[P().slot] = nw; }
        if (G.audio) G.audio.purchase(); G.hud && G.hud.flash('WEAPON UPGRADED');
      },
    });
    // traps
    for (const tr of MAP.traps) {
      this.traps[tr.id] = { def: tr, active: 0, cd: 0, tick: 0 };
      this.items.push({
        pos: new THREE.Vector3(tr.at[0], 0, tr.at[1]), range: 2.2,
        prompt: () => {
          if (!G.powerOn) return '[ NEEDS POWER ]';
          const t = this.traps[tr.id];
          if (t.active > 0) return '[ TRAP ACTIVE ]';
          if (t.cd > 0) return '[ COOLING DOWN ]';
          return `[F] ACTIVATE TRAP — ${tr.cost}`;
        },
        action: () => {
          if (!G.powerOn) return;
          const t = this.traps[tr.id];
          if (t.active > 0 || t.cd > 0) return;
          if (!P().spend(tr.cost)) return;
          t.active = 30; t.tick = 0; if (G.audio) G.audio.power();
        },
      });
    }
    // mystery box
    this.items.push({
      pos: null, range: 2.4, isBox: true,
      prompt: () => G.box.prompt(G.player),
      action: () => G.box.interact(G.player),
    });
    // window repair (one per window)
    for (const win of MAP.windows) {
      this.items.push({
        pos: new THREE.Vector3(win.at[0], 0, win.at[1]), range: 1.8, isRepair: true, win,
        prompt: () => {
          const max = win._boardMeshes ? win._boardMeshes.length : 6;
          return (win.boards < max && MAP.rooms[win.room].open) ? '[HOLD F] REPAIR' : null;
        },
        action: null,
      });
    }
  }

  _mid(r) { return new THREE.Vector3((r[0] + r[2]) / 2, 0, (r[1] + r[3]) / 2); }

  update(dt, input) {
    const p = G.player;
    // traps
    for (const id in this.traps) {
      const t = this.traps[id];
      if (t.active > 0) {
        t.active -= dt; t.tick -= dt;
        if (t.tick <= 0) {
          t.tick = 0.25;
          G.fx.bolts(new THREE.Vector3(t.def.at[0], 0.2, t.def.at[1]), 0x9fdcff, { count: 4, radius: t.def.r, dur: 0.25 });
          for (const z of G.zombies.alive) {
            if (!z.active || z.dying) continue;
            if (Math.hypot(z.pos.x - t.def.at[0], z.pos.z - t.def.at[1]) < t.def.r) z.damage(400, { source: p });
          }
        }
        if (t.active <= 0) t.cd = 6;
      } else if (t.cd > 0) t.cd -= dt;
    }

    // find nearest valid interactable
    let best = null, bestD = 1e9;
    for (const it of this.items) {
      const pos = it.isBox ? G.box.pos : it.pos;
      if (!pos) continue;
      const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z);
      if (d > it.range) continue;
      const label = it.prompt();
      if (!label) continue;
      if (d < bestD) { bestD = d; best = it; best._label = label; }
    }
    p.interactTarget = best ? best._label : null;

    if (!best) return;
    if (best.isRepair) {
      // hold to repair: add a board on a short cadence while held
      if (input.intent.interactHeld) {
        this._repairT = (this._repairT || 0) - dt;
        if (this._repairT <= 0) {
          this._repairT = 0.4;
          if (G.world.addBoard(best.win)) { p.addPoints(10); if (G.audio) G.audio.boardRepair(); }
        }
      }
      return;
    }
    if (input.intent.interact && best.action) best.action();
  }

  reset() {
    for (const id in this.traps) { this.traps[id].active = 0; this.traps[id].cd = 0; }
  }
}
