/* The fighters are the Mote Rumble cores now, so they carry those names.
 *
 * This runs before anything draws: it renames the engine's ability table in
 * place, keeping the internal keys (sword, beam, cutter...) that index the
 * game's own move data. Every name below is a real one from Mote Rumble
 * (Source/MoteRumble/MoteFighterData.cpp), picked as the move whose action
 * matches - a Core has six moves there and two here.
 */
(() => {
  'use strict';
  const CORES = {
    sword:   { name: 'Blade',  a1: 'Edge Slash',    a2: 'Crescent Cleave' },
    beam:    { name: 'Arc',    a1: 'Glaive Sweep',  a2: 'Thunderstrike' },
    cutter:  { name: 'Disc',   a1: 'Chakram Throw', a2: 'Triple Ring' },
    hammer:  { name: 'Maul',   a1: 'Crusher',       a2: 'Earthshaker' },
    archer:  { name: 'Bow',    a1: 'Point Blank',   a2: 'Heartseeker' },
    fire:    { name: 'Flare',  a1: 'Flame Burst',   a2: 'Blaze Rush' },
    bomb:    { name: 'Cinder', a1: 'Drop Bomb',     a2: 'Big Bomb' },
    parasol: { name: 'Veil',   a1: 'Point Jab',     a2: 'Bloom' },
  };
  for (const key of Object.keys(CORES)) {
    if (!ABIL[key]) continue;
    ABIL[key].name = CORES[key].name;
    ABIL[key].a1.label = CORES[key].a1;
    ABIL[key].a2.label = CORES[key].a2;
  }
  document.title = 'Blob Knight Rumpler';
})();
