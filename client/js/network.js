class NetworkManager {
    constructor(game) {
        this.game = game;
        this.ws = new WebSocket('ws://your-ngrok-url.ngrok.io');
        this.playerId = null;

        this.ws.onopen = () => {
            console.log('Connected to server!');
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'init':
                    this.playerId = data.playerId;
                    data.players.forEach(player => {
                        if (player.id !== this.playerId) {
                            this.game.addRemotePlayer(player.id, player.position);
                        }
                    });
                    break;

                case 'playerMove':
                    if (data.playerId !== this.playerId) {
                        this.game.updateRemotePlayer(data.playerId, data.position);
                    }
                    break;

                case 'playerLeft':
                    this.game.removeRemotePlayer(data.playerId);
                    break;
            }
        };

        // Send position updates
        setInterval(() => {
            if (this.game.player) {
                this.sendPosition(this.game.player.mesh.position);
            }
        }, 50); // 20 updates per second
    }

    sendPosition(position) {
        this.ws.send(JSON.stringify({
            type: 'position',
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            rotation: {
                x: this.game.player.rotation.x,
                y: this.game.player.rotation.y
            }
        }));
    }
} 