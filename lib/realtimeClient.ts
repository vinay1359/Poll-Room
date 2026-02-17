import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getRealtimeClient(): Socket {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001";
  socket = io(url, { 
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });
  
  return socket;
}
