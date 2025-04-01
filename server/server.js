const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({
  origin: '*', // In production, you might want to restrict this to your Vercel domain
  methods: ['GET', 'POST']
}));

// Serve static files if needed
app.use(express.static(path.join(__dirname, 'public')));

// Basic health check endpoint for Railway
app.get('/', (req, res) => {
  res.send('Alien Bounce Server is running!');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

console.log('Environment variables:');
console.log(JSON.stringify(process.env, null, 2));

console.log('WebSocket server started on port 3000');

wss.on('connection', (ws) => {
    const id = generateId();
    const color = Math.floor(Math.random() * 0xffffff);
    const metadata = { id, color };
    
    console.log(`New client connected: ${id}`);
    clients.set(ws, metadata);
    
    // Send the client their ID
    ws.send(JSON.stringify({
        type: 'connect',
        id: id,
        clients: [...clients.values()].filter(client => client.id !== id)
    }));
    
    // Broadcast to all other clients that a new player joined
    [...wss.clients]
        .filter(client => client !== ws && client.readyState === WebSocket.OPEN)
        .forEach(client => {
            client.send(JSON.stringify({
                type: 'newPlayer',
                id: id
            }));
        });
    
    ws.on('message', (messageAsString) => {
        try {
            const message = JSON.parse(messageAsString);
            const metadata = clients.get(ws);
            
            // Handle different message types
            if (message.type === 'position') {
                // Broadcast position to all other clients
                [...wss.clients]
                    .filter(client => client !== ws && client.readyState === WebSocket.OPEN)
                    .forEach(client => {
                        client.send(JSON.stringify({
                            type: 'playerMove',
                            id: metadata.id,
                            position: message.position
                        }));
                    });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
    
    ws.on('close', () => {
        const metadata = clients.get(ws);
        if (metadata) {
            console.log(`Client disconnected: ${metadata.id}`);
            clients.delete(ws);
            
            // Broadcast to all clients that a player left
            [...wss.clients]
                .filter(client => client.readyState === WebSocket.OPEN)
                .forEach(client => {
                    client.send(JSON.stringify({
                        type: 'playerLeft',
                        id: metadata.id
                    }));
                });
        }
    });
});

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

// Railway will provide the PORT environment variable
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

console.log('===========================================');
console.log(`Server URL: https://${process.env.RAILWAY_STATIC_URL || 'unknown'}`);
console.log(`WebSocket URL: wss://${process.env.RAILWAY_STATIC_URL || 'unknown'}`);
console.log('==========================================='); 