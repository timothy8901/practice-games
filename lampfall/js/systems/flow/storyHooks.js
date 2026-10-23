/** Bridge declarative story flags to the town systems that own their consequences. */
import * as loans from '../loans.js';
import * as letters from '../letters.js';
import { TUNING } from '../../data/tuning.js';
const INSTALLED = new WeakMap();

export function installStoryHooks(G) {
  if (INSTALLED.has(G)) return INSTALLED.get(G);
  const off = G.bus.on('flag:set', ({ id, value, prev }) => {
    if (!value || value === prev) return;
    if (id.startsWith('sys.errand.')) {
      G.store.tx('story:errand', world => loans.errand(world, id.slice('sys.errand.'.length), { data: G.data, bus: G.bus, tuning: TUNING }));
    } else if (id.startsWith('sys.deliver.')) {
      G.store.tx('story:deliver', world => letters.deliverEvent(world, G.data, id.slice('sys.deliver.'.length), { bus: G.bus }));
    }
  });
  const uninstall = () => { off(); INSTALLED.delete(G); };
  INSTALLED.set(G, uninstall);
  return uninstall;
}
