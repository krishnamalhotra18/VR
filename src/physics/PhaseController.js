/**
 * Phase Controller manages object ghosting/collision pass-through (Phase Mode).
 */
export class PhaseController {
  constructor(physicsManager, audioFX) {
    this.physicsManager = physicsManager;
    this.audioFX = audioFX;
    this.phaseModeActive = false;
  }

  togglePhaseMode() {
    this.setPhaseMode(!this.phaseModeActive);
  }

  setPhaseMode(active) {
    this.phaseModeActive = active;

    for (let record of this.physicsManager.physicsObjects) {
      if (record.category === 'phasable' || record.category === 'interactive') {
        this.setObjectPhasing(record, active);
      }
    }

    if (this.audioFX) {
      this.audioFX.playPhaseSound(active);
    }
  }

  setObjectPhasing(record, enable) {
    if (!record || !record.body) return;
    record.phasingEnabled = enable;
    
    if (enable) {
      record.body.collisionResponse = false;
      // Visual feedback: make material translucent with ethereal glow
      if (record.mesh && record.mesh.material) {
        record.mesh.material.transparent = true;
        record.mesh.material.opacity = 0.45;
        if (record.mesh.material.emissive) {
          record.mesh.material.emissive.setHex(0xa855f7); // Purple phase glow
          record.mesh.material.emissiveIntensity = 0.6;
        }
      }
    } else {
      record.body.collisionResponse = true;
      if (record.mesh && record.mesh.material) {
        record.mesh.material.opacity = 1.0;
        record.mesh.material.transparent = false;
        if (record.mesh.material.emissive) {
          record.mesh.material.emissiveIntensity = 0.1;
        }
      }
    }
    record.body.wakeUp();
  }

  reset() {
    this.phaseModeActive = false;
    for (let record of this.physicsManager.physicsObjects) {
      this.setObjectPhasing(record, false);
    }
  }
}
