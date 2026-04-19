# 実装計画: ダイアグラムズームツールバー

## 概要

既存の `.zoom-indicator` をクリック可能なツールバー (`.zoom-toolbar`) に置き換え、ズームレベル表示・100%リセットボタン・ホバー表示制御・SVG高解像度再レンダリングを実装する。変更対象は `media/preview.js`、`media/preview.css`、`src/preview/webviewPanel.ts`、`src/renderers/renderMarkdown.ts` の既存ファイルのみ。

## タスク

- [x] 1. ツールバーDOM構造とリセット機能の実装 (preview.js)
  - [x] 1.1 `createZoomToolbar(container, state)` 関数を追加する
    - `.zoom-toolbar` div（`role="toolbar"`, `aria-label="Diagram zoom controls"`）を生成
    - `.zoom-toolbar-level` span（ズームパーセンテージ表示）を生成
    - `.zoom-toolbar-reset` button（`aria-label="Reset zoom to 100%"`, `title="100%にリセット"`, `↺` テキスト）を生成
    - リセットボタンの `click` イベントで `e.stopPropagation()` + `resetZoom()` を呼び出し
    - `attachZoomPan()` 内で `createZoomToolbar()` を呼び出してツールバーを初期化
    - _要件: 1.3, 1.4, 3.1, 6.1, 6.2_

  - [x] 1.2 `resetZoom(container, state)` 関数と `isDefaultZoomState(state)` 関数を追加する
    - `resetZoom`: state.scale=1.0, translateX=0, translateY=0 に設定し、`applyTransform()` を呼び出す
    - `isDefaultZoomState`: scale===1.0 && translateX===0 && translateY===0 を判定
    - _要件: 3.2, 3.3, 3.4, 3.5_

  - [x] 1.3 `applyTransform()` を変更し `.zoom-indicator` の代わりに `.zoom-toolbar` を更新する
    - `.zoom-indicator` の生成・更新ロジックを削除
    - `.zoom-toolbar-level` のテキストを `Math.round(state.scale * 100) + "%"` で更新
    - `.zoom-toolbar-reset` の `disabled` 属性を `isDefaultZoomState(state)` で制御
    - _要件: 2.1, 2.2, 2.3, 3.5_

  - [x] 1.4 既存の `handleDblClick()` 実行後に `applyTransform()` でツールバーが更新されることを確認する
    - ダブルクリックリセット後にインジケーターが "100%" に、リセットボタンが disabled になることを検証
    - _要件: 5.3, 5.4_

  - [x] 1.5 新しい関数群を `export` 文に追加する（`createZoomToolbar`, `resetZoom`, `isDefaultZoomState`）
    - _要件: —_

- [x] 2. ホバー表示制御の実装 (preview.js + preview.css)
  - [x] 2.1 `attachZoomPan()` 内に `mouseenter`/`mouseleave` イベントリスナーを追加する
    - `mouseenter` で `container.classList.add('diagram-hover')`
    - `mouseleave` で `container.classList.remove('diagram-hover')`
    - _要件: 1.1, 1.2_

  - [x] 2.2 CSSで `.zoom-toolbar` のスタイルと表示制御を実装する（preview.css）
    - `.zoom-toolbar` の基本スタイル（position:absolute, top:8px, right:8px, flexbox, 背景、角丸、フォント）
    - `.zoom-toolbar-level` のスタイル（min-width, text-align, user-select）
    - `.zoom-toolbar-reset` のスタイル（背景透明, ボーダー, ホバー, disabled, focus-visible）
    - `.diagram-container.diagram-hover .zoom-toolbar` と `.diagram-container.diagram-focused .zoom-toolbar` で `opacity: 1`
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.3 既存の `.zoom-indicator` 関連CSSルールを削除し `.zoom-toolbar` に置き換える
    - `.zoom-indicator` の基本スタイル、`.diagram-container.diagram-focused .zoom-indicator` ルールを削除
    - `@media print` 内の `.zoom-indicator { display: none; }` を `.zoom-toolbar { display: none; }` に変更
    - _要件: 5.5_

- [x] 3. チェックポイント — ツールバー基本機能の確認
  - すべてのテストが通ることを確認し、疑問があればユーザーに確認する。

- [x] 4. SVG高解像度再レンダリングの実装 (preview.js)
  - [x] 4.1 デバウンス制御を実装する
    - `RERENDER_DEBOUNCE_MS = 300` 定数を追加
    - `scheduleRerender(container, state)` 関数を追加（`state._rerenderTimer` でデバウンス管理）
    - `handleWheel()` の末尾で `scheduleRerender()` を呼び出し
    - state初期値に `_rerenderTimer: null` を追加
    - _要件: 4.2_

  - [x] 4.2 ダイアグラムタイプ判別と再レンダリングディスパッチを実装する
    - `getDiagramType(container)` 関数を追加（'mermaid' | 'plantuml' | 'svg' を返す）
    - `.mermaid-host` 子要素で Mermaid 判定、`data-plantuml-src` 属性で PlantUML 判定
    - `triggerSvgRerender(container, state)` 関数を追加（scale===1.0 なら早期リターン）
    - _要件: 4.1_

  - [x] 4.3 Mermaid再レンダリング（クライアントサイド）を実装する
    - `rerenderMermaid(container, state)` async関数を追加
    - `mermaidHost` の `data-mermaid-src` から元ソースを取得し `mermaid.render()` で再生成
    - 新SVGの `width`/`height` を `scale` 倍に設定、`viewBox` を元サイズで設定
    - `mermaidHost.style.transform = 'none'` で CSS transform をリセット
    - 失敗時は `console.error` でログ出力し CSS transform フォールバックを維持
    - _要件: 4.3, 4.4, 4.5, 4.6_

  - [x] 4.4 PlantUML再レンダリング（postMessageリクエスト送信）を実装する
    - `rerenderPlantUml(container, state)` 関数を追加
    - `data-plantuml-src` 属性からソースを取得
    - コンテナに動的IDを付与（`plantuml-${Date.now()}-${random}`）
    - `vscode.postMessage({ type: 'rerender-plantuml', source, scale, containerId })` を送信
    - _要件: 4.3_

  - [x] 4.5 PlantUML再レンダリング結果のメッセージハンドラを実装する
    - `handlePlantUmlRerenderResult(message)` 関数を追加
    - `window.addEventListener('message', ...)` の既存ハンドラ内に `rerender-plantuml-result` 分岐を追加
    - 成功時: `container.querySelector('svg').outerHTML = message.svg` で置換、transform リセット
    - 失敗時: 何もしない（CSS transform フォールバック維持）
    - _要件: 4.4, 4.5, 4.6_

  - [x] 4.6 `resetZoom()` 内で `triggerSvgRerender()` を呼び出すよう更新する
    - リセット時にもscale=1.0で再レンダリングをトリガー（元サイズSVGに復元）
    - _要件: 3.4, 4.1_

  - [x] 4.7 新しい関数群を `export` 文に追加する（`scheduleRerender`, `getDiagramType`, `triggerSvgRerender`, `rerenderMermaid`, `rerenderPlantUml`, `handlePlantUmlRerenderResult`, `RERENDER_DEBOUNCE_MS`）
    - _要件: —_

- [x] 5. PlantUMLソース属性の付与 (renderMarkdown.ts) とメッセージハンドラ (webviewPanel.ts)
  - [x] 5.1 `renderMarkdown.ts` の PlantUML ブロック処理を変更する
    - 成功時の `replacement` に `data-plantuml-src="${encodeURIComponent(block.content)}"` 属性を追加
    - `<div class="diagram-container" data-plantuml-src="...">` の形式にする
    - _要件: 4.3_

  - [x] 5.2 `webviewPanel.ts` に PlantUML 再レンダリングメッセージハンドラを追加する
    - `onDidReceiveMessage` コールバックに `msg.type === 'rerender-plantuml'` 分岐を追加
    - `renderPlantUml(msg.source, context)` を呼び出し、結果を `rerender-plantuml-result` メッセージで返信
    - レスポンスに `ok`, `svg`（成功時のみ）, `containerId` を含める
    - 既存パネルと新規パネルの両方の `messageSubscription` に追加
    - _要件: 4.3, 4.5, 4.6_

- [x] 6. チェックポイント — 再レンダリング機能の確認
  - すべてのテストが通ることを確認し、疑問があればユーザーに確認する。

- [x] 7. 既存テストの更新と新規ユニットテスト
  - [x] 7.1 `zoomPanController.property.test.ts` のProperty 7を更新する
    - `.zoom-indicator` セレクタを `.zoom-toolbar-level` に変更
    - `querySelector` モック内の `.zoom-indicator` 判定を `.zoom-toolbar-level` に変更
    - テストが `.zoom-toolbar-level` のテキスト内容を検証するよう修正
    - _要件: 2.1, 2.3_

  - [x] 7.2 DOMモック (`makeDomElement`) を拡張して `.zoom-toolbar` 関連セレクタをサポートする
    - `.zoom-toolbar`, `.zoom-toolbar-level`, `.zoom-toolbar-reset` の querySelector 対応
    - button要素の `disabled` プロパティサポート
    - _要件: —_

  - [x] 7.3 ツールバーDOM構造のユニットテストを作成する
    - `createZoomToolbar()` が正しいDOM構造を生成することを検証
    - `role="toolbar"`, `aria-label` 属性の存在を検証
    - リセットボタンの `aria-label`, `title` 属性を検証
    - リセットボタンの `stopPropagation` 動作を検証
    - _要件: 1.3, 1.4, 6.1, 6.2_

  - [x] 7.4 `getDiagramType()` のユニットテストを作成する
    - `.mermaid-host` 子要素がある場合に 'mermaid' を返すことを検証
    - `data-plantuml-src` 属性がある場合に 'plantuml' を返すことを検証
    - どちらでもない場合に 'svg' を返すことを検証
    - _要件: 4.1_

  - [x] 7.5 再レンダリング失敗時のフォールバック動作のユニットテストを作成する
    - Mermaid再レンダリング失敗時にCSS transformが維持されることを検証
    - PlantUML結果メッセージで `ok: false` の場合にDOMが変更されないことを検証
    - _要件: 4.6_

- [x] 8. プロパティベーステストの追加
  - [x] 8.1 Property 1: ホバー表示のラウンドトリップ
    - **Property 1: ホバー表示のラウンドトリップ**
    - *For any* diagram container に対し、mouseenter後に `diagram-hover` クラスが存在し、mouseleave後に除去されることを検証
    - 既存 `zoomPanController.property.test.ts` に追加
    - **検証対象: 要件 1.1, 1.2**

  - [x] 8.2 Property 2: ズームインジケーターのパーセンテージ表示
    - **Property 2: ズームインジケーターのパーセンテージ表示**
    - *For any* scale値 (MIN_SCALE ≤ scale ≤ MAX_SCALE) に対し、applyTransform実行後の `.zoom-toolbar-level` テキストが `Math.round(scale * 100) + "%"` と一致することを検証
    - 既存Property 7の拡張として実装（`.zoom-toolbar-level` セレクタに対応）
    - **検証対象: 要件 2.1, 2.2, 2.3**

  - [x] 8.3 Property 3: リセットボタンによる任意状態からの復元
    - **Property 3: リセットボタンによる任意状態からの復元**
    - *For any* ZoomState (任意のscale, translateX, translateY) に対し、resetZoom実行後のstateが `{scale: 1.0, translateX: 0, translateY: 0}` となることを検証
    - **検証対象: 要件 3.2, 3.3, 3.4**

  - [x] 8.4 Property 4: リセットボタンの無効化状態の双条件
    - **Property 4: リセットボタンの無効化状態の双条件**
    - *For any* ZoomState に対し、applyTransform実行後のリセットボタン `.disabled` が `isDefaultZoomState(state)` と同値であることを検証
    - **検証対象: 要件 3.5**

  - [x] 8.5 Property 5: 再レンダリングトリガー条件
    - **Property 5: 再レンダリングトリガー条件**
    - *For any* scale値に対し、`triggerSvgRerender` が `scale !== 1.0` の場合にのみ再レンダリング処理を実行することを検証
    - **検証対象: 要件 4.1**

  - [x] 8.6 Property 6: デバウンスによる再レンダリング統合
    - **Property 6: デバウンスによる再レンダリング統合**
    - *For any* N個 (N ≥ 1) のデバウンス間隔内ズーム操作シーケンスに対し、再レンダリングが最後の操作後に正確に1回だけ実行されることを検証
    - `vi.useFakeTimers()` を使用してデバウンスタイミングを制御
    - **検証対象: 要件 4.2**

- [x] 9. 最終チェックポイント — 全テストの通過確認
  - すべてのユニットテスト・プロパティテストが通ることを確認する。
  - TypeScript型チェック / lint にエラーがないことを確認する。
  - 疑問があればユーザーに確認する。

## 備考

- `*` が付いたタスクはオプションであり、MVP優先時はスキップ可能
- 各タスクは具体的な要件番号を参照し、トレーサビリティを確保
- チェックポイントで段階的な品質検証を実施
- プロパティテストは設計書の Correctness Properties セクションに定義された6つの特性を検証
- ユニットテストは具体的なエッジケースと特定の動作を検証
