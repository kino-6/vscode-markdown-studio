# Tasks 完了記録

> [Tasks.md](Tasks.md) から移した完了行。**1 タスク 1 レコード**、新しいものを上に。
> 後から「何をもって完了としたか」を辿れる形に保つ。残すのは Gate と結果、Gate が赤くなれることを確かめた記録、仮説と実際のずれだけ。

## 2026-10

### T009 — 受け入れ確認の流れを実際の VS Code で自動検査する（`npm run test:acceptance`）

- 完了: 2026-10-25
- Gate: `node scripts/test/acceptanceCheck.js` — `ACCEPTANCE OK (11 checks)`。隔離プロファイルの VS Code に VSIX だけを入れ、タブ名、demo.md のローカル画像 3 つ、Mermaid / PlantUML、プレビュー内の Cmd+F、プレビューを選んだ状態での PDF 出力、SKILL.md のカードと問題パネル、注記、Chromium が無いときの確認ダイアログを、画面から確かめる
- 赤の確認: SKILL.md の言語対応を入れる前は skills のシナリオが落ちた（プレビューが開かなかった）。この検査で見つかった不具合
- 再現: `npm run test:acceptance`（スクリーンショットは `ignore/acceptance-check/`）
- 何が本当の原因だったか: 最近の VS Code は SKILL.md を `skill` という別の言語で開く。最初に報告された「SKILL.md がプレビューできない」の本当の原因はこれで、frontmatter の表示は副次的な問題だった。ほかに、新しいプロファイルで出る Copilot のサインイン画面、git の通知、macOS のソケットのパス長の上限が、受け入れ確認の妨げになっていた
- commit: このレコードと同じ commit

### T001 — PR #15 が main にマージされている

- 完了: 2026-10-25
- Gate: `gh pr view 15 --json state -q .state` — `MERGED`（merge commit `e8acd24`）
- 再現: `gh pr view 15`
- commit: `e8acd24`

### T008 — プレビューにフォーカスがある状態でも PDF 出力ができる

- 完了: 2026-10-25
- Gate: `npx vitest run -c config/vitest.unit.config.ts test/unit/exportPdfCommand.test.ts` — 8 passing、failing 0（プレビューを選んだ状態では、プレビュー中の文書を出力する。エディタが選ばれていればエディタ側を優先する。どちらも無ければ従来どおり案内を出す）
- 赤の確認: プレビュー中の文書を使う分岐を外すと、該当テストが落ちた
- 再現: `./scripts/dev/acceptance.sh`（demo.md のプレビューを選んだ状態で Export PDF を実行する）
- 何が本当の原因だったか: PDF 出力はアクティブなテキストエディタだけを見ていた。プレビューを選ぶと、アクティブなエディタは無い扱いになる
- commit: このレコードと同じ commit

### T007 — プレビューのタブ名に元ファイル名が出る（例: `Preview (demo.md)`）

- 完了: 2026-10-25
- Gate: `npx vitest run -c config/vitest.unit.config.ts test/unit/webviewPanel.test.ts` — 29 passing、failing 0。作成時は `Preview (demo.md)`、切り替え後は `Preview (other notes.md)` になる
- 赤の確認: 切り替え時にタブ名を更新する 1 行を外すと、該当テストが落ちた
- 再現: `./scripts/dev/acceptance.sh`（demo.md のプレビューを開いてタブ名を見る）
- 何が本当の原因だったか: タブ名がコード中に固定文字列で書かれていた
- commit: このレコードと同じ commit

### T006 — PDF 出力の E2E が、PDF が実際に作られたことを検査する

- 完了: 2026-10-25
- Gate: `npm run test:e2e` — 17 passing、failing 0。PDF 出力テストは、ファイルの存在、1000 byte 超、先頭が `%PDF-` であることを必ず確かめる
- 赤の確認: PDF 出力を壊すと新しいテストは failing 1。同じ壊し方で、旧テストは passing のままだった（実行して確認）
- 再現: `npm run test:e2e -- --grep "exportPdf"`
- 何が本当の原因だったか: PDF 出力のコマンドは、失敗しても呼び出し元へ例外を投げず、メッセージを出して終わる。旧テストは「例外が無ければ成功」とみなし、ファイルが無ければ確認自体を飛ばしていた（2026-04-04 から）
- commit: このレコードと同じ commit

### T002 — 起動時に何もダウンロードしないことと、SKILL.md の警告表示を E2E で検査する

- 完了: 2026-10-25
- Gate: `npm run test:e2e` — 17 passing、failing 0（以前は 14）
- 赤の確認: テスト用プロファイルに `corretto` フォルダを置くと「何もダウンロードしない」が落ち、警告の登録を外すと SKILL.md の警告テストが落ちた。戻すと 3 件とも通った
- 再現: `npm run test:e2e -- --grep "SKILL.md diagnostics"`
- 何が本当の原因だったか: 既存の PDF 出力の E2E は、出力が失敗してもファイルが無くても通る作りで、「E2E が通る」ことは PDF 出力の動作の証明になっていなかった
- commit: このレコードと同じ commit

### T004 — タグ push 時の Release ワークフローが、VSIX を作る前に全テストを流し、落ちたら VSIX も Release も作らない

- 完了: 2026-10-25
- Gate: HEAD（`11e8f8f`）の release run で `success success success success success success skipped`（lint・unit・integration・local-only・package が success、Release は skipped）
- 監査: 3 回とも GATE_BROKEN。1・2 回目の指摘（`continue-on-error` / `if:` / `|| true`、Gate が検査手順を読まない、2 つ目の Release 手順）は直した。3 回目の指摘（`shell:` や `npm_config_script_shell` による意図的なごまかし）は対象外とした。ユーザ判断（2026-10-25）で、この検査が守るのは書き間違いまでとし、release.yml を書き換えられる人による意図的な改ざんは扱わない
- 再現: `node scripts/test/releaseWorkflowCheck.js`
- 何が本当の原因だったか: 旧 workflow は Node 20 上で最新 vsce（Node 22 以上が必要）をグローバルに入れており、次のタグで落ちうる状態だった
- commit: `647be3f` 〜 `11e8f8f`

### T005 — テストが落ちたとき、Release ワークフローが VSIX を作らずに止まることを実際の run で確かめた

- 完了: 2026-10-25
- Gate: `gh run view 40105809061 ...` — `failure skipped`（lint が failure、test:unit・test:integration・test:local-only・package・Create GitHub Release はすべて skipped）
- 監査: T004 の再監査を担当した gate-auditor が、この run を独立に読んで同じ結果を報告した
- 再現: `gh run view 40105809061`
- 何が本当の原因だったか: 使い捨ての PR を作る想定だったが、f2b9fb9 で lint エラーを push してしまった run が、そのまま失敗経路の実証になった
- commit: run の対象は `f2b9fb9`

### T000 — ローカル完結の強化・SKILL.md 対応・プレビュー修正・依存更新

- 完了: 2026-10-21（このキューを作ったときに後から記録）
- Gate: CI run 39533917454（`efdc94a`）で `test`（lint、unit 1060 件、integration 66 件）と `local-only` が pass
- 監査: gate-auditor は回していない（後からの記録のため）。作業中に、各 Gate が赤くなれることは確かめた。local-only の検査は修正前に preconnect の通信と `PLANTUML_SECURITY_PROFILE` の通信で赤くなった。静的監査は、わざと入れた `fetch` / `os.hostname` で赤くなった。スクロール位置の検査は古いプレビューで赤くなった
- 再現: `npm run test:local-only`
- 何が本当の原因だったか: PDF 出力のページには通信の制限が一切無かった（`<img src>` とリンクしか見ていなかった）。「プレビューが追従しない」は、編集のたびに画面より上の図が高さ 0 に潰れることだった
- commit: `feat/local-only-hardening` の `54a5e3c` 〜 `efdc94a`

### T011 — 「ダウンロード」を押したあと PDF 出力が成功し、再起動後も出力できる

- 完了: 2026-10-28
- Gate: `node scripts/test/acceptanceCheck.js --only download` — `ACCEPTANCE OK (2 checks)`。全体（demo・skills・consent）、E2E 17 件、unit 1089 件、integration 66 件、local-only も通過
- 監査: gate-auditor は回していない。新しい単体テストは、修正前の判定（フォルダがあれば導入済み）なら赤になる
- 再現: 受け入れ用プロファイルで demo.md を PDF 出力すると「Chromium is not installed」と出た
- 何が本当の原因だったか: Playwright は Chromium の置き場所（`PLAYWRIGHT_BROWSERS_PATH`）を最初に読み込んだときに一度だけ決める。先に PDF 出力が共通キャッシュで動くと、そのあとの「ダウンロード」は共通キャッシュに入り、拡張の置き場所は空のまま記録だけが残った。次の起動では空の置き場所を使って失敗し、「導入済み」はフォルダの有無で判断していたので、再ダウンロードもされなかった
- E2E で見逃した理由: E2E と受け入れ検査は、どちらも共通キャッシュの Chromium で動いていた。「ダウンロード」を押す流れを試す検査が無かった
