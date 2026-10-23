#!/usr/bin/env node
// Map preview renderer (GDD-01 §17, WORLD verifier): every map in js/data/maps to a PNG in
// test/out/maps/<id>.png, so map composition can be looked at instead of read as ASCII.
//
//   node tools/map-preview.mjs [mapId ...] [--tide=low|mid|high] [--hour=12] [--fallback] [--scale=1]
//
// Primary path: Playwright + Chromium drive the real renderer (js/render/mapRenderer + the js/art
// atlas, autotiled shores, entities and props) onto a full-map canvas (w*16 x h*16) served by a
// throwaway static server. Fallback (no Playwright, or --fallback): a colour-per-tile PNG written in
// pure Node (zlib), one 4x4 block per tile, with entities as dots and warps as magenta squares, so the
// layout still reads (water, coast, paths, buildings, trees). Writes test/out/maps/index.html too.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out', 'maps');
const PW_MODULE = '/opt/node22/lib/node_modules/playwright/index.mjs';
const PW_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const forceFallback = args.includes('--fallback');
const tide = opt('tide', 'low');
const hour = Number(opt('hour', '12'));
const scale = Math.max(1, Number(opt('scale', '1')) | 0);
const only = args.filter((a) => !a.startsWith('--'));

const { MAPS } = await import(pathToFileURL(path.join(ROOT, 'js/data/maps/index.js')).href);
const ids = only.length ? only : MAPS.map((m) => m.id);
for (const id of ids) if (!MAPS.some((m) => m.id === id)) { console.error(`map-preview: unknown map '${id}'`); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------------------------------------
// primary: the real renderer in Chromium
// ------------------------------------------------------------------------------------------------

const PAGE = `<!doctype html><meta charset="utf-8"><title>map preview</title><body style="margin:0;background:#141B33">
<script type="module">
  import { loadMap } from '/js/world/tilemap.js';
  import { TILES, DEFAULT_LEGEND } from '/js/data/tilesets.js';
  import { MAPS_BY_ID } from '/js/data/maps/index.js';
  import { createEntities } from '/js/world/entities.js';
  import '/js/art/chars/index.js';
  import { createMapRenderer } from '/js/render/mapRenderer.js';
  window.renderMap = async (id, tide, minute) => {
    const def = MAPS_BY_ID[id];
    const map = loadMap(def, TILES, { legend: DEFAULT_LEGEND });
    const ents = createEntities(map);
    ents.rebuildFromDefs((def.entities || []).filter((e) => !e.cond && e.kind !== 'npc'));
    const W = map.w * 16, H = map.h * 16;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const renderer = createMapRenderer({ budgetMs: 1e6, maxChunks: 4096, maxCombos: 64 });
    const camera = { x: 0, y: 0, w: W, h: H };
    let stats = null;
    for (let i = 0; i < 40; i++) {
      stats = renderer.drawFrame(null, { ctx, map, entities: ents, camera, rect: { x: 0, y: 0, w: W, h: H }, skyband: false,
        minute, weather: 'clear', tide, time: 1000 + i * 17, day: 3, flags: {}, lighthouse: { stage: 0, relit: false }, roof: 'dark', comet: 0 });
      if (!stats.queued && i > 2) break;
      await new Promise((r) => setTimeout(r, 0));
    }
    return canvas.toDataURL('image/png');
  };
  window.ready = true;
</script>`;

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.png': 'image/png', '.css': 'text/css' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/__map-preview.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    const file = path.join(ROOT, path.normalize(url));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function renderWithPlaywright() {
  if (!fs.existsSync(PW_MODULE) || !fs.existsSync(PW_CHROME)) throw new Error('playwright/chromium not installed');
  const { chromium } = await import(PW_MODULE);
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: PW_CHROME, args: ['--no-sandbox'] });
  const done = [];
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await page.goto(`http://127.0.0.1:${port}/__map-preview.html`);
    await page.waitForFunction(() => window.ready === true, null, { timeout: 20000 }).catch(() => { throw new Error(`preview page failed: ${errors.join('\n') || 'timeout'}`); });
    for (const id of ids) {
      const url = await page.evaluate(([i, t, m]) => window.renderMap(i, t, m), [id, tide, Math.round(hour * 60)]);
      const buf = Buffer.from(url.split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, `${id}.png`), buf);
      done.push(id);
    }
  } finally {
    await browser.close();
    server.close();
  }
  return done;
}

// ------------------------------------------------------------------------------------------------
// fallback: colour per tile, pure Node
// ------------------------------------------------------------------------------------------------

/** A readable colour per tile class (first matching rule wins), then a stable hash colour. */
const RULES = [
  [/deep/, [24, 44, 92]], [/sea|shallow|lagoon|harbor-water|^water/, [52, 98, 156]], [/river|creek|tannin/, [64, 122, 170]],
  [/stepping|river-stones/, [150, 170, 180]], [/bar-road|causeway/, [196, 172, 120]], [/mud-glow/, [80, 200, 200]], [/mud/, [110, 92, 70]],
  [/wet-sand/, [190, 170, 120]], [/sand|shingle|beach/, [222, 204, 150]], [/tall-grass|reed|heather|thistle/, [70, 120, 60]],
  [/grass|lawn|meadow|moss/, [104, 160, 80]], [/cliff|ledge|rock|stone-wall|volcanic/, [96, 90, 96]], [/ice|glacier|snow/, [210, 230, 240]],
  [/path|cobble|quay|pier|plank|board|deck|bridge|floor|steps/, [176, 150, 110]], [/roof/, [140, 70, 60]], [/wall/, [120, 100, 90]],
  [/door/, [240, 200, 80]], [/window/, [250, 230, 140]], [/ash/, [90, 84, 84]], [/lava|ember/, [220, 90, 40]],
];
function colourOf(id) {
  if (!id) return [0, 0, 0];
  for (const [re, c] of RULES) if (re.test(id)) return c;
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return [64 + (h & 127), 64 + ((h >> 8) & 127), 64 + ((h >> 16) & 127)];
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function png(w, h, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function renderFallback(list) {
  const { loadMap } = await import(pathToFileURL(path.join(ROOT, 'js/world/tilemap.js')).href);
  const { TILES, DEFAULT_LEGEND } = await import(pathToFileURL(path.join(ROOT, 'js/data/tilesets.js')).href);
  const { tideVariant } = await import(pathToFileURL(path.join(ROOT, 'js/world/tide.js')).href);
  const { awash } = await import(pathToFileURL(path.join(ROOT, 'js/world/tide.js')).href);
  const v = tideVariant(tide);
  const B = 4 * scale;
  for (const id of list) {
    const def = MAPS.find((m) => m.id === id);
    const map = loadMap(def, TILES, { legend: DEFAULT_LEGEND });
    const W = map.w * B, H = map.h * B;
    const rgb = Buffer.alloc(W * H * 3);
    const put = (px, py, c) => { if (px < 0 || py < 0 || px >= W || py >= H) return; const o = (py * W + px) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2]; };
    const block = (x, y, c, inset = 0) => { for (let j = inset; j < B - inset; j++) for (let i = inset; i < B - inset; i++) put(x * B + i, y * B + j, c); };
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const t = map.tileAt(x, y);
      let c = colourOf(t.ground);
      if (t.tide && awash(map, x, y, v)) c = [70, 120, 176];
      block(x, y, c);
      if (t.detail) block(x, y, colourOf(t.detail), Math.max(1, B >> 2));
    }
    for (const e of def.entities ?? []) {
      const c = e.kind === 'tree' ? (e.purse ? [230, 200, 60] : e.hive ? [240, 150, 40] : [30, 90, 40]) : e.porch ? [255, 220, 120] : e.kind === 'boat' ? [150, 100, 60] : [200, 200, 200];
      block(e.x, e.y, c, Math.max(1, B >> 2));
    }
    for (const w of def.warps ?? []) for (let j = 0; j < (w.h ?? 1); j++) for (let i = 0; i < (w.w ?? 1); i++) block(w.x + i, w.y + j, [230, 40, 200], Math.max(0, (B >> 2) - 1));
    fs.writeFileSync(path.join(OUT, `${id}.png`), png(W, H, rgb));
  }
  return list;
}

// ------------------------------------------------------------------------------------------------

let mode = 'renderer';
let written = [];
if (!forceFallback) {
  try {
    written = await renderWithPlaywright();
  } catch (e) {
    console.warn(`map-preview: renderer path failed (${e.message.split('\n')[0]}); using the colour-per-tile fallback`);
    mode = 'fallback';
  }
} else mode = 'fallback';
if (mode === 'fallback') written = await renderFallback(ids);

const html = `<!doctype html><meta charset="utf-8"><title>Map previews</title><style>body{background:#141B33;color:#F4F1E6;font:13px ui-monospace,monospace}img{image-rendering:pixelated;display:block;margin:4px 0 24px;max-width:100%}</style>
<h1>Map previews (${mode}, tide ${tide}, ${hour}:00)</h1>${MAPS.filter((m) => fs.existsSync(path.join(OUT, `${m.id}.png`))).map((m) => `<h2>${m.id} — ${m.name} (${m.w}x${m.h})</h2><img src="${m.id}.png" alt="${m.id}">`).join('\n')}`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`map-preview: ${written.length} map(s) via ${mode} -> ${path.relative(ROOT, OUT)}/`);
