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
		origin: ["https://reactwebchatappbyissak.netlify.app"],
		methods: ["GET", "POST"],
	})
);

app.get("/health", (req, res) => {
	res.json({ status: "ok" });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

const users = new Map();
const messageHistory = [];

function broadcast(data) {
	const message = JSON.stringify(data);
	wss.clients.forEach((client) => {
		if (client.readyState === client.OPEN) {
			client.send(message);
		}
	});
}

wss.on("connection", (ws) => {
	let username = "";

	const heartbeat = setInterval(() => {
		if (ws.readyState === ws.OPEN) {
			ws.ping();
		}
	}, 30000);

	ws.on("message", (message) => {
		try {
			const data = JSON.parse(message);
			switch (data.type) {
				case "JOIN":
					username = data.username;
					users.set(username, ws);
					broadcast({
						type: "USER_JOINED",
						username,
					});
					broadcast({
						type: "USERS",
						users: Array.from(users.keys()),
					});
					break;

				case "MESSAGE":
					const msg = {
						type: "MESSAGE",
						from: username,
						content: data.content,
						timestamp: new Date().toISOString(),
					};
					messageHistory.push(msg);
					broadcast(msg);
					break;

				case "GET_USERS":
					ws.send(
						JSON.stringify({
							type: "USERS",
							users: Array.from(users.keys()),
						})
					);
					break;

				default:
					console.warn("Unknown message type:", data.type);
			}
		} catch (error) {
			console.error("Error processing message:", error);
		}
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
