# 5M Assets Renamer

A Windows-first asset renaming tool with a simple UI (no Node server) and a Rust/Tauri/C# backend. Supports Replace, Prefix, and Suffix modes.
<img width="1442" height="932" alt="image" src="https://github.com/user-attachments/assets/e748e7c9-e9fc-475b-b362-68cf1f0bd142" />

## Features
- Replace, Prefix, and Suffix rename modes
- Status, stats, and error display per run
- Works from static `ui/` files (no dev server)
- Preserves UV animation material bindings when renaming drawable models
- Updates internal YDR drawable names while preserving embedded texture data

### UV animation regression tests

With the .NET 8 SDK installed, run:

```sh
dotnet run --project tests/UvClipHashTests/UvClipHashTests.csproj --configuration Release
```

The tests use synthetic assets to check replacement, prefix and suffix operations,
including a binary YDR/YCD rename and repack. UV clip hashes are recalculated as
`JOAAT(model name) + material index + 1` using the original drawable's shader count.
Skeletal clips, unmatched materials and ambiguous hash mappings are left unchanged.
The current implementation discovers materials from `.ydr` models; models inside
`.ydd` dictionaries and `.yft` fragments are not covered by this correction.
Internal YDR model names are renamed directly in the loaded drawable, without an
XML/DDS round trip. Texture names and pixel data are preserved; this does not add
support for renaming texture entries in YTD dictionaries or shader samplers.

## UI Quick Start (User)
- Download the release
- Launch the app
- Fill inputs:
  - `Input Directory Path`
  - Optional `Output Directory Path`
  - `Text to Find`
  - Choose mode and provide required text for that mode
- Click `Execute Rename`
- Review results and errors in the right panel

## CLI Usage

```
USAGE:
  CodeWalkerCLI <inputPath> [outputPath] -f <TextToFind> [OPTIONS]

ARGUMENTS:
  <inputPath>                 Input directory containing GTA V assets.
  [outputPath]                Optional output directory. If omitted, files in inputPath are modified.

REQUIRED OPTIONS (for renaming):
  -f, --find <text>           The string to find in file names and content.
  -r, --replace <text>        The string to replace the found text with. (Mutually exclusive with -p/-s)

PREFIX/SUFFIX OPTIONS (Alternative to -r):
  -p, --prefix <text>         Text to prepend if TextToFind is found.
  -s, --suffix <text>         Text to append if TextToFind is found.

OTHER OPTIONS:
  -h, --help                  Show this help.

EXAMPLES:
  CodeWalkerCLI c://inputPath c://outputPath -f old_name -r new_name
  CodeWalkerCLI c://inputPath -f car_model -s _fixed
```


### Building
Use standard Tauri 2 build commands to produce installer or portable builds. Ensure `bundle.active` is `true` and resources are listed when creating an installer.
