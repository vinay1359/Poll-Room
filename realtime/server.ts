import { createServer, type IncomingMessage } from "http";
import { Server } from "socket.io";

const port = Number(process.env.REALTIME_PORT ?? 4001);

const viewerCounts = new Map<string, number>();

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && req.url === "/emit") {
    const body = await readBody(req);
    try {
      const payload = JSON.parse(body);
      if (payload.type === "poll_update") {
        io.to(`poll:${payload.pollId}`).emit("poll_update", payload.counts);
      }
      res.writeHead(204);
      res.end();
      return;
    } catch (error) {
      res.writeHead(400);
      res.end();
      return;
    }
  }

  res.writeHead(404);
  res.end();
});
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  socket.on("join_poll", (pollId: string) => {
    socket.join(`poll:${pollId}`);
    const count = (viewerCounts.get(pollId) ?? 0) + 1;
    viewerCounts.set(pollId, count);
    io.to(`poll:${pollId}`).emit("viewer_count", count);
  });

  socket.on("leave_poll", (pollId: string) => {
    socket.leave(`poll:${pollId}`);
    const count = Math.max((viewerCounts.get(pollId) ?? 1) - 1, 0);
    viewerCounts.set(pollId, count);
    io.to(`poll:${pollId}`).emit("viewer_count", count);
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (!room.startsWith("poll:")) continue;
      const pollId = room.replace("poll:", "");
      const count = Math.max((viewerCounts.get(pollId) ?? 1) - 1, 0);
      viewerCounts.set(pollId, count);
      io.to(room).emit("viewer_count", count);
    }
  });
});

httpServer.listen(port);

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
  });
}
