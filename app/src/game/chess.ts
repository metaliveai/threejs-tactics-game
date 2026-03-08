import { Chess } from 'chess.js';
import type { Move, PieceColor, PieceType, ChessSquare, BoardPos } from './types';

/**
 * Chess.js wrapper — single source of truth for game logic.
 * The 3D layer is a pure renderer of the state this module exposes.
 */
export class ChessEngine {
  private game: Chess;

  constructor(fen?: string) {
    this.game = new Chess(fen);
  }

  /** Current FEN string */
  get fen(): string {
    return this.game.fen();
  }

  /** Whose turn is it */
  get turn(): PieceColor {
    return this.game.turn();
  }

  get isCheck(): boolean {
    return this.game.isCheck();
  }

  get isCheckmate(): boolean {
    return this.game.isCheckmate();
  }

  get isStalemate(): boolean {
    return this.game.isStalemate();
  }

  get isDraw(): boolean {
    return this.game.isDraw();
  }

  get isGameOver(): boolean {
    return this.game.isGameOver();
  }

  /** Get the piece at a square, or null */
  pieceAt(square: ChessSquare): { type: PieceType; color: PieceColor } | null {
    return this.game.get(square) || null;
  }

  /** Get all valid moves for a square, or all moves if no square given */
  getValidMoves(square?: ChessSquare): Move[] {
    if (square) {
      return this.game.moves({ square, verbose: true });
    }
    return this.game.moves({ verbose: true });
  }

  /** Execute a move. Returns the Move object or null if invalid. */
  makeMove(from: ChessSquare, to: ChessSquare, promotion?: PieceType): Move | null {
    try {
      const move = this.game.move({ from, to, promotion });
      return move;
    } catch {
      return null;
    }
  }

  /** Check if a move would be a promotion */
  isPromotion(from: ChessSquare, to: ChessSquare): boolean {
    const moves = this.game.moves({ square: from, verbose: true });
    return moves.some(m => m.to === to && m.promotion);
  }

  /** Get all pieces currently on the board */
  getAllPieces(): { type: PieceType; color: PieceColor; square: ChessSquare }[] {
    const pieces: { type: PieceType; color: PieceColor; square: ChessSquare }[] = [];
    const board = this.game.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const p = board[row][col];
        if (p) {
          const square = posToSquare({ col, row: 7 - row });
          pieces.push({ type: p.type as PieceType, color: p.color as PieceColor, square });
        }
      }
    }
    return pieces;
  }

  /** Find the king's square for a given color */
  findKing(color: PieceColor): ChessSquare | null {
    const pieces = this.getAllPieces();
    const king = pieces.find(p => p.type === 'k' && p.color === color);
    return king?.square ?? null;
  }

  /** Reset the game */
  reset(): void {
    this.game.reset();
  }

  /** Undo last move */
  undo(): Move | null {
    return this.game.undo();
  }
}

// --- Coordinate conversion utilities ---

const FILES = 'abcdefgh';

/** Convert algebraic notation (e.g. "e4") to board position */
export function squareToPos(square: ChessSquare): BoardPos {
  const col = FILES.indexOf(square[0]);
  const row = parseInt(square[1]) - 1;
  return { col, row };
}

/** Convert board position to algebraic notation */
export function posToSquare(pos: BoardPos): ChessSquare {
  return (FILES[pos.col] + (pos.row + 1)) as ChessSquare;
}

/** Convert board position to world coordinates (centered at origin) */
export function posToWorld(pos: BoardPos, tileSize: number, offset: number): [number, number, number] {
  const x = pos.col * tileSize - offset;
  const z = pos.row * tileSize - offset;
  return [x, 0, z];
}

/** Convert algebraic square to world coordinates */
export function squareToWorld(square: ChessSquare, tileSize: number, offset: number): [number, number, number] {
  return posToWorld(squareToPos(square), tileSize, offset);
}
