import * as THREE from 'three';
import { PIECES, PIECE_SHAPES, BOARD } from './config';
import { squareToWorld } from './chess';
import type { PieceType, PieceColor, ChessSquare, ChessPiece } from './types';

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
 * Manages all piece meshes on the board.
 */
export class PieceManager {
  readonly group = new THREE.Group();
  private pieces = new Map<string, ChessPiece>();

  /** Place all pieces from chess engine state */
  setupPieces(allPieces: { type: PieceType; color: PieceColor; square: ChessSquare }[]): void {
    this.clear();

    for (const p of allPieces) {
      this.addPiece(p.type, p.color, p.square);
    }
  }

  /** Add a single piece to the board */
  addPiece(type: PieceType, color: PieceColor, square: ChessSquare): ChessPiece {
    const mesh = createPieceMesh(type, color);
    const [x, , z] = squareToWorld(square, BOARD.TILE_SIZE, BOARD.OFFSET);
    mesh.position.set(x, 0, z);

    const id = `${color}-${type}-${square}-${Date.now()}`;
    const piece: ChessPiece = { type, color, square, mesh, id };

    this.pieces.set(square, piece);
    this.group.add(mesh);

    return piece;
  }

  /** Get piece at a square */
  getPieceAt(square: ChessSquare): ChessPiece | undefined {
    return this.pieces.get(square);
  }

  /** Remove piece from a square (for captures) */
  removePieceAt(square: ChessSquare): ChessPiece | undefined {
    const piece = this.pieces.get(square);
    if (piece && piece.mesh) {
      this.group.remove(piece.mesh);
      // Dispose geometry and materials
      piece.mesh.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
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

    const start = piece.mesh.position.clone();
    const [tx, , tz] = squareToWorld(targetSquare, BOARD.TILE_SIZE, BOARD.OFFSET);
    const end = new THREE.Vector3(tx, 0, tz);
    let elapsed = 0;

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
          onComplete();
          return true; // done
        }
        return false; // still animating
      }
    };
  }

  /** For castling: also move the rook */
  handleCastling(
    move: { from: ChessSquare; to: ChessSquare; flags: string },
    duration: number,
    onComplete: () => void
  ): { update: (dt: number) => boolean } | null {
    // Kingside castle: king moves from e→g, rook from h→f
    // Queenside castle: king moves from e→c, rook from a→d
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

    return this.animateMove(rook, rookTo, duration, onComplete);
  }

  /** Clear all pieces */
  clear(): void {
    for (const [square] of this.pieces) {
      this.removePieceAt(square as ChessSquare);
    }
    this.pieces.clear();
  }

  /** Get all pieces (for test seam / state dump) */
  getAllPieces(): ChessPiece[] {
    return Array.from(this.pieces.values());
  }
}
