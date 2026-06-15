// ============ round / wave director ============
import { G, clamp, pick } from './core.js';
import { MAP } from './mapdata.js';
import { zombieCount, isDogRound, MAX_ALIVE, MAX_DOGS } from './config.js';

export class Rounds {
  constructor() {
    this.round = 0; this.total = 0; this.spawned = 0;
    this.spawnT = 0; this.state = 'idle'; this.lullT = 0; this.isDog = false;
    this.dogDropped = false;
  }

  start() { this.round = 0; this.state = 'lull'; this.lullT = 2.5; }

  activeWindows() {
    return MAP.windows.filter((w) => MAP.rooms[w.room].open);
  }

  nextRound() {
    this.round++;
    this.isDog = isDogRound(this.round);
    this.total = this.isDog ? Math.min(MAX_DOGS, 6 + Math.floor(this.round / 4) * 2) : zombieCount(this.round);
    this.spawned = 0; this.dogDropped = false;
    this.spawnT = 1.2;
    this.state = 'active';
    if (G.audio) { G.audio.roundStart(); if (this.isDog) G.audio.dogHowl(); }
    G.hud && G.hud.announceRound(this.round, this.isDog);
  }

  update(dt) {
    if (this.state === 'lull') {
      this.lullT -= dt;
      if (this.lullT <= 0) this.nextRound();
      return;
    }
    if (this.state !== 'active') return;

    const wins = this.activeWindows();
    if (this.spawned < this.total && G.zombies.count() < MAX_ALIVE && wins.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const w = pick(wins);
        const z = G.zombies.spawn(w, this.round, this.isDog);
        if (z) {
          this.spawned++;
          const base = this.isDog ? 0.9 : clamp(1.7 - this.round * 0.05, 0.4, 1.7);
          this.spawnT = base * (0.7 + Math.random() * 0.6);
        }
      }
    }

    if (this.spawned >= this.total && G.zombies.count() === 0) {
      // dog round reward
      if (this.isDog && !this.dogDropped && G.powerups) { G.powerups.drop(G.player.pos, 'maxammo'); this.dogDropped = true; }
      this.state = 'lull'; this.lullT = 5;
      if (G.audio) G.audio.roundEnd();
    }
  }
}
