import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * VR & Desktop Interaction Manager.
 * Supports WebXR controllers, smooth locomotion, snap turn, physics grabbing/throwing,
 * and desktop WASD + Mouse look fallback controls.
 */
export class VRInteractionManager {
  constructor(renderer, scene, camera, physicsManager, audioFX) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.physicsManager = physicsManager;
    this.audioFX = audioFX;

    // Player Camera Rig Container
    this.dolly = new THREE.Group();
    this.dolly.position.set(0, 0, 0.5);
    this.dolly.add(this.camera);
    this.scene.add(this.dolly);

    // VR Controllers
    this.controllers = [];
    this.controllerGrips = [];

    // Raycaster for pointers
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();

    // Grabbing state (VR & Desktop)
    this.grabbedObject = null; // { record, constraint/joint, distance, initialRot }
    this.vrGrabbedObjects = new Map(); // controllerIndex -> { record, distance }

    // Locomotion & Comfort settings
    this.moveSpeed = 2.5; // m/s
    this.snapTurnAngle = Math.PI / 4; // 45 deg
    this.canSnapTurn = true;
    this.canElevate = true;

    // Desktop Controls State
    this.isPointerLocked = false;
    this.keysPressed = {};
    this.pitch = 0;
    this.yaw = 0;
    this.grabDistance = 2.0;

    // Desktop Crosshair element
    this.crosshairEl = document.getElementById('crosshair');

    this.setupXR();
    this.setupDesktopControls();
  }

  setupXR() {
    if (!this.renderer.xr) return;
    this.renderer.xr.enabled = true;

    // Build VR controller rays and grips for controller 0 and controller 1
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('selectstart', (e) => this.onVRSelectStart(e, i));
      controller.addEventListener('selectend', (e) => this.onVRSelectEnd(e, i));
      controller.addEventListener('squeezestart', (e) => this.onVRSqueezeStart(e, i));
      controller.addEventListener('squeezeend', (e) => this.onVRSqueezeEnd(e, i));
      controller.addEventListener('connected', (e) => {
        controller.userData.inputSource = e.data;
      });
      controller.addEventListener('disconnected', () => {
        controller.userData.inputSource = null;
      });
      this.dolly.add(controller);
      this.controllers.push(controller);

      // Controller Ray Visual Beam
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -4)
      ]);
      const rayMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });
      const rayLine = new THREE.Line(rayGeo, rayMat);
      rayLine.name = 'ray';
      controller.add(rayLine);

      // Controller Grip & Sleek 3D Visual Mesh
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(this.createGripVisual());
      this.dolly.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  createGripVisual() {
    const group = new THREE.Group();
    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.12, 16);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = -Math.PI / 4;
    handle.position.set(0, -0.02, 0.03);
    group.add(handle);

    // Glowing emitter ring
    const ringGeo = new THREE.TorusGeometry(0.035, 0.005, 12, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      metalness: 0.8,
      roughness: 0.2
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 4;
    ring.position.set(0, 0.01, -0.02);
    group.add(ring);

    // Tip emitter
    const tipGeo = new THREE.SphereGeometry(0.008, 12, 12);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, 0.005, -0.04);
    group.add(tip);

    return group;
  }

  triggerHaptic(controllerIndex, intensity = 0.5, duration = 40) {
    const controller = this.controllers[controllerIndex];
    if (!controller) return;
    const inputSource = controller.userData.inputSource;
    if (inputSource?.gamepad?.hapticActuators && inputSource.gamepad.hapticActuators.length > 0) {
      inputSource.gamepad.hapticActuators[0].pulse(intensity, duration).catch(() => {});
    }
  }

  setupDesktopControls() {
    const canvas = this.renderer.domElement;

    // Pointer Lock on click
    canvas.addEventListener('click', () => {
      if (!this.renderer.xr.isPresenting && !this.isPointerLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    // Mouse Move (Look)
    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;
      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));

      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.x = this.pitch;
      euler.y = this.yaw;
      this.camera.quaternion.setFromEuler(euler);
    });

    // Keyboard Movement
    window.addEventListener('keydown', (e) => {
      this.keysPressed[e.code] = true;

      // Distance adjust for desktop grab
      if (e.code === 'KeyE') this.grabDistance = Math.min(5.0, this.grabDistance + 0.2);
      if (e.code === 'KeyQ') this.grabDistance = Math.max(0.8, this.grabDistance - 0.2);
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.code] = false;
    });

    // Mouse Buttons (Grab / Throw / UI Click)
    document.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;

      if (e.button === 0) { // Left Click: Grab / Interact
        this.desktopHandleInteractOrGrab();
      } else if (e.button === 2) { // Right Click: Throw Grabbed Object
        this.desktopThrowObject();
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.grabbedObject) {
        this.releaseDesktopGrab();
      }
    });

    // Scroll Wheel adjusts distance
    document.addEventListener('wheel', (e) => {
      if (this.grabbedObject) {
        this.grabDistance += e.deltaY * -0.0015;
        this.grabDistance = Math.max(0.8, Math.min(5.0, this.grabDistance));
      }
    });
  }

  desktopHandleInteractOrGrab() {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    
    // Check 3D UI buttons / interactive objects
    const interactables = [];
    if (this.uiManager) interactables.push(...this.uiManager.getInteractableMeshes());

    const intersects = this.raycaster.intersectObjects(interactables, true);
    if (intersects.length > 0) {
      const target = intersects[0].object;
      if (target.userData && target.userData.onClick) {
        target.userData.onClick();
        return;
      }
    }

    // Check grabbable physics objects
    const physicsMeshes = this.physicsManager.physicsObjects.map(r => r.mesh).filter(Boolean);
    const objectHits = this.raycaster.intersectObjects(physicsMeshes, true);

    if (objectHits.length > 0) {
      const hitMesh = objectHits[0].object;
      const record = this.physicsManager.physicsObjects.find(r => r.mesh === hitMesh || r.mesh === hitMesh.parent);

      if (record && record.isDynamic) {
        this.grabbedObject = {
          record,
          distance: objectHits[0].distance,
          prevPos: record.body.position.clone(),
          lastTime: performance.now()
        };
        this.grabDistance = objectHits[0].distance;
        if (this.audioFX) this.audioFX.playGrabSound();
        if (this.crosshairEl) this.crosshairEl.classList.add('active');
      }
    }
  }

  releaseDesktopGrab() {
    if (!this.grabbedObject) return;
    if (this.audioFX) this.audioFX.playReleaseSound();
    this.grabbedObject = null;
    if (this.crosshairEl) this.crosshairEl.classList.remove('active');
  }

  desktopThrowObject() {
    if (!this.grabbedObject) return;
    const record = this.grabbedObject.record;
    
    // Calculate throwing direction vector from camera direction
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    
    // Mass-dependent throwing impulse factor
    const throwFactor = Math.max(4.0, 18.0 / Math.sqrt(record.body.mass));
    const impulse = forward.multiplyScalar(throwFactor);

    record.body.velocity.set(impulse.x, impulse.y, impulse.z);
    record.body.wakeUp();

    if (this.audioFX) this.audioFX.playReleaseSound();
    this.grabbedObject = null;
    if (this.crosshairEl) this.crosshairEl.classList.remove('active');
  }

  // WebXR Event Handlers
  onVRSelectStart(event, controllerIndex) {
    const controller = this.controllers[controllerIndex];
    if (!controller) return;

    // Raycast UI buttons or physics objects
    const rayMatrix = new THREE.Matrix4().extractRotation(controller.matrixWorld);
    const rayDir = new THREE.Vector3(0, 0, -1).applyMatrix4(rayMatrix);
    const rayOrigin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);

    this.raycaster.set(rayOrigin, rayDir);

    // UI Click
    if (this.uiManager) {
      const uiHits = this.raycaster.intersectObjects(this.uiManager.getInteractableMeshes(), true);
      if (uiHits.length > 0 && uiHits[0].object.userData.onClick) {
        this.triggerHaptic(controllerIndex, 0.8, 50);
        uiHits[0].object.userData.onClick();
        return;
      }
    }

    // VR Grab
    const physicsMeshes = this.physicsManager.physicsObjects.map(r => r.mesh).filter(Boolean);
    const hits = this.raycaster.intersectObjects(physicsMeshes, true);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const record = this.physicsManager.physicsObjects.find(r => r.mesh === hitMesh || r.mesh === hitMesh.parent);

      if (record && record.isDynamic) {
        this.triggerHaptic(controllerIndex, 0.6, 45);
        this.vrGrabbedObjects.set(controllerIndex, {
          record,
          distance: hits[0].distance,
          prevControllerPos: rayOrigin.clone(),
          lastTime: performance.now(),
          velocity: new THREE.Vector3()
        });
        if (this.audioFX) this.audioFX.playGrabSound();
      }
    }
  }

  onVRSelectEnd(event, controllerIndex) {
    const grabInfo = this.vrGrabbedObjects.get(controllerIndex);
    if (grabInfo) {
      this.triggerHaptic(controllerIndex, 0.35, 30);
      // Apply release throwing velocity
      const body = grabInfo.record.body;
      body.velocity.set(grabInfo.velocity.x, grabInfo.velocity.y, grabInfo.velocity.z);
      body.wakeUp();

      if (this.audioFX) this.audioFX.playReleaseSound();
      this.vrGrabbedObjects.delete(controllerIndex);
    }
  }

  onVRSqueezeStart(event, controllerIndex) {
    this.onVRSelectStart(event, controllerIndex);
  }

  onVRSqueezeEnd(event, controllerIndex) {
    this.onVRSelectEnd(event, controllerIndex);
  }

  update(deltaTime) {
    this.updateDesktopMovement(deltaTime);
    this.updateVRControllers(deltaTime);
  }

  updateDesktopMovement(deltaTime) {
    if (!this.isPointerLocked) return;

    // Movement direction relative to camera yaw
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const moveDir = new THREE.Vector3(0, 0, 0);

    if (this.keysPressed['KeyW']) moveDir.add(forward);
    if (this.keysPressed['KeyS']) moveDir.sub(forward);
    if (this.keysPressed['KeyD']) moveDir.add(right);
    if (this.keysPressed['KeyA']) moveDir.sub(right);

    // Upward and Downward flying/movement
    if (this.keysPressed['Space']) moveDir.y += 1.0;
    if (this.keysPressed['ShiftLeft'] || this.keysPressed['KeyC']) moveDir.y -= 1.0;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.dolly.position.addScaledVector(moveDir, this.moveSpeed * deltaTime);
      // Bound dolly height to room ceiling
      this.dolly.position.y = Math.max(0.0, Math.min(5.2, this.dolly.position.y));
    }

    // Synchronize Desktop Grabbed Object position to camera crosshair center
    if (this.grabbedObject) {
      const record = this.grabbedObject.record;
      const targetPos = new THREE.Vector3();
      this.camera.getWorldPosition(targetPos);
      
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      targetPos.addScaledVector(dir, this.grabDistance);

      // Smooth kinematic velocity spring toward target position
      const body = record.body;
      const velocityVec = targetPos.clone().sub(new THREE.Vector3(body.position.x, body.position.y, body.position.z)).multiplyScalar(15.0);
      
      body.velocity.set(velocityVec.x, velocityVec.y, velocityVec.z);
      body.wakeUp();
    }
  }

  updateVRControllers(deltaTime) {
    if (!this.renderer.xr || !this.renderer.xr.isPresenting) return;

    const session = this.renderer.xr.getSession();
    if (!session) return;

    // VR Controllers Thumbstick Locomotion & Snap Turn
    this.controllers.forEach((controller, idx) => {
      const grabInfo = this.vrGrabbedObjects.get(idx);
      if (grabInfo) {
        const rayOrigin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
        const rayMatrix = new THREE.Matrix4().extractRotation(controller.matrixWorld);
        const rayDir = new THREE.Vector3(0, 0, -1).applyMatrix4(rayMatrix);
        
        const targetPos = rayOrigin.clone().addScaledVector(rayDir, grabInfo.distance);
        const body = grabInfo.record.body;

        // Calculate throwing velocity based on controller delta position
        const dt = Math.max(0.001, (performance.now() - grabInfo.lastTime) / 1000);
        grabInfo.velocity.copy(targetPos).sub(new THREE.Vector3(body.position.x, body.position.y, body.position.z)).divideScalar(dt);
        grabInfo.lastTime = performance.now();

        body.velocity.set(grabInfo.velocity.x, grabInfo.velocity.y, grabInfo.velocity.z);
        body.wakeUp();
      }

      // Input source thumbsticks & buttons
      const inputSource = controller.userData.inputSource;
      if (inputSource && inputSource.gamepad) {
        const gamepad = inputSource.gamepad;
        const handedness = inputSource.handedness || (idx === 0 ? 'left' : 'right');

        if (gamepad.axes && gamepad.axes.length >= 2) {
          // Meta Quest Touch: axes[2] is X, axes[3] is Y (or axes[0], axes[1] if only 2 axes)
          const axisX = gamepad.axes.length >= 4 ? gamepad.axes[2] : gamepad.axes[0];
          const axisY = gamepad.axes.length >= 4 ? gamepad.axes[3] : gamepad.axes[1];

          // Left Controller: Locomotion (relative to player head gaze)
          if (handedness === 'left' && (Math.abs(axisX) > 0.12 || Math.abs(axisY) > 0.12)) {
            const camDirection = new THREE.Vector3();
            this.camera.getWorldDirection(camDirection);
            camDirection.y = 0;
            camDirection.normalize();

            const camRight = new THREE.Vector3().crossVectors(camDirection, new THREE.Vector3(0, 1, 0)).negate();

            const move = new THREE.Vector3()
              .addScaledVector(camDirection, -axisY * this.moveSpeed * deltaTime)
              .addScaledVector(camRight, axisX * this.moveSpeed * deltaTime);

            this.dolly.position.add(move);
          }

          // Right Controller: Snap Turning & Elevation
          if (handedness === 'right') {
            // Horizontal Snap Turn
            if (Math.abs(axisX) > 0.65 && this.canSnapTurn) {
              const turnDir = axisX > 0 ? -1 : 1;
              this.dolly.rotation.y += turnDir * this.snapTurnAngle;
              this.canSnapTurn = false;
              this.triggerHaptic(idx, 0.2, 20);
            } else if (Math.abs(axisX) < 0.25) {
              this.canSnapTurn = true;
            }

            // Vertical Elevation (Up / Down)
            if (axisY < -0.75 && this.canElevate) {
              this.moveUpward(0.5);
              this.canElevate = false;
              this.triggerHaptic(idx, 0.2, 20);
            } else if (axisY > 0.75 && this.canElevate) {
              this.moveDownward(0.5);
              this.canElevate = false;
              this.triggerHaptic(idx, 0.2, 20);
            } else if (Math.abs(axisY) < 0.3) {
              this.canElevate = true;
            }
          }
        }
      }
    });
  }

  moveUpward(amount = 0.6) {
    this.dolly.position.y = Math.min(5.2, this.dolly.position.y + amount);
  }

  moveDownward(amount = 0.6) {
    this.dolly.position.y = Math.max(0.0, this.dolly.position.y - amount);
  }

  setUIManager(uiManager) {
    this.uiManager = uiManager;
  }
}
