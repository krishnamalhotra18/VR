import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Manages creation and interactions of physical objects inside the laboratory.
 */
export class ObjectInteraction {
  constructor(scene, physicsManager) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.objects = [];
    this.targets = [];
    this.phaseWalls = [];
  }

  createLabObjects() {
    // Shared materials
    const metallicMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.8,
      roughness: 0.2
    });

    const heavyMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.1
    });

    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      metalness: 0.1,
      roughness: 0.8
    });

    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.5,
      roughness: 0.3,
      emissive: 0x047857,
      emissiveIntensity: 0.2
    });

    // 1. Cubes on main workbench (x: -1.5 to 1.5, z: -2.5, y: 1.1)
    const cubeGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(cubeGeo, metallicMat.clone());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(0.15, 0.15, 0.15));
      const body = new CANNON.Body({
        mass: 1.0,
        position: new CANNON.Vec3(-1.0 + i * 0.8, 1.2, -2.5),
        shape: shape
      });

      const rec = this.physicsManager.registerObject(mesh, body, { category: 'phasable' });
      rec.name = `Cube #${i + 1}`;
      this.objects.push(rec);
    }

    // 2. Heavy Tungsten Block
    const heavyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), heavyMat);
    heavyMesh.castShadow = true;
    this.scene.add(heavyMesh);
    const heavyBody = new CANNON.Body({
      mass: 50.0,
      position: new CANNON.Vec3(1.8, 1.2, -2.2),
      shape: new CANNON.Box(new CANNON.Vec3(0.2, 0.2, 0.2))
    });
    const heavyRec = this.physicsManager.registerObject(heavyMesh, heavyBody, { category: 'phasable' });
    heavyRec.name = 'Tungsten Block (Heavy)';
    this.objects.push(heavyRec);

    // 3. Lightweight Feather Sphere
    const lightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), lightMat);
    lightMesh.castShadow = true;
    this.scene.add(lightMesh);
    const lightBody = new CANNON.Body({
      mass: 0.1,
      position: new CANNON.Vec3(-1.8, 1.2, -2.2),
      shape: new CANNON.Sphere(0.2)
    });
    const lightRec = this.physicsManager.registerObject(lightMesh, lightBody, { category: 'phasable' });
    lightRec.name = 'Aero Sphere (Light)';
    this.objects.push(lightRec);

    // 4. Kinetic Spheres
    for (let i = 0; i < 2; i++) {
      const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 32), sphereMat.clone());
      sphereMesh.castShadow = true;
      this.scene.add(sphereMesh);

      const sphereBody = new CANNON.Body({
        mass: 2.0,
        position: new CANNON.Vec3(-0.4 + i * 0.8, 1.2, -2.0),
        shape: new CANNON.Sphere(0.22)
      });
      const rec = this.physicsManager.registerObject(sphereMesh, sphereBody, { category: 'phasable' });
      rec.name = `Kinetic Sphere #${i + 1}`;
      this.objects.push(rec);
    }

    // 5. Cylinders (Energy Canisters)
    const cylGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 24);
    const cylMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 2; i++) {
      const cylMesh = new THREE.Mesh(cylGeo, cylMat.clone());
      cylMesh.castShadow = true;
      this.scene.add(cylMesh);

      const cylBody = new CANNON.Body({
        mass: 3.0,
        position: new CANNON.Vec3(2.5 + i * 0.6, 1.2, -1.5),
        shape: new CANNON.Cylinder(0.15, 0.15, 0.4, 24)
      });
      const rec = this.physicsManager.registerObject(cylMesh, cylBody, { category: 'phasable' });
      rec.name = `Energy Canister #${i + 1}`;
      this.objects.push(rec);
    }

    // 6. Interactive Pendulum
    this.createPendulum(new THREE.Vector3(-3.0, 3.5, -2.0));

    // 7. Ramps and Platforms
    this.createRamp(new THREE.Vector3(3.2, 0.5, -3.5), Math.PI / 6);

    // 8. Phase Energy Wall (Solid static obstacle, can be phased through in Phase Mode)
    this.createPhaseWall(new THREE.Vector3(0, 1.5, -4.5), new THREE.Vector3(3.5, 3.0, 0.1));

    // 9. Elevated Challenge Target Platforms
    this.createChallengeTargets();
  }

  createPendulum(anchorPos) {
    // Anchor pivot mesh
    const anchorGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const anchorMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat);
    anchorMesh.position.copy(anchorPos);
    this.scene.add(anchorMesh);

    // Pendulum weight sphere
    const weightGeo = new THREE.SphereGeometry(0.25, 32, 32);
    const weightMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.8, roughness: 0.2 });
    const weightMesh = new THREE.Mesh(weightGeo, weightMat);
    weightMesh.castShadow = true;
    this.scene.add(weightMesh);

    const weightBody = new CANNON.Body({
      mass: 5.0,
      position: new CANNON.Vec3(anchorPos.x + 0.8, anchorPos.y - 1.2, anchorPos.z),
      shape: new CANNON.Sphere(0.25)
    });
    const weightRec = this.physicsManager.registerObject(weightMesh, weightBody, { category: 'phasable' });
    weightRec.name = 'Physics Pendulum';
    this.objects.push(weightRec);

    // Static anchor body
    const anchorBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(anchorPos.x, anchorPos.y, anchorPos.z) });
    this.physicsManager.world.addBody(anchorBody);

    // Point to Point distance constraint (string)
    const constraint = new CANNON.PointToPointConstraint(
      anchorBody,
      new CANNON.Vec3(0, 0, 0),
      weightBody,
      new CANNON.Vec3(0, 1.2, 0)
    );
    this.physicsManager.world.addConstraint(constraint);

    // Visual string line
    const lineMat = new THREE.LineBasicMaterial({ color: 0xc084fc, linewidth: 2 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      anchorPos,
      weightMesh.position
    ]);
    const line = new THREE.Line(lineGeo, lineMat);
    this.scene.add(line);

    // Keep line synchronized in animate tick
    weightRec.updateLine = () => {
      const positions = line.geometry.attributes.position.array;
      positions[0] = anchorPos.x;
      positions[1] = anchorPos.y;
      positions[2] = anchorPos.z;
      positions[3] = weightMesh.position.x;
      positions[4] = weightMesh.position.y;
      positions[5] = weightMesh.position.z;
      line.geometry.attributes.position.needsUpdate = true;
    };
  }

  createRamp(position, angleRad) {
    const rampGeo = new THREE.BoxGeometry(1.5, 0.1, 2.5);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.5 });
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.position.copy(position);
    rampMesh.rotation.x = angleRad;
    rampMesh.receiveShadow = true;
    this.scene.add(rampMesh);

    const rampBody = new CANNON.Body({
      mass: 0, // Static
      position: new CANNON.Vec3(position.x, position.y, position.z)
    });
    rampBody.addShape(new CANNON.Box(new CANNON.Vec3(0.75, 0.05, 1.25)));
    rampBody.quaternion.copy(rampMesh.quaternion);
    this.physicsManager.world.addBody(rampBody);
  }

  createPhaseWall(position, size) {
    const wallGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      metalness: 0.9,
      roughness: 0.1
    });
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.copy(position);
    this.scene.add(wallMesh);

    const wallBody = new CANNON.Body({
      mass: 0, // Static solid wall
      position: new CANNON.Vec3(position.x, position.y, position.z)
    });
    wallBody.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    this.physicsManager.world.addBody(wallBody);

    this.phaseWalls.push({ mesh: wallMesh, body: wallBody });
  }

  createChallengeTargets() {
    // Challenge 1 Target Platform (Ceiling Target at y=4.8)
    this.createTargetZone(new THREE.Vector3(0, 4.8, -2.5), 0.8, 'Target Ceiling (Reverse Gravity)', 0x10b981);

    // Challenge 2 Target Zone (Mid-air target at x=0, y=2.0, z=-5.5)
    this.createTargetZone(new THREE.Vector3(0, 2.0, -5.5), 0.7, 'Mid-Air Target (Frozen Time)', 0x06b6d4);

    // Challenge 3 Target Zone (Behind Phase Wall at z=-6.0)
    this.createTargetZone(new THREE.Vector3(0, 1.2, -6.5), 0.8, 'Phase Zone Target', 0xa855f7);

    // Challenge 4 Target Zone (Right Chamber at x=4.5, y=2.5, z=-2.5)
    this.createTargetZone(new THREE.Vector3(4.5, 2.5, -2.5), 0.8, 'Directional Target Chamber', 0xf59e0b);

    // Challenge 5 Target Zone (Final Master Target)
    this.createTargetZone(new THREE.Vector3(-4.0, 4.2, -4.5), 0.9, 'Master Target (Combined Physics)', 0xec4899);
  }

  createTargetZone(position, radius, name, hexColor) {
    const ringGeo = new THREE.TorusGeometry(radius, 0.05, 16, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: hexColor, wireframe: false });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(position);
    ringMesh.rotation.x = Math.PI / 2;
    this.scene.add(ringMesh);

    // Glowing volumetric inner aura
    const auraGeo = new THREE.SphereGeometry(radius * 0.9, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.25
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.position.copy(position);
    this.scene.add(auraMesh);

    const target = {
      position,
      radius,
      name,
      ringMesh,
      auraMesh,
      checkObjectInside: (objPos) => objPos.distanceTo(position) <= radius
    };

    this.targets.push(target);
    return target;
  }

  update() {
    // Update lines or constraints if needed
    for (let record of this.objects) {
      if (record.updateLine) {
        record.updateLine();
      }
    }
  }
}
