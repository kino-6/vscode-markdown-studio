# 要件定義書

## はじめに

ダイアグラムコンテナにミニマルなツールバーオーバーレイを追加する機能。現在のズームレベル表示、100%リセットボタン、およびズーム時のSVG高解像度再レンダリングを提供する。GitHubの画像ズームコントロールに類似した、控えめで直感的なUIを目指す。

## 用語集

- **Diagram_Container**: ダイアグラム（Mermaid/PlantUML）のSVGを内包する `.diagram-container` 要素
- **Zoom_Toolbar**: Diagram_Container上に表示されるオーバーレイUI。ズームレベル表示とリセットボタンを含む
- **Zoom_Level_Indicator**: 現在のズーム倍率をパーセンテージで表示するラベル（例: "150%"）
- **Reset_Button**: ズームを1.0倍、パンを原点(0,0)にリセットするボタン
- **Zoom_State**: Diagram_Containerごとに保持されるズーム倍率（scale）とパン位置（translateX, translateY）の状態
- **SVG_Rerender**: ズーム変更時にCSS transformによるスケーリングではなく、新しい解像度でSVGを再生成する処理
- **Preview_JS**: Webviewプレビュー内で動作するクライアントサイドスクリプト（media/preview.js）

## 要件

### 要件1: ズームツールバーの表示

**ユーザーストーリー:** 開発者として、ダイアグラムにホバーまたはフォーカスした際にズームツールバーを確認したい。これにより、現在のズーム状態を把握し操作できるようになる。

#### 受け入れ基準

1. WHEN ユーザーがDiagram_Containerにマウスカーソルを合わせた時、THE Zoom_Toolbar SHALL フェードインで表示される
2. WHEN ユーザーがDiagram_Containerからマウスカーソルを離した時、THE Zoom_Toolbar SHALL フェードアウトで非表示になる
3. THE Zoom_Toolbar SHALL Diagram_Containerの右上隅にオーバーレイとして配置される
4. THE Zoom_Toolbar SHALL ダイアグラムのコンテンツを大きく遮らない最小限のサイズで表示される
5. THE Zoom_Toolbar SHALL ライトテーマとダークテーマの両方で視認可能なスタイルを持つ

### 要件2: ズームレベルインジケーター

**ユーザーストーリー:** 開発者として、現在のダイアグラムのズーム倍率を常に確認したい。これにより、表示状態を正確に把握できる。

#### 受け入れ基準

1. THE Zoom_Level_Indicator SHALL 現在のZoom_Stateのscale値をパーセンテージ形式（例: "100%", "150%", "250%"）で表示する
2. WHEN Zoom_Stateのscale値が変更された時、THE Zoom_Level_Indicator SHALL 表示値を即座に更新する
3. THE Zoom_Level_Indicator SHALL scale値を整数に丸めてパーセンテージとして表示する（例: scale 1.5 → "150%"）

### 要件3: 100%リセットボタン

**ユーザーストーリー:** 開発者として、ワンクリックでダイアグラムのズームとパンを初期状態に戻したい。これにより、迷子になった表示を素早く復元できる。

#### 受け入れ基準

1. THE Zoom_Toolbar SHALL "100%にリセット"の機能を持つReset_Buttonを含む
2. WHEN ユーザーがReset_Buttonをクリックした時、THE Zoom_State SHALL scale値を1.0に設定する
3. WHEN ユーザーがReset_Buttonをクリックした時、THE Zoom_State SHALL translateXとtranslateYを0に設定する
4. WHEN ユーザーがReset_Buttonをクリックした時、THE Preview_JS SHALL リセット後のZoom_Stateに基づいてDiagram_Containerの表示を更新する
5. WHEN Zoom_Stateのscale値が既に1.0かつtranslateXとtranslateYが共に0の場合、THE Reset_Button SHALL 無効化された外観で表示される

### 要件4: SVG高解像度再レンダリング

**ユーザーストーリー:** 開発者として、ダイアグラムをズームインした際に鮮明な表示を得たい。CSS transformによるスケーリングではぼやけるため、新しい解像度でSVGを再生成してほしい。

#### 受け入れ基準

1. WHEN ズーム操作が完了しscale値が1.0以外に変更された時、THE Preview_JS SHALL SVG_Rerenderを開始する
2. THE SVG_Rerender SHALL ズーム操作完了後にデバウンス処理を適用し、連続的なズーム操作中の不要な再レンダリングを防止する
3. WHEN SVG_Rerenderが実行される時、THE Preview_JS SHALL 新しいscale値に対応した解像度でMermaidダイアグラムのSVGを再生成する
4. WHILE SVG_Rerenderが進行中の場合、THE Preview_JS SHALL 既存のCSS transformによるスケーリング表示を維持する
5. WHEN SVG_Rerenderが完了した時、THE Preview_JS SHALL 再生成されたSVGでDiagram_Container内のコンテンツを置換し、CSS transformをリセットする
6. IF SVG_Rerenderが失敗した場合、THEN THE Preview_JS SHALL CSS transformによるスケーリング表示をフォールバックとして維持する

### 要件5: 既存機能との互換性

**ユーザーストーリー:** 開発者として、新しいツールバーが既存のズーム・パン操作やダブルクリックリセットと競合しないことを期待する。

#### 受け入れ基準

1. THE Zoom_Toolbar SHALL 既存のマウスホイールによるズーム操作を妨げない
2. THE Zoom_Toolbar SHALL 既存のドラッグによるパン操作を妨げない
3. WHEN ユーザーがDiagram_Container上でダブルクリックした時、THE Preview_JS SHALL 既存のリセット動作（scale=1.0, translate=0,0）を維持する
4. WHEN ダブルクリックによるリセットが実行された時、THE Zoom_Level_Indicator SHALL 表示を"100%"に更新する
5. THE Zoom_Toolbar SHALL 印刷時（@media print）に非表示となる

### 要件6: ツールバーのアクセシビリティ

**ユーザーストーリー:** 開発者として、キーボードやスクリーンリーダーでもツールバーを操作できることを期待する。

#### 受け入れ基準

1. THE Reset_Button SHALL キーボードフォーカスを受け取り可能な要素として実装される
2. THE Reset_Button SHALL スクリーンリーダーが読み取れる適切なラベル（aria-label）を持つ
3. WHEN ユーザーがキーボードでDiagram_Containerにフォーカスした時、THE Zoom_Toolbar SHALL 表示される
