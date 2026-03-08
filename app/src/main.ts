import * as THREE from 'three';
import { GameScene } from './scenes/gameScene';

/** Entry point — renderer setup, clock, animation loop, resize */
function main(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas #game not found');

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Game scene
  const game = new GameScene(canvas);

  // Clock
  const clock = new THREE.Clock();

  // Animation loop
  function animate(): void {
    const dt = Math.min(clock.getDelta(), 0.1); // Cap delta for tab-away
    game.update(dt);
    renderer.render(game.scene, game.camera);
  }

  renderer.setAnimationLoop(animate);

  // Resize handler
  function onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    game.resize(w, h);
  }

  window.addEventListener('resize', onResize);
}

main();
