use std::{
	collections::HashMap,
	path::PathBuf,
	sync::Mutex,
};

use hickory_resolver::{config::*, TokioAsyncResolver};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::{
	menu::{Menu, MenuItem, PredefinedMenuItem},
	tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
	AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

const APP_SERVICE: &str = "com.haven.app";
const WINDOW_STATE_EVENT: &str = "haven://window-state-changed";

#[derive(Default)]
struct AppState {
	window_state_cache: Mutex<Option<WindowState>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowState {
	is_maximized: bool,
	is_full_screen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct DetailedLogPayload {
	scope: String,
	event: String,
	level: Option<String>,
	data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum UpdateChannelCandidate {
	Release,
	Nightly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UpdateSettings {
	candidate: UpdateChannelCandidate,
}

fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
	let path = app
		.path()
		.app_config_dir()
		.map_err(|error| error.to_string())?;
	std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
	Ok(path)
}

fn logs_dir(app: &AppHandle) -> Result<PathBuf, String> {
	let path = app.path().app_log_dir().map_err(|error| error.to_string())?;
	std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
	Ok(path)
}

fn update_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
	Ok(app_config_dir(app)?.join("update-settings.json"))
}

fn detailed_log_path(app: &AppHandle) -> Result<PathBuf, String> {
	Ok(logs_dir(app)?.join("detailed.log"))
}

fn keyring_entry(namespace: &str) -> Result<Entry, String> {
	Entry::new(APP_SERVICE, namespace).map_err(|error| error.to_string())
}

fn sanitize_namespace(value: &str) -> Option<&str> {
	let valid = !value.is_empty()
		&& value.len() <= 64
		&& value
			.chars()
			.all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-');
	valid.then_some(value)
}

fn sanitize_key(value: &str) -> Option<&str> {
	let valid = !value.is_empty()
		&& value.len() <= 128
		&& value.chars().all(|ch| {
			ch.is_ascii_alphanumeric() || matches!(ch, '_' | '.' | ':' | '-')
		});
	valid.then_some(value)
}

fn read_namespace(namespace: &str) -> Result<HashMap<String, String>, String> {
	let entry = keyring_entry(namespace)?;
	match entry.get_password() {
		Ok(payload) => serde_json::from_str::<HashMap<String, String>>(&payload)
			.map_err(|error| error.to_string()),
		Err(_) => Ok(HashMap::new()),
	}
}

fn write_namespace(namespace: &str, document: &HashMap<String, String>) -> Result<(), String> {
	let entry = keyring_entry(namespace)?;
	let payload = serde_json::to_string(document).map_err(|error| error.to_string())?;
	entry
		.set_password(&payload)
		.map_err(|error| error.to_string())
}

fn legacy_electron_dir() -> Option<PathBuf> {
	dirs::config_dir().map(|path| path.join("Haven"))
}

async fn emit_window_state(app: &AppHandle) -> Result<WindowState, String> {
	let window = app
		.get_webview_window("main")
		.ok_or_else(|| "main window unavailable".to_string())?;
	let state = WindowState {
		is_maximized: window.is_maximized().map_err(|error| error.to_string())?,
		is_full_screen: window.is_fullscreen().map_err(|error| error.to_string())?,
	};
	let app_state = app.state::<AppState>();
	if let Ok(mut cache) = app_state.window_state_cache.lock() {
		*cache = Some(state.clone());
	}
	app.emit(WINDOW_STATE_EVENT, &state)
		.map_err(|error| error.to_string())?;
	Ok(state)
}

fn restore_main_window(app: &AppHandle) {
	if let Some(window) = app.get_webview_window("main") {
		let _ = window.show();
		let _ = window.unminimize();
		let _ = window.set_focus();
	}
}

fn setup_tray(app: &AppHandle) -> Result<(), tauri::Error> {
	let open = MenuItem::with_id(app, "open", "Haven öffnen", true, None::<&str>)?;
	let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
	let separator = PredefinedMenuItem::separator(app)?;
	let menu = Menu::with_items(app, &[&open, &separator, &quit])?;

	let icon = app.default_window_icon().cloned();

	let mut builder = TrayIconBuilder::new().menu(&menu);
	if let Some(icon) = icon {
		builder = builder.icon(icon);
	}

	builder
		.on_menu_event(|app, event| match event.id().as_ref() {
			"open" => restore_main_window(app),
			"quit" => app.exit(0),
			_ => {}
		})
		.on_tray_icon_event(|tray, event| {
			if let TrayIconEvent::Click {
				button: MouseButton::Left,
				button_state: MouseButtonState::Up,
				..
			} = event
			{
				restore_main_window(&tray.app_handle());
			}
		})
		.build(app)?;

	Ok(())
}

#[tauri::command]
async fn minimize_window(app: AppHandle) -> Result<(), String> {
	let window = app
		.get_webview_window("main")
		.ok_or_else(|| "main window unavailable".to_string())?;
	window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
async fn toggle_maximize_window(app: AppHandle) -> Result<(), String> {
	let window = app
		.get_webview_window("main")
		.ok_or_else(|| "main window unavailable".to_string())?;

	if window.is_maximized().map_err(|error| error.to_string())? {
		window.unmaximize().map_err(|error| error.to_string())?;
	} else {
		window.maximize().map_err(|error| error.to_string())?;
	}

	emit_window_state(&app).await?;
	Ok(())
}

#[tauri::command]
async fn close_window(app: AppHandle) -> Result<(), String> {
	let window = app
		.get_webview_window("main")
		.ok_or_else(|| "main window unavailable".to_string())?;
	window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_window_state(app: AppHandle) -> Result<WindowState, String> {
	emit_window_state(&app).await
}

#[tauri::command]
async fn write_detailed_log(app: AppHandle, payload: DetailedLogPayload) -> Result<bool, String> {
	let line = serde_json::json!({
		"timestamp": chrono_like_timestamp(),
		"scope": payload.scope,
		"event": payload.event,
		"level": payload.level.unwrap_or_else(|| "info".to_string()),
		"data": payload.data.unwrap_or(serde_json::Value::Object(Default::default())),
	});
	let path = detailed_log_path(&app)?;
	let mut file = tokio::fs::OpenOptions::new()
		.create(true)
		.append(true)
		.open(path)
		.await
		.map_err(|error| error.to_string())?;
	use tokio::io::AsyncWriteExt;
	file.write_all(format!("{}\n", line).as_bytes())
		.await
		.map_err(|error| error.to_string())?;
	Ok(true)
}

fn chrono_like_timestamp() -> String {
	use std::time::{SystemTime, UNIX_EPOCH};
	let duration = SystemTime::now()
		.duration_since(UNIX_EPOCH)
		.unwrap_or_default();
	format!("{}", duration.as_secs())
}

#[tauri::command]
async fn secure_store_set(namespace: String, key: String, value: String) -> Result<bool, String> {
	let namespace = sanitize_namespace(&namespace).ok_or_else(|| "invalid namespace".to_string())?;
	let key = sanitize_key(&key).ok_or_else(|| "invalid key".to_string())?;
	if value.len() > 8192 {
		return Ok(false);
	}

	let mut document = read_namespace(namespace)?;
	document.insert(key.to_string(), value);
	write_namespace(namespace, &document)?;
	Ok(true)
}

#[tauri::command]
async fn secure_store_get(namespace: String, key: String) -> Result<Option<String>, String> {
	let namespace = sanitize_namespace(&namespace).ok_or_else(|| "invalid namespace".to_string())?;
	let key = sanitize_key(&key).ok_or_else(|| "invalid key".to_string())?;
	let document = read_namespace(namespace)?;
	Ok(document.get(key).cloned())
}

#[tauri::command]
async fn secure_store_delete(namespace: String, key: String) -> Result<bool, String> {
	let namespace = sanitize_namespace(&namespace).ok_or_else(|| "invalid namespace".to_string())?;
	let key = sanitize_key(&key).ok_or_else(|| "invalid key".to_string())?;
	let mut document = read_namespace(namespace)?;
	document.remove(key);
	write_namespace(namespace, &document)?;
	Ok(true)
}

#[tauri::command]
async fn store_token(token: String) -> Result<bool, String> {
	let entry = keyring_entry("auth.legacy")?;
	entry
		.set_password(&token)
		.map_err(|error| error.to_string())?;
	Ok(true)
}

#[tauri::command]
async fn load_token() -> Result<Option<String>, String> {
	let entry = keyring_entry("auth.legacy")?;
	match entry.get_password() {
		Ok(token) => Ok(Some(token)),
		Err(_) => Ok(None),
	}
}

#[tauri::command]
async fn delete_token() -> Result<bool, String> {
	let entry = keyring_entry("auth.legacy")?;
	let _ = entry.delete_credential();
	Ok(true)
}

#[tauri::command]
async fn validate_email_domain(domain: String) -> Result<bool, String> {
	let normalized = domain.trim().to_ascii_lowercase();
	if normalized.is_empty() || normalized.len() > 253 {
		return Ok(false);
	}

	let resolver =
		TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());

	if let Ok(mx) = resolver.mx_lookup(normalized.clone()).await {
		if mx.iter().next().is_some() {
			return Ok(true);
		}
	}

	let has_ip = resolver
		.lookup_ip(normalized)
		.await
		.map(|lookup| lookup.iter().next().is_some())
		.unwrap_or(false);

	Ok(has_ip)
}

#[tauri::command]
async fn open_external_url(app: AppHandle, url: String) -> Result<bool, String> {
	if !(url.starts_with("https://") || url.starts_with("http://")) {
		return Ok(false);
	}

	app.opener()
		.open_url(url, None::<&str>)
		.map_err(|error| error.to_string())?;
	Ok(true)
}

#[tauri::command]
async fn get_update_candidate(app: AppHandle) -> Result<Option<UpdateChannelCandidate>, String> {
	let path = update_settings_path(&app)?;
	match tokio::fs::read_to_string(path).await {
		Ok(payload) => {
			let parsed: UpdateSettings =
				serde_json::from_str(&payload).map_err(|error| error.to_string())?;
			Ok(Some(parsed.candidate))
		}
		Err(_) => Ok(Some(UpdateChannelCandidate::Nightly)),
	}
}

#[tauri::command]
async fn set_update_candidate(
	app: AppHandle,
	candidate: UpdateChannelCandidate,
) -> Result<bool, String> {
	let payload = serde_json::to_string_pretty(&UpdateSettings { candidate })
		.map_err(|error| error.to_string())?;
	let path = update_settings_path(&app)?;
	tokio::fs::write(path, payload)
		.await
		.map_err(|error| error.to_string())?;
	Ok(true)
}

#[tauri::command]
async fn migrate_legacy_state(app: AppHandle) -> Result<bool, String> {
	let Some(legacy_dir) = legacy_electron_dir() else {
		return Ok(false);
	};

	let legacy_update_settings = legacy_dir.join("update-settings.json");
	if !legacy_update_settings.exists() {
		return Ok(false);
	}

	let current_path = update_settings_path(&app)?;
	if current_path.exists() {
		return Ok(false);
	}

	let payload = tokio::fs::read_to_string(legacy_update_settings)
		.await
		.map_err(|error| error.to_string())?;
	tokio::fs::write(current_path, payload)
		.await
		.map_err(|error| error.to_string())?;
	Ok(true)
}

fn register_window_events(app: &AppHandle) {
	if let Some(window) = app.get_webview_window("main") {
		let window_for_events = window.clone();
		let app_handle = app.clone();
		window.on_window_event(move |event| match event {
			WindowEvent::CloseRequested { api, .. } => {
				api.prevent_close();
				let _ = window_for_events.hide();
			}
			WindowEvent::Focused(_)
			| WindowEvent::Resized(_)
			| WindowEvent::Moved(_)
			| WindowEvent::ScaleFactorChanged { .. }
			| WindowEvent::ThemeChanged(_) => {
				let app = app_handle.clone();
				tauri::async_runtime::spawn(async move {
					let _ = emit_window_state(&app).await;
				});
			}
			_ => {}
		});
	}
}

pub fn run() {
	tauri::Builder::default()
		.manage(AppState::default())
		.plugin(tauri_plugin_opener::init())
		.plugin(tauri_plugin_window_state::Builder::new().build())
		.invoke_handler(tauri::generate_handler![
			minimize_window,
			toggle_maximize_window,
			close_window,
			get_window_state,
			write_detailed_log,
			secure_store_set,
			secure_store_get,
			secure_store_delete,
			store_token,
			load_token,
			delete_token,
			validate_email_domain,
			open_external_url,
			get_update_candidate,
			set_update_candidate,
			migrate_legacy_state,
		])
		.setup(|app| {
			setup_tray(app.handle())?;
			register_window_events(app.handle());
			restore_main_window(app.handle());
			tauri::async_runtime::spawn({
				let app = app.handle().clone();
				async move {
					let _ = emit_window_state(&app).await;
				}
			});
			Ok(())
		})
		.run(tauri::generate_context!())
		.expect("error while running Haven Tauri application");
}
