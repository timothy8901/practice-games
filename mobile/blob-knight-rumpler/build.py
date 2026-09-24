#!/usr/bin/env python3
"""Build Blob Knight Rumpler for Android: a signed APK, and a zip to hand around.

    python3 build.py                  # the current release from origin/main
    python3 build.py --source FILE    # or any copy of the engine page
    python3 build.py --debuggable     # test build that Chrome DevTools can attach to

The zip (dist/BlobKnightRumpler-Android.zip) holds the APK, install notes, and the
same page as a single web file. No Gradle: the Android SDK's own build tools
(aapt2, d8, zipalign, apksigner) and a JDK 17 do the work. See README.md.
"""
import argparse
import glob
import os
import secrets
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
BUILD = os.path.join(HERE, 'build')
DIST = os.path.join(HERE, 'dist')

APP_NAME = 'Blob Knight Rumpler'
MIN_SDK = 24      # Android 7.0
TARGET_SDK = 34   # 35+ would force edge-to-edge and put the game under the camera cutout
KEY_ALIAS = 'blobknightrumpler'
KEYSTORE = os.path.expanduser('~/.android/blob-knight-rumpler.jks')
KEYPASS = KEYSTORE + '.password'
THREE = os.path.join(HERE, 'vendor', 'three-0.152.2.min.js')
# The engine page this is built from: the published browser game, never modified
# here. ENGINE_MARK is how a page is known to be the game rather than something
# else sharing its name.
ENGINE_PAGES = ('blob-knight-rumpler.html',)
ENGINE_MARK = 'const ABIL = {'
ZIP_FOLDER = 'Blob Knight Rumpler - Android'
# The release these defaults build. Android refuses an install whose version code
# is not higher than the one on the phone, so raise both together for every build
# handed out, and keep them here rather than in whoever-typed-the-command's memory.
VERSION_NAME = '3.5'
VERSION_CODE = 8


def die(msg):
    sys.exit('build.py: ' + msg)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def run(cmd, **kw):
    print('  $ ' + ' '.join(os.path.basename(cmd[0]) if i == 0 else c for i, c in enumerate(cmd[:5]))
          + (' ...' if len(cmd) > 5 else ''))
    return subprocess.run(cmd, check=True, **kw)


# ------------------------------------------------------------------ the page
def read_game(args):
    if args.source:
        return read(args.source), os.path.abspath(args.source)
    git = ['git', '-C', REPO]
    for page in ENGINE_PAGES:
        found = subprocess.run(git + ['cat-file', '-e', args.ref + ':' + page], capture_output=True)
        if found.returncode != 0:
            continue
        text = subprocess.run(git + ['show', args.ref + ':' + page], check=True,
                              capture_output=True, encoding='utf-8').stdout
        if ENGINE_MARK not in text:
            continue        # the redirect left at the old name, not the game
        last = subprocess.run(git + ['log', '-1', '--format=%h %cs', args.ref, '--', page],
                              check=True, capture_output=True, encoding='utf-8').stdout.strip()
        return text, '%s:%s (last changed %s)' % (args.ref, page, last)
    die('no game page at %s - looked for %s carrying "%s". Pass --source FILE.'
        % (args.ref, ' / '.join(ENGINE_PAGES), ENGINE_MARK))


def patch(html, what, old, new):
    n = html.count(old)
    if n != 1:
        die('cannot apply the "%s" patch: expected this exactly once in the game, found it %d times:\n    %s\n'
            'the engine page has changed; update mobile_html() in build.py to match.' % (what, n, old[:140]))
    return html.replace(old, new)


def patch_all(html, what, old, new, expected):
    n = html.count(old)
    if n != expected:
        die('cannot apply the "%s" patch: expected %d occurrences of "%s", found %d' % (what, expected, old, n))
    return html.replace(old, new)


def stamp_source(origin):
    """Provenance for the build stamp: the commit, not the engine page's filename."""
    tail = origin.split(':')[-1]
    for page in ENGINE_PAGES:
        tail = tail.replace(page, '')
    return tail.strip(' ()') or origin


def mobile_html(game, origin, version):
    """The engine page plus the mobile layer, with three.js inlined for offline play."""
    css = read(os.path.join(HERE, 'web', 'mobile.css'))
    three = read(THREE)
    # Order matters: the loader defines BKRModels, the art layer wraps buildFighter
    # and startFight, and the touch layer wraps renderOverlay and starts its own
    # frame loop.
    layers = [(name, read(os.path.join(HERE, 'web', name)))
              for name in ('models.js', 'thrixel-art.js', 'mobile.js')]
    js = '\n'.join('<script id="bkr-%s">\n%s</script>' % (name.replace('.js', ''), text) for name, text in layers)
    for name, text, bad in ([('three.js', three, '</script'), ('mobile.css', css, '</style')]
                            + [(n, t, '</script') for n, t in layers]):
        if bad in text.lower():
            die('%s contains "%s", which would end its inline tag early' % (name, bad))

    html = patch(game, 'build stamp', '<!DOCTYPE html>\n',
                 '<!DOCTYPE html>\n<!-- %s %s, built by build.py from the Rumble Arena engine (%s) -->\n'
                 % (APP_NAME, version, stamp_source(origin)))
    # No pinch-zoom or double-tap zoom mid-fight; let the page reach under notches (the CSS keeps clear of them).
    html = patch(html, 'viewport', '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
                 '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, '
                 'user-scalable=no, viewport-fit=cover">\n<meta name="theme-color" content="#1a1a2e">')
    # The touch stick steers in any direction (game.input.ax/az); keys still work when it is idle.
    html = patch(html, 'analog stick (x)', 'mx: (I.right ? 1 : 0) - (I.left ? 1 : 0),',
                 'mx: I.ax || ((I.right ? 1 : 0) - (I.left ? 1 : 0)),')
    html = patch(html, 'analog stick (z)', 'mz: (I.down ? 1 : 0) - (I.up ? 1 : 0),',
                 'mz: I.az || ((I.down ? 1 : 0) - (I.up ? 1 : 0)),')
    # Size the renderer to the whole screen instead of a 0.58-aspect box in the page.
    html = patch(html, 'full-screen canvas', 'const h = Math.max(380, Math.min(620, Math.round(w * 0.58)));',
                 'const h = WRAP.clientHeight || Math.max(380, Math.min(620, Math.round(w * 0.58)));')
    # Let the mobile layer lower the resolution on phones that can't hold the frame rate.
    html = patch(html, 'resolution cap', 'renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));',
                 'renderer.setPixelRatio(Math.min(window.BKR_MAX_DPR || 2, window.devicePixelRatio || 1));')
    # The site calls it "(3D)" to set it apart from its 2D neighbours; the app needs no qualifier.
    html = patch(html, 'app title', '<title>Blob Knight Rumpler (3D)</title>', '<title>Blob Knight Rumpler</title>')
    html = patch(html, 'mobile stylesheet', '</head>', '<style id="bkr-mobile-css">\n' + css + '</style>\n</head>')
    html = patch(html, 'mobile layers', '</body>', js + '\n</body>')
    # Last, so none of the patches above can match inside the library.
    html = patch(html, 'bundled three.js', '<script src="https://unpkg.com/three@0.152.2/build/three.min.js"></script>',
                 '<script>/* three.js r152, MIT license, bundled for offline play */\n' + three + '\n</script>')
    return html


# ----------------------------------------------------------------- the tools
def version_key(path):
    return [int(p) if p.isdigit() else -1 for p in os.path.basename(path).replace('-', '.').split('.')]


def find_tools():
    sdk = (os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
           or os.path.expanduser('~/Library/Android/sdk'))
    jar = os.path.join(sdk, 'platforms', 'android-%d' % TARGET_SDK, 'android.jar')
    if not os.path.exists(jar):
        die('no %s - install "Android SDK Platform %d" in Android Studio\'s SDK Manager' % (jar, TARGET_SDK))
    names = ('aapt2', 'd8', 'zipalign', 'apksigner')
    bt = None
    for d in sorted(glob.glob(os.path.join(sdk, 'build-tools', '*')), key=version_key, reverse=True):
        if all(os.path.exists(os.path.join(d, n)) for n in names):
            bt = d
            break
    if not bt:
        die('no complete Android build-tools in %s/build-tools' % sdk)

    java_home = os.environ.get('JAVA_HOME')
    if not java_home and sys.platform == 'darwin':
        java_home = subprocess.run(['/usr/libexec/java_home', '-v', '17+'], capture_output=True,
                                   encoding='utf-8').stdout.strip()
    if not java_home or not os.path.exists(os.path.join(java_home, 'bin', 'javac')):
        die('need a JDK 17 or newer (set JAVA_HOME)')
    tools = {n: os.path.join(bt, n) for n in names}
    tools.update(jar=jar, javac=os.path.join(java_home, 'bin', 'javac'),
                 keytool=os.path.join(java_home, 'bin', 'keytool'), java_home=java_home, build_tools=bt)
    return tools


def ensure_keystore(t, env):
    """One signing key for every build, kept outside git. Android only installs an
    update over an earlier install when both were signed with the same key."""
    if os.path.exists(KEYSTORE):
        return
    os.makedirs(os.path.dirname(KEYSTORE), exist_ok=True)
    password = secrets.token_urlsafe(24)
    fd = os.open(KEYPASS, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(password + '\n')
    print('  creating the signing key %s (password in %s)' % (KEYSTORE, KEYPASS))
    run([t['keytool'], '-genkeypair', '-keystore', KEYSTORE, '-storetype', 'PKCS12', '-alias', KEY_ALIAS,
         '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10950',
         '-dname', "CN=Token Maxxer's Anonymous Game Studio, O=Token Maxxer's Anonymous Game Studio",
         '-storepass:env', 'KB2_KEY_PASS', '-keypass:env', 'KB2_KEY_PASS'],
        env=dict(env, KB2_KEY_PASS=password), stdout=subprocess.DEVNULL)
    os.chmod(KEYSTORE, 0o600)


def model_files():
    models = sorted(glob.glob(os.path.join(HERE, 'models', '*.glb')))
    if not models:
        die('no packed models in models/ - run: python3 tools/pack_models.py\n'
            '(it needs the Thrixel art in thrixel_assets/mote_rumble, which is not in git)')
    return models


def copy_models(dest):
    os.makedirs(dest, exist_ok=True)
    total = 0
    for path in model_files():
        shutil.copy2(path, dest)
        total += os.path.getsize(path)
    print('  %d Thrixel models, %.1f MB' % (len(model_files()), total / 1e6))


# ------------------------------------------------------------------- the APK
def build_apk(html, version_name, version_code, debuggable):
    t = find_tools()
    env = dict(os.environ, JAVA_HOME=t['java_home'],
               PATH=os.path.join(t['java_home'], 'bin') + os.pathsep + os.environ.get('PATH', ''))
    print('build-tools %s, %s' % (os.path.basename(t['build_tools']), t['java_home']))
    shutil.rmtree(BUILD, ignore_errors=True)
    www = os.path.join(BUILD, 'assets', 'www')
    os.makedirs(www)
    with open(os.path.join(www, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    copy_models(os.path.join(www, 'models'))

    android = os.path.join(HERE, 'android')
    res = os.path.join(BUILD, 'res.zip')
    run([t['aapt2'], 'compile', '--dir', os.path.join(android, 'res'), '-o', res])
    unsigned = os.path.join(BUILD, 'unsigned.apk')
    link = [t['aapt2'], 'link', '-o', unsigned, '-I', t['jar'],
            '--manifest', os.path.join(android, 'AndroidManifest.xml'),
            '-A', os.path.join(BUILD, 'assets'),
            '--min-sdk-version', str(MIN_SDK), '--target-sdk-version', str(TARGET_SDK),
            '--version-code', str(version_code), '--version-name', version_name, res]
    if debuggable:
        link.insert(2, '--debug-mode')
    run(link)

    classes = os.path.join(BUILD, 'classes')
    sources = sorted(glob.glob(os.path.join(android, 'src', '**', '*.java'), recursive=True))
    run([t['javac'], '-source', '8', '-target', '8', '-bootclasspath', t['jar'], '-encoding', 'UTF-8',
         '-Xlint:all,-options', '-d', classes] + sources, env=env)
    dex = os.path.join(BUILD, 'dex')
    os.makedirs(dex)
    run([t['d8'], '--debug' if debuggable else '--release', '--min-api', str(MIN_SDK), '--lib', t['jar'],
         '--output', dex] + sorted(glob.glob(os.path.join(classes, '**', '*.class'), recursive=True)), env=env)
    with zipfile.ZipFile(unsigned, 'a', zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(dex, 'classes.dex'), 'classes.dex')

    aligned = os.path.join(BUILD, 'aligned.apk')
    run([t['zipalign'], '-f', '-p', '4', unsigned, aligned])
    ensure_keystore(t, env)
    os.makedirs(DIST, exist_ok=True)
    apk = os.path.join(DIST, 'BlobKnightRumpler-debug.apk' if debuggable else 'BlobKnightRumpler.apk')
    # PKCS12 keeps one password for the store and the key; apksigner reuses it for the key.
    run([t['apksigner'], 'sign', '--ks', KEYSTORE, '--ks-key-alias', KEY_ALIAS, '--ks-pass', 'file:' + KEYPASS,
         '--v4-signing-enabled', 'false', '--out', apk, aligned], env=env)

    check = run([t['apksigner'], 'verify', '--verbose', '--print-certs', apk], env=env,
                capture_output=True, encoding='utf-8').stdout
    wanted = ('Verifies', 'Verified using v2', 'Verified using v3', 'Signer #1 certificate DN', 'Signer #1 certificate SHA-256')
    for line in check.splitlines():
        if line.startswith(wanted):
            print('    ' + line)
    badging = run([t['aapt2'], 'dump', 'badging', apk], capture_output=True, encoding='utf-8').stdout
    for line in badging.splitlines():
        if line.startswith(('package:', 'sdkVersion:', 'targetSdkVersion:', 'application-label:',
                            'launchable-activity:', 'uses-permission:', 'application-debuggable')):
            print('    ' + line)
    return apk


# ------------------------------------------------------------------- the zip
def package_zip(apk, html, version_name):
    notes = read(os.path.join(HERE, 'INSTALL.txt')).replace('{version}', version_name)
    out = os.path.join(DIST, 'BlobKnightRumpler-Android.zip')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(apk, ZIP_FOLDER + '/BlobKnightRumpler.apk', compress_type=zipfile.ZIP_STORED)  # already compressed
        z.writestr(ZIP_FOLDER + '/How to install.txt', notes)
        z.writestr(ZIP_FOLDER + '/web/index.html', html)
        for path in model_files():                                   # the web copy needs them too
            z.write(path, ZIP_FOLDER + '/web/models/' + os.path.basename(path))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--ref', default='origin/main', help='git ref to take the engine page from (default: origin/main)')
    ap.add_argument('--source', help='build this copy of the engine page instead of the one at --ref')
    ap.add_argument('--version-name', default=VERSION_NAME)
    ap.add_argument('--version-code', type=int, default=VERSION_CODE,
                    help='raise it for every build you hand out (default: %d)' % VERSION_CODE)
    ap.add_argument('--debuggable', action='store_true',
                    help='test build: Chrome DevTools can attach to the WebView (not zipped)')
    args = ap.parse_args()

    game, origin = read_game(args)
    print('game: ' + origin)
    html = mobile_html(game, origin, args.version_name)
    apk = build_apk(html, args.version_name, args.version_code, args.debuggable)
    print('APK: %s (%.1f MB)' % (os.path.relpath(apk, HERE), os.path.getsize(apk) / 1e6))
    if not args.debuggable:
        z = package_zip(apk, html, args.version_name)
        print('zip: %s (%.1f MB)' % (os.path.relpath(z, HERE), os.path.getsize(z) / 1e6))


if __name__ == '__main__':
    main()
