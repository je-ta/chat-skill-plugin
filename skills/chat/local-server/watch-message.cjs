// watch-message.js
// サーバーのログファイルを監視し、[RECEIVED]、[STATUS] connected、[STATUS] peer-disconnectedが来たら出力して終了
//
// 使用方法:
//   node watch-message.js <ログファイルパス>
//
// 出力形式:
//   MESSAGE:<受信したメッセージ>
//   CONNECTED (接続完了時)
//   DISCONNECTED (相手が切断時)

const fs = require("fs");
const path = require("path");

const logFile = process.argv[2];

if (!logFile) {
  console.error("Usage: node watch-message.js <log-file-path>");
  process.exit(1);
}

// ファイルが存在するまで待機
function waitForFile(filePath, callback) {
  const check = () => {
    if (fs.existsSync(filePath)) {
      callback();
    } else {
      setTimeout(check, 100);
    }
  };
  check();
}

waitForFile(logFile, () => {
  // 現在のファイルサイズを記録
  let lastSize = fs.statSync(logFile).size;

  console.log(`WATCHING:${logFile}`);
  console.log(`START_SIZE:${lastSize}`);

  // ファイルの変更を監視
  const checkForChanges = () => {
    try {
      const currentSize = fs.statSync(logFile).size;

      if (currentSize > lastSize) {
        // 新しい内容を読み取る
        const fd = fs.openSync(logFile, "r");
        const buffer = Buffer.alloc(currentSize - lastSize);
        fs.readSync(fd, buffer, 0, buffer.length, lastSize);
        fs.closeSync(fd);

        const newContent = buffer.toString("utf8");
        const lines = newContent.split("\n");

        for (const line of lines) {
          // メッセージ受信を検知
          const receivedMatch = line.match(/^\[RECEIVED\] (.+)$/);
          if (receivedMatch) {
            console.log(`MESSAGE:${receivedMatch[1]}`);
            process.exit(0);
          }

          // 接続完了を検知
          if (line.includes("[STATUS] connected")) {
            console.log("CONNECTED");
            process.exit(0);
          }

          // 相手の切断を検知
          if (line.includes("[STATUS] peer-disconnected")) {
            console.log("DISCONNECTED");
            process.exit(0);
          }
        }

        lastSize = currentSize;
      }
    } catch (err) {
      // ファイル読み取りエラーは無視
    }

    setTimeout(checkForChanges, 200);
  };

  checkForChanges();
});
