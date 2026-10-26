import json
from fastapi import WebSocket
from typing import List

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected. Total active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WebSocket disconnected. Total active connections: {len(self.active_connections)}")

    async def broadcast(self, message_dict: dict):
        message_str = json.dumps(message_dict)
        print(f"Broadcasting: {message_str}")
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                # Connection is dead
                pass

ws_manager = ConnectionManager()
