/**
 * PLACEHOLDER day-1 scripts (§6.1 format). [DATA-IDX] Replaced by DATA-SCRIPTS files at integration.
 * `ph-intro` exercises every structural rule the validator has: shorthand says, a choice with gotos,
 * labels, a nested `if`, a `branch`, pure give/setFlag/thread ops, a host `move` and an `end`.
 * @module data/placeholder/scripts
 */

/** @type {Readonly<Record<string, ReadonlyArray<import('../index.js').Op>>>} */
export const SCRIPTS = Object.freeze({
  'ph-arrival': [
    'PLACEHOLDER arrival. The tide is out.',
    { op: 'camera', to: 'player', ms: 300 },
    { op: 'setFlag', id: 'sp.ph-arrived' },
    { op: 'end' },
  ],
  'ph-intro': [
    'PLACEHOLDER Keeper: Morning, {player}. You will want a roof before the wind turns.',
    {
      op: 'choice',
      options: [
        { text: 'Show me the ledger.', goto: 'ledger' },
        { text: 'Later.', goto: 'later' },
        { text: 'What roof?', cond: { not: { flag: 'sp.ph-met' } }, then: ['PLACEHOLDER Keeper: The one over your head.'] },
      ],
      defaultIndex: 1,
    },
    { op: 'label', id: 'ledger' },
    { op: 'move', who: 'ph-keeper', path: 'LLU', wait: true },
    { op: 'give', item: 'ph-lantern', n: 1 },
    { op: 'setFlag', id: 'sp.ph-met' },
    { op: 'thread', id: 'ph-thread', beat: 1 },
    { op: 'if', cond: { hasItem: 'ph-lantern' }, then: ['PLACEHOLDER Keeper: Keep that lit.'], else: ['PLACEHOLDER Keeper: Hm.'] },
    { op: 'branch', on: 'dial', cases: { freefall: ['PLACEHOLDER Keeper: Freefall, is it.'], default: [] } },
    { op: 'goto', id: 'done' },
    { op: 'label', id: 'later' },
    'PLACEHOLDER Keeper: The sticks will wait. The tide will not.',
    { op: 'label', id: 'done' },
    { op: 'end' },
  ],
  'ph-remind': [
    { op: 'if', cond: { wallet: { gte: 500 } }, then: ['PLACEHOLDER Keeper: You could clear a tier today.'], else: ['PLACEHOLDER Keeper: Fish are biting, if coin is short.'] },
    { op: 'end' },
  ],
  'ph-beat-1': [
    'PLACEHOLDER Keeper: First notch on the stick.',
    { op: 'beat', thread: 'ph-thread', to: 1 },
    { op: 'end' },
  ],
  'ph-beat-2': [
    'PLACEHOLDER Keeper: You read the letter, then.',
    { op: 'call', script: 'ph-remind' },
    { op: 'beat', thread: 'ph-thread', to: 2 },
    { op: 'end' },
  ],
  'ph-trainer-before': ['PLACEHOLDER Rival: Let us see what you caught.', { op: 'end' }],
  'ph-trainer-win': ['PLACEHOLDER Rival: Fine. Next tide.', { op: 'earn', amount: 100 }, { op: 'end' }],
  'ph-trainer-loss': ['PLACEHOLDER Rival: Told you.', { op: 'end' }],
});
