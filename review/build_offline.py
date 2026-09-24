#!/usr/bin/env python3
"""build_offline.py — fold the game into one HTML file you can double-click.

    python3 review/build_offline.py [out.html]

WHY THIS EXISTS
---------------
The game is ES modules and fetches two baked models at runtime, so it needs an
HTTP server: open severed.html off the disk and the browser blocks every module
load as a cross-origin request and the page comes up blank. That is fine for
development and useless for handing someone a game. Every persona review flagged
it.

This flattens the module graph into one classic script, inlines the stylesheets,
and inlines the two JSON assets behind a tiny fetch shim, so the result opens
from file:// with no server and no network.

WHY NOT A REAL BUNDLER
----------------------
The project has no dependencies and no build step, and adding esbuild to ship
one file would be the tail wagging the dog. What makes a hand-rolled bundler
defensible here is that the module syntax in this codebase is a tiny, uniform
subset — named imports only, no default exports, no namespace imports, no
dynamic import, no import.meta. The transformer below handles exactly that
subset and RAISES on anything else rather than emitting a plausible-looking
bundle with a hole in it. If someone adds a default export, this fails loudly.

It also refuses to emit a bundle if the import graph has a cycle: modules are
concatenated in dependency order and evaluated eagerly, which is correct for an
acyclic graph and silently wrong for a cyclic one.
"""

import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRY = os.path.join(ROOT, 'review', 'severed.js')
HTML = os.path.join(ROOT, 'review', 'severed.html')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'review', '_offline.html')

IMPORT_RE = re.compile(r"^import\s*\{([^}]*)\}\s*from\s*'([^']+)'\s*;?\s*$", re.M)
BAD_RE = re.compile(r"^\s*(?:import|export)\b", re.M)


def read(p):
    with open(p, encoding='utf8') as f:
        return f.read()


def collect(entry):
    """Depth-first over the import graph, returning modules in dependency order."""
    order, seen, stack = [], {}, []

    def visit(path):
        real = os.path.realpath(path)
        if seen.get(real) == 'done':
            return
        if seen.get(real) == 'visiting':
            cycle = ' -> '.join(os.path.relpath(p, ROOT) for p in stack + [real])
            raise SystemExit(f'import cycle, cannot bundle eagerly:\n  {cycle}')
        seen[real] = 'visiting'
        stack.append(real)
        src = read(real)
        for _, spec in IMPORT_RE.findall(src):
            visit(os.path.join(os.path.dirname(real), spec))
        stack.pop()
        seen[real] = 'done'
        order.append(real)

    visit(entry)
    return order


def transform(path, src):
    """One module -> one IIFE that assigns its exports onto a namespace object."""
    ns = 'M' + re.sub(r'\W', '_', os.path.relpath(path, ROOT))
    exports = []

    def imp(m):
        names, spec = m.group(1), m.group(2)
        target = 'M' + re.sub(r'\W', '_', os.path.relpath(
            os.path.realpath(os.path.join(os.path.dirname(path), spec)), ROOT))
        # `a as b` is destructuring's `a: b`
        names = re.sub(r'\s+as\s+', ': ', names.strip())
        return f'const {{ {names} }} = {target};'

    src = IMPORT_RE.sub(imp, src)

    def decl(m):
        exports.append(m.group(2))
        return f'{m.group(1)} {m.group(2)}'
    src = re.sub(r'^export\s+(function|const|class)\s+([A-Za-z_$][\w$]*)', decl, src, flags=re.M)

    def braces(m):
        for part in m.group(1).split(','):
            part = part.strip()
            if not part:
                continue
            if ' as ' in part:
                local, alias = (x.strip() for x in part.split(' as '))
                exports.append((alias, local))
            else:
                exports.append(part)
        return ''
    src = re.sub(r'^export\s*\{([^}]*)\}\s*;?\s*$', braces, src, flags=re.M)

    leftover = BAD_RE.search(src)
    if leftover:
        line = src[:leftover.start()].count('\n') + 1
        raise SystemExit(
            f'{os.path.relpath(path, ROOT)}:{line}: module syntax this bundler does not handle:\n'
            f'  {src.splitlines()[line - 1].strip()}\n'
            f'Extend build_offline.py rather than shipping a bundle with a hole in it.')

    pairs = ', '.join(f'{a}: {b}' if isinstance(e, tuple) and (a := e[0]) and (b := e[1])
                      else f'{e}' for e in exports)
    # async, and awaited: severed.js uses top-level await to load its baked
    # models before the first world is built. Modules are emitted in dependency
    # order, so awaiting each in turn preserves the evaluation order real ES
    # modules would have given.
    return (f'/* ---- {os.path.relpath(path, ROOT)} ---- */\n'
            f'const {ns} = await (async () => {{\n{src}\nreturn {{ {pairs} }};\n}})();\n')


def main():
    mods = collect(ENTRY)
    body = ''.join(transform(p, read(p)) for p in mods)

    assets = {}
    for name in ('doll.json', 'desk.json'):
        p = os.path.join(ROOT, '3d-mazeball', 'assets', name)
        if os.path.exists(p):
            assets[name] = read(p)

    shim = (
        'const __ASSETS = {\n'
        + ''.join(f'  {json.dumps(k)}: {v},\n' for k, v in assets.items())
        + '};\n'
        '// The game fetches its baked models. Off the disk there is nothing to\n'
        '// fetch from, so serve them out of the bundle instead.\n'
        'const __realFetch = typeof fetch === "function" ? fetch.bind(window) : null;\n'
        'window.fetch = (u, o) => {\n'
        '  const s = String(u && u.url ? u.url : u);\n'
        '  for (const k of Object.keys(__ASSETS)) {\n'
        '    if (s.endsWith(k)) return Promise.resolve({ ok: true, status: 200,\n'
        '      json: async () => __ASSETS[k], text: async () => JSON.stringify(__ASSETS[k]) });\n'
        '  }\n'
        '  return __realFetch ? __realFetch(u, o) : Promise.reject(new Error("offline build"));\n'
        '};\n'
    )

    html = read(HTML)
    css = ''
    for m in re.findall(r'<link rel="stylesheet" href="([^"]+)">', html):
        css += f'\n/* ---- {m} ---- */\n' + read(os.path.join(ROOT, 'review', m))
    html = re.sub(r'\s*<link rel="stylesheet" href="[^"]+">', '', html)
    html = html.replace('</head>', f'<style>{css}\n</style>\n</head>')
    # A function replacement, not a string: the bundle is full of regex literals
    # and re.sub would read their backslashes as escape sequences.
    payload = '\n<script>\n(async () => {\n' + shim + body + '})();\n</script>'
    html = re.sub(r'\s*<script type="module" src="[^"]+"></script>',
                  lambda _m: payload, html)
    html = html.replace('<title>The Severed Floor — playtest</title>',
                        '<title>The Escape from Lumon</title>')

    with open(OUT, 'w', encoding='utf8') as f:
        f.write(html)
    sys.stderr.write(
        f'{os.path.relpath(OUT, ROOT)}: {len(mods)} modules, '
        f'{len(assets)} inlined assets, {os.path.getsize(OUT) / 1048576:.2f} MB\n')


main()
