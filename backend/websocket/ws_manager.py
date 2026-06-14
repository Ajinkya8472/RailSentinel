"""
ws_manager.py — WebSocket connection manager.

Maintains a registry of active WebSocket connections and provides
broadcast() to push JSON events to every connected frontend client.

Usage in route handler:
    from websocket.ws_manager import manager
    await manager.connect(websocket)
    await manager.broadcast({"type": "new_incident", "incident": {...}})
"""

import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Thread-safe WebSocket connection pool with broadcast support."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    # ------------------------------------------------------------------ #
    # Connection lifecycle                                                  #
    # ------------------------------------------------------------------ #

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            f"[WS] Client connected. Total connections: {len(self.active_connections)}"
        )
        # Send a welcome handshake so the client knows it's live
        await self._send_single(websocket, {
            "type": "connected",
            "message": "RailSentinel WebSocket live",
            "client_count": len(self.active_connections),
        })

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a disconnected WebSocket from the registry."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            f"[WS] Client disconnected. Total connections: {len(self.active_connections)}"
        )

    # ------------------------------------------------------------------ #
    # Sending                                                               #
    # ------------------------------------------------------------------ #

    async def broadcast(self, data: dict) -> None:
        """Send a JSON payload to ALL active connections.
        
        Dead connections are automatically pruned on send failure.
        """
        dead: List[WebSocket] = []
        payload = json.dumps(data, default=str)   # default=str handles datetime

        for ws in self.active_connections:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"[WS] Send failed, marking dead: {e}")
                dead.append(ws)

        # Prune dead connections
        for ws in dead:
            self.disconnect(ws)

    async def send_to_one(self, websocket: WebSocket, data: dict) -> None:
        """Send a JSON payload to a single connection."""
        try:
            await self._send_single(websocket, data)
        except Exception as e:
            logger.warning(f"[WS] Single-send failed: {e}")
            self.disconnect(websocket)

    # ------------------------------------------------------------------ #
    # Typed broadcast helpers (keeps event schema consistent)               #
    # ------------------------------------------------------------------ #

    async def broadcast_new_incident(self, incident: dict) -> None:
        """Broadcast a new incident alert to all clients."""
        await self.broadcast({
            "type":     "new_incident",
            "incident": incident,
        })

    async def broadcast_incident_update(self, incident_id: int, status: str, incident: dict) -> None:
        """Broadcast an incident status change (approved / resolved / rejected)."""
        await self.broadcast({
            "type":        "incident_update",
            "incident_id": incident_id,
            "status":      status,
            "incident":    incident,
        })

    async def broadcast_train_update(self, trains: list) -> None:
        """Broadcast updated positions for all trains."""
        await self.broadcast({
            "type":   "train_update",
            "trains": trains,
        })

    async def broadcast_risk_update(self, risk_data: dict) -> None:
        """Broadcast the latest M8 composite risk scores."""
        await self.broadcast({
            "type": "risk_update",
            "data": risk_data,
        })

    async def broadcast_sensor_spike(self, sensor_data: dict) -> None:
        """Broadcast a raw sensor spike event (before AI pipeline completes)."""
        await self.broadcast({
            "type":   "sensor_spike",
            "sensor": sensor_data,
        })

    # ------------------------------------------------------------------ #
    # Internal                                                              #
    # ------------------------------------------------------------------ #

    async def _send_single(self, websocket: WebSocket, data: dict) -> None:
        await websocket.send_text(json.dumps(data, default=str))

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# ──────────────────────────────────────────────────────────────────────── #
# Global singleton — import this everywhere                                 #
# ──────────────────────────────────────────────────────────────────────── #
manager = WebSocketManager()
