class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xffffff);
        
        // Setup lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 10, 0);
        this.scene.add(directionalLight);
        
        // Initialize game objects
        this.players = new Map();
        this.platforms = [];
        this.projectiles = [];
        
        // Platform movement settings
        this.platformSpeed = 0.05;
        this.platformRecycleY = -35;  // Raised slightly
        this.platformSpawnY = 45;     // Increased slightly to ensure overlap
        
        // Define fixed spawn points
        this.spawnPoints = [
            { x: -10, z: -10 },
            { x: 10, z: -10 },
            { x: -10, z: 10 },
            { x: 10, z: 10 }
        ];
        
        // Add platforms (this will also create the player)
        this.generatePlatforms();
        
        // Setup camera position (now relative to spawn position)
        this.camera.position.set(
            this.spawnPosition.x,
            this.spawnPosition.y + 15,
            this.spawnPosition.z + 30
        );
        this.camera.lookAt(this.spawnPosition.x, this.spawnPosition.y, this.spawnPosition.z);
        
        // Start game loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Add fog for infinite void effect - changed to light gray
        const voidColor = 0xcccccc; // Light gray color
        this.scene.fog = new THREE.Fog(voidColor, 30, 80);
        this.renderer.setClearColor(voidColor); // Changed to light gray background

        // Create graph paper background
        const backgroundSize = 100;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = 512;
        
        // Fill with light background
        ctx.fillStyle = '#e0e8f0';
        ctx.fillRect(0, 0, 512, 512);
        
        // Draw grid lines
        ctx.strokeStyle = '#90a0b0';
        ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let i = 32; i < 512; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 512);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let i = 32; i < 512; i += 32) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(512, i);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        
        // Create background planes - only sides, no top/bottom
        const planeGeometry = new THREE.PlaneGeometry(backgroundSize, backgroundSize);
        const planeMaterial = new THREE.MeshBasicMaterial({ 
            map: texture,
            side: THREE.DoubleSide
        });
        
        // Create only the side walls, remove top and bottom
        const walls = [
            { pos: [0, 0, -backgroundSize/2], rot: [0, 0, 0] },          // back
            { pos: [0, 0, backgroundSize/2], rot: [0, Math.PI, 0] },     // front
            { pos: [-backgroundSize/2, 0, 0], rot: [0, Math.PI/2, 0] },  // left
            { pos: [backgroundSize/2, 0, 0], rot: [0, -Math.PI/2, 0] },  // right
        ];

        walls.forEach(wall => {
            const plane = new THREE.Mesh(planeGeometry, planeMaterial);
            plane.position.set(...wall.pos);
            plane.rotation.set(...wall.rot);
            this.scene.add(plane);
        });

        // Make walls taller to enhance infinite effect
        walls.forEach(wall => {
            const plane = new THREE.Mesh(planeGeometry, planeMaterial);
            plane.position.set(...wall.pos);
            plane.rotation.set(...wall.rot);
            plane.position.y = backgroundSize; // Add upper walls
            this.scene.add(plane);
            
            const plane2 = new THREE.Mesh(planeGeometry, planeMaterial);
            plane2.position.set(...wall.pos);
            plane2.rotation.set(...wall.rot);
            plane2.position.y = -backgroundSize; // Add lower walls
            this.scene.add(plane2);
        });

        this.respawnPoints = [];
        this.activePlayers = 0;
        
        // Add player count tracking
        this.playerCount = 1; // Start with just the local player
        
        // Update UI elements
        this.updateUI();

        // Initialize network manager
        this.network = new NetworkManager(this);

        // Add methods for handling remote players
        this.remotePlayers = new Map();

        // Add debug info for multiplayer
        this.debugElement = document.createElement('div');
        this.debugElement.style.position = 'absolute';
        this.debugElement.style.bottom = '10px';
        this.debugElement.style.left = '10px';
        this.debugElement.style.color = 'white';
        this.debugElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.debugElement.style.padding = '5px';
        this.debugElement.style.fontFamily = 'monospace';
        document.getElementById('ui-overlay').appendChild(this.debugElement);
        
        // Update debug info every second
        setInterval(() => this.updateDebugInfo(), 1000);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.render();
    }
    
    update() {
        if (this.player) {
            this.player.update();
            
            // Only update height display
            const heightElement = document.getElementById('height-gained');
            if (heightElement) {
                heightElement.textContent = `Height: ${Math.floor(this.player.totalHeightGained)}m\nBest: ${this.player.highScore}m`;
            }
        }

        // Update and remove old projectiles
        this.projectiles = this.projectiles.filter(projectile => {
            const isAlive = projectile.update();
            if (!isAlive) {
                this.scene.remove(projectile.mesh);
            }
            return isAlive;
        });

        // Update platforms
        this.platforms.forEach(platform => {
            // Update platform movement
            platform.update();

            platform.mesh.position.y -= this.platformSpeed;

            // If platform goes below recycle point
            if (platform.mesh.position.y < this.platformRecycleY) {
                const newY = this.platformSpawnY + (Math.random() * 5);
                
                if (platform.isFixed) {
                    platform.mesh.position.set(
                        platform.originalX,
                        newY,
                        platform.originalZ
                    );
                    platform.reset();
                } else {
                    // Random platform type based on probabilities
                    let type;
                    const rand = Math.random();
                    if (rand < 0.6) type = 'normal';      // 60% normal (reduced from 70%)
                    else if (rand < 0.8) type = 'moving'; // 20% moving (reduced from 30%)
                    else type = 'fragile';                // 20% fragile (increased from 10%)

                    platform.type = type;
                    platform.isMoving = type === 'moving';
                    platform.isFragile = type === 'fragile';
                    platform.mesh.material.color.setHex(
                        type === 'normal' ? 0x4287f5 :
                        type === 'moving' ? 0x00ff00 :
                        0xff4444
                    );

                    platform.mesh.position.set(
                        platform.originalPos.x,
                        newY,
                        platform.originalPos.z
                    );
                    platform.reset();
                }
            }
        });
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    generatePlatforms() {
        // Create fixed platforms at spawn points first
        this.spawnPoints.forEach(point => {
            const platform = new Platform(point.x, 10, point.z, 'normal');
            platform.setFixed(true);
            this.platforms.push(platform);
            this.scene.add(platform.mesh);
        });

        // Choose a random spawn point for initial player spawn
        const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
        this.spawnPosition = {
            x: spawnPoint.x,
            y: 12,
            z: spawnPoint.z
        };

        // Generate platforms in layers from bottom to top
        const yMin = -30;
        const yMax = 40;
        const yStep = 4;
        const xSpread = 50;  // Increased from 35 to 50
        const zSpread = 50;  // Increased from 35 to 50
        const maxJumpDist = 6;
        const minPlatformDist = 7;
        const verticalClearance = 10;
        const platformSize = 5;

        let currentY = yMin;
        while (currentY <= yMax + 20) {
            const platformsInLayer = 3 + Math.floor(Math.random() * 2); // Changed to 3-4 platforms per layer
            const layerPlatforms = [];
            let layerAttempts = 0;
            const maxLayerAttempts = 100; // More attempts per layer

            // Keep trying until we get enough platforms or too many attempts
            while (layerPlatforms.length < platformsInLayer && layerAttempts < maxLayerAttempts) {
                layerAttempts++;
                let x, z;
                let isValidPosition = false;
                let attempts = 0;
                const maxAttempts = 20;

                while (!isValidPosition && attempts < maxAttempts) {
                    attempts++;
                    x = (Math.random() - 0.5) * xSpread;
                    z = (Math.random() - 0.5) * zSpread;
                    
                    // Check vertical clearance first
                    const nearbyPlatforms = this.platforms.filter(p => {
                        const verticalDist = Math.abs(p.mesh.position.y - currentY);
                        return verticalDist < verticalClearance;
                    });

                    // If any platforms are too close vertically, try new position
                    isValidPosition = !nearbyPlatforms.some(platform => {
                        const dx = Math.abs(platform.mesh.position.x - x);
                        const dz = Math.abs(platform.mesh.position.z - z);
                        return dx < platformSize && dz < platformSize;
                    });

                    // Only check reachability if vertical clearance is good
                    if (isValidPosition && currentY > yMin) {
                        const prevLayerPlatforms = this.platforms.filter(p => 
                            Math.abs(p.mesh.position.y - (currentY - yStep)) < 0.1
                        );
                        
                        // Make first platform in layer always valid if we can't find a reachable spot
                        if (layerPlatforms.length === 0 && attempts > maxAttempts / 2) {
                            isValidPosition = true;
                        } else {
                            isValidPosition = prevLayerPlatforms.some(prevPlatform => {
                                const dx = prevPlatform.mesh.position.x - x;
                                const dz = prevPlatform.mesh.position.z - z;
                                const dist = Math.sqrt(dx * dx + dz * dz);
                                return dist <= maxJumpDist;
                            });
                        }
                    }
                }

                if (isValidPosition) {
                    // Random platform type based on probabilities
                    let type;
                    const rand = Math.random();
                    if (rand < 0.6) type = 'normal';      // 60% normal (reduced from 70%)
                    else if (rand < 0.8) type = 'moving'; // 20% moving (reduced from 30%)
                    else type = 'fragile';                // 20% fragile (increased from 10%)

                    const platform = new Platform(x, currentY, z, type);
                    this.platforms.push(platform);
                    layerPlatforms.push(platform);
                    this.scene.add(platform.mesh);
                }
            }

            currentY += yStep;
        }

        // Create player after setting spawn position
        this.player = new Player(this);
        this.player.mesh.position.copy(this.spawnPosition);
        this.scene.add(this.player.mesh);
    }

    addProjectile(projectile) {
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
    }

    updateUI() {
        // Clear any existing UI elements first
        const uiOverlay = document.getElementById('ui-overlay');
        while (uiOverlay.firstChild) {
            uiOverlay.removeChild(uiOverlay.firstChild);
        }
        
        // Update player count
        const playersElement = document.getElementById('players-remaining');
        if (playersElement) {
            playersElement.textContent = `Players: ${this.playerCount}`;
        }
        
        // Only add height display and death message
        const heightElement = document.createElement('div');
        heightElement.id = 'height-gained';
        heightElement.style.color = 'white';
        heightElement.style.position = 'absolute';
        heightElement.style.top = '20px';
        heightElement.style.left = '20px';
        heightElement.style.fontSize = '18px';
        uiOverlay.appendChild(heightElement);

        const deathMessage = document.createElement('div');
        deathMessage.id = 'death-message';
        deathMessage.style.position = 'absolute';
        deathMessage.style.top = '50%';
        deathMessage.style.left = '50%';
        deathMessage.style.transform = 'translate(-50%, -50%)';
        deathMessage.style.color = 'white';
        deathMessage.style.fontSize = '24px';
        deathMessage.style.textAlign = 'center';
        deathMessage.style.display = 'none';
        deathMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        deathMessage.style.padding = '20px';
        deathMessage.style.borderRadius = '10px';
        uiOverlay.appendChild(deathMessage);
    }

    // Update these methods to handle player count
    addRemotePlayer(id, position) {
        const remotePlayer = new Player(this, true);  // Pass true for isRemote
        remotePlayer.mesh.position.copy(position);
        this.remotePlayers.set(id, remotePlayer);
        this.scene.add(remotePlayer.mesh);
        
        // Increment player count and update UI
        this.playerCount = 1 + this.remotePlayers.size;
        this.updateUI();
    }

    removeRemotePlayer(id) {
        const remotePlayer = this.remotePlayers.get(id);
        if (remotePlayer) {
            this.scene.remove(remotePlayer.mesh);
            this.remotePlayers.delete(id);
            
            // Decrement player count and update UI
            this.playerCount = 1 + this.remotePlayers.size;
            this.updateUI();
        }
    }

    updateDebugInfo() {
        if (!this.debugElement) return;
        
        const connStatus = this.network && this.network.socket ? 
            (this.network.socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected') : 
            'No Network';
        
        const playerIds = this.remotePlayers ? 
            Array.from(this.remotePlayers.keys()).join(', ') : 
            'None';
        
        this.debugElement.innerHTML = `
            Network: ${connStatus}<br>
            Your ID: ${this.network ? this.network.playerId || 'Unknown' : 'N/A'}<br>
            Remote Players: ${this.remotePlayers.size}<br>
            IDs: ${playerIds}
        `;
    }

    updateRemotePlayer(id, position) {
        const remotePlayer = this.remotePlayers.get(id);
        if (remotePlayer) {
            remotePlayer.mesh.position.copy(position);
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    const game = new Game();
}); 