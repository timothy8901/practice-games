import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createBus, WILDCARD } from '../js/core/events.js';

/** Values that are not valid event names. */
const BAD_NAMES = ['', 42, null, undefined, Symbol('s'), {}, [], () => {}];
/** Values that are not valid listeners. */
const BAD_LISTENERS = [null, undefined, 'fn', 42, {}, []];

/**
 * Builds a listener that appends `label` (and any received args) to `trace`.
 * @param {any[]} trace
 * @param {string} label
 * @returns {(...args: any[]) => void}
 */
const recorder = (trace, label) => (...args) => {
  trace.push(args.length ? [label, ...args] : label);
};

describe('createBus', () => {
  it('exposes the contract API plus introspection helpers on a frozen object', () => {
    const bus = createBus();
    for (const method of ['on', 'once', 'off', 'emit', 'clear', 'listenerCount', 'eventNames']) {
      assert.equal(typeof bus[method], 'function', `${method} should be a function`);
    }
    assert.ok(Object.isFrozen(bus));
    assert.throws(() => {
      bus.extra = 1;
    }, TypeError);
  });

  it('accepts no options, an empty object, or null', () => {
    assert.doesNotThrow(() => createBus());
    assert.doesNotThrow(() => createBus({}));
    assert.doesNotThrow(() => createBus(null));
    assert.doesNotThrow(() => createBus(undefined));
  });

  it('rejects a non-function onError', () => {
    for (const bad of ['log', 42, {}, true]) {
      assert.throws(() => createBus({ onError: bad }), { name: 'TypeError', message: /onError/ });
    }
  });

  it('exports the wildcard name', () => {
    assert.equal(WILDCARD, '*');
  });

  it('keeps buses independent of each other', () => {
    const a = createBus();
    const b = createBus();
    const trace = [];
    a.on('ping', recorder(trace, 'a'));
    b.on('ping', recorder(trace, 'b'));
    b.emit('ping');
    assert.deepEqual(trace, ['b']);
    assert.equal(a.listenerCount('ping'), 1);
    assert.equal(b.listenerCount('ping'), 1);
    a.clear();
    assert.equal(b.listenerCount('ping'), 1);
  });

  it('methods work when detached from the bus object', () => {
    const { on, emit, off } = createBus();
    const trace = [];
    on('x', recorder(trace, 'x'));
    assert.equal(emit('x', 1), 1);
    assert.equal(off('x'), 1);
    assert.equal(emit('x', 1), 0);
    assert.deepEqual(trace, [['x', 1]]);
  });
});

describe('on + emit', () => {
  it('passes emitted arguments by reference, including zero and many arguments', () => {
    const bus = createBus();
    const received = [];
    bus.on('data', (...args) => received.push(args));
    const payload = { hp: 3 };
    bus.emit('data');
    bus.emit('data', payload);
    bus.emit('data', 1, 'two', null, undefined, payload);
    assert.equal(received.length, 3);
    assert.deepEqual(received[0], []);
    assert.equal(received[1][0], payload, 'object identity must be preserved');
    assert.equal(received[2].length, 5);
    assert.equal(received[2][4], payload);
  });

  it('invokes listeners in registration order and returns how many ran', () => {
    const bus = createBus();
    const trace = [];
    bus.on('step', recorder(trace, 'first'));
    bus.on('step', recorder(trace, 'second'));
    bus.on('step', recorder(trace, 'third'));
    assert.equal(bus.emit('step'), 3);
    assert.deepEqual(trace, ['first', 'second', 'third']);
  });

  it('returns 0 and does nothing for an event with no listeners', () => {
    const bus = createBus();
    assert.equal(bus.emit('nothing'), 0);
    assert.equal(bus.emit('nothing', 1, 2, 3), 0);
  });

  it('does not deliver an event to listeners of other events', () => {
    const bus = createBus();
    const trace = [];
    bus.on('a', recorder(trace, 'a'));
    bus.on('b', recorder(trace, 'b'));
    bus.emit('a');
    assert.deepEqual(trace, ['a']);
  });

  it('fires a listener once per registration when registered twice', () => {
    const bus = createBus();
    let calls = 0;
    const fn = () => calls++;
    bus.on('dup', fn);
    bus.on('dup', fn);
    assert.equal(bus.emit('dup'), 2);
    assert.equal(calls, 2);
    assert.equal(bus.listenerCount('dup'), 2);
  });

  it('returns an unsubscribe function that removes exactly its own registration', () => {
    const bus = createBus();
    let calls = 0;
    const fn = () => calls++;
    const offA = bus.on('dup', fn);
    bus.on('dup', fn);
    assert.equal(offA(), true);
    assert.equal(offA(), false, 'second call is a no-op');
    assert.equal(bus.emit('dup'), 1);
    assert.equal(calls, 1);
  });

  it('rejects invalid event names and listeners with a TypeError', () => {
    const bus = createBus();
    const fn = () => {};
    for (const bad of BAD_NAMES) {
      assert.throws(() => bus.on(bad, fn), { name: 'TypeError', message: /event name/ });
      assert.throws(() => bus.emit(bad), { name: 'TypeError', message: /event name/ });
    }
    for (const bad of BAD_LISTENERS) {
      assert.throws(() => bus.on('ok', bad), { name: 'TypeError', message: /listener/ });
    }
    assert.equal(bus.eventNames().length, 0, 'failed registrations leave no trace');
  });

  it('treats distinct names independently and case-sensitively', () => {
    const bus = createBus();
    const trace = [];
    bus.on('Step', recorder(trace, 'upper'));
    bus.on('step', recorder(trace, 'lower'));
    bus.emit('step');
    assert.deepEqual(trace, ['lower']);
  });
});

describe('off', () => {
  it('removes every registration of a listener and reports the count', () => {
    const bus = createBus();
    let calls = 0;
    const fn = () => calls++;
    const other = () => calls++;
    bus.on('e', fn);
    bus.on('e', other);
    bus.on('e', fn);
    assert.equal(bus.off('e', fn), 2);
    assert.equal(bus.emit('e'), 1);
    assert.equal(calls, 1);
    assert.equal(bus.listenerCount('e'), 1);
  });

  it('removes all listeners of an event when no listener is given', () => {
    const bus = createBus();
    const trace = [];
    bus.on('a', recorder(trace, 'a1'));
    bus.on('a', recorder(trace, 'a2'));
    bus.on('b', recorder(trace, 'b'));
    assert.equal(bus.off('a'), 2);
    assert.equal(bus.listenerCount('a'), 0);
    assert.deepEqual(bus.eventNames(), ['b']);
    bus.emit('a');
    bus.emit('b');
    assert.deepEqual(trace, ['b']);
  });

  it('returns 0 for unknown events or unregistered listeners', () => {
    const bus = createBus();
    bus.on('a', () => {});
    assert.equal(bus.off('zzz'), 0);
    assert.equal(bus.off('zzz', () => {}), 0);
    assert.equal(bus.off('a', () => {}), 0);
    assert.equal(bus.listenerCount('a'), 1);
  });

  it('makes previously returned unsubscribe functions report false', () => {
    const bus = createBus();
    const off = bus.on('a', () => {});
    assert.equal(bus.off('a'), 1);
    assert.equal(off(), false);
  });

  it('validates its arguments before touching state', () => {
    const bus = createBus();
    bus.on('a', () => {});
    for (const bad of BAD_NAMES) {
      assert.throws(() => bus.off(bad), { name: 'TypeError', message: /event name/ });
    }
    for (const bad of BAD_LISTENERS.filter((v) => v !== undefined)) {
      assert.throws(() => bus.off('a', bad), { name: 'TypeError', message: /listener/ });
      assert.throws(() => bus.off('unknown', bad), { name: 'TypeError', message: /listener/ });
    }
    assert.equal(bus.listenerCount('a'), 1);
  });
});

describe('once', () => {
  it('fires exactly once and then disappears', () => {
    const bus = createBus();
    const trace = [];
    const off = bus.once('hit', recorder(trace, 'once'));
    assert.equal(typeof off, 'function');
    assert.equal(bus.emit('hit', 1), 1);
    assert.equal(bus.emit('hit', 2), 0);
    assert.deepEqual(trace, [['once', 1]]);
    assert.equal(bus.listenerCount('hit'), 0);
    assert.deepEqual(bus.eventNames(), []);
    assert.equal(off(), false, 'already fired, nothing left to remove');
  });

  it('can be cancelled before it fires', () => {
    const bus = createBus();
    let calls = 0;
    const off = bus.once('hit', () => calls++);
    assert.equal(off(), true);
    assert.equal(off(), false);
    bus.emit('hit');
    assert.equal(calls, 0);
  });

  it('is detached before it runs, so a re-entrant emit cannot fire it twice', () => {
    const bus = createBus();
    let calls = 0;
    bus.once('boom', () => {
      calls++;
      bus.emit('boom');
    });
    assert.equal(bus.emit('boom'), 1);
    assert.equal(calls, 1);
  });

  it('is removable through off() by its original function', () => {
    const bus = createBus();
    let calls = 0;
    const fn = () => calls++;
    bus.once('e', fn);
    assert.equal(bus.off('e', fn), 1);
    bus.emit('e');
    assert.equal(calls, 0);
  });

  it('stays removed even when it throws', () => {
    const bus = createBus();
    let calls = 0;
    bus.once('e', () => {
      calls++;
      throw new Error('nope');
    });
    assert.throws(() => bus.emit('e'), /nope/);
    assert.equal(bus.emit('e'), 0);
    assert.equal(calls, 1);
  });

  it('coexists with persistent listeners in registration order', () => {
    const bus = createBus();
    const trace = [];
    bus.on('e', recorder(trace, 'p1'));
    bus.once('e', recorder(trace, 'o'));
    bus.on('e', recorder(trace, 'p2'));
    bus.emit('e');
    bus.emit('e');
    assert.deepEqual(trace, ['p1', 'o', 'p2', 'p1', 'p2']);
  });

  it('rejects invalid arguments', () => {
    const bus = createBus();
    assert.throws(() => bus.once('', () => {}), { name: 'TypeError' });
    assert.throws(() => bus.once('e', 'nope'), { name: 'TypeError' });
  });
});

describe('mutation during emit', () => {
  it('does not fire a listener added during the emit until the next emit', () => {
    const bus = createBus();
    const trace = [];
    bus.on('e', () => {
      trace.push('a');
      bus.on('e', recorder(trace, 'late'));
    });
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['a']);
    assert.equal(bus.emit('e'), 2);
    assert.deepEqual(trace, ['a', 'a', 'late']);
  });

  it('skips a later listener removed via its unsubscribe during the emit', () => {
    const bus = createBus();
    const trace = [];
    let offB;
    bus.on('e', () => {
      trace.push('a');
      assert.equal(offB(), true);
    });
    offB = bus.on('e', recorder(trace, 'b'));
    bus.on('e', recorder(trace, 'c'));
    assert.equal(bus.emit('e'), 2);
    assert.deepEqual(trace, ['a', 'c']);
    assert.equal(bus.listenerCount('e'), 2);
  });

  it('skips a later listener removed via off(evt, fn) during the emit', () => {
    const bus = createBus();
    const trace = [];
    const b = recorder(trace, 'b');
    bus.on('e', () => {
      trace.push('a');
      assert.equal(bus.off('e', b), 1);
    });
    bus.on('e', b);
    bus.emit('e');
    assert.deepEqual(trace, ['a']);
  });

  it('allows a listener to remove itself while running', () => {
    const bus = createBus();
    const trace = [];
    const off = bus.on('e', () => {
      trace.push('self');
      assert.equal(off(), true);
    });
    bus.on('e', recorder(trace, 'next'));
    assert.equal(bus.emit('e'), 2);
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['self', 'next', 'next']);
  });

  it('stops remaining listeners when clear() is called mid-emit, and stays usable', () => {
    const bus = createBus();
    const trace = [];
    bus.on('e', () => {
      trace.push('a');
      assert.equal(bus.clear(), 3);
    });
    bus.on('e', recorder(trace, 'b'));
    bus.on(WILDCARD, recorder(trace, 'wild'));
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['a']);
    assert.deepEqual(bus.eventNames(), []);
    bus.on('e', recorder(trace, 'fresh'));
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['a', 'fresh']);
  });

  it('ignores a listener re-registered for the same event during clear()+on() inside emit', () => {
    const bus = createBus();
    let calls = 0;
    const fn = () => {
      calls++;
      bus.clear();
      bus.on('e', fn);
    };
    bus.on('e', fn);
    assert.equal(bus.emit('e'), 1);
    assert.equal(calls, 1);
    assert.equal(bus.listenerCount('e'), 1);
  });

  it('supports nested emits of other events with a deterministic trace', () => {
    const bus = createBus();
    const trace = [];
    bus.on('outer', () => {
      trace.push('outer:1');
      bus.emit('inner', 'x');
      trace.push('outer:1-done');
    });
    bus.on('outer', recorder(trace, 'outer:2'));
    bus.on('inner', recorder(trace, 'inner'));
    bus.emit('outer');
    assert.deepEqual(trace, ['outer:1', ['inner', 'x'], 'outer:1-done', 'outer:2']);
  });

  it('terminates when a once-listener re-arms itself on every emit', () => {
    const bus = createBus();
    let calls = 0;
    const rearm = () => {
      calls++;
      bus.once('tick', rearm);
    };
    bus.once('tick', rearm);
    for (let i = 0; i < 5; i++) assert.equal(bus.emit('tick'), 1);
    assert.equal(calls, 5);
    assert.equal(bus.listenerCount('tick'), 1);
  });

  it('handles removal of the currently running entry from a nested emit', () => {
    const bus = createBus();
    const trace = [];
    const offA = bus.on('e', () => {
      trace.push('a');
      bus.emit('kill');
      trace.push('a-after');
    });
    bus.on('kill', () => offA());
    bus.on('e', recorder(trace, 'b'));
    assert.equal(bus.emit('e'), 2);
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['a', 'a-after', 'b', 'b']);
  });
});

describe('clear', () => {
  it('removes every listener of every event and reports the total', () => {
    const bus = createBus();
    const offs = [bus.on('a', () => {}), bus.once('a', () => {}), bus.on('b', () => {}), bus.on(WILDCARD, () => {})];
    assert.equal(bus.clear(), 4);
    assert.deepEqual(bus.eventNames(), []);
    assert.equal(bus.listenerCount('a'), 0);
    assert.equal(bus.listenerCount('b'), 0);
    assert.equal(bus.listenerCount(WILDCARD), 0);
    assert.equal(bus.emit('a'), 0);
    assert.equal(bus.emit('b'), 0);
    for (const off of offs) assert.equal(off(), false);
  });

  it('returns 0 on an empty bus and leaves it reusable', () => {
    const bus = createBus();
    assert.equal(bus.clear(), 0);
    assert.equal(bus.clear(), 0);
    let calls = 0;
    bus.on('a', () => calls++);
    bus.emit('a');
    assert.equal(calls, 1);
  });
});

describe('wildcard listeners', () => {
  it('receive the event name followed by the arguments for every event', () => {
    const bus = createBus();
    const trace = [];
    bus.on(WILDCARD, recorder(trace, '*'));
    bus.emit('a');
    bus.emit('b', 1, 2);
    assert.deepEqual(trace, [['*', 'a'], ['*', 'b', 1, 2]]);
  });

  it('run after the specific listeners and count toward the emit result', () => {
    const bus = createBus();
    const trace = [];
    bus.on(WILDCARD, recorder(trace, 'w1'));
    bus.on('e', recorder(trace, 's1'));
    bus.on(WILDCARD, recorder(trace, 'w2'));
    bus.on('e', recorder(trace, 's2'));
    assert.equal(bus.emit('e'), 4);
    assert.deepEqual(trace, ['s1', 's2', ['w1', 'e'], ['w2', 'e']]);
  });

  it('fire for events that have no specific listeners', () => {
    const bus = createBus();
    const trace = [];
    bus.on(WILDCARD, recorder(trace, 'w'));
    assert.equal(bus.emit('ghost', 7), 1);
    assert.deepEqual(trace, [['w', 'ghost', 7]]);
  });

  it('support once and off like any other event', () => {
    const bus = createBus();
    let calls = 0;
    const fn = () => calls++;
    bus.once(WILDCARD, fn);
    bus.emit('a');
    bus.emit('b');
    assert.equal(calls, 1);
    bus.on(WILDCARD, fn);
    bus.on(WILDCARD, fn);
    assert.equal(bus.listenerCount(WILDCARD), 2);
    assert.deepEqual(bus.eventNames(), [WILDCARD]);
    assert.equal(bus.off(WILDCARD, fn), 2);
    assert.equal(bus.emit('a'), 0);
  });

  it('cannot be emitted directly', () => {
    const bus = createBus();
    let calls = 0;
    bus.on(WILDCARD, () => calls++);
    assert.throws(() => bus.emit(WILDCARD), { name: 'TypeError', message: /reserved/ });
    assert.equal(calls, 0);
  });

  it('are snapshotted with the specific listeners, so one added mid-emit waits for the next emit', () => {
    const bus = createBus();
    const trace = [];
    bus.on('e', () => {
      trace.push('s');
      bus.on(WILDCARD, recorder(trace, 'w'));
    });
    assert.equal(bus.emit('e'), 1, 'first emit: only s; the wildcard it registers must wait');
    assert.deepEqual(trace, ['s']);
    assert.equal(bus.emit('e'), 2, 'second emit: s (registers a 2nd wildcard) + the 1st wildcard');
    assert.deepEqual(trace, ['s', 's', ['w', 'e']]);
    assert.equal(bus.emit('e'), 3, 'third emit: s + both wildcards registered so far');
    assert.deepEqual(trace, ['s', 's', ['w', 'e'], 's', ['w', 'e'], ['w', 'e']]);
    assert.equal(bus.listenerCount(WILDCARD), 3);
  });

  it('are skipped when removed by a specific listener during the same emit', () => {
    const bus = createBus();
    const trace = [];
    const offW = bus.on(WILDCARD, recorder(trace, 'w'));
    bus.on('e', () => {
      trace.push('s');
      offW();
    });
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['s']);
  });
});

describe('error handling', () => {
  it('without onError, a throwing listener aborts the emit and the error propagates', () => {
    const bus = createBus();
    const trace = [];
    bus.on('e', recorder(trace, 'before'));
    bus.on('e', () => {
      throw new RangeError('bad listener');
    });
    bus.on('e', recorder(trace, 'after'));
    assert.throws(() => bus.emit('e'), { name: 'RangeError', message: 'bad listener' });
    assert.deepEqual(trace, ['before']);
  });

  it('without onError, the bus remains consistent after a throw', () => {
    const bus = createBus();
    const trace = [];
    const offThrow = bus.on('e', () => {
      throw new Error('x');
    });
    bus.on('e', recorder(trace, 'ok'));
    assert.throws(() => bus.emit('e'));
    assert.equal(offThrow(), true);
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['ok']);
    assert.equal(bus.listenerCount('e'), 1);
  });

  it('with onError, errors are reported with the event and args and dispatch continues', () => {
    const errors = [];
    const bus = createBus({ onError: (error, evt, args) => errors.push({ error, evt, args }) });
    const trace = [];
    const boom = new Error('boom');
    const payload = { id: 1 };
    bus.on('e', recorder(trace, 'a'));
    bus.on('e', () => {
      throw boom;
    });
    bus.on('e', recorder(trace, 'c'));
    bus.on(WILDCARD, () => {
      throw 'string-throw';
    });
    assert.equal(bus.emit('e', payload, 2), 4);
    assert.deepEqual(trace, [['a', payload, 2], ['c', payload, 2]]);
    assert.equal(errors.length, 2);
    assert.equal(errors[0].error, boom);
    assert.equal(errors[0].evt, 'e');
    assert.deepEqual(errors[0].args, [payload, 2]);
    assert.equal(errors[0].args[0], payload, 'args are the original references');
    assert.equal(errors[1].error, 'string-throw');
    assert.equal(errors[1].evt, 'e');
  });

  it('with onError, a throwing once listener is still removed', () => {
    let reported = 0;
    const bus = createBus({ onError: () => reported++ });
    bus.once('e', () => {
      throw new Error('once');
    });
    assert.equal(bus.emit('e'), 1);
    assert.equal(bus.emit('e'), 0);
    assert.equal(reported, 1);
  });

  it('lets an exception thrown by onError itself propagate', () => {
    const bus = createBus({
      onError: () => {
        throw new Error('handler failed');
      },
    });
    bus.on('e', () => {
      throw new Error('listener failed');
    });
    assert.throws(() => bus.emit('e'), /handler failed/);
  });
});

describe('introspection', () => {
  it('listenerCount reports live registrations and validates the name', () => {
    const bus = createBus();
    assert.equal(bus.listenerCount('none'), 0);
    const off = bus.on('a', () => {});
    bus.on('a', () => {});
    bus.once('a', () => {});
    assert.equal(bus.listenerCount('a'), 3);
    off();
    assert.equal(bus.listenerCount('a'), 2);
    bus.emit('a');
    assert.equal(bus.listenerCount('a'), 1, 'once listener consumed');
    for (const bad of BAD_NAMES) {
      assert.throws(() => bus.listenerCount(bad), { name: 'TypeError' });
    }
  });

  it('eventNames lists only names with live listeners, in first-registration order', () => {
    const bus = createBus();
    assert.deepEqual(bus.eventNames(), []);
    const offB = bus.on('b', () => {});
    bus.on('a', () => {});
    bus.on('b', () => {});
    assert.deepEqual(bus.eventNames(), ['b', 'a']);
    offB();
    assert.deepEqual(bus.eventNames(), ['b', 'a'], 'b still has one listener');
    bus.off('b');
    assert.deepEqual(bus.eventNames(), ['a']);
    bus.on('b', () => {});
    assert.deepEqual(bus.eventNames(), ['a', 'b'], 're-registered names append');
  });

  it('eventNames returns a fresh array each time', () => {
    const bus = createBus();
    bus.on('a', () => {});
    const first = bus.eventNames();
    first.push('tampered');
    assert.deepEqual(bus.eventNames(), ['a']);
  });
});

describe('determinism', () => {
  /**
   * Tiny LCG so the scripted scenario below is reproducible without depending on core/rng.js.
   * @param {number} seed
   * @returns {() => number} Returns integers in [0, 2^31).
   */
  const lcg = (seed) => () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed >>> 1;
  };

  /**
   * Drives a bus through a pseudo-random but seed-determined sequence of operations and returns the
   * full observable trace (listener invocations and method return values).
   * @param {number} seed
   * @returns {any[]}
   */
  function runScenario(seed) {
    const rand = lcg(seed);
    const bus = createBus({ onError: (error, evt) => trace.push(['err', String(error), evt]) });
    const trace = [];
    const names = ['step', 'coin', 'tide', 'shift'];
    /** @type {Array<() => boolean>} */
    const offs = [];
    for (let i = 0; i < 300; i++) {
      const op = rand() % 7;
      const evt = names[rand() % names.length];
      if (op === 0) {
        const id = i;
        offs.push(bus.on(evt, (...args) => trace.push(['on', id, evt, ...args])));
      } else if (op === 1) {
        const id = i;
        offs.push(bus.once(evt, (...args) => trace.push(['once', id, evt, ...args])));
      } else if (op === 2 && offs.length) {
        trace.push(['off-fn', offs[rand() % offs.length]()]);
      } else if (op === 3) {
        trace.push(['off', evt, bus.off(evt)]);
      } else if (op === 4 && rand() % 10 === 0) {
        trace.push(['clear', bus.clear()]);
      } else if (op === 5 && rand() % 4 === 0) {
        const id = i;
        offs.push(bus.on(evt, () => {
          trace.push(['thrower', id]);
          throw new Error(`fail-${id}`);
        }));
      } else {
        trace.push(['emit', evt, bus.emit(evt, i, rand() % 100)]);
      }
      trace.push(['count', bus.listenerCount(evt), bus.eventNames().join(',')]);
    }
    return trace;
  }

  it('produces identical traces for identical operation sequences', () => {
    const a = runScenario(0xC0FFEE);
    const b = runScenario(0xC0FFEE);
    assert.ok(a.length > 300, 'scenario should exercise many operations');
    assert.ok(a.some((row) => row[0] === 'on' || row[0] === 'once'), 'some listeners fired');
    assert.ok(a.some((row) => row[0] === 'err'), 'onError path exercised');
    assert.deepEqual(a, b);
  });

  it('produces different traces for different seeds (the scenario is not degenerate)', () => {
    assert.notDeepEqual(runScenario(1), runScenario(2));
  });

  it('keeps order under a large number of listeners and interleaved removals', () => {
    const bus = createBus();
    const N = 1000;
    const seen = [];
    const offs = [];
    for (let i = 0; i < N; i++) offs.push(bus.on('many', () => seen.push(i)));
    for (let i = 0; i < N; i += 3) offs[i]();
    const expected = [];
    for (let i = 0; i < N; i++) if (i % 3 !== 0) expected.push(i);
    assert.equal(bus.emit('many'), expected.length);
    assert.deepEqual(seen, expected);
    assert.equal(bus.listenerCount('many'), expected.length);
  });
});
