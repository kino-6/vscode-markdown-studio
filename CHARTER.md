# CHARTER.md — Markdown Studio

> 作業のブレークダウンは [Tasks.md](Tasks.md)。完了記録は [Tasks-archive.md](Tasks-archive.md)。
> **Tasks.md の毎周の入口でこのファイルも読む。**

## 目的

Markdown のプレビューと PDF 出力（図・数式を含む）を、利用者の PC の中だけで完結させる VS Code 拡張を提供する。文書が外に出ない状態を保つ。

## 問い / ゴール（2026-10-21 更新）

リリースのたびに、初期設定のままでは外部へ何も送らず、PC や VS Code の識別情報も読まないことを、機械の検査で示せる。そのうえでプレビューと PDF が正しく出る。

## アプローチ

ローカル完結をコードで強制する（CSP、PDF 出力の通信遮断、同意のないダウンロードをしない）。そのうえで、機械の検査で証明する（静的な監査テストと、CI の `npm run test:local-only`）。
選ばなかった道: 人のレビューや、外部ライブラリの初期設定に頼ること。

## 範囲

入る: プレビュー、PDF 出力、PlantUML / Mermaid / WaveDrom の描画、依存のセットアップ、SKILL.md 対応、テストと CI
入らない: Marketplace への公開とリリースタグ（人が行う。`.agents/skills/markdown-studio-release-prep/SKILL.md`）

## 成果物

1. `main` からビルドした拡張（VSIX）
2. 退行で落ちる自動検査: `npm run test:ci`、`npm run test:local-only`、`npm run test:e2e`

## 完了の判断

行の Gate が緑で、実物で確認済みで、1 コマンドの再現手段があり、commit 済みであること。人の受け入れ確認は完了条件にしない。

## 制約と規則

- 初期設定では外部へ何も送らない。`test/unit/localOnlyAudit.test.ts` と `npm run test:local-only` で検査する
- Java / Chromium のダウンロードは利用者の同意の後にだけ行う
- 拡張が自分で証明書の検証を切ることはしない
- 作業の規則は [docs/work-rules.md](docs/work-rules.md)

## リスク

- 外部側の変化（VS Code の実行ファイル構成、PlantUML のセキュリティの初期値、Chromium の先行接続の挙動）で、気づかないうちに外部への通信が戻ることがある。その見張りは local-only の検査が担う
