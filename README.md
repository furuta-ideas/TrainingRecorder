# ジムトレーニングアプリ

iPhone・iPad向けの半自動トレーニングアプリです。公開URLは https://furuta-ideas.github.io/TrainingRecorder/ です。`main` へ push すると GitHub Actions（`.github/workflows/pages.yml`）が `dist/` を自動で公開します。

## 動作

- 起動時に仕様書のオープニング画像を3秒表示します。
- 最初に「トレーニング開始」を1回押すと、15種目を現在の並び順で連続実行します。
- 各種目は5秒を1目盛りとし、最大2分のタイムラインで現在位置を示します。
- 1分種目は前半12目盛り、2分種目は24目盛りを使用します。
- 種目が終了すると次の種目へ自動的に移動し、最後の種目で完了画面を表示します。
- 音声、ログ、メール送信は使用しません。

## 編集と並べ替え

黄色のメモ欄を押すと、現在の種目名とメモを編集できます。変更は端末の `localStorage` に保存されます。上段の種目名を押すと一覧が開き、種目選択とドラッグハンドルによる並べ替えができます。旧バージョンの保存済み種目名・メモ・順序は初回起動時に移行します。

## 端末間の共有

種目一覧の「端末間で共有…」から、スマホとiPadで同じ合言葉（8文字以上）を設定すると、種目名・メモ・並び順が自動で同期されます。データは Cloudflare Worker（`sync-worker/`、https://training-recorder-sync.furuta-ideas.workers.dev ）の KV に、合言葉のハッシュをキーにして保存します。合言葉そのものは送信・保存しません。起動時、画面に戻ったとき、1分ごとに最新の内容を取得し、更新時刻が新しい方を採用します（トレーニング実施中は取得しません）。

Worker の公開は `sync-worker` フォルダで `wrangler deploy` を実行します（アプリ本体と違い、push では自動公開されません）。

## データ

- `dist/training-config.js`: 15種目の名称、メモ、時間、5秒単位の進行内容
- `dist/menus.json`: 教材ファイルと種目ID
- `dist/media/`: 静止画15点、動画11点

種目IDと教材の対応を保つため、既存IDは変更しないでください。

## 検証とビルド

```powershell
node --test tests/*.test.js
node scripts/build-worker.mjs
node scripts/validate-worker.mjs
```

テストは15種目、教材数、1分・2分の目盛り数、5秒ごとの現在位置、並べ替え、公開Workerの応答を確認します。
