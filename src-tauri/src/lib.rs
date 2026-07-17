use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    process::Command as SystemCommand,
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex,
    },
    thread,
};
use tauri::{ipc::Channel, AppHandle, Emitter, Manager, RunEvent, State};

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
enum TerminalEvent {
    Output(Vec<u8>),
    Exit,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCreated {
    id: u32,
    cwd: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalRequest {
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DetectedProfile {
    id: &'static str,
    command: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessActivity {
    has_foreground_process: bool,
    foreground_pid: Option<u32>,
    foreground_process: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct NotificationTarget {
    workspace_id: String,
    tab_id: String,
    pane_id: String,
    session_id: String,
}

#[derive(Deserialize)]
struct NativeNotificationRequest {
    title: String,
    body: String,
    target: NotificationTarget,
}

struct TerminalProcess {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    pid: Option<u32>,
}

#[derive(Default)]
struct TerminalManager {
    next_id: AtomicU32,
    processes: Mutex<HashMap<u32, TerminalProcess>>,
}

impl TerminalManager {
    fn close(&self, id: u32) -> Result<(), String> {
        if let Some(mut process) = self
            .processes
            .lock()
            .map_err(|_| "terminal state is unavailable")?
            .remove(&id)
        {
            let _ = process.child.kill();
        }
        Ok(())
    }

    fn close_all(&self) {
        if let Ok(mut processes) = self.processes.lock() {
            for (_, mut process) in processes.drain() {
                let _ = process.child.kill();
            }
        }
    }
}

#[tauri::command]
fn create_terminal(
    request: TerminalRequest,
    on_event: Channel<TerminalEvent>,
    manager: State<'_, TerminalManager>,
) -> Result<TerminalCreated, String> {
    let TerminalRequest {
        command,
        args,
        env,
        cwd,
        cols,
        rows,
    } = request;
    let pair = native_pty_system()
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("unable to create ConPTY: {error}"))?;

    if command.trim().is_empty() {
        return Err("shell profile command cannot be empty".to_string());
    }
    let program = command.clone();
    let mut command = CommandBuilder::new(command);
    command.args(args);
    for (name, value) in env {
        command.env(name, value);
    }
    let cwd = working_directory(cwd.as_deref())?;
    command.cwd(&cwd);
    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("unable to start {program}: {error}"))?;
    drop(pair.slave);
    let pid = child.process_id();

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;
    let id = manager.next_id.fetch_add(1, Ordering::Relaxed);
    manager
        .processes
        .lock()
        .map_err(|_| "terminal state is unavailable")?
        .insert(
            id,
            TerminalProcess {
                master: pair.master,
                writer,
                child,
                pid,
            },
        );

    thread::spawn(move || {
        let mut buffer = [0; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    if on_event
                        .send(TerminalEvent::Output(buffer[..read].to_vec()))
                        .is_err()
                    {
                        break;
                    }
                }
                Err(error) => {
                    let message = format!("\r\n\x1b[31mTerminal read error: {error}\x1b[0m\r\n");
                    let _ = on_event.send(TerminalEvent::Output(message.into_bytes()));
                    break;
                }
            }
        }
        let _ = on_event.send(TerminalEvent::Exit);
    });

    Ok(TerminalCreated {
        id,
        cwd: cwd.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn detect_shell_profiles() -> Vec<DetectedProfile> {
    let mut profiles = Vec::new();
    for (id, executable) in [
        ("powershell", "powershell.exe"),
        ("cmd", "cmd.exe"),
        ("wsl", "wsl.exe"),
    ] {
        if let Some(path) = find_executable(executable) {
            if id != "wsl" || wsl_is_available(&path) {
                profiles.push(DetectedProfile {
                    id,
                    command: path.to_string_lossy().into_owned(),
                });
            }
        }
    }
    if let Some(path) = git_bash() {
        profiles.push(DetectedProfile {
            id: "git-bash",
            command: path.to_string_lossy().into_owned(),
        });
    }
    profiles
}

fn find_executable(name: &str) -> Option<PathBuf> {
    let direct = PathBuf::from(name);
    if direct.is_file() {
        return Some(direct);
    }
    std::env::var_os("PATH")
        .into_iter()
        .flat_map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .map(|directory| directory.join(name))
        .find(|path| path.is_file())
}

fn git_bash() -> Option<PathBuf> {
    [
        std::env::var_os("ProgramFiles").map(PathBuf::from),
        std::env::var_os("ProgramFiles(x86)").map(PathBuf::from),
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from),
    ]
    .into_iter()
    .flatten()
    .flat_map(|base| {
        [
            base.join("Git/bin/bash.exe"),
            base.join("Programs/Git/bin/bash.exe"),
        ]
    })
    .find(|path| path.is_file())
}

#[cfg(windows)]
fn wsl_is_available(path: &std::path::Path) -> bool {
    use std::os::windows::process::CommandExt;
    SystemCommand::new(path)
        .arg("--status")
        .creation_flags(0x0800_0000)
        .status()
        .is_ok_and(|status| status.success())
}

#[cfg(not(windows))]
fn wsl_is_available(_path: &std::path::Path) -> bool {
    false
}

fn working_directory(requested: Option<&str>) -> Result<PathBuf, String> {
    requested
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
        .or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(PathBuf::from)
                .filter(|path| path.is_dir())
        })
        .or_else(|| std::env::current_dir().ok())
        .ok_or_else(|| "unable to find a valid working directory".to_string())
}

#[tauri::command]
fn write_terminal(
    id: u32,
    data: String,
    manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    let mut processes = manager
        .processes
        .lock()
        .map_err(|_| "terminal state is unavailable")?;
    let process = processes
        .get_mut(&id)
        .ok_or("terminal is no longer running")?;
    process
        .writer
        .write_all(data.as_bytes())
        .and_then(|_| process.writer.flush())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn resize_terminal(
    id: u32,
    cols: u16,
    rows: u16,
    manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    let processes = manager
        .processes
        .lock()
        .map_err(|_| "terminal state is unavailable")?;
    let process = processes.get(&id).ok_or("terminal is no longer running")?;
    process
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn close_terminal(id: u32, manager: State<'_, TerminalManager>) -> Result<(), String> {
    manager.close(id)
}

#[tauri::command]
fn terminal_has_foreground_process(
    id: u32,
    manager: State<'_, TerminalManager>,
) -> Result<bool, String> {
    let processes = manager
        .processes
        .lock()
        .map_err(|_| "terminal state is unavailable")?;
    Ok(processes
        .get(&id)
        .and_then(|process| process.pid)
        .and_then(descendant_process)
        .is_some())
}

#[tauri::command]
fn terminal_process_activity(
    id: u32,
    manager: State<'_, TerminalManager>,
) -> Result<ProcessActivity, String> {
    let processes = manager
        .processes
        .lock()
        .map_err(|_| "terminal state is unavailable")?;
    let foreground = processes
        .get(&id)
        .and_then(|process| process.pid)
        .and_then(descendant_process);
    Ok(ProcessActivity {
        has_foreground_process: foreground.is_some(),
        foreground_pid: foreground.as_ref().map(|(pid, _)| *pid),
        foreground_process: foreground.map(|(_, name)| name),
    })
}

#[tauri::command]
fn show_native_notification(
    request: NativeNotificationRequest,
    app: AppHandle,
) -> Result<(), String> {
    if request.title.is_empty()
        || request.title.len() > 120
        || request.body.is_empty()
        || request.body.len() > 200
    {
        return Err("invalid notification content".into());
    }
    let activated_app = app.clone();
    let target = request.target;
    tauri_winrt_notification::Toast::new(&app.config().identifier)
        .title(&request.title)
        .text1(&request.body)
        .on_activated(move |_| {
            if let Some(window) = activated_app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            let _ = activated_app.emit("notification-navigation", &target);
            Ok(())
        })
        .show()
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
fn descendant_process(root_pid: u32) -> Option<(u32, String)> {
    use windows_sys::Win32::{
        Foundation::{CloseHandle, INVALID_HANDLE_VALUE},
        System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
    };
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return None;
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut processes = Vec::new();
        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let length = entry
                    .szExeFile
                    .iter()
                    .position(|character| *character == 0)
                    .unwrap_or(entry.szExeFile.len());
                processes.push((
                    entry.th32ProcessID,
                    entry.th32ParentProcessID,
                    String::from_utf16_lossy(&entry.szExeFile[..length]),
                ));
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snapshot);
        let mut descendants = vec![root_pid];
        for _ in 0..processes.len() {
            let before = descendants.len();
            for (pid, parent, _) in &processes {
                if descendants.contains(parent) && !descendants.contains(pid) {
                    descendants.push(*pid);
                }
            }
            if descendants.len() == before {
                break;
            }
        }
        descendants
            .last()
            .filter(|pid| **pid != root_pid)
            .and_then(|pid| {
                processes
                    .iter()
                    .find(|(candidate, _, _)| candidate == pid)
                    .map(|(_, _, name)| (*pid, name.clone()))
            })
    }
}

#[cfg(not(windows))]
fn descendant_process(_root_pid: u32) -> Option<(u32, String)> {
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(TerminalManager::default())
        .invoke_handler(tauri::generate_handler![
            create_terminal,
            write_terminal,
            resize_terminal,
            close_terminal,
            terminal_has_foreground_process,
            terminal_process_activity,
            show_native_notification,
            detect_shell_profiles
        ])
        .build(tauri::generate_context!())
        .expect("error while building Winmux");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            handle.state::<TerminalManager>().close_all();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{find_executable, native_pty_system, working_directory, CommandBuilder, PtySize};
    use std::{
        io::{Read, Write},
        sync::mpsc,
        thread,
        time::{Duration, Instant},
    };

    #[test]
    fn finds_standard_windows_shells() {
        assert!(find_executable("cmd.exe").is_some());
        assert!(find_executable("powershell.exe").is_some());
    }

    #[test]
    fn missing_working_directory_falls_back() {
        let cwd = working_directory(Some("Z:\\winmux-directory-that-does-not-exist")).unwrap();
        assert!(cwd.is_dir());
    }

    #[cfg(windows)]
    #[test]
    fn conpty_runs_a_windows_command() {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut command = CommandBuilder::new("cmd.exe");
        command.args(["/D", "/C", "echo WINMUX_CONPTY_OK"]);
        let mut child = pair.slave.spawn_command(command).unwrap();
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut writer = pair.master.take_writer().unwrap();
        let (send, receive) = mpsc::channel();
        thread::spawn(move || {
            let mut buffer = [0; 4096];
            while let Ok(read) = reader.read(&mut buffer) {
                if read == 0 || send.send(buffer[..read].to_vec()).is_err() {
                    break;
                }
            }
        });
        let mut output = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(10);
        while !String::from_utf8_lossy(&output).contains("WINMUX_CONPTY_OK") {
            let chunk = receive
                .recv_timeout(deadline.saturating_duration_since(Instant::now()))
                .unwrap();
            output.extend(chunk);
            if output.windows(4).any(|bytes| bytes == b"\x1b[6n") {
                writer.write_all(b"\x1b[1;1R").unwrap();
                writer.flush().unwrap();
            }
        }
        drop(writer);
        child.wait().unwrap();
        drop(pair.master);
        assert!(
            String::from_utf8_lossy(&output).contains("WINMUX_CONPTY_OK"),
            "ConPTY output: {:?}",
            String::from_utf8_lossy(&output)
        );
    }
}
