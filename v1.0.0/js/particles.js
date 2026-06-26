import * as THREE from 'three';

export class WeatherParticles {
    constructor(scene, clouds) {
        this.scene = scene;
        this.clouds = clouds;
        this.rainCount = 6000; // Increased count for better visual density
        this.rainGeometry = null;
        this.rainMaterial = null;
        this.rainParticles = null;
        this.positions = [];
        this.velocities = [];
        
        // Lightning state variables
        this.lightningStrength = 0.0;
        this.isFlashActive = false;
        this.activeBolts = []; // Store active 3D zigzag lightning groups
        this.boltRegenCounter = 0; // Track frames to regenerate persistent crackles

        this.initRain();
    }

    /**
     * Create a rain particle system using a canvas-generated texture for streaks
     */
    initRain() {
        // Generate rain drop texture programmatically
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // Draw a vertical fading white line (streak)
        const gradient = ctx.createLinearGradient(4, 0, 4, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.95)'); // Slightly brighter streaks
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 8, 32);

        const rainTexture = new THREE.CanvasTexture(canvas);

        // Define rain geometries
        this.rainGeometry = new THREE.BufferGeometry();
        const positionsArr = new Float32Array(this.rainCount * 3);

        // Distribute rain particles underneath the cloud objects
        for (let i = 0; i < this.rainCount; i++) {
            let x = 0;
            let y = 0;
            let z = 0;

            if (this.clouds && this.clouds.length > 0) {
                const cloud = this.clouds[Math.floor(Math.random() * this.clouds.length)];
                const cloudPos = cloud.group.position;
                const r = cloud.radius || 7;
                
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * r;
                x = cloudPos.x + Math.cos(angle) * distance;
                z = cloudPos.z + Math.sin(angle) * distance;
                // Distribute vertically from water level (-1) to the cloud Y
                y = -1.0 + Math.random() * (cloudPos.y + 1.0);
            } else {
                x = (Math.random() - 0.5) * 140;
                y = Math.random() * 80;
                z = (Math.random() - 0.5) * 140 - 30;
            }

            positionsArr[i * 3] = x;
            positionsArr[i * 3 + 1] = y;
            positionsArr[i * 3 + 2] = z;

            this.positions.push(x, y, z);
            // Downward velocity + slight wind (X/Z drift)
            this.velocities.push(
                (Math.random() - 0.5) * 0.15, // wind X
                -0.7 - Math.random() * 0.5,   // falling speed Y
                -0.15 - Math.random() * 0.15   // wind Z (drifting towards HK Island)
            );
        }

        this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArr, 3));

        // Point material with transparent map
        this.rainMaterial = new THREE.PointsMaterial({
            size: 0.9,
            map: rainTexture,
            transparent: true,
            opacity: 0.0, // Control via intensity
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.rainParticles = new THREE.Points(this.rainGeometry, this.rainMaterial);
        this.scene.add(this.rainParticles);
    }

    /**
     * Update the rain particles physics and lightning logic
     * @param {number} rainIntensity - from 0.0 (no rain) to 1.5+ (heavy storm)
     * @param {number} lightningChance - probability of triggering lightning (e.g. 0.02)
     */
    update(rainIntensity, lightningChance) {
        // 1. Rain opacity and visibility update
        if (rainIntensity > 0.01) {
            this.rainMaterial.opacity = Math.min(rainIntensity, 0.95);
            this.rainParticles.visible = true;

            // Physics update
            const positionsArr = this.rainGeometry.attributes.position.array;
            
            for (let i = 0; i < this.rainCount; i++) {
                const idx = i * 3;
                
                // Apply velocities
                positionsArr[idx] += this.velocities[idx];     // X
                positionsArr[idx + 1] += this.velocities[idx + 1] * (rainIntensity * 0.8 + 0.2); // Y (faster falling during heavy rain)
                positionsArr[idx + 2] += this.velocities[idx + 2]; // Z
                
                // If it hits water level (Y <= -1.0) or goes out of boundary, reset to top (underneath an active cloud)
                if (positionsArr[idx + 1] < -1.0) {
                    if (this.clouds && this.clouds.length > 0) {
                        const activeClouds = this.clouds.filter(c => c.material.opacity > 0.05);
                        const cloudList = activeClouds.length > 0 ? activeClouds : this.clouds;
                        const cloud = cloudList[Math.floor(Math.random() * cloudList.length)];
                        
                        const cloudPos = cloud.group.position;
                        const r = cloud.radius || 7;
                        const angle = Math.random() * Math.PI * 2;
                        const distance = Math.random() * r;
                        
                        positionsArr[idx] = cloudPos.x + Math.cos(angle) * distance;
                        positionsArr[idx + 1] = cloudPos.y - Math.random() * 2; // start just below the cloud
                        positionsArr[idx + 2] = cloudPos.z + Math.sin(angle) * distance;
                    } else {
                        positionsArr[idx] = (Math.random() - 0.5) * 140;
                        positionsArr[idx + 1] = 60 + Math.random() * 20; // reset to top box
                        positionsArr[idx + 2] = (Math.random() - 0.5) * 140 - 30;
                    }
                }
            }
            this.rainGeometry.attributes.position.needsUpdate = true;
        } else {
            this.rainMaterial.opacity = 0.0;
            this.rainParticles.visible = false;
        }

        // 2. Lightning Simulation for Thunderstorms
        if (lightningChance > 0.01) {
            // Decaying existing lightning flash
            if (this.lightningStrength > 0.01) {
                this.lightningStrength *= 0.80; // quickly decay strength
            } else {
                this.lightningStrength = 0.0;
                this.isFlashActive = false;
            }

            // Chance to trigger a new flash when not currently in a flash (sky flash + thunder sound)
            if (!this.isFlashActive && Math.random() < lightningChance) {
                this.lightningStrength = 4.0 + Math.random() * 4.0;
                this.isFlashActive = true;
                this.triggerFlashEffect();
                this.triggerThunderSound();
            }

            // --- Persistent Crackling Lightning Bolts under EACH cloud ---
            this.boltRegenCounter++;
            if (this.activeBolts.length === 0 || this.boltRegenCounter >= 6) {
                this.boltRegenCounter = 0;
                this.spawnPersistentLightningBolts();
            }

            // Rapid high-frequency electrical flicker every frame
            this.activeBolts.forEach(bolt => {
                if (bolt.userData && bolt.userData.material) {
                    bolt.userData.material.opacity = Math.random() < 0.15 ? 0.05 : (Math.random() < 0.45 ? 0.55 : 1.0);
                }
            });
        } else {
            this.lightningStrength = 0.0;
            this.isFlashActive = false;
            this.clearLightningBolts();
        }
    }

    /**
     * Provide temporary visual flash screen feedback if desired
     */
    triggerFlashEffect() {
        // Create an organic double-flash effect
        setTimeout(() => {
            if (this.isFlashActive) {
                this.lightningStrength = 2.5 + Math.random() * 2.5; // second strike
            }
        }, 120);
    }

    /**
     * Spawns exactly 3 persistent, crackling 3D lightning bolts under EACH active cloud
     */
    spawnPersistentLightningBolts() {
        this.clearLightningBolts();

        if (!this.clouds || this.clouds.length === 0) return;

        // Filter to active/visible clouds
        const activeClouds = this.clouds.filter(c => c.material.opacity > 0.05);
        const cloudList = activeClouds.length > 0 ? activeClouds : this.clouds;

        // Select 1/4 of the active clouds to spawn lightning under (gives a balanced, non-cluttered storm density)
        const targetCount = Math.max(1, Math.floor(cloudList.length / 4));
        const selectedClouds = [];
        const availableClouds = [...cloudList];
        for (let i = 0; i < targetCount; i++) {
            if (availableClouds.length === 0) break;
            const randIdx = Math.floor(Math.random() * availableClouds.length);
            selectedClouds.push(availableClouds.splice(randIdx, 1)[0]);
        }

        selectedClouds.forEach(cloud => {
            const cloudPos = cloud.group.position;

            // Spawn exactly 3 bolts under this cloud
            for (let i = 0; i < 3; i++) {
                // Spread the starting positions locally under the cloud
                const localStartX = (Math.random() - 0.5) * 4;
                const localStartY = -1.5; // just below the cloud
                const localStartZ = (Math.random() - 0.5) * 4;

                // Stop above the ground/buildings (ground is Y=0 globally).
                // Let's compute local endY based on the cloud's current global Y position.
                const globalEndY = 12 + Math.random() * 4;
                const localEndY = -(cloudPos.y - globalEndY);

                const numSegments = 5 + Math.floor(Math.random() * 3); // 5 to 7 zigzag segments
                const segmentHeight = (localStartY - localEndY) / numSegments;

                const boltGroup = new THREE.Group();
                const boltMaterial = new THREE.MeshBasicMaterial({
                    color: '#facc15', // electric yellow
                    transparent: true,
                    opacity: 1.0,
                    depthWrite: false
                });
                boltGroup.userData = { material: boltMaterial };

                let currentPoint = new THREE.Vector3(localStartX, localStartY, localStartZ);
                for (let j = 0; j < numSegments; j++) {
                    const nextY = localStartY - (j + 1) * segmentHeight;
                    // Add local zigzag offset
                    const nextX = localStartX + (Math.random() - 0.5) * 5;
                    const nextZ = localStartZ + (Math.random() - 0.5) * 5;
                    const nextPoint = new THREE.Vector3(nextX, nextY, nextZ);

                    const segmentMesh = this.createCylinderSegment(currentPoint, nextPoint, 0.20, boltMaterial);
                    boltGroup.add(segmentMesh);

                    // Thinner branch lightning (20% chance)
                    if (Math.random() < 0.2 && j > 0 && j < numSegments - 1) {
                        const branchSegments = 2;
                        let branchPoint = currentPoint.clone();
                        for (let k = 0; k < branchSegments; k++) {
                            const bY = branchPoint.y - segmentHeight * 0.7;
                            const bX = branchPoint.x + (Math.random() - 0.5) * 3;
                            const bZ = branchPoint.z + (Math.random() - 0.5) * 3;
                            const nextBranchPoint = new THREE.Vector3(bX, bY, bZ);

                            const branchMesh = this.createCylinderSegment(branchPoint, nextBranchPoint, 0.08, boltMaterial);
                            boltGroup.add(branchMesh);
                            branchPoint = nextBranchPoint;
                        }
                    }

                    currentPoint = nextPoint;
                }

                cloud.group.add(boltGroup); // Add as child of the cloud group so it moves with it!
                this.activeBolts.push(boltGroup);
            }
        });
    }

    /**
     * Helper to create a cylinder mesh extending from pointA to pointB
     */
    createCylinderSegment(pointA, pointB, radius, material) {
        const direction = new THREE.Vector3().subVectors(pointB, pointA);
        const length = direction.length();
        const geom = new THREE.CylinderGeometry(radius, radius * 0.6, length, 5); // tapered cylinder
        geom.translate(0, length / 2, 0);
        geom.rotateX(Math.PI / 2);
        
        const mesh = new THREE.Mesh(geom, material);
        mesh.position.copy(pointA);
        mesh.lookAt(pointB);
        return mesh;
    }

    /**
     * Clears all active lightning bolts from the scene and disposes of resources
     */
    clearLightningBolts() {
        if (this.activeBolts && this.activeBolts.length > 0) {
            this.activeBolts.forEach(boltGroup => {
                if (boltGroup.parent) {
                    boltGroup.parent.remove(boltGroup);
                }
                boltGroup.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                    }
                });
                if (boltGroup.userData && boltGroup.userData.material) {
                    boltGroup.userData.material.dispose();
                }
            });
            this.activeBolts = [];
        }
    }

    /**
     * Triggers a delayed thunder sound to match the lightning strike
     */
    triggerThunderSound() {
        if (!window.bgmPlaying || !window.audioCtx) return;

        const ctx = window.audioCtx;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        // Delay the sound to simulate distance of lightning (0.3s to 1.5s)
        const delay = 300 + Math.random() * 1200;
        setTimeout(() => {
            if (ctx.state === 'suspended' || !window.bgmPlaying) return;
            this.playProceduralThunder(ctx);
        }, delay);
    }

    /**
     * Synthesizes a realistic procedural thunder sound using brown noise and lowpass filtering
     */
    playProceduralThunder(ctx) {
        try {
            const sampleRate = ctx.sampleRate;
            const bufferSize = sampleRate * (3.0 + Math.random() * 2.0); // 3 to 5 seconds
            const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);

            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                // One-pole filter to generate deep brown noise from white noise
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5; // Amplify to normal level
            }

            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = buffer;

            // Low-pass filter for a deep, rumbling base
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(150, ctx.currentTime);
            // Dynamic sweep down to lower frequencies as thunder rolls away
            filter.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + bufferSize / sampleRate);

            // Envelope to shape the thunder crack and roll
            const gainNode = ctx.createGain();
            const now = ctx.currentTime;

            gainNode.gain.setValueAtTime(0.001, now);
            
            // Random peak volume for variety (multiplied by 10 for powerful thunder cracks)
            const peakVolume = (0.35 + Math.random() * 0.35) * 10;
            gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.03); // crack

            // Immediate decay to a lower rumble
            gainNode.gain.exponentialRampToValueAtTime(peakVolume * 0.4, now + 0.4);

            // Create organic rolling rumbling peaks
            const rumbleDuration = bufferSize / sampleRate - 0.5;
            const numRumbles = 4 + Math.floor(Math.random() * 4);
            for (let j = 0; j < numRumbles; j++) {
                const t = 0.4 + (j / numRumbles) * rumbleDuration;
                const volumeFactor = (1.0 - (t / (rumbleDuration + 0.5))) * 0.3; // rumble decays over time
                const rumbleVolume = peakVolume * volumeFactor * (0.5 + Math.random() * 0.5);
                gainNode.gain.linearRampToValueAtTime(rumbleVolume, now + t);
            }

            gainNode.gain.exponentialRampToValueAtTime(0.001, now + bufferSize / sampleRate);

            // Connect graph
            noiseSource.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);

            noiseSource.start(now);
        } catch (e) {
            console.warn("Failed to play procedural thunder sound:", e);
        }
    }
}
