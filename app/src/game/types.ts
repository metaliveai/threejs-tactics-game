import type { Chess, Square as ChessSquare, Move, PieceSymbol, Color } from 'chess.js';
import type { Object3D } from 'three';
import type { SpriteAnimator } from './spriteAnimator';

// Re-export chess.js types we use
export type { Chess, Move, PieceSymbol, Color, ChessSquare };

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type PieceColor = 'w' | 'b';

/** 8 cardinal/diagonal directions */
export type Direction8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** Board position in grid coordinates (0-7, 0-7) */
export interface BoardPos {
  col: number; // 0=a, 7=h
  row: number; // 0=rank1, 7=rank8
}

/** Frame-based sprite action definition (PixelLab per-frame format) */
export interface SpriteAction {
  /** Frame image paths per direction, relative to character root */
  framePaths: Record<Direction8, string[]>;
  /** Frame size in pixels */
  frameSize: { w: number; h: number };
  /** Animation timing */
  timing: { frameMs: number; loop: boolean };
}

/** Full character definition parsed from PixelLab metadata */
export interface CharacterDef {
  name: string;
  root: string;
  directions: Direction8[];
  actions: Record<string, SpriteAction>;
}

/** Mapping of chess piece to character definition key */
export interface PieceCharacterMap {
  type: PieceType;
  color: PieceColor;
  characterKey: string;
}

/** A chess piece on the board */
export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  square: ChessSquare;
  mesh: Object3D | null;
  spriteAnimator: SpriteAnimator | null;
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

/** Camera rotation step — 8 positions at 45° each (0=default, 1=45°, ..., 7=315°) */
export type CameraOctant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
