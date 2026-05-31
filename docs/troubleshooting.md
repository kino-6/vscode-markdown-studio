# Troubleshooting

## Dependency Installation

Markdown Studio auto-installs Amazon Corretto JDK for PlantUML and Playwright Chromium for PDF export on first activation.

| Symptom | Cause | Solution |
| ------- | ----- | -------- |
| Download timeout or failure | Corporate proxy or firewall | Set `http.proxy` in VS Code settings, or add CA certs with `markdownStudio.network.caCertificates`. |
| Chromium not available | Browser dependency missing or disk space insufficient | Run `Markdown Studio: Tools: Setup Dependencies`; Chromium needs roughly 200 MB. |
| PlantUML diagrams not rendering | Java is not available | Run `Markdown Studio: Tools: Validate Local Environment`, then set `markdownStudio.java.path` if needed. |
| macOS security block | Gatekeeper blocks an unsigned binary | Open System Settings > Privacy & Security, then allow the blocked app. |
| ARM/x86 mismatch | Wrong architecture binary downloaded | Delete the extension dependency cache and run setup again. |

## Feature Availability

| Feature | Java Required | Chromium Required |
| ------- | :-----------: | :---------------: |
| Markdown Preview | No | No |
| Mermaid diagrams | No | No |
| WaveDrom diagrams | No | No |
| Inline SVG | No | No |
| Syntax highlighting | No | No |
| TOC generation | No | No |
| PlantUML diagrams | Yes | No |
| PDF export | No | Yes |

## Manual Setup

```bash
# Java for PlantUML. Any JDK 11+ works.
brew install openjdk@21

# Chromium for PDF export.
npx playwright install chromium
```

Then configure the Java path if VS Code cannot find it automatically:

```jsonc
"markdownStudio.java.path": "/path/to/java"
```

## Offline Environments

1. Download the VSIX from GitHub Releases on a connected machine.
2. Install it with `code --install-extension markdown-studio-*.vsix`.
3. Install Java manually and set `markdownStudio.java.path`.
4. For PDF export, install Chromium on a connected machine and copy the Playwright browser directory into the offline environment.
