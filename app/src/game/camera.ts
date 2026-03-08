import * as THREE from 'three';
import { CAMERA, BOARD } from './config';
import type { CameraQuarter } from './types';

/**
 * Isometric camera rig with Q/E quarter-turn rotation, zoom, and pan.
 * Uses OrthographicCamera for true isometric projection.
 */
export class IsometricCamera {
  readonly camera: THREE.OrthographicCamera;
  private targetQuarter: CameraQuarter = 0;
  private currentAngle = 0; // radians around Y axis
  private targetAngle = 0;
  private zoom: number = CAMERA.ZOOM;

  /** Pan offset in world space */
  private panOffset = new THREE.Vector3(0, 0, 0);

  /** Center of the board (camera looks at this point + panOffset) */
  private readonly center = new THREE.Vector3(0, 0, 0);

  constructor(aspect: number) {
    const f = CAMERA.FRUSTUM_SIZE;
    this.camera = new THREE.OrthographicCamera(
      -f * aspect, f * aspect, f, -f, 0.1, 100
    );
    this.currentAngle = 0;
    this.targetAngle = 0;
    this.updateCameraPosition();
  }

  get quarter(): CameraQuarter {
    return this.targetQuarter;
  }

  /** Rotate camera 90° clockwise (E key) */
  rotateCW(): void {
    this.targetQuarter = (((this.targetQuarter as number) + 1) % 4) as CameraQuarter;
    this.targetAngle = this.targetQuarter * (Math.PI / 2);
    // Handle wrap-around for smooth rotation
    while (this.targetAngle - this.currentAngle > Math.PI) {
      this.targetAngle -= Math.PI * 2;
    }
    while (this.currentAngle - this.targetAngle > Math.PI) {
      this.targetAngle += Math.PI * 2;
    }
  }

  /** Rotate camera 90° counter-clockwise (Q key) */
  rotateCCW(): void {
    this.targetQuarter = (((this.targetQuarter as number) + 3) % 4) as CameraQuarter;
    this.targetAngle = this.targetQuarter * (Math.PI / 2);
    while (this.targetAngle - this.currentAngle > Math.PI) {
      this.targetAngle -= Math.PI * 2;
    }
    while (this.currentAngle - this.targetAngle > Math.PI) {
      this.targetAngle += Math.PI * 2;
    }
  }

  /** Apply zoom delta (mouse wheel) */
  applyZoom(delta: number): void {
    this.zoom = THREE.MathUtils.clamp(
      this.zoom - delta * 0.001,
      CAMERA.MIN_ZOOM,
      CAMERA.MAX_ZOOM
    );
  }

  /** Apply pan offset (middle mouse drag) */
  applyPan(dx: number, dy: number): void {
    // Pan relative to current camera orientation
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    this.camera.getWorldDirection(new THREE.Vector3());
    right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    up.setFromMatrixColumn(this.camera.matrixWorld, 1);

    this.panOffset.addScaledVector(right, -dx * CAMERA.PAN_SPEED);
    this.panOffset.addScaledVector(up, dy * CAMERA.PAN_SPEED);
  }

  /** Reset pan to center */
  resetPan(): void {
    this.panOffset.set(0, 0, 0);
  }

  /** Update camera each frame */
  update(dt: number): void {
    // Smooth rotation
    const rotSpeed = CAMERA.ROTATION_SPEED;
    const t = 1 - Math.exp(-5 * dt / rotSpeed);
    this.currentAngle = THREE.MathUtils.lerp(this.currentAngle, this.targetAngle, t);

    // Snap when very close
    if (Math.abs(this.currentAngle - this.targetAngle) < 0.001) {
      this.currentAngle = this.targetAngle;
    }

    this.updateCameraPosition();
  }

  /** Handle window resize */
  resize(aspect: number): void {
    const f = CAMERA.FRUSTUM_SIZE / this.zoom;
    this.camera.left = -f * aspect;
    this.camera.right = f * aspect;
    this.camera.top = f;
    this.camera.bottom = -f;
    this.camera.updateProjectionMatrix();
  }

  private updateCameraPosition(): void {
    const dist = CAMERA.DISTANCE;
    const isoAngle = CAMERA.ISO_ANGLE;

    // Position on a circle around Y axis at isometric elevation
    const x = Math.sin(this.currentAngle) * Math.cos(isoAngle) * dist;
    const y = Math.sin(isoAngle) * dist;
    const z = Math.cos(this.currentAngle) * Math.cos(isoAngle) * dist;

    const lookAt = this.center.clone().add(this.panOffset);

    this.camera.position.set(
      lookAt.x + x,
      lookAt.y + y,
      lookAt.z + z
    );

    // Update frustum for zoom
    const f = CAMERA.FRUSTUM_SIZE / this.zoom;
    const aspect = this.camera.right !== 0
      ? (this.camera.right / (CAMERA.FRUSTUM_SIZE / this.zoom) || 1)
      : 1;
    // Recalculate with current zoom
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = w / h;
    this.camera.left = -f * a;
    this.camera.right = f * a;
    this.camera.top = f;
    this.camera.bottom = -f;

    this.camera.lookAt(lookAt);
    this.camera.updateProjectionMatrix();
  }
}
