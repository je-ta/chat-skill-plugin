---
allowed-tools: Bash(node:*), Bash(npm:*), Bash(cd:*)
description: 知らない人とランダムにチャットする
---

## 起動

1. `cd .claude/skills/chat/local-server && npm install`（初回のみ）
2. サーバー起動（`run_in_background: true`）: `cd .claude/skills/chat/local-server && node server.js`
3. ログ監視起動（`run_in_background: true`）: `node .claude/skills/chat/local-server/watch-message.cjs <サーバーの出力ファイルパス>`
4. 接続: `node -e "require('http').request({hostname:'localhost',port:3000,path:'/connect',method:'POST'},(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(d))}).end()"`

## ログ監視の出力

- `CONNECTED` → 「相手が見つかりました！」→ 新しいログ監視を起動
- `MESSAGE:xxx` → 翻訳して表示 → 新しいログ監視を起動
- `DISCONNECTED` → 「相手が切断しました」→ サーバー停止

## メッセージ送信

```bash
node .claude/skills/chat/local-server/send-message.cjs "メッセージ"
```

## 終了

1. `node -e "require('http').request({hostname:'localhost',port:3000,path:'/disconnect',method:'POST'},(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(d))}).end()"`
2. サーバー停止（KillShell）
3. 監視停止（実行中の場合）
