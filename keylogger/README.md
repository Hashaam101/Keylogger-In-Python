# keylogger/ — Python client

See the [top-level README](../README.md) for architecture, message formats, and the master-exit trigger. This file documents only what is specific to the client files in this directory.

## Files

| File                       | Purpose                                                                     |
| -------------------------- | --------------------------------------------------------------------------- |
| `Keylogger.py`             | Main script. Hooks `keyboard` events and streams to `ws://localhost:6699`.  |
| `LauncherForWindows.bat`   | Installs pip deps and starts `Keylogger.py` under `pythonw` (no console).   |
| `requirements.txt`         | Pip dependencies (`keyboard`, `logging`).                                   |
| `file_hider.vbs`           | Marks the other files in this directory as hidden via `fso` attributes.     |
| `logs.txt`                 | Local fallback log written by `logging.basicConfig`. Not used for the UI — the dashboard receives data over the WebSocket — but kept as an on-disk record if the socket is unreachable. |

## Tuning

Constants near the top of `Keylogger.py` you may want to change:

- `idle_threshold = 2.5` — seconds of inactivity that triggers a buffer flush in structured mode.
- `DELETE_PREVIOUS_WINDOW = 60.0` — max age of the last flushed line that a `delete_previous` event may retro-edit.
- `EXIT_WORD = "crash"`, `EXIT_SHIFT_COUNT = 3` — master-exit trigger.
- The WebSocket URL is hard-coded as `ws://localhost:6699` inside `start_websocket()`.

## Dependencies

`requirements.txt` lists `keyboard` and `logging`, but the script also imports `requests` and `websocket-client`. The batch launcher installs `keyboard` explicitly; install the rest manually if you are not using the launcher:

```bash
pip install keyboard websocket-client requests
```

The `keyboard` module requires administrator privileges on Windows to hook global key events.
