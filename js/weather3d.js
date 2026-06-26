import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Weather3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Lighting
        this.ambientLight = null;
        this.dirLight = null;

        // Materials & Textures
        this.waterNormalTexture = null;
        this.waterMaterial = null;
        this.buildingMaterial = null;
        this.buildingEmissiveTexture = null;
        this.streetLights = [];
        this.carHeadlightMaterials = [];
        this.carTaillightMaterials = [];
        this.ferryWindowsMaterial = null;
        this.wetRoadMaterial = null;
        this.trafficLights = [];

        // Animated Lists
        this.pedestrians = [];
        this.cars = [];
        this.clouds = [];
        this.ships = [];
        this.palmTrees = [];

        // Celestial bodies
        this.sunMesh = null;
        this.sunMaterial = null;
        this.moonMesh = null;
        this.moonMaterial = null;
        this.currentSunOpacity = 1.0;
        this.currentMoonOpacity = 0.0;

        // Peak Tower Neon Lights
        this.peakTowerLights = [];
        this.peakTowerPointLights = [];

        // New elements state
        this.ferrisWheelRim = null;
        this.ferrisCabins = [];
        this.ferrisWheelLights = [];
        this.queuePeople = []; // Array of queueing people to animate sways
        this.seatedPeople = []; // Array of sitting people references to animate hands
        this.parkDogs = []; // Array of 3 dog objects
        this.beachCrabs = []; // Array of beach crabs
        this.terminalBus = null;
        this.terminalBusWheels = [];
        this.busState = 'parked';
        this.busX = 30; // Adjusted start parked position (starts behind static bus)
        this.busTimer = 10;

        this.init();
    }

    init() {
        // 1. Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2('#38bdf8', 0.003);

        // 2. Camera setup - Starlight Avenue viewpoint (Adjusted to pull back, raise higher, and look down at ships)
        this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(-4.2, 59, 96.5);

        // 3. Renderer setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Capped at 1.5 for performance
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 4. Orbit Controls (Re-enabled with fix for center drag pointer events)
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Limit looking underneath
        this.controls.minDistance = 10;
        this.controls.maxDistance = 150;
        this.controls.target.set(-3.5, 25.2, -28.6);
        this.controls.update();

        // 5. Lighting Setup
        this.ambientLight = new THREE.AmbientLight('#f0f9ff', 0.85);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight('#fef08a', 1.25);
        this.dirLight.position.set(60, 75, -45);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 512; // Reduced to 512 for performance
        this.dirLight.shadow.mapSize.height = 512;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 250;
        const d = 60;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.bias = -0.0003;
        this.scene.add(this.dirLight);

        // Mountain backlight to illuminate the back faces of mountains (Z = -150 pointing forward +Z)
        this.backLight = new THREE.DirectionalLight('#ffffff', 3.0);
        this.backLight.position.set(0, 50, -150);
        this.scene.add(this.backLight);

        // Cityscape soft warm fill-light for night/sunset street illumination (representing city glare behind camera)
        this.cityglowLight = new THREE.DirectionalLight('#ffe4d6', 0.0);
        this.cityglowLight.position.set(0, 35, 45); // Positioned high-behind the camera, facing TST street elements
        this.scene.add(this.cityglowLight);

        // 6. Build Scene elements
        this.generateProceduralAssets();
        this.buildWater();
        this.buildTSTWalkway();
        // Space Museum removed
        this.buildRoad();
        this.buildTrafficLights();
        this.buildHongKongIslandSkyline();
        this.buildNewElements();
        this.buildGround();
        this.buildMountains();

        // Animated Components
        this.buildPalmTrees();
        this.buildFlowerTroughs();
        this.buildClouds();
        this.buildCars();
        this.buildStarFerry();
        this.buildPedestrians();
        this.buildSkyCelestialBodies();

        // 7. Handle Resize
        window.addEventListener('resize', () => this.onWindowResize());

        // 8. Cache Camera Coordinates DOM elements for real-time updates
        this.camPosEl = document.getElementById('cam-pos-val');
        this.camTarEl = document.getElementById('cam-tar-val');
    }

    /**
     * Generate canvas textures procedurally for realistic details without external images
     */
    generateProceduralAssets() {
        // Initialize windows/lantern glow material and car headlights early to prevent undefined errors in builders
        this.ferryWindowsMaterial = new THREE.MeshBasicMaterial({ color: '#fef08a' });
        this.carHeadlightMaterials = [
            new THREE.MeshBasicMaterial({ color: '#fef08a' }),
            new THREE.MeshBasicMaterial({ color: '#fef08a' })
        ];
        this.carTaillightMaterials = [
            new THREE.MeshBasicMaterial({ color: '#ef4444' }),
            new THREE.MeshBasicMaterial({ color: '#ef4444' })
        ];

        // A. Water Normal Map
        const waterCanvas = document.createElement('canvas');
        waterCanvas.width = 128;
        waterCanvas.height = 128;
        const wCtx = waterCanvas.getContext('2d');
        for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 128; x++) {
                const nx = Math.sin(x / 5.0) * Math.cos(y / 10.0) * 0.5 + 0.5;
                const ny = Math.cos(x / 8.0) * Math.sin(y / 4.0) * 0.5 + 0.5;
                const nz = 1.0;
                wCtx.fillStyle = `rgb(${Math.floor(nx * 255)}, ${Math.floor(ny * 255)}, ${Math.floor(nz * 255)})`;
                wCtx.fillRect(x, y, 1, 1);
            }
        }
        this.waterNormalTexture = new THREE.CanvasTexture(waterCanvas);
        this.waterNormalTexture.wrapS = THREE.RepeatWrapping;
        this.waterNormalTexture.wrapT = THREE.RepeatWrapping;
        this.waterNormalTexture.repeat.set(12, 12);

        // B. Skyscrapers Window Lights (Emissive neon texture)
        this.winCanvas = document.createElement('canvas');
        this.winCanvas.width = 256;
        this.winCanvas.height = 512;
        this.winCtx = this.winCanvas.getContext('2d');

        this.lightColors = ['#fef08a', '#93c5fd', '#a7f3d0', '#fbcfe8', '#ffffff', '#fdba74'];
        this.windowsData = [];

        const rows = 32;
        const cols = 4;

        for (let r = 0; r < rows; r++) {
            this.windowsData[r] = [];
            for (let c = 0; c < cols; c++) {
                this.windowsData[r][c] = {
                    isOn: Math.random() > 0.4,
                    color: this.lightColors[Math.floor(Math.random() * this.lightColors.length)]
                };
            }
        }
        this.buildingEmissiveTexture = new THREE.CanvasTexture(this.winCanvas);
        this.buildingEmissiveTexture.wrapS = THREE.RepeatWrapping;
        this.buildingEmissiveTexture.wrapT = THREE.RepeatWrapping;
        this.buildingEmissiveTexture.repeat.set(1, 2);

        this.drawSkyscraperWindows();

        // C. Space Museum removed - assets omitted
    }

    drawSkyscraperWindows() {
        const ctx = this.winCtx;
        ctx.fillStyle = '#0a0d16'; // Off window color
        ctx.fillRect(0, 0, 256, 512);

        const rows = 32;
        const cols = 4;
        const colWidth = 256 / cols;
        const rowHeight = 512 / rows;
        const winSize = 10; // Square window size

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const win = this.windowsData[r][c];
                if (win.isOn) {
                    ctx.fillStyle = win.color;
                    ctx.fillRect(
                        c * colWidth + (colWidth - winSize) / 2,
                        r * rowHeight + (rowHeight - winSize) / 2,
                        winSize,
                        winSize
                    );
                }
            }
        }
    }

    generateStoneTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base stone color (dark brown-red brick)
        ctx.fillStyle = '#7c2d24';
        ctx.fillRect(0, 0, 512, 512);

        // Draw stone slab pattern (pavers)
        ctx.strokeStyle = '#5a1e17'; // darker red-brown grout lines
        ctx.lineWidth = 3;

        const rows = 8;
        const cols = 8;
        const rh = 512 / rows;
        const rw = 512 / cols;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Offset every second row to look like running bond brick pattern
                const xOffset = (r % 2 === 0) ? 0 : rw / 2;
                const x = c * rw + xOffset;
                const y = r * rh;

                ctx.strokeRect(x, y, rw, rh);

                // Add subtle texture noise to each stone
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                for (let i = 0; i < 40; i++) {
                    const rx = x + Math.random() * rw;
                    const ry = y + Math.random() * rh;
                    const size = Math.random() * 2 + 1;
                    ctx.fillRect(rx, ry, size, size);
                }
                ctx.fillStyle = 'rgba(0,0,0,0.04)';
                for (let i = 0; i < 45; i++) {
                    const rx = x + Math.random() * rw;
                    const ry = y + Math.random() * rh;
                    const size = Math.random() * 3 + 1;
                    ctx.fillRect(rx, ry, size, size);
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    generateSandTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base sand color
        ctx.fillStyle = '#dfc39e';
        ctx.fillRect(0, 0, 512, 512);

        // Fine sand grains with color variations, including explicit dark brown and black specks
        const sandColors = [
            '#e8c89f', '#e8c89f', // lighter warm sand
            '#d2b48c', '#d2b48c', // tan / darker sand
            '#c6a67c', // brown sand grain
            '#f5ddbc', // very light sand
            '#b8976c', // dark speckle
            '#5d4037', // dark brown speckle
            '#3e2723', // very dark brown
            '#1c1917', // near black
            '#292524'  // dark charcoal
        ];

        // Increased count to 80000 and size range to 0.8px - 3px for high contrast visibility from a distance
        for (let i = 0; i < 80000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = Math.random() * 2.2 + 0.8;
            ctx.fillStyle = sandColors[Math.floor(Math.random() * sandColors.length)];
            ctx.fillRect(x, y, size, size);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(14, 2); // 10x10 unit tiles on 140x20 beach
        return texture;
    }

    generateRoadTexture(slowText = '慢駛') {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // 1. Asphalt Background
        ctx.fillStyle = '#1e2530';
        ctx.fillRect(0, 0, 2048, 256);

        // Add asphalt noise/grain
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for (let i = 0; i < 5000; i++) {
            const rx = Math.random() * 2048;
            const ry = Math.random() * 256;
            const rw = Math.random() * 2 + 1;
            const rh = Math.random() * 2 + 1;
            ctx.fillRect(rx, ry, rw, rh);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        for (let i = 0; i < 3000; i++) {
            const rx = Math.random() * 2048;
            const ry = Math.random() * 256;
            const rw = Math.random() * 3 + 1;
            const rh = Math.random() * 3 + 1;
            ctx.fillRect(rx, ry, rw, rh);
        }

        // 2. Pedestrian Crossing (Zebra crossing stripes) in the middle
        ctx.fillStyle = '#ffffff';
        const crossingWidth = 120;
        const crossingX = 1024 - crossingWidth / 2;
        // Draw stripes (ladder style)
        for (let y = 10; y < 246; y += 30) {
            ctx.fillRect(crossingX, y, crossingWidth, 18);
        }

        // 3. Center Divider: Double solid white lines in the center (except at crossing)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        const drawCenterLine = (x1, x2) => {
            ctx.beginPath();
            ctx.moveTo(x1, 124);
            ctx.lineTo(x2, 124);
            ctx.moveTo(x1, 132);
            ctx.lineTo(x2, 132);
            ctx.stroke();
        };
        drawCenterLine(0, crossingX - 40);
        drawCenterLine(crossingX + crossingWidth + 40, 2048);

        // 4. Double Yellow Lines (Hong Kong style no-parking lines) along both edges (top and bottom)
        ctx.strokeStyle = '#f59e0b'; // Amber yellow
        ctx.lineWidth = 4;
        const drawDoubleYellow = (y) => {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(2048, y);
            ctx.moveTo(0, y + 6);
            ctx.lineTo(2048, y + 6);
            ctx.stroke();
        };
        drawDoubleYellow(10); // top edge
        drawDoubleYellow(240); // bottom edge

        // 5. Stop lines before crossing
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        // Stop line for Lane 1 (going right, Z=20.8, maps to Y=70 in WebGL V coords flipY=true): stop at X = 908
        ctx.beginPath();
        ctx.moveTo(908, 10);
        ctx.lineTo(908, 124);
        ctx.stroke();

        // Stop line for Lane 2 (going left, Z=25.2, maps to Y=185): stop at X = 1140
        ctx.beginPath();
        ctx.moveTo(1140, 132);
        ctx.lineTo(1140, 246);
        ctx.stroke();

        // 6. Traffic Arrows (Lane Directions)
        const drawArrow = (x, y, scaleX, scaleY, dir) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(dir, 1); // dir = 1 for right, -1 for left
            ctx.fillStyle = '#ffffff';

            // Draw elongated arrow
            ctx.beginPath();
            // Arrow shaft
            ctx.fillRect(-40 * scaleX, -4 * scaleY, 50 * scaleX, 8 * scaleY);
            // Arrow head
            ctx.moveTo(10 * scaleX, -12 * scaleY);
            ctx.lineTo(45 * scaleX, 0);
            ctx.lineTo(10 * scaleX, 12 * scaleY);
            ctx.lineTo(10 * scaleX, -12 * scaleY);
            ctx.fill();
            ctx.restore();
        };

        // Lane 1 (Y = 70, Z = 20.8): traffic goes right (+X, dir = 1)
        drawArrow(400, 70, 1.2, 1.0, 1);
        drawArrow(1600, 70, 1.2, 1.0, 1);

        // Lane 2 (Y = 185, Z = 25.2): traffic goes left (-X, dir = -1)
        drawArrow(400, 185, 1.2, 1.0, -1);
        drawArrow(1600, 185, 1.2, 1.0, -1);

        // Add some "SLOW" / "慢駛" text
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 22px "Microsoft JhengHei", Arial';
        ctx.textAlign = 'center';

        ctx.save();
        ctx.translate(700, 70);
        ctx.fillText(slowText, 0, 8);
        ctx.restore();

        ctx.save();
        ctx.translate(1300, 185);
        ctx.rotate(Math.PI);
        ctx.fillText(slowText, 0, 8);
        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    updateRoadText(slowText = '慢駛') {
        if (this.roadTexture) {
            this.roadTexture.dispose();
        }
        this.roadTexture = this.generateRoadTexture(slowText);
        if (this.wetRoadMaterial) {
            this.wetRoadMaterial.map = this.roadTexture;
            this.wetRoadMaterial.needsUpdate = true;
        }
    }

    buildTrafficLights() {
        this.trafficLights = [];

        // Red, Yellow, Green light materials (emissive)
        this.tlRedMat = new THREE.MeshStandardMaterial({ color: '#330000', emissive: '#000000', roughness: 0.2 });
        this.tlYellowMat = new THREE.MeshStandardMaterial({ color: '#332200', emissive: '#000000', roughness: 0.2 });
        this.tlGreenMat = new THREE.MeshStandardMaterial({ color: '#003300', emissive: '#000000', roughness: 0.2 });

        const createTrafficLight = () => {
            const tl = new THREE.Group();

            // Pole (HK-style black/yellow striped post)
            const poleHeight = 4.2;
            const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, poleHeight, 8);
            const poleMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.7, roughness: 0.3 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = poleHeight / 2;
            pole.castShadow = true;
            tl.add(pole);

            // Add yellow stripes on the post
            const stripeGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8);
            const stripeMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.5, roughness: 0.4 });
            for (let y = 0.5; y < poleHeight - 0.5; y += 1.0) {
                const stripe = new THREE.Mesh(stripeGeo, stripeMat);
                stripe.position.y = y;
                tl.add(stripe);
            }

            // Head Box (black backing board with housing)
            const headBoxGeo = new THREE.BoxGeometry(0.48, 1.1, 0.4);
            const headBoxMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.5 });
            const headBox = new THREE.Mesh(headBoxGeo, headBoxMat);
            headBox.position.set(0, poleHeight + 0.3, 0);
            headBox.castShadow = true;
            tl.add(headBox);

            // Backing board (black front, white border)
            const backBoardGeo = new THREE.BoxGeometry(0.65, 1.25, 0.02);
            const backBoardMat = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.6 });
            const backBoard = new THREE.Mesh(backBoardGeo, backBoardMat);
            backBoard.position.set(0, poleHeight + 0.3, -0.21);
            tl.add(backBoard);

            // White border on backing board
            const borderGeo = new THREE.BoxGeometry(0.68, 1.28, 0.01);
            const borderMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
            const border = new THREE.Mesh(borderGeo, borderMat);
            border.position.set(0, poleHeight + 0.3, -0.22);
            tl.add(border);

            // Lenses (Red, Yellow, Green)
            const lensGeo = new THREE.SphereGeometry(0.12, 12, 12);
            const redLens = new THREE.Mesh(lensGeo, this.tlRedMat.clone());
            redLens.position.set(0, poleHeight + 0.65, 0.2);

            const yellowLens = new THREE.Mesh(lensGeo, this.tlYellowMat.clone());
            yellowLens.position.set(0, poleHeight + 0.3, 0.2);

            const greenLens = new THREE.Mesh(lensGeo, this.tlGreenMat.clone());
            greenLens.position.set(0, poleHeight - 0.05, 0.2);

            tl.add(redLens, yellowLens, greenLens);

            // Visors/Hoods for the lights
            const visorGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.15, 8, 1, true);
            visorGeo.rotateX(Math.PI / 2);
            const visorMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.5 });

            const visorRed = new THREE.Mesh(visorGeo, visorMat);
            visorRed.position.set(0, poleHeight + 0.65, 0.23);
            const visorYellow = new THREE.Mesh(visorGeo, visorMat);
            visorYellow.position.set(0, poleHeight + 0.3, 0.23);
            const visorGreen = new THREE.Mesh(visorGeo, visorMat);
            visorGreen.position.set(0, poleHeight - 0.05, 0.23);

            tl.add(visorRed, visorYellow, visorGreen);

            return {
                group: tl,
                redLens,
                yellowLens,
                greenLens
            };
        };

        // Light 1 (Curb side, facing +X traffic, rotated to face -X)
        const tl1 = createTrafficLight();
        tl1.group.rotation.y = -Math.PI / 2;
        tl1.group.position.set(-8.5, -0.2, 17.5);
        this.scene.add(tl1.group);
        this.trafficLights.push(tl1);

        // Light 2 (Far curb side, facing -X traffic, rotated to face +X)
        const tl2 = createTrafficLight();
        tl2.group.rotation.y = Math.PI / 2;
        tl2.group.position.set(8.5, -0.2, 28.5);
        this.scene.add(tl2.group);
        this.trafficLights.push(tl2);

        // Light 3 (Background near side, facing -X traffic, placed at X = 8.5, rotated to face +X)
        const tl3 = createTrafficLight();
        tl3.group.rotation.y = Math.PI / 2;
        tl3.group.position.set(8.5, 0.1, -76.0);
        this.scene.add(tl3.group);
        this.trafficLights.push(tl3);

        // Light 4 (Background far side, facing +X traffic, placed at X = -8.5, rotated to face -X)
        const tl4 = createTrafficLight();
        tl4.group.rotation.y = -Math.PI / 2;
        tl4.group.position.set(-8.5, 0.1, -87.0);
        this.scene.add(tl4.group);
        this.trafficLights.push(tl4);
    }

    buildWater() {
        const waterGeo = new THREE.PlaneGeometry(140, 64);
        this.waterMaterial = new THREE.MeshStandardMaterial({
            color: '#38bdf8', // Light blue base color
            metalness: 0.95,
            roughness: 0.15,
            normalMap: this.waterNormalTexture,
            normalScale: new THREE.Vector2(0.15, 0.15)
        });
        const water = new THREE.Mesh(waterGeo, this.waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.set(0, 0, -32); // Covers Z = -64 to 0, matching road length (140) and depth to behind skyscrapers
        water.receiveShadow = true;
        this.scene.add(water);
    }

    buildTSTWalkway() {
        // Promenade walkway (Width increased to 17 to touch the Salisbury curb edge at Z = 17)
        const walkGeo = new THREE.BoxGeometry(140, 1.6, 17);
        this.stoneTexture = this.generateStoneTexture();
        this.stoneTexture.wrapS = THREE.RepeatWrapping;
        this.stoneTexture.wrapT = THREE.RepeatWrapping;
        this.stoneTexture.repeat.set(16, 2);

        const walkMat = new THREE.MeshStandardMaterial({
            map: this.stoneTexture,
            color: '#ffffff', // White base to let stone texture colors show correctly
            roughness: 0.9,
            metalness: 0.0
        });
        const walkway = new THREE.Mesh(walkGeo, walkMat);
        walkway.position.set(0, -0.6, 8.5); // Position Z = 8.5, so Z range is 0 to 17 (touching curb at Z = 17)
        walkway.receiveShadow = true;
        walkway.castShadow = true;
        this.scene.add(walkway);

        // Shoreline concrete barrier
        const wallGeo = new THREE.BoxGeometry(140, 2.2, 0.8);
        const wallMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(0, 0.5, 0); // Raised from 0.3 to 0.5
        wall.receiveShadow = true;
        wall.castShadow = true;
        this.scene.add(wall);

        // Walkway Railing
        const railing = new THREE.Group();
        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
        const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 140, 8);
        const railMat = new THREE.MeshStandardMaterial({ color: '#2d3748', metalness: 0.85, roughness: 0.15 });

        const topBar = new THREE.Mesh(barGeo, railMat);
        topBar.rotation.z = Math.PI / 2;
        topBar.position.set(0, 1.1, 0);
        railing.add(topBar);

        const midBar = new THREE.Mesh(barGeo, railMat);
        midBar.rotation.z = Math.PI / 2;
        midBar.position.set(0, 0.6, 0);
        railing.add(midBar);

        for (let x = -70; x <= 70; x += 4) {
            const post = new THREE.Mesh(postGeo, railMat);
            post.position.set(x, 0.6, 0);
            post.castShadow = false; // Optimized: disabled shadow casting
            railing.add(post);
        }
        railing.position.set(0, 0.5, 0.1); // Raised from 0.3 to 0.5
        this.scene.add(railing);

        // Promenade Street Lamps (Modern style matching road streetlights)
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.18, 5.5, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.3 });
        const bulbGeo = new THREE.SphereGeometry(0.22, 12, 12);

        for (let x = -60; x <= 60; x += 20) {
            const group = new THREE.Group();
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = 2.75;
            pole.castShadow = false; // Optimized: disabled shadow casting
            group.add(pole);

            // Horizontal arm extending over the sidewalk (Z-axis direction)
            const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
            const arm = new THREE.Mesh(armGeo, poleMat);
            arm.rotation.x = Math.PI / 2;
            arm.position.set(0, 5.5, 0.9);
            group.add(arm);

            // Bulb
            const bulbMat = new THREE.MeshBasicMaterial({ color: '#1e293b' });
            const bulb = new THREE.Mesh(bulbGeo, bulbMat);
            bulb.position.set(0, 5.5, 1.8);
            group.add(bulb);

            // Only add PointLight on alternate poles to optimize light shader calculations
            let light = null;
            if (x === -40 || x === 0 || x === 40) {
                light = new THREE.PointLight('#fed7aa', 0.0, 50, 0.85);
                light.position.set(0, 5.4, 1.8);
                light.castShadow = false;
                light.shadow.bias = -0.003;
                group.add(light);
            }

            this.streetLights.push({ light, bulbMat });
            group.position.set(x, 0.5, 0.4); // Raised from 0.3 to 0.5
            // Pointing directly inside walkway locally, so no rotation.y rotation is needed
            this.scene.add(group);
        }
    }

    // buildSpaceMuseum removed

    buildRoad() {
        this.beachRocks = [];
        // Salisbury Road
        const roadGeo = new THREE.BoxGeometry(140, 0.2, 10);

        // Wet road material with reflections + custom canvas road texture map
        this.roadTexture = this.generateRoadTexture('慢駛');
        this.wetRoadMaterial = new THREE.MeshStandardMaterial({
            color: '#111827',
            map: this.roadTexture,
            roughness: 0.45,
            metalness: 0.15
        });

        // Use multi-materials to prevent texture stretching on side faces
        const sideMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.8 });
        const roadMaterials = [
            sideMat, // +X face
            sideMat, // -X face
            this.wetRoadMaterial, // +Y (Top face with road texture!)
            sideMat, // -Y face
            sideMat, // +Z face
            sideMat  // -Z face
        ];

        const road = new THREE.Mesh(roadGeo, roadMaterials);
        road.position.set(0, -0.7, 23); // Top surface is at Y = -0.6
        road.receiveShadow = true;
        this.scene.add(road);

        // HK Island land block behind concrete walkway (starts at Z = -44, extends to Z = -220 to cover mountains and skyscraper bases completely)
        // A. Concrete Land: Z from -44 to -145 (depth 101, centered at -94.5) to support skyscrapers, peaks, and forest
        const islandLandGeo = new THREE.BoxGeometry(140, 0.8, 101);
        const islandLandMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9, metalness: 0.0 }); // Same grey as the fence
        const islandLand = new THREE.Mesh(islandLandGeo, islandLandMat);
        islandLand.position.set(0, -0.35, -94.5); // Top surface at Y = 0.05
        islandLand.receiveShadow = true;
        this.scene.add(islandLand);

        // B. Sandy Beach: Z from -145 to -165 (depth 20, centered at -155) behind the forest
        const beachGeo = new THREE.BoxGeometry(140, 0.8, 20);
        this.sandTexture = this.generateSandTexture();
        const beachMat = new THREE.MeshStandardMaterial({
            map: this.sandTexture,
            color: '#ffffff', // Let texture canvas colors show natively
            roughness: 0.95,
            metalness: 0.0
        });
        const beach = new THREE.Mesh(beachGeo, beachMat);
        beach.position.set(0, -0.35, -155); // Top surface at Y = 0.05
        beach.receiveShadow = true;
        this.scene.add(beach);

        // B2. Rocks on the beach (18 jagged low-poly rocks of random sizes, rotations, and stone tones)
        const rockColors = ['#64748b', '#475569', '#334155', '#57534e', '#78716c', '#44403c'];
        for (let i = 0; i < 18; i++) {
            const color = rockColors[Math.floor(Math.random() * rockColors.length)];
            const rockMat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.95,
                metalness: 0.05
            });

            // Random size: radius from 0.4 to 2.0
            const radius = 0.4 + Math.random() * 1.6;
            const geo = new THREE.DodecahedronGeometry(radius, 0); // detail 0 = jagged rock
            
            // Randomly stretch/compress the rock shape
            const rx = 0.8 + Math.random() * 0.6;
            const ry = 0.5 + Math.random() * 0.5; // flatter on vertical Y axis
            const rz = 0.8 + Math.random() * 0.6;
            
            const rock = new THREE.Mesh(geo, rockMat);
            rock.scale.set(rx, ry, rz);

            // Random position on the beach (X: -65 to 65, Z: -147 to -163)
            const rx_pos = -65 + Math.random() * 130;
            const rz_pos = -147 - Math.random() * 16;
            const ry_pos = 0.05 - (radius * ry * 0.25); // Embed slightly in the sand

            rock.position.set(rx_pos, ry_pos, rz_pos);
            rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);

            // Store rock information for crab collision avoidance
            this.beachRocks.push({
                x: rx_pos,
                z: rz_pos,
                radius: radius * Math.max(rx, rz)
            });
        }

        // B3. Spawn 5 orange crabs on the beach
        this.beachCrabs = [];
        const createCrabModel = () => {
            const crab = new THREE.Group();
            const crabMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.6 }); // orange
            const blackMat = new THREE.MeshBasicMaterial({ color: '#000000' });

            // Shell
            const shellGeo = new THREE.SphereGeometry(0.12, 8, 8);
            const shell = new THREE.Mesh(shellGeo, crabMat);
            shell.scale.set(1.4, 0.7, 1.0);
            shell.position.y = 0.06;
            shell.castShadow = true;
            crab.add(shell);

            // Eyes
            const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
            const eyeL = new THREE.Mesh(eyeGeo, blackMat);
            eyeL.position.set(-0.05, 0.14, 0.11);
            const eyeR = new THREE.Mesh(eyeGeo, blackMat);
            eyeR.position.set(0.05, 0.14, 0.11);
            crab.add(eyeL, eyeR);

            // Claws (attached forward-center to avoid leg overlap)
            const clawGeo = new THREE.SphereGeometry(0.07, 6, 6);
            const clawL = new THREE.Mesh(clawGeo, crabMat);
            clawL.scale.set(1.3, 1.0, 1.0);
            clawL.position.set(-0.09, 0.04, 0.16);
            const clawR = new THREE.Mesh(clawGeo, crabMat);
            clawR.scale.set(1.3, 1.0, 1.0);
            clawR.position.set(0.09, 0.04, 0.16);
            crab.add(clawL, clawR);

            // Jointed legs (longer and thinner for maximum visibility, attached at underside side edges)
            const legs = [];
            
            const createLeg = (isLeft, idx) => {
                const legGroup = new THREE.Group();
                
                const thighLength = 0.5;
                const thighGeo = new THREE.CylinderGeometry(0.018, 0.013, thighLength, 5);
                thighGeo.translate(0, -thighLength / 2, 0); // pivot at top
                const thigh = new THREE.Mesh(thighGeo, crabMat);
                
                const shinLength = 0.7;
                const shinGeo = new THREE.CylinderGeometry(0.013, 0.006, shinLength, 5);
                shinGeo.translate(0, -shinLength / 2, 0); // pivot at top
                const shin = new THREE.Mesh(shinGeo, crabMat);
                shin.position.set(0, -thighLength, 0); // connect to bottom of thigh
                
                if (isLeft) {
                    thigh.rotation.z = 1.7; // Point out & slightly up
                    shin.rotation.z = -1.1; // Point down & out
                    legGroup.rotation.y = 0.2 - idx * 0.25; // Spread legs
                } else {
                    thigh.rotation.z = -1.7; // Point out & slightly up
                    shin.rotation.z = 1.1; // Point down & out
                    legGroup.rotation.y = -0.2 + idx * 0.25; // Spread legs
                }
                
                legGroup.add(thigh);
                thigh.add(shin);
                
                thigh.castShadow = true;
                thigh.receiveShadow = true;
                shin.castShadow = true;
                shin.receiveShadow = true;
                
                return legGroup;
            };

            // Left legs (X < 0)
            for (let idx = 0; idx < 3; idx++) {
                const leg = createLeg(true, idx);
                const zOffset = 0.09 - idx * 0.09;
                leg.position.set(-0.13, 0.02, zOffset);
                crab.add(leg);
                legs.push(leg);
            }

            // Right legs (X > 0)
            for (let idx = 0; idx < 3; idx++) {
                const leg = createLeg(false, idx);
                const zOffset = 0.09 - idx * 0.09;
                leg.position.set(0.13, 0.02, zOffset);
                crab.add(leg);
                legs.push(leg);
            }

            return { group: crab, legs };
        };

        // Spawn 5 crabs at random positions on the beach (X: -50 to 50, Z: -147 to -162)
        for (let i = 0; i < 5; i++) {
            const crabObj = createCrabModel();
            
            // Random start position
            const cx = -50 + Math.random() * 100;
            const cz = -147 - Math.random() * 14;
            // Scale the crabs slightly differently for organic variation (larger to be clearly visible from Salisbury Road)
            const scale = 1.6 + Math.random() * 0.8;
            const cy = 0.05 + 0.493 * scale; // Set Y dynamically so legs touch the sand surface at Y = 0.05
            
            crabObj.group.position.set(cx, cy, cz);
            crabObj.group.scale.set(scale, scale, scale);
            
            this.scene.add(crabObj.group);
            this.beachCrabs.push({
                group: crabObj.group,
                legs: crabObj.legs,
                x: cx,
                z: cz,
                scale: scale,
                collisionRadius: 0.5 * scale,
                dir: Math.random() > 0.5 ? 1 : -1,
                speed: 0.008 + Math.random() * 0.012, // slightly faster to match scale
                rangeMin: cx - 8 - Math.random() * 10,
                rangeMax: cx + 8 + Math.random() * 10
            });
        }

        // C. Background Sea/Water: Z from -165 to -220 (depth 55, centered at -192.5) extending to the horizon
        const bgWaterGeo = new THREE.PlaneGeometry(140, 55);
        const bgWater = new THREE.Mesh(bgWaterGeo, this.waterMaterial);
        bgWater.rotation.x = -Math.PI / 2;
        bgWater.position.set(0, 0.01, -192.5); // Slightly above 0.0 to avoid z-fighting
        bgWater.receiveShadow = true;
        this.scene.add(bgWater);

        // Background HK Island Road (Z = -81.5)
        const bgRoadGeo = new THREE.BoxGeometry(140, 0.2, 10);
        const bgRoad = new THREE.Mesh(bgRoadGeo, roadMaterials);
        bgRoad.position.set(0, 0.0, -81.5); // Top surface is at Y = 0.1
        bgRoad.receiveShadow = true;
        this.scene.add(bgRoad);

        // Near Sidewalk pavement border (Thicker to avoid gaps under the sidewalk)
        const curbGeo = new THREE.BoxGeometry(140, 1.2, 1.0);
        const curbMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 });
        const curb = new THREE.Mesh(curbGeo, curbMat);
        curb.position.set(0, -0.6, 17.5); // Top surface at Y = 0.0, bottom Y = -1.2
        curb.receiveShadow = true;
        this.scene.add(curb);

        // Far Sidewalk pavement border (Symmetric curb on the other side of Salisbury Road)
        const farCurb = new THREE.Mesh(curbGeo, curbMat);
        farCurb.position.set(0, -0.6, 28.5); // Top surface at Y = 0.0
        farCurb.receiveShadow = true;
        this.scene.add(farCurb);

        // 4x Brightness Road Streetlights (Modern tall posts along the sidewalk, casting light onto Salisbury Road)
        const roadPoleGeo = new THREE.CylinderGeometry(0.1, 0.18, 5.5, 8);
        const roadPoleMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.3 });
        const roadBulbGeo = new THREE.SphereGeometry(0.22, 12, 12);

        const roadXPositions = [-50, -30, -10, 10, 30, 50];
        roadXPositions.forEach((x, index) => {
            const group = new THREE.Group();
            const pole = new THREE.Mesh(roadPoleGeo, roadPoleMat);
            pole.position.y = 2.75;
            pole.castShadow = false; // Optimized: disabled shadow casting
            group.add(pole);

            // Horizontal arm extending over the road (Z-axis direction)
            const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
            const arm = new THREE.Mesh(armGeo, roadPoleMat);
            arm.rotation.x = Math.PI / 2;
            arm.position.set(0, 5.5, 0.9);
            group.add(arm);

            // Bulb
            const bulbMat = new THREE.MeshBasicMaterial({ color: '#1e293b' });
            const bulb = new THREE.Mesh(roadBulbGeo, bulbMat);
            bulb.position.set(0, 5.5, 1.8);
            group.add(bulb);

            // Only add PointLight on alternate poles to optimize light shader calculations
            let light = null;
            if (index % 2 === 0) {
                light = new THREE.PointLight('#fed7aa', 0.0, 50, 0.85);
                light.position.set(0, 5.4, 1.8);
                light.castShadow = false;
                light.shadow.bias = -0.003;
                group.add(light);
            }

            this.streetLights.push({ light, bulbMat });
            group.position.set(x, -0.05, 17.2); // Slightly embedded on curb top to prevent z-fighting
            group.rotation.y = Math.PI; // Rotate 180 degrees to face inside walkway
            this.scene.add(group);
        });
    }

    buildPalmTrees() {
        this.palmTrees = [];
        const trunkGeo = new THREE.CylinderGeometry(0.1, 0.22, 4.2, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
        const leafMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.5, metalness: 0.1 });

        const xPositions = [-50, -30, -10, 10, 30, 50];
        xPositions.forEach(x => {
            const tree = new THREE.Group();

            // Curved trunk
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 2.1;
            trunk.rotation.z = (Math.random() - 0.5) * 0.18; // slight wind tilt
            trunk.castShadow = false; // Optimized
            tree.add(trunk);

            // Leaf canopy (Realistic multi-layer palm fronds)
            const leafLayers = 2;
            const frondsPerLayer = 8;
            for (let l = 0; l < leafLayers; l++) {
                const heightScale = 1.0 - (l * 0.1);
                for (let i = 0; i < frondsPerLayer; i++) {
                    const angle = (i / frondsPerLayer) * Math.PI * 2 + (l * 0.2);
                    const leafGeo = new THREE.ConeGeometry(0.45, 2.2, 4);
                    const leaf = new THREE.Mesh(leafGeo, leafMat);

                    leaf.position.set(0, 4.2 - (l * 0.25), 0);
                    leaf.rotation.set(
                        Math.PI / (2.2 + l * 0.4),  // drop angle
                        angle,
                        0,
                        'YXZ'
                    );
                    leaf.scale.set(1.0, heightScale, 0.12);
                    leaf.castShadow = false; // Optimized
                    tree.add(leaf);
                }
            }

            tree.position.set(x, 0.05, -94);

            // Randomize size and height to make them organically taller and larger
            const randomWidthScale = 1.8 + Math.random() * 0.9; // Width/depth scale range: 1.8 to 2.7
            const randomHeightScale = randomWidthScale * (1.1 + Math.random() * 0.4); // Height scale range: ~2.0 to 3.8
            tree.scale.set(randomWidthScale, randomHeightScale, randomWidthScale);

            this.scene.add(tree);
            this.palmTrees.push(tree);
        });
    }

    buildFlowerTroughs() {
        // Geometries for hollow planter (outer size 2.4 x 0.45 x 0.8)
        const baseGeo = new THREE.BoxGeometry(2.4, 0.1, 0.8);
        const sideWallGeo = new THREE.BoxGeometry(2.4, 0.35, 0.1);
        const endWallGeo = new THREE.BoxGeometry(0.1, 0.35, 0.6);
        const planterMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 });

        // Nested soil (size 2.2 x 0.28 x 0.6, top surface will sit at Y = 0.38, which is 0.07 units below the rim)
        const soilGeo = new THREE.BoxGeometry(2.2, 0.28, 0.6);
        const soilMat = new THREE.MeshStandardMaterial({ color: '#271206', roughness: 1.0, metalness: 0.0 });

        const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.25, 5);
        stemGeo.translate(0, 0.125, 0); // Offset pivot to bottom
        const stemMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.6 });

        const headGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const flowerColors = ['#dc2626', '#facc15', '#f8fafc']; // Red, Yellow, White

        // Cache materials to avoid redundant instantiation (130 materials down to 3)
        const flowerMaterials = {
            '#dc2626': new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.5 }),
            '#facc15': new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.5 }),
            '#f8fafc': new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 })
        };

        const spawnPlanter = (x, z) => {
            const group = new THREE.Group();

            // 1. Bottom base (height 0.1)
            const base = new THREE.Mesh(baseGeo, planterMat);
            base.position.y = 0.05;
            base.receiveShadow = true;
            base.castShadow = false;
            group.add(base);

            // 2. Front side wall
            const frontWall = new THREE.Mesh(sideWallGeo, planterMat);
            frontWall.position.set(0, 0.275, 0.35);
            frontWall.receiveShadow = true;
            frontWall.castShadow = false;
            group.add(frontWall);

            // 3. Back side wall
            const backWall = new THREE.Mesh(sideWallGeo, planterMat);
            backWall.position.set(0, 0.275, -0.35);
            backWall.receiveShadow = true;
            backWall.castShadow = false;
            group.add(backWall);

            // 4. Left end wall
            const leftWall = new THREE.Mesh(endWallGeo, planterMat);
            leftWall.position.set(-1.15, 0.275, 0);
            leftWall.receiveShadow = true;
            leftWall.castShadow = false;
            group.add(leftWall);

            // 5. Right end wall
            const rightWall = new THREE.Mesh(endWallGeo, planterMat);
            rightWall.position.set(1.15, 0.275, 0);
            rightWall.receiveShadow = true;
            rightWall.castShadow = false;
            group.add(rightWall);

            // 6. Nested Soil (sits from Y=0.10 to Y=0.38 inside the hollow planter rim Y=0.45)
            const soil = new THREE.Mesh(soilGeo, soilMat);
            soil.position.set(0, 0.24, 0);
            soil.receiveShadow = true;
            group.add(soil);

            // Spawn 10 flowers inside each planter
            for (let i = 0; i < 10; i++) {
                const flowerColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
                const flowerMat = flowerMaterials[flowerColor];

                const flower = new THREE.Group();

                // Stem
                const stem = new THREE.Mesh(stemGeo, stemMat);
                flower.add(stem);

                // Head
                const head = new THREE.Mesh(headGeo, flowerMat);
                head.position.y = 0.25;
                flower.add(head);

                // Random position inside soil
                const fx = (Math.random() - 0.5) * 1.8;
                const fz = (Math.random() - 0.5) * 0.4;
                const fy = 0.38; // Sits on the soil surface

                // Random scale variation
                const fs = 0.8 + Math.random() * 0.45;
                flower.scale.set(fs, fs, fs);
                flower.position.set(fx, fy, fz);

                group.add(flower);
            }

            group.position.set(x, 0.2, z); // Y=0.2 sits on top of the walkway (walkway top is Y=0.2)
            this.scene.add(group);
        };

        // 1. Curb side planters (Z = 16.2) between curb-side streetlights (at -50, -30, -10, 10, 30, 50)
        // Including 2 more at the very front and back (X = -60 and X = 60)
        const curbXPositions = [-60, -40, -20, 0, 20, 40, 60];
        curbXPositions.forEach(x => spawnPlanter(x, 16.2));

        // 2. Shoreline side planters (Z = 1.2) between shoreline streetlights (at -60, -40, -20, 0, 20, 40, 60)
        const shorelineXPositions = [-50, -30, -10, 10, 30, 50];
        shorelineXPositions.forEach(x => spawnPlanter(x, 1.2));
    }

    buildClouds() {
        const cloudMat = new THREE.MeshStandardMaterial({
            color: '#ffffff',
            roughness: 0.9,
            metalness: 0.0,
            transparent: true,
            opacity: 0.45
        });

        const cloudConfigs = [
            { x: -55, y: 38, z: -35, r: 6, isExtra: false },
            { x: -20, y: 44, z: -55, r: 8, isExtra: false },
            { x: 15, y: 36, z: -25, r: 7, isExtra: false },
            { x: 48, y: 42, z: -48, r: 9, isExtra: false },
            { x: -40, y: 32, z: 5, r: 5, isExtra: false },
            { x: 30, y: 39, z: 15, r: 6, isExtra: false },
            
            // Extra clouds for cloudy/stormy weather
            { x: -70, y: 45, z: -60, r: 7, isExtra: true },
            { x: -35, y: 40, z: -45, r: 8, isExtra: true },
            { x: -5, y: 35, z: -30, r: 6, isExtra: true },
            { x: 5, y: 42, z: -50, r: 9, isExtra: true },
            { x: 28, y: 46, z: -40, r: 7, isExtra: true },
            { x: 60, y: 38, z: -30, r: 8, isExtra: true },
            { x: -15, y: 30, z: 0, r: 5, isExtra: true },
            { x: 45, y: 33, z: 10, r: 5, isExtra: true },
            { x: -50, y: 36, z: -15, r: 6, isExtra: true }
        ];

        cloudConfigs.forEach(conf => {
            const cloud = new THREE.Group();
            const sphereGeo = new THREE.DodecahedronGeometry(conf.r, 1);
            const myCloudMat = cloudMat.clone();

            const core = new THREE.Mesh(sphereGeo, myCloudMat);
            cloud.add(core);

            const left = new THREE.Mesh(sphereGeo, myCloudMat);
            left.position.set(-conf.r * 0.65, -conf.r * 0.15, 0);
            left.scale.setScalar(0.7);
            cloud.add(left);

            const right = new THREE.Mesh(sphereGeo, myCloudMat);
            right.position.set(conf.r * 0.65, -conf.r * 0.15, 0);
            right.scale.setScalar(0.7);
            cloud.add(right);

            const top = new THREE.Mesh(sphereGeo, myCloudMat);
            top.position.set(0, conf.r * 0.45, -conf.r * 0.1);
            top.scale.setScalar(0.85);
            cloud.add(top);

            cloud.position.set(conf.x, conf.y, conf.z);
            this.scene.add(cloud);
            this.clouds.push({
                group: cloud,
                speed: 0.012 + Math.random() * 0.016,
                material: myCloudMat,
                baseZ: conf.z,
                isExtra: conf.isExtra,
                radius: conf.r
            });
        });
    }

    buildCars() {
        const baseSpecs = [
            // Foreground Salisbury Road (Z > 0)
            { type: 'taxi-red', color: '#b91c1c', roofColor: '#f8fafc', z: 20.8, dir: 1, speed: 0.14, w: 2.3, h: 0.85, d: 1.1 },
            { type: 'minibus', color: '#fef08a', roofColor: '#15803d', z: 25.2, dir: -1, speed: 0.095, w: 3.4, h: 1.4, d: 1.3 },
            { type: 'bus-double', color: '#decba5', roofColor: '#decba5', z: 25.2, dir: -1, speed: 0.08, w: 5.2, h: 2.6, d: 1.45 },
            { type: 'car-cyan', color: '#0891b2', roofColor: '#0891b2', z: 20.8, dir: 1, speed: 0.16, w: 2.4, h: 0.8, d: 1.15 },

            // Background HK Island Road (Z < 0) aligned to Z = -79.3 and Z = -83.7 lanes (Directions reversed)
            { type: 'taxi-red', color: '#b91c1c', roofColor: '#f8fafc', z: -79.3, dir: -1, speed: 0.13, w: 2.3, h: 0.85, d: 1.1 },
            { type: 'minibus', color: '#fef08a', roofColor: '#15803d', z: -83.7, dir: 1, speed: 0.09, w: 3.4, h: 1.4, d: 1.3 },
            { type: 'car-cyan', color: '#0891b2', roofColor: '#0891b2', z: -79.3, dir: -1, speed: 0.15, w: 2.4, h: 0.8, d: 1.15 },
            { type: 'taxi-red', color: '#b91c1c', roofColor: '#f8fafc', z: -83.7, dir: 1, speed: 0.12, w: 2.3, h: 0.85, d: 1.1 }
        ];

        // Create 8 cars by duplicating base specs with offset initial positions to ensure at least 3 visible simultaneously
        const carSpecs = [];
        for (let i = 0; i < 8; i++) {
            const base = baseSpecs[i];
            const spec = { ...base };
            spec.speed = base.speed * (0.85 + Math.random() * 0.3);
            carSpecs.push(spec);
        }

        carSpecs.forEach((spec, index) => {
            const car = new THREE.Group();

            // 1. Lower Chassis
            let bodyGeo, cabinGeo, cabinPos;
            if (spec.type === 'bus-double') {
                bodyGeo = new THREE.BoxGeometry(spec.w, spec.h * 0.5, spec.d);
            } else {
                bodyGeo = new THREE.BoxGeometry(spec.w, spec.h * 0.6, spec.d);
            }
            const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, metalness: 0.8, roughness: 0.2 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = (spec.type === 'bus-double' ? (spec.h * 0.5) : (spec.h * 0.6)) / 2 + 0.15;
            body.castShadow = false; // Optimized
            car.add(body);

            // 2. Upper Cabin
            if (spec.type === 'bus-double') {
                cabinGeo = new THREE.BoxGeometry(spec.w * 0.98, spec.h * 0.5, spec.d * 0.98);
                cabinPos = new THREE.Vector3(0, spec.h * 0.5 + (spec.h * 0.5) / 2 + 0.15, 0);
            } else {
                cabinGeo = new THREE.BoxGeometry(spec.w * 0.65, spec.h * 0.55, spec.d * 0.9);
                cabinPos = new THREE.Vector3(-spec.w * 0.05, spec.h * 0.6 + (spec.h * 0.55) / 2 + 0.1, 0);
            }
            const cabinMat = new THREE.MeshStandardMaterial({ color: spec.roofColor, metalness: 0.7, roughness: 0.25 });
            const cabin = new THREE.Mesh(cabinGeo, cabinMat);
            cabin.position.copy(cabinPos);
            cabin.castShadow = false; // Optimized
            car.add(cabin);

            // Windows
            const winMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.1, metalness: 0.9 });
            if (spec.type === 'bus-double') {
                // Lower deck side windows
                const lowerWinL = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.85, spec.h * 0.16, 0.02), winMat);
                lowerWinL.position.set(0, spec.h * 0.3 + 0.15, spec.d * 0.505);
                const lowerWinR = lowerWinL.clone();
                lowerWinR.position.z = -spec.d * 0.505;
                car.add(lowerWinL, lowerWinR);

                // Upper deck side windows
                const upperWinL = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.9, spec.h * 0.18, 0.02), winMat);
                upperWinL.position.set(0, spec.h * 0.76 + 0.15, spec.d * 0.505);
                const upperWinR = upperWinL.clone();
                upperWinR.position.z = -spec.d * 0.505;
                car.add(upperWinL, upperWinR);

                // Front Windshield
                const frontWind = new THREE.Mesh(new THREE.BoxGeometry(0.02, spec.h * 0.75, spec.d * 0.9), winMat);
                frontWind.position.set(spec.dir * (spec.w * 0.495), spec.h * 0.5 + 0.15, 0);
                car.add(frontWind);
            } else {
                const sideWinL = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.5, spec.h * 0.35, 0.02), winMat);
                sideWinL.position.set(-spec.w * 0.05, spec.h * 0.85, spec.d * 0.46);
                const sideWinR = sideWinL.clone();
                sideWinR.position.z = -spec.d * 0.46;
                car.add(sideWinL, sideWinR);
            }

            // 3. Wheels
            const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
            const wheelMat = new THREE.MeshStandardMaterial({ color: '#0b0f19', roughness: 0.95 });
            const wheels = [];
            const wheelOffsets = [
                { x: -spec.w * 0.28, z: -spec.d * 0.48 },
                { x: -spec.w * 0.28, z: spec.d * 0.48 },
                { x: spec.w * 0.28, z: -spec.d * 0.48 },
                { x: spec.w * 0.28, z: spec.d * 0.48 }
            ];

            // Spokes (silver-grey line indicators on wheel outer and inner faces to make rotation visible)
            const spokeMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.7, roughness: 0.1 });

            wheelOffsets.forEach(offset => {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.rotation.x = Math.PI / 2;
                w.position.set(offset.x, 0.32, offset.z);
                w.castShadow = false; // Optimized

                // Add spokes to make rotation clearly visible
                const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.03, 0.06), spokeMat);
                spoke1.position.y = 0.115; // Outer face
                const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.58), spokeMat);
                spoke2.position.y = 0.115;
                w.add(spoke1, spoke2);

                const spoke3 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.03, 0.06), spokeMat);
                spoke3.position.y = -0.115; // Inner face
                const spoke4 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.58), spokeMat);
                spoke4.position.y = -0.115;
                w.add(spoke3, spoke4);

                car.add(w);
                wheels.push(w);
            });

            // 4. Headlights / Taillights
            const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
            const headL = new THREE.Mesh(headGeo, this.carHeadlightMaterials[0]);
            const headR = new THREE.Mesh(headGeo, this.carHeadlightMaterials[0]);
            const tailGeo = new THREE.BoxGeometry(0.04, 0.12, 0.24);
            const tailL = new THREE.Mesh(tailGeo, this.carTaillightMaterials[0]);
            const tailR = new THREE.Mesh(tailGeo, this.carTaillightMaterials[0]);

            if (spec.dir === 1) {
                headL.position.set(spec.w * 0.5, spec.h * 0.4, -spec.d * 0.35);
                headR.position.set(spec.w * 0.5, spec.h * 0.4, spec.d * 0.35);
                tailL.position.set(-spec.w * 0.5, spec.h * 0.4, -spec.d * 0.35);
                tailR.position.set(-spec.w * 0.5, spec.h * 0.4, spec.d * 0.35);
            } else {
                headL.position.set(-spec.w * 0.5, spec.h * 0.4, -spec.d * 0.35);
                headR.position.set(-spec.w * 0.5, spec.h * 0.4, spec.d * 0.35);
                tailL.position.set(spec.w * 0.5, spec.h * 0.4, -spec.d * 0.35);
                tailR.position.set(spec.w * 0.5, spec.h * 0.4, spec.d * 0.35);
            }
            car.add(headL, headR, tailL, tailR);

            // Taxi sign
            if (spec.type === 'taxi-red') {
                const signGeo = new THREE.BoxGeometry(0.25, 0.16, 0.55);
                const signMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
                const sign = new THREE.Mesh(signGeo, signMat);
                sign.position.set(0, spec.h * 1.25, 0);
                car.add(sign);
            }

            // Add SpotLight for headlights pointing forward (only for first 2 cars to optimize performance)
            let headlight = null;
            if (index < 2) {
                const targetObj = new THREE.Object3D();
                targetObj.position.set(spec.dir * 10, spec.h * 0.2, 0);
                car.add(targetObj);

                headlight = new THREE.SpotLight('#fef08a', 0.0, 30, Math.PI / 4, 0.6, 1.0);
                headlight.position.set(spec.dir * (spec.w * 0.5), spec.h * 0.4, 0);
                headlight.target = targetObj;
                car.add(headlight);
            }

            // Interleaved initial positioning across roads to prevent overlap
            let initialX = 0;
            if (spec.dir === 1) {
                const laneIndex = index % 4;
                initialX = -65 + laneIndex * 30; // Fits within new [-70, 70] boundary
            } else {
                const laneIndex = index % 4;
                initialX = -48.5 + laneIndex * 30;
            }
            const initialY = spec.z < 0 ? 0.1 : -0.6;
            car.position.set(initialX, initialY, spec.z); // Placed on road top surface
            this.scene.add(car);

            this.cars.push({
                group: car,
                wheels,
                dir: spec.dir,
                baseSpeed: spec.speed, // Store the original base speed
                speed: spec.speed,
                z: spec.z,
                width: spec.w,
                headlight
            });
        });
    }

    buildStarFerry() {
        this.ships = [];

        const createFerryModel = (hullColor = '#0f5132') => {
            const ferry = new THREE.Group();

            // 1. Lower hull (Classic dark green, red, or yellow)
            const greenHullGeo = new THREE.BoxGeometry(11, 1.4, 3.6);
            const greenHullMat = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.3, metalness: 0.2 });
            const greenHull = new THREE.Mesh(greenHullGeo, greenHullMat);
            greenHull.position.y = 0.7;
            greenHull.castShadow = true;
            ferry.add(greenHull);

            // 2. Upper deck structure (Classic white/cream)
            const whiteDeckGeo = new THREE.BoxGeometry(9.6, 1.2, 3.2);
            const whiteDeckMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 });
            const whiteDeck = new THREE.Mesh(whiteDeckGeo, whiteDeckMat);
            whiteDeck.position.y = 1.9;
            whiteDeck.castShadow = true;
            ferry.add(whiteDeck);

            // 3. Roof deck
            const roofGeo = new THREE.BoxGeometry(9.8, 0.18, 3.4);
            const roofMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.y = 2.5;
            ferry.add(roof);

            // 4. Smokestack (Chimney)
            const funnelGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.1, 10);
            const funnelMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.85, roughness: 0.15 });
            const funnel = new THREE.Mesh(funnelGeo, funnelMat);
            funnel.position.set(0, 3.1, 0);
            funnel.castShadow = true;
            ferry.add(funnel);

            // 5. Port-hole windows on sides
            const windowGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10);
            windowGeo.rotateX(Math.PI / 2);

            for (let x = -3.8; x <= 3.8; x += 1.8) {
                // Right Side Windows
                const winR = new THREE.Mesh(windowGeo, this.ferryWindowsMaterial);
                winR.position.set(x, 1.9, 1.61);
                ferry.add(winR);
                // Left Side Windows
                const winL = new THREE.Mesh(windowGeo, this.ferryWindowsMaterial);
                winL.position.set(x, 1.9, -1.61);
                ferry.add(winL);
            }

            // Flashing Navigation & Decorative Lights
            const lights = [];
            const addLight = (color, x, y, z, freq, offset) => {
                const geo = new THREE.SphereGeometry(0.12, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: color });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y, z);
                ferry.add(mesh);
                lights.push({ mesh, mat, originalColor: new THREE.Color(color), freq, offset });
            };
            addLight('#ffffff', 0, 3.65, 0, 2.5, 0); // Mast beacon
            addLight('#ef4444', 4.0, 1.9, -1.62, 1.8, 0.2); // Port red
            addLight('#22c55e', 4.0, 1.9, 1.62, 1.8, 0.4); // Starboard green
            addLight('#f59e0b', -4.8, 1.9, 0, 3.0, 0.6); // Stern amber
            ferry.userData.flashingLights = lights;

            return ferry;
        };

        const createJunkBoatModel = () => {
            const junk = new THREE.Group();

            // 1. Hull (Classic dark wood brown)
            const hullGeo = new THREE.BoxGeometry(8, 1.2, 2.8);
            const hullMat = new THREE.MeshStandardMaterial({ color: '#5c2d18', roughness: 0.8, metalness: 0.1 });
            const hull = new THREE.Mesh(hullGeo, hullMat);
            hull.position.y = 0.6;
            hull.castShadow = true;
            junk.add(hull);

            // Tapered bow (front wedge/block)
            const bowGeo = new THREE.BoxGeometry(2, 1.2, 2.2);
            const bow = new THREE.Mesh(bowGeo, hullMat);
            bow.position.set(4.5, 0.7, 0);
            bow.rotation.y = Math.PI / 4;
            bow.scale.set(0.7, 1.0, 0.7);
            junk.add(bow);

            // Raised stern (rear block)
            const sternGeo = new THREE.BoxGeometry(2.2, 1.8, 2.8);
            const stern = new THREE.Mesh(sternGeo, hullMat);
            stern.position.set(-4.0, 0.9, 0);
            stern.castShadow = true;
            junk.add(stern);

            // Deck (Lighter wood color)
            const deckGeo = new THREE.BoxGeometry(7.6, 0.1, 2.6);
            const deckMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.9 });
            const deck = new THREE.Mesh(deckGeo, deckMat);
            deck.position.set(0.1, 1.25, 0);
            junk.add(deck);

            // Stern canopy (arched brown shelter at the back)
            const canopyGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.0, 8, 1, false, 0, Math.PI);
            canopyGeo.rotateZ(Math.PI / 2);
            const canopyMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.85 });
            const canopy = new THREE.Mesh(canopyGeo, canopyMat);
            canopy.position.set(-2.2, 1.85, 0);
            canopy.scale.set(1.0, 1.0, 1.2);
            junk.add(canopy);

            // Stern window/lantern
            const lanternGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            const lantern = new THREE.Mesh(lanternGeo, this.ferryWindowsMaterial);
            lantern.position.set(-4.8, 1.6, 0);
            junk.add(lantern);

            // 2. Masts (Dark wood posts)
            const mastMat = new THREE.MeshStandardMaterial({ color: '#3f200f', metalness: 0.2, roughness: 0.9 });

            // Foremast (front)
            const foremastGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.0, 8);
            const foremast = new THREE.Mesh(foremastGeo, mastMat);
            foremast.position.set(2.8, 3.5, 0);
            foremast.rotation.z = -0.1;
            junk.add(foremast);

            // Mainmast (center)
            const mainmastGeo = new THREE.CylinderGeometry(0.1, 0.1, 7.2, 8);
            const mainmast = new THREE.Mesh(mainmastGeo, mastMat);
            mainmast.position.set(-0.2, 4.6, 0);
            junk.add(mainmast);

            // Mizzenmast (rear)
            const mizzenmastGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8);
            const mizzenmast = new THREE.Mesh(mizzenmastGeo, mastMat);
            mizzenmast.position.set(-3.2, 3.4, 0);
            mizzenmast.rotation.z = 0.05;
            junk.add(mizzenmast);

            // 3. Sails (Red plates with wooden battens)
            const sailMat = new THREE.MeshStandardMaterial({
                color: '#b91c1c',
                roughness: 0.85,
                side: THREE.DoubleSide
            });
            const battenMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.9 });

            const addSail = (mastX, mastHeight, sailW, sailH, tiltZ, tiltY) => {
                const sailGroup = new THREE.Group();
                const sailGeo = new THREE.BoxGeometry(sailW, sailH, 0.05);
                const sail = new THREE.Mesh(sailGeo, sailMat);
                sail.position.set(-sailW * 0.45, 0, 0);
                sailGroup.add(sail);

                const battenCount = 4;
                for (let i = 0; i <= battenCount; i++) {
                    const by = -sailH / 2 + (i / battenCount) * sailH;
                    const battenGeo = new THREE.BoxGeometry(sailW * 1.05, 0.08, 0.08);
                    const batten = new THREE.Mesh(battenGeo, battenMat);
                    batten.position.set(-sailW * 0.45, by, 0.04);
                    sailGroup.add(batten);
                }

                sailGroup.position.set(mastX, mastHeight, 0);
                sailGroup.rotation.y = tiltY;
                sailGroup.rotation.z = tiltZ;
                junk.add(sailGroup);
            };

            addSail(2.8, 3.6, 1.8, 3.2, -0.1, 0.12);
            addSail(-0.2, 4.6, 2.8, 4.8, 0.0, 0.16);
            addSail(-3.2, 3.5, 1.4, 2.4, 0.05, 0.10);

            // Flashing Navigation & Decorative Lights
            const lights = [];
            const addLight = (color, x, y, z, freq, offset) => {
                const geo = new THREE.SphereGeometry(0.12, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: color });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y, z);
                junk.add(mesh);
                lights.push({ mesh, mat, originalColor: new THREE.Color(color), freq, offset });
            };
            addLight('#fef08a', 2.8, 6.0, 0, 1.5, 0); // Foremast top
            addLight('#fef08a', -0.2, 8.2, 0, 1.2, 0.3); // Mainmast top
            addLight('#fef08a', -3.2, 5.5, 0, 1.8, 0.6); // Mizzenmast top
            addLight('#f59e0b', -4.8, 1.6, 0, 4.0, 0.1); // Stern lantern flicker
            junk.userData.flashingLights = lights;

            return junk;
        };

        const createCruiseShipModel = () => {
            const cruise = new THREE.Group();

            // 1. Lower Hull (Navy Blue)
            const hullLowerGeo = new THREE.BoxGeometry(17, 1.2, 3.6);
            const hullLowerMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.3, metalness: 0.5 });
            const hullLower = new THREE.Mesh(hullLowerGeo, hullLowerMat);
            hullLower.position.y = 0.6;
            hullLower.castShadow = true;
            cruise.add(hullLower);

            // Pointed Bow bottom
            const bowLowerGeo = new THREE.BoxGeometry(2.4, 1.2, 3.6);
            const bowLower = new THREE.Mesh(bowLowerGeo, hullLowerMat);
            bowLower.position.set(8.5 + 0.3, 0.6, 0);
            bowLower.rotation.y = Math.PI / 4;
            bowLower.scale.set(0.7, 1.0, 0.7);
            cruise.add(bowLower);

            // 2. Upper Hull (Clean white)
            const hullUpperGeo = new THREE.BoxGeometry(16.5, 1.2, 3.6);
            const hullUpperMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 });
            const hullUpper = new THREE.Mesh(hullUpperGeo, hullUpperMat);
            hullUpper.position.y = 1.7;
            hullUpper.castShadow = true;
            cruise.add(hullUpper);

            // Pointed Bow top
            const bowUpperGeo = new THREE.BoxGeometry(2.3, 1.2, 3.6);
            const bowUpper = new THREE.Mesh(bowUpperGeo, hullUpperMat);
            bowUpper.position.set(8.25 + 0.3, 1.7, 0);
            bowUpper.rotation.y = Math.PI / 4;
            bowUpper.scale.set(0.7, 1.0, 0.7);
            cruise.add(bowUpper);

            // 3. Tiered Decks
            // Deck 1 (Mid deck)
            const deck1Geo = new THREE.BoxGeometry(11, 0.9, 3.2);
            const deck1 = new THREE.Mesh(deck1Geo, hullUpperMat);
            deck1.position.set(-1.0, 2.65, 0);
            deck1.castShadow = true;
            cruise.add(deck1);

            // Deck 2 (Bridge and top deck)
            const deck2Geo = new THREE.BoxGeometry(8, 0.8, 2.8);
            const deck2 = new THREE.Mesh(deck2Geo, hullUpperMat);
            deck2.position.set(-1.5, 3.4, 0);
            deck2.castShadow = true;
            cruise.add(deck2);

            // Bridge windshield (glows yellow at night)
            const bridgeGeo = new THREE.BoxGeometry(0.8, 0.45, 2.45);
            const bridgeWind = new THREE.Mesh(bridgeGeo, this.ferryWindowsMaterial);
            bridgeWind.position.set(2.4, 3.5, 0);
            cruise.add(bridgeWind);

            // Deck 3 (Sun deck/pool deck structure)
            const deck3Geo = new THREE.BoxGeometry(5.2, 0.1, 2.4);
            const sunDeck = new THREE.Mesh(deck3Geo, hullUpperMat);
            sunDeck.position.set(-2.0, 3.85, 0);
            cruise.add(sunDeck);

            // 4. Windows / Cabin Balconies
            const winMat = this.ferryWindowsMaterial;
            const windowBarGeo = new THREE.BoxGeometry(10, 0.25, 3.62);
            const windowBar = new THREE.Mesh(windowBarGeo, winMat);
            windowBar.position.set(-1.0, 1.7, 0);
            cruise.add(windowBar);

            const windowBar2Geo = new THREE.BoxGeometry(8, 0.2, 3.22);
            const windowBar2 = new THREE.Mesh(windowBar2Geo, winMat);
            windowBar2.position.set(-1.0, 2.65, 0);
            cruise.add(windowBar2);

            // 5. Classic funnel (tilted back red & black cylinder)
            const funnelGroup = new THREE.Group();
            const funnelRedGeo = new THREE.CylinderGeometry(0.42, 0.48, 1.2, 8);
            const funnelRedMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3 });
            const funnelRed = new THREE.Mesh(funnelRedGeo, funnelRedMat);
            funnelRed.position.y = 0.6;
            funnelRed.castShadow = true;
            funnelGroup.add(funnelRed);

            const funnelBlackGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.35, 8);
            const funnelBlackMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 });
            const funnelBlack = new THREE.Mesh(funnelBlackGeo, funnelBlackMat);
            funnelBlack.position.y = 1.3;
            funnelGroup.add(funnelBlack);

            funnelGroup.position.set(-2.5, 3.8, 0);
            funnelGroup.rotation.z = -0.15;
            cruise.add(funnelGroup);

            // 6. Swimming Pool details on sun deck
            const poolGeo = new THREE.BoxGeometry(2.0, 0.05, 1.2);
            const poolMat = new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.2, metalness: 0.8 });
            const pool = new THREE.Mesh(poolGeo, poolMat);
            pool.position.set(0.8, 3.86, 0);
            cruise.add(pool);

            // 7. Radar mast (white mast at front of Deck 2)
            const mastGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8);
            const mast = new THREE.Mesh(mastGeo, hullUpperMat);
            mast.position.set(2.0, 4.3, 0);
            cruise.add(mast);

            // Crossbars
            const crossbarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8);
            crossbarGeo.rotateX(Math.PI / 2);
            const crossbar = new THREE.Mesh(crossbarGeo, hullUpperMat);
            crossbar.position.set(2.0, 4.7, 0);
            cruise.add(crossbar);

            // Flashing Navigation & Decorative Lights
            const lights = [];
            const addLight = (color, x, y, z, freq, offset) => {
                const geo = new THREE.SphereGeometry(0.14, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: color });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y, z);
                cruise.add(mesh);
                lights.push({ mesh, mat, originalColor: new THREE.Color(color), freq, offset });
            };
            addLight('#ffffff', 2.0, 5.0, 0, 3.5, 0); // Radar mast beacon
            addLight('#ef4444', -2.5, 5.15, 0, 2.0, 0.5); // Funnel warning light
            addLight('#22c55e', 8.5, 1.75, 1.82, 1.5, 0.2); // Green starboard
            addLight('#ef4444', 8.5, 1.75, -1.82, 1.5, 0.4); // Red port
            // Windows decorative strip lights along the sides
            addLight('#eab308', -6.0, 2.65, 1.62, 2.2, 0.1);
            addLight('#eab308', -2.0, 2.65, 1.62, 2.2, 0.3);
            addLight('#eab308', 2.0, 2.65, 1.62, 2.2, 0.5);
            addLight('#eab308', -6.0, 2.65, -1.62, 2.2, 0.2);
            addLight('#eab308', -2.0, 2.65, -1.62, 2.2, 0.4);
            addLight('#eab308', 2.0, 2.65, -1.62, 2.2, 0.6);
            cruise.userData.flashingLights = lights;

            return cruise;
        };

        const createContainerShipModel = () => {
            const ship = new THREE.Group();
            
            // 1. Lower Hull (Crimson Red)
            const hullLowerGeo = new THREE.BoxGeometry(20, 1.5, 4.4);
            const hullLowerMat = new THREE.MeshStandardMaterial({ color: '#7f1d1d', roughness: 0.4, metalness: 0.3 });
            const hullLower = new THREE.Mesh(hullLowerGeo, hullLowerMat);
            hullLower.position.y = 0.75;
            hullLower.castShadow = true;
            ship.add(hullLower);

            // Pointed Bow
            const bowLowerGeo = new THREE.BoxGeometry(2.8, 1.5, 4.4);
            const bowLower = new THREE.Mesh(bowLowerGeo, hullLowerMat);
            bowLower.position.set(10.0 + 0.3, 0.75, 0);
            bowLower.rotation.y = Math.PI / 4;
            bowLower.scale.set(0.7, 1.0, 0.7);
            ship.add(bowLower);

            // 2. Upper Hull Deck (Black)
            const hullUpperGeo = new THREE.BoxGeometry(19.8, 0.4, 4.4);
            const hullUpperMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.5 });
            const hullUpper = new THREE.Mesh(hullUpperGeo, hullUpperMat);
            hullUpper.position.y = 1.7;
            hullUpper.castShadow = true;
            ship.add(hullUpper);

            // Bow top
            const bowUpperGeo = new THREE.BoxGeometry(2.7, 0.4, 4.4);
            const bowUpper = new THREE.Mesh(bowUpperGeo, hullUpperMat);
            bowUpper.position.set(9.9 + 0.3, 1.7, 0);
            bowUpper.rotation.y = Math.PI / 4;
            bowUpper.scale.set(0.7, 1.0, 0.7);
            ship.add(bowUpper);

            // 3. Superstructure / Cabin at Stern (White)
            const cabinGeo = new THREE.BoxGeometry(3.5, 3.2, 3.8);
            const cabinMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 });
            const cabin = new THREE.Mesh(cabinGeo, cabinMat);
            cabin.position.set(-6.5, 3.5, 0);
            cabin.castShadow = true;
            ship.add(cabin);

            // Bridge window strip
            const winMat = this.ferryWindowsMaterial;
            const bridgeGeo = new THREE.BoxGeometry(1.2, 0.5, 3.82);
            const bridge = new THREE.Mesh(bridgeGeo, winMat);
            bridge.position.set(-5.6, 4.4, 0);
            ship.add(bridge);

            // Funnel (Black)
            const funnelGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 8);
            const funnelMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
            const funnel = new THREE.Mesh(funnelGeo, funnelMat);
            funnel.position.set(-7.5, 5.8, 0);
            funnel.castShadow = true;
            ship.add(funnel);

            // 4. Containers stacked on deck
            const containerColors = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#eab308'];
            const containerGeo = new THREE.BoxGeometry(2.8, 1.6, 1.8);
            
            const spawnContainer = (x, y, z, color) => {
                const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.1 });
                const box = new THREE.Mesh(containerGeo, mat);
                box.position.set(x, y, z);
                box.castShadow = true;
                ship.add(box);
            };

            // Tier 1
            const startX = -3.2;
            for (let r = 0; r < 4; r++) {
                const cx = startX + r * 3.4;
                const colorL = containerColors[(r) % containerColors.length];
                const colorR = containerColors[(r + 2) % containerColors.length];
                spawnContainer(cx, 2.7, -1.0, colorL);
                spawnContainer(cx, 2.7, 1.0, colorR);
            }
            // Tier 2
            for (let r = 0; r < 3; r++) {
                const cx = startX + 0.5 + r * 3.4;
                const colorL = containerColors[(r + 3) % containerColors.length];
                const colorR = containerColors[(r + 1) % containerColors.length];
                spawnContainer(cx, 4.3, -1.0, colorL);
                spawnContainer(cx, 4.3, 1.0, colorR);
            }

            // Flashing lights
            const lights = [];
            const addLight = (color, x, y, z, freq, offset) => {
                const geo = new THREE.SphereGeometry(0.18, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: color });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y, z);
                ship.add(mesh);
                lights.push({ mesh, mat, originalColor: new THREE.Color(color), freq, offset });
            };
            addLight('#ffffff', -7.5, 6.8, 0, 2.5, 0); // Mast warning
            addLight('#22c55e', 10.0, 1.8, 2.22, 1.8, 0.2); // Starboard green
            addLight('#ef4444', 10.0, 1.8, -2.22, 1.8, 0.4); // Port red
            ship.userData.flashingLights = lights;

            return ship;
        };

        const createSpeedboatModel = () => {
            const boat = new THREE.Group();

            // 1. Sleek hull (Vibrant yellow/white)
            const hullGeo = new THREE.BoxGeometry(4.2, 0.6, 1.6);
            const hullMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.2, metalness: 0.6 });
            const hull = new THREE.Mesh(hullGeo, hullMat);
            hull.position.y = 0.3;
            hull.castShadow = true;
            boat.add(hull);

            // Sleek pointed bow
            const bowGeo = new THREE.BoxGeometry(1.2, 0.6, 1.6);
            const bow = new THREE.Mesh(bowGeo, hullMat);
            bow.position.set(2.1 + 0.15, 0.3, 0);
            bow.rotation.y = Math.PI / 4;
            bow.scale.set(0.7, 1.0, 0.7);
            boat.add(bow);

            // Upper deck/cabin trim (white)
            const deckGeo = new THREE.BoxGeometry(3.0, 0.25, 1.5);
            const deckMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3 });
            const deck = new THREE.Mesh(deckGeo, deckMat);
            deck.position.set(-0.4, 0.7, 0);
            deck.castShadow = true;
            boat.add(deck);

            // Sleek blue windshield
            const glassGeo = new THREE.BoxGeometry(0.6, 0.35, 1.3);
            const glassMat = new THREE.MeshStandardMaterial({ color: '#0284c7', transparent: true, opacity: 0.7, roughness: 0.1 });
            const glass = new THREE.Mesh(glassGeo, glassMat);
            glass.position.set(0.6, 0.95, 0);
            glass.rotation.z = -0.2;
            boat.add(glass);

            // Outboard motor (black box at the stern)
            const motorGeo = new THREE.BoxGeometry(0.5, 0.8, 0.5);
            const motorMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5, metalness: 0.7 });
            const motor = new THREE.Mesh(motorGeo, motorMat);
            motor.position.set(-2.2, 0.4, 0);
            motor.castShadow = true;
            boat.add(motor);

            // Flashing lights
            const lights = [];
            const addLight = (color, x, y, z, freq, offset) => {
                const geo = new THREE.SphereGeometry(0.08, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: color });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y, z);
                boat.add(mesh);
                lights.push({ mesh, mat, originalColor: new THREE.Color(color), freq, offset });
            };
            addLight('#22c55e', 2.1, 0.6, 0.82, 2.0, 0.1); // Starboard green
            addLight('#ef4444', 2.1, 0.6, -0.82, 2.0, 0.3); // Port red
            boat.userData.flashingLights = lights;

            return boat;
        };

        const createLongboatModel = () => {
            const boat = new THREE.Group();

            // 1. Long, narrow wooden hull (Teak/warm brown wood)
            const hullGeo = new THREE.BoxGeometry(8.5, 0.45, 1.2);
            const hullMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8, metalness: 0.1 });
            const hull = new THREE.Mesh(hullGeo, hullMat);
            hull.position.y = 0.225;
            hull.castShadow = true;
            boat.add(hull);

            // Pointed Bow
            const bowGeo = new THREE.BoxGeometry(1.0, 0.45, 1.2);
            const bow = new THREE.Mesh(bowGeo, hullMat);
            bow.position.set(4.25 + 0.15, 0.225, 0);
            bow.rotation.y = Math.PI / 4;
            bow.scale.set(0.7, 1.0, 0.7);
            boat.add(bow);

            // Pointed Stern
            const sternGeo = new THREE.BoxGeometry(1.0, 0.45, 1.2);
            const stern = new THREE.Mesh(sternGeo, hullMat);
            stern.position.set(-4.25 - 0.15, 0.225, 0);
            stern.rotation.y = -Math.PI / 4;
            stern.scale.set(0.7, 1.0, 0.7);
            boat.add(stern);

            // Small canopy / roof shelter in middle (White/Cream arched cover)
            const canopyGeo = new THREE.CylinderGeometry(0.7, 0.7, 3.2, 8, 1, false, 0, Math.PI);
            canopyGeo.rotateZ(Math.PI / 2);
            const canopyMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.7 });
            const canopy = new THREE.Mesh(canopyGeo, canopyMat);
            canopy.position.set(-0.5, 1.0, 0);
            canopy.scale.set(1.0, 1.0, 1.6);
            canopy.castShadow = true;
            boat.add(canopy);

            // Canopy support pillars
            const pillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6);
            const pillarMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
            
            const addPillar = (x, z) => {
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(x, 0.6, z);
                boat.add(pillar);
            };
            addPillar(-2.0, 0.5);
            addPillar(-2.0, -0.5);
            addPillar(1.0, 0.5);
            addPillar(1.0, -0.5);

            // Flashing lights
            const lights = [];
            const addLight = (color, x, y, z, freq, offset) => {
                const geo = new THREE.SphereGeometry(0.08, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: color });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y, z);
                boat.add(mesh);
                lights.push({ mesh, mat, originalColor: new THREE.Color(color), freq, offset });
            };
            addLight('#22c55e', 4.25, 0.45, 0.62, 1.5, 0.1); // Starboard green
            addLight('#ef4444', 4.25, 0.45, -0.62, 1.5, 0.3); // Port red
            addLight('#ffffff', -0.5, 1.7, 0, 2.0, 0.5); // Top canopy beacon
            boat.userData.flashingLights = lights;

            return boat;
        };

        // Spawn 5 ships at evenly distributed positions in lanes and starting X-axis offsets:
        // Ship 1: Lane 1 (Z = -4.8), Green Ferry, starts left, sailing right (dir = 1)
        const ship1 = createFerryModel('#0f5132');
        ship1.position.set(-40, 0.1, -4.8);
        this.scene.add(ship1);
        this.ships.push({
            group: ship1,
            dir: 1,
            speed: 0.015,
            z: -4.8,
            bobFreq: 1.4,
            rollFreq: 0.85,
            flashingLights: ship1.userData.flashingLights || []
        });

        // Ship 2: Lane 2 (Z = -11.1), Wooden Junk Boat, starts mid-left, sailing left (dir = -1)
        const ship2 = createJunkBoatModel();
        ship2.rotation.y = Math.PI; // Face left
        ship2.position.set(-20, 0.1, -11.1);
        this.scene.add(ship2);
        this.ships.push({
            group: ship2,
            dir: -1,
            speed: 0.012,
            z: -11.1,
            bobFreq: 1.6,
            rollFreq: 1.10,
            flashingLights: ship2.userData.flashingLights || []
        });

        // Ship 3: Lane 3 (Z = -17.3), Red Ferry, starts center, sailing right (dir = 1)
        const ship3 = createFerryModel('#8b0000');
        ship3.position.set(0, 0.1, -17.3);
        this.scene.add(ship3);
        this.ships.push({
            group: ship3,
            dir: 1,
            speed: 0.018,
            z: -17.3,
            bobFreq: 1.8,
            rollFreq: 1.05,
            flashingLights: ship3.userData.flashingLights || []
        });

        // Ship 4: Lane 4 (Z = -25.7), Large White Cruise Ship, starts mid-right, sailing left (dir = -1)
        const ship4 = createCruiseShipModel();
        ship4.scale.set(2, 2, 2);
        ship4.rotation.y = Math.PI; // Face left
        ship4.position.set(20, 0.1, -25.7);
        this.scene.add(ship4);
        this.ships.push({
            group: ship4,
            dir: -1,
            speed: 0.009, // Majestic slow cruise
            z: -25.7,
            bobFreq: 0.8, // Slower bobbing
            rollFreq: 0.40, // Minimal roll
            flashingLights: ship4.userData.flashingLights || []
        });

        // Ship 5: Lane 5 (Z = -34.2), Yellow Ferry, starts right, sailing right (dir = 1)
        const ship5 = createFerryModel('#eab308');
        ship5.position.set(40, 0.1, -34.2);
        this.scene.add(ship5);
        this.ships.push({
            group: ship5,
            dir: 1,
            speed: 0.012,
            z: -34.2,
            bobFreq: 1.2,
            rollFreq: 0.75,
            flashingLights: ship5.userData.flashingLights || []
        });

        // Background Ships: Spawn 3 customized ships in the background sea behind the beach (Z = -165 to -220)
        // 1. Small Speedboat (Zip fast, Lane 6: Z = -175)
        const bgShip1 = createSpeedboatModel();
        bgShip1.scale.set(1.2, 1.2, 1.2);
        bgShip1.position.set(-40, 0.1, -175);
        this.scene.add(bgShip1);
        this.ships.push({
            group: bgShip1,
            dir: 1,
            speed: 0.28, // Fast speedboat zip
            z: -175,
            bobFreq: 3.5, // High frequency bobbing on waves
            rollFreq: 2.2, // High frequency roll
            flashingLights: bgShip1.userData.flashingLights || []
        });

        // 2. Longboat (Sampan style, Lane 7: Z = -188)
        const bgShip2 = createLongboatModel();
        bgShip2.scale.set(0.8, 0.8, 0.8);
        bgShip2.rotation.y = Math.PI; // Face left
        bgShip2.position.set(0, 0.1, -188);
        this.scene.add(bgShip2);
        this.ships.push({
            group: bgShip2,
            dir: -1,
            speed: 0.030, // Steady speed
            z: -188,
            bobFreq: 1.8,
            rollFreq: 1.2,
            flashingLights: bgShip2.userData.flashingLights || []
        });

        // 3. Huge Container/Cargo Ship (Slow & majestic, Lane 8: Z = -208)
        const bgShip3 = createContainerShipModel();
        bgShip3.scale.set(1.6, 1.6, 1.6);
        bgShip3.position.set(40, 0.1, -208);
        this.scene.add(bgShip3);
        this.ships.push({
            group: bgShip3,
            dir: 1,
            speed: 0.005, // Heavy giant cruise
            z: -208,
            bobFreq: 0.5, // Slow heavy bobbing
            rollFreq: 0.2, // Minimal roll
            flashingLights: bgShip3.userData.flashingLights || []
        });
    }

    buildPedestrians() {
        // Spawn multiple dynamic walking 3D characters along Star Ferry Pier promenade walkway and the opposite bank (HK Island)
        const headGeo = new THREE.SphereGeometry(0.22, 12, 12);
        const torsoGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.75, 10);
        const limbGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.65, 8);

        const shirtColors = [
            '#e11d48', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
            '#06b6d4', '#f97316', '#ffffff', '#1e293b'
        ];
        const pantsColors = [
            '#334155', '#475569', '#1e293b', '#78350f'
        ];

        // Total 12 pedestrians: 8 in the foreground (TST), 4 on the opposite bank (HK Island)
        let tstRightCount = 0;
        let tstLeftCount = 0;
        let hkRightCount = 0;
        let hkLeftCount = 0;

        for (let i = 0; i < 12; i++) {
            const isOppositeBank = (i >= 8);
            const k = isOppositeBank ? (i - 8) : i; // Local index (0 to 7 for TST, 0 to 3 for HK Island)
            const pGroup = new THREE.Group();

            const shirtCol = shirtColors[Math.floor(Math.random() * shirtColors.length)];
            const pantsCol = pantsColors[Math.floor(Math.random() * pantsColors.length)];

            const torsoMat = new THREE.MeshStandardMaterial({ color: shirtCol, roughness: 0.6 });
            const skinMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.75 }); // skin tone
            const limbMat = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.7 });

            // Torso
            const torso = new THREE.Mesh(torsoGeo, torsoMat);
            torso.position.y = 0.9;
            torso.castShadow = false; // Optimized
            pGroup.add(torso);

            // Head
            const head = new THREE.Mesh(headGeo, skinMat);
            head.position.y = 1.45;
            head.castShadow = false; // Optimized
            pGroup.add(head);

            // Arms (Pivot structure)
            const armLeft = new THREE.Group();
            const armLeftMesh = new THREE.Mesh(limbGeo, torsoMat); // Shirt colored sleeve
            armLeftMesh.position.y = -0.32;
            armLeftMesh.castShadow = false; // Optimized
            armLeft.add(armLeftMesh);
            armLeft.position.set(-0.26, 1.25, 0);
            pGroup.add(armLeft);

            const armRight = new THREE.Group();
            const armRightMesh = new THREE.Mesh(limbGeo, torsoMat);
            armRightMesh.position.y = -0.32;
            armRightMesh.castShadow = false; // Optimized
            armRight.add(armRightMesh);
            armRight.position.set(0.26, 1.25, 0);
            pGroup.add(armRight);

            // Legs
            const legLeft = new THREE.Group();
            const legLeftMesh = new THREE.Mesh(limbGeo, limbMat); // Pants colored leg
            legLeftMesh.position.y = -0.32;
            legLeftMesh.castShadow = false; // Optimized
            legLeft.add(legLeftMesh);
            legLeft.position.set(-0.13, 0.55, 0);
            pGroup.add(legLeft);

            const legRight = new THREE.Group();
            const legRightMesh = new THREE.Mesh(limbGeo, limbMat);
            legRightMesh.position.y = -0.32;
            legRightMesh.castShadow = false; // Optimized
            legRight.add(legRightMesh);
            legRight.position.set(0.13, 0.55, 0);
            pGroup.add(legRight);

            // Alternate directions to balance traffic flow
            const dir = (k % 2 === 0) ? 1 : -1;

            let zLane1, zLane2, initialZ, initialY;
            if (isOppositeBank) {
                // HK Island Walkway (Z: -44 to -39, top surface Y = 0.1, Fence/Railing at Z = -39.0)
                // Distribute Z offsets evenly. The closest lane Z = -40.0 is exactly 1.0 unit (2.5+ body widths) away from the fence.
                const idx = (dir === 1) ? hkRightCount++ : hkLeftCount++;
                const hkZOffset = idx * 0.8; // yields 0.0 or 0.8
                zLane1 = -43.2 + hkZOffset;
                zLane2 = -40.8 + hkZOffset;
                initialZ = dir === 1 ? zLane1 : zLane2;
                initialY = 0.195; // Y=0.195 puts feet at Y=0.1 on the HK Island walkway
            } else {
                // TST Walkway (Z: 0 to 17, top surface Y = 0.2)
                // Distribute Z offsets evenly based on direction index (0 to 3) to keep them in separate sub-lanes
                const idx = (dir === 1) ? tstRightCount++ : tstLeftCount++;
                const zOffset = (idx / 3.0) * 3.5; // yields 0.0, 1.17, 2.33, 3.5
                zLane1 = 5.0 + zOffset;
                zLane2 = 9.5 + zOffset;
                initialZ = dir === 1 ? zLane1 : zLane2;
                initialY = 0.295; // Y=0.295 puts feet at Y=0.2 on the TST walkway
            }

            // Distribute initial X positions evenly across the walkway (X: -48 to 48)
            // Stagger starting positions slightly (nudge of ±1 unit) for natural organic variance
            const numSlots = isOppositeBank ? 4.0 : 8.0;
            const xPercent = (k + 0.5) / numSlots;
            const initialX = -48 + xPercent * 96 + (Math.random() - 0.5) * 2.0;

            pGroup.position.set(initialX, initialY, initialZ);
            this.scene.add(pGroup);

            // 3D Umbrella construct
            const umbrella = new THREE.Group();

            // Shaft
            const shaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8);
            const shaftMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.2 });
            const shaft = new THREE.Mesh(shaftGeo, shaftMat);
            shaft.position.y = 0.55;
            umbrella.add(shaft);

            // Handle crook
            const handleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8);
            const handleMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
            const handle = new THREE.Mesh(handleGeo, handleMat);
            handle.position.y = 0.05;
            umbrella.add(handle);

            // Canopy (cone shape)
            const canopyGeo = new THREE.ConeGeometry(0.65, 0.35, 10, 1, true);
            const umbrellaColors = ['#f43f5e', '#06b6d4', '#eab308', '#10b981', '#6366f1', '#ec4899', '#f97316'];
            const canopyColor = umbrellaColors[Math.floor(Math.random() * umbrellaColors.length)];
            const canopyMat = new THREE.MeshStandardMaterial({
                color: canopyColor,
                roughness: 0.3,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
            const canopy = new THREE.Mesh(canopyGeo, canopyMat);
            canopy.position.y = 0.95;
            umbrella.add(canopy);

            // Top spike
            const spikeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8);
            const spike = new THREE.Mesh(spikeGeo, shaftMat);
            spike.position.y = 1.18;
            umbrella.add(spike);

            umbrella.position.set(-0.184, 1.624, -0.526); // Position to align left hand with handle bottom and clear head
            umbrella.rotation.set(0.35, 0, -0.2); // Tilts forward to center the canopy over the head
            umbrella.visible = false;
            pGroup.add(umbrella);

            // Turnaround ranges (ensure they cover their respective walkway lengths naturally)
            const rangeX = -48 + Math.random() * 8; // turnaround left limit
            const rangeY = 48 - Math.random() * 8;  // turnaround right limit

            this.pedestrians.push({
                group: pGroup,
                armL: armLeft,
                armR: armRight,
                legL: legLeft,
                legR: legRight,
                umbrella: umbrella,
                speed: 0.022 + Math.random() * 0.015, // Keep speeds relatively close to prevent fast catchups
                dir: dir,
                gaitFreq: 7 + Math.random() * 3.5,
                rangeX: rangeX,
                rangeY: rangeY,
                zLane1: zLane1,
                zLane2: zLane2
            });
        }
    }

    buildSkyCelestialBodies() {
        // 1. Stylized Starburst Sun (angular core with 12 pointed rays, glowing lamp yellow)
        const sunGroup = new THREE.Group();
        this.sunMaterial = new THREE.MeshBasicMaterial({
            color: '#fbbf24', // Warm lamp yellow
            transparent: true,
            opacity: 1.0
        });

        // Center faceted dodecahedron core
        const coreGeo = new THREE.DodecahedronGeometry(3.2, 0);
        const sunCore = new THREE.Mesh(coreGeo, this.sunMaterial);
        sunGroup.add(sunCore);

        // 12 pointed cones as sun rays, lying perfectly flat on the outer perimeter (XY plane)
        const rayGeo = new THREE.ConeGeometry(0.8, 4.5, 4); // 4-sided angular cones
        rayGeo.translate(0, 2.25, 0); // Offset to rotate around center pivot

        const numRays = 12;
        for (let i = 0; i < numRays; i++) {
            const ray = new THREE.Mesh(rayGeo, this.sunMaterial);
            const angle = (i / numRays) * Math.PI * 2;
            ray.rotation.z = angle;
            // No X or Y rotation to ensure all rays lie flat on the perimeter
            sunGroup.add(ray);
        }

        this.sunMesh = sunGroup;
        this.scene.add(this.sunMesh);

        // 2. Moon (pale silver-grey glowing sphere)
        const moonGeo = new THREE.SphereGeometry(4.0, 16, 16);
        this.moonMaterial = new THREE.MeshBasicMaterial({
            color: '#e2e8f0',
            transparent: true,
            opacity: 1.0
        });
        this.moonMesh = new THREE.Mesh(moonGeo, this.moonMaterial);
        this.scene.add(this.moonMesh);
    }

    buildHongKongIslandSkyline() {
        // Detailed Skyline on Hong Kong Island side across Victoria Harbour (Z: -65)
        const skylineZ = -65;

        // Base dark skyscraper material with emissive maps
        this.buildingMaterial = new THREE.MeshStandardMaterial({
            color: '#070a13',
            roughness: 0.15,
            metalness: 0.95,
            emissive: new THREE.Color('#ffffff'), // White multiplier allows vibrant neon emissive colors to shine
            emissiveMap: this.buildingEmissiveTexture,
            emissiveIntensity: 0.05
        });

        this.buildingMaterials = [];
        const darkColors = ['#1e293b', '#273549', '#1a2436', '#1e293b', '#111827', '#253041'];
        const lightGreyColor = '#5b6b7c';

        // 12 Skyscrapers ordered from left to right by their X coordinates
        const buildingsList = [
            { id: 'fill-1', x: -52, w: 8, h: 28, d: 8, type: 'fill' },
            { id: 'fill-2', x: -42, w: 9, h: 36, d: 9, type: 'fill' },
            { id: 'ifc', x: -32, w: 8.5, h: 52, d: 8.5, type: 'ifc' }, // 3rd building (index 2) - Lighter grey
            { id: 'hsbc', x: -22, w: 9, h: 24, d: 6, type: 'hsbc' },
            { id: 'boc', x: -12, w: 7, h: 20, d: 7, type: 'boc' },   // 5th building (index 4) - Lighter grey
            { id: 'fill-3', x: -3, w: 8, h: 29, d: 8, type: 'fill' },
            { id: 'fill-4', x: 5, w: 7, h: 35, d: 7, type: 'fill' },
            { id: 'cp', x: 15, w: 9, h: 42, d: 9, type: 'cp' },      // 8th building (index 7) - Lighter grey
            { id: 'fill-5', x: 26, w: 9, h: 28, d: 9, type: 'fill' },
            { id: 'fill-6', x: 35, w: 7, h: 42, d: 7, type: 'fill' }, // 10th building (index 9) - Lighter grey
            { id: 'fill-7', x: 44, w: 9, h: 25, d: 9, type: 'fill' },
            { id: 'fill-8', x: 53, w: 7, h: 32, d: 7, type: 'fill' }
        ];

        buildingsList.forEach((b, index) => {
            const isLightGrey = (index === 2 || index === 4 || index === 7 || index === 9);
            const baseMat = this.buildingMaterial.clone();
            baseMat.color.set(isLightGrey ? lightGreyColor : darkColors[Math.floor(Math.random() * darkColors.length)]);
            this.buildingMaterials.push(baseMat);

            if (b.type === 'ifc') {
                const ifcGroup = new THREE.Group();
                const ifcBodyGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
                const ifcBody = new THREE.Mesh(ifcBodyGeo, baseMat);
                ifcBody.position.y = b.h / 2;
                ifcBody.castShadow = false;
                ifcGroup.add(ifcBody);

                const crownGeo = new THREE.CylinderGeometry(2, 4.2, 4.5, 8, 1, true);
                this.ifcCrownMaterial = new THREE.MeshBasicMaterial({ color: '#93c5fd' });
                const crown = new THREE.Mesh(crownGeo, this.ifcCrownMaterial);
                crown.position.y = b.h + 2.25;
                ifcGroup.add(crown);

                ifcGroup.position.set(b.x, 0, skylineZ - 4.5);
                this.scene.add(ifcGroup);
            } else if (b.type === 'boc') {
                const bocGroup = new THREE.Group();
                const bocBaseGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
                const bocBase = new THREE.Mesh(bocBaseGeo, baseMat);
                bocBase.position.y = b.h / 2;
                bocBase.castShadow = false;
                bocGroup.add(bocBase);

                const bocSegGeo = new THREE.CylinderGeometry(0.1, 4.9, 16, 4, 1, false, Math.PI / 4);
                const bocSeg = new THREE.Mesh(bocSegGeo, baseMat);
                bocSeg.position.y = b.h + 8;
                bocSeg.rotation.y = Math.PI / 4;
                bocSeg.castShadow = false;
                bocGroup.add(bocSeg);

                this.bocBracingMaterial = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
                const braceL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 17, 0.12), this.bocBracingMaterial);
                braceL.position.set(-2.2, b.h + 8, 2.45);
                braceL.rotation.z = Math.PI / 6.2;
                bocGroup.add(braceL);

                const braceR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 17, 0.12), this.bocBracingMaterial);
                braceR.position.set(2.2, b.h + 8, 2.45);
                braceR.rotation.z = -Math.PI / 6.2;
                bocGroup.add(braceR);

                const spireGeo = new THREE.CylinderGeometry(0.05, 0.05, 14, 8);
                const spire = new THREE.Mesh(spireGeo, this.bocBracingMaterial);
                spire.position.y = b.h + 22;
                bocGroup.add(spire);

                bocGroup.position.set(b.x, 0, skylineZ - 4);
                this.scene.add(bocGroup);
            } else if (b.type === 'hsbc') {
                const hsbcGroup = new THREE.Group();
                const hsbcBodyGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
                const hsbcBody = new THREE.Mesh(hsbcBodyGeo, baseMat);
                hsbcBody.position.y = b.h / 2;
                hsbcBody.castShadow = false;
                hsbcGroup.add(hsbcBody);

                this.hsbcGirderMaterial = new THREE.MeshBasicMaterial({ color: '#ef4444' });
                for (let y = 6; y <= b.h - 2; y += 8) {
                    const hBeam = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.2, 0.4, b.d + 0.2), this.hsbcGirderMaterial);
                    hBeam.position.set(0, y, 0);
                    hsbcGroup.add(hBeam);
                }
                hsbcGroup.position.set(b.x, 0, skylineZ - 2);
                this.scene.add(hsbcGroup);
            } else if (b.type === 'cp') {
                const cpGroup = new THREE.Group();
                const cpBodyGeo = new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 3);
                const cpBody = new THREE.Mesh(cpBodyGeo, baseMat);
                cpBody.position.y = b.h / 2;
                cpBody.castShadow = false;
                cpGroup.add(cpBody);

                const cpRoofGeo = new THREE.ConeGeometry(b.w / 2, 8.5, 3);
                this.cpRoofMaterial = new THREE.MeshBasicMaterial({ color: '#ec4899' });
                const cpRoof = new THREE.Mesh(cpRoofGeo, this.cpRoofMaterial);
                cpRoof.position.y = b.h + 4.25;
                cpGroup.add(cpRoof);

                cpGroup.position.set(b.x, 0, skylineZ - 2);
                this.scene.add(cpGroup);
            } else {
                const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
                const mesh = new THREE.Mesh(geo, baseMat);
                mesh.position.set(b.x, b.h / 2, skylineZ - (Math.random() * 6));
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                this.scene.add(mesh);
            }
        });

        // Concrete Walkway on HK Island shore (Depth reduced to 5.0 and shifted to avoid skyscraper overlaps)
        const islandWalkGeo = new THREE.BoxGeometry(140, 0.8, 5.0);
        const islandWalkMat = new THREE.MeshStandardMaterial({
            color: '#334155', // Concrete dark grey
            roughness: 0.8,
            metalness: 0.1
        });
        const islandWalk = new THREE.Mesh(islandWalkGeo, islandWalkMat);
        islandWalk.position.set(0, -0.3, -41.5); // Center Y = -0.3, top surface is at Y = 0.1
        islandWalk.receiveShadow = true;
        this.scene.add(islandWalk);

        // Safety Railing on HK Island shore (Z = -39.0, water edge)
        const islandRailing = new THREE.Group();
        const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8);
        const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 140, 8);
        const railMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.2 });

        const topBar = new THREE.Mesh(barGeo, railMat);
        topBar.rotation.z = Math.PI / 2;
        topBar.position.set(0, 0.7, 0); // Y = 0.7 (world Y = 0.8)
        islandRailing.add(topBar);

        const midBar = new THREE.Mesh(barGeo, railMat);
        midBar.rotation.z = Math.PI / 2;
        midBar.position.set(0, 0.35, 0); // Y = 0.35 (world Y = 0.45)
        islandRailing.add(midBar);

        for (let x = -70; x <= 70; x += 5) {
            const post = new THREE.Mesh(postGeo, railMat);
            post.position.set(x, 0.35, 0); // Y = 0.35
            islandRailing.add(post);
        }
        islandRailing.position.set(0, 0.1, -39.0); // Sitting on walkway top (Y = 0.1)
        this.scene.add(islandRailing);
    }
    buildNewElements() {
        this.buildFerrisWheel();
        this.buildQueue();
        this.buildPark();
        this.buildBusTerminus();
    }

    buildFerrisWheel() {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(-45, 0.05, -52); // Left side on land top (Y=0.05), shifted left
        wheelGroup.scale.set(2.0, 2.0, 2.0); // Scaled 2x as requested
        this.scene.add(wheelGroup);

        // 0. Base platform & Stairs
        const baseMat = new THREE.MeshStandardMaterial({ color: '#5b6a7c', roughness: 0.95, metalness: 0.0 }); // matte concrete
        const stairsMat = new THREE.MeshStandardMaterial({ color: '#7b8c9d', roughness: 0.95, metalness: 0.0 }); // matte stairs
        
        // Lower tier base (Y span: 0.0 to 0.2)
        const baseLower = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 4.5), baseMat);
        baseLower.position.y = 0.1;
        baseLower.receiveShadow = true;
        baseLower.castShadow = true;
        wheelGroup.add(baseLower);
        
        // Upper tier base (Y span: 0.2 to 0.4)
        const baseUpper = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 3.6), baseMat);
        baseUpper.position.y = 0.3;
        baseUpper.receiveShadow = true;
        baseUpper.castShadow = true;
        wheelGroup.add(baseUpper);

        // Stairs (5 stepped steps climbing from the right (+X) side, facing the ticket booth/queue)
        const stepWidth = 1.6; // along Z axis (stretching from Z = -0.8 to Z = 0.8)
        const stepDepth = 0.2; // along X axis
        const stepHeight = 0.08; // along Y axis
        
        // Step 1 (bottom-most step)
        const step1 = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, stepHeight, stepWidth), stairsMat);
        step1.position.set(2.4, 0.04, 0);
        step1.receiveShadow = true;
        wheelGroup.add(step1);
        
        // Step 2
        const step2 = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, stepHeight, stepWidth), stairsMat);
        step2.position.set(2.2, 0.12, 0);
        step2.receiveShadow = true;
        wheelGroup.add(step2);
        
        // Step 3
        const step3 = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, stepHeight, stepWidth), stairsMat);
        step3.position.set(2.0, 0.20, 0);
        step3.receiveShadow = true;
        wheelGroup.add(step3);

        // Step 4
        const step4 = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, stepHeight, stepWidth), stairsMat);
        step4.position.set(1.8, 0.28, 0);
        step4.receiveShadow = true;
        wheelGroup.add(step4);

        // Step 5 (top-most step)
        const step5 = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, stepHeight, stepWidth), stairsMat);
        step5.position.set(1.6, 0.36, 0);
        step5.receiveShadow = true;
        wheelGroup.add(step5);

        const supportMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 }); // White
        const accentMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3 }); // Red
        const structureMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.5, roughness: 0.3 }); // Silver

        // 1. Support legs (A-frame structure on left and right sides)
        const legGeo = new THREE.CylinderGeometry(0.08, 0.12, 8.2, 8);

        // Left supports
        const legL1 = new THREE.Mesh(legGeo, supportMat);
        legL1.position.set(-1.0, 4.0, -1.8);
        legL1.rotation.set(0.22, 0, 0.12);
        wheelGroup.add(legL1);

        const legL2 = new THREE.Mesh(legGeo, supportMat);
        legL2.position.set(-1.0, 4.0, 1.8);
        legL2.rotation.set(-0.22, 0, 0.12);
        wheelGroup.add(legL2);

        // Right supports
        const legR1 = new THREE.Mesh(legGeo, supportMat);
        legR1.position.set(1.0, 4.0, -1.8);
        legR1.rotation.set(0.22, 0, -0.12);
        wheelGroup.add(legR1);

        const legR2 = new THREE.Mesh(legGeo, supportMat);
        legR2.position.set(1.0, 4.0, 1.8);
        legR2.rotation.set(-0.22, 0, -0.12);
        wheelGroup.add(legR2);

        // Horizontal Axle
        const axleGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.4, 12);
        axleGeo.rotateX(Math.PI / 2);
        const axle = new THREE.Mesh(axleGeo, structureMat);
        axle.position.set(0, 7.8, 0);
        wheelGroup.add(axle);

        // Axle end caps (Red accents)
        const capGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12);
        capGeo.rotateX(Math.PI / 2);
        const capL = new THREE.Mesh(capGeo, accentMat);
        capL.position.set(0, 7.8, -1.25);
        const capR = new THREE.Mesh(capGeo, accentMat);
        capR.position.set(0, 7.8, 1.25);
        wheelGroup.add(capL, capR);

        // 2. Rotating Wheel Rim Group
        this.ferrisWheelRim = new THREE.Group();
        this.ferrisWheelRim.position.set(0, 7.8, 0);
        wheelGroup.add(this.ferrisWheelRim);

        // Hub in the center
        const hubGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.8, 12);
        hubGeo.rotateX(Math.PI / 2);
        const hub = new THREE.Mesh(hubGeo, accentMat);
        this.ferrisWheelRim.add(hub);

        // Double rings (Outer rims)
        const outerRadius = 5.2;
        const ringGeo = new THREE.TorusGeometry(outerRadius, 0.08, 8, 36);

        const ring1 = new THREE.Mesh(ringGeo, supportMat);
        ring1.position.z = -0.5;
        this.ferrisWheelRim.add(ring1);

        const ring2 = new THREE.Mesh(ringGeo, supportMat);
        ring2.position.z = 0.5;
        this.ferrisWheelRim.add(ring2);

        // Crossbars connecting the two rings
        const crossGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6);
        crossGeo.rotateX(Math.PI / 2);

        // Spokes and cabins
        const numSpokes = 8;
        const spokeGeo = new THREE.CylinderGeometry(0.04, 0.04, outerRadius, 8);
        spokeGeo.translate(0, outerRadius / 2, 0);

        const cabinBoxGeo = new THREE.BoxGeometry(0.9, 0.7, 0.8);
        const cabinRoofGeo = new THREE.ConeGeometry(0.75, 0.4, 4);
        cabinRoofGeo.rotateY(Math.PI / 4);

        for (let i = 0; i < numSpokes; i++) {
            const angle = (i / numSpokes) * Math.PI * 2;

            // Spoke structure (Double spokes for depth)
            const spoke1 = new THREE.Mesh(spokeGeo, structureMat);
            spoke1.position.z = -0.4;
            spoke1.rotation.z = angle;
            this.ferrisWheelRim.add(spoke1);

            const spoke2 = new THREE.Mesh(spokeGeo, structureMat);
            spoke2.position.z = 0.4;
            spoke2.rotation.z = angle;
            this.ferrisWheelRim.add(spoke2);

            // Cross connection bars on the rim
            const crossX = Math.cos(angle) * outerRadius;
            const crossY = Math.sin(angle) * outerRadius;
            const crossBar = new THREE.Mesh(crossGeo, structureMat);
            crossBar.position.set(crossX, crossY, 0);
            this.ferrisWheelRim.add(crossBar);

            // Flashing light on the rim crossbars
            const lightGeo = new THREE.SphereGeometry(0.12, 8, 8);
            const lightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(crossX, crossY, 0.55); // front-facing light
            this.ferrisWheelRim.add(light);
            this.ferrisWheelLights.push(light);

            // Cabin Group (attached to outer rim on a pivot rod)
            const cabinGroup = new THREE.Group();
            cabinGroup.position.set(crossX, crossY, 0);
            this.ferrisWheelRim.add(cabinGroup);
            this.ferrisCabins.push(cabinGroup);

            // Support rod holding the cabin
            const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
            const rod = new THREE.Mesh(rodGeo, structureMat);
            rod.position.y = -0.25;
            cabinGroup.add(rod);

            // Cabin body (alternate red and white)
            const isRed = (i % 2 === 0);
            const bodyMat = isRed ? accentMat : supportMat;
            const cabinBody = new THREE.Mesh(cabinBoxGeo, bodyMat);
            cabinBody.position.y = -0.7;
            cabinGroup.add(cabinBody);

            // Cabin roof (accent colors)
            const roofMat = isRed ? supportMat : accentMat;
            const cabinRoof = new THREE.Mesh(cabinRoofGeo, roofMat);
            cabinRoof.position.y = -0.3;
            cabinGroup.add(cabinRoof);

            // Cabin windows
            const winMat = new THREE.MeshBasicMaterial({ color: '#1e293b' });
            const winGeo = new THREE.BoxGeometry(0.6, 0.25, 0.82);
            const windowMesh = new THREE.Mesh(winGeo, winMat);
            windowMesh.position.set(0, -0.65, 0);
            cabinGroup.add(windowMesh);
        }
    }

    buildQueue() {
        const queueGroup = new THREE.Group();
        queueGroup.position.set(-32, 0.05, -50); // Next to Ferris Wheel, shifted closer
        this.scene.add(queueGroup);

        const boothMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 });
        const roofMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3 });
        const counterMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 }); // wood counter

        // 1. Ticket Booth
        const boothBodyGeo = new THREE.BoxGeometry(1.6, 1.8, 1.4);
        const boothBody = new THREE.Mesh(boothBodyGeo, boothMat);
        boothBody.position.y = 0.9;
        boothBody.castShadow = true;
        queueGroup.add(boothBody);

        // Booth sloped roof
        const boothRoofGeo = new THREE.ConeGeometry(1.3, 0.6, 4);
        boothRoofGeo.rotateY(Math.PI / 4);
        const boothRoof = new THREE.Mesh(boothRoofGeo, roofMat);
        boothRoof.position.y = 2.1;
        boothRoof.castShadow = true;
        queueGroup.add(boothRoof);

        // Counter shelf
        const shelfGeo = new THREE.BoxGeometry(0.3, 0.08, 1.0);
        const shelf = new THREE.Mesh(shelfGeo, counterMat);
        shelf.position.set(0.85, 0.9, 0);
        queueGroup.add(shelf);

        // Window cutout (represented by a dark panel)
        const windowGeo = new THREE.BoxGeometry(0.02, 0.6, 0.8);
        const windowMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.position.set(0.81, 1.25, 0);
        queueGroup.add(win);

        // 2. Winding Queue poles & ropes (打蛇餅護欄)
        const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8);
        const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8);
        ropeGeo.rotateZ(Math.PI / 2);

        const metalMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.8, roughness: 0.2 });
        const ropeMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.6 });

        // Place rows of poles to define winding lanes
        // Row 1 barrier: Z = -49.5, X from 1.0 to 9.0
        for (let px = 1.0; px <= 9.0; px += 1.5) {
            const post = new THREE.Mesh(poleGeo, metalMat);
            post.position.set(px, 0.425, 0.5); // Z = 0.5 (global Z = -49.5)
            post.castShadow = true;
            queueGroup.add(post);
        }
        // Row 2 barrier: Z = -52.2, X from 1.0 to 9.0
        for (let px = 1.0; px <= 9.0; px += 1.5) {
            const post = new THREE.Mesh(poleGeo, metalMat);
            post.position.set(px, 0.425, -2.2); // Z = -2.2 (global Z = -52.2)
            post.castShadow = true;
            queueGroup.add(post);
        }

        // 3. Queueing People (20 static figures winding in line, scaled at 0.75)
        const headGeo = new THREE.SphereGeometry(0.18, 10, 10);
        const torsoGeo = new THREE.CylinderGeometry(0.14, 0.11, 0.6, 8);
        const legGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.5, 8);

        const shirtColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
        const pantsColors = ['#1e293b', '#334155', '#475569', '#78350f'];

        // Winding coordinates path for 20 people
        const peopleX = [];
        const peopleZ = [];
        const peopleRotY = [];

        // Row 1: 7 people going left (Z = 2.0, global Z = -48), X from 2.0 to 8.6
        for (let i = 0; i < 7; i++) {
            peopleX.push(2.0 + i * 1.1);
            peopleZ.push(2.0);
            peopleRotY.push(-Math.PI / 2); // face left towards booth
        }
        // Turn 1: 3 people turning around (X = 9.7)
        peopleX.push(9.7); peopleZ.push(1.3); peopleRotY.push(Math.PI);
        peopleX.push(9.7); peopleZ.push(0.0); peopleRotY.push(Math.PI / 2); // face right
        peopleX.push(9.7); peopleZ.push(-1.3); peopleRotY.push(0);

        // Row 2: 5 people going right (Z = -1.0, global Z = -51), X from 8.6 down to 4.2
        for (let i = 0; i < 5; i++) {
            peopleX.push(8.6 - i * 1.1);
            peopleZ.push(-1.0);
            peopleRotY.push(Math.PI / 2); // face right
        }
        // Turn 2: 2 people turning around (X = 3.0)
        peopleX.push(3.0); peopleZ.push(-2.0); peopleRotY.push(0);
        peopleX.push(3.0); peopleZ.push(-3.0); peopleRotY.push(-Math.PI / 2);

        // Row 3: 3 people going left (Z = -3.5, global Z = -53.5), X from 4.2 to 6.4
        for (let i = 0; i < 3; i++) {
            peopleX.push(4.2 + i * 1.1);
            peopleZ.push(-3.5);
            peopleRotY.push(-Math.PI / 2);
        }

        // Spawn the 20 people
        this.queuePeople = [];
        for (let idx = 0; idx < 20; idx++) {
            const person = new THREE.Group();
            person.position.set(peopleX[idx], 0.0, peopleZ[idx]);
            person.rotation.y = peopleRotY[idx];

            const shirtColor = shirtColors[idx % shirtColors.length];
            const pantsColor = pantsColors[idx % pantsColors.length];

            const skinMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.75 });
            const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 });
            const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });

            // Torso
            const torso = new THREE.Mesh(torsoGeo, shirtMat);
            torso.position.y = 0.75;
            person.add(torso);

            // Head
            const head = new THREE.Mesh(headGeo, skinMat);
            head.position.y = 1.2;
            person.add(head);

            // Legs
            const legL = new THREE.Mesh(legGeo, pantsMat);
            legL.position.set(-0.09, 0.25, 0);
            const legR = new THREE.Mesh(legGeo, pantsMat);
            legR.position.set(0.09, 0.25, 0);
            person.add(legL, legR);

            // Arms (hanging down naturally)
            const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
            const armL = new THREE.Mesh(armGeo, shirtMat);
            armL.position.set(-0.2, 0.8, 0);
            const armR = new THREE.Mesh(armGeo, shirtMat);
            armR.position.set(0.2, 0.8, 0);
            person.add(armL, armR);

            queueGroup.add(person);

            // Save details for swaying animation
            this.queuePeople.push({
                group: person,
                swaySpeed: 1.2 + (idx % 3) * 0.4,
                swayAmount: (0.03 + (idx % 2) * 0.02) * 4.0, // Multiplied by 4x for visible sway
                swayOffset: idx * 0.5
            });
        }
    }

    createDogModel(dogColor, hasOwner = false, ownerShirtColor = '#ef4444') {
        const dogGroup = new THREE.Group();

        const dogMat = new THREE.MeshStandardMaterial({ color: dogColor, roughness: 0.85 });
        const blackMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });

        // A. The Dog structure (centered at local 0,0,0)
        const dogParts = new THREE.Group();
        dogGroup.add(dogParts);

        // Dog Body
        const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.24), dogMat);
        dogBody.position.y = 0.22;
        dogBody.castShadow = true;
        dogParts.add(dogBody);

        // Dog Head
        const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.26), dogMat);
        dogHead.position.set(0.26, 0.44, 0);
        dogParts.add(dogHead);

        // Snout
        const dogSnout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), dogMat);
        dogSnout.position.set(0.44, 0.42, 0);
        dogParts.add(dogSnout);

        // Nose (black sphere)
        const dogNose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), blackMat);
        dogNose.position.set(0.51, 0.44, 0);
        dogParts.add(dogNose);

        // Floppy ears
        const dogDarkColor = dogColor === '#ffffff' ? '#cbd5e1' : (dogColor === '#090d16' ? '#334155' : '#7c2d12');
        const earMat = new THREE.MeshStandardMaterial({ color: dogDarkColor, roughness: 0.85 });
        const earL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), earMat);
        earL.position.set(0.2, 0.38, 0.14);
        const earR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), earMat);
        earR.position.set(0.2, 0.38, -0.14);
        dogParts.add(earL, earR);

        // Tail
        const tailGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 6);
        tailGeo.translate(0, 0.125, 0);
        const dogTail = new THREE.Mesh(tailGeo, dogMat);
        dogTail.position.set(-0.25, 0.32, 0);
        dogTail.rotation.z = Math.PI / 4; // tilt back-up (pointing away from dog)
        dogParts.add(dogTail);

        // Legs (LF, RF, LB, RB)
        const dogLegGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6);
        dogLegGeo.translate(0, -0.1, 0);

        const legLF = new THREE.Mesh(dogLegGeo, dogMat);
        legLF.position.set(0.18, 0.2, 0.09);
        const legRF = new THREE.Mesh(dogLegGeo, dogMat);
        legRF.position.set(0.18, 0.2, -0.09);
        const legLB = new THREE.Mesh(dogLegGeo, dogMat);
        legLB.position.set(-0.18, 0.2, 0.09);
        const legRB = new THREE.Mesh(dogLegGeo, dogMat);
        legRB.position.set(-0.18, 0.2, -0.09);

        dogParts.add(legLF, legRF, legLB, legRB);
        const legs = [legLF, legRF, legLB, legRB];

        // B. The Owner (optional, placed at local X = -1.8)
        if (hasOwner) {
            const ownerGroup = new THREE.Group();
            ownerGroup.position.set(-1.8, 0, 0);
            dogGroup.add(ownerGroup);

            const skinMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.75 });
            const shirtMat = new THREE.MeshStandardMaterial({ color: ownerShirtColor, roughness: 0.6 });
            const pantsMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 });

            // Torso
            const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.75, 10), shirtMat);
            torso.position.y = 0.9;
            ownerGroup.add(torso);

            // Head
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skinMat);
            head.position.y = 1.45;
            ownerGroup.add(head);

            // Legs (separated along Z-axis for forward-facing walk)
            const ownerLegGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.65, 8);
            ownerLegGeo.translate(0, -0.325, 0);
            const legL = new THREE.Mesh(ownerLegGeo, pantsMat);
            legL.position.set(0, 0.55, 0.13);
            const legR = new THREE.Mesh(ownerLegGeo, pantsMat);
            legR.position.set(0, 0.55, -0.13);
            ownerGroup.add(legL, legR);

            // Arms (one holding leash, one swinging; pivoted at shoulder)
            const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.65, 8);
            armGeo.translate(0, -0.325, 0); // pivot at shoulder
            
            const armL = new THREE.Mesh(armGeo, shirtMat);
            armL.position.set(0, 1.2, 0.24); // free arm on left (+Z)
            ownerGroup.add(armL);

            // Right arm holding leash pointing forward towards the dog
            const armR = new THREE.Mesh(armGeo, shirtMat);
            armR.position.set(0, 1.2, -0.24); // leash arm on right (-Z)
            armR.rotation.z = 1.1; // tilt forward (approx 63 degrees)
            ownerGroup.add(armR);

            // Leash cylinder (connecting owner hand to dog neck)
            const handPos = new THREE.Vector3(-1.22, 0.91, -0.24); // local to dogGroup (owner X is -1.8, hand is at local +0.58, +0.91, -0.24)
            const neckPos = new THREE.Vector3(0.25, 0.35, 0.0); // local to dogGroup
            
            const leashDistance = handPos.distanceTo(neckPos);
            const leashGeo = new THREE.CylinderGeometry(0.015, 0.015, leashDistance, 6);
            leashGeo.translate(0, leashDistance / 2, 0);
            
            const leashMat = new THREE.MeshStandardMaterial({ color: '#ff0000', roughness: 0.6 }); // red leash
            const leash = new THREE.Mesh(leashGeo, leashMat);
            leash.position.copy(handPos);
            
            // Orient leash
            const direction = new THREE.Vector3().subVectors(neckPos, handPos);
            const alignAxis = new THREE.Vector3(0, 1, 0);
            leash.quaternion.setFromUnitVectors(alignAxis, direction.clone().normalize());
            
            dogGroup.add(leash);

            // Store references in ownerGroup for owner walking animation
            ownerGroup.userData = { legL, legR, armL };
        }

        return {
            group: dogGroup,
            legs,
            tail: dogTail,
            hasOwner
        };
    }

    buildPark() {
        this.seatedPeople = [];
        const parkGroup = new THREE.Group();
        parkGroup.position.set(2.5, 0.05, -51);
        this.scene.add(parkGroup);

        // 1. Lawn Base
        const lawnWidth = 26;
        const lawnDepth = 8;
        const lawnGeo = new THREE.BoxGeometry(lawnWidth, 0.08, lawnDepth);
        const lawnMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.95 }); // Rich park green
        const lawn = new THREE.Mesh(lawnGeo, lawnMat);
        lawn.position.y = 0.04;
        lawn.receiveShadow = true;
        parkGroup.add(lawn);

        // 2. White Perimeter fence (picket style) along front, left, and right sides
        const fenceMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 });
        const postGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08);
        const railGeo = new THREE.BoxGeometry(lawnWidth, 0.04, 0.04);

        // Front fence rails
        const railFront1 = new THREE.Mesh(railGeo, fenceMat);
        railFront1.position.set(0, 0.45, lawnDepth / 2);
        const railFront2 = new THREE.Mesh(railGeo, fenceMat);
        railFront2.position.set(0, 0.2, lawnDepth / 2);
        parkGroup.add(railFront1, railFront2);

        // Front fence vertical posts (spaced every 1.3 units)
        for (let x = -lawnWidth / 2; x <= lawnWidth / 2; x += 1.3) {
            // Leave a small gap in the middle for a park gate/entrance
            if (Math.abs(x) < 1.0) continue;
            const post = new THREE.Mesh(postGeo, fenceMat);
            post.position.set(x, 0.3, lawnDepth / 2);
            post.castShadow = true;
            parkGroup.add(post);
        }

        // Left and Right fences
        const sideRailGeo = new THREE.BoxGeometry(lawnDepth, 0.04, 0.04);
        sideRailGeo.rotateY(Math.PI / 2);

        // Left fence
        const railLeft1 = new THREE.Mesh(sideRailGeo, fenceMat);
        railLeft1.position.set(-lawnWidth / 2, 0.45, 0);
        const railLeft2 = new THREE.Mesh(sideRailGeo, fenceMat);
        railLeft2.position.set(-lawnWidth / 2, 0.2, 0);
        parkGroup.add(railLeft1, railLeft2);

        // Right fence
        const railRight1 = new THREE.Mesh(sideRailGeo, fenceMat);
        railRight1.position.set(lawnWidth / 2, 0.45, 0);
        const railRight2 = new THREE.Mesh(sideRailGeo, fenceMat);
        railRight2.position.set(lawnWidth / 2, 0.2, 0);
        parkGroup.add(railRight1, railRight2);

        // Side posts
        for (let z = -lawnDepth / 2; z <= lawnDepth / 2; z += 1.3) {
            const postL = new THREE.Mesh(postGeo, fenceMat);
            postL.position.set(-lawnWidth / 2, 0.3, z);
            postL.castShadow = true;
            const postR = new THREE.Mesh(postGeo, fenceMat);
            postR.position.set(lawnWidth / 2, 0.3, z);
            postR.castShadow = true;
            parkGroup.add(postL, postR);
        }

        // 3. Park details: TWO park benches (one more added)
        const woodMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.7 });
        const ironMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7 });

        // Helper to build a bench
        const buildBench = (bx) => {
            const benchGroup = new THREE.Group();
            benchGroup.position.set(bx, 0.08, -1.5);
            
            const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.6), woodMat);
            seat.position.y = 0.3;
            const backrest = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.06), woodMat);
            backrest.position.set(0, 0.6, -0.3);
            
            const legB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.6), ironMat);
            legB.position.set(-0.9, 0.15, 0);
            const legB2 = legB.clone();
            legB2.position.x = 0.9;

            benchGroup.add(seat, backrest, legB, legB2);
            parkGroup.add(benchGroup);
        };

        // Bench 1 (Left side, empty)
        buildBench(-6);
        // Bench 2 (Right side, with 2 people sitting on it)
        buildBench(6);

        // Seated people helper on Bench 2
        const buildSittingPerson = (px, pz, shirtColor, pantsColor, rotY, isPerson1) => {
            const person = new THREE.Group();
            person.position.set(px, 0.08 + 0.38, pz); // 0.08 lawn, 0.38 seat
            person.rotation.y = rotY; // face slightly towards each other

            const skinMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.75 });
            const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 });
            const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });

            // Torso (leaning back slightly)
            const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.7, 8), shirtMat);
            torso.position.set(0, 0.35, -0.05);
            torso.rotation.x = -0.1;
            person.add(torso);

            // Head
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), skinMat);
            head.position.set(0, 0.75, -0.09);
            person.add(head);

            // Thighs (extending forward along Z)
            const thighGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.45, 8);
            thighGeo.rotateX(Math.PI / 2);
            const thighL = new THREE.Mesh(thighGeo, pantsMat);
            thighL.position.set(-0.11, 0.05, 0.2);
            const thighR = new THREE.Mesh(thighGeo, pantsMat);
            thighR.position.set(0.11, 0.05, 0.2);
            person.add(thighL, thighR);

            // Calves (extending downward along Y)
            const calfGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.38, 8);
            calfGeo.translate(0, -0.19, 0);
            const calfL = new THREE.Mesh(calfGeo, pantsMat);
            calfL.position.set(-0.11, 0.05, 0.4);
            const calfR = new THREE.Mesh(calfGeo, pantsMat);
            calfR.position.set(0.11, 0.05, 0.4);
            person.add(calfL, calfR);

            // Arms (resting on lap, pivoted at shoulder, pointing forward)
            const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
            armGeo.translate(0, -0.25, 0); // pivot at shoulder
            const armL = new THREE.Mesh(armGeo, shirtMat);
            armL.position.set(-0.22, 0.6, -0.05);
            armL.rotation.x = -Math.PI / 2.5; // Point forward-down onto knees
            const armR = new THREE.Mesh(armGeo, shirtMat);
            armR.position.set(0.22, 0.6, -0.05);
            armR.rotation.x = -Math.PI / 2.5; // Point forward-down onto knees
            person.add(armL, armR);

            parkGroup.add(person);

            // Save details for hand gesturing animation
            this.seatedPeople.push({
                group: person,
                armL,
                armR,
                isPerson1
            });
        };

        buildSittingPerson(5.6, -1.4, '#ec4899', '#334155', 0.25, true); // Person 1 (pink shirt)
        buildSittingPerson(6.4, -1.4, '#06b6d4', '#1e293b', -0.25, false); // Person 2 (cyan shirt)

        // Bushes
        const bushGeo = new THREE.DodecahedronGeometry(0.7, 1);
        const bushMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.9 });
        const bush1 = new THREE.Mesh(bushGeo, bushMat);
        bush1.position.set(11, 0.45, -2);
        const bush2 = new THREE.Mesh(bushGeo, bushMat);
        bush2.position.set(-11, 0.45, -2);
        parkGroup.add(bush1, bush2);

        // 4. Three little dogs (Dog 1: golden brown, free. Dog 2: black, leashed. Dog 3: white, leashed)
        // Dog 1: original, free-walking (Z = 2.4, completely in front of the benches and bushes)
        const dog1Obj = this.createDogModel('#d97706', false);
        dog1Obj.group.position.set(3, 0.08, 2.4); // Z = 2.4 (global Z = -48.6)
        parkGroup.add(dog1Obj.group);
        this.parkDogs.push({
            group: dog1Obj.group,
            legs: dog1Obj.legs,
            tail: dog1Obj.tail,
            hasOwner: false,
            x: 3,
            dir: 1,
            speed: 0.02,
            z: 2.4,
            rangeMin: -11.0,
            rangeMax: 11.0
        });

        // Dog 2: black, leashed with owner (blue shirt) (Z = 1.0, in front of the benches)
        const dog2Obj = this.createDogModel('#090d16', true, '#3b82f6');
        dog2Obj.group.position.set(-2, 0.08, 1.0); // Z = 1.0 (global Z = -50.0)
        parkGroup.add(dog2Obj.group);
        this.parkDogs.push({
            group: dog2Obj.group,
            legs: dog2Obj.legs,
            tail: dog2Obj.tail,
            hasOwner: true,
            x: -2,
            dir: 1,
            speed: 0.015,
            z: 1.0,
            rangeMin: -9.0, // adjusted to keep leashed owner inside fences/clear of benches
            rangeMax: 10.5
        });

        // Dog 3: white, leashed with owner (purple shirt) (Z = -0.2, in front of the benches)
        const dog3Obj = this.createDogModel('#ffffff', true, '#8b5cf6');
        dog3Obj.group.position.set(1, 0.08, -0.2); // Z = -0.2 (global Z = -51.7)
        parkGroup.add(dog3Obj.group);
        this.parkDogs.push({
            group: dog3Obj.group,
            legs: dog3Obj.legs,
            tail: dog3Obj.tail,
            hasOwner: true,
            x: 1,
            dir: -1, // starts moving left
            speed: 0.025,
            z: -0.2,
            rangeMin: -9.0,
            rangeMax: 10.5
        });
    }

    createDoubleDeckerBus() {
        const bus = new THREE.Group();
        
        // NWFB colors:
        const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.1 });
        const orangeMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.4 }); // Orange
        const greenMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.4 }); // Green
        
        const busW = 5.2;
        const busH = 2.5;
        const busD = 1.45;

        // Orange bottom skirt (車底改為橙色)
        const skirtH = 0.4;
        const lowerWhiteH = busH * 0.45 - skirtH; // 1.125 - 0.4 = 0.725
        
        const skirtGeo = new THREE.BoxGeometry(busW, skirtH, busD);
        const skirt = new THREE.Mesh(skirtGeo, orangeMat);
        skirt.position.y = skirtH / 2 + 0.32;
        skirt.castShadow = true;
        bus.add(skirt);
        
        // Lower White part
        const lowerWhiteGeo = new THREE.BoxGeometry(busW, lowerWhiteH, busD);
        const lowerWhite = new THREE.Mesh(lowerWhiteGeo, whiteMat);
        lowerWhite.position.y = skirtH + lowerWhiteH / 2 + 0.32;
        lowerWhite.castShadow = true;
        bus.add(lowerWhite);

        // Bus Upper Body - White
        const bodyUpperGeo = new THREE.BoxGeometry(busW * 0.98, busH * 0.5, busD * 0.98);
        const bodyUpper = new THREE.Mesh(bodyUpperGeo, whiteMat);
        bodyUpper.position.y = busH * 0.45 + (busH * 0.5) / 2 + 0.32;
        bodyUpper.castShadow = true;
        bus.add(bodyUpper);

        // Green roof panel (車頂改為綠色)
        const roofGeo = new THREE.BoxGeometry(busW * 0.96, 0.08, busD * 0.96);
        const roof = new THREE.Mesh(roofGeo, greenMat);
        roof.position.y = busH + 0.32 + 0.04;
        roof.castShadow = true;
        bus.add(roof);

        // Green Wave/Stripe on both sides of the lower body
        const stripeLGeo = new THREE.BoxGeometry(busW * 0.8, 0.12, 0.02);
        const stripeL = new THREE.Mesh(stripeLGeo, greenMat);
        stripeL.position.set(0, skirtH + 0.32 + 0.15, busD * 0.502);
        stripeL.rotation.z = -0.05;
        bus.add(stripeL);

        const stripeR = new THREE.Mesh(stripeLGeo, greenMat);
        stripeR.position.set(0, skirtH + 0.32 + 0.15, -busD * 0.502);
        stripeR.rotation.z = 0.05;
        bus.add(stripeR);

        // Orange Wave/Stripe on the upper body
        const stripeUpperLGeo = new THREE.BoxGeometry(busW * 0.6, 0.10, 0.02);
        const stripeUpperL = new THREE.Mesh(stripeUpperLGeo, orangeMat);
        stripeUpperL.position.set(0.5, busH * 0.7 + 0.32, busD * 0.502);
        stripeUpperL.rotation.z = 0.04;
        bus.add(stripeUpperL);

        const stripeUpperR = new THREE.Mesh(stripeUpperLGeo, orangeMat);
        stripeUpperR.position.set(0.5, busH * 0.7 + 0.32, -busD * 0.502);
        stripeUpperR.rotation.z = -0.04;
        bus.add(stripeUpperR);

        // Windows
        const winMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9, roughness: 0.1 });
        
        const lowerWinL = new THREE.Mesh(new THREE.BoxGeometry(busW * 0.85, busH * 0.18, 0.02), winMat);
        lowerWinL.position.set(0, busH * 0.25 + 0.32, busD * 0.505);
        const lowerWinR = lowerWinL.clone();
        lowerWinR.position.z = -busD * 0.505;
        bus.add(lowerWinL, lowerWinR);

        const upperWinL = new THREE.Mesh(new THREE.BoxGeometry(busW * 0.9, busH * 0.2, 0.02), winMat);
        upperWinL.position.set(0, busH * 0.7 + 0.32, busD * 0.505);
        const upperWinR = upperWinL.clone();
        upperWinR.position.z = -busD * 0.505;
        bus.add(upperWinL, upperWinR);

        const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.02, busH * 0.72, busD * 0.9), winMat);
        windshield.position.set(busW * 0.495, busH * 0.48 + 0.32, 0);
        bus.add(windshield);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.95 });
        const wheels = [];

        const wheelOffsets = [
            { x: -busW * 0.28, z: -busD * 0.48 },
            { x: -busW * 0.28, z: busD * 0.48 },
            { x: busW * 0.28, z: -busD * 0.48 },
            { x: busW * 0.28, z: busD * 0.48 }
        ];

        wheelOffsets.forEach(offset => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.rotation.x = Math.PI / 2;
            w.position.set(offset.x, 0.32, offset.z);
            w.castShadow = true;
            bus.add(w);
            wheels.push(w);
        });

        // Headlights / Taillights
        const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const headL = new THREE.Mesh(headGeo, this.carHeadlightMaterials[0]);
        headL.position.set(busW * 0.5, busH * 0.25 + 0.32, -busD * 0.35);
        const headR = new THREE.Mesh(headGeo, this.carHeadlightMaterials[0]);
        headR.position.set(busW * 0.5, busH * 0.25 + 0.32, busD * 0.35);

        const tailGeo = new THREE.BoxGeometry(0.04, 0.12, 0.24);
        const tailL = new THREE.Mesh(tailGeo, this.carTaillightMaterials[0]);
        tailL.position.set(-busW * 0.5, busH * 0.25 + 0.32, -busD * 0.35);
        const tailR = new THREE.Mesh(tailGeo, this.carTaillightMaterials[0]);
        tailR.position.set(-busW * 0.5, busH * 0.25 + 0.32, busD * 0.35);

        bus.add(headL, headR, tailL, tailR);

        return { group: bus, wheels };
    }

    buildBusTerminus() {
        const termGroup = new THREE.Group();
        termGroup.position.set(44, 0.05, -51.5); // Shifted right from 38 to 44
        this.scene.add(termGroup);

        const platMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.85 }); // Dark concrete platform
        const structureMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.4, roughness: 0.3 }); // steel columns
        const signRedMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 }); // red bus sign
        const signYellowMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.4 }); // yellow bus sign

        // 1. Concrete platform (Bus bay) - Extended to 32 to accommodate all buses
        const platWidth = 32;
        const platDepth = 11;
        const platform = new THREE.Mesh(new THREE.BoxGeometry(platWidth, 0.15, platDepth), platMat);
        platform.position.y = 0.075;
        platform.receiveShadow = true;
        termGroup.add(platform);

        // No canopy roof or columns ("無需上蓋").

        // 2. Bus terminus pole signs for Lane 1 and Lane 2
        const drawStopSign = (x, z, colorMat) => {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), structureMat);
            pole.position.set(x, 1.1 + 0.15, z);
            termGroup.add(pole);

            const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), colorMat);
            signBoard.position.set(x, 2.1 + 0.15, z);
            termGroup.add(signBoard);

            const signIcon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
            signIcon.position.set(x, 2.1 + 0.15, z + 0.05);
            termGroup.add(signIcon);
        };

        // Lane 1 signs (Z = 2.5 relative to platform center, i.e., global Z = -49)
        drawStopSign(13.5, 2.5, signRedMat);  // front sign

        // Lane 2 signs (Z = -2.5 relative to platform center, i.e., global Z = -54)
        drawStopSign(13.5, -2.5, signYellowMat);  // front sign

        // 3. Double-decker buses styled with NWFB livery (8 static buses in 2 rows of 4)
        // Positioned locally on the platform to automatically shift with termGroup
        const localXPositions = [-9.0, -3.0, 3.0, 9.0];
        localXPositions.forEach(x => {
            // Lane 1 buses (local Z = 2.5)
            const bus1 = this.createDoubleDeckerBus().group;
            bus1.position.set(x, 0.15, 2.5);
            termGroup.add(bus1);

            // Lane 2 buses (local Z = -2.5)
            const bus2 = this.createDoubleDeckerBus().group;
            bus2.position.set(x, 0.15, -2.5);
            termGroup.add(bus2);
        });
    }

    buildGround() {
        const groundGeo = new THREE.PlaneGeometry(500, 500);
        const groundMat = new THREE.MeshStandardMaterial({
            color: '#15803d', // Lawn green
            roughness: 0.9,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -1.5, 0); // Positioned under roads and walkways
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    buildMountains() {
        const mountainGroup = new THREE.Group();
        const darkGreenMat = new THREE.MeshStandardMaterial({
            color: '#166534', // Forest lush green (brighter than #14532d)
            roughness: 0.85,  // slightly smoother to catch lighting highlights
            metalness: 0.05
        });
        const midGreenMat = new THREE.MeshStandardMaterial({
            color: '#15803d', // Brighter forest green (brighter than #165331)
            roughness: 0.85,
            metalness: 0.05
        });

        // 5 peak layout placed behind the background road (Z < -75)
        // Using SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2) as base (flat-bottomed dome)
        // Flat bottoms are placed at Y = -0.35 (embedded inside islandLand) to prevent underneath models
        // Heights (y + ry) reach up to 72 and 75, which exceed the tallest skyscraper (IFC, 52)
        // Thickness (rz) is 4-6 to act like a thin wall, avoiding overlap with car lanes (Z >= -74.5)
        const peaks = [
            { x: -44, y: -0.35, z: -106, rx: 22, ry: 58.35, rz: 5, mat: darkGreenMat },
            { x: -20, y: -0.35, z: -108, rx: 28, ry: 72.35, rz: 6, mat: midGreenMat },
            { x: 4, y: -0.35, z: -105, rx: 25, ry: 65.35, rz: 5, mat: darkGreenMat },
            { x: 27, y: -0.35, z: -107, rx: 27, ry: 75.35, rz: 6, mat: midGreenMat },
            { x: 50, y: -0.35, z: -106, rx: 19, ry: 54.35, rz: 4, mat: darkGreenMat }
        ];

        peaks.forEach(p => {
            // SphereGeometry with thetaLength = Math.PI / 2 creates a hemisphere (dome) with a flat bottom
            const sphereGeo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
            // Rotate slightly for organic asymmetry
            sphereGeo.rotateY(Math.random() * Math.PI);
            const peak = new THREE.Mesh(sphereGeo, p.mat);
            peak.position.set(p.x, p.y, p.z);

            // Set scale to transform the dome into a thin, tall ellipsoid ridge with flat bottom
            peak.scale.set(p.rx, p.ry, p.rz);
            peak.receiveShadow = true;
            peak.castShadow = false; // Optimized: disabled shadow casting
            mountainGroup.add(peak);
        });

        // Build Peak Tower (凌霄閣) on top of the highest peak (Peak 4 at X=27, Y=75, Z=-95)
        const peakTower = new THREE.Group();

        // 1. Base Pillar (White block)
        const ptBaseGeo = new THREE.BoxGeometry(3.5, 4.0, 2.5);
        const ptBaseMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.5 }); // white concrete
        const ptBase = new THREE.Mesh(ptBaseGeo, ptBaseMat);
        ptBase.position.y = 2.0; // centered at Y=2, spans 0 to 4
        ptBase.castShadow = true;
        peakTower.add(ptBase);

        // 2. Glass Viewing Deck (using ferryWindowsMaterial so it glows warm yellow at night!)
        const ptGlassGeo = new THREE.BoxGeometry(5.0, 1.4, 2.2);
        const ptGlass = new THREE.Mesh(ptGlassGeo, this.ferryWindowsMaterial);
        ptGlass.position.y = 3.8; // sits on the base pillar
        peakTower.add(ptGlass);

        // 3. Curved Bowl/Crescent Roof Wings (angular low-poly crescent shape)
        const ptCenterGeo = new THREE.BoxGeometry(3.0, 0.5, 2.5);
        const ptCenter = new THREE.Mesh(ptCenterGeo, ptBaseMat);
        ptCenter.position.y = 4.7;
        peakTower.add(ptCenter);

        const ptLeftWingGeo = new THREE.BoxGeometry(3.2, 0.5, 2.5);
        const ptLeftWing = new THREE.Mesh(ptLeftWingGeo, ptBaseMat);
        ptLeftWing.position.set(-2.0, 5.0, 0);
        ptLeftWing.rotation.z = -0.38; // curve upwards to left
        peakTower.add(ptLeftWing);

        const ptRightWingGeo = new THREE.BoxGeometry(3.2, 0.5, 2.5);
        const ptRightWing = new THREE.Mesh(ptRightWingGeo, ptBaseMat);
        ptRightWing.position.set(2.0, 5.0, 0);
        ptRightWing.rotation.z = 0.38; // curve upwards to right
        peakTower.add(ptRightWing);

        // 4. Add 4 vertical neon light bars and point lights to the base facade (front)
        this.peakTowerLights = [];
        this.peakTowerPointLights = [];
        const ptLightGeo = new THREE.BoxGeometry(0.35, 3.2, 0.25);
        for (let i = 0; i < 4; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: '#ff0000',
                transparent: true,
                opacity: 0.25
            });
            const mesh = new THREE.Mesh(ptLightGeo, mat);
            const xPos = -1.05 + i * 0.7; // Spaced evenly on base front (X: -1.05, -0.35, 0.35, 1.05)
            mesh.position.set(xPos, 2.0, 1.27); // Just outside Z=1.25 base front face
            peakTower.add(mesh);
            this.peakTowerLights.push(mesh);

            // Add a point light to cast dynamic color onto Peak Tower base
            const pLight = new THREE.PointLight('#ff0000', 0, 8, 1.2);
            pLight.position.set(xPos, 2.0, 1.65); // Placed slightly in front
            peakTower.add(pLight);
            this.peakTowerPointLights.push(pLight);
        }

        // 4b. Add 4 vertical neon light bars and point lights to the base back facade
        for (let i = 0; i < 4; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: '#ff0000',
                transparent: true,
                opacity: 0.25
            });
            const mesh = new THREE.Mesh(ptLightGeo, mat);
            const xPos = -1.05 + i * 0.7; // Spaced evenly on base back
            mesh.position.set(xPos, 2.0, -1.27); // Just outside Z=-1.25 base back face
            peakTower.add(mesh);
            this.peakTowerLights.push(mesh);

            // Add a point light to cast dynamic color onto Peak Tower base
            const pLight = new THREE.PointLight('#ff0000', 0, 8, 1.2);
            pLight.position.set(xPos, 2.0, -1.65); // Placed slightly behind
            peakTower.add(pLight);
            this.peakTowerPointLights.push(pLight);
        }

        // Position the Peak Tower on the top of Peak 4
        peakTower.position.set(27, 74.8, -107);
        mountainGroup.add(peakTower);

        // 5. Spawn 115 pine trees of various sizes behind the mountains (Z < -110) - Reduced slightly and kept clear of mountains and beach
        const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
        const leavesMat = new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.85 }); // Dark forest green
        
        for (let i = 0; i < 115; i++) {
            const tree = new THREE.Group();
            
            // Trunk
            const trunkGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.2, 5);
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 0.6;
            trunk.castShadow = true;
            tree.add(trunk);
            
            // Foliage (stack of cones)
            const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 5), leavesMat);
            cone1.position.y = 1.4;
            cone1.castShadow = true;
            const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 5), leavesMat);
            cone2.position.y = 1.9;
            cone2.castShadow = true;
            const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 5), leavesMat);
            cone3.position.y = 2.3;
            cone3.castShadow = true;
            
            tree.add(cone1, cone2, cone3);
            
            // Random position: Z between -116 and -141, X between -65 and 65
            // Ensure trees do not overlap with the mountain profiles at ground level
            let tx, tz, overlapping;
            do {
                tx = -65 + Math.random() * 130;
                tz = -116 - Math.random() * 25; // Keep a 4-unit gap before the beach at Z = -145, and start behind p.z bases
                overlapping = false;
                for (const p of peaks) {
                    const dx = (tx - p.x) / p.rx;
                    const dz = (tz - p.z) / p.rz;
                    if ((dx * dx + dz * dz) <= 1.45) { // Increased threshold to push trees further away from mountain bases
                        overlapping = true;
                        break;
                    }
                }
            } while (overlapping);

            const ty = -0.5; // embedded on base level
            tree.position.set(tx, ty, tz);
            
            // Random scale (increased width scale and significantly taller height scale)
            const ts = 1.0 + Math.random() * 2.0;
            const heightScale = ts * (2.2 + Math.random() * 1.0);
            tree.scale.set(ts, heightScale, ts);
            
            mountainGroup.add(tree);
        }

        this.scene.add(mountainGroup);
    }

    /**
     * Update 3D dynamics and parameters per frame
     */
    update(state, lightningStrength = 0) {
        const time = performance.now() * 0.001;
        const isDark = state.buildingEmissive > 0.35;

        // Real-time camera & target coordinate updates in HTML
        if (this.camera && this.controls) {
            const cp = this.camera.position;
            const ct = this.controls.target;
            if (this.camPosEl) this.camPosEl.textContent = `X: ${cp.x.toFixed(1)} Y: ${cp.y.toFixed(1)} Z: ${cp.z.toFixed(1)}`;
            if (this.camTarEl) this.camTarEl.textContent = `X: ${ct.x.toFixed(1)} Y: ${ct.y.toFixed(1)} Z: ${ct.z.toFixed(1)}`;
        }

        // Dynamically adjust backlight intensity and color to match environment
        if (this.backLight) {
            // Blend sky color with a soft green-white base to preserve mountain green visibility under any weather/time of day
            const baseTint = new THREE.Color('#e0ffe0');
            this.backLight.color.copy(baseTint).lerp(state.skyColor, 0.35);
            this.backLight.intensity = Math.max(7.2, state.ambientIntensity * 18.0); // Multiplied by 4x for extreme daytime visibility
        }

        // Update Peak Tower neon lights and point lights
        if (this.peakTowerLights && this.peakTowerLights.length > 0) {
            const activeIndex = Math.floor(time * 4) % 4; // Chase sequence (4 steps/sec)
            const isFlickerOn = Math.sin(time * 24) > -0.3; // High frequency flicker to simulate neon tubes

            this.peakTowerLights.forEach((light, i) => {
                const idxInGroup = i % 4; // Map index to 0-3 for front and back synchronization
                const pLight = this.peakTowerPointLights[i];

                // Smooth HSL color rotation
                const hue = (time * 0.15 + idxInGroup * 0.25) % 1.0;
                const color = new THREE.Color().setHSL(hue, 1.0, 0.5);
                light.material.color.copy(color);
                if (pLight) pLight.color.copy(color);

                const isActive = (idxInGroup === activeIndex);
                const isGlowing = isActive && isFlickerOn;

                // Adjust emissive visibility (opacity)
                light.material.opacity = isGlowing ? 1.0 : 0.25;

                // Update point lights casting colored glow on concrete base (only active in sunset/night)
                if (pLight) {
                    pLight.intensity = isGlowing ? (isDark ? 8.0 * state.buildingEmissive : 0.0) : 0.0;
                }
            });
        }

        // 1. Fog / Environment Setup
        const baseColor = state.skyColor.clone();
        if (lightningStrength > 0.1) {
            const yellowShift = new THREE.Color(1.0, 0.88, 0.25).multiplyScalar(lightningStrength * 0.18);
            baseColor.add(yellowShift);
        }
        this.renderer.setClearColor(baseColor);

        this.scene.fog.density = state.fogDensity;
        const fogColor = state.fogColor.clone();
        if (lightningStrength > 0.1) {
            const yellowShift = new THREE.Color(1.0, 0.88, 0.25).multiplyScalar(lightningStrength * 0.22);
            fogColor.add(yellowShift);
        }
        this.scene.fog.color.copy(fogColor);

        const ambientColor = state.ambientColor.clone();
        const sunColor = state.sunColor.clone();
        if (lightningStrength > 0.1) {
            const yellowLight = new THREE.Color(1.0, 0.85, 0.2).multiplyScalar(lightningStrength * 0.35);
            ambientColor.add(yellowLight);
            sunColor.add(yellowLight);
        }
        this.ambientLight.color.copy(ambientColor);
        this.ambientLight.intensity = state.ambientIntensity + (lightningStrength * 0.45);

        this.dirLight.color.copy(sunColor);
        this.dirLight.intensity = state.sunIntensity + (lightningStrength * 0.9);
        this.dirLight.position.copy(state.sunPos);

        // 2. Animate Water Plane (Wave movement / speed variations)
        this.waterMaterial.color.copy(state.waterColor);
        this.waterMaterial.roughness = state.waterRoughness;
        this.waterMaterial.normalScale.set(state.waterDistortion * 0.15, state.waterDistortion * 0.15);
        if (this.waterNormalTexture) {
            this.waterNormalTexture.offset.x = (time * 0.016 * state.waterDistortion) % 1.0;
            this.waterNormalTexture.offset.y = (time * 0.035 * state.waterDistortion) % 1.0;
        }

        // Dynamically adjust road wetness based on rain
        if (state.rainIntensity > 0.1) {
            this.wetRoadMaterial.roughness = THREE.MathUtils.lerp(this.wetRoadMaterial.roughness, 0.12, 0.02);
            this.wetRoadMaterial.metalness = THREE.MathUtils.lerp(this.wetRoadMaterial.metalness, 0.7, 0.02);
        } else {
            this.wetRoadMaterial.roughness = THREE.MathUtils.lerp(this.wetRoadMaterial.roughness, 0.45, 0.02);
            this.wetRoadMaterial.metalness = THREE.MathUtils.lerp(this.wetRoadMaterial.metalness, 0.15, 0.02);
        }

        // 3. Animate Clouds (Accelerate windSpeedFactor in strong wind)
        const windSpeedFactor = state.waterDistortion > 3.0 ? 6.0 : (state.waterDistortion > 2.0 ? 3.0 : 1.0);
        const cloudiness = state.cloudiness !== undefined ? state.cloudiness : 0.2;

        this.clouds.forEach(c => {
            c.group.position.x += c.speed * windSpeedFactor;

            // Wrap around boundary (Aligned to new 140 width boundary)
            if (c.group.position.x > 70) {
                c.group.position.x = -70;
            }

            // Gentle floating oscillation
            c.group.position.y = c.group.position.y + Math.sin(time + c.group.position.x) * 0.003;

            // Dynamic opacity based on cloudiness and isExtra flag
            let targetOpacity = 0.15 + cloudiness * 0.40; // Base clouds range: 0.15 (clear) to 0.55 (cloudy)
            if (c.isExtra) {
                targetOpacity = Math.max(0.0, (cloudiness - 0.3) / 0.7) * 0.55; // Extra clouds range: 0.0 to 0.55
            }
            c.material.opacity = THREE.MathUtils.lerp(c.material.opacity, targetOpacity, 0.05);

            // Dynamic color based on rain intensity (storm clouds)
            const targetColor = state.rainIntensity > 0.1 ? new THREE.Color('#334155') : new THREE.Color('#f8fafc');
            c.material.color.lerp(targetColor, 0.05);
        });

        // 3.5 Sway Palm Trees in the wind
        if (this.palmTrees && this.palmTrees.length > 0) {
            const windSwaySpeed = state.waterDistortion > 3.0 ? 4.5 : (state.waterDistortion > 2.0 ? 2.5 : 1.0);
            const windSwayAngle = state.waterDistortion > 3.0 ? 0.18 : (state.waterDistortion > 2.0 ? 0.08 : 0.03);

            this.palmTrees.forEach((tree, idx) => {
                const baseSway = Math.sin(time * windSwaySpeed + idx * 0.5) * windSwayAngle;
                const flutterSway = Math.sin(time * windSwaySpeed * 2.5 + idx) * (windSwayAngle * 0.25);
                tree.rotation.z = baseSway + flutterSway;
                tree.rotation.x = Math.cos(time * windSwaySpeed * 0.8 + idx * 0.5) * (windSwayAngle * 0.3);
            });
        }

        // 4. Animate Ships (Bobbing, roll, and slow sailing)
        if (isDark) {
            this.ferryWindowsMaterial.color.setHex(0xfef08a);
        } else {
            this.ferryWindowsMaterial.color.setHex(0x2d3748); // off windows
        }

        this.ships.forEach(ship => {
            // Sail
            ship.group.position.x += ship.speed * ship.dir * (1 + state.waterDistortion * 0.1);

            // Floating bobbing (Y axis) - reduced by half
            ship.group.position.y = 0.1 + Math.sin(time * ship.bobFreq) * (0.07 + state.waterDistortion * 0.03) * 0.5;

            // Boat roll/tilt (Z/X axes) - reduced by half
            ship.group.rotation.z = Math.sin(time * ship.rollFreq) * (0.02 + state.waterDistortion * 0.015) * 0.5;
            ship.group.rotation.x = Math.cos(time * (ship.rollFreq * 1.3)) * (0.015 + state.waterDistortion * 0.008) * 0.5;

            // Turn boat around at boundaries
            if (ship.dir === 1 && ship.group.position.x > 50) {
                ship.dir = -1;
                ship.group.rotation.y = Math.PI; // Face left
            } else if (ship.dir === -1 && ship.group.position.x < -50) {
                ship.dir = 1;
                ship.group.rotation.y = 0; // Face right
            }

            // Update ship flashing lights (only active at sunset/night)
            if (ship.flashingLights) {
                ship.flashingLights.forEach(light => {
                    const blink = Math.sin(time * light.freq + light.offset) > 0.0;
                    if (isDark && blink) {
                        light.mesh.visible = true;
                        light.mat.color.copy(light.originalColor);
                    } else if (isDark) {
                        light.mesh.visible = true;
                        light.mat.color.setHex(0x1e293b); // Dim unlit appearance
                    } else {
                        light.mesh.visible = false;
                    }
                });
            }
        });

        // 5. Animate Cars (Drive, rotate wheels, activate headlights at night)

        // Turn headlight/taillight materials glow on/off
        if (isDark) {
            this.carHeadlightMaterials[0].color.setHex(0xfef08a);
            this.carTaillightMaterials[0].color.setHex(0xef4444);
        } else {
            this.carHeadlightMaterials[0].color.setHex(0x1e293b); // Unlit dark grey
            this.carTaillightMaterials[0].color.setHex(0x1e293b);
        }

        // 5. Traffic signal timing & update (30 second cycle: Green 15s, Yellow 3s, Red 12s)
        const cycleTime = time % 30;
        let signal = 'green';
        if (cycleTime < 15) {
            signal = 'green';
        } else if (cycleTime < 18) {
            signal = 'yellow';
        } else {
            signal = 'red';
        }

        // Update traffic light lens materials
        const activeRed = new THREE.Color('#ff2200');
        const activeYellow = new THREE.Color('#ffaa00');
        const activeGreen = new THREE.Color('#00ff33');
        const dimRed = new THREE.Color('#220000');
        const dimYellow = new THREE.Color('#221100');
        const dimGreen = new THREE.Color('#002200');

        if (this.trafficLights) {
            this.trafficLights.forEach(tl => {
                if (signal === 'red') {
                    tl.redLens.material.color.copy(activeRed);
                    tl.redLens.material.emissive.copy(activeRed).multiplyScalar(isDark ? 3.5 : 1.5);
                    tl.yellowLens.material.color.copy(dimYellow);
                    tl.yellowLens.material.emissive.copy(dimYellow);
                    tl.greenLens.material.color.copy(dimGreen);
                    tl.greenLens.material.emissive.copy(dimGreen);
                } else if (signal === 'yellow') {
                    tl.redLens.material.color.copy(dimRed);
                    tl.redLens.material.emissive.copy(dimRed);
                    tl.yellowLens.material.color.copy(activeYellow);
                    tl.yellowLens.material.emissive.copy(activeYellow).multiplyScalar(isDark ? 3.5 : 1.5);
                    tl.greenLens.material.color.copy(dimGreen);
                    tl.greenLens.material.emissive.copy(dimGreen);
                } else {
                    tl.redLens.material.color.copy(dimRed);
                    tl.redLens.material.emissive.copy(dimRed);
                    tl.yellowLens.material.color.copy(dimYellow);
                    tl.yellowLens.material.emissive.copy(dimYellow);
                    tl.greenLens.material.color.copy(activeGreen);
                    tl.greenLens.material.emissive.copy(activeGreen).multiplyScalar(isDark ? 3.5 : 1.5);
                }
            });
        }

        const wetSpeedMod = state.rainIntensity > 0.1 ? 0.75 : 1.0;
        this.cars.forEach(car => {
            let targetSpeed = car.baseSpeed;

            // Decelerate if approaching red/yellow traffic light before crossing
            if (signal === 'red') {
                if (car.dir === 1 && car.group.position.x < -9.5 && car.group.position.x > -12.5) {
                    targetSpeed = 0.0;
                } else if (car.dir === -1 && car.group.position.x > 9.5 && car.group.position.x < 12.5) {
                    targetSpeed = 0.0;
                }
            } else if (signal === 'yellow') {
                if (car.dir === 1 && car.group.position.x < -12.0 && car.group.position.x > -25.0) {
                    targetSpeed = 0.0;
                } else if (car.dir === -1 && car.group.position.x > 12.0 && car.group.position.x < 25.0) {
                    targetSpeed = 0.0;
                }
            }

            // Anti-collision logic (prevents cars from clipping into each other when waiting in the same lane)
            this.cars.forEach(otherCar => {
                if (otherCar !== car && otherCar.dir === car.dir && Math.abs(otherCar.z - car.z) < 2.0) {
                    const dist = (otherCar.group.position.x - car.group.position.x) * car.dir;
                    if (dist > 0 && dist < 8.0) {
                        targetSpeed = Math.min(targetSpeed, otherCar.speed * 0.85);
                        if (dist < 4.5) {
                            targetSpeed = 0.0;
                        }
                    }
                }
            });

            // Smooth speed change using lerp
            car.speed = THREE.MathUtils.lerp(car.speed, targetSpeed, 0.08);

            // Move car
            car.group.position.x += car.speed * car.dir * wetSpeedMod;

            // Wrap around lanes (Aligned to new 140 width boundary)
            if (car.dir === 1 && car.group.position.x > 70) {
                car.group.position.x = -70;
            } else if (car.dir === -1 && car.group.position.x < -70) {
                car.group.position.x = 70;
            }

            // Rotate wheels correctly on their local Y axis
            car.wheels.forEach(w => {
                w.rotateY(- (car.speed / 0.32) * car.dir * wetSpeedMod);
            });

            // Update headlights intensity
            if (car.headlight) {
                car.headlight.intensity = isDark ? 60.0 * state.buildingEmissive : 0.0;
            }
        });

        // 6. Animate Pedestrians (Walk, swing limbs, turn around at walkway boundary, hold umbrellas)
        // Umbrella holding triggers when visual rain intensity is active (avoiding asymptotic lerping issues)
        const hasRain = state.rainIntensity > 0.15;
        this.pedestrians.forEach(p => {
            // Speed modifier under rain
            const rainSpeedMod = state.rainIntensity > 0.5 ? 1.3 : 1.0; // Walk faster to find shelter!
            p.group.position.x += p.speed * p.dir * rainSpeedMod;

            // Smoothly transition Z to the correct lane to avoid head-on collisions
            const targetZ = p.dir === 1 ? p.zLane1 : p.zLane2;
            p.group.position.z += (targetZ - p.group.position.z) * 0.05 * rainSpeedMod;

            // Swing limbs
            const swing = Math.sin(time * p.gaitFreq * rainSpeedMod) * 0.48;
            p.legL.rotation.x = swing;
            p.legR.rotation.x = -swing;

            if (hasRain) {
                // Hold umbrella up and lock left arm swing, swing right arm normally
                p.armL.rotation.x = 2.2;
                p.armL.rotation.z = -0.2;
                p.armR.rotation.x = swing * 0.85;
                p.armR.rotation.z = 0;
                if (p.umbrella) p.umbrella.visible = true;
            } else {
                p.armL.rotation.x = -swing * 0.85;
                p.armL.rotation.z = 0;
                p.armR.rotation.x = swing * 0.85;
                p.armR.rotation.z = 0;
                if (p.umbrella) p.umbrella.visible = false;
            }

            // Face the direction of walking (rotated 90 degrees to align body and gait)
            p.group.rotation.y = p.dir === 1 ? -Math.PI / 2 : Math.PI / 2;

            // Turn around at walkway boundary
            if (p.dir === 1 && p.group.position.x > p.rangeY) {
                p.dir = -1;
            } else if (p.dir === -1 && p.group.position.x < p.rangeX) {
                p.dir = 1;
            }
        });

        // 7. Update Skyscrapers window glows (Dynamic lights shift + flicker during lightning storms)
        if (!this.lastWindowUpdate) this.lastWindowUpdate = time;
        if (time - this.lastWindowUpdate > 1.5) {
            this.lastWindowUpdate = time;
            const rows = 32;
            const cols = 4;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (Math.random() < 0.08) {
                        this.windowsData[r][c].isOn = !this.windowsData[r][c].isOn;
                    }
                    if (Math.random() < 0.05) {
                        this.windowsData[r][c].color = this.lightColors[Math.floor(Math.random() * this.lightColors.length)];
                    }
                }
            }
            this.drawSkyscraperWindows();
            this.buildingEmissiveTexture.needsUpdate = true;
        }

        let extraFlicker = 0;
        if (lightningStrength > 0.4 && Math.random() < 0.25) {
            extraFlicker = -0.35; // Power grid flicker simulation
        }

        const bEmissive = state.buildingEmissive;
        const targetIntensity = Math.max(0.01, bEmissive * 1.1 + extraFlicker);
        this.buildingMaterial.emissiveIntensity = targetIntensity;
        if (this.buildingMaterials) {
            this.buildingMaterials.forEach(mat => {
                mat.emissiveIntensity = targetIntensity;
            });
        }

        // Dynamically glow building spires/girders/crowns during sunset and night
        if (this.cpRoofMaterial) {
            this.cpRoofMaterial.color.copy(new THREE.Color('#ec4899')).multiplyScalar(bEmissive);
        }
        if (this.ifcCrownMaterial) {
            this.ifcCrownMaterial.color.copy(new THREE.Color('#93c5fd')).multiplyScalar(bEmissive);
        }
        if (this.bocBracingMaterial) {
            this.bocBracingMaterial.color.copy(new THREE.Color('#f8fafc')).multiplyScalar(bEmissive);
        }
        if (this.hsbcGirderMaterial) {
            this.hsbcGirderMaterial.color.copy(new THREE.Color('#ef4444')).multiplyScalar(bEmissive);
        }

        // 8. Update Promenade and Road Streetlights
        this.streetLights.forEach(item => {
            if (isDark) {
                if (item.light) item.light.intensity = 100.0 * state.buildingEmissive;
                item.bulbMat.color.setHex(0xfde047);
            } else {
                if (item.light) item.light.intensity = 0.0;
                item.bulbMat.color.setHex(0x1e293b);
            }
        });

        // 8b. Update Cityscape Warm Fill Light (Dynamic Front Fill Light)
        if (this.cityglowLight) {
            if (state.buildingEmissive < 0.1) {
                // Day: Bright white fill light from the front to light up buildings and mountains
                this.cityglowLight.color.set('#f8fafc');
                this.cityglowLight.intensity = 12.0 * state.ambientIntensity; // Multiplied by 4x to match the general 4x boost
            } else if (state.buildingEmissive < 0.4) {
                // Morning: Soft golden morning fill light
                this.cityglowLight.color.set('#ffedd5');
                this.cityglowLight.intensity = 2.0 * state.ambientIntensity;
            } else if (state.buildingEmissive < 0.7) {
                // Sunset: Warm orange sunset fill light
                this.cityglowLight.color.set('#ffedd5');
                this.cityglowLight.intensity = 3.5 * state.ambientIntensity;
            } else {
                // Night: Neon cityscape warm purple-gold reflection
                this.cityglowLight.color.set('#ffe4d6');
                this.cityglowLight.intensity = 8.0 * state.buildingEmissive;
            }
        }

        // 8c. Update Celestial Bodies (Sun / Moon)
        if (this.sunMesh && this.moonMesh) {
            const isNight = state.buildingEmissive >= 0.8;

            // Calculate target visibility based on fog density (keep them partially visible for simulation feedback)
            let targetOpacity = 1.0;
            if (state.fogDensity > 0.015) {
                targetOpacity = 0.15; // Faintly visible in thick fog
            } else if (state.fogDensity > 0.007) {
                targetOpacity = 0.3;  // Partially visible in thunderstorm/heavy rain
            } else if (state.fogDensity > 0.004) {
                targetOpacity = 0.55; // Visible but dimmed in rain
            } else if (state.fogDensity > 0.001) {
                targetOpacity = 0.75; // Slightly dimmed in cloudy weather
            }

            const targetSunOpacity = isNight ? 0.0 : targetOpacity;
            const targetMoonOpacity = isNight ? targetOpacity : 0.0;

            // Smoothly interpolate current opacities
            const lerpFactor = 0.03; // Smooth transition speed
            this.currentSunOpacity = THREE.MathUtils.lerp(this.currentSunOpacity, targetSunOpacity, lerpFactor);
            this.currentMoonOpacity = THREE.MathUtils.lerp(this.currentMoonOpacity, targetMoonOpacity, lerpFactor);

            // Update Sun
            this.sunMesh.visible = this.currentSunOpacity > 0.005;
            this.sunMaterial.opacity = this.currentSunOpacity;
            if (this.sunMesh.visible) {
                this.sunMaterial.color.copy(state.sunColor);

                // Slow rotation on the Z-axis to spin the sun flatly facing the camera
                this.sunMesh.rotation.z = time * 0.15;

                this.sunMesh.position.copy(state.sunPos).normalize().multiplyScalar(100); // Positioned behind buildings, no overlap
            }

            // Update Moon
            this.moonMesh.visible = this.currentMoonOpacity > 0.005;
            this.moonMaterial.opacity = this.currentMoonOpacity;
            if (this.moonMesh.visible) {
                this.moonMesh.position.copy(state.sunPos).normalize().multiplyScalar(100); // Positioned behind buildings, no overlap
            }
        }

        // A1. Animate Ferris Wheel (Rotation and flashing lights)
        if (this.ferrisWheelRim) {
            this.ferrisWheelRim.rotation.z += 0.006;

            // Keep cabins upright
            this.ferrisCabins.forEach(cabin => {
                cabin.rotation.z = -this.ferrisWheelRim.rotation.z;
            });

            // Flashing lights
            if (this.ferrisWheelLights && this.ferrisWheelLights.length > 0) {
                const isFlashOn = Math.floor(time * 3.5) % 2 === 0;
                this.ferrisWheelLights.forEach((light, idx) => {
                    const color = isFlashOn ? (idx % 2 === 0 ? '#ff0000' : '#ffffff') : (idx % 2 === 0 ? '#ffffff' : '#ff0000');
                    light.material.color.set(color);
                });
            }
        }

        // A1.5 Animate queue people body sway
        if (this.queuePeople && this.queuePeople.length > 0) {
            this.queuePeople.forEach(p => {
                p.group.rotation.z = Math.sin(time * p.swaySpeed + p.swayOffset) * p.swayAmount;
                p.group.rotation.x = Math.cos(time * (p.swaySpeed * 0.8) + p.swayOffset) * (p.swayAmount * 0.5);
            });
        }

        // A1.6 Animate sitting people hand gestures (conversational talking)
        if (this.seatedPeople && this.seatedPeople.length > 0) {
            this.seatedPeople.forEach(p => {
                const offset = p.isPerson1 ? 0 : Math.PI;
                // Alternate gesturing state over an 8-second cycle
                const gestureCycle = Math.sin(time * 0.75 + offset);
                
                if (gestureCycle > 0.15) {
                    // Active gesturing: move arms up and down, slightly out
                    const wave1 = Math.sin(time * 6) * 0.2;
                    const wave2 = Math.cos(time * 4) * 0.15;
                    if (p.isPerson1) {
                        // Person 1 gestures more with right arm (closest to Person 2)
                        p.armR.rotation.x = -Math.PI / 2.5 + 0.2 + wave1; // gesture forward and slightly higher
                        p.armR.rotation.z = 0.1 + wave2;
                        p.armL.rotation.x = -Math.PI / 2.5 + Math.sin(time * 2) * 0.05;
                    } else {
                        // Person 2 gestures more with left arm (closest to Person 1)
                        p.armL.rotation.x = -Math.PI / 2.5 + 0.2 + wave1; // gesture forward and slightly higher
                        p.armL.rotation.z = -0.1 - wave2;
                        p.armR.rotation.x = -Math.PI / 2.5 + Math.sin(time * 2) * 0.05;
                    }
                } else {
                    // Resting state: transition back to pointing forward smoothly
                    p.armR.rotation.x = THREE.MathUtils.lerp(p.armR.rotation.x, -Math.PI / 2.5, 0.1);
                    p.armR.rotation.z = THREE.MathUtils.lerp(p.armR.rotation.z, 0.0, 0.1);
                    p.armL.rotation.x = THREE.MathUtils.lerp(p.armL.rotation.x, -Math.PI / 2.5, 0.1);
                    p.armL.rotation.z = THREE.MathUtils.lerp(p.armL.rotation.z, 0.0, 0.1);
                }
            });
        }

        // A2. Animate Dogs in the Park (Walk back/forth, sway legs, wag tail, walk owner)
        if (this.parkDogs && this.parkDogs.length > 0) {
            this.parkDogs.forEach(dog => {
                dog.x += dog.speed * dog.dir;

                // Boundary checking
                if (dog.dir === 1 && dog.x > dog.rangeMax) {
                    dog.dir = -1;
                } else if (dog.dir === -1 && dog.x < dog.rangeMin) {
                    dog.dir = 1;
                }

                dog.group.position.x = dog.x;
                
                // Face walking direction (0 for +X/right, Math.PI for -X/left)
                dog.group.rotation.y = dog.dir === 1 ? 0 : Math.PI;

                // Leg swing animation
                const legSwing = Math.sin(time * 12) * 0.45;
                if (dog.legs && dog.legs.length === 4) {
                    dog.legs[0].rotation.z = legSwing;  // LF
                    dog.legs[3].rotation.z = legSwing;  // RB
                    dog.legs[1].rotation.z = -legSwing; // RF
                    dog.legs[2].rotation.z = -legSwing; // LB
                }

                // Tail wagging
                if (dog.tail) {
                    dog.tail.rotation.y = Math.sin(time * 18) * 0.4;
                }

                // Owner walking animation (Z-axis rotation for forward walk)
                if (dog.hasOwner) {
                    const ownerGroup = dog.group.children.find(child => child.userData && child.userData.legL);
                    if (ownerGroup) {
                        const oLegSwing = Math.sin(time * 8) * 0.35;
                        ownerGroup.userData.legL.rotation.z = oLegSwing;
                        ownerGroup.userData.legR.rotation.z = -oLegSwing;
                        ownerGroup.userData.armL.rotation.z = -oLegSwing * 0.4;
                    }
                }
            });
        }

        // A2.5 Animate Beach Crabs (walk sideways along X, scurry legs rapidly, avoid obstacles)
        if (this.beachCrabs && this.beachCrabs.length > 0) {
            this.beachCrabs.forEach(crab => {
                let nextX = crab.x + crab.speed * crab.dir;

                // Check collision at next position (nextX, crab.z)
                let collision = false;
                
                // Check against rocks
                if (this.beachRocks) {
                    for (let i = 0; i < this.beachRocks.length; i++) {
                        const rock = this.beachRocks[i];
                        const dx = nextX - rock.x;
                        const dz = crab.z - rock.z;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist < (crab.collisionRadius + rock.radius)) {
                            collision = true;
                            break;
                        }
                    }
                }
                
                // Check against other crabs
                if (!collision && this.beachCrabs) {
                    for (let i = 0; i < this.beachCrabs.length; i++) {
                        const other = this.beachCrabs[i];
                        if (other === crab) continue;
                        const dx = nextX - other.x;
                        const dz = crab.z - other.z;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist < (crab.collisionRadius + other.collisionRadius)) {
                            collision = true;
                            break;
                        }
                    }
                }

                if (collision) {
                    // Turn around (reverse direction)
                    crab.dir = -crab.dir;
                    // Change lane (Z position) to try and steer around the obstacle
                    const zShift = (Math.random() > 0.5 ? 1.0 : -1.0) * (0.8 + Math.random() * 0.8);
                    crab.z = Math.max(-162, Math.min(-147, crab.z + zShift));
                    crab.group.position.z = crab.z;
                    
                    // Recalculate nextX in the new direction
                    nextX = crab.x + crab.speed * crab.dir;
                }

                crab.x = nextX;

                // Turn around at range boundaries
                if (crab.dir === 1 && crab.x > crab.rangeMax) {
                    crab.dir = -1;
                } else if (crab.dir === -1 && crab.x < crab.rangeMin) {
                    crab.dir = 1;
                }
                
                // Hard boundaries in case random range exceeds the beach width of [-65, 65]
                if (crab.x > 65) {
                    crab.dir = -1;
                } else if (crab.x < -65) {
                    crab.dir = 1;
                }

                crab.group.position.x = crab.x;

                // Rapid scurrying leg wiggle
                if (crab.legs && crab.legs.length === 6) {
                    const wiggle = Math.sin(time * 28 + crab.x) * 0.35;
                    crab.legs.forEach((leg, idx) => {
                        const offset = idx % 2 === 0 ? 1 : -1;
                        leg.rotation.z = wiggle * offset;
                    });
                }
            });
        }

        // A3. Animate Bus in Terminal (State Machine: Park -> Drive out -> Wait -> Drive in -> Park)
        if (this.terminalBus) {
            const deltaTime = 0.016; // Approx. frame delta

            if (this.busState === 'parked') {
                this.busTimer -= deltaTime;
                this.terminalBus.position.set(this.busX, 0.15, -49);
                this.terminalBus.rotation.y = 0; // face right

                if (this.busTimer <= 0) {
                    this.busState = 'driving_out';
                }
            } else if (this.busState === 'driving_out') {
                this.busX += 0.15; // Drive right
                
                // Steer bypass around the parked static bus in Lane 1 (which is at X = 42, Z = -49)
                let busZ = -49;
                if (this.busX > 32 && this.busX < 52) {
                    const ratio = (this.busX - 32) / 20;
                    busZ = -49 + Math.sin(ratio * Math.PI) * 4.5; // push towards smaller Z / leftwards
                    this.terminalBus.rotation.y = Math.cos(ratio * Math.PI) * 0.3; // slight steer tilt
                } else {
                    this.terminalBus.rotation.y = 0; // face right
                }
                this.terminalBus.position.set(this.busX, 0.15, busZ);

                // Rotate wheels
                this.terminalBusWheels.forEach(w => {
                    w.rotateY(-0.15 / 0.32);
                });

                if (this.busX > 75) { // off screen
                    this.busState = 'waiting';
                    this.busTimer = 8; // wait 8 seconds offscreen
                    this.terminalBus.visible = false;
                }
            } else if (this.busState === 'waiting') {
                this.busTimer -= deltaTime;
                if (this.busTimer <= 0) {
                    this.busState = 'driving_in';
                    this.busX = 75;
                    this.terminalBus.visible = true;
                }
            } else if (this.busState === 'driving_in') {
                this.busX -= 0.12; // Drive left
                
                // Steer bypass around the parked static bus in Lane 1 (which is at X = 42, Z = -49)
                let busZ = -49;
                if (this.busX > 32 && this.busX < 52) {
                    const ratio = (this.busX - 32) / 20;
                    busZ = -49 + Math.sin(ratio * Math.PI) * 4.5;
                    this.terminalBus.rotation.y = Math.PI - Math.cos(ratio * Math.PI) * 0.3; // slight steer tilt facing left
                } else {
                    this.terminalBus.rotation.y = Math.PI; // face left
                }
                this.terminalBus.position.set(this.busX, 0.15, busZ);

                // Rotate wheels
                this.terminalBusWheels.forEach(w => {
                    w.rotateY(0.12 / 0.32);
                });

                if (this.busX <= 30) { // back at parking spot behind static bus (X = 30)
                    this.busState = 'parked';
                    this.busTimer = 15; // park for 15 seconds
                    this.terminalBus.rotation.y = 0; // face right
                }
            }
        }

        // 9. Render Frame
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    resetCamera() {
        if (this.camera && this.controls) {
            this.camera.position.set(-4.2, 59, 96.5);
            this.controls.target.set(-3.5, 25.2, -28.6);
            this.controls.update();
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
