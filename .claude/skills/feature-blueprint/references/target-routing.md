# Target routing

Pick the first tool from the kind of target. MCP tool names assume the REA
server is connected (`mcp__rea__*`); the CLI equivalent works without it:
`npx -y rea-agents@6.5.0 <command> --json`. Check the connected server's real
tool list — versions differ.

| Target | First move | Needs extra engine? |
|---|---|---|
| Website / web app (user may load it) | `capture_browser_scenario` with declared clicks/typing, or `analyze_web_bundle` | No (Playwright/Chromium) |
| Electron or JavaScript desktop app, ASAR, extracted JS tree | `analyze_javascript_application` (`detail: "summary"` for big apps), then `trace_application_feature` | No |
| Zip / APK / IPA / MSIX / DMG package | `open_binary` + `inspect_artifact`; `extract_artifact` into a new folder | No |
| Android app code | `inspect_android_package`, `search_android_classes`, `inspect_android_method` | JADX + Java |
| .NET / C# assembly | `inspect_managed_artifact`, `inspect_managed_members` | No |
| Native exe / dll / Mach-O / ELF | `open_binary`, then `analyze_function`, `procedure_pseudo_code`, `search_strings` | Ghidra, IDA or Hopper |
| Go or Rust binary metadata | `inspect_go_binary`, `inspect_rust_binary` | No |
| SQLite database (app data) | `inspect_sqlite_database` | No |
| WebAssembly | `inspect_wasm_artifact` | WABT |
| Network capture (HAR/SAZ/PCAP) | `inspect_web_network_capture`, `inspect_pcap_capture` | tshark for PCAP |
| Firmware image | `inspect_firmware_regions`, `extract_firmware` | binwalk / unblob |
| Proprietary file format (e.g. DWG, PSD) | First: existing libraries/specs (Stage 2). Then compare sample files byte-wise; analyze the reader in an app you're allowed to inspect | Depends |

## Working rules

- **Summary first.** For large results, analyze with `detail: "summary"` and
  page through `inspect_analysis_view` using the returned `parent_evidence_id`.
- **Don't repeat** an identical call; change the input or resolve the blocker.
- **Cite evidence IDs** in the findings ledger.
- **Close sessions** with `close_binary` when finished.
- **Missing tools?** Run `scripts/rea-check.sh`. A healthy registration with no
  tools in the session means the session must be restarted, not re-setup.

## Feature-tracing recipe (UI action → result)

1. Find the trigger: UI label text ("Export notes"), menu ID, route or command.
2. Locate the handler that the trigger is bound to.
3. Follow data from handler → transformation → output (file write, network
   request, DB update). Record file paths, field lists and formats.
4. Confirm with runtime evidence (browser/Electron scenario) when the static
   path has branches you can't resolve.
