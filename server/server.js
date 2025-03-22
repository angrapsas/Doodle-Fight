const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

const players = new Map();

console.log('WebSocket server started on port 3000');

wss.on('connection', (ws) => {
    const playerId = generatePlayerId();
    console.log(`New player connected: ${playerId}`);
    players.set(playerId, { ws, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0 } });

    // Send initial game state
    ws.send(JSON.stringify({
        type: 'init',
        playerId: playerId,
        players: Array.from(players.entries()).map(([id, data]) => ({
            id,
            position: data.position
        }))
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch(data.type) {
            case 'position':
                players.get(playerId).position = data.position;
                players.get(playerId).rotation = data.rotation;
                broadcast(playerId, {
                    type: 'playerMove',
                    playerId: playerId,
                    position: data.position,
                    rotation: data.rotation
                });
                break;
            // Handle other message types...
        }
    });

    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        players.delete(playerId);
        broadcast(playerId, {
            type: 'playerLeft',
            playerId: playerId
        });
    });
});

function broadcast(senderId, data) {
    players.forEach((player, id) => {
        if (id !== senderId) {
            player.ws.send(JSON.stringify(data));
        }
    });
}

function generatePlayerId() {
    return Math.random().toString(36).substr(2, 9);
} 