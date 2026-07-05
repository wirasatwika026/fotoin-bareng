// Signaling server untuk mode live: room per kode sesi, maksimal 2 peer,
// tugasnya hanya meneruskan SDP/ICE antar peer. Video tidak lewat sini (P2P).
//
//   npm run signaling   (dev: ws://localhost:3001)
import { WebSocketServer } from "ws";

const port = Number(process.env.SIGNALING_PORT ?? 3001);
const wss = new WebSocketServer({ port, maxPayload: 64 * 1024 });

/** @type {Map<string, Set<import("ws").WebSocket>>} */
const rooms = new Map();

wss.on("connection", (socket) => {
  let room = null;

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join" && typeof msg.room === "string") {
      if (room || !/^[a-z0-9]{4,16}$/.test(msg.room)) return;
      const peers = rooms.get(msg.room) ?? new Set();
      if (peers.size >= 2) {
        socket.send(JSON.stringify({ type: "full" }));
        socket.close();
        return;
      }
      peers.add(socket);
      rooms.set(msg.room, peers);
      room = msg.room;
      socket.send(JSON.stringify({ type: "peers", count: peers.size }));
      for (const peer of peers) {
        if (peer !== socket) peer.send(JSON.stringify({ type: "peer-joined" }));
      }
      return;
    }

    if (msg.type === "signal" && room) {
      const peers = rooms.get(room);
      if (!peers) return;
      for (const peer of peers) {
        if (peer !== socket && peer.readyState === 1) {
          peer.send(JSON.stringify({ type: "signal", data: msg.data }));
        }
      }
    }
  });

  socket.on("close", () => {
    if (!room) return;
    const peers = rooms.get(room);
    if (!peers) return;
    peers.delete(socket);
    if (peers.size === 0) {
      rooms.delete(room);
    } else {
      for (const peer of peers) peer.send(JSON.stringify({ type: "peer-left" }));
    }
  });
});

console.log(`Signaling jalan di ws://localhost:${port}`);
