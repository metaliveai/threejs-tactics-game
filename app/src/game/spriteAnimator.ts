import * as THREE from 'three';
import type { Direction8, SpriteAction, CharacterDef } from './types';
import { SPRITES } from './config';

/**
 * Frame-based sprite animation system.
 *
 * Drives a THREE.Sprite by swapping textures from individually loaded frame
 * images. Supports multiple actions (idle, walk, etc.) each with per-direction
 * frame sequences.
 *
 * Usage:
 *   const animator = new SpriteAnimator(characterDef);
 *   await animator.load();
 *   scene.add(animator.getSprite());
 *   animator.setAction('idle');
 *   animator.setDirection('S');
 *   // each frame:
 *   animator.update(dt);
 */
export class SpriteAnimator {
  private sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;

  private characterDef: CharacterDef;

  /** Loaded textures: action → direction → frame textures */
  private textures = new Map<string, Map<Direction8, THREE.Texture[]>>();

  /** Current state */
  private currentAction: string = '';
  private currentDirection: Direction8 = 'S';
  private currentFrameIndex = 0;
  private elapsed = 0;
  private finished = false;

  /** Cached values from current action for hot-path access */
  private actionDef: SpriteAction | null = null;
  private currentFrames: THREE.Texture[] | null = null;

  constructor(characterDef: CharacterDef) {
    this.characterDef = characterDef;

    this.material = new THREE.SpriteMaterial({
      transparent: true,
      alphaTest: 0.01,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(SPRITES.SPRITE_SCALE, SPRITES.SPRITE_SCALE, 1);
  }

  /**
   * Load all frame textures for this character.
   * Returns true if at least one action loaded successfully.
   */
  async load(): Promise<boolean> {
    const loader = new THREE.TextureLoader();
    let anyLoaded = false;

    const actionNames = Object.keys(this.characterDef.actions);

    for (const actionName of actionNames) {
      const action = this.characterDef.actions[actionName];
      const dirMap = new Map<Direction8, THREE.Texture[]>();

      const dirEntries = Object.entries(action.framePaths) as [Direction8, string[]][];

      // Load all directions for this action in parallel
      await Promise.all(dirEntries.map(async ([dir, paths]) => {
        const frames: THREE.Texture[] = [];

        for (const path of paths) {
          const url = `${this.characterDef.root}/${path}`;
          try {
            const texture = await loader.loadAsync(url);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.generateMipmaps = false;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            frames.push(texture);
          } catch (err) {
            console.warn(`[SpriteAnimator] Failed to load frame: ${url}`, err);
          }
        }

        if (frames.length > 0) {
          dirMap.set(dir, frames);
        }
      }));

      if (dirMap.size > 0) {
        this.textures.set(actionName, dirMap);
        anyLoaded = true;
      }
    }

    // Auto-select first available action
    if (anyLoaded) {
      const firstAction = actionNames.find(name => this.textures.has(name));
      if (firstAction) {
        this.setAction(firstAction);
      }
    }

    return anyLoaded;
  }

  /** Get the Three.js Sprite object (add to scene) */
  getSprite(): THREE.Sprite {
    return this.sprite;
  }

  /** Check if any textures are loaded */
  get isLoaded(): boolean {
    return this.textures.size > 0;
  }

  /** Check if a specific action is available */
  hasAction(actionName: string): boolean {
    return this.textures.has(actionName);
  }

  /** Get the current action name */
  get action(): string {
    return this.currentAction;
  }

  /** Get the current facing direction */
  get direction(): Direction8 {
    return this.currentDirection;
  }

  /** Whether the current (non-looping) animation has finished */
  get isFinished(): boolean {
    return this.finished;
  }

  /**
   * Switch to a different action (e.g. 'idle' → 'walk').
   * Resets frame counter. No-op if already on this action.
   */
  setAction(actionName: string): void {
    if (actionName === this.currentAction) return;

    const action = this.characterDef.actions[actionName];
    const dirMap = this.textures.get(actionName);
    if (!action || !dirMap) {
      console.warn(`[SpriteAnimator] Action "${actionName}" not available`);
      return;
    }

    this.currentAction = actionName;
    this.actionDef = action;

    // Update sprite aspect ratio based on frame size
    const aspect = action.frameSize.w / action.frameSize.h;
    this.sprite.scale.set(
      SPRITES.SPRITE_SCALE * aspect,
      SPRITES.SPRITE_SCALE,
      1,
    );

    // Reset animation state
    this.currentFrameIndex = 0;
    this.elapsed = 0;
    this.finished = false;

    // Reapply direction to pick correct frames
    this.updateFrames();
    this.applyFrame();
  }

  /**
   * Set the facing direction. Updates the active frame sequence.
   * This is the VISUAL direction (already adjusted for camera rotation).
   */
  setDirection(dir: Direction8): void {
    if (dir === this.currentDirection && this.currentFrames) return;
    this.currentDirection = dir;
    this.updateFrames();
    this.applyFrame();
  }

  /**
   * Advance the frame animation by dt seconds.
   * Call once per frame in the game loop.
   */
  update(dt: number): void {
    if (!this.actionDef || !this.currentFrames || this.finished) return;

    const frameDuration = this.actionDef.timing.frameMs / 1000;
    this.elapsed += dt;

    if (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration;

      const totalFrames = this.currentFrames.length;
      this.currentFrameIndex++;

      if (this.currentFrameIndex >= totalFrames) {
        if (this.actionDef.timing.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.currentFrameIndex = totalFrames - 1;
          this.finished = true;
        }
      }

      this.applyFrame();
    }
  }

  /**
   * Dispose all GPU resources. Call when removing the piece.
   */
  dispose(): void {
    for (const dirMap of this.textures.values()) {
      for (const frames of dirMap.values()) {
        for (const texture of frames) {
          texture.dispose();
        }
      }
    }
    this.textures.clear();
    this.material.dispose();
  }

  // --- Internal ---

  /** Update cached frame array for current action + direction */
  private updateFrames(): void {
    if (!this.currentAction) {
      this.currentFrames = null;
      return;
    }

    const dirMap = this.textures.get(this.currentAction);
    this.currentFrames = dirMap?.get(this.currentDirection) ?? null;

    // Reset frame if current index is out of bounds
    if (this.currentFrames && this.currentFrameIndex >= this.currentFrames.length) {
      this.currentFrameIndex = 0;
      this.elapsed = 0;
    }
  }

  /** Apply the current frame texture to the sprite material */
  private applyFrame(): void {
    if (!this.currentFrames || this.currentFrames.length === 0) return;

    const texture = this.currentFrames[this.currentFrameIndex];
    if (texture && texture !== this.material.map) {
      this.material.map = texture;
      this.material.needsUpdate = true;
    }
  }
}
