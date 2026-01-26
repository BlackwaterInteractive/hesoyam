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
