import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { registerSocketHandlers } from "./sockets/index.js";

const app = express();
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use(router);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.corsOrigin },
});

registerSocketHandlers(io);

httpServer.listen(env.port, () => {
  console.log(`LiveBoard API + Socket.io rodando em http://localhost:${env.port}`);
});
