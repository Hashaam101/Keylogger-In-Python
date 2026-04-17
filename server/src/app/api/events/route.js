import { Redis } from "@upstash/redis";

export const runtime = "nodejs"; // Required for SSE on Vercel

const redis = Redis.fromEnv();
const LOG_KEY = "keystrokes";

export async function GET(req) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Write SSE headers
  writer.write(encoder.encode("retry: 2000\n"));

  let lastIdx = -1;
  async function sendNewLogs() {
    try {
      const logs = await redis.lrange(LOG_KEY, -20, -1);
      if (logs.length > 0) {
        for (let i = lastIdx + 1; i < logs.length; i++) {
          writer.write(encoder.encode(`data: ${logs[i]}\n\n`));
        }
        lastIdx = logs.length - 1;
      }
    } catch {}
  }

  // Poll for new logs every 2s
  const interval = setInterval(sendNewLogs, 2000);
  req.signal.addEventListener("abort", () => {
    clearInterval(interval);
    writer.close();
  });
  await sendNewLogs();
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
