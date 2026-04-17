
# server/ — Next.js dashboard + HTTP/SSE relay


See the [top-level README](../README.md) for the overall architecture, client protocol, and message formats. This file covers only what is specific to this Next.js project.

## Important: non-standard Next.js

This project uses a modified Next.js with breaking changes from upstream. Before editing server code, read the relevant guide in `node_modules/next/dist/docs/` — public Next.js documentation may be wrong for this repo. See `AGENTS.md` / `CLAUDE.md`.

## Layout


```
src/app/
├── api/ingest/route.js   HTTP POST endpoint for keylogger client
├── api/events/route.js   SSE endpoint for dashboard updates
├── api/mode/route.js     Dashboard mode (raw/structured) endpoint
├── layout.js
└── page.js               Dashboard: connects to /api/events via SSE
```


## How the relay works

- The keylogger client batches keystrokes and POSTs them to `/api/ingest`.
- The server appends logs to Upstash Redis.
- The dashboard connects to `/api/events` (SSE) to receive real-time updates.
- Dashboard mode (raw/structured) is set via `/api/mode` and returned to the client in each POST response.


## Development

```bash
npm install
npm run dev
```

Dashboard: `http://localhost:3000`. SSE endpoint: `/api/events`. In production, use `https://keylogger-py.vercel.app`.
