/**
 * Mass Controller dynamically alters physical mass of experimental objects in real-time.
 */
export class MassController {
  constructor(physicsManager, audioFX) {
    this.physicsManager = physicsManager;
    this.audioFX = audioFX;
    this.currentMassPreset = 1.0; // kg
    this.targetRecord = null;
  }

  setMass(massValue, record = null) {
    const newMass = Math.max(0.01, Math.min(500, massValue));
    this.currentMassPreset = newMass;

    const targets = record ? [record] : this.physicsManager.physicsObjects.filter(r => r.isDynamic);

    for (let item of targets) {
      if (item.body && item.isDynamic) {
        item.body.mass = newMass;
        item.body.updateMassProperties();
        item.body.wakeUp();

        // Visual density feedback
        if (item.mesh) {
          const densityRatio = Math.log10(newMass + 0.9);
          if (item.mesh.material && item.mesh.material.color) {
            // High mass = deep tungsten metallic, low mass = light neon cyan
            if (newMass >= 50) {
              item.mesh.material.roughness = 0.2;
              item.mesh.material.metalness = 0.9;
            } else if (newMass <= 0.5) {
              item.mesh.material.roughness = 0.8;
              item.mesh.material.metalness = 0.1;
            }
          }
        }
      }
    }

    if (this.audioFX) {
      this.audioFX.playMassChangeSound(newMass);
    }
  }

  reset() {
    this.currentMassPreset = 1.0;
    for (let record of this.physicsManager.physicsObjects) {
      if (record.isDynamic && record.body) {
        record.body.mass = record.initialMass || 1.0;
        record.body.updateMassProperties();
        record.body.wakeUp();
      }
    }
  }
}
