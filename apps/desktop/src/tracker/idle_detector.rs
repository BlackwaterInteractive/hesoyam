use std::time::Duration;

/// Returns the duration since the last user input (keyboard/mouse).
/// On Windows, uses GetLastInputInfo from the Win32 API.
/// On other platforms, returns Duration::ZERO (always active).
pub fn get_idle_duration() -> Duration {
    #[cfg(target_os = "windows")]
    {
        get_idle_duration_windows()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Duration::ZERO
    }
}

#[cfg(target_os = "windows")]
fn get_idle_duration_windows() -> Duration {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };

        if GetLastInputInfo(&mut info) != 0 {
            let tick_count = windows_sys::Win32::System::SystemInformation::GetTickCount();
            let idle_ms = tick_count.wrapping_sub(info.dwTime);
            Duration::from_millis(idle_ms as u64)
        } else {
            Duration::ZERO
        }
    }
}

/// Threshold for considering the user idle (5 minutes).
pub const IDLE_THRESHOLD: Duration = Duration::from_secs(300);

/// Returns true if the user has been idle longer than the threshold.
pub fn is_idle() -> bool {
    get_idle_duration() >= IDLE_THRESHOLD
}
