#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod storage;
mod sync;
mod tracker;
mod tray;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

pub struct AppState {
    pub session_manager: Arc<Mutex<tracker::session_manager::SessionManager>>,
    pub local_db: Arc<storage::local_db::LocalDb>,
    pub cloud_sync: Arc<Mutex<sync::cloud_sync::CloudSync>>,
}

fn init_file_logging(data_dir: &std::path::Path) {
    use std::fs::OpenOptions;
    use std::io::Write;

    let log_path = data_dir.join("hesoyam.log");
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path);

    if let Ok(mut f) = file {
        let _ = writeln!(
            f,
            "\n--- Hesoyam Agent started at {} ---",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
        );
    }

    // Set up env_logger to write to file
    let log_path_clone = log_path.clone();
    env_logger::Builder::from_default_env()
        .format(move |_buf, record| {
            use std::io::Write as _;
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path_clone);
            if let Ok(mut f) = file {
                let _ = writeln!(
                    f,
                    "[{}] {} - {}",
                    record.level(),
                    chrono::Local::now().format("%H:%M:%S"),
                    record.args()
                );
            }
            Ok(())
        })
        .filter_level(log::LevelFilter::Info)
        .init();
}

#[tauri::command]
async fn get_tracking_status(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let manager = state.session_manager.lock().await;
    let sessions = manager.get_active_sessions();
    let today_secs = manager.get_today_total_secs();

    Ok(serde_json::json!({
        "active_sessions": sessions.iter().map(|s| serde_json::json!({
            "game_name": s.game_name,
            "started_at": s.started_at.to_rfc3339(),
            "duration_secs": s.duration_secs(),
        })).collect::<Vec<_>>(),
        "today_total_secs": today_secs,
        "is_tracking": !sessions.is_empty(),
    }))
}

#[tauri::command]
async fn pause_tracking(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut manager = state.session_manager.lock().await;
    manager.set_paused(true);
    Ok(())
}

#[tauri::command]
async fn resume_tracking(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut manager = state.session_manager.lock().await;
    manager.set_paused(false);
    Ok(())
}

#[tauri::command]
async fn get_auth_status(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    Ok(state.local_db.get_auth_tokens().map_err(|e| e.to_string())?.is_some())
}

#[tauri::command]
async fn start_auth_flow() -> Result<String, String> {
    auth::browser_auth::start_auth_flow()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sign_out(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.local_db.clear_auth_tokens().map_err(|e| e.to_string())?;
    auth::browser_auth::clear_keyring_tokens();
    Ok(())
}

fn main() {
    // Create app data dir early for logging
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("gg.hesoyam.agent");
    let _ = std::fs::create_dir_all(&data_dir);
    init_file_logging(&data_dir);

    log::info!("Starting Hesoyam Agent v{}", env!("CARGO_PKG_VERSION"));

    // Catch panics and log them
    std::panic::set_hook(Box::new(|info| {
        log::error!("PANIC: {}", info);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the main window if another instance tries to launch
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize local database
            let data_dir = app.path().app_data_dir().map_err(|e| {
                log::error!("Failed to get app data dir: {}", e);
                e
            })?;
            std::fs::create_dir_all(&data_dir).map_err(|e| {
                log::error!("Failed to create data dir: {}", e);
                Box::new(e) as Box<dyn std::error::Error>
            })?;
            let db_path = data_dir.join("hesoyam.db");
            log::info!("Database path: {}", db_path.display());

            let local_db = Arc::new(
                storage::local_db::LocalDb::new(&db_path).map_err(|e| {
                    log::error!("Failed to init local DB: {}", e);
                    Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
                        as Box<dyn std::error::Error>
                })?,
            );
            log::info!("Local database initialized");

            // Initialize cloud sync
            let cloud_sync = Arc::new(Mutex::new(sync::cloud_sync::CloudSync::new(
                local_db.clone(),
            )));

            // Initialize session manager
            let session_manager = Arc::new(Mutex::new(
                tracker::session_manager::SessionManager::new(local_db.clone()),
            ));

            let state = AppState {
                session_manager: session_manager.clone(),
                local_db: local_db.clone(),
                cloud_sync: cloud_sync.clone(),
            };
            app.manage(state);

            // Setup system tray
            log::info!("Setting up system tray...");
            if let Err(e) = tray::menu::setup_tray(&app_handle) {
                log::error!("Failed to setup tray: {}", e);
                // Don't fail the app — tray is nice to have but main window works
            } else {
                log::info!("System tray initialized");
            }

            // Handle main window close — hide to tray instead of quitting
            if let Some(main_window) = app.get_webview_window("main") {
                let w = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }

            log::info!("Setup complete, starting background tasks");

            // Start background tracking loop
            let sm = session_manager.clone();
            let cs = cloud_sync.clone();
            let db = local_db.clone();
            tauri::async_runtime::spawn(async move {
                tracker::session_manager::tracking_loop(sm, cs, db).await;
            });

            // Sync signatures on startup
            let cs2 = cloud_sync.clone();
            tauri::async_runtime::spawn(async move {
                let sync = cs2.lock().await;
                if let Err(e) = sync.sync_signatures().await {
                    log::error!("Failed to sync signatures on startup: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_tracking_status,
            pause_tracking,
            resume_tracking,
            get_auth_status,
            start_auth_flow,
            sign_out,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
