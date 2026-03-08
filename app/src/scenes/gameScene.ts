import * as THREE from 'three';
import { ChessEngine } from '../game/chess';
import { IsometricCamera } from '../game/camera';
import { BoardGrid } from '../game/grid';
import { PieceManager } from '../game/pieces';
import { InputManager } from '../game/input';
import { UIManager } from '../game/ui';
import { BOARD, PIECES, ENVIRONMENT } from '../game/config';
import type { GamePhase, GameState, ChessSquare, PieceType, CapturedPiece, Move } from '../game/types';

/**
 * Main game orchestrator — state machine, game loop, system wiring.
 * Owns the scene, all subsystems, and the game state.
 */
export class GameScene {
  readonly scene = new THREE.Scene();
  readonly cameraRig: IsometricCamera;

  private engine: ChessEngine;
  private grid: BoardGrid;
  private pieceManager: PieceManager;
  private input: InputManager;
  private ui: UIManager;

  private phase: GamePhase = 'IDLE';
  private selectedSquare: ChessSquare | null = null;
  private validMoves: Move[] = [];
  private capturedPieces: CapturedPiece[] = [];
  private lastMove: Move | null = null;

  /** Active move animations */
  private activeAnimations: { update: (dt: number) => boolean }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    // Chess engine
    this.engine = new ChessEngine();

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.cameraRig = new IsometricCamera(aspect);

    // Scene setup
    this.scene.background = new THREE.Color(ENVIRONMENT.BG_COLOR);

    // Lighting
    const ambient = new THREE.AmbientLight(ENVIRONMENT.AMBIENT_LIGHT, ENVIRONMENT.AMBIENT_INTENSITY);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(ENVIRONMENT.DIR_LIGHT_COLOR, ENVIRONMENT.DIR_LIGHT_INTENSITY);
    dirLight.position.set(...ENVIRONMENT.DIR_LIGHT_POS);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 30;
    dirLight.shadow.camera.left = -8;
    dirLight.shadow.camera.right = 8;
    dirLight.shadow.camera.top = 8;
    dirLight.shadow.camera.bottom = -8;
    this.scene.add(dirLight);

    // Board grid
    this.grid = new BoardGrid();
    this.scene.add(this.grid.group);

    // Piece manager
    this.pieceManager = new PieceManager();
    this.scene.add(this.pieceManager.group);

    // Input
    this.input = new InputManager(canvas);
    this.input.setHandler(action => this.handleInput(action));

    // UI
    this.ui = new UIManager();
    this.ui.setNewGameHandler(() => this.resetGame());

    // Place initial pieces
    this.setupPieces();
    this.updateUI();

    // Test seam
    this.setupTestSeam();
  }

  /** Main update loop — call each frame */
  update(dt: number): void {
    // Camera
    this.cameraRig.update(dt);

    // Animations
    this.activeAnimations = this.activeAnimations.filter(anim => !anim.update(dt));
  }

  /** Handle resize */
  resize(width: number, height: number): void {
    this.cameraRig.resize(width / height);
  }

  get camera(): THREE.OrthographicCamera {
    return this.cameraRig.camera;
  }

  // --- Input handling ---

  private handleInput(action: import('../game/input').InputAction): void {
    switch (action.type) {
      case 'click':
        this.handleClick(action.mouse);
        break;
      case 'rotate_cw':
        this.cameraRig.rotateCW();
        break;
      case 'rotate_ccw':
        this.cameraRig.rotateCCW();
        break;
      case 'deselect':
        this.deselect();
        break;
      case 'zoom':
        this.cameraRig.applyZoom(action.delta);
        break;
      case 'pan':
        this.cameraRig.applyPan(action.dx, action.dy);
        break;
    }
  }

  private handleClick(mouse: THREE.Vector2): void {
    if (this.phase === 'ANIMATING' || this.phase === 'GAME_OVER' || this.phase === 'PROMOTING') {
      return;
    }

    const square = this.grid.pickTile(mouse, this.camera);
    if (!square) return;

    if (this.phase === 'IDLE') {
      this.trySelectPiece(square);
    } else if (this.phase === 'PIECE_SELECTED') {
      // Click on another own piece → reselect
      const piece = this.engine.pieceAt(square);
      if (piece && piece.color === this.engine.turn) {
        this.trySelectPiece(square);
        return;
      }

      // Click on valid move target
      const move = this.validMoves.find(m => m.to === square);
      if (move) {
        this.executeMove(this.selectedSquare!, square, move);
      } else {
        // Invalid target → deselect
        this.deselect();
      }
    }
  }

  private trySelectPiece(square: ChessSquare): void {
    const piece = this.engine.pieceAt(square);
    if (!piece || piece.color !== this.engine.turn) {
      this.deselect();
      return;
    }

    const moves = this.engine.getValidMoves(square);
    if (moves.length === 0) {
      // Piece has no legal moves
      this.deselect();
      return;
    }

    this.selectedSquare = square;
    this.validMoves = moves;
    this.phase = 'PIECE_SELECTED';
    this.grid.showMoves(square, moves);

    // Also show check highlight if king is in check
    if (this.engine.isCheck) {
      const kingSquare = this.engine.findKing(this.engine.turn);
      if (kingSquare) this.grid.showCheck(kingSquare);
    }
  }

  private executeMove(from: ChessSquare, to: ChessSquare, move: Move): void {
    // Check for promotion
    if (this.engine.isPromotion(from, to)) {
      this.phase = 'PROMOTING';
      this.grid.clearOverlays();
      this.ui.showPromotion(this.engine.turn, (promotionPiece: PieceType) => {
        this.doMove(from, to, promotionPiece);
      });
      return;
    }

    this.doMove(from, to);
  }

  private doMove(from: ChessSquare, to: ChessSquare, promotion?: PieceType): void {
    this.phase = 'ANIMATING';
    this.input.setEnabled(false);
    this.grid.clearOverlays();

    // Handle capture — remove captured piece before move
    const capturedPieceInfo = this.engine.pieceAt(to);
    const isEnPassant = this.validMoves.some(m => m.from === from && m.to === to && m.flags.includes('e'));

    // For en passant, the captured piece is not on 'to' square
    if (isEnPassant) {
      const epSquare = (to[0] + from[1]) as ChessSquare;
      const captured = this.pieceManager.removePieceAt(epSquare);
      if (captured) {
        this.capturedPieces.push({ type: captured.type, color: captured.color, id: captured.id });
      }
    } else if (capturedPieceInfo) {
      const captured = this.pieceManager.removePieceAt(to);
      if (captured) {
        this.capturedPieces.push({ type: captured.type, color: captured.color, id: captured.id });
      }
    }

    // Execute in chess engine
    const chessMove = this.engine.makeMove(from, to, promotion || undefined);
    if (!chessMove) {
      // Should not happen — we validated via getValidMoves
      this.phase = 'IDLE';
      this.input.setEnabled(true);
      return;
    }

    this.lastMove = chessMove;

    // Handle promotion piece replacement
    if (promotion) {
      // Remove pawn, add promoted piece
      this.pieceManager.removePieceAt(from);
      const color = chessMove.color;
      this.pieceManager.addPiece(promotion, color, to);
      this.finishMove();
      return;
    }

    // Animate piece movement
    const movingPiece = this.pieceManager.movePiece(from, to);
    if (!movingPiece) {
      this.finishMove();
      return;
    }

    const anim = this.pieceManager.animateMove(movingPiece, to, PIECES.MOVE_DURATION, () => {
      // Handle castling rook
      if (chessMove.flags.includes('k') || chessMove.flags.includes('q')) {
        const rookAnim = this.pieceManager.handleCastling(
          chessMove as { from: ChessSquare; to: ChessSquare; flags: string },
          PIECES.MOVE_DURATION,
          () => this.finishMove()
        );
        if (rookAnim) {
          this.activeAnimations.push(rookAnim);
          return;
        }
      }
      this.finishMove();
    });
    this.activeAnimations.push(anim);
  }

  private finishMove(): void {
    this.input.setEnabled(true);

    // Check game over conditions
    if (this.engine.isCheckmate) {
      this.phase = 'GAME_OVER';
      const winner = this.engine.turn === 'w' ? 'b' : 'w'; // The one who just moved wins
      this.ui.showGameOver('checkmate', winner);
      this.updateUI();
      return;
    }
    if (this.engine.isStalemate) {
      this.phase = 'GAME_OVER';
      this.ui.showGameOver('stalemate');
      this.updateUI();
      return;
    }
    if (this.engine.isDraw) {
      this.phase = 'GAME_OVER';
      this.ui.showGameOver('draw');
      this.updateUI();
      return;
    }

    this.phase = 'IDLE';
    this.selectedSquare = null;
    this.validMoves = [];
    this.updateUI();
  }

  private deselect(): void {
    this.selectedSquare = null;
    this.validMoves = [];
    this.phase = 'IDLE';
    this.grid.clearOverlays();

    // Re-show check highlight if applicable
    if (this.engine.isCheck) {
      const kingSquare = this.engine.findKing(this.engine.turn);
      if (kingSquare) this.grid.showCheck(kingSquare);
    }
  }

  private updateUI(): void {
    this.ui.updateTurn(this.engine.turn, this.engine.isCheck);
    this.ui.updateCaptured(this.capturedPieces);
  }

  // --- Setup ---

  private setupPieces(): void {
    const allPieces = this.engine.getAllPieces();
    this.pieceManager.setupPieces(allPieces);
  }

  resetGame(): void {
    this.engine.reset();
    this.phase = 'IDLE';
    this.selectedSquare = null;
    this.validMoves = [];
    this.capturedPieces = [];
    this.lastMove = null;
    this.activeAnimations = [];

    this.setupPieces();
    this.grid.clearOverlays();
    this.ui.reset();
    this.input.setEnabled(true);
  }

  // --- Test seam ---

  private setupTestSeam(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('test') !== '1') return;

    window.__TEST__ = {
      ready: true,
      state: () => ({
        phase: this.phase,
        turn: this.engine.turn,
        fen: this.engine.fen,
        selectedSquare: this.selectedSquare,
        check: this.engine.isCheck,
        checkmate: this.engine.isCheckmate,
        stalemate: this.engine.isStalemate,
        capturedPieces: this.capturedPieces,
        pieces: this.pieceManager.getAllPieces().map(p => ({
          type: p.type,
          color: p.color,
          square: p.square,
          id: p.id,
        })),
      }),
      commands: {
        reset: () => this.resetGame(),
      },
    };
  }
}
