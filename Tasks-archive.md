# Tasks 完了記録

> [Tasks.md](Tasks.md) から移した完了行。**1 タスク 1 レコード**、新しいものを上に。
> 後から「何をもって完了としたか」を辿れる形に保つ。残すのは Gate と結果、Gate が赤くなれることを確かめた記録、仮説と実際のずれだけ。

## 2026-10

### T000 — ローカル完結の強化・SKILL.md 対応・プレビュー修正・依存更新

- 完了: 2026-10-21（このキューを作ったときに後から記録）
- Gate: CI run 39533917454（`efdc94a`）で `test`（lint、unit 1060 件、integration 66 件）と `local-only` が pass
- 監査: gate-auditor は回していない（後からの記録のため）。作業中に、各 Gate が赤くなれることは確かめた。local-only の検査は修正前に preconnect の通信と `PLANTUML_SECURITY_PROFILE` の通信で赤くなった。静的監査は、わざと入れた `fetch` / `os.hostname` で赤くなった。スクロール位置の検査は古いプレビューで赤くなった
- 再現: `npm run test:local-only`
- 何が本当の原因だったか: PDF 出力のページには通信の制限が一切無かった（`<img src>` とリンクしか見ていなかった）。「プレビューが追従しない」は、編集のたびに画面より上の図が高さ 0 に潰れることだった
- commit: `feat/local-only-hardening` の `54a5e3c` 〜 `efdc94a`
