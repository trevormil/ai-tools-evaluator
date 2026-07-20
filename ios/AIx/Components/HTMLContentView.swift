import SwiftUI
import WebKit

/// Renders server-sanitized HTML (GitHub-rendered READMEs, markdown-it
/// output) at intrinsic height inside SwiftUI scroll views — full GFM:
/// headings, code blocks, tables, task lists, images. Tapped links open in
/// the system browser; the page itself never navigates.
struct HTMLContentView: View {
    let html: String
    var baseURL: URL? = nil
    @State private var height: CGFloat = 60

    var body: some View {
        HTMLWebView(html: html, baseURL: baseURL, height: $height)
            .frame(height: height)
    }
}

private struct HTMLWebView: UIViewRepresentable {
    let html: String
    let baseURL: URL?
    @Binding var height: CGFloat

    func makeCoordinator() -> Coordinator {
        Coordinator(height: $height)
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.loadedHTML != html else { return }
        context.coordinator.loadedHTML = html
        webView.loadHTMLString(Self.template(body: html), baseURL: baseURL)
    }

    /// GitHub-ish typography, light/dark aware, tables scroll horizontally.
    static func template(body: String) -> String {
        """
        <!doctype html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <style>
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
          margin: 0; padding: 0;
          font: -apple-system-body; font-family: -apple-system, system-ui;
          font-size: 15px; line-height: 1.55;
          color: #1c1c1e; background: transparent;
          -webkit-text-size-adjust: 100%; word-wrap: break-word;
        }
        h1, h2, h3, h4 { line-height: 1.25; margin: 1.2em 0 0.5em; }
        h1 { font-size: 1.5em; border-bottom: 1px solid rgba(128,128,128,0.25); padding-bottom: 0.25em; }
        h2 { font-size: 1.25em; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 0.2em; }
        h3 { font-size: 1.1em; }
        p, ul, ol, blockquote { margin: 0 0 0.9em; }
        ul, ol { padding-left: 1.6em; }
        a { color: #2e7ff4; text-decoration: none; }
        img { max-width: 100%; height: auto; border-radius: 8px; }
        code {
          font-family: ui-monospace, Menlo, monospace; font-size: 0.86em;
          background: rgba(128,128,128,0.14); border-radius: 4px; padding: 0.15em 0.35em;
        }
        pre {
          background: rgba(128,128,128,0.12); border-radius: 8px;
          padding: 10px; overflow-x: auto; margin: 0 0 0.9em;
        }
        pre code { background: none; padding: 0; font-size: 0.82em; }
        blockquote {
          border-left: 3px solid rgba(128,128,128,0.35);
          padding-left: 0.9em; color: rgba(120,120,128,0.9);
        }
        table {
          border-collapse: collapse; display: block; overflow-x: auto;
          margin: 0 0 0.9em; max-width: 100%;
        }
        th, td { border: 1px solid rgba(128,128,128,0.3); padding: 5px 10px; }
        th { background: rgba(128,128,128,0.1); }
        hr { border: none; border-top: 1px solid rgba(128,128,128,0.25); margin: 1.2em 0; }
        details summary { cursor: pointer; }
        @media (prefers-color-scheme: dark) {
          body { color: #ececee; }
          a { color: #4a99f7; }
        }
        </style></head><body>\(body)</body></html>
        """
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var loadedHTML: String?
        private let height: Binding<CGFloat>

        init(height: Binding<CGFloat>) {
            self.height = height
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("document.documentElement.scrollHeight") { [height] result, _ in
                if let value = result as? Double, abs(height.wrappedValue - value) > 1 {
                    height.wrappedValue = CGFloat(value)
                }
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            // Content is display-only: user link taps go to the system
            // browser; everything else (the initial load) renders in place.
            if navigationAction.navigationType == .linkActivated {
                if let url = navigationAction.request.url {
                    UIApplication.shared.open(url)
                }
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }
    }
}
