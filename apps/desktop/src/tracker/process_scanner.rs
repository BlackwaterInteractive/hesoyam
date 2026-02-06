use sysinfo::System;
use std::collections::HashSet;

/// A candidate game process: running from a game directory with a visible window title.
#[derive(Debug, Clone)]
pub struct GameCandidate {
    pub pid: u32,
    pub exe_name: String,
    pub exe_path: String,
    pub window_title: String,
}

/// Scans processes running from known game directories and reads their window titles.
/// Returns only processes that have a visible window with a non-empty title.
pub fn scan_game_candidates() -> Vec<GameCandidate> {
    #[cfg(target_os = "windows")]
    {
        scan_game_candidates_windows()
    }

    #[cfg(not(target_os = "windows"))]
    {
        vec![]
    }
}

#[cfg(target_os = "windows")]
fn scan_game_candidates_windows() -> Vec<GameCandidate> {
    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let mut candidates = Vec::new();
    let mut seen_pids = HashSet::new();

    for process in system.processes().values() {
        let exe_path = match process.exe() {
            Some(path) => path.to_string_lossy().to_string(),
            None => continue,
        };

        if !is_game_directory(&exe_path) {
            continue;
        }

        let pid = process.pid().as_u32();
        if !seen_pids.insert(pid) {
            continue;
        }

        let exe_name = process
            .exe()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();

        // Get window title for this process via Win32 API
        if let Some(window_title) = win32_window::get_window_title_for_pid(pid) {
            if !window_title.is_empty() {
                candidates.push(GameCandidate {
                    pid,
                    exe_name,
                    exe_path,
                    window_title,
                });
            }
        }
    }

    candidates
}

/// Win32 API helpers for reading window titles.
#[cfg(target_os = "windows")]
mod win32_window {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
        IsWindowVisible,
    };

    struct WindowSearch {
        target_pid: u32,
        best_title: Option<String>,
        best_len: usize,
    }

    unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam as *mut WindowSearch);

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        if pid != state.target_pid {
            return 1; // continue
        }

        if IsWindowVisible(hwnd) == 0 {
            return 1; // continue
        }

        let text_len = GetWindowTextLengthW(hwnd);
        if text_len == 0 {
            return 1; // continue
        }

        let mut buf: Vec<u16> = vec![0; (text_len + 1) as usize];
        let read = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if read > 0 {
            let title = String::from_utf16_lossy(&buf[..read as usize]);
            // Keep the longest title (most likely the main game window)
            if title.len() > state.best_len {
                state.best_len = title.len();
                state.best_title = Some(title);
            }
        }

        1 // continue to check all windows
    }

    pub fn get_window_title_for_pid(pid: u32) -> Option<String> {
        let mut state = WindowSearch {
            target_pid: pid,
            best_title: None,
            best_len: 0,
        };

        unsafe {
            EnumWindows(Some(enum_callback), &mut state as *mut _ as LPARAM);
        }

        state.best_title
    }
}

/// Check if a process path is inside a known game directory.
pub fn is_game_directory(exe_path: &str) -> bool {
    let game_dirs = [
        r"C:\Program Files (x86)\Steam\steamapps\common",
        r"C:\Program Files\Steam\steamapps\common",
        r"C:\Program Files\Epic Games",
        r"C:\Program Files (x86)\Epic Games",
        r"C:\XboxGames",
        r"C:\Program Files\WindowsApps",
        r"C:\Program Files (x86)\Riot Games",
        r"C:\Riot Games",
        r"C:\Program Files (x86)\Battle.net",
        r"C:\Program Files (x86)\Blizzard",
        r"C:\Program Files\EA Games",
        r"C:\Program Files (x86)\Origin Games",
        r"C:\Program Files (x86)\Ubisoft",
        r"C:\Program Files\GOG Galaxy\Games",
    ];

    let path_lower = exe_path.to_lowercase();
    game_dirs
        .iter()
        .any(|dir| path_lower.starts_with(&dir.to_lowercase()))
}

/// System processes to exclude from the user-facing process list.
const SYSTEM_PROCESS_EXCLUSIONS: &[&str] = &[
    "svchost.exe", "explorer.exe", "csrss.exe", "dwm.exe", "wininit.exe",
    "winlogon.exe", "services.exe", "lsass.exe", "smss.exe", "conhost.exe",
    "taskhostw.exe", "sihost.exe", "fontdrvhost.exe", "ctfmon.exe",
    "dllhost.exe", "spoolsv.exe", "searchindexer.exe", "securityhealthservice.exe",
    "sgrmbroker.exe", "runtimebroker.exe", "applicationframehost.exe",
    "systemsettings.exe", "textinputhost.exe", "startmenuexperiencehost.exe",
    "shellexperiencehost.exe", "lockapp.exe", "searchapp.exe",
    "searchhost.exe", "widgetservice.exe", "widgets.exe",
    "system", "idle", "registry", "memory compression",
    "audiodg.exe", "msdtc.exe", "mqsvc.exe", "wuauserv.exe",
    "tauri", "hesoyam", "hesoyam.exe", "hesoyam-agent.exe",
    // macOS system processes
    "kernel_task", "launchd", "windowserver", "loginwindow", "dock",
    "finder", "systempolicyd", "mds", "mds_stores", "mdworker",
    "coreaudiod", "coreduetd", "corespeechd", "trustd", "opendirectoryd",
    "cfprefsd", "distnoted", "notifyd", "usernoted", "logd",
    "runningboardd", "dasd", "powerd", "thermald",
];

/// Process info for the user-facing process list.
#[derive(Debug, Clone)]
pub struct UserProcess {
    pub name: String,
    pub exe_path: String,
}

/// Returns user-facing processes, filtering out system processes.
pub fn get_user_processes() -> Vec<UserProcess> {
    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let exclusions: HashSet<String> = SYSTEM_PROCESS_EXCLUSIONS
        .iter()
        .map(|s| s.to_lowercase())
        .collect();

    let mut seen = HashSet::new();
    let mut processes = Vec::new();

    for process in system.processes().values() {
        let name = match process.exe().and_then(|p| p.file_name()).and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let name_lower = name.to_lowercase();

        // Skip system processes
        if exclusions.contains(&name_lower) {
            continue;
        }

        // Skip duplicates
        if !seen.insert(name_lower) {
            continue;
        }

        let exe_path = process
            .exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        processes.push(UserProcess { name, exe_path });
    }

    processes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    processes
}
