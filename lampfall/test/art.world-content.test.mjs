import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps/index.js';
import { NPCS } from '../js/data/npcs/index.js';
import '../js/art/chars/index.js';
import '../js/art/creatures/index.js';
import { resolveArtId } from '../js/art/atlas.js';
test('every authored prop, room layout and resident sprite resolves to visible artwork', () => {
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'art' || key === 'artId') && typeof child === 'string') assert.ok(resolveArtId(child), child);
      else if (typeof child === 'object') walk(child);
    }
  }
  walk(MAPS);
  for (const npc of NPCS) assert.ok(resolveArtId(`char-${npc.sprite ?? npc.id}`), npc.id);
});
