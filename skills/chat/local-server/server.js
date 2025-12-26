// ローカルサーバー（各PCで起動）
// シグナリングサーバーに接続し、WebRTCでP2P通信を行う

import http from "node:http";
import { URL } from "node:url";
import { WebSocket } from "ws";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from "werift";

// 設定
const LOCAL_PORT = process.env.LOCAL_PORT || 3000;
const SIGNALING_SERVER_URL =
  process.env.SIGNALING_SERVER_URL || "wss://chat-skill-signaling.deno.dev";

// STUN サーバー
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// 状態管理
const state = {
  status: "disconnected", // disconnected | connecting | waiting | matched | connected
  signalingSocket: null,
  peerConnection: null,
  dataChannel: null,
  clientId: null,
  role: null, // offerer | answerer
  pendingIceCandidates: [],
};

// ログ出力（パース可能なフォーマット）
function log(type, message) {
  console.log(`[${type}] ${message}`);
}

// シグナリングサーバーにメッセージを送信
function sendToSignaling(message) {
  if (state.signalingSocket?.readyState === WebSocket.OPEN) {
    state.signalingSocket.send(JSON.stringify(message));
  }
}

// WebRTC接続を作成
async function createPeerConnection() {
  state.peerConnection = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
  });

  // ICE候補を収集してシグナリングサーバーに送信
  state.peerConnection.onIceCandidate.subscribe((candidate) => {
    if (candidate) {
      sendToSignaling({
        type: "ice-candidate",
        candidate: candidate.toJSON(),
      });
    }
  });

  // 接続状態の監視
  state.peerConnection.onConnectionStateChange.subscribe(() => {
    const connState = state.peerConnection?.connectionState;
    log("INFO", `Connection state: ${connState}`);
    if (connState === "connected") {
      state.status = "connected";
      log("STATUS", "connected");
    } else if (connState === "failed" || connState === "disconnected") {
      log("INFO", "P2P connection failed, requesting rematch...");
      sendToSignaling({ type: "rematch" });
    }
  });

  // DataChannelを受信（answerer側）
  state.peerConnection.onDataChannel.subscribe((channel) => {
    log("INFO", "Received data channel");
    setupDataChannel(channel);
  });
}

// DataChannelをセットアップ
function setupDataChannel(channel) {
  state.dataChannel = channel;

  channel.onMessage.subscribe((data) => {
    const text =
      typeof data === "string" ? data : new TextDecoder().decode(data);
    log("RECEIVED", text);
  });

  channel.onOpen.subscribe(() => {
    log("INFO", "Data channel opened");
    state.status = "connected";
    log("STATUS", "connected");
  });

  channel.onClose.subscribe(() => {
    log("INFO", "Data channel closed");
  });
}

// Offerを作成して送信
async function createAndSendOffer() {
  if (!state.peerConnection) return;

  // DataChannelを作成（offerer側）
  const channel = state.peerConnection.createDataChannel("chat");
  setupDataChannel(channel);

  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);

  sendToSignaling({
    type: "offer",
    sdp: offer.sdp,
  });
}

// Answerを作成して送信
async function createAndSendAnswer() {
  if (!state.peerConnection) return;

  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);

  sendToSignaling({
    type: "answer",
    sdp: answer.sdp,
  });
}

// 保留中のICE候補を適用
async function applyPendingIceCandidates() {
  if (!state.peerConnection) return;

  for (const candidate of state.pendingIceCandidates) {
    try {
      await state.peerConnection.addIceCandidate(candidate);
    } catch (e) {
      log("ERROR", `Failed to add ICE candidate: ${e.message}`);
    }
  }
  state.pendingIceCandidates = [];
}

// シグナリングサーバーからのメッセージを処理
async function handleSignalingMessage(data) {
  let message;

  try {
    message = JSON.parse(data);
  } catch {
    log("ERROR", "Invalid JSON from signaling server");
    return;
  }

  log("INFO", `Signaling: ${message.type}`);

  switch (message.type) {
    case "connected":
      state.clientId = message.id;
      log("INFO", `Client ID: ${state.clientId}`);
      // 自動的にマッチング待機を開始
      sendToSignaling({ type: "join" });
      break;

    case "waiting":
      state.status = "waiting";
      log("STATUS", "waiting");
      break;

    case "matched":
      state.status = "matched";
      state.role = message.role;
      log("STATUS", "matched");
      log("INFO", `Role: ${state.role}`);

      // WebRTC接続を作成
      await createPeerConnection();

      // Offererの場合はOfferを送信
      if (state.role === "offerer") {
        await createAndSendOffer();
      }
      break;

    case "offer":
      if (!state.peerConnection) {
        await createPeerConnection();
      }
      await state.peerConnection.setRemoteDescription(
        new RTCSessionDescription(message.sdp, "offer")
      );
      await applyPendingIceCandidates();
      await createAndSendAnswer();
      break;

    case "answer":
      if (state.peerConnection) {
        await state.peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.sdp, "answer")
        );
        await applyPendingIceCandidates();
      }
      break;

    case "ice-candidate":
      if (message.candidate) {
        const candidate = new RTCIceCandidate(message.candidate);
        if (state.peerConnection?.remoteDescription) {
          await state.peerConnection.addIceCandidate(candidate);
        } else {
          state.pendingIceCandidates.push(candidate);
        }
      }
      break;

    case "peer-disconnected":
      log("STATUS", "peer-disconnected");
      state.status = "waiting";
      state.dataChannel = null;
      state.peerConnection?.close();
      state.peerConnection = null;
      // 自動的に再マッチング
      sendToSignaling({ type: "join" });
      break;

    case "left":
      log("INFO", "Left the matching pool");
      break;
  }
}

// シグナリングサーバーに接続
function connectToSignaling() {
  if (state.signalingSocket) {
    state.signalingSocket.close();
  }

  state.status = "connecting";
  log("STATUS", "connecting");
  log("INFO", `Signaling server: ${SIGNALING_SERVER_URL}`);

  state.signalingSocket = new WebSocket(SIGNALING_SERVER_URL);

  state.signalingSocket.on("open", () => {
    log("INFO", "Connected to signaling server");
  });

  state.signalingSocket.on("message", (data) => {
    handleSignalingMessage(data.toString());
  });

  state.signalingSocket.on("close", () => {
    log("STATUS", "disconnected");
    state.status = "disconnected";
  });

  state.signalingSocket.on("error", (error) => {
    log("ERROR", `WebSocket error: ${error.message}`);
  });
}

// 切断
function disconnect() {
  if (state.dataChannel) {
    state.dataChannel.close();
    state.dataChannel = null;
  }

  if (state.peerConnection) {
    state.peerConnection.close();
    state.peerConnection = null;
  }

  if (state.signalingSocket) {
    sendToSignaling({ type: "leave" });
    state.signalingSocket.close();
    state.signalingSocket = null;
  }

  state.status = "disconnected";
  state.clientId = null;
  state.role = null;
  log("STATUS", "disconnected");
}

// メッセージを送信
function sendMessage(text) {
  if (state.status !== "connected" || !state.dataChannel) {
    return false;
  }

  try {
    state.dataChannel.send(text);
    log("SENT", text);
    return true;
  } catch (e) {
    log("ERROR", `Failed to send: ${e.message}`);
    return false;
  }
}

// JSONレスポンスを作成
function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

// HTTPリクエスト処理
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${LOCAL_PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // 接続開始
  if (url.pathname === "/connect" && req.method === "POST") {
    if (state.status !== "disconnected") {
      return jsonResponse(res, 400, {
        error: "Already connected or connecting",
      });
    }

    connectToSignaling();
    return jsonResponse(res, 200, { message: "Connecting..." });
  }

  // 切断
  if (url.pathname === "/disconnect" && req.method === "POST") {
    disconnect();
    return jsonResponse(res, 200, { message: "Disconnected" });
  }

  // メッセージ送信
  if (url.pathname === "/send" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      const { text } = JSON.parse(body);
      if (!text) {
        return jsonResponse(res, 400, { error: "Text is required" });
      }

      if (sendMessage(text)) {
        return jsonResponse(res, 200, { message: "Sent" });
      } else {
        return jsonResponse(res, 400, { error: "Not connected" });
      }
    } catch {
      return jsonResponse(res, 400, { error: "Invalid JSON" });
    }
  }

  return jsonResponse(res, 404, { error: "Not found" });
}

// サーバー起動
const server = http.createServer(handleRequest);

server.listen(LOCAL_PORT, () => {
  log("INFO", `Server running on port ${LOCAL_PORT}`);
  log("INFO", `Signaling: ${SIGNALING_SERVER_URL}`);
  log("STATUS", "ready");
});
