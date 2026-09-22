import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Builds the futuristic scientific laboratory environment chamber.
 */
export class LabEnvironment {
  constructor(scene, physicsManager) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.roomWidth = 14;
    this.roomDepth = 16;
    this.roomHeight = 6;
  }

  buildEnvironment() {
    this.createFloorAndCeiling();
    this.createWallsAndStructure();
    this.createWorkbenches();
    this.createLighting();
  }

  createFloorAndCeiling() {
    // 1. Floor Mesh & Cannon Static Ground
    const floorGeo = new THREE.PlaneGeometry(this.roomWidth, this.roomDepth, 28, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.7
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Floor Grid Seams Glow
    const gridHelper = new THREE.GridHelper(Math.max(this.roomWidth, this.roomDepth), 28, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0.005;
    this.scene.add(gridHelper);

    // Physics floor body
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane()
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physicsManager.world.addBody(groundBody);

    // 2. Ceiling Mesh & Cannon Static Ceiling (for reverse gravity ceiling collision!)
    const ceilGeo = new THREE.PlaneGeometry(this.roomWidth, this.roomDepth);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.5,
      metalness: 0.8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.15
    });
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.position.y = this.roomHeight;
    ceilMesh.rotation.x = Math.PI / 2;
    this.scene.add(ceilMesh);

    // Physics ceiling body (prevents reverse gravity objects from escaping upward!)
    const ceilBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(0, this.roomHeight, 0)
    });
    ceilBody.addShape(new CANNON.Plane());
    ceilBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    this.physicsManager.world.addBody(ceilBody);
  }

  createWallsAndStructure() {
    const halfW = this.roomWidth / 2;
    const halfD = this.roomDepth / 2;
    const wallHeight = this.roomHeight;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.4
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.9
    });

    // Outer boundary walls (Back, Front, Left, Right)
    const wallConfigs = [
      { size: [this.roomWidth, wallHeight], pos: [0, wallHeight / 2, -halfD], rot: [0, 0, 0] }, // Back
      { size: [this.roomWidth, wallHeight], pos: [0, wallHeight / 2, halfD], rot: [0, Math.PI, 0] }, // Front
      { size: [this.roomDepth, wallHeight], pos: [-halfW, wallHeight / 2, 0], rot: [0, Math.PI / 2, 0] }, // Left
      { size: [this.roomDepth, wallHeight], pos: [halfW, wallHeight / 2, 0], rot: [0, -Math.PI / 2, 0] } // Right
    ];

    wallConfigs.forEach(cfg => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...cfg.size), wallMat);
      mesh.position.set(...cfg.pos);
      mesh.rotation.set(...cfg.rot);
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Cannon static wall body
      const body = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(...cfg.pos)
      });
      body.addShape(new CANNON.Plane());
      body.quaternion.setFromEuler(...cfg.rot);
      this.physicsManager.world.addBody(body);
    });

    // Glass Observation Windows on back wall
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), glassMat);
    windowMesh.position.set(0, 3, -halfD + 0.02);
    this.scene.add(windowMesh);

    // Structural Sci-Fi Support Columns
    const colGeo = new THREE.BoxGeometry(0.6, wallHeight, 0.6);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
    
    const colPositions = [
      [-halfW + 0.3, wallHeight / 2, -halfD + 0.3],
      [halfW - 0.3, wallHeight / 2, -halfD + 0.3],
      [-halfW + 0.3, wallHeight / 2, halfD - 0.3],
      [halfW - 0.3, wallHeight / 2, halfD - 0.3]
    ];

    colPositions.forEach(pos => {
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(...pos);
      col.castShadow = true;
      this.scene.add(col);

      const colBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(...pos)
      });
      colBody.addShape(new CANNON.Box(new CANNON.Vec3(0.3, wallHeight / 2, 0.3)));
      this.physicsManager.world.addBody(colBody);
    });
  }

  createWorkbenches() {
    // Primary Experiment Workbench (Center-front)
    const benchGeo = new THREE.BoxGeometry(4.0, 0.9, 1.2);
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.2
    });
    const benchMesh = new THREE.Mesh(benchGeo, benchMat);
    benchMesh.position.set(0, 0.45, -2.5);
    benchMesh.castShadow = true;
    benchMesh.receiveShadow = true;
    this.scene.add(benchMesh);

    // Glowing workbench top trim
    const trimGeo = new THREE.BoxGeometry(4.05, 0.05, 1.25);
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.set(0, 0.9, -2.5);
    this.scene.add(trimMesh);

    // Physics body for workbench
    const benchBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(0, 0.45, -2.5)
    });
    benchBody.addShape(new CANNON.Box(new CANNON.Vec3(2.0, 0.45, 0.6)));
    this.physicsManager.world.addBody(benchBody);
  }

  createLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.2);
    this.scene.add(ambientLight);

    // Main Overhead Laboratory Spotlights
    const mainSpot = new THREE.SpotLight(0xe0f2fe, 3.5, 20, Math.PI / 3, 0.5, 1);
    mainSpot.position.set(0, 5.5, -2.0);
    mainSpot.target.position.set(0, 0, -2.5);
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.width = 1024;
    mainSpot.shadow.mapSize.height = 1024;
    this.scene.add(mainSpot);
    this.scene.add(mainSpot.target);

    // Sci-Fi Cyan/Purple Accent Pointlights
    const cyanLight = new THREE.PointLight(0x38bdf8, 2.0, 10);
    cyanLight.position.set(-3.5, 4.0, -3.0);
    this.scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 2.0, 10);
    purpleLight.position.set(3.5, 4.0, -3.0);
    this.scene.add(purpleLight);
  }
}
