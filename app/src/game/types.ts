import type { Chess, Square as ChessSquare, Move, PieceSymbol, Color } from 'chess.js';
import type { Object3D } from 'three';

// Re-export chess.js types we use
export type { Chess, Move, PieceSymbol, Color, ChessSquare };

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type PieceColor = 'w' | 'b';

/** Board position in grid coordinates (0-7, 0-7) */
export interface BoardPos {
  col: number; // 0=a, 7=h
  row: number; // 0=rank1, 7=rank8
}

/** A chess piece on the board */
export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  square: ChessSquare;
  mesh: Object3D | null;
  id: string; // unique id e.g. "w-k-e1"
}

/** Captured piece record */
export interface CapturedPiece {
  type: PieceType;
  color: PieceColor;
  id: string;
}

export type GamePhase =
  | 'IDLE'           // waiting for piece selection
  | 'PIECE_SELECTED' // piece selected, showing moves
  | 'ANIMATING'      // piece moving
  | 'PROMOTING'      // pawn promotion choice
  | 'GAME_OVER';     // checkmate/stalemate/draw

export interface GameState {
  phase: GamePhase;
  turn: PieceColor;
  selectedSquare: ChessSquare | null;
  validMoves: Move[];
  pieces: Map<string, ChessPiece>; // keyed by square
  capturedPieces: CapturedPiece[];
  check: boolean;
  checkmate: boolean;
  stalemate: boolean;
  draw: boolean;
  lastMove: Move | null;
}

/** Camera rotation quarter (0=default, 1=90°, 2=180°, 3=270°) */
export type CameraQuarter = 0 | 1 | 2 | 3;

/** Test seam exposed on window */
export interface TestSeam {
  ready: boolean;
  state: () => object;
  commands: {
    reset: () => void;
  };
}

declare global {
  interface Window {
    __TEST__?: TestSeam;
  }
}
