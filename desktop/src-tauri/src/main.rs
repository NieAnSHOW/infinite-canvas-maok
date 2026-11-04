// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The WebView cannot open new windows by itself, so route external links
/// (target=_blank anchors and window.open) to the system default browser
/// through the opener plugin.
const EXTERNAL_LINKS_JS: &str = r#"
(function () {
    if (window.__icExternalLinksPatched) return;
    window.__icExternalLinksPatched = true;
    var openExternal = function (url) {
        url = String(url);
        if (!/^https?:/i.test(url)) return;
        window.__TAURI_INTERNALS__.invoke("plugin:opener|open_url", { url: url }).catch(function () {});
    };
    window.open = function (url) {
        openExternal(url);
        return null;
    };
    document.addEventListener("click", function (event) {
        var anchor = event.target && event.target.closest ? event.target.closest("a[target=_blank]") : null;
        if (anchor) {
            event.preventDefault();
            openExternal(anchor.href);
        }
    }, true);
})();
"#;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_page_load(|webview, payload| {
            if let tauri::webview::PageLoadEvent::Finished = payload.event() {
                let _ = webview.eval(EXTERNAL_LINKS_JS);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
