import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

// Dynamic import of the server logic (ESM module)
const { attachSocketHandlers } = await import("../server/dist/index.js");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // Initialize Socket.IO with the HTTP server
  const io = new Server(httpServer, {
    path: "/api/socket",
    cors: {
      origin: "*",
    },
  });

  // Attach all socket event handlers
  const socketHandlers = attachSocketHandlers(io);

  console.log("✓ Socket.IO server initialized on path /api/socket");

  // Clean up on server close
  httpServer.on("close", () => {
    socketHandlers.cleanup();
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO ready on ws://${hostname}:${port}/api/socket`);
    });
});
