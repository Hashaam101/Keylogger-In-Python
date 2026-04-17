"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

function decodeBufferPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (payload.type === "Buffer" && Array.isArray(payload.data)) {
    const bytes = new Uint8Array(payload.data);
    return new TextDecoder().decode(bytes);
  }

  return payload;
}

function normalizeStructuredText(data) {
  const decoded = decodeBufferPayload(data);

  if (typeof decoded === "string") {
    return decoded;
  }

  if (Array.isArray(decoded)) {
    return decoded.map((item) => String(item)).join(" ");
  }

  if (decoded && typeof decoded === "object") {
    return Object.entries(decoded)
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join("\n");
  }

  return String(decoded ?? "");
}

function formatRelative(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  if (s < 1) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ago`;
}

function positionPanel(rect, panelWidth, estHeight) {
  const margin = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  let left = rect.right - panelWidth;
  if (left < margin) left = margin;
  if (left + panelWidth > vw - margin) left = vw - panelWidth - margin;
  let top = rect.top + margin;
  if (top + estHeight > vh - margin) top = Math.max(margin, rect.bottom - estHeight);
  return { top, left };
}

function EntryInfoPanel({ log, now, rect, variant = "info" }) {
  if (!log || !rect) return null;

  const isCompact = Array.isArray(log.timestamps) && log.timestamps.length > 1;

  if (variant === "timestamps") {
    const panelWidth = 260;
    const estHeight = Math.min(320, 56 + log.timestamps.length * 18);
    const { top, left } = positionPanel(rect, panelWidth, estHeight);
    return (
      <div
        className="entry-info entry-info-floating"
        role="tooltip"
        style={{ top: `${top}px`, left: `${left}px`, width: `${panelWidth}px` }}
      >
        <div className="ei-row">
          <span className="ei-k">Occurrences</span>
          <span className="ei-v">{log.timestamps.length}</span>
        </div>
        <div className="ei-sep" />
        <div className="ei-timestamps">
          {log.timestamps.map((ts, i) => (
            <div key={`${ts}-${i}`} className="ei-ts-row">
              <span className="ei-ts-idx">#{i + 1}</span>
              <span className="ei-ts-val">{new Date(ts).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const base = now ?? Date.now();
  const firstDeviceTs = isCompact ? log.startDeviceTs : log.deviceTs;
  const lastDeviceTs = isCompact ? log.endDeviceTs : log.deviceTs;
  const firstServerTs = isCompact ? log.startServerTs : log.serverTs;
  const lastServerTs = isCompact ? log.endServerTs : log.serverTs;
  const delivery = lastServerTs - lastDeviceTs;
  const deliveryLabel =
    delivery >= 0
      ? `${delivery < 1000 ? `${delivery}ms` : `${(delivery / 1000).toFixed(2)}s`}`
      : `${Math.abs(delivery)}ms (clock skew)`;

  const panelWidth = 320;
  const { top, left } = positionPanel(rect, panelWidth, 260);

  return (
    <div
      className="entry-info entry-info-floating"
      role="tooltip"
      style={{ top: `${top}px`, left: `${left}px`, width: `${panelWidth}px` }}
    >
      <div className="ei-row">
        <span className="ei-k">Logged</span>
        <span className="ei-v">{formatRelative(base - lastDeviceTs)}</span>
      </div>
      {isCompact ? (
        <>
          <div className="ei-row">
            <span className="ei-k">First device</span>
            <span className="ei-v">{new Date(firstDeviceTs).toLocaleString()}</span>
          </div>
          <div className="ei-row">
            <span className="ei-k">Last device</span>
            <span className="ei-v">{new Date(lastDeviceTs).toLocaleString()}</span>
          </div>
          <div className="ei-row">
            <span className="ei-k">First received</span>
            <span className="ei-v">{new Date(firstServerTs).toLocaleString()}</span>
          </div>
          <div className="ei-row">
            <span className="ei-k">Last received</span>
            <span className="ei-v">{new Date(lastServerTs).toLocaleString()}</span>
          </div>
        </>
      ) : (
        <>
          <div className="ei-row">
            <span className="ei-k">Device time</span>
            <span className="ei-v">{new Date(log.deviceTs).toLocaleString()}</span>
          </div>
          <div className="ei-row">
            <span className="ei-k">Server received</span>
            <span className="ei-v">{new Date(log.serverTs).toLocaleString()}</span>
          </div>
        </>
      )}
      <div className="ei-row">
        <span className="ei-k">Delivery</span>
        <span className="ei-v">{deliveryLabel}</span>
      </div>
      {log.device ? (
        <>
          <div className="ei-sep" />
          <div className="ei-row">
            <span className="ei-k">Host</span>
            <span className="ei-v">{log.device.hostname}</span>
          </div>
          <div className="ei-row">
            <span className="ei-k">User</span>
            <span className="ei-v">{log.device.username}</span>
          </div>
          <div className="ei-row">
            <span className="ei-k">Platform</span>
            <span className="ei-v">
              {log.device.platform} {log.device.platformVersion}
            </span>
          </div>
          <div className="ei-row">
            <span className="ei-k">Device ID</span>
            <span className="ei-v ei-mono">{log.device.id}</span>
          </div>
        </>
      ) : null}
      {log.combo ? (
        <div className="ei-row">
          <span className="ei-k">Type</span>
          <span className="ei-v">Keyboard shortcut</span>
        </div>
      ) : null}
    </div>
  );
}

function collapseSegments(segs) {
  const out = [];
  for (const s of segs) {
    if (!s.text) continue;
    const last = out[out.length - 1];
    if (last && !!last.deleted === !!s.deleted) {
      last.text += s.text;
    } else {
      out.push({ text: s.text, deleted: !!s.deleted });
    }
  }
  return out;
}

function editPreviousInsert(segments, offset, text) {
  if (!text) return segments;
  const segs = segments.map((s) => ({ ...s }));
  let remaining = Math.max(0, offset);
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].deleted) continue;
    const len = segs[i].text.length;
    if (remaining <= len) {
      const before = segs[i].text.slice(0, remaining);
      const after = segs[i].text.slice(remaining);
      const replacement = [{ text: before + text, deleted: false }];
      if (after) replacement.push({ text: after, deleted: false });
      segs.splice(i, 1, ...replacement);
      return collapseSegments(segs);
    }
    remaining -= len;
  }
  segs.push({ text, deleted: false });
  return collapseSegments(segs);
}

function editPreviousDelete(segments, offset, count) {
  if (count <= 0) return segments;
  const segs = segments.map((s) => ({ ...s }));
  let startRemaining = Math.max(0, offset);
  let i = 0;
  while (i < segs.length && startRemaining > 0) {
    if (segs[i].deleted) { i++; continue; }
    const len = segs[i].text.length;
    if (startRemaining < len) break;
    startRemaining -= len;
    i++;
  }
  let deleteRemaining = count;
  while (i < segs.length && deleteRemaining > 0) {
    if (segs[i].deleted) { i++; continue; }
    const seg = segs[i];
    const available = seg.text.length - startRemaining;
    if (available <= 0) { i++; startRemaining = 0; continue; }
    const take = Math.min(deleteRemaining, available);
    const before = seg.text.slice(0, startRemaining);
    const removed = seg.text.slice(startRemaining, startRemaining + take);
    const after = seg.text.slice(startRemaining + take);
    const replacement = [];
    if (before) replacement.push({ text: before, deleted: false });
    replacement.push({ text: removed, deleted: true });
    if (after) replacement.push({ text: after, deleted: false });
    segs.splice(i, 1, ...replacement);
    i += replacement.length;
    startRemaining = 0;
    deleteRemaining -= take;
  }
  return collapseSegments(segs);
}

function findLastStructuredIndex(logs, deviceId) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i];
    if (l.kind !== "structured" || l.combo) continue;
    const lid = l.device?.id ?? null;
    if (lid !== (deviceId ?? null)) continue;
    return i;
  }
  return -1;
}

function applyEditPrevious(logs, msg, deviceId) {
  const idx = findLastStructuredIndex(logs, deviceId);
  if (idx === -1) return logs;
  const target = logs[idx];
  const baseSegs = target.segments ?? [{ text: target.text || "", deleted: false }];
  let nextSegs;
  if (msg.op === "insert") {
    nextSegs = editPreviousInsert(baseSegs, Number(msg.offset) || 0, msg.text || "");
  } else if (msg.op === "delete") {
    nextSegs = editPreviousDelete(baseSegs, Number(msg.offset) || 0, Number(msg.count) || 0);
  } else {
    return logs;
  }
  const nextText = nextSegs.filter((s) => !s.deleted).map((s) => s.text).join("");
  const next = logs.slice();
  next[idx] = { ...target, segments: nextSegs, text: nextText };
  return next;
}

function applyDeletePrevious(logs, count, deviceId) {
  if (!count || count <= 0) return logs;
  let idx = -1;
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i];
    if (l.kind !== "structured" || l.combo) continue;
    const lid = l.device?.id ?? null;
    if (lid !== (deviceId ?? null)) continue;
    idx = i;
    break;
  }
  if (idx === -1) return logs;
  const target = logs[idx];
  const segs = (target.segments ?? [{ text: target.text || "", deleted: false }]).map((s) => ({ ...s }));
  let remaining = count;
  const removedParts = [];
  for (let i = segs.length - 1; i >= 0 && remaining > 0; i--) {
    if (segs[i].deleted || !segs[i].text) continue;
    const take = Math.min(remaining, segs[i].text.length);
    removedParts.unshift(segs[i].text.slice(segs[i].text.length - take));
    segs[i].text = segs[i].text.slice(0, segs[i].text.length - take);
    remaining -= take;
  }
  const cleaned = segs.filter((s) => s.deleted || s.text);
  const removed = removedParts.join("");
  if (removed) {
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].deleted) {
      const tail = cleaned[cleaned.length - 1];
      cleaned[cleaned.length - 1] = { ...tail, text: removed + tail.text };
    } else {
      cleaned.push({ text: removed, deleted: true });
    }
  }
  const nextText = cleaned.filter((s) => !s.deleted).map((s) => s.text).join("");
  const next = logs.slice();
  next[idx] = { ...target, segments: cleaned, text: nextText };
  return next;
}

function renderSegments(segments, keyBase) {
  const out = [];
  let spaceIdx = 0;
  segments.forEach((seg, segIdx) => {
    const cls = seg.deleted ? "seg-deleted" : "seg-live";
    const text = seg.text || "";
    let i = 0;
    while (i < text.length) {
      if (text[i] === " ") {
        let j = i;
        while (j < text.length && text[j] === " ") j++;
        for (let k = 0; k < j - i; k++) {
          const tone = spaceIdx % 2 === 0 ? "seg-space-a" : "seg-space-b";
          out.push(
            <span
              key={`${keyBase}-${segIdx}-sp-${i + k}`}
              className={`${cls} seg-space ${tone}`}
              aria-hidden="true"
            />
          );
          spaceIdx++;
        }
        i = j;
      } else {
        let j = i;
        while (j < text.length && text[j] !== " ") j++;
        out.push(
          <span key={`${keyBase}-${segIdx}-tx-${i}`} className={cls}>
            {text.slice(i, j)}
          </span>
        );
        i = j;
      }
    }
  });
  return out;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function HomePage() {
  const [logs, setLogs] = useState([]);
  const [viewMode, setViewMode] = useState("structured");
  const [followLive, setFollowLive] = useState(true);
  const [connectionState, setConnectionState] = useState("connecting");
  const [clientConnected, setClientConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceFilter, setDeviceFilter] = useState(null);
  const [now, setNow] = useState(null);
  const [exitFlash, setExitFlash] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [hoveredEntry, setHoveredEntry] = useState(null);
  const logsEndRef = useRef(null);
  const streamRef = useRef(null);
  const cardRectRef = useRef(null);

  const handleEntryEnter = useCallback((log, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rect = { top: r.top, right: r.right, bottom: r.bottom, left: r.left };
    cardRectRef.current = rect;
    setHoveredEntry({ log, rect, variant: "info" });
  }, []);
  const handleEntryLeave = useCallback(() => {
    cardRectRef.current = null;
    setHoveredEntry(null);
  }, []);
  const handleTimestampsEnter = useCallback((log, e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const rect = { top: r.top, right: r.right, bottom: r.bottom, left: r.left };
    setHoveredEntry({ log, rect, variant: "timestamps" });
  }, []);
  const handleTimestampsLeave = useCallback((log) => {
    if (cardRectRef.current) {
      setHoveredEntry({ log, rect: cardRectRef.current, variant: "info" });
    } else {
      setHoveredEntry(null);
    }
  }, []);

  useEffect(() => {
    // SSE EventSource for /api/events
    let es;
    let closed = false;
    function connectSSE() {
      es = new EventSource("/api/events");
      setConnectionState("live");
      es.onmessage = (event) => {
        if (closed) return;
        try {
          const parsedMessage = JSON.parse(event.data);
          if ((viewMode === "structured" || viewMode === "compact") && parsedMessage.data !== undefined) {
            const deviceTs = (parsedMessage.timestamp || Date.now() / 1000) * 1000;
            const serverTs = (parsedMessage.serverTimestamp || Date.now() / 1000) * 1000;
            const isCombo = parsedMessage.type === "combo";
            const segments =
              Array.isArray(parsedMessage.data) &&
              parsedMessage.data.length > 0 &&
              parsedMessage.data.every(
                (s) => s && typeof s === "object" && typeof s.text === "string"
              )
                ? parsedMessage.data
                : null;
            const structuredText = segments
              ? segments.map((s) => s.text).join("")
              : normalizeStructuredText(parsedMessage.data);
            setLogs((current) => [
              ...current,
              {
                id: makeId(),
                kind: "structured",
                deviceTs,
                serverTs,
                device: parsedMessage.device || null,
                text: structuredText,
                combo: isCombo,
                segments,
              },
            ]);
          } else {
            const deviceTs = (parsedMessage.timestamp || Date.now() / 1000) * 1000;
            const serverTs = (parsedMessage.serverTimestamp || Date.now() / 1000) * 1000;
            setLogs((current) => [
              ...current,
              {
                id: makeId(),
                kind: "raw",
                deviceTs,
                serverTs,
                device: parsedMessage.device || null,
                text: typeof parsedMessage === "string" ? parsedMessage : JSON.stringify(parsedMessage, null, 2),
              },
            ]);
          }
        } catch {
          const nowTs = Date.now();
          setLogs((current) => [
            ...current,
            {
              id: makeId(),
              kind: "raw",
              deviceTs: nowTs,
              serverTs: nowTs,
              text: String(event.data),
            },
          ]);
        }
      };
      es.onerror = () => {
        setConnectionState("error");
        es.close();
        if (!closed) setTimeout(connectSSE, 2000);
      };
    }
    connectSSE();
    return () => {
      closed = true;
      if (es) es.close();
    };
  }, [viewMode]);

  useEffect(() => {
    if (followLive && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [logs, followLive]);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const visibleLogs = useMemo(
    () =>
      logs.filter(
        (entry) =>
          entry.kind === (viewMode === "compact" ? "structured" : viewMode) &&
          (deviceFilter === null || (entry.device && entry.device.id === deviceFilter))
      ),
    [logs, viewMode, deviceFilter]
  );

  const compactedLogs = useMemo(() => {
    if (viewMode !== "compact") return [];
    const groups = [];
    for (const entry of visibleLogs) {
      const last = groups[groups.length - 1];
      const sameDevice =
        last &&
        ((last.device && entry.device && last.device.id === entry.device.id) ||
          (!last.device && !entry.device));
      const entrySegs = entry.segments ?? [{ text: entry.text || "" }];
      const canMergeText = last && !last.combo && !entry.combo && sameDevice;
      const canMergeCombo =
        last && last.combo && entry.combo && sameDevice && last.text === entry.text;
      if (canMergeText) {
        last.text = (last.text || "") + (entry.text || "");
        last.segments = [...last.segments, ...entrySegs];
        last.endDeviceTs = entry.deviceTs;
        last.endServerTs = entry.serverTs;
        last.count += 1;
        last.ids.push(entry.id);
        last.timestamps.push(entry.deviceTs);
      } else if (canMergeCombo) {
        last.endDeviceTs = entry.deviceTs;
        last.endServerTs = entry.serverTs;
        last.count += 1;
        last.ids.push(entry.id);
        last.timestamps.push(entry.deviceTs);
      } else {
        groups.push({
          ...entry,
          segments: [...entrySegs],
          startDeviceTs: entry.deviceTs,
          endDeviceTs: entry.deviceTs,
          startServerTs: entry.serverTs,
          endServerTs: entry.serverTs,
          count: 1,
          ids: [entry.id],
          timestamps: [entry.deviceTs],
        });
      }
    }
    return groups;
  }, [visibleLogs, viewMode]);

  const metrics = useMemo(() => {
    const structuredCount = logs.filter((entry) => entry.kind === "structured").length;
    const rawCount = logs.length - structuredCount;

    return [
      { label: "Total", value: logs.length, color: "var(--accent)" },
      { label: "Structured", value: structuredCount, color: "var(--blue)" },
      { label: "Raw", value: rawCount, color: "var(--amber)" },
    ];
  }, [logs]);

  const deviceCount = devices.length;
  const statusLabel =
    connectionState !== "live"
      ? connectionState === "connecting" ? "Connecting" : connectionState === "error" ? "Error" : "Offline"
      : deviceCount > 0 ? `${deviceCount} Device${deviceCount === 1 ? "" : "s"}` : "Disconnected";

  const statusTooltip =
    deviceCount > 0
      ? devices.map((d) => `${d.hostname} (${d.username}) — ${d.platform} ${d.platformVersion}`).join("\n")
      : "No keylogger clients connected";

  const statusClass =
    connectionState !== "live"
      ? connectionState
      : clientConnected ? "live" : "offline";

  const clockStr = now === null ? "" : new Date(now).toLocaleTimeString("en-US", { hour12: false });

  const handleClear = useCallback(() => setLogs([]), []);
  const handleToggleFollow = useCallback(() => setFollowLive((v) => !v), []);
  const handleScrollToggle = useCallback(() => {
    const streamBody = streamRef.current?.querySelector(".stream-body");
    if (!streamBody) return;
    if (atTop) {
      setFollowLive(true);
      streamBody.scrollTo({ top: streamBody.scrollHeight, behavior: "smooth" });
    } else {
      setFollowLive(false);
      streamBody.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [atTop]);

  useEffect(() => {
    const streamBody = streamRef.current?.querySelector(".stream-body");
    if (!streamBody) return;
    const checkPosition = () => {
      setAtTop(streamBody.scrollTop < 20);
    };
    checkPosition();
    streamBody.addEventListener("scroll", checkPosition, { passive: true });
    return () => {
      streamBody.removeEventListener("scroll", checkPosition);
    };
  }, [logs]);

  return (
    <main className="shell">
      {exitFlash ? <div className="exit-flash" /> : null}
      {/* Dot grid background */}
      <div className="dot-grid" />
      <div className="glow glow-1" />
      <div className="glow glow-2" />

      <div className="frame">
        {/* Top bar */}
        <nav className="topbar">
          <div className="topbar-left">
            <div className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" fill="var(--accent)" opacity="0.9"/>
                <rect x="11" y="1" width="6" height="6" rx="1.5" fill="var(--accent)" opacity="0.4"/>
                <rect x="1" y="11" width="6" height="6" rx="1.5" fill="var(--accent)" opacity="0.4"/>
                <rect x="11" y="11" width="6" height="6" rx="1.5" fill="var(--accent)" opacity="0.15"/>
              </svg>
            </div>
            <span className="logo-text">KeyCapture</span>
            <span className="logo-version">v2.0</span>
          </div>

          <div className="topbar-center">
            <span className="clock">{clockStr}</span>
          </div>

          <div className="topbar-right">
            <div className={`status-indicator si-${statusClass}`} title={statusTooltip}>
              <span className="si-dot" />
              <span className="si-label">{statusLabel}</span>
            </div>
          </div>
        </nav>

        {/* Controls row */}
        <div className="controls-row">
          <div className="controls-left">
            <div className="view-toggle">
              <button
                type="button"
                className={viewMode === "structured" ? "vt-btn active" : "vt-btn"}
                onClick={() => setViewMode("structured")}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                Structured
              </button>
              <button
                type="button"
                className={viewMode === "compact" ? "vt-btn active" : "vt-btn"}
                onClick={() => setViewMode("compact")}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="1" y="8" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                Compact
              </button>
              <button
                type="button"
                className={viewMode === "raw" ? "vt-btn active" : "vt-btn"}
                onClick={() => setViewMode("raw")}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 3h12M1 7h8M1 11h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Raw
              </button>
            </div>

            {metrics.map((m) => (
              <div key={m.label} className="metric-pill">
                <span className="mp-dot" style={{ background: m.color }} />
                <span className="mp-value">{m.value}</span>
                <span className="mp-label">{m.label}</span>
              </div>
            ))}

            {devices.length > 0 ? (
              <div className="device-filter">
                <button
                  type="button"
                  className={deviceFilter === null ? "df-btn active" : "df-btn"}
                  onClick={() => setDeviceFilter(null)}
                >
                  All
                </button>
                {devices.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={deviceFilter === d.id ? "df-btn active" : "df-btn"}
                    onClick={() => setDeviceFilter(d.id)}
                    title={`${d.hostname} (${d.username}) — ${d.platform} ${d.platformVersion}\nID: ${d.id}`}
                  >
                    <span className="df-dot" />
                    {d.hostname}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="controls-right">
            <button
              type="button"
              className={followLive ? "ctrl-btn ctrl-btn-active" : "ctrl-btn"}
              onClick={handleToggleFollow}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2.5" fill="currentColor"/>
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Scroll to live
            </button>
            <button type="button" className="ctrl-btn" onClick={handleClear}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Clear
            </button>
          </div>
        </div>

        {/* Stream */}
        <section className="stream" ref={streamRef}>
          <div className="stream-gutter">
            <span className="sg-label">
              {viewMode === "structured" ? "STRUCTURED" : "RAW"} FEED
            </span>
            <span className="sg-count">{visibleLogs.length}</span>
          </div>

          <div className="stream-body">
            {visibleLogs.length === 0 ? (
              <div className="empty">
                <div className="empty-graphic">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="6" y="10" width="36" height="28" rx="4" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 3"/>
                    <path d="M16 24h16M16 30h10" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="24" cy="18" r="2" fill="var(--accent)" opacity="0.5"/>
                  </svg>
                </div>
                <p className="empty-title">Waiting for data</p>
                <p className="empty-desc">
                  {connectionState === "live" && !clientConnected
                    ? "Server connected. Waiting for keylogger client..."
                    : connectionState === "live" && clientConnected
                    ? "Client connected. Keystrokes will appear here."
                    : "Connect to the server to begin capture."}
                </p>
              </div>
            ) : viewMode === "compact" ? (
              compactedLogs.map((log, index) => {
                const startStr = new Date(log.startDeviceTs).toLocaleTimeString();
                const endStr = new Date(log.endDeviceTs).toLocaleTimeString();
                const timeRange = log.count > 1 && startStr !== endStr
                  ? `${startStr} — ${endStr}`
                  : new Date(log.startDeviceTs).toLocaleString();
                const hasMultiple = log.count > 1;
                const tsHoverProps = hasMultiple
                  ? {
                      onMouseEnter: (e) => handleTimestampsEnter(log, e),
                      onMouseLeave: () => handleTimestampsLeave(log),
                      style: { cursor: "help" },
                    }
                  : {};
                return (
                  <article
                    key={log.ids.join("-")}
                    className={log.combo ? "card card-combo" : "card"}
                    style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
                    onMouseEnter={(e) => handleEntryEnter(log, e)}
                    onMouseLeave={handleEntryLeave}
                  >
                    <div className="card-header">
                      <div className="card-meta">
                        <span className="card-index">#{index + 1}</span>
                        <span className="card-time" {...tsHoverProps}>{timeRange}</span>
                        {hasMultiple ? (
                          <span
                            className="card-tag"
                            style={{ color: "var(--accent)", background: "var(--accent-dim)", borderColor: "rgba(0,232,154,0.18)", cursor: "help" }}
                            onMouseEnter={(e) => handleTimestampsEnter(log, e)}
                            onMouseLeave={() => handleTimestampsLeave(log)}
                          >
                            ×{log.count}
                          </span>
                        ) : null}
                      </div>
                      <div className="card-header-right">
                        {log.device ? (
                          <span className="device-badge">
                            <span className="db-dot" />
                            {log.device.hostname}
                          </span>
                        ) : null}
                        <span className={log.combo ? "card-tag card-tag-combo" : "card-tag"}>
                          {log.combo ? "SHORTCUT" : "COMPACT"}
                        </span>
                      </div>
                    </div>
                    {log.combo ? (
                      <div className="card-body combo-body">
                        {log.text.split("+").map((part, i, arr) => (
                          <span key={`${log.ids[0]}-${i}`} className="combo-chip-wrap">
                            <kbd className="kbd">{part}</kbd>
                            {i < arr.length - 1 ? <span className="combo-plus">+</span> : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <pre className="card-body">
                        {renderSegments(log.segments, `${log.ids?.[0] ?? log.id}`)}
                      </pre>
                    )}
                  </article>
                );
              })
            ) : viewMode === "structured" ? (
              visibleLogs.map((log, index) => (
                <article
                  key={log.id}
                  className={log.combo ? "card card-combo" : "card"}
                  style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
                  onMouseEnter={(e) => handleEntryEnter(log, e)}
                  onMouseLeave={handleEntryLeave}
                >
                  <div className="card-header">
                    <div className="card-meta">
                      <span className="card-index">#{index + 1}</span>
                      <span className="card-time">
                        {new Date(log.deviceTs).toLocaleString()}
                      </span>
                    </div>
                    <div className="card-header-right">
                      {log.device ? (
                        <span className="device-badge">
                          <span className="db-dot" />
                          {log.device.hostname}
                        </span>
                      ) : null}
                      <span className={log.combo ? "card-tag card-tag-combo" : "card-tag"}>
                        {log.combo ? "SHORTCUT" : "STR"}
                      </span>
                    </div>
                  </div>
                  {log.combo ? (
                    <div className="card-body combo-body">
                      {log.text.split("+").map((part, i, arr) => (
                        <span key={`${log.id}-${i}`} className="combo-chip-wrap">
                          <kbd className="kbd">{part}</kbd>
                          {i < arr.length - 1 ? <span className="combo-plus">+</span> : null}
                        </span>
                      ))}
                    </div>
                  ) : log.segments ? (
                    <pre className="card-body">
                      {renderSegments(log.segments, `${log.id}`)}
                    </pre>
                  ) : (
                    <pre className="card-body">{log.text || "\u2014"}</pre>
                  )}
                </article>
              ))
            ) : (
              <div className="terminal">
                {visibleLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className="term-row"
                    style={{ animationDelay: `${Math.min(index * 10, 150)}ms` }}
                    onMouseEnter={(e) => handleEntryEnter(log, e)}
                    onMouseLeave={handleEntryLeave}
                  >
                    <span className="term-gutter">{String(index + 1).padStart(4, "\u00A0")}</span>
                    <span className="term-time">
                      {new Date(log.deviceTs).toLocaleString()}
                    </span>
                    {log.device ? (
                      <span className="term-device">
                        {log.device.hostname}
                      </span>
                    ) : null}
                    <pre className="term-data">{log.text}</pre>
                  </div>
                ))}
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </section>
      </div>

      {hoveredEntry ? (
        <EntryInfoPanel
          log={hoveredEntry.log}
          now={now}
          rect={hoveredEntry.rect}
          variant={hoveredEntry.variant}
        />
      ) : null}

      <button type="button" className="go-to-top" onClick={handleScrollToggle}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          {atTop ? (
            <path d="M7 3v8M3 7l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          ) : (
            <path d="M7 11V3M3 7l4-4 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          )}
        </svg>
        {atTop ? "Go to Bottom" : "Go to Top"}
      </button>

      <style jsx global>{`
        :root {
          color-scheme: dark;
          --bg: #06090e;
          --bg-surface: #0b0f16;
          --bg-raised: #10151e;
          --bg-hover: #161d2a;
          --border: rgba(255, 255, 255, 0.06);
          --border-strong: rgba(255, 255, 255, 0.1);
          --text: #e4eaf4;
          --text-secondary: #98a5b8;
          --muted: #4d5a6e;
          --accent: #00e89a;
          --accent-dim: rgba(0, 232, 154, 0.12);
          --accent-glow: rgba(0, 232, 154, 0.25);
          --blue: #5ba4f5;
          --amber: #f5a623;
          --red: #f55b6a;
          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body {
          height: 100%;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-body), "DM Sans", system-ui, sans-serif;
          font-size: 14px;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        button { font: inherit; cursor: pointer; }

        /* ---- Exit flash overlay ---- */
        .exit-flash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #1e7bff;
          pointer-events: none;
        }

        /* ---- Background effects ---- */
        .dot-grid {
          position: fixed;
          inset: 0;
          z-index: 0;
          opacity: 0.3;
          background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
        }

        .glow {
          position: fixed;
          pointer-events: none;
          border-radius: 50%;
          filter: blur(100px);
          z-index: 0;
        }

        .glow-1 {
          top: -10%;
          left: -5%;
          width: 500px;
          height: 500px;
          background: rgba(0, 232, 154, 0.06);
        }

        .glow-2 {
          bottom: -10%;
          right: -8%;
          width: 400px;
          height: 400px;
          background: rgba(91, 164, 245, 0.05);
        }

        /* ---- Layout ---- */
        .shell {
          position: relative;
          height: 100dvh;
          overflow: hidden;
          isolation: isolate;
        }

        .frame {
          position: relative;
          z-index: 1;
          max-width: 1320px;
          margin: 0 auto;
          padding: 16px 24px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          height: 100%;
          min-height: 0;
        }

        /* ---- Topbar ---- */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 52px;
          padding: 0 16px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .topbar-left, .topbar-center, .topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .topbar-left { flex: 1; }
        .topbar-center { flex: 0 0 auto; }
        .topbar-right { flex: 1; justify-content: flex-end; }

        .logo-mark {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--accent-dim);
        }

        .logo-text {
          font-family: var(--font-display), "Syne", sans-serif;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: -0.02em;
          color: var(--text);
        }

        .logo-version {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: var(--muted);
          padding: 2px 6px;
          background: var(--bg-raised);
          border-radius: 4px;
          border: 1px solid var(--border);
        }

        .clock {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 0.08em;
        }

        /* ---- Status Indicator ---- */
        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg-raised);
          font-size: 12px;
          font-weight: 500;
        }

        .si-dot {
          position: relative;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent);
        }

        .si-label {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .si-live .si-dot {
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent-glow);
          animation: pulse-dot 2s ease-in-out infinite;
        }

        .si-live .si-label { color: var(--accent); }
        .si-live { border-color: rgba(0, 232, 154, 0.15); }

        .si-connecting .si-dot {
          background: var(--amber);
          animation: pulse-dot 1.2s ease-in-out infinite;
        }
        .si-connecting .si-label { color: var(--amber); }

        .si-offline .si-dot, .si-error .si-dot {
          background: var(--red);
        }
        .si-offline .si-label, .si-error .si-label { color: var(--red); }
        .si-offline, .si-error { border-color: rgba(245, 91, 106, 0.12); }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        /* ---- Controls row ---- */
        .controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 12px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .controls-left, .controls-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        /* ---- View toggle ---- */
        .view-toggle {
          display: inline-flex;
          padding: 3px;
          border-radius: var(--radius-sm);
          background: var(--bg);
          border: 1px solid var(--border);
          margin-right: 8px;
        }

        .vt-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: var(--muted);
          font-size: 12px;
          font-weight: 500;
          transition: all 150ms ease;
        }

        .vt-btn:hover {
          color: var(--text-secondary);
          background: var(--bg-raised);
        }

        .vt-btn.active {
          color: var(--accent);
          background: var(--accent-dim);
          border-color: rgba(0, 232, 154, 0.12);
        }

        /* ---- Metric pills ---- */
        .metric-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 6px;
          background: var(--bg);
          border: 1px solid var(--border);
          font-family: var(--font-mono), monospace;
          font-size: 12px;
        }

        .mp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .mp-value {
          font-weight: 600;
          color: var(--text);
        }

        .mp-label {
          color: var(--muted);
          font-size: 11px;
        }

        /* ---- Control buttons ---- */
        .ctrl-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          background: var(--bg);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          transition: all 150ms ease;
        }

        .ctrl-btn:hover {
          background: var(--bg-hover);
          border-color: var(--border-strong);
          color: var(--text);
        }

        .ctrl-btn-active {
          color: var(--accent);
          border-color: rgba(0, 232, 154, 0.15);
          background: var(--accent-dim);
        }

        .ctrl-btn-active:hover {
          background: rgba(0, 232, 154, 0.18);
        }

        /* ---- Stream ---- */
        .stream {
          flex: 1;
          display: flex;
          min-height: 0;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .stream-gutter {
          flex: 0 0 44px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 14px 0;
          gap: 8px;
          background: var(--bg);
          border-right: 1px solid var(--border);
        }

        .sg-label {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          font-family: var(--font-mono), monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          flex: 1;
          display: flex;
          align-items: center;
        }

        .sg-count {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          font-weight: 600;
          color: var(--accent);
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: var(--accent-dim);
        }

        .stream-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stream-body::-webkit-scrollbar {
          width: 6px;
        }

        .stream-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .stream-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
        }

        .stream-body::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.14);
        }

        /* ---- Empty state ---- */
        .empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 12px;
          padding: 60px 20px;
        }

        .empty-graphic {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          border: 1px dashed var(--border-strong);
          background: var(--bg);
          margin-bottom: 4px;
        }

        .empty-title {
          font-family: var(--font-display), "Syne", sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .empty-desc {
          font-size: 13px;
          color: var(--muted);
          max-width: 36ch;
          line-height: 1.6;
        }

        /* ---- Structured cards ---- */
        .card {
          padding: 14px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg);
          position: relative;
          animation: card-in 300ms ease both;
          transition: border-color 150ms ease, background 150ms ease;
        }

        .card::before {
          content: "";
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 2px;
          border-radius: 2px;
          background: var(--accent);
          opacity: 0.4;
          transition: opacity 150ms ease;
        }

        .card:hover {
          border-color: var(--border-strong);
          background: var(--bg-raised);
        }

        .card:hover::before {
          opacity: 1;
        }

        @keyframes card-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .card-meta {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .card-index {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          font-weight: 600;
          color: var(--accent);
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--accent-dim);
        }

        .card-time {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--muted);
        }

        .card-tag {
          font-family: var(--font-mono), monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: var(--blue);
          padding: 3px 7px;
          border-radius: 4px;
          background: rgba(91, 164, 245, 0.1);
          border: 1px solid rgba(91, 164, 245, 0.12);
        }

        .card-body {
          margin: 0;
          font-family: var(--font-mono), monospace;
          font-size: 13px;
          line-height: 1.7;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--text-secondary);
          padding-left: 10px;
        }

        /* ---- Shortcut / combo card ---- */
        .card-combo {
          border-color: rgba(245, 166, 35, 0.22);
          background: linear-gradient(
            180deg,
            rgba(245, 166, 35, 0.06),
            rgba(245, 166, 35, 0.02) 60%,
            var(--bg)
          );
        }

        .card-combo::before {
          background: var(--amber);
          opacity: 0.8;
        }

        .card-combo:hover {
          border-color: rgba(245, 166, 35, 0.4);
          background: linear-gradient(
            180deg,
            rgba(245, 166, 35, 0.1),
            rgba(245, 166, 35, 0.03) 60%,
            var(--bg-raised)
          );
        }

        .card-tag-combo {
          color: var(--amber);
          background: rgba(245, 166, 35, 0.12);
          border-color: rgba(245, 166, 35, 0.22);
        }

        .combo-body {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          padding-left: 10px;
        }

        .combo-chip-wrap {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .kbd {
          display: inline-block;
          min-width: 22px;
          padding: 3px 8px;
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
          text-align: center;
          text-transform: capitalize;
          color: var(--text);
          background: linear-gradient(180deg, var(--bg-hover), var(--bg-raised));
          border: 1px solid var(--border-strong);
          border-bottom-width: 2px;
          border-radius: 6px;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4), inset 0 -1px 0 rgba(255, 255, 255, 0.04);
        }

        .seg-live {
          color: var(--text-secondary);
        }

        .seg-deleted {
          color: var(--muted);
          opacity: 0.8;
        }

        .seg-space {
          display: inline-block;
          width: 0.55em;
          height: 1em;
          vertical-align: -0.15em;
          border-radius: 2px;
        }

        .seg-space-a { background: rgba(255, 255, 255, 0.14); }
        .seg-space-b { background: rgba(255, 255, 255, 0.65); }

        .seg-deleted .seg-space-a { background: rgba(245, 91, 106, 0.35); }
        .seg-deleted .seg-space-b { background: rgba(245, 91, 106, 0.75); }

        .combo-plus {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          color: var(--amber);
          font-weight: 600;
          opacity: 0.8;
        }

        /* ---- Terminal / Raw view ---- */
        .terminal {
          display: flex;
          flex-direction: column;
          font-family: var(--font-mono), monospace;
          font-size: 12px;
        }

        .term-row {
          position: relative;
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 5px 8px;
          border-radius: 4px;
          animation: card-in 200ms ease both;
          transition: background 120ms ease;
        }

        .term-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .term-gutter {
          flex-shrink: 0;
          color: var(--muted);
          font-size: 11px;
          opacity: 0.5;
          user-select: none;
        }

        .term-time {
          flex-shrink: 0;
          color: var(--muted);
          font-size: 11px;
        }

        .term-data {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--text);
          line-height: 1.6;
        }

        /* ---- Entry info hover panel ---- */
        .entry-info-floating {
          position: fixed;
          z-index: 9000;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(10, 14, 20, 0.96);
          border: 1px solid var(--border-strong);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(8px);
          pointer-events: none;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 4px 12px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          line-height: 1.5;
          animation: entry-info-in 100ms ease both;
        }

        @keyframes entry-info-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ei-row {
          display: contents;
        }

        .ei-k {
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 10px;
          white-space: nowrap;
          align-self: center;
        }

        .ei-v {
          color: var(--text);
          word-break: break-word;
        }

        .ei-v.ei-mono {
          font-size: 10px;
          color: var(--text-secondary);
        }

        .ei-sep {
          grid-column: 1 / -1;
          height: 1px;
          background: var(--border);
          margin: 4px 0;
        }

        .ei-timestamps {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 140px;
          overflow-y: auto;
          padding: 4px 2px 2px;
        }

        .ei-ts-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-family: var(--font-mono), monospace;
          font-size: 10px;
        }

        .ei-ts-idx {
          color: var(--muted);
        }

        .ei-ts-val {
          color: var(--text);
        }

        /* ---- Go to Top button ---- */
        .go-to-top {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 10;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 999px;
          background: var(--accent-dim);
          border: 1px solid rgba(0, 232, 154, 0.25);
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 232, 154, 0.08);
          transition: all 150ms ease;
        }

        .go-to-top:hover {
          background: rgba(0, 232, 154, 0.22);
          border-color: rgba(0, 232, 154, 0.4);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5), 0 0 12px var(--accent-glow);
        }

        /* ---- Devices ---- */
        .device-filter {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px;
          border-radius: var(--radius-sm);
          background: var(--bg);
          border: 1px solid var(--border);
          margin-left: 8px;
          flex-wrap: wrap;
        }

        .df-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: var(--muted);
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          font-weight: 500;
          transition: all 150ms ease;
        }

        .df-btn:hover {
          color: var(--text-secondary);
          background: var(--bg-raised);
        }

        .df-btn.active {
          color: var(--accent);
          background: var(--accent-dim);
          border-color: rgba(0, 232, 154, 0.12);
        }

        .df-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--blue);
          flex-shrink: 0;
        }

        .card-header-right {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .device-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(91, 164, 245, 0.08);
          border: 1px solid rgba(91, 164, 245, 0.18);
          color: var(--blue);
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: default;
        }

        .db-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--blue);
          box-shadow: 0 0 6px rgba(91, 164, 245, 0.5);
        }

        .term-device {
          flex-shrink: 0;
          color: var(--blue);
          font-size: 11px;
          font-family: var(--font-mono), monospace;
          padding: 0 6px;
          border-radius: 3px;
          background: rgba(91, 164, 245, 0.08);
          cursor: default;
        }

        /* ---- Responsive ---- */
        @media (max-width: 900px) {
          .frame {
            padding: 12px 14px 24px;
          }

          .controls-row {
            flex-direction: column;
            align-items: stretch;
          }

          .controls-left, .controls-right {
            justify-content: flex-start;
          }

          .topbar-center { display: none; }
          .topbar-left { flex: unset; }

          .stream-gutter { flex-basis: 36px; }
          .sg-label { font-size: 8px; }
        }

        @media (max-width: 600px) {
          .metric-pill { display: none; }

          .topbar {
            padding: 0 10px;
          }

          .logo-version { display: none; }

          .stream-body {
            padding: 8px;
          }
        }
      `}</style>
    </main>
  );
}
