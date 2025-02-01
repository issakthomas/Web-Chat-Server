import { WebSocketServer } from "ws";
import { createServer } from "http";
import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 10000;

app.use(
	cors({
		origin: [
			"https://reactwebchatappbyissak.netlify.app",
			// "http://localhost:5173",
		],
		methods: ["GET", "POST"],
	})
);

app.get("/health", (req, res) => {
	res.json({ status: "ok" });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

const users = new Map();
const messageHistory = new Map();

wss.on("connection", (ws) => {
	let username = "";

	const heartbeat = setInterval(() => {
		if (ws.readyState === WebSocketServer.OPEN) {
			ws.ping();
		}
	}, 30000);

	ws.on("message", (message) => {
		const data = JSON.parse(message);
	});

	ws.on("close", () => {
		clearInterval(heartbeat);
		if (username) {
			users.delete(username);
			broadcast({
				type: "USER_LEFT",
				username,
			});
			broadcast({
				type: "USERS",
				users: Array.from(users.keys()),
			});
		}
	});

	ws.on("error", (error) => {
		console.error("WebSocket error:", error);
	});
});

server.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
