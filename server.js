const { WebSocketServer } = require("ws");

const wss = new WebSocketServer({ port: 3001 });

const games = {}; // Store all games

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "createGame") {
            const gameId = generateGameId();
            games[gameId] = {
                gameMaster: ws,
                players: {
                    [data.username]: { ws, currBal: data.initialBal } // Add Game Master as a player
                },
                maxPlayers: data.maxPlayers,
                pot: 0,
                turnIndex: 0,
                started: false
            };
            ws.send(JSON.stringify({ type: "gameCreated", gameId }));
            console.log(`Game Master ${data.username} created game ${gameId} and joined as a player`);
        }
        

        if (data.type === "joinGame") {
            const { gameId, username, initialBal } = data;
            if (!games[gameId]) {
                ws.send(JSON.stringify({ type: "error", message: "Game not found" }));
                return;
            }
            if (Object.keys(games[gameId].players).length >= games[gameId].maxPlayers) {
                ws.send(JSON.stringify({ type: "error", message: "Game is full" }));
                return;
            }

            games[gameId].players[username] = { ws, currBal: initialBal };
            ws.send(JSON.stringify({ type: "joined", gameId }));
            broadcast(gameId, `${username} joined the game`);
            console.log(`${username} joined game ${gameId}`);
        }

        if (data.type === "startGame") {
            const { gameId } = data;
            if (!games[gameId] || games[gameId].gameMaster !== ws) return;
            games[gameId].started = true;
            broadcast(gameId, "Game started!");
            console.log(`Game ${gameId} started`);
        }

        if (data.type === "bet") {
            const { gameId, username, amount } = data;
            if (!games[gameId] || !games[gameId].players[username]) return;
            if (games[gameId].players[username].currBal < amount) {
                ws.send(JSON.stringify({ type: "error", message: "Insufficient balance" }));
                return;
            }

            games[gameId].players[username].currBal -= amount;
            games[gameId].pot += amount;
            broadcast(gameId, `${username} bet ${amount} chips. Pot: ${games[gameId].pot}`);
            console.log(`${username} bet ${amount} chips in game ${gameId}`);
        }

        if (data.type === "endRound") {
            const { gameId } = data;
            if (!games[gameId] || games[gameId].gameMaster !== ws) return;

            broadcast(gameId, "Round ended. Pot resets.");
            games[gameId].pot = 0;
            console.log(`Round ended in game ${gameId}`);
        }

        if (data.type === "leaveGame") {
            const { gameId, username } = data;
            if (games[gameId] && games[gameId].players[username]) {
                delete games[gameId].players[username];
                broadcast(gameId, `${username} left the game`);
                console.log(`${username} left game ${gameId}`);
            }
        }
    });

    ws.on("close", () => {
        for (const gameId in games) {
            if (games[gameId].gameMaster === ws) {
                delete games[gameId];
                console.log(`Game ${gameId} ended`);
            }
        }
    });
});

function broadcast(gameId, message) {
    if (games[gameId]) {
        for (const player in games[gameId].players) {
            games[gameId].players[player].ws.send(JSON.stringify({ type: "message", message }));
        }
    }
}

function generateGameId() {
    return Math.random().toString(36).substr(2, 6);
}

console.log("Poker WebSocket Server running on ws://localhost:3001");
