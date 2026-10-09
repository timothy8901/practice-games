# Rebuild the app's game file, www/index.html, from the website version of the game.
# In the practice-games repo this reads ../../dodeca-rings.html; pass another path to read elsewhere.
#   python3 build-www.py [path/to/dodeca-rings.html]
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'dodeca-rings.html')
OUT = os.path.join(HERE, 'www', 'index.html')
s = open(SRC).read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)
# App metadata: the web app manifest, the home-screen icon and its title.
rep('<title>Dodeca Rings</title>\n',
    '<title>Dodeca Rings</title>\n'
    '<link rel="manifest" href="manifest.webmanifest">\n'
    '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
    '<meta name="apple-mobile-web-app-title" content="Dodeca Rings">\n')
# Inside the app there is no games page to go back to.
rep('        <a id="linkGames" href="index.html">&larr; All games</a>\n', '')
# Keep text at the size the layout was drawn for, whatever the browser's font boosting does.
rep('  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); overscroll-behavior: none; }',
    '  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); overscroll-behavior: none; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }')
# Work offline once installed from the web. The native app ships its files inside it, so it skips this.
rep('</script>\n</body>\n</html>',
    '</script>\n'
    '<script>\n'
    "if ('serviceWorker' in navigator && !window.Capacitor && (location.protocol === 'https:' || location.hostname === 'localhost')) {\n"
    "  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });\n"
    '}\n'
    '</script>\n'
    '</body>\n</html>')
open(OUT, 'w').write(s)
print('wrote', OUT, len(s))
