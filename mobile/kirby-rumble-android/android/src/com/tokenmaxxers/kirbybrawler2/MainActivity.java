package com.tokenmaxxers.kirbybrawler2;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.MimeTypeMap;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;

/**
 * Kirby Brawler 2 on Android: one full-screen WebView running the bundled game
 * (assets/www/index.html, with three.js inlined, so it plays offline).
 *
 * The page does the game-side work (touch controls, pausing, menus) and exposes
 * window.KB.back() and window.KB.appPause() for this Activity to call.
 */
public class MainActivity extends Activity {
    private static final String TAG = "KirbyBrawler2";
    // The page is served from a virtual https host backed by the APK's assets rather
    // than from file://, so it is one ordinary origin: fetch() can read the Thrixel
    // models, and nothing on the phone's filesystem is reachable from the page.
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    // ?app=android tells the page it is inside the app: touch controls on, no browser fullscreen request.
    private static final String GAME_URL = "https://" + ASSET_HOST + "/assets/www/index.html?app=android";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            // Keep the game out of the camera cutout; the phone letterboxes that edge instead.
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
            window.setAttributes(lp);
        }
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);  // test builds only (build.py --debuggable)
        }
        createWebView();
        hideSystemBars();
    }

    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(0x1a, 0x1a, 0x2e));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);
        web.setLongClickable(false);
        web.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                return true;  // no text-selection or context menu on a held button
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                  // remembers the sound setting
        s.setMediaPlaybackRequiresUserGesture(false);  // sound works from the first tap
        s.setTextZoom(100);                            // the HUD is laid out in px; ignore the phone's font size
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);                   // file:///android_asset still loads; nothing else on the phone does
        s.setAllowContentAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!ASSET_HOST.equals(url.getHost())) return null;   // nothing else is served
                String path = url.getPath() == null ? "" : url.getPath();
                if (!path.startsWith("/assets/") || path.contains("..")) return notFound();
                String asset = path.substring("/assets/".length());
                try {
                    InputStream stream = getAssets().open(asset);
                    WebResourceResponse response = new WebResourceResponse(mimeOf(asset), null, stream);
                    response.setResponseHeaders(new HashMap<String, String>());
                    return response;
                } catch (IOException missing) {
                    Log.w(TAG, "no such asset: " + asset);
                    return notFound();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (ASSET_HOST.equals(url.getHost())) return false;
                // A web link opens in the browser rather than replacing the game.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The page's renderer died (usually the GPU running out of memory). Start the
                // game over in a fresh WebView instead of taking the whole app down with it.
                Log.e(TAG, "WebView renderer gone (crashed=" + detail.didCrash() + "), reloading");
                ViewGroup parent = (ViewGroup) view.getParent();
                if (parent != null) parent.removeView(view);
                view.destroy();
                createWebView();
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, m.messageLevel() + ": " + m.message() + " (line " + m.lineNumber() + ")");
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(GAME_URL);
    }

    private static WebResourceResponse notFound() {
        WebResourceResponse response = new WebResourceResponse(
                "text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(),
                new ByteArrayInputStream(new byte[0]));
        return response;
    }

    private static String mimeOf(String asset) {
        if (asset.endsWith(".html")) return "text/html";
        if (asset.endsWith(".js")) return "application/javascript";
        if (asset.endsWith(".glb")) return "model/gltf-binary";
        String extension = MimeTypeMap.getFileExtensionFromUrl(asset);
        String guess = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        return guess != null ? guess : "application/octet-stream";
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // The page decides: Back pauses a fight, resumes from the pause menu and steps back
        // through the menus. On the title menu it answers false and Android handles Back.
        web.evaluateJavascript("(window.KB && KB.back) ? KB.back() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onPause() {
        // Pause the fight before the screen goes away, so coming back lands on the pause menu.
        web.evaluateJavascript("window.KB && KB.appPause && KB.appPause()", null);
        web.onPause();
        web.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            ViewGroup parent = (ViewGroup) web.getParent();
            if (parent != null) parent.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }
}
