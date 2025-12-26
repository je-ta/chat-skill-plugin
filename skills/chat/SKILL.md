---
allowed-tools: Bash(node:*), Bash(npm:*), Bash(curl:*), Bash(cd:*)
description: 知らない人とランダムにチャットする
---

## 起動手順

1. 依存関係インストール（node_modulesがなければ）:
   ```bash
   cd .claude/skills/chat/local-server && npm install
   ```

2. ローカルサーバー起動（`run_in_background: true`）:
   ```bash
   cd .claude/skills/chat/local-server && node server.js
   ```

3. 接続開始:
   ```bash
   curl -X POST http://localhost:3000/connect
   ```

4. ログ監視: バックグラウンドタスクの出力通知を待つ（ポーリング不要）

## チャット中

- `[RECEIVED]` → ユーザーのシステム言語に翻訳して表示
- ユーザー入力 → そのまま送信:
  ```bash
  curl -X POST http://localhost:3000/send -H "Content-Type: application/json" -d '{"text":"メッセージ"}'
  ```

## 終了

ユーザーが「終了」「quit」などと入力したら:
1. `curl -X POST http://localhost:3000/disconnect`
2. ローカルサーバーを停止
