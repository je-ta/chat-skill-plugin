// send-message.cjs
// UTF-8でメッセージを送信するスクリプト
//
// 使用方法:
//   node send-message.cjs "送信するメッセージ"

const http = require("http");

const message = process.argv[2];

if (!message) {
  console.error("Usage: node send-message.cjs <message>");
  process.exit(1);
}

const data = JSON.stringify({ text: message });

const req = http.request(
  {
    hostname: "localhost",
    port: 3000,
    path: "/send",
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(data, "utf8"),
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => {
      body += chunk;
    });
    res.on("end", () => {
      try {
        const result = JSON.parse(body);
        if (result.message) {
          console.log(result.message);
        } else if (result.error) {
          console.error("ERROR:", result.error);
          process.exit(1);
        }
      } catch {
        console.log(body);
      }
    });
  }
);

req.on("error", (e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});

req.write(data, "utf8");
req.end();
