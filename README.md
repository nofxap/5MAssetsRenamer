# 5M Assets Renamer

A Windows-first asset renaming tool with a simple UI (no Node server) and a Rust/Tauri/C# backend. Supports Replace, Prefix, and Suffix modes.
<img width="1202" height="832" alt="image" src="https://github.com/user-attachments/assets/8980ac14-a347-49c2-853e-04237cca5126" />

## Features
- Replace, Prefix, and Suffix rename modes
- Status, stats, and error display per run
- Works from static `ui/` files (no dev server)

## Quick Start (User)
- Download the release
- Unzip the entire archive
- Launch the app
- Fill inputs:
  - `Input Directory Path`
  - Optional `Output Directory Path`
  - `Text to Find`
  - Choose mode and provide required text for that mode
- Click `Execute Rename`
- Review results and errors in the right panel

### Building
Use standard Tauri 2 build commands to produce installer or portable builds. Ensure `bundle.active` is `true` and resources are listed when creating an installer.
