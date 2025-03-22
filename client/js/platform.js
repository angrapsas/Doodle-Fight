class Platform {
    constructor(x, y, z, type = 'normal') {
        this.type = type;
        
        // Create platform with type-specific properties
        const geometry = new THREE.BoxGeometry(5, 0.5, 5);
        let material;
        
        switch(type) {
            case 'normal': // 70% chance
                material = new THREE.MeshPhongMaterial({ 
                    color: 0x4287f5,
                    shininess: 30
                });
                break;
            case 'moving': // 20% chance
                material = new THREE.MeshPhongMaterial({ 
                    color: 0x00ff00,
                    shininess: 50
                });
                break;
            case 'fragile': // 10% chance
                material = new THREE.MeshPhongMaterial({ 
                    color: 0xff4444,
                    shininess: 20,
                    transparent: true,
                    opacity: 1.0
                });
                break;
        }
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, y, z);
        
        // Moving platform properties
        this.isMoving = type === 'moving';
        this.moveDirection = Math.random() < 0.5 ? 'NS' : 'EW';
        this.originalPos = new THREE.Vector3(x, y, z);
        this.moveDistance = 5;  // Reduced from 10 to 5 (one platform length)
        this.moveSpeed = 0.01;  // Reduced from 0.05 to 0.01 (5x slower)
        this.movementProgress = 0;

        // Fragile platform properties
        this.isFragile = type === 'fragile';
        this.isBroken = false;

        // Add back fixed platform properties
        this.isFixed = false;
        this.originalX = null;
        this.originalZ = null;

        // Add warning properties
        this.warningThreshold = -25;
        this.originalColor = this.mesh.material.color.clone();
        this.isWarning = false;

        // Fade properties
        this.fadeStartY = -25;  // Start fading at this height
        this.fadeEndY = -35;    // Fully faded by this height (matches recycleY)
        this.baseOpacity = type === 'fragile' ? 1.0 : 1.0;  // Store initial opacity
    }

    setFixed(isFixed) {
        this.isFixed = isFixed;
        if (isFixed) {
            this.originalX = this.mesh.position.x;
            this.originalZ = this.mesh.position.z;
        }
    }

    update() {
        if (this.isMoving) {
            // Calculate movement using sine wave
            this.movementProgress += this.moveSpeed;
            const offset = Math.sin(this.movementProgress) * this.moveDistance;
            
            if (this.moveDirection === 'NS') {
                this.mesh.position.z = this.originalPos.z + offset;
            } else {
                this.mesh.position.x = this.originalPos.x + offset;
            }
        }

        // Fade effect
        if (this.mesh.position.y < this.fadeStartY) {
            const fadeProgress = Math.max(0, Math.min(1, 
                (this.mesh.position.y - this.fadeEndY) / (this.fadeStartY - this.fadeEndY)
            ));
            this.mesh.material.opacity = this.baseOpacity * fadeProgress;

            // Enable transparency for all platform types during fade
            if (!this.mesh.material.transparent) {
                this.mesh.material.transparent = true;
            }
        }
    }

    break() {
        if (this.isFragile && !this.isBroken) {
            this.isBroken = true;
            this.mesh.material.opacity = 0.3;
        }
    }

    reset() {
        // Reset fragile state
        if (this.isFragile) {
            this.isBroken = false;
        }
        
        // Reset opacity and transparency for all platform types
        this.mesh.material.opacity = this.baseOpacity;
        this.mesh.material.transparent = this.type === 'fragile';
    }
} 