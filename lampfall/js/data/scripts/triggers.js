/** Story overlays: a marker is a trigger cell; conditions make every completed beat inert. */
import { deepFreeze } from '../ids.js';
import { mk } from './_stage.js';
const flag = (id) => ({ flag: id });
const no = (id) => ({ not: flag(id) });
const all = (...conds) => ({ all: conds });
const rows = [];
function trigger(mapId, marker, script, cond, kind = 'step', id = script) {
  rows.push({ mapId, id: `story-${id}`, kind, ...mk(mapId, marker), script,
    cond: cond ?? { not: { seen: script } }, once: !['linnet-brackenford-before', 'linnet-gate-before', 'corin-first-forecast', 'passenger-perch', 'pip-before', 'wick-long-road-before'].includes(script) });
}
// The arrival is queued by boot; this cell also supports returning to an untouched fresh save.
trigger('pellwick', 'arrival-start', 'arrival-causeway', no('sp.arrived'), 'enter');
trigger('pellwick', 'cottage-porch', 'wick-keeper', all(flag('sp.starter-chosen'), { not: { seen: 'wick-keeper' } }));
trigger('pellwick', 'porch-keepers-cottage-step', 'corin-reading-glass', all(flag('sp.starter-chosen'), no('sp.reading-glass')));
trigger('pellwick', 'yard-apron', 'yard-apron', all(flag('sp.errands-started'), no('sys.errand.apron')));
trigger('pellwick', 'commons-pin', 'tully-nickname', all(flag('sp.errands-started'), no('sys.errand.notice')), 'use');
trigger('pellwick', 'first-orchard', 'first-orchard', all(flag('sp.errands-started'), no('sys.errand.orchard')));
trigger('pellwick', 'meet-odile', 'meet-neighbors', all(flag('sp.errands-started'), no('np.odile.met-step')), 'step', 'meet-odile');
trigger('pellwick', 'meet-bryony', 'meet-neighbors', all(flag('sp.errands-started'), no('np.bryony.met-step')), 'step', 'meet-bryony');
trigger('pellwick', 'meet-thessaly', 'meet-neighbors', all(flag('sp.errands-started'), no('np.thessaly.met-step')), 'step', 'meet-thessaly');
trigger('pellwick', 'mail-sack', 'hesper-mail-sack', all(flag('sp.errands-started'), no('sp.mail-sack'), { not: { hasItem: 'mail-sack' } }), 'use', 'mail-sack-pickup');
trigger('pellwick', 'post-office-door', 'hesper-mail-sack', all(no('sp.mail-sack'), { hasItem: 'mail-sack' }), 'use', 'mail-sack-return');
trigger('pellwick', 'reeds-stance', 'corin-capture-stance', all(flag('sp.dock-battle'), no('sp.capture-stance')));
trigger('pellwick', 'archive-porthole', 'barnaby-field-log', all(flag('sp.errands-started'), no('sp.field-log')), 'use');
trigger('pellwick', 'ansel-tells-player', 'ansel-fishing-tells', all(flag('sp.errands-started'), no('sys.errand.fish')));
trigger('pellwick', 'pip-player', 'pip-before', all(flag('sp.capture-stance'), no('sys.trainer.pip')));
trigger('pellwick', 'ludo-sale', 'ludo-first-sale', all(flag('sp.errands-started'), { hour: [22, 8] }, { not: { seen: 'ludo-first-sale' } }), 'use');
trigger('pellwick', 'porchlight-player', 'porchlight-on', all(flag('sp.first-payment'), { not: { seen: 'porchlight-on' } }));
trigger('pellwick', 'corin-slip', 'corin-slip', all(flag('sp.dock-battle'), { party: { level: { gte: 7 } } }, { not: { seen: 'corin-slip' } }));
trigger('pellwick', 'glowing-flats', 'first-glowing-flats', all(flag('sp.starter-chosen'), { hour: [22, 6] }, { lowTide: true }, { not: { seen: 'first-glowing-flats' } }));
trigger('lowmoor', 'corin-first-forecast', 'corin-first-forecast', all(flag('sp.reading-glass'), no('sp.first-forecast')));
trigger('lowmoor', 'practice-table-player', 'maud-practice-table', no('sp.reroll-taught'), 'use');
trigger('lowmoor', 'rematch-player', 'linnet-brackenford-before', all({ badge: 1 }, no('sp.linnet-rematch')));
trigger('cairnhold', 'memorial-player', 'cairnhold-memorial', no('sp.memorial-seen'));
trigger('cairnhold', 'clinic-door', 'anchorage-turns-away', no('sp.anchorage-seen'));
trigger('emberstep', 'errant-sighting-player', 'first-errant-sighting', no('sp.errant-seen'));
trigger('drownwood', 'drowning-street-player', 'drowning-street', all({ lowTide: true }, no('sp.drowning-street')));
trigger('thistlewind', 'surge-player', 'the-surge', all({ badge: 4 }, { hour: [18, 6] }, no('sp.surge')));
trigger('rimeholt', 'gallery-player', 'idris-gallery', no('sp.idris-gallery'));
trigger('rimeholt', 'linnet-returns-player', 'linnet-returns', all(flag('sp.linnet-fell'), no('sp.linnet-returned')));
trigger('spire-mirror', 'gallery-look', 'idris-gallery', no('sp.idris-gallery'));
trigger('hollis-gate', 'summit-gate-player', 'summit-gate', all({ badge: 6 }, no('sp.summit-open')));
trigger('the-bar', 'linnet-gate', 'linnet-gate-before', all({ badge: 6 }, no('sp.linnet-gate')));
trigger('the-bar', 'wick-long-road', 'wick-long-road-before', no('sys.trainer.wick-long-road'), 'use');
trigger('lantern-stack', 'perch-front', 'passenger-perch', all(flag('sp.credits-seen'), no('sp.passenger-caught')), 'use');
export const STORY_TRIGGERS = deepFreeze(Object.fromEntries([...new Set(rows.map((r) => r.mapId))].map((id) => [id, rows.filter((r) => r.mapId === id).map(({ mapId, ...r }) => r)])));

const events = [];
function event(id, event, script, cond, once = true) { events.push({ id, event, script, ...(cond ? { cond } : {}), once }); }
event('opening-corin', 'flag:set:seen.wick-keeper', 'corin-reading-glass', no('sp.reading-glass'));
event('loan-one-cleared', 'loan:tier:2', 'first-payment');
event('lamp-room-offer', 'loan:tier:7', 'lamp-room-offered');
event('lamp-room-finished', 'loan:built:lamp-room', 'lamp-room-built');
event('relighting-dusk', 'relighting:due', 'the-relighting', no('sp.relighting'));
event('first-roof', 'loan:built:bedsit', 'thatch-first-roof');
event('first-keeper-letter', 'letter:delivered:1', 'hesper-k1');
event('fifty-six-letters', 'letters:late-delivery', 'late-delivery-party');
// Clock fallbacks let a town-first player see the acts without badges or a date deadline.
for (const evt of ['day:start', 'clock:hour', 'map:enter']) {
  const key = evt.replace(':', '-');
  event(`raft-${key}`, evt, 'raft-docks', all({ day: { gte: 3 } }, no('sp.raft-docked')));
  event(`new-neighbor-${key}`, evt, 'tamsin-arrives', all({ day: { gte: 3 } }, flag('sys.commons.dark-house-1'), no('sp.tamsin-arrived')));
  event(`act-two-${key}`, evt, 'act-2-open', all({ any: [{ badge: 1 }, { day: { gte: 4 } }] }, no('sp.act-2')));
  event(`act-three-${key}`, evt, 'comet-brightens', all({ any: [{ badge: 3 }, { loan: { tier: { gte: 4 } } }] }, no('sp.act-3')));
  event(`surge-${key}`, evt, 'the-surge', all({ day: { gte: 10 } }, no('sp.surge')));
  event(`market-${key}`, evt, 'first-lantern-market', all({ day: { gte: 7, dow: [5] } }, { hour: [20, 2] }, no('sp.first-market')));
  event(`linnet-fall-${key}`, evt, 'linnet-fall', all(flag('sp.first-market'), { badge: 2 }, { hour: [20, 2] }, no('sp.linnet-fell')));
  event(`plans-${key}`, evt, 'two-plans-one-night', all({ any: [{ badge: 5 }, { loan: { tier: { gte: 6 } } }] }, { hour: [18, 6] }, { lowTide: true }, no('sp.two-plans')));
}
event('first-badge-act', 'badge:won', 'act-2-open', all({ badge: 1 }, no('sp.act-2')));
event('after-linnet-return', 'flag:set:sp.linnet-returned', 'comet-brightens', no('sp.act-3'));
export const EVENT_SCRIPTS = deepFreeze(events);

/** Prefix hooks the host installs on flag:set. Each value names its existing system function. */
export const SCRIPT_HOOKS = deepFreeze({ 'sys.errand.': 'loans.errand', 'sys.deliver.': 'letters.deliverEvent', 'sys.porch.': 'townCommon.porchFlag' });
