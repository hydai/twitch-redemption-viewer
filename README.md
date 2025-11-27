# Twitch報酬引き換えビューアー

Twitch EventSub WebSocketのログファイル（JSON）から、チャンネルポイント報酬の引き換え履歴を抽出・表示するWebアプリケーションです。

## 機能

- JSONファイルのドラッグ＆ドロップまたはファイル選択でアップロード
- 報酬引き換えイベント（REWARD REDEMPTION EVENT）の自動抽出
- テーブル形式での履歴表示
- CSV/Excelファイルへのエクスポート

## 使い方

1. [サイト](https://hydai.github.io/twitch-redemption-viewer/)にアクセス
2. Twitch EventSubのログファイル（JSON）をドラッグ＆ドロップ、または「ファイルを選択」をクリック
3. 引き換え履歴がテーブルに表示されます
4. 必要に応じて「CSVダウンロード」または「Excelダウンロード」でエクスポート

## テーブル列

| 列名 | 説明 |
|------|------|
| 引き換え時間 | 報酬が引き換えられた日時 |
| ユーザー名 | 引き換えたユーザーの表示名 |
| ユーザーID | 引き換えたユーザーのTwitch ID |
| 報酬名 | 引き換えられた報酬の名前 |

## ローカルでの実行

```bash
git clone https://github.com/hydai/twitch-redemption-viewer.git
cd twitch-redemption-viewer
python3 -m http.server 8888
```

ブラウザで http://localhost:8888 を開いてください。

## 技術スタック

- HTML5 / CSS3 / JavaScript (ES6+)
- [SheetJS](https://sheetjs.com/) - Excelファイル生成

## ライセンス

MIT License
