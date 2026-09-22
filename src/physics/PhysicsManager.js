import * as CANNON from 'cannon-es';
import * as THREE from 'three';

/**
 * Core physics manager orchestrating Cannon-es world physics, body synchronization,
 * time scaling, and step management.
 */
export class PhysicsManager {
  constructor() {
    this.world = new CANNON.World();
    // Default earth gravity, will be overridden by GravityController
    this.world.gravity.set(0, -9.81, 0);
    this.world.solver.iterations = 10;
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.allowSleep = true;

    // Contact material settings for sci-fi surfaces
    this.defaultMaterial = new CANNON.Material('default');
    const defaultContactMaterial = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      {
        friction: 0.4,
        restitution: 0.6 // Bouncy sci-fi physical objects
      }
    );
    this.world.addContactMaterial(defaultContactMaterial);
    this.world.defaultContactMaterial = defaultContactMaterial;

    // Array of bound objects { mesh, body, initialPosition, initialQuaternion, isDynamic }
    this.physicsObjects = [];

    // Time scaling settings
    this.timeScale = 1.0;
    this.isFrozen = false;
    this.fixedTimeStep = 1 / 60;
    this.maxSubSteps = 5;
  }

  /**
   * Registers a visual Three.js mesh with a Cannon-es physics body.
   */
  registerObject(mesh, body, options = {}) {
    body.material = this.defaultMaterial;
    this.world.addBody(body);

    const record = {
      mesh,
      body,
      initialPosition: body.position.clone(),
      initialQuaternion: body.quaternion.clone(),
      initialMass: body.mass,
      savedLinearVelocity: new CANNON.Vec3(0, 0, 0),
      savedAngularVelocity: new CANNON.Vec3(0, 0, 0),
      isDynamic: body.type === CANNON.Body.DYNAMIC,
      category: options.category || 'default',
      phasingEnabled: false,
      originalCollisionFilterGroup: body.collisionFilterGroup,
      originalCollisionFilterMask: body.collisionFilterMask
    };

    this.physicsObjects.push(record);
    return record;
  }

  /**
   * Removes an object from physics simulation.
   */
  unregisterObject(record) {
    if (!record) return;
    this.world.removeBody(record.body);
    const index = this.physicsObjects.indexOf(record);
    if (index !== -1) {
      this.physicsObjects.splice(index, 1);
    }
  }

  /**
   * Sets current time scale factor (0.1x to 10x).
   */
  setTimeScale(scale) {
    this.timeScale = Math.max(0.01, Math.min(10.0, scale));
  }

  /**
   * Updates physics simulation step and syncs Three.js mesh transforms.
   */
  update(deltaTime) {
    if (!this.isFrozen) {
      // Step Cannon world using scaled delta time
      const scaledDt = deltaTime * this.timeScale;
      this.world.step(this.fixedTimeStep, scaledDt, this.maxSubSteps);
    }

    // Synchronize Three.js visual meshes with Cannon.js rigid body positions
    for (let i = 0; i < this.physicsObjects.length; i++) {
      const obj = this.physicsObjects[i];
      if (obj.mesh && obj.body) {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
      }
    }
  }

  /**
   * Resets all registered physics objects back to their initial states.
   */
  resetAll() {
    for (let i = 0; i < this.physicsObjects.length; i++) {
      const record = this.physicsObjects[i];
      record.body.position.copy(record.initialPosition);
      record.body.quaternion.copy(record.initialQuaternion);
      record.body.velocity.set(0, 0, 0);
      record.body.angularVelocity.set(0, 0, 0);

      // Restore mass
      if (record.isDynamic) {
        record.body.mass = record.initialMass;
        record.body.updateMassProperties();
      }

      // Restore collision & phasing
      record.phasingEnabled = false;
      record.body.collisionResponse = true;
      record.body.wakeUp();

      if (record.mesh) {
        record.mesh.position.copy(record.initialPosition);
        record.mesh.quaternion.copy(record.initialQuaternion);
      }
    }
  }
}
