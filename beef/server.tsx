import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { createApiListener } from "../build/node/node-http.js";
import { serverSettings } from "./local-settings.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "localhost";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const api = createApiListener(serverSettings());
  const httpServer = createServer(async (request, response) => {
    if (await api(request, response)) return;
    await handler(request, response);
  });
  const io = new Server(httpServer, { maxHttpBufferSize: 8192 });

  // Preserve the teammate's handshake. Game mutations use the authenticated HTTP API.
  // Do not put tokens, private ballots, or personal data in room-wide broadcasts.
  io.on("connection", (socket) => {
    socket.on("ready", () => socket.emit("hello", "from server"));
    socket.on("hello", () => socket.emit("backend", { api: "/api/pitch", transport: "http" }));
  });

  httpServer.once("error", (error) => {
    console.error("Local server could not start:", error.message);
    process.exitCode = 1;
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Backend: /api/health; integration check: /server-check`);
  });
}).catch(() => {
  console.error("Could not prepare Next.js. Check dependencies and local configuration.");
  process.exitCode = 1;
});
