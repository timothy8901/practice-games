import SwiftUI
import WebKit

/// Hosts the Baker's Dozen HTML game in a WKWebView.
///
/// Loads the bundled copy of `WebContent/index.html` immediately so the app
/// works offline, then best-effort fetches the latest hosted version so beta
/// testers pick up web updates without a new build.
struct GameWebView: UIViewRepresentable {
    private static let remoteURL = URL(string:
        "https://preview-bakers-dozen-b2b05094.viktor.space/game.html")!

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.bounces = false
        webView.isOpaque = true

        loadBundled(into: webView)
        refreshFromRemoteIfAvailable(into: webView)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func loadBundled(into webView: WKWebView) {
        guard let url = Bundle.main.url(forResource: "index",
                                        withExtension: "html",
                                        subdirectory: "WebContent") else {
            assertionFailure("WebContent/index.html missing from bundle")
            return
        }
        webView.loadFileURL(url,
                            allowingReadAccessTo: url.deletingLastPathComponent())
    }

    private func refreshFromRemoteIfAvailable(into webView: WKWebView) {
        URLSession.shared.dataTask(with: Self.remoteURL) { data, response, _ in
            guard
                let data,
                let http = response as? HTTPURLResponse,
                http.statusCode == 200
            else { return }
            DispatchQueue.main.async {
                webView.load(data,
                             mimeType: "text/html",
                             characterEncodingName: "utf-8",
                             baseURL: Self.remoteURL)
            }
        }.resume()
    }
}
