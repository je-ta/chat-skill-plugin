# Chat Skill Plugin

知らない人とランダムにチャットするClaude Codeプラグイン。

## 必要環境

- Claude Code
- Node.js 18以上

## インストール

Claude Codeで以下のコマンドを実行：

```
/plugin marketplace add je-ta/chat-skill-plugin
/plugin install chat-skill@chat-skill-plugin
```

インストール後に「no content」と表示されますが、インストールは成功しています。

インストール後はClaude Codeを再起動してください。

## 使い方

Claude Codeで `/chat` と入力するとスキルが起動します。

- チャット相手が見つかるまで待機
- メッセージを入力すると相手に送信
- 「終了」または「quit」と入力すると終了

## 仕組み

- WebRTCでP2P接続
- シグナリングサーバー経由でマッチング
- メッセージはLLMが自動翻訳

## ライセンス

MIT
