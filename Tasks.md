# Tasks.md — 作業のブレークダウン

> **READ FIRST（全エージェント / 全セッション）**
> 憲章（目的・ゴール・アプローチ・完了の判断）は [CHARTER.md](CHARTER.md)。
> 作業規律（Gate と最小検証の契約 / 完了の 4 条件 / 別視点の検証 / 並列化）は [docs/work-rules.md](docs/work-rules.md)。
> **ここは具体作業だけを書く。決まりを写さない。**
> **毎周の入口でこのファイルと CHARTER.md を読み、`[x]` を付ける前に work-rules.md を読む。**
> 題が下のどれにも無ければ、**脇道と明記してから**回す。
> **上から 1 件ずつ**処理する。詰まったら `[~]` / `[!]` に理由を書いて次へ。2 件を同時に開かない。
> このファイルは **200 行以内**に保つ。超えたら幅を広げず、履歴へ移す。**commit の粒度で整備する。**

次に起票する ID は **T006 以降**。

## 何をどこに書くか

| 何を書くか | どこに書くか |
|---|---|
| 作業規律 | [docs/work-rules.md](docs/work-rules.md) |
| 完了した作業の記録 | [Tasks-archive.md](Tasks-archive.md) |
| 着手した行の最小検証・Gate の封印 | [Tasks.lock.json](Tasks.lock.json)（`python3 tools/check_tasks_lock.py`） |
| 設計の原本・将来候補 | `docs/plans/` |
| リリースごとの変更履歴 | [CHANGELOG.md](CHANGELOG.md) |

## 書き方

1 行 1 作業。項目は「**何を・なぜ・最小検証・Gate・再現・状態**」。状態はチェックボックスで書く。

- `[x]`: 完了。**直近 1 件だけ**境界確認用に残し、以後は履歴へ移す
- `[-]`: 進行中。中断時は、どこまで済んだかを書く
- `[~]`: 人間の判断が必要（何を決めてほしいかを書く）
- `[!]`: 外部（人・他システム）の動作待ち
- `[ ]`: 未着手

最小検証と Gate は着手前に書き、`Tasks.lock.json` に封印する。赤くなれることを最小検証で先に確かめる。
行の Gate はその行を証明するもの。フルのテストは push の直前にだけ回し、行の Gate には書かない。

---

## 本線 A — ローカル完結の強化とリリース準備（2026-10-21〜）

- [-] **T004 — タグ push 時の Release ワークフローが、VSIX を作る前に全テスト（lint・unit・integration・local-only）を流し、落ちたら VSIX も GitHub Release も作らない**
  - なぜ: user 2026-10-25。Marketplace に出しているので、配布物ができる時点で守る（main の扱いは変えない）。あわせて、Node 20 で最新 vsce（Node 22 以上が必要）をグローバルに入れている不要な手順を外す
  - 最小検証: `node scripts/test/releaseWorkflowCheck.js` — `RELEASE_WORKFLOW OK` と出る
  - Gate: `gh run list --workflow release.yml --commit $(git rev-parse HEAD) --limit 1 --json databaseId -q '.[0].databaseId' | xargs -I{} gh run view {} --json conclusion,jobs -q '[.conclusion, (.jobs[0].steps[]|select(.name|test("^Run npm run (lint|test:unit|test:integration|test:local-only|package)$|^Create GitHub Release$"))|.conclusion)]|join(" ")'` — `success success success success success success skipped` と出る
  - 再現: `gh run list --workflow release.yml --branch feat/local-only-hardening --limit 1`
  - 経過: 2026-10-25 監査で GATE_BROKEN。最小検証が `continue-on-error` / `if:` / `|| true` などの抜け道を見分けられず、Gate も HEAD の run に絞っていなかった。最小検証を厳しくし（変異 10 件を `test/unit/releaseWorkflowCheck.test.ts` に固定）、Gate を amendment で修正。同日の再監査でも GATE_BROKEN（Gate が検査手順の結果を読まない / 2 つ目の Release 手順を最小検証が見逃す）。両方直し、Gate を 2 回目の amendment で修正。再監査待ち。`package.json` のスクリプト中身まで固定する案は採らない（スクリプトは CI でも毎回使われ差分で見える。固定するとスクリプト変更のたびに検査も直す手間が勝つ）

- [!] **T001 — PR #15 が main にマージされている**
  - なぜ: user 2026-10-21。マージはユーザが決める。ユーザの受け入れ確認（`scripts/dev/acceptance.sh`）待ち
  - 最小検証: `gh pr checks 15` — すべて `pass`
  - Gate: `gh pr view 15 --json state -q .state` — `MERGED` と出る
  - 再現: `scripts/dev/acceptance.sh`

- [ ] **T002 — PR #15 の「画面でしか確かめられない動作」が E2E で検査され、受け入れ確認が眺める程度で済む**
  - なぜ: user 2026-10-21（人間を監査機関にしない）。次の 2 点は今も目視でしか確かめていない。起動しただけで何もダウンロードしない（起動後の globalStorage に Java / Chromium が無い）。SKILL.md の警告が「問題」パネルに出る
  - 最小検証: `npm run test:e2e -- --grep "local-first activation|SKILL.md diagnostics"` — 2 件以上 passing、failing 0
  - Gate: `npm run test:e2e` — 16 件以上 passing（現在 14 件）、failing 0
  - 再現: `npm run test:e2e -- --grep "SKILL.md diagnostics"`

- [!] **T003 — `npm audit --omit=dev` に katex の指摘が出ない**
  - なぜ: GHSA-238p-pmpm-9mq7（katex 0.11.0〜0.18.1）。修正版がまだ出ていない（2026-10-21 確認）ため外部待ち
  - 最小検証: `npm view katex version` — 0.18.1 より新しい版が出る
  - Gate: `npm audit --omit=dev` — 出力に `katex` が無い
  - 再現: `npm audit --omit=dev`

## 直近完了（境界確認用に 1 件だけ）

| 状態 | ID | 何を | 証跡 |
|---|---|---|---|
| [x] | T005 | テストが落ちたとき、Release ワークフローが VSIX を作らずに止まることを実際の run で確かめた | `gh run view 40105809061` — lint failure、package と Release は skipped / 2026-10-25 |
