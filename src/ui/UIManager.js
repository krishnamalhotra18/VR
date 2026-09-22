import * as THREE from 'three';

/**
 * VR 3D UI Manager creating physical 3D control panels, holographic screens, and main menus inside VR.
 */
export class UIManager {
  constructor(scene, physicsManager, gravityCtrl, timeCtrl, phaseCtrl, massCtrl, experimentMgr, audioFX) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.gravityCtrl = gravityCtrl;
    this.timeCtrl = timeCtrl;
    this.phaseCtrl = phaseCtrl;
    this.massCtrl = massCtrl;
    this.experimentMgr = experimentMgr;
    this.audioFX = audioFX;

    this.interactableMeshes = [];
    this.experimentCounter = 1;

    // Holographic Telemetry Screen Canvas & Texture
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d');

    this.telemetryTexture = new THREE.CanvasTexture(this.canvas);

    this.buildConsoleUI();
    this.buildHolographicLogScreen();
    this.updateLogDisplay();
  }

  getInteractableMeshes() {
    return this.interactableMeshes;
  }

  buildConsoleUI() {
    // Console Base Box (Wider board so ALL buttons fit completely without clipping)
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(0, 1.05, -1.9);
    consoleGroup.rotation.x = -Math.PI / 6; // Slanted 30 deg toward player
    this.scene.add(consoleGroup);

    // Frame (Width 3.0m x Height 1.1m)
    const baseGeo = new THREE.BoxGeometry(3.0, 1.1, 0.1);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    consoleGroup.add(baseMesh);

    // Border Neon Rim
    const borderGeo = new THREE.BoxGeometry(3.06, 1.16, 0.08);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.z = -0.02;
    consoleGroup.add(borderMesh);

    // Keyboard ENTER Key Listener
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (this.audioFX) this.audioFX.playButtonClick();
        this.logChange('ENTER KEY PRESSED: EXECUTED EXPERIMENT TRIGGER');
        this.experimentMgr.nextChallenge();
      }
    });

    // Create 5 Columns x 4 Rows of 3D Interactive Buttons
    const colX = [-1.15, -0.58, 0.0, 0.58, 1.15];
    const btnW = 0.46;
    const btnH = 0.14;

    // Row 1 (y = 0.38): Gravity Controls
    this.create3DButton(consoleGroup, colX[0], 0.38, btnW, btnH, 'GRAV: NORM', 0x0284c7, () => {
      this.gravityCtrl.setMode('NORMAL');
      this.logChange('Gravity: NORMAL (DOWN -9.8 m/s²)');
    });

    this.create3DButton(consoleGroup, colX[1], 0.38, btnW, btnH, 'GRAV: REV', 0x0284c7, () => {
      this.gravityCtrl.setMode('REVERSE');
      this.logChange('Gravity: REVERSE (UP +9.8 m/s²)');
    });

    this.create3DButton(consoleGroup, colX[2], 0.38, btnW, btnH, 'GRAV: UP ▲', 0x0369a1, () => {
      this.gravityCtrl.setDirection('UP');
      this.logChange('Gravity: DIRECTIONAL (UPWARD)');
    });

    this.create3DButton(consoleGroup, colX[3], 0.38, btnW, btnH, 'GRAV: DOWN ▼', 0x0369a1, () => {
      this.gravityCtrl.setDirection('DOWN');
      this.logChange('Gravity: DIRECTIONAL (DOWNWARD)');
    });

    this.create3DButton(consoleGroup, colX[4], 0.38, btnW, btnH, 'ENTER / APPLY', 0x16a34a, () => {
      if (this.audioFX) this.audioFX.playSuccessChime();
      this.logChange('ENTER / APPLY BUTTON: EXPERIMENT CONFIGURATION CONFIRMED');
    });

    // Row 2 (y = 0.16): Elevation & Time Control
    this.create3DButton(consoleGroup, colX[0], 0.16, btnW, btnH, 'MOVE: UP ▲', 0x14b8a6, () => {
      if (this.vrManager) this.vrManager.moveUpward(0.6);
      this.logChange('Player View: ELEVATED UPWARD');
    });

    this.create3DButton(consoleGroup, colX[1], 0.16, btnW, btnH, 'MOVE: DOWN ▼', 0x14b8a6, () => {
      if (this.vrManager) this.vrManager.moveDownward(0.6);
      this.logChange('Player View: LOWERED DOWNWARD');
    });

    this.create3DButton(consoleGroup, colX[2], 0.16, btnW, btnH, 'GRAV: ZERO', 0x0284c7, () => {
      this.gravityCtrl.setMode('ZERO');
      this.logChange('Gravity: ZERO (0 m/s²)');
    });

    this.create3DButton(consoleGroup, colX[3], 0.16, btnW, btnH, 'TIME: FREEZE', 0x7c3aed, () => {
      this.timeCtrl.toggleFreeze();
      this.logChange(`Time Freeze: ${this.timeCtrl.isFrozen ? 'ACTIVATED' : 'RESUMED'}`);
    });

    this.create3DButton(consoleGroup, colX[4], 0.16, btnW, btnH, 'PHASE MODE', 0xa855f7, () => {
      this.phaseCtrl.togglePhaseMode();
      this.logChange(`Phase Mode: ${this.phaseCtrl.phaseModeActive ? 'ON' : 'OFF'}`);
    });

    // Row 3 (y = -0.06): Time Speeds & Reset
    this.create3DButton(consoleGroup, colX[0], -0.06, btnW, btnH, 'SLOW: 0.25x', 0x6d28d9, () => {
      this.timeCtrl.setTimeScale(0.25);
      this.logChange('Time Dilation: 0.25x');
    });

    this.create3DButton(consoleGroup, colX[1], -0.06, btnW, btnH, 'TIME: 1.0x', 0x6d28d9, () => {
      this.timeCtrl.setTimeScale(1.0);
      this.logChange('Time Speed: 1.0x Normal');
    });

    this.create3DButton(consoleGroup, colX[2], -0.06, btnW, btnH, 'FAST: 2.0x', 0x6d28d9, () => {
      this.timeCtrl.setTimeScale(2.0);
      this.logChange('Time Acceleration: 2.0x');
    });

    this.create3DButton(consoleGroup, colX[3], -0.06, btnW, btnH, 'FAST: 5.0x', 0x6d28d9, () => {
      this.timeCtrl.setTimeScale(5.0);
      this.logChange('Time Acceleration: 5.0x');
    });

    this.create3DButton(consoleGroup, colX[4], -0.06, btnW, btnH, 'RESET LAB', 0xe11d48, () => {
      this.triggerReset();
    });

    // Row 4 (y = -0.28): Mass & Modes
    this.create3DButton(consoleGroup, colX[0], -0.28, btnW, btnH, 'MASS: 0.1kg', 0x059669, () => {
      this.massCtrl.setMass(0.1);
      this.logChange('Mass Alteration: 0.1 kg (Light)');
    });

    this.create3DButton(consoleGroup, colX[1], -0.28, btnW, btnH, 'MASS: 10kg', 0x059669, () => {
      this.massCtrl.setMass(10.0);
      this.logChange('Mass Alteration: 10 kg (Medium)');
    });

    this.create3DButton(consoleGroup, colX[2], -0.28, btnW, btnH, 'MASS: 100kg', 0x059669, () => {
      this.massCtrl.setMass(100.0);
      this.logChange('Mass Alteration: 100 kg (Heavy)');
    });

    this.create3DButton(consoleGroup, colX[3], -0.28, btnW, btnH, 'NEXT PUZZLE', 0xd97706, () => {
      this.experimentMgr.nextChallenge();
      this.logChange(`Started ${this.experimentMgr.getCurrentChallengeName()}`);
    });

    this.create3DButton(consoleGroup, colX[4], -0.28, btnW, btnH, 'MODE: SANDBOX', 0x2563eb, () => {
      this.experimentMgr.setMode('SANDBOX');
      this.logChange('Active Mode: SANDBOX');
    });
  }

  create3DButton(parentGroup, x, y, width, height, textLabel, hexColor, onClick) {
    const btnGeo = new THREE.BoxGeometry(width, height, 0.04);
    const btnMat = new THREE.MeshStandardMaterial({
      color: hexColor,
      metalness: 0.5,
      roughness: 0.4,
      emissive: hexColor,
      emissiveIntensity: 0.2
    });
    const btnMesh = new THREE.Mesh(btnGeo, btnMat);
    btnMesh.position.set(x, y, 0.06);
    parentGroup.add(btnMesh);

    // Canvas texture for 3D button label
    const btnCanvas = document.createElement('canvas');
    btnCanvas.width = 256;
    btnCanvas.height = 64;
    const ctx = btnCanvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(textLabel, 128, 32);

    const labelTex = new THREE.CanvasTexture(btnCanvas);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex });
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.95, height * 0.95), labelMat);
    labelMesh.position.set(x, y, 0.085);
    parentGroup.add(labelMesh);

    // Store callback & meshes for raycasting
    btnMesh.userData = {
      onClick: () => {
        if (this.audioFX) this.audioFX.playButtonClick();
        // Visual press pulse animation
        btnMesh.position.z = 0.04;
        setTimeout(() => { btnMesh.position.z = 0.06; }, 100);
        onClick();
      }
    };
    labelMesh.userData = btnMesh.userData;

    this.interactableMeshes.push(btnMesh, labelMesh);
  }

  buildHolographicLogScreen() {
    const screenGeo = new THREE.PlaneGeometry(3.6, 1.8);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.telemetryTexture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });

    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 2.5, -2.48); // Hanging right above central workbench
    this.scene.add(screenMesh);

    // Glowing frame
    const frameGeo = new THREE.BoxGeometry(3.68, 1.88, 0.02);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(0, 2.5, -2.5);
    this.scene.add(frameMesh);
  }

  logChange(actionText) {
    this.experimentCounter++;
    this.updateLogDisplay(actionText);
  }

  updateLogDisplay(lastAction = 'Initial System Readiness') {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 1024, 512);

    // Sci-Fi Holographic Glass Panel Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(0, 0, 1024, 512);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 1004, 492);

    // Header Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.fillText(`REALITY BREAKER // TELEMETRY LOG #${String(this.experimentCounter).padStart(3, '0')}`, 40, 55);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 75);
    ctx.lineTo(980, 75);
    ctx.stroke();

    // Physics Configuration Table
    ctx.font = '24px "Segoe UI", sans-serif';
    ctx.fillStyle = '#93c5fd';

    const col1X = 50;
    const col2X = 530;

    // Left Column
    ctx.fillText(`GRAVITY MODE:`, col1X, 130);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${this.gravityCtrl.mode} (${this.gravityCtrl.strength.toFixed(1)} m/s²)`, col1X + 210, 130);

    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`TIME DILATION:`, col1X, 180);
    ctx.fillStyle = this.timeCtrl.isFrozen ? '#f43f5e' : '#38bdf8';
    ctx.fillText(`${this.timeCtrl.isFrozen ? 'FROZEN (0.0x)' : this.timeCtrl.timeScale + 'x Speed'}`, col1X + 210, 180);

    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`OBJECT MASS:`, col1X, 230);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${this.massCtrl.currentMassPreset} kg`, col1X + 210, 230);

    // Right Column
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`PHASE MODE:`, col2X, 130);
    ctx.fillStyle = this.phaseCtrl.phaseModeActive ? '#a855f7' : '#64748b';
    ctx.fillText(`${this.phaseCtrl.phaseModeActive ? 'ACTIVE (GHOSTING)' : 'DISABLED (COLLIDE)'}`, col2X + 200, 130);

    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`SIM MODE:`, col2X, 180);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`${this.experimentMgr.activeMode}`, col2X + 200, 180);

    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`CURRENT TASK:`, col2X, 230);
    ctx.fillStyle = '#10b981';
    ctx.fillText(`${this.experimentMgr.getCurrentChallengeName()}`, col2X + 200, 230);

    // Bottom Action Log Banner
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(40, 290, 944, 170);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(40, 290, 944, 170);

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'italic bold 24px sans-serif';
    ctx.fillText(`LAST PARAMETER MODIFICATION:`, 60, 335);

    ctx.fillStyle = '#4ade80';
    ctx.font = '26px "Courier New", monospace';
    ctx.fillText(`> ${lastAction}`, 60, 385);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px sans-serif';
    ctx.fillText(`STATUS: LABORATORY PHYSICS STABLE // READY FOR PLAYER INTERACTION`, 60, 435);

    this.telemetryTexture.needsUpdate = true;
  }

  triggerReset() {
    this.gravityCtrl.reset();
    this.timeCtrl.reset();
    this.phaseCtrl.reset();
    this.massCtrl.reset();
    this.physicsManager.resetAll();
    this.experimentMgr.reset();

    if (this.audioFX) this.audioFX.playButtonClick();
    this.logChange('LAB RESET: ALL PHYSICS RESTORED TO DEFAULT');
  }

  update() {
    // Dynamic holographic pulsing if needed
  }
}
