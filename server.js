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

const users = new Map(); // Map of username to ws connection
const messageHistory = []; // Optional: Store messages if you wish

// Broadcast function: sends data to every connected client
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

	// Heartbeat: ping every 30 seconds
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
					// Notify all clients that a new user has joined.
					broadcast({
						type: "USER_JOINED",
						username,
					});
					// Send an updated users list to all clients.
					broadcast({
						type: "USERS",
						users: Array.from(users.keys()),
					});
					// Optionally, send existing message history to the new user:
					// ws.send(JSON.stringify({ type: "MESSAGE_HISTORY", messages: messageHistory }));
					break;

				case "MESSAGE":
					// Create a message object and optionally store it.
					const msg = {
						type: "MESSAGE",
						username,
						text: data.text,
						timestamp: new Date().toISOString(),
					};
					messageHistory.push(msg);
					// Broadcast the message to all clients.
					broadcast(msg);
					break;

				case "GET_USERS":
					// Send the current user list to the requesting client.
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
