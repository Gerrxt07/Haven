use serde::Serialize;
use tauri::{Emitter, Manager, WindowEvent};
use url::Url;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WindowState {
    is_maximized: bool,
    is_full_screen: bool,
}

fn get_window_state_payload(window: &tauri::WebviewWindow) -> WindowState {
    WindowState {
        is_maximized: window.is_maximized().unwrap_or(false),
        is_full_screen: window.is_fullscreen().unwrap_or(false),
    }
}

fn is_safe_external_http_url(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

fn is_trusted_app_url(url: &Url) -> bool {
    if url.scheme() == "tauri" || url.scheme() == "file" {
        return true;
    }

    let is_localhost = matches!(url.host_str(), Some("localhost") | Some("127.0.0.1"));
    is_localhost && url.port_or_known_default() == Some(1420)
}

#[tauri::command]
fn get_window_state(window: tauri::WebviewWindow) -> WindowState {
    get_window_state_payload(&window)
}

#[tauri::command]
fn confirm_open_url(url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "invalid URL".to_string())?;
    if !is_safe_external_http_url(&parsed) {
        return Err("blocked URL protocol".to_string());
    }

    webbrowser::open(parsed.as_str())
        .map(|_| ())
        .map_err(|err| format!("failed to open URL: {err}"))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            let window = app_handle
                .get_webview_window("main")
                .ok_or("main window not found")?;

            window.on_navigation(move |url| {
                if is_trusted_app_url(&url) {
                    return true;
                }

                if is_safe_external_http_url(&url) {
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.emit("show-external-link-warning", url.to_string());
                    }
                }

                false
            });

            let _ = window.emit("window-state-changed", get_window_state_payload(&window));

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Resized(_) = event {
                if let Some(webview_window) = window.app_handle().get_webview_window("main") {
                    let _ = webview_window
                        .emit("window-state-changed", get_window_state_payload(&webview_window));
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_window_state, confirm_open_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
