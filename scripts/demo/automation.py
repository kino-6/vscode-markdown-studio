#!/usr/bin/env python3
"""VSCode automation for demo GIF recording using AppleScript.

All keyboard input is sent via AppleScript `keystroke` / `key code`
directly to the "Code" application, which is far more reliable than
PyAutoGUI on macOS (no keyboard layout issues, no focus problems).
"""

import argparse
import subprocess
import time


def _applescript(script: str) -> None:
    """Run an AppleScript snippet."""
    subprocess.run(["osascript", "-e", script], check=True, capture_output=True)


def _tell_code(commands: str) -> None:
    """Send commands to VSCode via AppleScript tell block."""
    script = f'''
    tell application "Code"
        activate
    end tell
    delay 0.5
    tell application "System Events"
        tell process "Code"
            {commands}
        end tell
    end tell
    '''
    _applescript(script)


def open_preview() -> None:
    """Open Markdown Studio preview via Command Palette.

    Cmd+Shift+P → type "Markdown Studio: Preview" → Enter
    """
    # First focus editor pane with Cmd+1
    _tell_code('''
        -- Focus editor pane
        keystroke "1" using command down
        delay 0.5
        -- Open command palette
        keystroke "p" using {command down, shift down}
        delay 1.5
        -- Type command name
        keystroke "Markdown Studio: Preview"
        delay 1.0
        -- Execute
        key code 36
        delay 4.0
    ''')


def scroll_to_line(line: int) -> None:
    """Scroll to a specific line using Ctrl+G (Go to Line)."""
    _tell_code(f'''
        -- Focus editor pane
        keystroke "1" using command down
        delay 0.5
        -- Open Go to Line dialog
        keystroke "g" using command down
        delay 0.5
        -- Type line number
        keystroke "{line}"
        delay 0.3
        -- Execute
        key code 36
        delay 1.0
    ''')


def scroll_to_anchor(anchor: str) -> None:
    """Scroll to anchor using Cmd+F find dialog."""
    # Use pbcopy + Cmd+V for the anchor text (contains special chars)
    proc = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE)
    proc.communicate(anchor.encode("utf-8"))

    _tell_code('''
        -- Focus editor pane
        keystroke "1" using command down
        delay 0.5
        -- Open find dialog
        keystroke "f" using command down
        delay 0.5
        -- Select all in search field
        keystroke "a" using command down
        delay 0.2
        -- Paste anchor from clipboard
        keystroke "v" using command down
        delay 0.5
        -- Find next
        key code 36
        delay 0.3
        -- Close find
        key code 53
        delay 1.0
    ''')


def fallback_scroll(page_count: int = 10) -> None:
    """Scroll down by pressing PageDown."""
    cmds = "-- Focus editor\nkeystroke \"1\" using command down\ndelay 0.3\n"
    for _ in range(page_count):
        cmds += "key code 121\ndelay 0.3\n"  # 121 = PageDown
    _tell_code(cmds)


def close_search() -> None:
    """Close any open dialog."""
    _tell_code('key code 53')  # Escape


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "action",
        choices=["open_preview", "scroll_to_anchor", "scroll_to_line",
                 "fallback_scroll", "close_search"],
    )
    parser.add_argument("--anchor", type=str, default=None)
    parser.add_argument("--line", type=int, default=None)
    parser.add_argument("--page-count", type=int, default=10)

    args = parser.parse_args()

    if args.action == "open_preview":
        open_preview()
    elif args.action == "scroll_to_anchor":
        if args.anchor is None:
            parser.error("--anchor is required")
        scroll_to_anchor(args.anchor)
    elif args.action == "scroll_to_line":
        if args.line is None:
            parser.error("--line is required")
        scroll_to_line(args.line)
    elif args.action == "fallback_scroll":
        fallback_scroll(args.page_count)
    elif args.action == "close_search":
        close_search()


if __name__ == "__main__":
    main()
