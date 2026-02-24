use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let status_item = MenuItem::with_id(app, "status", "Hesoyam - Idle", false, None::<&str>)?;
    let today_item = MenuItem::with_id(app, "today", "Today: 0h 0m", false, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let pause_item = MenuItem::with_id(app, "pause", "Pause Tracking", true, None::<&str>)?;
    let dashboard_item =
        MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Hesoyam", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &status_item,
            &today_item,
            &separator1,
            &show_item,
            &pause_item,
            &dashboard_item,
            &settings_item,
            &separator2,
            &quit_item,
        ],
    )?;

    let icon = Image::from_bytes(include_bytes!("../../icons/icon.png"))
        .expect("Failed to load tray icon");

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Hesoyam Game Tracker")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "pause" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = app_handle.try_state::<crate::AppState>() {
                        let mut manager = state.session_manager.lock().await;
                        let is_paused = manager.is_paused();
                        manager.set_paused(!is_paused);
                        log::info!(
                            "Tracking {}",
                            if !is_paused { "paused" } else { "resumed" }
                        );
                    }
                });
            }
            "dashboard" => {
                let _ = open::that("https://hesoyam.gg/dashboard");
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
