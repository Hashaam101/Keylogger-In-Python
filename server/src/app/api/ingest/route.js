import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const LOG_KEY = "keystrokes";
const MODE_KEY = "dashboard_mode";

export async function POST(request) {
  try {
    const body = await request.json();
    const { device, data, timestamp } = body;
    if (!data) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    // Append log entry to Redis list
    await redis.rpush(LOG_KEY, JSON.stringify({
      device,
      data,
      timestamp: timestamp || Date.now(),
      serverTimestamp: Date.now(),
    }));

    // Read current mode from Redis
    let mode = await redis.get(MODE_KEY);
    if (!mode) mode = "structured";
    return NextResponse.json({ ok: true, mode });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Optionally, support GET for debugging
export async function GET() {
  const logs = await redis.lrange(LOG_KEY, -100, -1);
  return NextResponse.json({ logs: logs.map(JSON.parse) });
}
