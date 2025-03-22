class Player {
    constructor(game, isRemote = false) {
        this.game = game;
        this.isRemote = isRemote;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.maxFallSpeed = -1.0; // Terminal velocity
        this.speed = 0.3;
        this.bounceForce = 0.6;
        this.gravity = -0.015;

        // Add rotation properties
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.mouseSensitivity = 0.002;
        this.moveDirection = new THREE.Vector3();
        
        // Add pitch limits (in radians)
        this.minPitch = -Math.PI / 3; // -60 degrees
        this.maxPitch = Math.PI / 3;  // +60 degrees

        // Replace the simple sphere with an alien
        this.mesh = this.createAlienMesh(isRemote);
        this.mesh.position.set(0, 0, 0);

        // Setup controls
        this.keys = {
            left: false,
            right: false,
            forward: false,
            backward: false
        };

        // Add key listeners
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Add mouse control
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        // Lock pointer on click
        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });

        this.canShoot = true;
        this.shootCooldown = 125; // Changed from 500 to 125 milliseconds
        
        // Remove mousedown listener and use keydown for shooting
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.shoot();
            }
        });

        this.health = 100;
        this.isAlive = true;
        this.isInvulnerable = false;
        this.invulnerabilityTime = 2000; // 2 seconds
        this.respawnHeight = 0; // Starting height for respawn
        
        // Define death boundary
        this.deathY = -50; // Die when falling below this point

        // Add collision buffer for better platform detection
        this.lastY = 0;

        // Modified height tracking
        this.initialY = null;
        this.allTimeHighestY = 0;
        this.lastPlatformY = 0;
        this.virtualHeight = 0;
        this.totalHeightGained = 0;
        this.heightDeficit = 0;
        this.highScore = 0;
        this.hasStartedTracking = false;
    }

    createAlienMesh(isRemote) {
        // Create a group to hold all alien parts
        const alienGroup = new THREE.Group();

        // Head (slightly oval sphere)
        const headGeometry = new THREE.SphereGeometry(0.4, 32, 32);
        const headMaterial = new THREE.MeshPhongMaterial({
            color: isRemote ? 0x00ff00 : 0x32cd32,  // Green colors
            shininess: 50
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.2;
        head.scale.y = 1.2;  // Make it slightly oval
        alienGroup.add(head);

        // Large black eyes - adjusted to face forward
        const eyeGeometry = new THREE.SphereGeometry(0.15, 32, 32);
        const eyeMaterial = new THREE.MeshPhongMaterial({
            color: 0x000000,
            shininess: 90
        });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.15, 0.3, -0.25);  // Changed from 0.25 to -0.25
        leftEye.scale.y = 1.5;
        leftEye.rotation.x = -0.3;  // Inverted from 0.3 to -0.3
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.15, 0.3, -0.25);  // Changed from 0.25 to -0.25
        rightEye.scale.y = 1.5;
        rightEye.rotation.x = -0.3;  // Inverted from 0.3 to -0.3
        
        alienGroup.add(leftEye);
        alienGroup.add(rightEye);

        // Body (using cylinder instead of capsule)
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: isRemote ? 0x00cc00 : 0x228b22,  // Darker green for body
            shininess: 30
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = -0.3;
        alienGroup.add(body);

        // Direction indicator (antenna)
        const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
        const antennaMaterial = new THREE.MeshPhongMaterial({
            color: 0xcccccc,
            shininess: 80
        });
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0, 0.6, 0);
        antenna.rotation.x = -Math.PI / 4;  // Tilt forward
        alienGroup.add(antenna);

        // Antenna ball tip
        const antennaTipGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaMaterial);
        antennaTip.position.set(0, 0.75, -0.15);
        alienGroup.add(antennaTip);

        // Add a projectile spawn point (invisible)
        const spawnPoint = new THREE.Object3D();
        spawnPoint.position.set(0, 0.3, -0.5);
        alienGroup.add(spawnPoint);
        this.projectileSpawnPoint = spawnPoint;

        return alienGroup;
    }

    onKeyDown(event) {
        switch(event.code) {
            case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
            case 'KeyW': case 'ArrowUp': this.keys.forward = true; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = true; break;
        }
    }

    onKeyUp(event) {
        switch(event.code) {
            case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
            case 'KeyW': case 'ArrowUp': this.keys.forward = false; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = false; break;
        }
    }

    onMouseMove(event) {
        if (document.pointerLockElement === document.body) {
            this.rotation.y -= event.movementX * this.mouseSensitivity;
            this.rotation.x -= event.movementY * this.mouseSensitivity;
            this.rotation.x = Math.max(this.minPitch, Math.min(this.maxPitch, this.rotation.x));
            
            // Update the entire alien mesh rotation
            this.mesh.rotation.y = this.rotation.y;
            // Optionally tilt the alien slightly when looking up/down
            this.mesh.rotation.x = this.rotation.x * 0.5;
        }
    }

    shoot() {
        if (!this.canShoot) return;
        
        // Get shooting direction from player's full rotation
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyEuler(this.rotation);
        
        // Use the projectile spawn point instead of the old nose
        const spawnPoint = new THREE.Vector3();
        this.projectileSpawnPoint.getWorldPosition(spawnPoint);
        
        const projectile = new Projectile(spawnPoint, direction);
        this.game.addProjectile(projectile);
        
        // Start cooldown
        this.canShoot = false;
        setTimeout(() => {
            this.canShoot = true;
        }, this.shootCooldown);
    }

    update() {
        if (this.isRemote) return;
        if (!this.isAlive) return;

        // Calculate movement direction relative to rotation
        this.moveDirection.set(0, 0, 0);
        
        // Get forward and right vectors based on player rotation
        const forward = new THREE.Vector3(0, 0, -1);
        const right = new THREE.Vector3(1, 0, 0);
        forward.applyEuler(this.rotation);
        right.applyEuler(this.rotation);
        
        // Add movement inputs relative to view direction
        if (this.keys.forward) this.moveDirection.add(forward);
        if (this.keys.backward) this.moveDirection.sub(forward);
        if (this.keys.right) this.moveDirection.add(right);
        if (this.keys.left) this.moveDirection.sub(right);
        
        // Normalize movement direction
        if (this.moveDirection.length() > 0) {
            this.moveDirection.normalize();
            // Apply movement speed
            this.mesh.position.x += this.moveDirection.x * this.speed;
            this.mesh.position.z += this.moveDirection.z * this.speed;
        }

        // Store last position for collision check
        this.lastY = this.mesh.position.y;

        // Apply gravity with terminal velocity
        this.velocity.y = Math.max(this.velocity.y + this.gravity, this.maxFallSpeed);
        this.mesh.position.y += this.velocity.y;

        // Platform collision detection
        this.game.platforms.forEach(platform => {
            if (this.velocity.y < 0) {
                const crossedPlatform = 
                    this.lastY - 0.5 >= platform.mesh.position.y + 0.25 &&
                    this.mesh.position.y - 0.5 <= platform.mesh.position.y + 0.25;
                
                if (crossedPlatform &&
                    Math.abs(this.mesh.position.x - platform.mesh.position.x) < 2.5 &&
                    Math.abs(this.mesh.position.z - platform.mesh.position.z) < 2.5) {
                    
                    if (platform.isFragile) {
                        platform.break();
                        if (platform.isBroken) return;
                    }

                    // Start tracking on first platform hit
                    if (!this.hasStartedTracking) {
                        this.hasStartedTracking = true;
                        this.initialY = platform.mesh.position.y;
                        this.allTimeHighestY = platform.mesh.position.y;
                        this.lastPlatformY = platform.mesh.position.y;
                    } else {
                        // If we've fallen, calculate the deficit
                        if (platform.mesh.position.y < this.allTimeHighestY) {
                            this.heightDeficit = this.allTimeHighestY - platform.mesh.position.y;
                        }
                        
                        // Only add height if we're above our last platform AND we've made up any deficit
                        if (platform.mesh.position.y > this.lastPlatformY) {
                            const heightGained = platform.mesh.position.y - this.lastPlatformY;
                            
                            if (this.heightDeficit > 0) {
                                // Reduce deficit first
                                this.heightDeficit = Math.max(0, this.heightDeficit - heightGained);
                            } else {
                                // Only add to virtual height if we've cleared our deficit
                                this.virtualHeight += heightGained;
                                this.totalHeightGained = this.virtualHeight;
                            }
                            
                            // Update all-time highest if we've reached a new peak
                            if (platform.mesh.position.y > this.allTimeHighestY) {
                                this.allTimeHighestY = platform.mesh.position.y;
                            }
                        }
                    }
                    
                    this.lastPlatformY = platform.mesh.position.y;
                    this.mesh.position.y = platform.mesh.position.y + 0.75;
                    this.velocity.y = this.bounceForce;
                }
            }
        });

        // Update camera position and rotation with pitch
        const cameraDistance = 8;  // Changed from 15 to 8
        const cameraHeight = 5;   // Changed from 8 to 5
        
        // Calculate camera position including pitch
        const horizontalDist = Math.cos(this.rotation.x) * cameraDistance;
        const verticalDist = Math.sin(this.rotation.x) * cameraDistance;
        
        this.game.camera.position.x = this.mesh.position.x + Math.sin(this.rotation.y) * horizontalDist;
        this.game.camera.position.y = this.mesh.position.y + cameraHeight - verticalDist;
        this.game.camera.position.z = this.mesh.position.z + Math.cos(this.rotation.y) * horizontalDist;
        
        this.game.camera.lookAt(this.mesh.position);

        // Check for falling death (relative to lowest visible platform)
        const lowestPlatformY = Math.min(...this.game.platforms.map(p => p.mesh.position.y));
        if (this.mesh.position.y < lowestPlatformY - 10) {
            this.die();
            return;
        }

        // Make player flash during invulnerability
        if (this.isInvulnerable) {
            this.mesh.visible = (Date.now() % 200) < 100;
        } else {
            this.mesh.visible = true;
        }
    }

    die() {
        if (this.isInvulnerable) return;
        
        // Update high score but don't show message
        this.highScore = Math.max(this.highScore, Math.floor(this.totalHeightGained));
        
        this.isAlive = false;
        this.health = 0;
        
        setTimeout(() => this.respawn(), 500);
    }

    respawn() {
        // Use the game's spawn position
        if (this.game.spawnPosition) {
            this.mesh.position.set(
                this.game.spawnPosition.x,
                this.game.spawnPosition.y,
                this.game.spawnPosition.z
            );
            
            // Initialize height tracking at spawn
            this.initialY = this.game.spawnPosition.y;
            this.allTimeHighestY = this.game.spawnPosition.y;
            this.lastPlatformY = this.game.spawnPosition.y;
            this.virtualHeight = 0;
            this.totalHeightGained = 0;
            this.heightDeficit = 0;
            this.hasStartedTracking = false;
        } else {
            // Fallback spawn position
            this.mesh.position.set(0, 0, 0);
            this.initialY = 0;
            this.allTimeHighestY = 0;
            this.lastPlatformY = 0;
            this.virtualHeight = 0;
            this.totalHeightGained = 0;
            this.heightDeficit = 0;
            this.hasStartedTracking = false;
        }

        // Reset player state
        this.velocity.set(0, 0, 0);
        this.health = 100;
        this.isAlive = true;
        
        // Add temporary invulnerability
        this.isInvulnerable = true;
        setTimeout(() => {
            this.isInvulnerable = false;
        }, this.invulnerabilityTime);
    }

    // Add method for taking damage (will be used for projectile hits later)
    takeDamage(amount) {
        if (this.isInvulnerable || !this.isAlive) return;
        
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }
} 