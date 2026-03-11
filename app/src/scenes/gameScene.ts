import * as THREE from 'three';
import { ChessEngine } from '../game/chess';
import { IsometricCamera } from '../game/camera';
import { BoardGrid } from '../game/grid';
import { PieceManager } from '../game/pieces';
import { InputManager } from '../game/input';
import { UIManager } from '../game/ui';
import { Choreographer, getDramaLevel } from '../game/choreography';
import { BOARD, PIECES, ENVIRONMENT } from '../game/config';
import { squareToPos } from '../game/chess';
import type { GamePhase, GameState, ChessSquare, PieceType, CapturedPiece, Move } from '../game/types';

/** Calculate move duration based on Chebyshev distance (tiles) between squares */
function moveDuration(from: ChessSquare, to: ChessSquare): number {
  const f = squareToPos(from);
  const t = squareToPos(to);
  const dist = Math.max(Math.abs(t.col - f.col), Math.abs(t.row - f.row));
  const raw = dist * PIECES.MOVE_DURATION_PER_TILE;
  return Math.max(PIECES.MOVE_DURATION_MIN, Math.min(PIECES.MOVE_DURATION_MAX, raw));
}

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
  private choreographer: Choreographer;

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

    // Choreographer
    this.choreographer = new Choreographer();

    // Input
    this.input = new InputManager(canvas);
    this.input.setHandler(action => this.handleInput(action));

    // UI
    this.ui = new UIManager();
    this.ui.setNewGameHandler(() => this.resetGame());

    // Place initial pieces (placeholder), then try loading sprites
    this.setupPieces();
    this.loadSprites();
    this.updateUI();

    // Test seam
    this.setupTestSeam();
  }

  /** Main update loop — call each frame */
  update(dt: number): void {
    // Camera
    this.cameraRig.update(dt);

    // Camera shake from choreographer
    this.choreographer.updateShake(dt, this.cameraRig.camera);

    // Animations — mutate in place so external references stay valid
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      if (this.activeAnimations[i].update(dt)) {
        this.activeAnimations.splice(i, 1);
      }
    }

    // Sprite animations
    this.pieceManager.updateSprites(dt, this.cameraRig.octant);
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

    // When a piece is selected, prefer tile picking (for move targets),
    // fall back to piece picking (for reselecting another piece).
    // When idle, prefer piece picking (for selecting a character to play).
    const tileSquare = this.grid.pickTile(mouse, this.camera);
    const pieceSquare = this.pieceManager.pickPiece(mouse, this.camera);
    const square = this.phase === 'PIECE_SELECTED'
      ? (tileSquare ?? pieceSquare)
      : (pieceSquare ?? tileSquare);
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

    // Detect capture info BEFORE making the engine move
    const capturedPieceInfo = this.engine.pieceAt(to);
    const isEnPassant = this.validMoves.some(m => m.from === from && m.to === to && m.flags.includes('e'));
    const isCapture = isEnPassant || !!capturedPieceInfo;

    // Get the visual pieces for choreography
    const attackerVisual = this.pieceManager.getPieceAt(from);
    const captureSquare = isEnPassant ? (to[0] + from[1]) as ChessSquare : to;
    const defenderVisual = isCapture ? this.pieceManager.getPieceAt(captureSquare) : undefined;

    // Execute in chess engine first
    const chessMove = this.engine.makeMove(from, to, promotion || undefined);
    if (!chessMove) {
      this.phase = 'IDLE';
      this.input.setEnabled(true);
      return;
    }

    this.lastMove = chessMove;

    // Handle promotion piece replacement (no choreography)
    if (promotion) {
      // Remove the pawn visual
      this.pieceManager.removePieceAt(from);
      // Remove captured piece if promotion is also a capture
      if (defenderVisual) {
        this.pieceManager.removePieceAt(captureSquare);
        this.capturedPieces.push({
          type: defenderVisual.type, color: defenderVisual.color, id: defenderVisual.id,
        });
      }
      // Add promoted piece as sprite (async)
      const color = chessMove.color;
      this.pieceManager.addPieceAsync(promotion, color, to).then(() => {
        this.finishMove();
      });
      return;
    }

    // --- Capture with choreography ---
    if (isCapture && attackerVisual && defenderVisual) {
      const dramaLevel = getDramaLevel(attackerVisual.type, defenderVisual.type);

      // Detach defender from map (keeps mesh in scene for fade-out)
      this.pieceManager.detachPiece(captureSquare);

      // Update piece manager map: attacker moves from→to
      this.pieceManager.movePiece(from, to);

      // Run choreography (async)
      this.choreographer.playCaptureSequence({
        attacker: attackerVisual,
        defender: defenderVisual,
        from,
        to,
        dramaLevel,
        pieceManager: this.pieceManager,
        cameraOctant: this.cameraRig.octant,
        scene: this.scene,
        activeAnimations: this.activeAnimations,
      }).then(() => {
        // Fully dispose defender after fade
        this.pieceManager.disposePiece(defenderVisual);
        this.capturedPieces.push({
          type: defenderVisual.type, color: defenderVisual.color, id: defenderVisual.id,
        });
        this.finishMove();
      }).catch((err) => {
        console.error('[Choreography] Capture sequence failed:', err);
        // Fallback: clean up and finish
        this.pieceManager.disposePiece(defenderVisual);
        this.capturedPieces.push({
          type: defenderVisual.type, color: defenderVisual.color, id: defenderVisual.id,
        });
        this.finishMove();
      });

      return;
    }

    // --- Normal move (no capture) ---
    const movingPiece = this.pieceManager.movePiece(from, to);
    if (!movingPiece) {
      this.finishMove();
      return;
    }

    // Set sprite facing direction for the move
    this.pieceManager.setSpriteDirection(movingPiece, from, to, this.cameraRig.octant);

    const duration = moveDuration(from, to);
    const anim = this.pieceManager.animateMove(movingPiece, to, duration, () => {
      // Handle castling rook
      if (chessMove.flags.includes('k') || chessMove.flags.includes('q')) {
        const rookAnim = this.pieceManager.handleCastling(
          chessMove as { from: ChessSquare; to: ChessSquare; flags: string },
          PIECES.MOVE_DURATION_PER_TILE * 2,
          () => this.finishMove(),
          this.cameraRig.octant
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

  /** Load sprite assets and re-setup pieces with sprites if available */
  private async loadSprites(): Promise<void> {
    await this.pieceManager.loadCharacters();
    if (this.pieceManager.useSpriteMode) {
      const allPieces = this.engine.getAllPieces();
      await this.pieceManager.setupPiecesAsync(allPieces);
    }
  }

  resetGame(): void {
    this.engine.reset();
    this.phase = 'IDLE';
    this.selectedSquare = null;
    this.validMoves = [];
    this.capturedPieces = [];
    this.lastMove = null;
    this.activeAnimations = [];

    // Use async setup if sprites are loaded, sync fallback otherwise
    if (this.pieceManager.useSpriteMode) {
      const allPieces = this.engine.getAllPieces();
      this.pieceManager.setupPiecesAsync(allPieces);
    } else {
      this.setupPieces();
    }
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
