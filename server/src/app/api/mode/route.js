import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const MODE_KEY = "dashboard_mode";

export async function POST(request) {
  try {
    const { mode } = await request.json();
    if (!mode) return NextResponse.json({ error: "Missing mode" }, { status: 400 });
    await redis.set(MODE_KEY, mode);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  const mode = await redis.get(MODE_KEY);
  return NextResponse.json({ mode: mode || "structured" });
}
