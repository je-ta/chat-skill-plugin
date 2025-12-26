# Local Server

ローカルで起動するチャットサーバー。シグナリングサーバーに接続し、WebRTCでP2P通信を行う。

## セットアップ

```bash
npm install
```

## 起動

```bash
node server.js
```

環境変数:
- `LOCAL_PORT`: HTTPサーバーのポート（デフォルト: 3000）
- `SIGNALING_SERVER_URL`: シグナリングサーバーURL（デフォルト: wss://chat-skill-signaling.deno.dev）

## ログフォーマット

サーバーは以下のフォーマットでログを出力する。スキル（Claude Code等）はこのログを監視してメッセージを受信する。

| タイプ | 説明 | 例 |
|--------|------|-----|
| `[STATUS]` | 状態変化 | `[STATUS] connected` |
| `[RECEIVED]` | メッセージ受信 | `[RECEIVED] Hello!` |
| `[SENT]` | メッセージ送信 | `[SENT] こんにちは` |
| `[INFO]` | 情報 | `[INFO] Client ID: xxx` |
| `[ERROR]` | エラー | `[ERROR] WebSocket error` |

### ステータス一覧

- `ready` - サーバー起動完了
- `connecting` - シグナリングサーバーに接続中
- `waiting` - マッチング待機中
- `matched` - マッチング成功
- `connected` - P2P接続完了、チャット可能
- `peer-disconnected` - 相手が切断
- `disconnected` - 切断完了

## HTTP API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | /connect | シグナリングサーバーに接続開始 |
| POST | /disconnect | 切断 |
| POST | /send | メッセージ送信 |

### POST /connect

シグナリングサーバーに接続してマッチング待機を開始。

### POST /disconnect

P2P接続とシグナリングサーバーから切断。

### POST /send

メッセージを相手に送信。

リクエストボディ:
```json
{
  "text": "送信するメッセージ"
}
```

## 技術スタック

- Node.js
- werift（WebRTC実装）
- ws（WebSocketクライアント）
- STUN: Google公開サーバー
