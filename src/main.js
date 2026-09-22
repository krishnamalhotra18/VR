import * as THREE from 'three';
import { PhysicsManager } from './physics/PhysicsManager.js';
import { GravityController } from './physics/GravityController.js';
import { TimeController } from './physics/TimeController.js';
import { PhaseController } from './physics/PhaseController.js';
import { MassController } from './physics/MassController.js';
import { AudioFX } from './audio/AudioFX.js';
import { LabEnvironment } from './environment/LabEnvironment.js';
import { ObjectInteraction } from './objects/ObjectInteraction.js';
import { VRInteractionManager } from './vr/VRInteractionManager.js';
import { UIManager } from './ui/UIManager.js';
import { ExperimentManager } from './challenges/ExperimentManager.js';

class RealityBreakerApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Three.js Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712);
    this.scene.fog = new THREE.FogExp2(0x030712, 0.035);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 2. Audio System
    this.audioFX = new AudioFX();

    // 3. Physics Engine Core
    this.physicsManager = new PhysicsManager();
    this.gravityCtrl = new GravityController(this.physicsManager);
    this.timeCtrl = new TimeController(this.physicsManager, this.audioFX);
    this.phaseCtrl = new PhaseController(this.physicsManager, this.audioFX);
    this.massCtrl = new MassController(this.physicsManager, this.audioFX);

    // 4. Lab Environment & Interactive Test Objects
    this.environment = new LabEnvironment(this.scene, this.physicsManager);
    this.environment.buildEnvironment();

    this.objectInteraction = new ObjectInteraction(this.scene, this.physicsManager);
    this.objectInteraction.createLabObjects();

    // 5. Challenges & Telemetry
    this.experimentMgr = new ExperimentManager(this.objectInteraction, this.audioFX);

    // 6. 3D Control Console UI & Hologram Screen
    this.uiManager = new UIManager(
      this.scene,
      this.physicsManager,
      this.gravityCtrl,
      this.timeCtrl,
      this.phaseCtrl,
      this.massCtrl,
      this.experimentMgr,
      this.audioFX
    );
    this.experimentMgr.setUIManager(this.uiManager);

    // 7. VR & Locomotion Controls
    this.vrManager = new VRInteractionManager(
      this.renderer,
      this.scene,
      this.camera,
      this.physicsManager,
      this.audioFX
    );
    this.vrManager.setUIManager(this.uiManager);
    this.uiManager.vrManager = this.vrManager;

    // Setup WebXR Session Button
    this.setupWebXRButton();

    // Resize Handler
    window.addEventListener('resize', () => this.onWindowResize());

    // Clock
    this.clock = new THREE.Clock();

    // Start WebXR render loop
    this.renderer.setAnimationLoop((time, frame) => this.render(time, frame));
  }

  setupWebXRButton() {
    const vrContainer = document.getElementById('vr-button-container');
    const desktopHud = document.getElementById('desktop-hud');

    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          const btn = document.createElement('button');
          btn.id = 'xr-enter-btn';
          btn.textContent = 'ENTER VR LABORATORY';
          btn.style.cssText = `
            padding: 14px 26px;
            background: linear-gradient(135deg, #0284c7, #38bdf8);
            color: #ffffff;
            border: none;
            border-radius: 10px;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(56, 189, 248, 0.45);
            letter-spacing: 1px;
            transition: all 0.2s ease;
          `;

          btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px) scale(1.03)';
            btn.style.boxShadow = '0 6px 25px rgba(56, 189, 248, 0.65)';
          });
          btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0) scale(1)';
            btn.style.boxShadow = '0 4px 20px rgba(56, 189, 248, 0.45)';
          });

          btn.onclick = async () => {
            if (this.currentSession) {
              await this.currentSession.end();
              return;
            }

            this.audioFX.init();
            try {
              const session = await navigator.xr.requestSession('immersive-vr', {
                optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
              });

              this.currentSession = session;
              btn.textContent = 'EXIT VR';
              btn.style.background = 'linear-gradient(135deg, #e11d48, #f43f5e)';
              if (desktopHud) desktopHud.style.display = 'none';

              session.addEventListener('end', () => {
                this.currentSession = null;
                btn.textContent = 'ENTER VR LABORATORY';
                btn.style.background = 'linear-gradient(135deg, #0284c7, #38bdf8)';
                if (desktopHud) desktopHud.style.display = 'block';
              });

              await this.renderer.xr.setSession(session);
            } catch (err) {
              console.error('WebXR session initialization failed:', err);
              btn.textContent = 'VR INIT FAILED (RETRY)';
              setTimeout(() => {
                btn.textContent = 'ENTER VR LABORATORY';
              }, 3000);
            }
          };

          vrContainer.appendChild(btn);
        } else {
          this.showDesktopModeBadge(vrContainer);
        }
      }).catch(() => {
        this.showDesktopModeBadge(vrContainer);
      });
    } else {
      this.showDesktopModeBadge(vrContainer);
    }
  }

  showDesktopModeBadge(container) {
    if (!container) return;
    const badge = document.createElement('div');
    badge.textContent = '🖥️ Desktop Mode (Open in Meta Quest 3S for VR)';
    badge.style.cssText = `
      padding: 10px 16px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 8px;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
      backdrop-filter: blur(8px);
    `;
    container.appendChild(badge);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(time, frame) {
    const deltaTime = Math.min(0.1, this.clock.getDelta());

    // Step physics & update mesh transforms
    this.physicsManager.update(deltaTime);

    // Update object interaction (lines, constraints)
    this.objectInteraction.update();

    // Update VR controllers & desktop WASD movement
    this.vrManager.update(deltaTime);

    // Evaluate puzzle completion state
    this.experimentMgr.update();

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  new RealityBreakerApp();
});
