import * as THREE from 'three';
import { BOARD } from './config';
import { squareToPos, posToSquare, posToWorld } from './chess';
import type { ChessSquare, BoardPos, Move } from './types';

/** Resolution of procedural stone textures */
const TEX_SIZE = 128;

/**
 * Simple seeded PRNG for deterministic texture generation.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a stone texture on a canvas with cracks, noise, and wear.
 * Each tile gets a unique seed so they all look different.
 */
function generateStoneTexture(
  baseR: number, baseG: number, baseB: number,
  seed: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;

  const rand = mulberry32(seed);

  // Fill base color with per-pixel noise
  const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const d = imageData.data;

  for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) {
    const noise = (rand() - 0.5) * 40;
    // Larger blotchy variation
    const x = i % TEX_SIZE;
    const y = (i / TEX_SIZE) | 0;
    const blotch = Math.sin(x * 0.08 + rand() * 6) * Math.cos(y * 0.08 + rand() * 6) * 18;

    d[i * 4 + 0] = Math.max(0, Math.min(255, baseR + noise + blotch));
    d[i * 4 + 1] = Math.max(0, Math.min(255, baseG + noise + blotch));
    d[i * 4 + 2] = Math.max(0, Math.min(255, baseB + noise + blotch));
    d[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // Draw cracks — dark jagged lines
  const numCracks = 1 + (rand() * 3) | 0;
  for (let c = 0; c < numCracks; c++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(0,0,0,${0.15 + rand() * 0.2})`;
    ctx.lineWidth = 0.5 + rand() * 1.0;

    let cx = rand() * TEX_SIZE;
    let cy = rand() * TEX_SIZE;
    ctx.moveTo(cx, cy);

    const segments = 4 + (rand() * 8) | 0;
    for (let s = 0; s < segments; s++) {
      cx += (rand() - 0.5) * 30;
      cy += (rand() - 0.5) * 30;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Subtle edge wear — darker edges
  const grad = ctx.createRadialGradient(
    TEX_SIZE / 2, TEX_SIZE / 2, TEX_SIZE * 0.3,
    TEX_SIZE / 2, TEX_SIZE / 2, TEX_SIZE * 0.7,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Occasional small chips / pits
  const numPits = (rand() * 4) | 0;
  for (let p = 0; p < numPits; p++) {
    const px = rand() * TEX_SIZE;
    const py = rand() * TEX_SIZE;
    const pr = 1 + rand() * 3;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.1 + rand() * 0.15})`;
    ctx.fill();
  }

  return canvas;
}

/**
 * Generate a rougher stone texture for sides — more weathered, less polished.
 */
function generateSideTexture(
  baseR: number, baseG: number, baseB: number,
  seed: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE / 2;
  const ctx = canvas.getContext('2d')!;

  const rand = mulberry32(seed);
  const w = canvas.width;
  const h = canvas.height;

  const imageData = ctx.createImageData(w, h);
  const d = imageData.data;

  for (let i = 0; i < w * h; i++) {
    const noise = (rand() - 0.5) * 55;
    const x = i % w;
    const y = (i / w) | 0;
    // Horizontal strata lines
    const strata = Math.sin(y * 0.4 + rand() * 2) * 10;

    d[i * 4 + 0] = Math.max(0, Math.min(255, baseR + noise + strata));
    d[i * 4 + 1] = Math.max(0, Math.min(255, baseG + noise + strata));
    d[i * 4 + 2] = Math.max(0, Math.min(255, baseB + noise + strata));
    d[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // Horizontal cracks in the side face
  const numCracks = (rand() * 3) | 0;
  for (let c = 0; c < numCracks; c++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(0,0,0,${0.2 + rand() * 0.2})`;
    ctx.lineWidth = 0.5 + rand() * 0.8;
    let cx = 0;
    let cy = rand() * h;
    ctx.moveTo(cx, cy);
    const segments = 3 + (rand() * 5) | 0;
    for (let s = 0; s < segments; s++) {
      cx += 10 + rand() * 25;
      cy += (rand() - 0.5) * 10;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  return canvas;
}

function canvasToTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The 8x8 board grid — thick 3D tile blocks with procedural stone textures,
 * overlay highlights, and raycasting.
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
    const tileSize = BOARD.TILE_SIZE - BOARD.TILE_GAP;
    const tileGeo = new THREE.BoxGeometry(tileSize, BOARD.TILE_HEIGHT, tileSize);
    const overlayGeo = new THREE.PlaneGeometry(tileSize * 0.9, tileSize * 0.9);

    for (let row = 0; row < BOARD.SIZE; row++) {
      for (let col = 0; col < BOARD.SIZE; col++) {
        const isLight = (row + col) % 2 === 0;
        const topHex = isLight ? BOARD.LIGHT_COLOR : BOARD.DARK_COLOR;
        const sideHex = isLight ? BOARD.SIDE_COLOR_LIGHT : BOARD.SIDE_COLOR_DARK;

        // Extract RGB for procedural texture generation
        const topR = (topHex >> 16) & 0xff;
        const topG = (topHex >> 8) & 0xff;
        const topB = topHex & 0xff;
        const sideR = (sideHex >> 16) & 0xff;
        const sideG = (sideHex >> 8) & 0xff;
        const sideB = sideHex & 0xff;

        // Unique seed per tile
        const seed = row * 8 + col + 42;

        // Top face: polished but cracked stone
        const topCanvas = generateStoneTexture(topR, topG, topB, seed);
        const topTex = canvasToTexture(topCanvas);

        const topMat = new THREE.MeshStandardMaterial({
          map: topTex,
          roughness: 0.65,
          metalness: 0.02,
        });

        // Side faces: rougher weathered stone
        const sideCanvas = generateSideTexture(sideR, sideG, sideB, seed + 100);
        const sideTex = canvasToTexture(sideCanvas);

        const sideMat = new THREE.MeshStandardMaterial({
          map: sideTex,
          roughness: 0.9,
          metalness: 0.0,
        });

        const bottomMat = new THREE.MeshStandardMaterial({
          color: BOARD.BOTTOM_COLOR,
          roughness: 0.95,
          metalness: 0.0,
        });

        // +x, -x, +y (top), -y (bottom), +z, -z
        const materials = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
        const tile = new THREE.Mesh(tileGeo, materials);
        const [x, , z] = posToWorld({ col, row }, BOARD.TILE_SIZE, BOARD.OFFSET);
        tile.position.set(x, -BOARD.TILE_HEIGHT / 2, z);
        tile.receiveShadow = true;
        tile.castShadow = true;

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
