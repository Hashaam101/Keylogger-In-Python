"use client";

import { useEffect, useState, useRef } from "react";

export default function HomePage() {
  const [logs, setLogs] = useState("");
  const [stayAtBottom, setStayAtBottom] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:6699");

    ws.onmessage = async (event) => {
      let message = event.data;

      // Check if the message is a Blob and convert it to text
      if (message instanceof Blob) {
        message = await message.text();
      }

      console.log("WebSocket message received:", message); // Debugging log
      setLogs((prevLogs) => prevLogs + message + "\n"); // Ensure new lines are added
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error); // Debugging log for errors
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (stayAtBottom && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, stayAtBottom]);

  return (
    <div style={{ padding: "0px 0px 0px 12px" }}>
      <h2 style={{ fontFamily: "Consolas", fontWeight: "400" }}>Live Keylogger Logs</h2>
      <button
        style={{
          fontFamily: "Consolas",
          backgroundColor: "#000",
          color: "#fff",
          border: "0.5px dotted #777777",
          padding: "10px 20px",
          cursor: "pointer",
        }}
        onClick={() => setStayAtBottom(!stayAtBottom)}
      >
        {stayAtBottom ? "Disable Stay at Bottom" : "Stay at Bottom"}
      </button>
      <pre style={{ maxHeight: "80vh", overflowY: "auto", whiteSpace: "pre-wrap" }}>{logs}</pre>
      <div ref={logsEndRef}></div>
    </div>
  );
}