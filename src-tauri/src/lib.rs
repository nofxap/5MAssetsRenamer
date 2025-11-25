use std::process::{Command, Stdio};
use std::path::{Path, PathBuf};
use std::io::Read as _;
use std::io::BufRead as _;
use std::fs;
use std::io::Write;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use tauri::Emitter;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CliConfig {
    input_path: String,
    output_path: Option<String>,
    find_text: String,
    replace_text: Option<String>,
    prefix: Option<String>,
    suffix: Option<String>,
    mode: String,
    code_walker_path: Option<String>,
}

#[derive(serde::Serialize)]
struct CliSummary {
    total_files: u32,
    processed_files: u32,
    renamed_files: u32,
    replaced_strings: u32,
    repacked: u32,
    failed: u32,
}

#[derive(serde::Serialize)]
struct CliRunResult {
    status_code: i32,
    stdout: String,
    stderr: String,
    summary: Option<CliSummary>,
}

#[tauri::command]
async fn run_codewalker_cli(config: CliConfig) -> Result<CliRunResult, String> {
    let exe = match config.code_walker_path {
        Some(p) => {
            if Path::new(&p).exists() { p } else { return Err(format!("CodeWalkerCLI not found at path: {}", p)); }
        }
        None => {
            let install = cli_install_path();
            if install.exists() { install.to_string_lossy().to_string() } else {
                let mut candidates: Vec<PathBuf> = Vec::new();
                if let Ok(curr_exe) = std::env::current_exe() {
                    if let Some(parent) = curr_exe.parent() { candidates.push(parent.join("CodeWalkerCLI.exe")); }
                }
                if let Ok(cwd) = std::env::current_dir() {
                    candidates.push(cwd.join("CodeWalkerCLI.exe"));
                    candidates.push(cwd.join("..").join("CodeWalkerCLI.exe"));
                }
                let found = candidates.into_iter().find(|p| p.exists());
                if let Some(p) = found { p.to_string_lossy().to_string() } else { return Err("CodeWalkerCLI.exe not found".to_string()); }
            }
        }
    };

    let mut cmd = Command::new(exe);

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());

    cmd.arg(&config.input_path);

    if let Some(out) = config.output_path.as_ref() {
        if !out.is_empty() {
            cmd.arg(out);
        }
    }

    cmd.arg("-f").arg(&config.find_text);

    match config.mode.as_str() {
        "replace" => {
            if let Some(r) = config.replace_text.as_ref() {
                cmd.arg("-r").arg(r);
            } else {
                return Err("replaceText is required for replace mode".to_string());
            }
        }
        "prefix" => {
            if let Some(p) = config.prefix.as_ref() {
                cmd.arg("-p").arg(p);
            } else {
                return Err("prefix is required for prefix mode".to_string());
            }
        }
        "suffix" => {
            if let Some(s) = config.suffix.as_ref() {
                cmd.arg("-s").arg(s);
            } else {
                return Err("suffix is required for suffix mode".to_string());
            }
        }
        _ => {}
    }

    let output = cmd.output().map_err(|e| e.to_string())?;

    // this works wonders for a CLI bridge! exactly how I want it to work.
    fn parse_summary(s: &str) -> Option<CliSummary> {
        fn first_int(x: &str) -> Option<u32> {
            let mut n = String::new();
            for ch in x.chars() {
                if ch.is_ascii_digit() { n.push(ch) } else if !n.is_empty() { break }
            }
            if n.is_empty() { None } else { n.parse().ok() }
        }
        let mut total_files: Option<u32> = None;
        let mut processed_files: Option<u32> = None;
        let mut renamed_files: Option<u32> = None;
        let mut replaced_strings: Option<u32> = None;
        let mut repacked: Option<u32> = None;
        let mut failed: Option<u32> = None;
        for line in s.lines() {
            let l = line.trim();
            if l.contains("Found") && l.contains("total files") { total_files = first_int(l); }
            if l.starts_with("Total Files:") { total_files = first_int(l); }
            if l.starts_with("Processed Files:") { processed_files = first_int(l); }
            if l.contains("Renamed") && l.contains("files") { renamed_files = first_int(l); }
            if l.starts_with("Renamed Files:") { renamed_files = first_int(l); }
            if l.starts_with("Replaced Strings:") { replaced_strings = first_int(l); }
            if l.starts_with("Repacked:") && l.contains("Failed:") {
                let parts: Vec<&str> = l.split('|').collect();
                if let Some(a) = parts.get(0) { repacked = first_int(a.trim()); }
                if let Some(b) = parts.get(1) { failed = first_int(b.trim()); }
            }
        }
        Some(CliSummary {
            total_files: total_files.unwrap_or(0),
            processed_files: processed_files.unwrap_or(0),
            renamed_files: renamed_files.unwrap_or(0),
            replaced_strings: replaced_strings.unwrap_or(0),
            repacked: repacked.unwrap_or(0),
            failed: failed.unwrap_or(0),
        })
    }

    let res = CliRunResult {
        status_code: output.status.code().unwrap_or_default(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        summary: parse_summary(&String::from_utf8_lossy(&output.stdout)),
    };

    Ok(res)
}

#[tauri::command]
async fn run_codewalker_cli_stream(window: tauri::Window, config: CliConfig) -> Result<CliRunResult, String> {
    let exe = match config.code_walker_path {
        Some(p) => {
            if Path::new(&p).exists() { p } else { return Err(format!("CodeWalkerCLI not found at path: {}", p)); }
        }
        None => {
            let install = cli_install_path();
            if install.exists() { install.to_string_lossy().to_string() } else {
                let mut candidates: Vec<PathBuf> = Vec::new();
                if let Ok(curr_exe) = std::env::current_exe() {
                    if let Some(parent) = curr_exe.parent() { candidates.push(parent.join("CodeWalkerCLI.exe")); }
                }
                if let Ok(cwd) = std::env::current_dir() {
                    candidates.push(cwd.join("CodeWalkerCLI.exe"));
                    candidates.push(cwd.join("..").join("CodeWalkerCLI.exe"));
                }
                let found = candidates.into_iter().find(|p| p.exists());
                if let Some(p) = found { p.to_string_lossy().to_string() } else { return Err("CodeWalkerCLI.exe not found".to_string()); }
            }
        }
    };

    let mut cmd = Command::new(exe);

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());

    cmd.arg(&config.input_path);

    if let Some(out) = config.output_path.as_ref() {
        if !out.is_empty() { cmd.arg(out); }
    }

    cmd.arg("-f").arg(&config.find_text);

    match config.mode.as_str() {
        "replace" => {
            if let Some(r) = config.replace_text.as_ref() { cmd.arg("-r").arg(r); } else { return Err("replaceText is required for replace mode".to_string()); }
        }
        "prefix" => {
            if let Some(p) = config.prefix.as_ref() { cmd.arg("-p").arg(p); } else { return Err("prefix is required for prefix mode".to_string()); }
        }
        "suffix" => {
            if let Some(s) = config.suffix.as_ref() { cmd.arg("-s").arg(s); } else { return Err("suffix is required for suffix mode".to_string()); }
        }
        _ => {}
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let mut stdout_buf = String::new();
    let mut stderr_buf = String::new();
    if let Some(out) = child.stdout.take() {
        std::thread::spawn({
            let mut reader = std::io::BufReader::new(out);
            let mut line = String::new();
            let win = window.clone();
            move || {
                loop {
                    line.clear();
                    let n = reader.read_line(&mut line).unwrap_or(0);
                    if n == 0 { break; }
                    let s = line.replace("\r", "").replace("\n", "\n");
                    let _ = win.emit("cli-log", s.clone());
                }
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let mut reader = std::io::BufReader::new(err);
        let mut buf = Vec::new();
        let _ = reader.read_to_end(&mut buf);
        stderr_buf = String::from_utf8_lossy(&buf).to_string();
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let res = CliRunResult {
        status_code: status.code().unwrap_or_default(),
        stdout: stdout_buf,
        stderr: stderr_buf,
        summary: None,
    };
    Ok(res)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![run_codewalker_cli, run_codewalker_cli_stream, perform_update, fetch_changelog, fetch_latest_release, perform_update_zip, open_folder_dialog, check_cli_dependencies, fetch_dependencies_from_zip, open_url, open_folder, post_action, close_app, check_cli_installed, fetch_release_by_tag, download_cli, ensure_cli_installed])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateRequest {
    remote_version: String,
    cli_url: String,
    ui_url: Option<String>,
}

#[derive(serde::Serialize)]
struct UpdateResult {
    ok: bool,
    message: String,
    cli_path: Option<String>,
    ui_path: Option<String>,
}

#[tauri::command]
async fn perform_update(req: UpdateRequest) -> Result<UpdateResult, String> {
    let exe_dir = std::env::current_exe().map_err(|e| e.to_string())?.parent().unwrap().to_path_buf();

    let cli_tmp = exe_dir.join("CodeWalkerCLI.exe.download");
    let cli_target = exe_dir.join("CodeWalkerCLI.exe");
    let client = reqwest::Client::new();
    let resp = client.get(&req.cli_url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Err("CLI download failed".to_string()); }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    {
        let mut f = fs::File::create(&cli_tmp).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
    }
    if cli_target.exists() { let _ = fs::rename(&cli_target, exe_dir.join("CodeWalkerCLI.exe.bak")); }
    fs::rename(&cli_tmp, &cli_target).map_err(|e| e.to_string())?;

    let mut ui_saved: Option<String> = None;
    if let Some(url) = req.ui_url.as_ref() {
        let resp2 = client.get(url).send().await.map_err(|e| e.to_string())?;
        if resp2.status().is_success() {
            let bytes2 = resp2.bytes().await.map_err(|e| e.to_string())?;
            let updates_dir = exe_dir.join("updates");
            let _ = fs::create_dir_all(&updates_dir);
            let ui_file = updates_dir.join("ui.package");
            let mut f2 = fs::File::create(&ui_file).map_err(|e| e.to_string())?;
            f2.write_all(&bytes2).map_err(|e| e.to_string())?;
            ui_saved = Some(ui_file.to_string_lossy().to_string());
        }
    }

    Ok(UpdateResult { ok: true, message: "Updated".to_string(), cli_path: Some(cli_target.to_string_lossy().to_string()), ui_path: ui_saved })
}

// A message from noFXAP: For the idiots who want to talk bullshit about anything because they see remote calls,
// please just read the source code. It's like 100 lines of Rust.

// it's the fucking GitHub API.

#[tauri::command]
async fn fetch_changelog(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Err(format!("status {}", resp.status())); }
    let text = resp.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn fetch_latest_release(owner: String, repo: String, token: Option<String>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/repos/{}/{}/releases/latest", owner, repo);
    let mut req = client.get(url).header("User-Agent", "5MAssetsRenamer").header("Accept", "application/vnd.github+json");
    if let Some(t) = token.as_ref() { if !t.is_empty() { req = req.header("Authorization", format!("Bearer {}", t)); } }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Err(format!("status {}", resp.status())); }
    let text = resp.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ZipUpdateRequest {
    zip_url: String,
}

#[tauri::command]
async fn perform_update_zip(req: ZipUpdateRequest) -> Result<UpdateResult, String> {
    use std::io::Read;
    let exe_dir = std::env::current_exe().map_err(|e| e.to_string())?.parent().unwrap().to_path_buf();
    let updates_dir = exe_dir.join("updates");
    let _ = fs::create_dir_all(&updates_dir);
    let zip_file = updates_dir.join("update.zip");
    let client = reqwest::Client::new();
    let resp = client.get(&req.zip_url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Err(format!("status {}", resp.status())); }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    {
        let mut f = fs::File::create(&zip_file).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
    }
    let f = fs::File::open(&zip_file).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(f).map_err(|e| e.to_string())?;
    let extract_dir = updates_dir.join("extracted");
    let _ = fs::remove_dir_all(&extract_dir);
    let _ = fs::create_dir_all(&extract_dir);
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        if file.is_dir() {
            let p = extract_dir.join(name);
            let _ = fs::create_dir_all(&p);
            continue;
        }
        let mut out = Vec::new();
        file.read_to_end(&mut out).map_err(|e| e.to_string())?;
        let p = extract_dir.join(name);
        if let Some(parent) = p.parent() { let _ = fs::create_dir_all(parent); }
        let mut of = fs::File::create(&p).map_err(|e| e.to_string())?;
        of.write_all(&out).map_err(|e| e.to_string())?;
    }
    let mut cli_path: Option<String> = None;
    let mut ui_path: Option<String> = None;
    for entry in walk_dir(&extract_dir) {
        let src = entry;
        if src.is_dir() { continue; }
        let fname = src.file_name().unwrap().to_string_lossy().to_string();
        let dst = exe_dir.join(&fname);
        if fname.eq_ignore_ascii_case("assets-renamer.exe") {
            let dst_new = exe_dir.join("assets-renamer.exe.new");
            let _ = fs::remove_file(&dst_new);
            fs::copy(&src, &dst_new).map_err(|e| e.to_string())?;
            ui_path = Some(dst_new.to_string_lossy().to_string());
            continue;
        }
        if fname.eq_ignore_ascii_case("CodeWalkerCLI.exe") {
            cli_path = Some(dst.to_string_lossy().to_string());
        }
        if dst.exists() { let _ = fs::remove_file(&dst); }
        fs::copy(&src, &dst).map_err(|e| e.to_string())?;
    }
    let script = updates_dir.join("apply_update.bat");
    let mut s = String::new();
    s.push_str("@echo off\r\n");
    s.push_str(&format!("set d=\"{}\"\r\n", exe_dir.to_string_lossy()));
    s.push_str("set upd=%d%\\updates\r\n");
    s.push_str("set ext=%upd%\\extracted\r\n");
    s.push_str("set zip=%upd%\\update.zip\r\n");
    s.push_str("set old=%d%\\assets-renamer.exe\r\n");
    s.push_str("set new=%d%\\assets-renamer.exe.new\r\n");
    s.push_str(":loop\r\n");
    s.push_str("move /Y \"%new%\" \"%old%\" >nul 2>&1\r\n");
    s.push_str("if errorlevel 1 ( timeout /t 1 /nobreak >nul & goto loop )\r\n");
    s.push_str("rmdir /S /Q \"%ext%\" >nul 2>&1\r\n");
    s.push_str("del \"%zip%\" >nul 2>&1\r\n");
    s.push_str("start \"\" \"%old%\"\r\n");
    s.push_str("del \"%~f0\"\r\n");
    {
        let mut f = fs::File::create(&script).map_err(|e| e.to_string())?;
        f.write_all(s.as_bytes()).map_err(|e| e.to_string())?;
    }
    let mut cmd = Command::new("cmd");
    #[cfg(windows)]
    { const CREATE_NO_WINDOW: u32 = 0x08000000; cmd.creation_flags(CREATE_NO_WINDOW); }
    cmd.arg("/C").arg(script.to_string_lossy().to_string());
    let _ = cmd.spawn();
    Ok(UpdateResult { ok: true, message: "Updated".to_string(), cli_path, ui_path })
}

// Thanks for hearing this message from noFXAP, all love <3

fn walk_dir(p: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut v = Vec::new();
    let mut s = vec![p.to_path_buf()];
    while let Some(d) = s.pop() {
        if let Ok(rd) = fs::read_dir(&d) {
            for e in rd.flatten() {
                let path = e.path();
                if path.is_dir() { s.push(path); } else { v.push(path); }
            }
        }
    }
    v
}

#[tauri::command]
async fn open_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new().pick_folder();
    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
async fn open_url(url: String) -> Result<bool, String> {
    let mut cmd = Command::new("cmd");
    #[cfg(windows)]
    { const CREATE_NO_WINDOW: u32 = 0x08000000; cmd.creation_flags(CREATE_NO_WINDOW); }
    cmd.arg("/C").arg("start").arg("").arg(&url);
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn open_folder(path: String) -> Result<bool, String> {
    let mut cmd = Command::new("explorer");
    #[cfg(windows)]
    { const CREATE_NO_WINDOW: u32 = 0x08000000; cmd.creation_flags(CREATE_NO_WINDOW); }
    cmd.arg(path);
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(true)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PostActionReq {
    action: String,
    cmdline: Option<String>,
}

#[tauri::command]
async fn post_action(req: PostActionReq) -> Result<bool, String> {
    let a = req.action.to_lowercase();
    if a == "shutdown" {
        let mut cmd = Command::new("cmd");
        #[cfg(windows)]
        { const CREATE_NO_WINDOW: u32 = 0x08000000; cmd.creation_flags(CREATE_NO_WINDOW); }
        cmd.arg("/C").arg("shutdown").arg("/s").arg("/t").arg("0");
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(true);
    }
    if a == "restart" {
        let mut cmd = Command::new("cmd");
        #[cfg(windows)]
        { const CREATE_NO_WINDOW: u32 = 0x08000000; cmd.creation_flags(CREATE_NO_WINDOW); }
        cmd.arg("/C").arg("shutdown").arg("/r").arg("/t").arg("0");
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(true);
    }
    if a == "run_cmd" {
        let s = req.cmdline.unwrap_or_default();
        if s.trim().is_empty() { return Err("empty".to_string()); }
        let mut cmd = Command::new("cmd");
        #[cfg(windows)]
        { const CREATE_NO_WINDOW: u32 = 0x08000000; cmd.creation_flags(CREATE_NO_WINDOW); }
        cmd.arg("/C").arg(s);
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
async fn close_app(app: tauri::AppHandle) -> Result<bool, String> {
    app.exit(0);
    Ok(true)
}

#[derive(serde::Serialize)]
struct DependenciesStatus {
    cli: bool,
    cw_core: bool,
    sharpdx: bool,
    sharpdx_math: bool,
}

#[tauri::command]
async fn check_cli_dependencies() -> Result<DependenciesStatus, String> {
    let cli = cli_install_path().exists();
    let cw_core = false;
    let sharpdx = false;
    let sharpdx_math = false;
    Ok(DependenciesStatus { cli, cw_core, sharpdx, sharpdx_math })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DepsZipRequest {
    zip_url: String,
}

#[tauri::command]
async fn fetch_dependencies_from_zip(req: DepsZipRequest) -> Result<DependenciesStatus, String> {
    use std::io::Read;
    let exe_dir = std::env::current_exe().map_err(|e| e.to_string())?.parent().unwrap().to_path_buf();
    let updates_dir = exe_dir.join("updates");
    let _ = fs::create_dir_all(&updates_dir);
    let zip_file = updates_dir.join("deps.zip");
    let client = reqwest::Client::new();
    let resp = client.get(&req.zip_url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Err(format!("status {}", resp.status())); }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    {
        let mut f = fs::File::create(&zip_file).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
    }
    let f = fs::File::open(&zip_file).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(f).map_err(|e| e.to_string())?;
    let extract_dir = updates_dir.join("deps_extracted");
    let _ = fs::remove_dir_all(&extract_dir);
    let _ = fs::create_dir_all(&extract_dir);
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        if file.is_dir() {
            let p = extract_dir.join(&name);
            let _ = fs::create_dir_all(&p);
            continue;
        }
        let mut out = Vec::new();
        file.read_to_end(&mut out).map_err(|e| e.to_string())?;
        let p = extract_dir.join(&name);
        if let Some(parent) = p.parent() { let _ = fs::create_dir_all(parent); }
        let mut of = fs::File::create(&p).map_err(|e| e.to_string())?;
        of.write_all(&out).map_err(|e| e.to_string())?;
    }
    // this is kind of redundant now, it used to be here because of the old version of CodeWalkerCLI.exe which required DLL's, now that everything is embedded it's no longer needed.
    let want = [
        "CodeWalkerCLI.exe",
    ];
    for entry in walk_dir(&extract_dir) {
        if entry.is_dir() { continue; }
        if let Some(fname) = entry.file_name().map(|x| x.to_string_lossy().to_string()) {
            if want.iter().any(|w| w.eq_ignore_ascii_case(&fname)) {
                let dst = exe_dir.join(&fname);
                let _ = fs::remove_file(&dst);
                fs::copy(&entry, &dst).map_err(|e| e.to_string())?;
            }
        }
    }
    check_cli_dependencies().await
}
fn cli_install_dir() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata).join("5MAssetsRenamer").join("bin")
    } else {
        std::env::current_exe().unwrap().parent().unwrap().to_path_buf()
    }
}

fn cli_install_path() -> PathBuf { cli_install_dir().join("CodeWalkerCLI.exe") }

// Another sponsored message by noFXAP: hey idiots! here's more proof of the legit remote calls!

#[tauri::command]
async fn check_cli_installed() -> Result<bool, String> { Ok(cli_install_path().exists()) }

#[tauri::command]
async fn fetch_release_by_tag(owner: String, repo: String, tag: String) -> Result<String, String> {
    let url = format!("https://api.github.com/repos/{}/{}/releases/tags/{}", owner, repo, tag);
    let client = reqwest::Client::new();
    let resp = client.get(&url).header("User-Agent", "5MAssetsRenamer").send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Err(format!("status {}", resp.status())); }
    let text = resp.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn download_cli(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client.get(&url).header("User-Agent", "5MAssetsRenamer").send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Err("download failed".to_string()); }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    let dir = cli_install_dir();
    let _ = fs::create_dir_all(&dir);
    let tmp = dir.join("CodeWalkerCLI.exe.download");
    let target = dir.join("CodeWalkerCLI.exe");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
    }
    if target.exists() { let _ = fs::rename(&target, dir.join("CodeWalkerCLI.exe.bak")); }
    fs::rename(&tmp, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
async fn ensure_cli_installed() -> Result<String, String> {
    let p = cli_install_path();
    if p.exists() { return Ok(p.to_string_lossy().to_string()); }
    let raw = fetch_release_by_tag("nofxap".to_string(), "5MAssetsRenamer".to_string(), "CLI".to_string()).await?;
    let mut cli_url: Option<String> = None;
    for part in raw.split("\n") {
        let s = part.trim();
        if s.contains("browser_download_url") && s.contains(".exe") {
            if let Some(i) = s.find("http") { cli_url = Some(s[i..].trim_matches(['"']).to_string()); break; }
        }
    }
    if let Some(url) = cli_url { download_cli(url).await }
    else { Err("no cli asset".to_string()) }
}
