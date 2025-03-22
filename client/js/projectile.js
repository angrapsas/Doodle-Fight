class Projectile {
    constructor(position, direction) {
        this.speed = 1.0;
        this.lifetime = 3000; // milliseconds
        this.createTime = Date.now();
        
        // Create projectile mesh
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Set initial position and direction
        this.mesh.position.copy(position);
        this.direction = direction.normalize();
    }

    update() {
        // Move projectile
        this.mesh.position.x += this.direction.x * this.speed;
        this.mesh.position.y += this.direction.y * this.speed;
        this.mesh.position.z += this.direction.z * this.speed;
        
        // Check if projectile should be removed
        return Date.now() - this.createTime < this.lifetime;
    }
} 