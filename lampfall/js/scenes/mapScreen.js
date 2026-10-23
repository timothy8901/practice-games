/** The Brindle Isles chart, with posted levels, real route gates and a local map for each isle. */
import { drawText } from '../core/font.js';
import { drawPanel } from '../ui/panel.js';
import { PALETTE, COLORS } from '../ui/theme.js';
import { t } from '../data/strings.js';
import { TILES, DEFAULT_LEGEND } from '../data/tilesets.js';
import { loadMap } from '../world/tilemap.js';
import * as clockSys from '../systems/clockSys.js';
import { litPorchCount, inRect } from './flowKit.js';

const NODES = Object.freeze([
  { id: 'pellwick', x: 87, y: 83 }, { id: 'lowmoor', x: 157, y: 55 }, { id: 'cairnhold', x: 247, y: 79 },
  { id: 'emberstep', x: 266, y: 136 }, { id: 'drownwood', x: 225, y: 198 }, { id: 'thistlewind', x: 136, y: 218 },
  { id: 'rimeholt', x: 61, y: 187 }, { id: 'the-bar', x: 53, y: 130 }, { id: 'shardcrown', x: 31, y: 57 },
]);

export function createMapScreenScene(G) {
  let selected = 0, local = false, localMap = null, ms = 0;
  const maps = () => G.data.list('maps');
  const region = (id) => G.data.tryGet('regions', id);
  const mapOf = (id) => maps().find((m) => m.id === id) ?? maps().find((m) => m.region === id);
  const currentRegion = () => G.data.tryGet('maps', G.world.player.mapId)?.region ?? 'pellwick';
  const selectedMap = () => mapOf(NODES[selected].id);
  function refresh() { const m = selectedMap(); try { localMap = m ? loadMap(m, TILES, { legend: DEFAULT_LEGEND }) : null; } catch { localMap = null; } }
  function close() { if (G.scenes.size > 1) G.scenes.pop({ map: true }); else G.replaceWith('overworld', {}); }
  function move(d) { selected = (selected + d + NODES.length) % NODES.length; refresh(); G.bus?.emit('ui:cursor', {}); }
  function destination(warp) {
    const to = G.data.tryGet('maps', warp.to.mapId);
    return to && to.region !== NODES[selected].id ? region(to.region)?.name ?? to.name : null;
  }
  function gate(warp) {
    if (!warp.way || (warp.openFlag && G.world.flags[warp.openFlag])) return 'open';
    const win = clockSys.tideWindow(G.world, warp.way, { data: G.data, clock: G.clock });
    return win.open ? `open, ${Math.ceil(win.minutesUntilChange ?? 0)}m left` : `under, dry in ${Math.ceil(win.minutesUntilChange ?? 0)}m`;
  }
  function localDrawing(c) {
    if (!localMap) return;
    const scale = Math.min(4, Math.floor(Math.min(278 / localMap.w, 190 / localMap.h)));
    const ox = 18 + Math.floor((278 - localMap.w * scale) / 2), oy = 46 + Math.floor((190 - localMap.h * scale) / 2);
    for (let y = 0; y < localMap.h; y++) for (let x = 0; x < localMap.w; x++) {
      const a = localMap.tileAt(x, y);
      c.fillStyle = a.water ? '#31516B' : a.tide ? '#8D9E9B' : a.solid ? '#655F69' : '#72917A';
      c.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
    for (const e of selectedMap().entities ?? []) if (e.waystone) {
      c.fillStyle = PALETTE.porchAmber; c.fillRect(ox + e.x * scale - 1, oy + e.y * scale - 1, scale + 2, scale + 2);
    }
    for (const warp of localMap.warps) { c.fillStyle = PALETTE.paperLightest; c.fillRect(ox + warp.x * scale, oy + warp.y * scale, scale, scale); }
    if (selectedMap().id === G.world.player.mapId) {
      c.fillStyle = Math.floor(ms / 400) % 2 ? PALETTE.waxRed : PALETTE.paperLightest;
      c.fillRect(ox + G.world.player.x * scale - 1, oy + G.world.player.y * scale - 1, scale + 2, scale + 2);
    }
  }
  function chart(c) {
    c.fillStyle = '#263C59'; c.fillRect(16, 40, 284, 202);
    c.strokeStyle = '#537387'; c.setLineDash?.([2, 3]);
    const pairs = new Set();
    for (let i = 0; i < NODES.length; i++) for (const w of mapOf(NODES[i].id)?.warps ?? []) {
      const dest = G.data.tryGet('maps', w.to.mapId)?.region;
      const j = NODES.findIndex((n) => n.id === dest);
      const key = [i, j].sort().join(':');
      if (j < 0 || j === i || pairs.has(key)) continue;
      pairs.add(key); c.beginPath(); c.moveTo(NODES[i].x, NODES[i].y); c.lineTo(NODES[j].x, NODES[j].y); c.stroke();
    }
    c.setLineDash?.([]);
    NODES.forEach((n, i) => {
      const on = i === selected, here = n.id === currentRegion();
      c.fillStyle = on ? PALETTE.porchAmber : '#6E8C88'; c.fillRect(n.x - 8, n.y - 5, 16, 10); c.fillRect(n.x - 5, n.y - 8, 10, 16);
      if (here) { c.fillStyle = PALETTE.waxRed; c.fillRect(n.x - 2, n.y - 2, 4, 4); }
      drawText(c, region(n.id)?.name ?? n.id, n.x, n.y + 12, { color: on ? PALETTE.porchAmber : PALETTE.paperLightest, align: 'center', font: 'small' });
      if (on) { c.strokeStyle = PALETTE.paperLightest; c.strokeRect(n.x - 11, n.y - 11, 22, 22); }
    });
  }
  return {
    name: 'mapScreen', opaque: true,
    enter() { selected = Math.max(0, NODES.findIndex((n) => n.id === currentRegion())); local = false; ms = 0; refresh(); },
    update(dt) { ms += dt; },
    handleInput(input) {
      if (input.pressed('cancel') || input.pressed('map') || (input.pressed('menu') && !input.pressed('confirm'))) { close(); return; }
      if (input.repeat('left') || input.repeat('up')) move(-1);
      else if (input.repeat('right') || input.repeat('down')) move(1);
      if (input.pressed('confirm')) { local = !local; refresh(); }
      if (input.pointer?.justDown) {
        if (inRect(input.pointer, { x: 16, y: 40, w: 284, h: 202 }) && !local) {
          const hit = NODES.findIndex((n) => Math.abs(n.x - input.pointer.x) < 18 && Math.abs(n.y - input.pointer.y) < 18);
          if (hit >= 0) { if (hit === selected) local = true; else selected = hit; refresh(); }
        } else if (local) local = false;
      }
    },
    draw(c) {
      c.fillStyle = PALETTE.nightInk; c.fillRect(0, 0, 480, 270);
      drawText(c, t('map.heading'), 20, 16, { color: PALETTE.paperLightest, scale: 2 });
      if (local) localDrawing(c); else chart(c);
      drawPanel(c, { x: 310, y: 40, w: 154, h: 202 }, 'paper');
      const r = region(NODES[selected].id), m = selectedMap();
      drawText(c, r?.name ?? NODES[selected].id, 320, 50, { color: COLORS.paper.ink });
      drawText(c, t('map.curve', { level: r?.curveLevel ?? '?' }), 320, 65, { color: COLORS.paper.inkSoft, font: 'small', maxWidth: 132 });
      if (r?.wild) drawText(c, `Wilds Lv${r.wild.join('-')}`, 320, 78, { color: COLORS.paper.inkSoft, font: 'small' });
      drawText(c, NODES[selected].id === currentRegion() ? 'You are here.' : 'Take the long road, or a ferry.', 320, 94, { color: PALETTE.waxRed, maxWidth: 130, font: 'small' });
      const routes = (m?.warps ?? []).map((w) => ({ w, name: destination(w) })).filter((r) => r.name);
      let y = 119;
      for (const { w, name } of routes.slice(0, 4)) {
        drawText(c, name, 320, y, { color: COLORS.paper.ink, font: 'small', maxWidth: 132 });
        drawText(c, w.way ? `Short way: ${gate(w)}` : 'Long road: any tide', 320, y + 10, { color: COLORS.paper.inkSoft, font: 'small', maxWidth: 132 });
        y += 28;
      }
      drawText(c, `Seals: ${G.world.badges.length}/6`, 320, 222, { color: COLORS.paper.ink, font: 'small' });
      drawText(c, t('map.litPorches', { n: litPorchCount(G.world, G.data) }), 20, 249, { color: PALETTE.paperShade, font: 'small' });
      drawText(c, 'Arrows: choose   Confirm: local chart   Back: close', 240, 261, { color: PALETTE.paperLightest, font: 'small', align: 'center' });
    },
    state: () => ({ region: NODES[selected].id, local, mapId: selectedMap()?.id }),
    debugText: () => `${t('map.heading')}\n${region(NODES[selected].id)?.name ?? ''} ${local ? 'local chart' : 'isles chart'}\n${selectedMap()?.warps.map((w) => destination(w)).filter(Boolean).join(', ')}`,
  };
}
