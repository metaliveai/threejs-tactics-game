import * as THREE from 'three';
import { PIECES, PIECE_SHAPES, BOARD, CHARACTER_MAP, SPRITES } from './config';
import { squareToWorld, squareToPos } from './chess';
import { SpriteAnimator } from './spriteAnimator';
import { getDirection, rotateDirection, flipBoardToScreen } from './direction';
import type {
  PieceType, PieceColor, ChessSquare, ChessPiece,
  CameraOctant, Direction8, CharacterDef,
} from './types';

/**
 * Placeholder piece meshes — distinguishable 3D shapes per piece type.
 * King=cylinder+cross, Queen=cylinder+crown, Bishop=cylinder+angle,
 * Knight=cylinder+sphere, Rook=wide cylinder, Pawn=small cylinder+ball
 */

/** Create a piece mesh group for the given type and color */
function createPieceMesh(type: PieceType, color: PieceColor): THREE.Group {
  const group = new THREE.Group();
  const shape = PIECE_SHAPES[type];
  const baseColor = color === 'w' ? PIECES.WHITE_COLOR : PIECES.BLACK_COLOR;
  const accentColor = color === 'w' ? PIECES.WHITE_ACCENT : PIECES.BLACK_ACCENT;

  const baseMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.6,
    metalness: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.4,
    metalness: 0.2,
  });

  // Base cylinder
  const r = shape.baseRadius * PIECES.PIECE_SCALE / 0.35;
  const h = shape.baseHeight * PIECES.PIECE_SCALE / 0.35;
  const baseGeo = new THREE.CylinderGeometry(r * 0.8, r, h, 12);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = h / 2;
  base.castShadow = true;
  group.add(base);

  // Top detail per piece type
  const topY = h;

  switch (shape.topShape) {
    case 'cross': {
      // King: cross on top
      const armGeo = new THREE.BoxGeometry(r * 0.2, r * 0.6, r * 0.2);
      const arm1 = new THREE.Mesh(armGeo, accentMat);
      arm1.position.y = topY + r * 0.3;
      group.add(arm1);
      const arm2Geo = new THREE.BoxGeometry(r * 0.5, r * 0.2, r * 0.2);
      const arm2 = new THREE.Mesh(arm2Geo, accentMat);
      arm2.position.y = topY + r * 0.4;
      group.add(arm2);
      break;
    }
    case 'crown': {
      // Queen: crown points
      const crownGeo = new THREE.ConeGeometry(r * 0.5, r * 0.4, 5);
      const crown = new THREE.Mesh(crownGeo, accentMat);
      crown.position.y = topY + r * 0.2;
      group.add(crown);
      // Gem on top
      const gemGeo = new THREE.SphereGeometry(r * 0.12, 8, 8);
      const gem = new THREE.Mesh(gemGeo, accentMat);
      gem.position.y = topY + r * 0.5;
      group.add(gem);
      break;
    }
    case 'angle': {
      // Bishop: angled tip
      const tipGeo = new THREE.ConeGeometry(r * 0.3, r * 0.5, 8);
      const tip = new THREE.Mesh(tipGeo, accentMat);
      tip.position.y = topY + r * 0.25;
      tip.rotation.z = 0.2;
      group.add(tip);
      break;
    }
    case 'sphere': {
      // Knight: sphere head
      const headGeo = new THREE.SphereGeometry(r * 0.35, 10, 10);
      const head = new THREE.Mesh(headGeo, accentMat);
      head.position.y = topY + r * 0.15;
      head.position.x = r * 0.1;
      group.add(head);
      // Snout
      const snoutGeo = new THREE.BoxGeometry(r * 0.4, r * 0.2, r * 0.25);
      const snout = new THREE.Mesh(snoutGeo, accentMat);
      snout.position.y = topY + r * 0.1;
      snout.position.x = r * 0.35;
      group.add(snout);
      break;
    }
    case 'flat': {
      // Rook: flat top with battlements
      const topGeo = new THREE.CylinderGeometry(r * 0.85, r * 0.8, r * 0.15, 8);
      const top = new THREE.Mesh(topGeo, accentMat);
      top.position.y = topY + r * 0.08;
      group.add(top);
      // Battlement notches (small cubes on rim)
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const notch = new THREE.Mesh(
          new THREE.BoxGeometry(r * 0.2, r * 0.2, r * 0.15),
          accentMat
        );
        notch.position.set(
          Math.cos(angle) * r * 0.6,
          topY + r * 0.25,
          Math.sin(angle) * r * 0.6
        );
        group.add(notch);
      }
      break;
    }
    case 'ball': {
      // Pawn: simple ball on top
      const ballGeo = new THREE.SphereGeometry(r * 0.25, 8, 8);
      const ball = new THREE.Mesh(ballGeo, accentMat);
      ball.position.y = topY + r * 0.1;
      group.add(ball);
      break;
    }
  }

  return group;
}

/**
 * Manages all piece visuals on the board.
 * Supports both placeholder 3D meshes and animated sprite characters.
 */
export class PieceManager {
  readonly group = new THREE.Group();
  private pieces = new Map<string, ChessPiece>();
  private raycaster = new THREE.Raycaster();

  /** Whether sprite mode is active (characters loaded successfully) */
  private _useSpriteMode = false;

  /** Loaded character definitions keyed by character key */
  private characterDefs = new Map<string, CharacterDef>();

  /** Active sprite animators keyed by piece id */
  private animators = new Map<string, SpriteAnimator>();

  /** World-space facing direction per piece id (before camera rotation) */
  private worldDirections = new Map<string, Direction8>();

  /** Last camera quarter used for direction updates */
  private lastCameraOctant: CameraOctant = 0;

  get useSpriteMode(): boolean {
    return this._useSpriteMode;
  }

  /** PixelLab direction name → our Direction8 */
  private static readonly DIR_MAP: Record<string, Direction8> = {
    'north': 'N', 'north-east': 'NE', 'east': 'E', 'south-east': 'SE',
    'south': 'S', 'south-west': 'SW', 'west': 'W', 'north-west': 'NW',
  };

  /** PixelLab action name → our action name */
  private static readonly ACTION_MAP: Record<string, string> = {
    'breathing-idle': 'idle',
    'walking': 'walk',
    'cross-punch': 'attack',
    'fireball': 'attack',
    'taking-punch': 'hit',
    'falling-back-death': 'death',
  };

  /** Default timing per action (PixelLab metadata doesn't include timing) */
  private static readonly ACTION_TIMING: Record<string, { frameMs: number; loop: boolean }> = {
    'idle': { frameMs: 200, loop: true },
    'walk': { frameMs: 120, loop: true },
    'attack': { frameMs: 100, loop: false },
    'hit': { frameMs: 100, loop: false },
    'death': { frameMs: 120, loop: false },
  };

  /**
   * Load character definitions from per-character metadata.json files.
   * Scans CHARACTER_MAP keys and attempts to load from assets/characters/{key}/.
   * Falls back to placeholder meshes if loading fails.
   */
  async loadCharacters(): Promise<void> {
    const neededKeys = new Set<string>();
    for (const colorMap of Object.values(CHARACTER_MAP)) {
      for (const charKey of Object.values(colorMap)) {
        neededKeys.add(charKey);
      }
    }

    const promises = [...neededKeys].map(async (key) => {
      try {
        const resp = await fetch(`assets/characters/${key}/metadata.json`);
        if (!resp.ok) return;

        const meta = await resp.json();
        const def = this.parsePixelLabMeta(key, meta);
        if (def) {
          this.characterDefs.set(key, def);
        }
      } catch {
        // Character not available — will use placeholder
      }
    });

    await Promise.all(promises);

    const availableCount = this.characterDefs.size;
    if (availableCount > 0) {
      this._useSpriteMode = true;
      console.log(`[PieceManager] Sprite mode enabled — ${availableCount}/${neededKeys.size} characters available`);
    } else {
      console.warn('[PieceManager] No characters found, using placeholders');
    }
  }

  /**
   * Parse PixelLab metadata.json into our CharacterDef type.
   */
  private parsePixelLabMeta(
    key: string,
    meta: Record<string, unknown>,
  ): CharacterDef | null {
    try {
      const character = meta.character as { name: string; size: { width: number; height: number } };
      const frames = meta.frames as {
        animations: Record<string, Record<string, string[]>>;
      };

      if (!character || !frames?.animations) return null;

      const root = `assets/characters/${key}`;
      const directions = Object.keys(PieceManager.DIR_MAP)
        .map(k => PieceManager.DIR_MAP[k]) as Direction8[];

      const parsedActions: Record<string, import('./types').SpriteAction> = {};

      for (const [plAction, dirFrames] of Object.entries(frames.animations)) {
        const ourAction = PieceManager.ACTION_MAP[plAction] ?? plAction;
        const timing = PieceManager.ACTION_TIMING[ourAction] ?? { frameMs: 150, loop: true };

        const framePaths: Record<string, string[]> = {};

        for (const [plDir, paths] of Object.entries(dirFrames)) {
          const dir = PieceManager.DIR_MAP[plDir];
          if (dir && paths.length > 0) {
            framePaths[dir] = paths;
          }
        }

        if (Object.keys(framePaths).length > 0) {
          parsedActions[ourAction] = {
            framePaths: framePaths as Record<Direction8, string[]>,
            frameSize: { w: character.size.width, h: character.size.height },
            timing,
          };
        }
      }

      if (Object.keys(parsedActions).length === 0) return null;

      return { name: character.name, root, directions, actions: parsedActions };
    } catch {
      console.warn(`[PieceManager] Failed to parse metadata for "${key}"`);
      return null;
    }
  }

  /** Place all pieces from chess engine state */
  setupPieces(allPieces: { type: PieceType; color: PieceColor; square: ChessSquare }[]): void {
    this.clear();

    for (const p of allPieces) {
      this.addPiece(p.type, p.color, p.square);
    }
  }

  /**
   * Place all pieces with sprite loading (async version).
   * Falls back to placeholder for any piece whose sprite fails to load.
   */
  async setupPiecesAsync(
    allPieces: { type: PieceType; color: PieceColor; square: ChessSquare }[],
  ): Promise<void> {
    this.clear();

    const promises: Promise<void>[] = [];

    for (const p of allPieces) {
      promises.push(this.addPieceAsync(p.type, p.color, p.square));
    }

    await Promise.all(promises);
  }

  /** Add a single piece to the board (sync — uses placeholder or pre-loaded sprite) */
  addPiece(type: PieceType, color: PieceColor, square: ChessSquare): ChessPiece {
    const [x, , z] = squareToWorld(square, BOARD.TILE_SIZE, BOARD.OFFSET);
    const id = `${color}-${type}-${square}-${Date.now()}`;

    // Always create placeholder mesh as baseline
    const mesh = createPieceMesh(type, color);
    mesh.position.set(x, 0, z);

    const piece: ChessPiece = { type, color, square, mesh, spriteAnimator: null, id };
    this.pieces.set(square, piece);
    this.group.add(mesh);

    return piece;
  }

  /**
   * Add a single piece, attempting sprite load first.
   * Falls back to placeholder mesh if sprite is unavailable.
   */
  async addPieceAsync(type: PieceType, color: PieceColor, square: ChessSquare): Promise<void> {
    const [x, , z] = squareToWorld(square, BOARD.TILE_SIZE, BOARD.OFFSET);
    const id = `${color}-${type}-${square}-${Date.now()}`;

    // Try sprite mode first
    if (this._useSpriteMode) {
      const charKey = CHARACTER_MAP[color]?.[type];
      const charDef = charKey ? this.characterDefs.get(charKey) : undefined;

      if (charDef) {
        const animator = new SpriteAnimator(charDef);
        const loaded = await animator.load();

        if (loaded) {
          const sprite = animator.getSprite();
          sprite.position.set(x, SPRITES.SPRITE_Y_OFFSET, z);

          // Set default idle direction (world direction)
          const worldDir: Direction8 = color === 'w'
            ? SPRITES.DEFAULT_DIR_WHITE
            : SPRITES.DEFAULT_DIR_BLACK;

          if (animator.hasAction('idle')) {
            animator.setAction('idle');
          }
          // Apply visual direction accounting for current camera rotation
          const visualDir = rotateDirection(worldDir, this.lastCameraOctant);
          animator.setDirection(visualDir);

          const piece: ChessPiece = {
            type, color, square,
            mesh: sprite,
            spriteAnimator: animator,
            id,
          };

          this.pieces.set(square, piece);
          this.animators.set(id, animator);
          this.worldDirections.set(id, worldDir);
          this.group.add(sprite);
          return;
        }

        // Sprite load failed — dispose and fall through to placeholder
        animator.dispose();
      }
    }

    // Fallback: placeholder mesh
    const mesh = createPieceMesh(type, color);
    mesh.position.set(x, 0, z);

    const piece: ChessPiece = { type, color, square, mesh, spriteAnimator: null, id };
    this.pieces.set(square, piece);
    this.group.add(mesh);
  }

  /** Get piece at a square */
  getPieceAt(square: ChessSquare): ChessPiece | undefined {
    return this.pieces.get(square);
  }

  /** Raycast from mouse position to find which piece (sprite/mesh) was clicked */
  pickPiece(mouse: THREE.Vector2, camera: THREE.Camera): ChessSquare | null {
    this.raycaster.setFromCamera(mouse, camera);
    const meshes: THREE.Object3D[] = [];
    for (const piece of this.pieces.values()) {
      if (piece.mesh) meshes.push(piece.mesh);
    }
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      // Walk up to find the top-level object that belongs to a piece
      const hitObj = hits[0].object;
      for (const piece of this.pieces.values()) {
        if (!piece.mesh) continue;
        if (piece.mesh === hitObj || piece.mesh === hitObj.parent) {
          return piece.square;
        }
        // For groups (placeholder meshes), check if hitObj is a descendant
        if (piece.mesh instanceof THREE.Group) {
          let parent = hitObj.parent;
          while (parent) {
            if (parent === piece.mesh) return piece.square;
            parent = parent.parent;
          }
        }
      }
    }
    return null;
  }

  /**
   * Detach a piece from the internal map but keep its mesh in the scene.
   * Used by choreography — the piece stays visible for fade-out effects
   * but is no longer tracked as occupying a square.
   */
  detachPiece(square: ChessSquare): ChessPiece | undefined {
    const piece = this.pieces.get(square);
    if (piece) {
      this.pieces.delete(square);
      // Stop tracking animation updates but keep mesh in scene
      if (piece.spriteAnimator) {
        this.animators.delete(piece.id);
        this.worldDirections.delete(piece.id);
      }
    }
    return piece;
  }

  /** Fully dispose a detached piece (remove mesh + free GPU resources) */
  disposePiece(piece: ChessPiece): void {
    if (piece.mesh) {
      this.group.remove(piece.mesh);
    }
    if (piece.spriteAnimator) {
      piece.spriteAnimator.dispose();
    } else if (piece.mesh) {
      piece.mesh.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
  }

  /** Remove piece from a square (for captures) */
  removePieceAt(square: ChessSquare): ChessPiece | undefined {
    const piece = this.pieces.get(square);
    if (piece) {
      if (piece.mesh) {
        this.group.remove(piece.mesh);
      }

      // Dispose sprite animator if present
      if (piece.spriteAnimator) {
        piece.spriteAnimator.dispose();
        this.animators.delete(piece.id);
        this.worldDirections.delete(piece.id);
      }

      // Dispose mesh geometry and materials (placeholder meshes)
      if (piece.mesh && !piece.spriteAnimator) {
        piece.mesh.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
      }
    }
    this.pieces.delete(square);
    return piece;
  }

  /**
   * Move a piece from one square to another (update internal map).
   * Returns the piece, which may need animation.
   */
  movePiece(from: ChessSquare, to: ChessSquare): ChessPiece | undefined {
    const piece = this.pieces.get(from);
    if (!piece) return undefined;

    this.pieces.delete(from);
    piece.square = to;
    this.pieces.set(to, piece);
    return piece;
  }

  /** Animate a piece mesh sliding to target position */
  animateMove(
    piece: ChessPiece,
    targetSquare: ChessSquare,
    duration: number,
    onComplete: () => void
  ): { update: (dt: number) => boolean } {
    if (!piece.mesh) {
      onComplete();
      return { update: () => true };
    }

    const self = this;
    const start = piece.mesh.position.clone();
    const [tx, , tz] = squareToWorld(targetSquare, BOARD.TILE_SIZE, BOARD.OFFSET);
    const targetY = piece.spriteAnimator ? SPRITES.SPRITE_Y_OFFSET : 0;
    const end = new THREE.Vector3(tx, targetY, tz);
    let elapsed = 0;

    // If the piece has a sprite animator, switch to walk action for the move
    const animator = piece.spriteAnimator;
    const hadWalk = animator?.hasAction('walk');
    const prevAction = animator?.action;

    if (animator && hadWalk) {
      animator.setAction('walk');
    }

    return {
      update(dt: number): boolean {
        elapsed += dt;
        const t = Math.min(elapsed / duration, 1);
        // Ease in-out
        const ease = t < 0.5
          ? 2 * t * t
          : 1 - Math.pow(-2 * t + 2, 2) / 2;

        piece.mesh!.position.lerpVectors(start, end, ease);

        if (t >= 1) {
          piece.mesh!.position.copy(end);

          // Restore idle action and default facing direction after walk completes
          if (animator) {
            if (hadWalk && prevAction) {
              animator.setAction(prevAction);
            } else if (animator.hasAction('idle')) {
              animator.setAction('idle');
            }

            // Reset to default idle direction
            const defaultDir: Direction8 = piece.color === 'w'
              ? SPRITES.DEFAULT_DIR_WHITE
              : SPRITES.DEFAULT_DIR_BLACK;
            self.worldDirections.set(piece.id, defaultDir);
            const visualDir = rotateDirection(defaultDir, self.lastCameraOctant);
            animator.setDirection(visualDir);
          }

          onComplete();
          return true; // done
        }
        return false; // still animating
      }
    };
  }

  /**
   * Set the sprite direction for a piece based on movement.
   * Call before starting the move animation so the sprite faces the right way.
   */
  setSpriteDirection(
    piece: ChessPiece,
    fromSquare: ChessSquare,
    toSquare: ChessSquare,
    cameraQuarter: CameraOctant,
  ): void {
    if (!piece.spriteAnimator) return;

    const fromPos = squareToPos(fromSquare);
    const toPos = squareToPos(toSquare);
    const worldDir = getDirection(fromPos, toPos);

    if (worldDir) {
      // Flip N/S: board row+ = 'N' but screen z+ = down = visual 'S'
      const screenDir = flipBoardToScreen(worldDir);
      this.worldDirections.set(piece.id, screenDir);
      const visualDir = rotateDirection(screenDir, cameraQuarter);
      piece.spriteAnimator.setDirection(visualDir);
    }
  }

  /**
   * Reset a piece's facing direction to default idle and update worldDirections.
   * Call after choreography finishes so camera rotation stays correct.
   */
  resetPieceDirection(piece: ChessPiece, cameraOctant: CameraOctant): void {
    if (!piece.spriteAnimator) return;
    const defaultDir: Direction8 = piece.color === 'w'
      ? SPRITES.DEFAULT_DIR_WHITE
      : SPRITES.DEFAULT_DIR_BLACK;
    this.worldDirections.set(piece.id, defaultDir);
    const visualDir = rotateDirection(defaultDir, cameraOctant);
    piece.spriteAnimator.setDirection(visualDir);
  }

  /**
   * Update all sprite animations. Call once per frame.
   * Recalculates visual directions when camera quarter changes.
   * @param dt - Delta time in seconds
   * @param cameraQuarter - Current camera rotation quarter
   */
  updateSprites(dt: number, cameraQuarter: CameraOctant): void {
    // Recalculate all sprite directions when camera rotates
    if (cameraQuarter !== this.lastCameraOctant) {
      this.lastCameraOctant = cameraQuarter;
      for (const piece of this.pieces.values()) {
        if (piece.spriteAnimator) {
          const worldDir = this.worldDirections.get(piece.id);
          if (worldDir) {
            const visualDir = rotateDirection(worldDir, cameraQuarter);
            piece.spriteAnimator.setDirection(visualDir);
          }
        }
      }
    }

    for (const animator of this.animators.values()) {
      animator.update(dt);
    }
  }

  /** For castling: also move the rook */
  handleCastling(
    move: { from: ChessSquare; to: ChessSquare; flags: string },
    duration: number,
    onComplete: () => void,
    cameraQuarter?: CameraOctant,
  ): { update: (dt: number) => boolean } | null {
    // Kingside castle: king moves from e->g, rook from h->f
    // Queenside castle: king moves from e->c, rook from a->d
    const isKingside = move.flags.includes('k');
    const isQueenside = move.flags.includes('q');

    if (!isKingside && !isQueenside) return null;

    const rank = move.from[1]; // '1' or '8'
    let rookFrom: ChessSquare;
    let rookTo: ChessSquare;

    if (isKingside) {
      rookFrom = `h${rank}` as ChessSquare;
      rookTo = `f${rank}` as ChessSquare;
    } else {
      rookFrom = `a${rank}` as ChessSquare;
      rookTo = `d${rank}` as ChessSquare;
    }

    const rook = this.movePiece(rookFrom, rookTo);
    if (!rook) return null;

    // Set rook sprite direction for the castle move
    if (cameraQuarter !== undefined) {
      this.setSpriteDirection(rook, rookFrom, rookTo, cameraQuarter);
    }

    return this.animateMove(rook, rookTo, duration, onComplete);
  }

  /** Clear all pieces */
  clear(): void {
    for (const [square] of this.pieces) {
      this.removePieceAt(square as ChessSquare);
    }
    this.pieces.clear();
    this.animators.clear();
    this.worldDirections.clear();
  }

  /** Get all pieces (for test seam / state dump) */
  getAllPieces(): ChessPiece[] {
    return Array.from(this.pieces.values());
  }
}
