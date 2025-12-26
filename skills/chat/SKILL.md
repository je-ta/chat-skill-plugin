---
allowed-tools: Bash(node:*), Bash(npm:*), Bash(curl:*), Bash(cd:*), Bash(powershell:*)
description: 知らない人とランダムにチャットする
---

## アーキテクチャ（デュアルバックグラウンド方式）

```
┌─────────────────────────────────────────────────────────────┐
│ メインClaude Code                                           │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ バックグラウンド1  │    │ バックグラウンド2             │  │
│  │ (サーバー)        │───▶│ (ログ監視)                   │  │
│  │ node server.js   │log │ [RECEIVED]検知で終了         │  │
│  │ 継続実行          │    │ → メッセージを返す            │  │
│  └──────────────────┘    └──────────────────────────────┘  │
│                                    │                        │
│                                    ▼ 終了検知               │
│                          1. すぐに新しい監視を起動          │
│                          2. メッセージをユーザーに表示      │
└─────────────────────────────────────────────────────────────┘
```

**ポイント**: バックグラウンド2が終了したら、**先に新しい監視を起動**してからメッセージ表示

## 起動手順

1. 依存関係インストール（node_modulesがなければ）:
   ```bash
   cd .claude/skills/chat/local-server && npm install
   ```

2. **バックグラウンド1**: ローカルサーバー起動（`run_in_background: true`）:
   ```bash
   cd .claude/skills/chat/local-server && node server.js
   ```

3. 接続開始:
   ```bash
   curl -X POST http://localhost:3000/connect
   ```

4. **バックグラウンド2**: ログ監視スクリプト起動（`run_in_background: true`）:
   ```bash
   node .claude/skills/chat/local-server/watch-message.cjs <ログファイルパス>
   ```
   ※ ログファイルパスはバックグラウンド1の出力ファイル

5. `TaskOutput`（`block: true`）でバックグラウンド2の終了を待機

6. 終了検知時:
   - **即座に新しいバックグラウンド2を起動**（メッセージの取りこぼし防止）
   - 出力からメッセージを抽出してユーザーに表示（翻訳）

## チャット中

**メッセージ受信時（バックグラウンド2終了時）:**
1. 新しいバックグラウンド2を起動
2. 出力から `MESSAGE:xxx` を抽出
3. ユーザーのシステム言語に翻訳して表示

**ユーザーがメッセージ送信時:**
```bash
curl -X POST http://localhost:3000/send -H "Content-Type: application/json" -d '{"text":"メッセージ"}'
```
- 翻訳せずにそのまま送信

## 終了

ユーザーが「終了」「quit」などと入力したら:
1. `curl -X POST http://localhost:3000/disconnect`
2. バックグラウンド1（サーバー）を停止
3. バックグラウンド2（監視）を停止（実行中の場合）
