use sysinfo::System;
use std::collections::HashSet;

/// Scans running processes and returns a set of executable names (lowercase).
pub fn scan_running_processes() -> HashSet<String> {
    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);

    system
        .processes()
        .values()
        .filter_map(|process| {
            process.exe().and_then(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .map(|s| s.to_string())
            })
        })
        .collect()
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
