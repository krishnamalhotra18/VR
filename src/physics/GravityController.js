import * as CANNON from 'cannon-es';

export const GRAVITY_MODE = {
  NORMAL: 'NORMAL',
  REVERSE: 'REVERSE',
  ZERO: 'ZERO',
  DIRECTIONAL: 'DIRECTIONAL'
};

export const GRAVITY_DIRECTION = {
  UP: new CANNON.Vec3(0, 1, 0),
  DOWN: new CANNON.Vec3(0, -1, 0),
  LEFT: new CANNON.Vec3(-1, 0, 0),
  RIGHT: new CANNON.Vec3(1, 0, 0),
  FORWARD: new CANNON.Vec3(0, 0, -1),
  BACK: new CANNON.Vec3(0, 0, 1)
};

/**
 * Controller managing laboratory gravity vectors, modes, and magnitudes.
 */
export class GravityController {
  constructor(physicsManager) {
    this.physicsManager = physicsManager;
    this.mode = GRAVITY_MODE.NORMAL;
    this.strength = 9.81; // m/s^2
    this.customDirectionKey = 'UP';
    this.directionVector = GRAVITY_DIRECTION.DOWN.clone();

    this.applyGravity();
  }

  setMode(mode) {
    if (Object.values(GRAVITY_MODE).includes(mode)) {
      this.mode = mode;
      this.applyGravity();
    }
  }

  setStrength(value) {
    this.strength = Math.max(0, Math.min(30, value));
    this.applyGravity();
  }

  setDirection(directionKey) {
    if (GRAVITY_DIRECTION[directionKey]) {
      this.customDirectionKey = directionKey;
      this.mode = GRAVITY_MODE.DIRECTIONAL;
      this.applyGravity();
    }
  }

  applyGravity() {
    let targetVec = new CANNON.Vec3(0, -this.strength, 0);

    switch (this.mode) {
      case GRAVITY_MODE.NORMAL:
        targetVec.set(0, -this.strength, 0);
        break;
      case GRAVITY_MODE.REVERSE:
        targetVec.set(0, this.strength, 0);
        break;
      case GRAVITY_MODE.ZERO:
        targetVec.set(0, 0, 0);
        break;
      case GRAVITY_MODE.DIRECTIONAL:
        const dir = GRAVITY_DIRECTION[this.customDirectionKey] || GRAVITY_DIRECTION.UP;
        targetVec.copy(dir).scale(this.strength, targetVec);
        break;
    }

    this.directionVector.copy(targetVec);
    this.physicsManager.world.gravity.copy(targetVec);

    // Wake up sleeping bodies so new gravity takes immediate effect
    for (let record of this.physicsManager.physicsObjects) {
      if (record.body) {
        record.body.wakeUp();
      }
    }
  }

  reset() {
    this.mode = GRAVITY_MODE.NORMAL;
    this.strength = 9.81;
    this.customDirectionKey = 'UP';
    this.applyGravity();
  }
}
