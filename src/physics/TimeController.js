import * as CANNON from 'cannon-es';

/**
 * Controller for time dilation, time acceleration, and instant time-freeze mechanics.
 */
export class TimeController {
  constructor(physicsManager, audioFX) {
    this.physicsManager = physicsManager;
    this.audioFX = audioFX;
    this.isFrozen = false;
    this.timeScale = 1.0;
  }

  /**
   * Sets simulation speed multiplier (0.1x to 10x).
   */
  setTimeScale(scale) {
    this.timeScale = Math.max(0.1, Math.min(10.0, scale));
    this.physicsManager.setTimeScale(this.timeScale);
    if (this.audioFX) {
      this.audioFX.playTimeDilationSound(this.timeScale);
    }
  }

  /**
   * Toggles or sets global time freeze state.
   */
  toggleFreeze() {
    this.setFreeze(!this.isFrozen);
  }

  setFreeze(freezeState) {
    if (this.isFrozen === freezeState) return;
    this.isFrozen = freezeState;
    this.physicsManager.isFrozen = freezeState;

    if (this.isFrozen) {
      // Save state and freeze all dynamic rigid bodies in place
      for (let record of this.physicsManager.physicsObjects) {
        const body = record.body;
        if (body && record.isDynamic) {
          record.savedLinearVelocity.copy(body.velocity);
          record.savedAngularVelocity.copy(body.angularVelocity);
          
          body.velocity.set(0, 0, 0);
          body.angularVelocity.set(0, 0, 0);
          body.type = CANNON.Body.KINEMATIC; // Prevents gravity or external forces during freeze
          body.wakeUp();
        }
      }
      if (this.audioFX) this.audioFX.playFreezeSound();
    } else {
      // Resume time: restore dynamic body types and cached velocities
      for (let record of this.physicsManager.physicsObjects) {
        const body = record.body;
        if (body && record.isDynamic) {
          body.type = CANNON.Body.DYNAMIC;
          body.velocity.copy(record.savedLinearVelocity);
          body.angularVelocity.copy(record.savedAngularVelocity);
          body.wakeUp();
        }
      }
      if (this.audioFX) this.audioFX.playUnfreezeSound();
    }
  }

  reset() {
    this.isFrozen = false;
    this.timeScale = 1.0;
    this.physicsManager.isFrozen = false;
    this.physicsManager.setTimeScale(1.0);
  }
}
