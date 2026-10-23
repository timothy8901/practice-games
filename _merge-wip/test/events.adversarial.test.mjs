/**
 * Adversarial verification suite for js/core/events.js.
 *
 * Complements test/events.test.mjs (the author's suite) with hostile inputs, boundaries, large
 * inputs, feedback loops, cross-bus re-entrancy, error-path corner cases, and a fuzz comparison
 * against an independently written reference model of the documented dispatch semantics.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import * as events from '../js/core/events.js';

const { createBus, WILDCARD, DEFAULT_MAX_DEPTH } = events;

/**
 * Tiny LCG so scenarios are reproducible without depending on core/rng.js.
 * @param {number} seed
 * @returns {() => number} Integers in [0, 2^31).
 */
const lcg = (seed) => () => {
  seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
  return seed >>> 1;
};

/**
 * FNV-1a 32-bit digest of a string, as 8 hex chars.
 * @param {string} str
 * @returns {string}
 */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

describe('module surface', () => {
  it('exports exactly createBus, WILDCARD and DEFAULT_MAX_DEPTH', () => {
    assert.deepEqual(Object.keys(events).sort(), ['DEFAULT_MAX_DEPTH', 'WILDCARD', 'createBus']);
    assert.equal(WILDCARD, '*');
    assert.equal(DEFAULT_MAX_DEPTH, 128);
  });

  it('a bus has exactly the documented own keys, is frozen, and inherits from Object.prototype', () => {
    const bus = createBus();
    assert.deepEqual(Object.keys(bus).sort(), ['clear', 'emit', 'eventNames', 'listenerCount', 'off', 'on', 'once']);
    assert.equal(Object.getPrototypeOf(bus), Object.prototype);
    assert.equal(Object.isExtensible(bus), false);
    assert.throws(() => {
      bus.emit = () => 0;
    }, TypeError);
    assert.throws(() => {
      delete bus.on;
    }, TypeError);
  });

  it('unsubscribe functions are distinct per registration, take no arguments and ignore extras', () => {
    const bus = createBus();
    const fn = () => {};
    const a = bus.on('e', fn);
    const b = bus.on('e', fn);
    assert.notEqual(a, b);
    assert.equal(a.length, 0);
    assert.equal(a('ignored', 1), true);
    assert.equal(bus.listenerCount('e'), 1);
  });
});

describe('malformed inputs', () => {
  it('createBus tolerates non-object options and treats onError: null as "no handler"', () => {
    const weird = [42, 'opts', true, Symbol('s'), 0n, [], Object.create(null)];
    weird.forEach((opts, i) => assert.doesNotThrow(() => createBus(opts), `options #${i}`));
    const bus = createBus({ onError: null });
    bus.on('e', () => {
      throw new Error('propagates');
    });
    assert.throws(() => bus.emit('e'), /propagates/);
  });

  it('createBus rejects a non-callable onError, naming the method', () => {
    for (const bad of [0, 1, 'log', {}, [], Symbol('s'), 1n, false]) {
      assert.throws(() => createBus({ onError: bad }), { name: 'TypeError', message: /^events\.createBus: onError/ });
    }
  });

  it('createBus validates maxDepth as a positive integer and defaults it for null/undefined', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, -Infinity, '5', true, {}, [], 1n]) {
      assert.throws(() => createBus({ maxDepth: bad }), { name: 'TypeError', message: /^events\.createBus: maxDepth/ });
    }
    for (const ok of [1, 2, 128, 10_000, undefined, null]) assert.doesNotThrow(() => createBus({ maxDepth: ok }));
  });

  it('rejects exotic non-string names in every method, naming the method', () => {
    const bus = createBus();
    const fn = () => {};
    const bad = [Symbol('e'), 1n, true, NaN, 0, new String('e'), ['e'], { toString: () => 'e' }, Object.create(null), () => 'e'];
    const methods = {
      on: (n) => bus.on(n, fn),
      once: (n) => bus.once(n, fn),
      off: (n) => bus.off(n),
      emit: (n) => bus.emit(n),
      listenerCount: (n) => bus.listenerCount(n),
    };
    for (const [name, call] of Object.entries(methods)) {
      for (const n of bad) {
        assert.throws(() => call(n), { name: 'TypeError', message: new RegExp(`^events\\.${name}: event name`) }, name);
      }
    }
    assert.deepEqual(bus.eventNames(), []);
  });

  it('rejects non-callable listeners but accepts every kind of callable', () => {
    const bus = createBus();
    for (const bad of [new Proxy({}, {}), Object.create(Function.prototype), 1n, true, Symbol('f')]) {
      assert.throws(() => bus.on('e', bad), { name: 'TypeError', message: /^events\.on: listener/ });
      assert.throws(() => bus.once('e', bad), { name: 'TypeError', message: /^events\.once: listener/ });
      assert.throws(() => bus.off('e', bad), { name: 'TypeError', message: /^events\.off: listener/ });
    }
    const calls = [];
    const callables = [
      function named() {
        calls.push('fn');
      },
      () => calls.push('arrow'),
      function () {
        calls.push('bound');
      }.bind(null),
      new Proxy(() => calls.push('proxy'), {}),
      async () => {
        calls.push('async');
      },
      // A generator function is callable; calling it only creates the generator (body never runs).
      function* gen() {
        calls.push('never');
      },
    ];
    for (const c of callables) bus.on('e', c);
    assert.equal(bus.emit('e'), callables.length);
    assert.deepEqual(calls, ['fn', 'arrow', 'bound', 'proxy', 'async']);
    // A class is callable by type; invoking it without `new` is the listener's own TypeError.
    bus.on('k', class K {});
    assert.throws(() => bus.emit('k'), { name: 'TypeError', message: /class constructor/i });
  });

  it('off(evt, undefined) behaves like off(evt); off(evt, null) is a TypeError that changes nothing', () => {
    const bus = createBus();
    bus.on('e', () => {});
    bus.on('e', () => {});
    assert.throws(() => bus.off('e', null), { name: 'TypeError' });
    assert.equal(bus.listenerCount('e'), 2);
    assert.equal(bus.off('e', undefined), 2);
    assert.deepEqual(bus.eventNames(), []);
  });

  it('emit passes arbitrary argument values through untouched, including the bus itself', () => {
    const bus = createBus();
    let got;
    bus.on('e', (...a) => {
      got = a;
    });
    bus.emit('e', undefined, null, NaN, bus, Symbol.iterator, 0n, -0, Object.create(null));
    assert.equal(got.length, 8);
    assert.equal(got[0], undefined);
    assert.equal(got[1], null);
    assert.ok(Number.isNaN(got[2]));
    assert.equal(got[3], bus);
    assert.equal(got[4], Symbol.iterator);
    assert.equal(got[5], 0n);
    assert.ok(Object.is(got[6], -0));
    assert.equal(Object.getPrototypeOf(got[7]), null);
  });
});

describe('event names', () => {
  it('prototype-ish names are ordinary, isolated events and pollute nothing', () => {
    const names = ['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf', '__defineGetter__', 'length'];
    const bus = createBus();
    const trace = [];
    for (const n of names) bus.on(n, () => trace.push(n));
    for (const n of names) assert.equal(bus.emit(n), 1, n);
    assert.deepEqual(trace, names);
    assert.deepEqual(bus.eventNames(), names);
    assert.equal(bus.listenerCount('__proto__'), 1);
    assert.equal(bus.off('__proto__'), 1);
    assert.equal(Object.getPrototypeOf(bus), Object.prototype);
    assert.equal({}.__proto__, Object.prototype);
  });

  it('unicode names are compared by code units, not visually', () => {
    const bus = createBus();
    const trace = [];
    const nfc = 'café';
    const nfd = 'café';
    assert.notEqual(nfc, nfd);
    bus.on(nfc, () => trace.push('nfc'));
    bus.on(nfd, () => trace.push('nfd'));
    bus.on('\u{1F98A}', () => trace.push('fox'));
    bus.on('​', () => trace.push('zwsp'));
    bus.on('\uD83E', () => trace.push('lone-surrogate'));
    bus.on(' ', () => trace.push('space'));
    for (const n of [nfc, nfd, '\u{1F98A}', '​', '\uD83E', ' ']) assert.equal(bus.emit(n), 1, JSON.stringify(n));
    assert.deepEqual(trace, ['nfc', 'nfd', 'fox', 'zwsp', 'lone-surrogate', 'space']);
    assert.equal(bus.emit(nfc.normalize('NFD')), 1);
    assert.equal(trace.at(-1), 'nfd');
  });

  it('only the exact string "*" is reserved; look-alikes and names containing * are ordinary', () => {
    const bus = createBus();
    const trace = [];
    const names = ['＊', '**', '*x', 'x*', ' *', '*.*'];
    bus.on(WILDCARD, (evt) => trace.push(['*', evt]));
    for (const n of names) {
      bus.on(n, () => trace.push(n));
      assert.equal(bus.emit(n), 2, n);
    }
    assert.deepEqual(trace.filter((t) => typeof t === 'string'), names);
    assert.throws(() => bus.emit('*'), { name: 'TypeError', message: /^events\.emit: '\*' is reserved/ });
    assert.equal(bus.listenerCount('**'), 1);
  });

  it('accepts very long names and keeps them distinct from near-identical ones', () => {
    const bus = createBus();
    const long = 'x'.repeat(100_000);
    const trace = [];
    bus.on(long, () => trace.push('long'));
    bus.on(long.slice(0, -1), () => trace.push('short'));
    assert.equal(bus.emit(long), 1);
    assert.equal(bus.emit(`${long}x`), 0);
    assert.deepEqual(trace, ['long']);
    assert.equal(bus.eventNames().length, 2);
  });
});

describe('boundaries and large inputs', () => {
  it('handles 20k listeners on one event in order and clears them all', () => {
    const bus = createBus();
    const N = 20_000;
    let last = -1;
    let ordered = true;
    for (let i = 0; i < N; i++) {
      bus.on('many', () => {
        if (i !== last + 1) ordered = false;
        last = i;
      });
    }
    assert.equal(bus.emit('many'), N);
    assert.ok(ordered);
    assert.equal(last, N - 1);
    assert.equal(bus.clear(), N);
    assert.deepEqual(bus.eventNames(), []);
    assert.equal(bus.emit('many'), 0);
  });

  it('handles 10k distinct events, each reaching only its own listener plus the wildcard', () => {
    const bus = createBus();
    const N = 10_000;
    const hits = new Map();
    let wild = 0;
    for (let i = 0; i < N; i++) bus.on(`evt:${i}`, () => hits.set(i, (hits.get(i) ?? 0) + 1));
    bus.on(WILDCARD, () => wild++);
    for (let i = 0; i < N; i++) assert.equal(bus.emit(`evt:${i}`, i), 2);
    assert.equal(hits.size, N);
    assert.ok([...hits.values()].every((v) => v === 1));
    assert.equal(wild, N);
    assert.equal(bus.eventNames().length, N + 1);
    assert.equal(bus.clear(), N + 1);
  });

  it('passes tens of thousands of arguments through to specific and wildcard listeners', () => {
    const bus = createBus();
    const args = Array.from({ length: 50_000 }, (_, i) => i);
    let specific = 0;
    let wild = 0;
    bus.on('big', (...a) => {
      specific = a.length;
    });
    bus.on(WILDCARD, (evt, ...a) => {
      wild = evt === 'big' ? a.length : -1;
    });
    assert.equal(bus.emit('big', ...args), 2);
    assert.equal(specific, 50_000);
    assert.equal(wild, 50_000);
  });

  it('100k register/unregister cycles leave no residue', () => {
    const bus = createBus();
    for (let i = 0; i < 100_000; i++) {
      const register = i % 2 ? bus.on : bus.once;
      const off = register(`cycle:${i % 100}`, () => {});
      assert.equal(off(), true);
    }
    assert.deepEqual(bus.eventNames(), []);
    for (let i = 0; i < 100; i++) assert.equal(bus.listenerCount(`cycle:${i}`), 0);
  });

  it('a once listener consumed by emit drops its event name when it was the last one', () => {
    const bus = createBus();
    bus.once('solo', () => {});
    bus.emit('solo');
    assert.deepEqual(bus.eventNames(), []);
    assert.equal(bus.listenerCount('solo'), 0);
  });
});

describe('nested emits and the depth guard', () => {
  /**
   * Registers link:0 -> link:1 -> ... -> link:(n-1) so emitting link:0 puts n emits in flight.
   * @param {ReturnType<typeof createBus>} bus
   * @param {number} n
   * @param {number[]} trace
   */
  function chain(bus, n, trace) {
    for (let i = 0; i < n; i++) {
      bus.on(`link:${i}`, () => {
        trace.push(i);
        if (i + 1 < n) bus.emit(`link:${i + 1}`);
      });
    }
  }

  it('allows exactly DEFAULT_MAX_DEPTH emits in flight by default', () => {
    const bus = createBus();
    const trace = [];
    chain(bus, DEFAULT_MAX_DEPTH, trace);
    assert.equal(bus.emit('link:0'), 1);
    assert.equal(trace.length, DEFAULT_MAX_DEPTH);
  });

  it('throws a RangeError named EmitDepthError on the emit that would exceed maxDepth, naming that event', () => {
    const bus = createBus();
    const trace = [];
    chain(bus, DEFAULT_MAX_DEPTH + 1, trace);
    assert.throws(
      () => bus.emit('link:0'),
      (e) => e instanceof RangeError && e.name === 'EmitDepthError' && /maxDepth \(128\)/.test(e.message) && /"link:128"/.test(e.message),
    );
    assert.equal(trace.length, DEFAULT_MAX_DEPTH, 'every listener up to the limit ran');
    const probe = [];
    bus.on('ok', () => probe.push(1));
    assert.equal(bus.emit('ok'), 1, 'bus usable afterwards');
    assert.throws(() => bus.emit('link:0'), { name: 'EmitDepthError' });
    assert.equal(trace.length, 2 * DEFAULT_MAX_DEPTH, 'deterministic: identical count on the second run');
  });

  it('a listener re-emitting its own event fails fast and identically with and without onError', () => {
    const run = (onError) => {
      const bus = createBus({ onError });
      let calls = 0;
      const loop = () => {
        calls++;
        bus.emit('loop');
      };
      bus.on('loop', loop);
      bus.on('loop', loop);
      const t0 = Date.now();
      assert.throws(() => bus.emit('loop'), { name: 'EmitDepthError' });
      return { calls, ms: Date.now() - t0 };
    };
    const reported = [];
    const plain = run(null);
    const handled = run((e) => reported.push(e));
    assert.equal(plain.calls, DEFAULT_MAX_DEPTH);
    assert.equal(handled.calls, DEFAULT_MAX_DEPTH);
    assert.equal(reported.length, 0, 'the depth error is never routed to onError');
    assert.ok(plain.ms < 1000 && handled.ms < 1000, 'no exponential blow-up');
  });

  it('maxDepth: 1 forbids any nesting, even of a different event', () => {
    const bus = createBus({ maxDepth: 1 });
    const trace = [];
    bus.on('a', () => {
      trace.push('a');
      bus.emit('b');
    });
    bus.on('b', () => trace.push('b'));
    assert.throws(() => bus.emit('a'), { name: 'EmitDepthError', message: /maxDepth \(1\)/ });
    assert.deepEqual(trace, ['a']);
    assert.equal(bus.emit('b'), 1, 'top-level emits still work');
  });

  it('stays tripped until the outermost emit unwinds, even if a listener swallows the error', () => {
    const bus = createBus({ maxDepth: 3 });
    const trace = [];
    bus.on('a', () => {
      trace.push('a');
      try {
        bus.emit('b');
      } catch (e) {
        trace.push(e.name);
      }
      assert.throws(() => bus.emit('c'), { name: 'EmitDepthError' });
      trace.push('refused');
    });
    bus.on('b', () => {
      trace.push('b');
      bus.emit('b');
    });
    bus.on('c', () => trace.push('c'));
    assert.equal(bus.emit('a'), 1, 'the swallowing listener completes, so the outer emit succeeds');
    assert.deepEqual(trace, ['a', 'b', 'b', 'EmitDepthError', 'refused']);
    assert.equal(bus.emit('c'), 1, 'latch released once the outermost emit returned');
  });

  it('mutual recursion across two buses terminates, bypasses both onError handlers, and leaves both usable', () => {
    const fail = () => assert.fail('onError must not see a depth error');
    const a = createBus({ maxDepth: 10, onError: fail });
    const b = createBus({ maxDepth: 1000, onError: fail });
    let hops = 0;
    a.on('ping', () => {
      hops++;
      b.emit('pong');
    });
    b.on('pong', () => {
      hops++;
      a.emit('ping');
    });
    assert.throws(() => a.emit('ping'), { name: 'EmitDepthError', message: /maxDepth \(10\)/ });
    assert.equal(hops, 20);
    let ok = 0;
    a.on('x', () => ok++);
    b.on('x', () => ok++);
    assert.equal(a.emit('x') + b.emit('x'), 2);
    assert.equal(ok, 2);
    hops = 0;
    assert.throws(() => b.emit('pong'), { name: 'EmitDepthError', message: /maxDepth \(10\)/ });
    assert.equal(hops, 21, 'both depth counters were reset (one extra hop before a trips when b starts)');
  });

  it('an onError handler that reports through the bus works, and cannot hang when the reporter throws too', () => {
    const seen = [];
    const bus = createBus({ onError: (e, evt) => bus.emit('error', e.message, evt) });
    bus.on('error', (msg, evt) => seen.push([msg, evt]));
    bus.on('boom', () => {
      throw new Error('kaboom');
    });
    assert.equal(bus.emit('boom'), 1);
    assert.deepEqual(seen, [['kaboom', 'boom']]);
    bus.on('error', () => {
      throw new Error('reporter broke');
    });
    const t0 = Date.now();
    assert.throws(() => bus.emit('boom'), { name: 'EmitDepthError' });
    assert.ok(Date.now() - t0 < 1000);
    assert.equal(bus.emit('noop'), 0, 'bus usable afterwards');
  });

  it('a listener whose own recursion overflows the native stack is reported once via onError, and dispatch continues', () => {
    const errors = [];
    const bus = createBus({ onError: (e) => errors.push(e) });
    const trace = [];
    const blow = (n) => blow(n + 1) + 1;
    bus.on('e', () => blow(0));
    bus.on('e', () => trace.push('after'));
    assert.equal(bus.emit('e'), 2);
    assert.equal(errors.length, 1);
    assert.ok(errors[0] instanceof RangeError);
    assert.notEqual(errors[0].name, 'EmitDepthError');
    assert.deepEqual(trace, ['after']);
    assert.equal(bus.emit('e'), 2);
  });
});

describe('mutation during emit (adversarial)', () => {
  it('a wildcard listener that adds a listener for the current event does not extend the current emit', () => {
    const bus = createBus();
    const trace = [];
    bus.on(WILDCARD, (evt) => {
      trace.push(['*', evt]);
      bus.on(evt, () => trace.push(['late', evt]));
    });
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, [['*', 'e']]);
    assert.equal(bus.emit('e'), 2);
    assert.deepEqual(trace, [['*', 'e'], ['late', 'e'], ['*', 'e']]);
    assert.equal(bus.listenerCount('e'), 2);
  });

  it('a specific listener removing all wildcards mid-emit skips them and reports the count', () => {
    const bus = createBus();
    const trace = [];
    bus.on(WILDCARD, () => trace.push('w1'));
    bus.on(WILDCARD, () => trace.push('w2'));
    bus.on('e', () => {
      trace.push('s');
      assert.equal(bus.off(WILDCARD), 2);
    });
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['s']);
    assert.deepEqual(bus.eventNames(), ['e']);
  });

  it('a once wildcard that re-arms itself fires exactly once per emit', () => {
    const bus = createBus();
    let n = 0;
    const rearm = () => {
      n++;
      bus.once(WILDCARD, rearm);
    };
    bus.once(WILDCARD, rearm);
    for (let i = 0; i < 10; i++) assert.equal(bus.emit(`e${i}`), 1);
    assert.equal(n, 10);
    assert.equal(bus.listenerCount(WILDCARD), 1);
  });

  it('clear() followed by re-registration and a re-entrant emit sees only the fresh state', () => {
    const bus = createBus();
    const trace = [];
    bus.on('e', () => {
      trace.push('old');
      bus.clear();
      bus.on('e', () => trace.push('new'));
      assert.equal(bus.emit('e'), 1);
    });
    bus.on('e', () => trace.push('old2'));
    assert.equal(bus.emit('e'), 1);
    assert.deepEqual(trace, ['old', 'new']);
    assert.equal(bus.listenerCount('e'), 1);
  });

  it('a duplicate-registered listener that off()s itself by function removes both and skips its second run', () => {
    const bus = createBus();
    let n = 0;
    const returns = [];
    const fn = () => {
      n++;
      returns.push(bus.off('e', fn));
    };
    bus.on('e', fn);
    bus.on('e', fn);
    bus.on('e', () => {
      n += 10;
    });
    assert.equal(bus.emit('e'), 2);
    assert.equal(n, 11);
    assert.deepEqual(returns, [2]);
    assert.equal(bus.listenerCount('e'), 1);
  });

  it('nested emits from wildcard listeners keep a deterministic depth-first order', () => {
    const bus = createBus();
    const trace = [];
    bus.on(WILDCARD, (evt) => {
      trace.push(`*${evt}`);
      if (evt === 'outer') bus.emit('inner');
    });
    bus.on('inner', () => trace.push('inner'));
    bus.on('outer', () => trace.push('outer'));
    assert.equal(bus.emit('outer'), 2);
    assert.deepEqual(trace, ['outer', '*outer', 'inner', '*inner']);
  });

  it('unsubscribing a not-yet-run sibling from inside a nested emit of another event skips it', () => {
    const bus = createBus();
    const trace = [];
    let offC;
    bus.on('e', () => {
      trace.push('a');
      bus.emit('kill');
    });
    bus.on('kill', () => offC());
    bus.on('e', () => trace.push('b'));
    offC = bus.on('e', () => trace.push('c'));
    assert.equal(bus.emit('e'), 2);
    assert.deepEqual(trace, ['a', 'b']);
  });

  it('listeners registered for an event while it is being emitted are kept in order for the next emit', () => {
    const bus = createBus();
    const trace = [];
    bus.on('e', () => {
      if (trace.length === 0) {
        bus.on('e', () => trace.push('second'));
        bus.on('e', () => trace.push('third'));
      }
      trace.push('first');
    });
    bus.emit('e');
    bus.emit('e');
    assert.deepEqual(trace, ['first', 'first', 'second', 'third']);
  });
});

describe('error paths (adversarial)', () => {
  it('a throwing wildcard listener without onError aborts after the specific listeners ran, and depth unwinds', () => {
    const bus = createBus();
    const trace = [];
    bus.on('e', () => trace.push('s'));
    bus.on(WILDCARD, () => {
      throw new Error('w1');
    });
    bus.on(WILDCARD, () => trace.push('w2'));
    assert.throws(() => bus.emit('e'), /w1/);
    assert.deepEqual(trace, ['s']);
    assert.equal(bus.listenerCount(WILDCARD), 2);

    const strict = createBus({ maxDepth: 2 });
    strict.on('boom', () => {
      throw new Error('x');
    });
    strict.on('a', () => strict.emit('b'));
    for (let i = 0; i < 3; i++) {
      assert.throws(() => strict.emit('boom'), /x/);
      assert.equal(strict.emit('a'), 1, 'depth counter was unwound by the throw');
    }
  });

  it('non-Error throwables reach onError unchanged', () => {
    const got = [];
    const bus = createBus({ onError: (e) => got.push(e) });
    const values = [undefined, null, 0, '', false, NaN, 1n, Symbol.for('s')];
    for (const v of values) {
      bus.on('e', () => {
        throw v;
      });
    }
    assert.equal(bus.emit('e'), values.length);
    assert.equal(got.length, values.length);
    values.forEach((v, i) => assert.ok(Object.is(got[i], v), `index ${i}`));
  });

  it('an error in a nested emit without onError aborts the outer emit too, and once listeners stay consumed', () => {
    const bus = createBus();
    const trace = [];
    bus.once('outer', () => {
      trace.push('o1');
      bus.emit('inner');
      trace.push('unreachable');
    });
    bus.on('outer', () => trace.push('o2'));
    bus.once('inner', () => {
      trace.push('i1');
      throw new Error('inner failed');
    });
    assert.throws(() => bus.emit('outer'), /inner failed/);
    assert.deepEqual(trace, ['o1', 'i1']);
    assert.equal(bus.listenerCount('inner'), 0);
    assert.equal(bus.listenerCount('outer'), 1);
    assert.equal(bus.emit('outer'), 1);
    assert.deepEqual(trace, ['o1', 'i1', 'o2']);
  });

  it('an outer listener that catches the inner error lets the outer dispatch continue', () => {
    const bus = createBus();
    const trace = [];
    bus.on('outer', () => {
      try {
        bus.emit('inner');
      } catch (e) {
        trace.push(`caught:${e.message}`);
      }
    });
    bus.on('outer', () => trace.push('o2'));
    bus.on('inner', () => {
      throw new Error('x');
    });
    assert.equal(bus.emit('outer'), 2);
    assert.deepEqual(trace, ['caught:x', 'o2']);
  });

  it('onError throwing inside a nested emit is re-reported at each level and the bus recovers', () => {
    let n = 0;
    const bus = createBus({
      onError: () => {
        throw new Error(`handler ${++n}`);
      },
    });
    bus.on('outer', () => bus.emit('inner'));
    bus.on('outer', () => assert.fail('must not run'));
    bus.on('inner', () => {
      throw new Error('x');
    });
    assert.throws(() => bus.emit('outer'), /handler 2/);
    assert.equal(n, 2);
    assert.throws(() => bus.emit('inner'), /handler 3/);
    assert.equal(bus.emit('noop'), 0);
  });

  it('with onError, errors from many listeners are all reported in order with the original args array', () => {
    const got = [];
    const bus = createBus({ onError: (e, evt, args) => got.push({ m: e.message, evt, args }) });
    for (let i = 0; i < 100; i++) {
      bus.on('e', () => {
        throw new Error(`#${i}`);
      });
    }
    const payload = [1, 2];
    assert.equal(bus.emit('e', ...payload), 100);
    assert.deepEqual(
      got.map((g) => g.m),
      Array.from({ length: 100 }, (_, i) => `#${i}`),
    );
    assert.ok(got.every((g) => g.evt === 'e' && g.args === got[0].args));
    assert.deepEqual(got[0].args, payload);
  });
});

describe('determinism, state and reference-model equivalence', () => {
  /**
   * An independent, deliberately differently structured implementation of the documented dispatch
   * semantics (immutable per-event arrays + a set of live ids instead of mutable entries with an
   * `active` flag). No validation and no depth guard: the fuzz never needs them.
   * @param {(error: unknown, evt: string, args: any[]) => void} onError
   */
  function createReferenceBus(onError) {
    /** @type {Map<string, Array<{ id: number, fn: Function, once: boolean }>>} */
    let table = new Map();
    const alive = new Set();
    let nextId = 1;
    const drop = (evt, id) => {
      if (!alive.has(id)) return false;
      alive.delete(id);
      const rest = (table.get(evt) ?? []).filter((r) => r.id !== id);
      if (rest.length) table.set(evt, rest);
      else table.delete(evt);
      return true;
    };
    const register = (evt, fn, once) => {
      const rec = { id: nextId++, fn, once };
      alive.add(rec.id);
      table.set(evt, [...(table.get(evt) ?? []), rec]);
      return () => drop(evt, rec.id);
    };
    return {
      on: (evt, fn) => register(evt, fn, false),
      once: (evt, fn) => register(evt, fn, true),
      off(evt, fn) {
        const recs = table.get(evt) ?? [];
        const victims = fn === undefined ? recs : recs.filter((r) => r.fn === fn);
        victims.forEach((r) => drop(evt, r.id));
        return victims.length;
      },
      emit(evt, ...args) {
        const plan = [
          ...(table.get(evt) ?? []).map((r) => ({ r, key: evt, call: args })),
          ...(table.get(WILDCARD) ?? []).map((r) => ({ r, key: WILDCARD, call: [evt, ...args] })),
        ];
        let n = 0;
        for (const { r, key, call } of plan) {
          if (!alive.has(r.id)) continue;
          if (r.once) drop(key, r.id);
          n++;
          try {
            r.fn(...call);
          } catch (err) {
            onError(err, evt, args);
          }
        }
        return n;
      },
      clear() {
        const n = alive.size;
        alive.clear();
        table = new Map();
        return n;
      },
      listenerCount: (evt) => (table.get(evt) ?? []).length,
      eventNames: () => [...table.keys()],
    };
  }

  /**
   * Drives a bus through a seed-determined op sequence whose listeners themselves perform nested
   * ops (bounded to 3 levels), and returns the full observable trace.
   * @param {(onError: (error: unknown, evt: string, args: any[]) => void) => any} make
   * @param {number} seed
   * @param {number} [ops]
   * @returns {any[]}
   */
  function scenario(make, seed, ops = 200) {
    const rand = lcg(seed);
    const trace = [];
    const bus = make((e, evt, args) => trace.push(['err', e.message, evt, args.length]));
    const names = ['a', 'b', 'c', WILDCARD];
    const fns = [];
    const offs = [];
    let nesting = 0;
    const step = (i) => {
      const op = rand() % 10;
      const evt = names[rand() % names.length];
      switch (op) {
        case 0:
        case 1: {
          const id = fns.length;
          const fn = (...args) => {
            trace.push(['fire', id, ...args]);
            if (nesting < 3 && rand() % 3 === 0) {
              nesting++;
              step(-id - 1);
              nesting--;
            }
          };
          fns.push(fn);
          offs.push((op === 0 ? bus.on : bus.once)(evt, fn));
          trace.push([op === 0 ? 'on' : 'once', id, evt]);
          break;
        }
        case 2:
          if (fns.length) trace.push(['off-fn', evt, bus.off(evt, fns[rand() % fns.length])]);
          break;
        case 3:
          trace.push(['off', evt, bus.off(evt)]);
          break;
        case 4:
          if (offs.length) trace.push(['unsub', offs[rand() % offs.length]()]);
          break;
        case 5:
          if (rand() % 8 === 0) trace.push(['clear', bus.clear()]);
          break;
        case 6: {
          const id = fns.length;
          const fn = () => {
            trace.push(['throw', id]);
            throw new Error(`fail-${id}`);
          };
          fns.push(fn);
          offs.push(bus.on(evt, fn));
          trace.push(['thrower', id, evt]);
          break;
        }
        default:
          if (evt !== WILDCARD) trace.push(['emit', evt, i, bus.emit(evt, i, rand() % 50)]);
      }
      trace.push(['state', bus.listenerCount(evt), bus.eventNames().join('|')]);
    };
    for (let i = 0; i < ops; i++) step(i);
    return trace;
  }

  it('matches an independent reference model over many seeds, including nested mutations', () => {
    let fired = 0;
    let errors = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const real = scenario((h) => createBus({ onError: h }), seed);
      const ref = scenario((h) => createReferenceBus(h), seed);
      assert.deepEqual(real, ref, `seed ${seed}`);
      fired += real.filter((row) => row[0] === 'fire').length;
      errors += real.filter((row) => row[0] === 'err').length;
    }
    assert.ok(fired > 5000, `scenarios should fire many listeners (fired ${fired})`);
    assert.ok(errors > 100, `scenarios should exercise onError (errors ${errors})`);
  });

  it('is identical across repeated runs and matches the recorded golden digest', () => {
    const runs = [1, 2, 3].map(() => scenario((h) => createBus({ onError: h }), 0xbadc0de, 400));
    assert.deepEqual(runs[0], runs[1]);
    assert.deepEqual(runs[1], runs[2]);
    assert.ok(runs[0].length > 800);
    // If this digest changes, the observable dispatch semantics changed: update it deliberately.
    assert.equal(fnv1a(JSON.stringify(runs[0])), '6a663f66');
  });

  it('a cleared bus is indistinguishable from a fresh one', () => {
    let sink = () => {};
    const reused = createBus({ onError: (...a) => sink(...a) });
    const adopt = (h) => {
      sink = h;
      return reused;
    };
    scenario(adopt, 7);
    reused.clear();
    const a = scenario(adopt, 99);
    const b = scenario((h) => createBus({ onError: h }), 99);
    assert.deepEqual(a, b);
    assert.deepEqual(reused.eventNames(), createBusWithSameOps(99).eventNames());
  });

  /**
   * Helper for the test above: a fresh bus after the same scenario.
   * @param {number} seed
   */
  function createBusWithSameOps(seed) {
    let bus;
    scenario((h) => {
      bus = createBus({ onError: h });
      return bus;
    }, seed);
    return bus;
  }
});
