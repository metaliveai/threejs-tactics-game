import * as THREE from 'three';
import type { IsometricCamera } from './camera';

export type InputAction =
  | { type: 'click'; mouse: THREE.Vector2 }
  | { type: 'rotate_cw' }
  | { type: 'rotate_ccw' }
  | { type: 'deselect' }
  | { type: 'zoom'; delta: number }
  | { type: 'pan'; dx: number; dy: number };

type InputHandler = (action: InputAction) => void;

/**
 * Input routing — translates DOM events into game actions.
 * click → raycast → tile
 * Q/E → camera rotation
 * Esc → deselect
 * Wheel → zoom
 * Middle-drag → pan
 */
export class InputManager {
  private handler: InputHandler | null = null;
  private canvas: HTMLCanvasElement;
  private isPanning = false;
  private lastPanX = 0;
  private lastPanY = 0;
  private enabled = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  setHandler(handler: InputHandler): void {
    this.handler = handler;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private emit(action: InputAction): void {
    if (this.enabled && this.handler) {
      this.handler(action);
    }
  }

  private bindEvents(): void {
    // Click
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) { // left click
        const mouse = this.normalizePointer(e);
        this.emit({ type: 'click', mouse });
      } else if (e.button === 1) { // middle click
        this.isPanning = true;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        e.preventDefault();
      }
    });

    // Pan (middle drag)
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastPanX;
        const dy = e.clientY - this.lastPanY;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        this.emit({ type: 'pan', dx, dy });
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (e.button === 1) {
        this.isPanning = false;
      }
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;

      switch (e.key.toLowerCase()) {
        case 'e':
          this.emit({ type: 'rotate_cw' });
          break;
        case 'q':
          this.emit({ type: 'rotate_ccw' });
          break;
        case 'escape':
          this.emit({ type: 'deselect' });
          break;
      }
    });

    // Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.emit({ type: 'zoom', delta: e.deltaY });
    }, { passive: false });

    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Normalize pointer coordinates to NDC (-1 to 1) */
  private normalizePointer(e: PointerEvent): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  dispose(): void {
    // Events will be GC'd with the canvas
  }
}
