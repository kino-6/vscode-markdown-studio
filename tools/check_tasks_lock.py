#!/usr/bin/env python3
"""Check Tasks.lock.json: the frozen contract behind each started Tasks.md row.

Tasks.md is what people read. Tasks.lock.json is the seal on what each row
promised - its minimum check and its gate - so that a gate cannot be quietly
loosened until it matches whatever the work happened to do. The relationship is
a lockfile's: the display may be edited freely, the seal changes only by rule.

Rules, checked against a base revision (default HEAD):

  L1  every started row in Tasks.md ([-] [x] [~] [!]) has a lock entry
  L2  where Tasks.md shows a 最小検証 / Gate line for a locked row, it matches
      the lock (whitespace-normalised)
  L3  a locked row's title / min_check / gate do not change unless the same
      change appends an amendment naming the field and a reason
  L4  a row may leave the lock only if it was passing in the base revision
  L5  `locked` never changes once set

`passes` may flip either way: true when the gate went green, false when an
audit or a regression reopens the row. Flipping it is the only edit an agent
makes to a locked row without an amendment.

  python3 tools/check_tasks_lock.py                 working tree vs HEAD
  python3 tools/check_tasks_lock.py --staged        staged copy vs HEAD (pre-commit)
  python3 tools/check_tasks_lock.py --base origin/main   (pre-push)
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

LOCKED_FIELDS = ("title", "min_check", "gate")
STARTED = {"-", "x", "~", "!"}
DEFAULT_ID = r"#?[A-Z]*-?\d+[a-z]?"


def git_show(ref: str, path: str) -> str | None:
    out = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return out.stdout if out.returncode == 0 else None


def read_current(path: str, staged: bool) -> str | None:
    if staged:
        return git_show("", path)  # `git show :path` is the index
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


def norm(s: str) -> str:
    return " ".join(s.split())


def parse_rows(md: str, id_pat: str) -> dict[str, dict]:
    """Rows from Tasks.md, bullet or table form: {id: {state, min_check, gate}}."""
    rows: dict[str, dict] = {}
    bullet = re.compile(rf"^\s*- \[(.)\] \*\*({id_pat})\b")
    table = re.compile(rf"^\|\s*\[(.)\][^|]*\|\s*({id_pat})\s*\|")
    label = re.compile(r"^\s*- (最小検証|Gate):\s*(.+?)\s*$")
    header_cols: list[str] = []
    current: str | None = None

    for line in md.splitlines():
        if line.startswith("|") and "最小検証" in line and "Gate" in line:
            header_cols = [c.strip() for c in line.strip().strip("|").split("|")]
            continue
        m = bullet.match(line)
        if m:
            current = m.group(2)
            rows[current] = {"state": m.group(1), "min_check": None, "gate": None}
            continue
        m = table.match(line)
        if m:
            current = None
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            row = {"state": m.group(1), "min_check": None, "gate": None}
            for name, key in (("最小検証", "min_check"), ("Gate", "gate")):
                if name in header_cols and header_cols.index(name) < len(cells):
                    row[key] = cells[header_cols.index(name)] or None
            rows[m.group(2)] = row
            continue
        if line.startswith("#"):
            current = None
            continue
        if current:
            lm = label.match(line)
            if lm:
                rows[current]["min_check" if lm.group(1) == "最小検証" else "gate"] = lm.group(2)
    return rows


def load(text: str | None, where: str) -> dict:
    if text is None:
        return {"rows": {}}
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        sys.exit(f"[L0] {where}: Tasks.lock.json is not valid JSON ({e})")


def check(tasks_md: str | None, after: dict, before: dict) -> list[str]:
    bad: list[str] = []
    id_pat = after.get("id_pattern", DEFAULT_ID)
    a_rows = after.get("rows", {})
    b_rows = before.get("rows", {})

    if tasks_md is not None:
        for rid, row in parse_rows(tasks_md, id_pat).items():
            if row["state"] in STARTED and rid not in a_rows:
                bad.append(f"[L1] {rid} is started ([{row['state']}]) but has no lock entry")
                continue
            if rid in a_rows:
                for key in ("min_check", "gate"):
                    shown = row[key]
                    if shown is not None and norm(shown) != norm(a_rows[rid].get(key, "")):
                        bad.append(f"[L2] {rid} Tasks.md shows a different {key} than the lock")

    for rid, b in b_rows.items():
        a = a_rows.get(rid)
        if a is None:
            if not b.get("passes"):
                bad.append(f"[L4] {rid} left the lock while not passing - an unfinished row was dropped")
            continue
        if "locked" in b and a.get("locked") != b.get("locked"):
            bad.append(f"[L5] {rid} `locked` changed ({b.get('locked')} -> {a.get('locked')})")
        changed = [f for f in LOCKED_FIELDS if a.get(f) != b.get(f)]
        if not changed:
            continue
        new_amends = a.get("amendments", [])[len(b.get("amendments", [])):]
        covered = {am.get("field") for am in new_amends if am.get("reason")}
        for f in changed:
            if f not in covered:
                bad.append(f"[L3] {rid} `{f}` changed without an amendment giving a reason")
    return bad


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="HEAD", help="revision to compare against (default HEAD)")
    ap.add_argument("--staged", action="store_true", help="check the staged copy (for pre-commit)")
    ap.add_argument("--lock", default="Tasks.lock.json")
    ap.add_argument("--tasks", default="Tasks.md")
    args = ap.parse_args()

    after_text = read_current(args.lock, args.staged)
    if after_text is None:
        print(f"no {args.lock}; nothing to check")
        return 0
    after = load(after_text, "current")
    before = load(git_show(args.base, args.lock), args.base)
    tasks_md = read_current(args.tasks, args.staged)

    bad = check(tasks_md, after, before)
    for b in bad:
        print(b)
    n = len(after.get("rows", {}))
    if bad:
        print(f"TASKS_LOCK FAIL rows={n} problems={len(bad)}")
        print("A locked gate is loosened only by an amendment that names the field and the reason.")
        return 1
    print(f"TASKS_LOCK OK rows={n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
