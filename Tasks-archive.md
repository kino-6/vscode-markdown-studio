# Tasks 完了記録

> [Tasks.md](Tasks.md) から移した完了行。**1 タスク 1 レコード**、新しいものを上に。
> 後から「何をもって完了としたか」を辿れる形に保つ。残すのは Gate と結果、Gate が赤くなれることを確かめた記録、仮説と実際のずれだけ。

## 2026-10

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
