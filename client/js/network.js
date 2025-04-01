class NetworkManager {
    constructor(game) {
        this.game = game;
        this.playerId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Connect to the deployed server on Railway
        // Railway provides a URL like https://your-app-name.railway.app
        // For WebSockets, we need to use wss:// protocol
        const serverUrl = 'wss://doodle-fight-production.up.railway.app';
        this.connectToServer(serverUrl);
    }
    
    connectToServer(serverUrl) {
        console.log(`Attempting to connect to server: ${serverUrl}`);
        
        try {
            this.socket = new WebSocket(serverUrl);
            
            this.socket.onopen = () => {
                console.log(`Successfully connected to server: ${serverUrl}`);
                this.reconnectAttempts = 0;
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            this.socket.onclose = (event) => {
                console.log(`Disconnected from server: ${event.code} ${event.reason}`);
                
                // Try to reconnect if not a normal closure and we haven't exceeded max attempts
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                    console.log(`Attempting to reconnect in ${delay/1000} seconds...`);
                    
                    setTimeout(() => {
                        this.connectToServer(serverUrl);
                    }, delay);
                }
            };
            
            this.socket.onerror = (error) => {
                console.error(`WebSocket error: ${error}`);
                console.error('Connection failed to: ' + serverUrl);
            };
        } catch (error) {
            console.error(`Failed to create WebSocket: ${error.message}`);
        }
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'connect':
                this.playerId = message.id;
                console.log(`Connected with ID: ${this.playerId}`);
                
                // Add existing players
                message.clients.forEach(client => {
                    this.game.addRemotePlayer(client.id, new THREE.Vector3(0, 0, 0));
                });
                break;
                
            case 'newPlayer':
                console.log(`New player joined: ${message.id}`);
                this.game.addRemotePlayer(message.id, new THREE.Vector3(0, 0, 0));
                break;
                
            case 'playerMove':
                const position = new THREE.Vector3(
                    message.position.x,
                    message.position.y,
                    message.position.z
                );
                this.game.updateRemotePlayer(message.id, position);
                break;
                
            case 'playerLeft':
                console.log(`Player left: ${message.id}`);
                this.game.removeRemotePlayer(message.id);
                break;
                
            default:
                console.log(`Unknown message type: ${message.type}`);
        }
    }
    
    sendPosition(position) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'position',
                position: {
                    x: position.x,
                    y: position.y,
                    z: position.z
                }
            }));
        }
    }
} 
