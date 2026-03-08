import * as THREE from 'three';
import { BOARD } from './config';
import { squareToPos, posToSquare, posToWorld } from './chess';
import type { ChessSquare, BoardPos, Move } from './types';

/**
 * The 8x8 board grid — tile meshes, colored overlays, and raycasting.
 */
export class BoardGrid {
  readonly group = new THREE.Group();

  /** Map of square name → tile mesh */
  private tiles = new Map<string, THREE.Mesh>();
  /** Overlay meshes for highlighting */
  private overlays = new Map<string, THREE.Mesh>();
  /** Raycaster for tile picking */
  private raycaster = new THREE.Raycaster();
  /** All tile meshes for raycasting */
  private tileMeshes: THREE.Mesh[] = [];

  constructor() {
    this.buildBoard();
  }

  private buildBoard(): void {
    const tileGeo = new THREE.BoxGeometry(BOARD.TILE_SIZE, BOARD.TILE_HEIGHT, BOARD.TILE_SIZE);
    const overlayGeo = new THREE.PlaneGeometry(BOARD.TILE_SIZE * 0.9, BOARD.TILE_SIZE * 0.9);

    for (let row = 0; row < BOARD.SIZE; row++) {
      for (let col = 0; col < BOARD.SIZE; col++) {
        const isLight = (row + col) % 2 === 0;
        const color = isLight ? BOARD.LIGHT_COLOR : BOARD.DARK_COLOR;
        const mat = new THREE.MeshStandardMaterial({ color });

        const tile = new THREE.Mesh(tileGeo, mat);
        const [x, , z] = posToWorld({ col, row }, BOARD.TILE_SIZE, BOARD.OFFSET);
        tile.position.set(x, -BOARD.TILE_HEIGHT / 2, z);
        tile.receiveShadow = true;

        const square = posToSquare({ col, row });
        tile.userData.square = square;
        this.tiles.set(square, tile);
        this.tileMeshes.push(tile);
        this.group.add(tile);

        // Overlay (hidden by default)
        const overlayMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const overlay = new THREE.Mesh(overlayGeo, overlayMat);
        overlay.rotation.x = -Math.PI / 2;
        overlay.position.set(x, 0.01, z);
        overlay.userData.square = square;
        this.overlays.set(square, overlay);
        this.group.add(overlay);
      }
    }
  }

  /** Raycast from mouse position to find which square was clicked */
  pickTile(mouse: THREE.Vector2, camera: THREE.Camera): ChessSquare | null {
    this.raycaster.setFromCamera(mouse, camera);
    const hits = this.raycaster.intersectObjects(this.tileMeshes);
    if (hits.length > 0) {
      return hits[0].object.userData.square as ChessSquare;
    }
    return null;
  }

  /** Clear all overlays */
  clearOverlays(): void {
    for (const overlay of this.overlays.values()) {
      const mat = overlay.material as THREE.MeshBasicMaterial;
      mat.opacity = 0;
    }
  }

  /** Highlight a single square */
  highlightSquare(square: ChessSquare, color: number, opacity: number = BOARD.OVERLAY_OPACITY): void {
    const overlay = this.overlays.get(square);
    if (overlay) {
      const mat = overlay.material as THREE.MeshBasicMaterial;
      mat.color.setHex(color);
      mat.opacity = opacity;
    }
  }

  /** Show valid moves for a selected piece */
  showMoves(selectedSquare: ChessSquare, moves: Move[]): void {
    this.clearOverlays();

    // Highlight selected square
    this.highlightSquare(selectedSquare, BOARD.HIGHLIGHT_SELECTED);

    // Highlight move/capture targets
    for (const move of moves) {
      if (move.captured) {
        this.highlightSquare(move.to, BOARD.HIGHLIGHT_CAPTURE);
      } else {
        this.highlightSquare(move.to, BOARD.HIGHLIGHT_MOVE);
      }
    }
  }

  /** Highlight king in check */
  showCheck(kingSquare: ChessSquare): void {
    this.highlightSquare(kingSquare, BOARD.HIGHLIGHT_CHECK, 0.6);
  }

  /** Get world position of a square (top of tile) */
  getWorldPos(square: ChessSquare): THREE.Vector3 {
    const [x, , z] = posToWorld(squareToPos(square), BOARD.TILE_SIZE, BOARD.OFFSET);
    return new THREE.Vector3(x, 0, z);
  }
}
