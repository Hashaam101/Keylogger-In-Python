# server/ — Next.js dashboard + WebSocket relay

See the [top-level README](../README.md) for the overall architecture, client protocol, and message formats. This file covers only what is specific to this Next.js project.

## Important: non-standard Next.js

This project uses a modified Next.js with breaking changes from upstream. Before editing server code, read the relevant guide in `node_modules/next/dist/docs/` — public Next.js documentation may be wrong for this repo. See `AGENTS.md` / `CLAUDE.md`.

## Layout

```
src/app/
├── api/log/route.js   Boots the WebSocket server on :6699 and relays messages
├── layout.js
└── page.js            Dashboard: connects to ws://localhost:6699 as a "frontend" client
keystrokes.log         Legacy file-watched log source (see below)
```

## How the relay works

`src/app/api/log/route.js` starts a `ws` `WebSocketServer` on port **6699** as a side effect of the module being imported. Each connecting socket is classified on its first message:

- A message containing a `mode` field → **frontend** client. Gets a `status` snapshot of connected devices on connect. Mode changes are forwarded to every keylogger.
- Anything else → **keylogger** client. Its `hello` payload is stored as `ws._device` and every subsequent message is forwarded to every frontend with the device attached and a `serverTimestamp` added.

`exit` messages from keyloggers are forwarded with their device info so the UI can show a disconnect.

## Legacy `keystrokes.log` watcher

`route.js` also `fs.watch`es a `keystrokes.log` file at the project root. When it changes, the contents are parsed into `{ timestamp, content }` records, broadcast to frontends as a `structured` payload, and the file is truncated. This predates the WebSocket flow and is kept for compatibility — the current Python client does not write to it.

## Development

```bash
npm install
npm run dev
```

Dashboard: `http://localhost:3000`. WebSocket: `ws://localhost:6699`.

If testing from another machine, open both ports in the firewall and change `ws://localhost:6699` in `keylogger/Keylogger.py` to point at this host.
