import * as THREE from 'three';

export const CHALLENGES = [
  {
    id: 1,
    name: 'Challenge 1 — Reverse Gravity',
    description: 'Activate Reverse Gravity to send an object to the ceiling platform target.',
    targetIndex: 0
  },
  {
    id: 2,
    name: 'Challenge 2 — Frozen Projectile',
    description: 'Throw an object toward the mid-air target, freeze time mid-flight, then unfreeze.',
    targetIndex: 1
  },
  {
    id: 3,
    name: 'Challenge 3 — Phase Wall',
    description: 'Activate Phase Mode to pass an object through the solid energy wall into the target zone.',
    targetIndex: 2
  },
  {
    id: 4,
    name: 'Challenge 4 — Gravity Direction',
    description: 'Use Directional Gravity controls to route an object into the right chamber target.',
    targetIndex: 3
  },
  {
    id: 5,
    name: 'Challenge 5 — Combined Physics',
    description: 'Combine Reverse Gravity + Slow Motion + Phase Mode + Mass tuning to solve the master puzzle.',
    targetIndex: 4
  }
];

/**
 * Manages Sandbox vs Challenge modes, active puzzle evaluation, and victory triggers.
 */
export class ExperimentManager {
  constructor(objectInteraction, audioFX) {
    this.objectInteraction = objectInteraction;
    this.audioFX = audioFX;

    this.activeMode = 'SANDBOX'; // 'SANDBOX' | 'CHALLENGES'
    this.currentChallengeIdx = 0;
    this.isCompleted = false;
    this.uiManager = null;
  }

  setUIManager(uiManager) {
    this.uiManager = uiManager;
  }

  setMode(mode) {
    this.activeMode = mode;
    this.isCompleted = false;
  }

  nextChallenge() {
    this.activeMode = 'CHALLENGES';
    this.currentChallengeIdx = (this.currentChallengeIdx + 1) % CHALLENGES.length;
    this.isCompleted = false;
  }

  getCurrentChallengeName() {
    if (this.activeMode === 'SANDBOX') return 'Free Sandbox Experimentation';
    return CHALLENGES[this.currentChallengeIdx].name;
  }

  update() {
    if (this.activeMode !== 'CHALLENGES' || this.isCompleted) return;

    const challenge = CHALLENGES[this.currentChallengeIdx];
    const target = this.objectInteraction.targets[challenge.targetIndex];

    if (!target) return;

    // Check if any dynamic test object is inside the target zone
    for (let record of this.objectInteraction.objects) {
      if (record.mesh) {
        const pos = record.mesh.position;
        if (target.checkObjectInside(pos)) {
          this.triggerVictory(challenge);
          break;
        }
      }
    }
  }

  triggerVictory(challenge) {
    this.isCompleted = true;
    if (this.audioFX) this.audioFX.playSuccessChime();

    if (this.uiManager) {
      this.uiManager.logChange(`PUZZLE CLEARED: ${challenge.name}! EXCELLENT SCIENTIFIC TEST.`);
    }
  }

  reset() {
    this.isCompleted = false;
  }
}
