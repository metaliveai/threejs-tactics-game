import * as THREE from 'three';
import type { PieceType, ChessSquare, ChessPiece, CameraOctant } from './types';
import { squareToWorld, squareToPos } from './chess';
import { BOARD, PIECES, SPRITES } from './config';
import type { PieceManager } from './pieces';

/**
 * Drama level determines how elaborate the capture sequence is.
 */
export type DramaLevel = 'quick' | 'standard' | 'dramatic';

/**
 * Determine drama level based on attacker and defender piece types.
 */
export function getDramaLevel(attacker: PieceType, defender: PieceType): DramaLevel {
  if (attacker === 'q' || attacker === 'k' || defender === 'q' || defender === 'k') {
    return 'dramatic';
  }
  if (attacker === 'r' || attacker === 'b' || attacker === 'n') {
    return 'standard';
  }
  return 'quick';
}

/** Screen flash overlay */
export class ScreenFlash {
  private overlay: HTMLDivElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; inset: 0; pointer-events: none;
      background: white; opacity: 0; z-index: 100;
      transition: opacity 0.05s linear;
    `;
    document.body.appendChild(this.overlay);
  }

  flash(duration = 0.3): Promise<void> {
    return new Promise(resolve => {
      this.overlay.style.transition = 'opacity 0.05s linear';
      this.overlay.style.opacity = '0.6';
      setTimeout(() => {
        this.overlay.style.transition = `opacity ${duration}s ease-out`;
        this.overlay.style.opacity = '0';
        setTimeout(resolve, duration * 1000);
      }, 50);
    });
  }

  dispose(): void {
    this.overlay.remove();
  }
}

/** Camera shake effect */
export class CameraShake {
  private intensity = 0;
  private decay = 0;
  private offset = new THREE.Vector3();

  start(intensity: number, duration: number): void {
    this.intensity = intensity;
    this.decay = intensity / duration;
  }

  update(dt: number): THREE.Vector3 {
    if (this.intensity <= 0) {
      this.offset.set(0, 0, 0);
      return this.offset;
    }
    this.offset.set(
      (Math.random() - 0.5) * 2 * this.intensity,
      (Math.random() - 0.5) * 2 * this.intensity,
      (Math.random() - 0.5) * 2 * this.intensity,
    );
    this.intensity -= this.decay * dt;
    if (this.intensity < 0) this.intensity = 0;
    return this.offset;
  }

  get isShaking(): boolean {
    return this.intensity > 0;
  }
}

/**
 * Orchestrates capture sequences with drama.
 *
 * All animations are driven through the activeAnimations array (ticked by
 * the game loop) so we never rely on setInterval.
 */
export class Choreographer {
  private flash: ScreenFlash;
  readonly shake: CameraShake;

  constructor() {
    this.flash = new ScreenFlash();
    this.shake = new CameraShake();
  }

  /**
   * Play a capture sequence.
   * The attacker walks to one tile before the target, strikes, then advances.
   */
  async playCaptureSequence(opts: {
    attacker: ChessPiece;
    defender: ChessPiece;
    from: ChessSquare;
    to: ChessSquare;
    dramaLevel: DramaLevel;
    pieceManager: PieceManager;
    cameraOctant: CameraOctant;
    scene: THREE.Scene;
    activeAnimations: { update: (dt: number) => boolean }[];
  }): Promise<void> {
    const {
      attacker, defender, from, to,
      dramaLevel, pieceManager, cameraOctant, scene, activeAnimations,
    } = opts;

    // Calculate positions
    const fPos = squareToPos(from);
    const tPos = squareToPos(to);
    const dist = Math.max(Math.abs(tPos.col - fPos.col), Math.abs(tPos.row - fPos.row));

    // Approach position: close to the defender but not overlapping
    const [targetX, , targetZ] = squareToWorld(to, BOARD.TILE_SIZE, BOARD.OFFSET);
    const [fromX, , fromZ] = squareToWorld(from, BOARD.TILE_SIZE, BOARD.OFFSET);
    const dx = targetX - fromX;
    const dz = targetZ - fromZ;
    const totalDist = Math.sqrt(dx * dx + dz * dz);
    const spriteY = attacker.spriteAnimator ? SPRITES.SPRITE_Y_OFFSET : 0;

    // Adjacent (1 tile): approach halfway between attacker and defender
    // Longer range: stop one tile back from target
    let approachX: number;
    let approachZ: number;
    if (totalDist > BOARD.TILE_SIZE * 1.5) {
      // Long range — one tile back from target
      approachX = targetX - (dx / totalDist) * BOARD.TILE_SIZE;
      approachZ = targetZ - (dz / totalDist) * BOARD.TILE_SIZE;
    } else {
      // Adjacent — move halfway toward the target
      approachX = fromX + dx * 0.45;
      approachZ = fromZ + dz * 0.45;
    }
    const approachPos = new THREE.Vector3(approachX, spriteY, approachZ);

    // Walk duration for approach
    const approachWorldDist = Math.sqrt(
      (approachX - fromX) ** 2 + (approachZ - fromZ) ** 2,
    );
    const approachDuration = approachWorldDist > 0.01
      ? Math.max(PIECES.MOVE_DURATION_MIN, approachWorldDist / BOARD.TILE_SIZE * PIECES.MOVE_DURATION_PER_TILE)
      : 0;

    // Set facing direction for both attacker and defender
    pieceManager.setSpriteDirection(attacker, from, to, cameraOctant);
    pieceManager.setSpriteDirection(defender, to, from, cameraOctant);

    const hasAttackAnim = attacker.spriteAnimator?.hasAction('attack') ?? false;
    const hasHitAnim = defender.spriteAnimator?.hasAction('hit') ?? false;
    const hasDeathAnim = defender.spriteAnimator?.hasAction('death') ?? false;

    // --- Dramatic: tension pause before moving ---
    if (dramaLevel === 'dramatic') {
      await this.timerAnim(0.3, activeAnimations);
    }

    // --- Walk to approach position (one tile before target) ---
    if (approachDuration > 0) {
      if (attacker.spriteAnimator?.hasAction('walk')) {
        attacker.spriteAnimator.setAction('walk');
      }
      await this.slideToPosition(attacker, approachPos, approachDuration, activeAnimations);
    }

    // --- Attack animation ---
    if (hasAttackAnim) {
      await this.playActionAnim(attacker, 'attack', activeAnimations);
    }

    // --- Impact effects ---
    if (dramaLevel === 'dramatic') {
      this.shake.start(0.12, 0.4);
      this.flash.flash(0.3); // fire-and-forget
    } else if (dramaLevel === 'standard') {
      this.shake.start(0.06, 0.25);
    }

    // --- Hit reaction ---
    if (hasHitAnim) {
      await this.playActionAnim(defender, 'hit', activeAnimations);
    } else {
      await this.timerAnim(0.1, activeAnimations);
    }

    // --- Death animation (full playback), then fade AFTER ---
    if (hasDeathAnim) {
      await this.playActionAnim(defender, 'death', activeAnimations);
      await this.fadeAnim(defender, 0.3, activeAnimations);
    } else {
      // No death anim — just fade
      const fadeDuration = dramaLevel === 'dramatic' ? 0.5 : dramaLevel === 'standard' ? 0.35 : 0.2;
      await this.fadeAnim(defender, fadeDuration, activeAnimations);
    }

    // --- Walk attacker the final tile to the target square ---
    if (attacker.spriteAnimator?.hasAction('walk')) {
      attacker.spriteAnimator.setAction('walk');
    }
    await this.slideAnim(attacker, to, PIECES.MOVE_DURATION_MIN, activeAnimations);

    // --- Restore attacker to idle ---
    if (attacker.spriteAnimator) {
      if (attacker.spriteAnimator.hasAction('idle')) {
        attacker.spriteAnimator.setAction('idle');
      }
      pieceManager.resetPieceDirection(attacker, cameraOctant);
    }
  }

  /**
   * Slide a piece mesh from its current position to a target square.
   * Driven by the game loop's activeAnimations array.
   */
  private slideAnim(
    piece: ChessPiece,
    targetSquare: ChessSquare,
    duration: number,
    activeAnimations: { update: (dt: number) => boolean }[],
  ): Promise<void> {
    const [tx, , tz] = squareToWorld(targetSquare, BOARD.TILE_SIZE, BOARD.OFFSET);
    const targetY = piece.spriteAnimator ? SPRITES.SPRITE_Y_OFFSET : 0;
    return this.slideToPosition(piece, new THREE.Vector3(tx, targetY, tz), duration, activeAnimations);
  }

  /**
   * Slide a piece mesh to an arbitrary world position.
   */
  private slideToPosition(
    piece: ChessPiece,
    end: THREE.Vector3,
    duration: number,
    activeAnimations: { update: (dt: number) => boolean }[],
  ): Promise<void> {
    return new Promise(resolve => {
      if (!piece.mesh) { resolve(); return; }

      const start = piece.mesh.position.clone();
      let elapsed = 0;

      activeAnimations.push({
        update(dt: number): boolean {
          elapsed += dt;
          const t = Math.min(elapsed / duration, 1);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          piece.mesh!.position.lerpVectors(start, end, ease);
          if (t >= 1) {
            piece.mesh!.position.copy(end);
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }

  /**
   * Fade out a piece (opacity → 0, sink slightly).
   * Driven by activeAnimations.
   */
  private fadeAnim(
    piece: ChessPiece,
    duration: number,
    activeAnimations: { update: (dt: number) => boolean }[],
  ): Promise<void> {
    return new Promise(resolve => {
      if (!piece.mesh) { resolve(); return; }

      const mesh = piece.mesh;
      const materials: THREE.Material[] = [];

      mesh.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
          const mat = child.material;
          if (mat instanceof THREE.Material) {
            mat.transparent = true;
            materials.push(mat);
          }
        }
      });

      // Also handle sprite material directly
      if (piece.spriteAnimator) {
        const sprite = mesh as THREE.Sprite;
        if (sprite.material && !materials.includes(sprite.material)) {
          sprite.material.transparent = true;
          materials.push(sprite.material);
        }
      }

      let elapsed = 0;
      const startY = mesh.position.y;

      activeAnimations.push({
        update(dt: number): boolean {
          elapsed += dt;
          const t = Math.min(elapsed / duration, 1);
          const opacity = 1 - t;
          for (const mat of materials) {
            (mat as THREE.SpriteMaterial | THREE.MeshStandardMaterial).opacity = opacity;
          }
          mesh.position.y = startY - t * 0.15;
          if (t >= 1) {
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }

  /**
   * Play a sprite action animation (attack, hit, death) and wait for it to finish.
   * The animation is non-looping so we watch for `isFinished`.
   */
  private playActionAnim(
    piece: ChessPiece,
    actionName: string,
    activeAnimations: { update: (dt: number) => boolean }[],
  ): Promise<void> {
    return new Promise(resolve => {
      const animator = piece.spriteAnimator;
      if (!animator || !animator.hasAction(actionName)) {
        resolve();
        return;
      }

      animator.setAction(actionName);

      activeAnimations.push({
        update(dt: number): boolean {
          animator.update(dt);
          if (animator.isFinished) {
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }

  /**
   * Simple timer driven by activeAnimations (no setInterval).
   */
  private timerAnim(
    duration: number,
    activeAnimations: { update: (dt: number) => boolean }[],
  ): Promise<void> {
    return new Promise(resolve => {
      let elapsed = 0;
      activeAnimations.push({
        update(dt: number): boolean {
          elapsed += dt;
          if (elapsed >= duration) {
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }

  /** Update shake effect — call each frame */
  updateShake(dt: number, camera: THREE.Camera): void {
    const offset = this.shake.update(dt);
    if (this.shake.isShaking) {
      camera.position.add(offset);
    }
  }

  dispose(): void {
    this.flash.dispose();
  }
}
