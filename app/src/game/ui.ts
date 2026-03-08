import type { PieceColor, PieceType, CapturedPiece, GamePhase } from './types';

/** Unicode chess symbols */
const PIECE_SYMBOLS: Record<PieceType, Record<PieceColor, string>> = {
  k: { w: '♔', b: '♚' },
  q: { w: '♕', b: '♛' },
  r: { w: '♖', b: '♜' },
  b: { w: '♗', b: '♝' },
  n: { w: '♘', b: '♞' },
  p: { w: '♙', b: '♟' },
};

/** Piece names for display */
const PIECE_NAMES: Record<PieceType, string> = {
  k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn',
};

type PromotionCallback = (piece: PieceType) => void;

/**
 * Parchment HUD — turn indicator, captured pieces, game status.
 * Manipulates DOM elements defined in index.html.
 */
export class UIManager {
  private turnIndicator: HTMLElement;
  private capturedWhiteEl: HTMLElement;
  private capturedBlackEl: HTMLElement;
  private gameOverOverlay: HTMLElement;
  private gameOverTitle: HTMLElement;
  private gameOverMessage: HTMLElement;
  private newGameBtn: HTMLElement;
  private promotionOverlay: HTMLElement;
  private promotionChoices: HTMLElement;

  private onNewGame: (() => void) | null = null;

  constructor() {
    this.turnIndicator = document.getElementById('turn-indicator')!;
    this.capturedWhiteEl = document.querySelector('#captured-white .pieces')!;
    this.capturedBlackEl = document.querySelector('#captured-black .pieces')!;
    this.gameOverOverlay = document.getElementById('game-over-overlay')!;
    this.gameOverTitle = document.getElementById('game-over-title')!;
    this.gameOverMessage = document.getElementById('game-over-message')!;
    this.newGameBtn = document.getElementById('new-game-btn')!;
    this.promotionOverlay = document.getElementById('promotion-overlay')!;
    this.promotionChoices = document.getElementById('promotion-choices')!;

    this.newGameBtn.addEventListener('click', () => {
      this.onNewGame?.();
    });
  }

  setNewGameHandler(handler: () => void): void {
    this.onNewGame = handler;
  }

  /** Update turn indicator */
  updateTurn(turn: PieceColor, isCheck: boolean): void {
    const colorName = turn === 'w' ? 'White' : 'Black';
    this.turnIndicator.textContent = `${colorName}'s Turn`;
    if (isCheck) {
      this.turnIndicator.textContent += ' — Check!';
      this.turnIndicator.classList.add('check');
    } else {
      this.turnIndicator.classList.remove('check');
    }
  }

  /** Update captured pieces display */
  updateCaptured(captured: CapturedPiece[]): void {
    const whiteCaptured = captured.filter(p => p.color === 'w');
    const blackCaptured = captured.filter(p => p.color === 'b');

    // Sort by value: Q > R > B > N > P
    const order: PieceType[] = ['q', 'r', 'b', 'n', 'p'];
    const sortFn = (a: CapturedPiece, b: CapturedPiece) =>
      order.indexOf(a.type) - order.indexOf(b.type);

    this.capturedWhiteEl.textContent = whiteCaptured
      .sort(sortFn)
      .map(p => PIECE_SYMBOLS[p.type][p.color])
      .join('');

    this.capturedBlackEl.textContent = blackCaptured
      .sort(sortFn)
      .map(p => PIECE_SYMBOLS[p.type][p.color])
      .join('');
  }

  /** Show game over overlay */
  showGameOver(reason: 'checkmate' | 'stalemate' | 'draw', winner?: PieceColor): void {
    this.gameOverOverlay.classList.remove('hidden');

    switch (reason) {
      case 'checkmate': {
        const winnerName = winner === 'w' ? 'White' : 'Black';
        this.gameOverTitle.textContent = 'Checkmate!';
        this.gameOverMessage.textContent = `${winnerName} wins!`;
        break;
      }
      case 'stalemate':
        this.gameOverTitle.textContent = 'Stalemate';
        this.gameOverMessage.textContent = 'The game is a draw.';
        break;
      case 'draw':
        this.gameOverTitle.textContent = 'Draw';
        this.gameOverMessage.textContent = 'The game is a draw.';
        break;
    }
  }

  /** Hide game over overlay */
  hideGameOver(): void {
    this.gameOverOverlay.classList.add('hidden');
  }

  /** Show promotion choice dialog */
  showPromotion(color: PieceColor, callback: PromotionCallback): void {
    this.promotionOverlay.classList.remove('hidden');
    this.promotionChoices.innerHTML = '';

    const options: PieceType[] = ['q', 'r', 'b', 'n'];
    for (const type of options) {
      const btn = document.createElement('button');
      btn.textContent = PIECE_SYMBOLS[type][color];
      btn.title = PIECE_NAMES[type];
      btn.addEventListener('click', () => {
        this.hidePromotion();
        callback(type);
      });
      this.promotionChoices.appendChild(btn);
    }
  }

  /** Hide promotion dialog */
  hidePromotion(): void {
    this.promotionOverlay.classList.add('hidden');
  }

  /** Reset UI to initial state */
  reset(): void {
    this.updateTurn('w', false);
    this.capturedWhiteEl.textContent = '';
    this.capturedBlackEl.textContent = '';
    this.hideGameOver();
    this.hidePromotion();
  }
}
