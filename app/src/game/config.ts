/** Board constants */
export const BOARD = {
  SIZE: 8,
  TILE_SIZE: 1.0,
  /** Offset so board is centered at origin */
  get OFFSET() {
    return (this.SIZE * this.TILE_SIZE) / 2 - this.TILE_SIZE / 2;
  },
  LIGHT_COLOR: 0xd4c4a8, // warm ivory marble (HP castle floor)
  DARK_COLOR: 0x4a4455,  // dark blue-grey stone (HP castle floor)
  HIGHLIGHT_MOVE: 0x4488ff,   // blue overlay for valid moves
  HIGHLIGHT_CAPTURE: 0xff4444, // red overlay for captures
  HIGHLIGHT_SELECTED: 0xffff44, // yellow for selected piece
  HIGHLIGHT_CHECK: 0xff2222,   // red for king in check
  OVERLAY_OPACITY: 0.45,
  TILE_HEIGHT: 0.6,
  SIDE_COLOR_LIGHT: 0xa89880,  // darker stone for light tile sides
  SIDE_COLOR_DARK: 0x332e3a,   // deeper blue-grey for dark tile sides
  BOTTOM_COLOR: 0x2a2530,      // deep shadow underside
  TILE_GAP: 0.02,              // small gap between tiles for grid lines
} as const;

/** Camera constants */
export const CAMERA = {
  /** True isometric angle from horizontal */
  ISO_ANGLE: Math.atan(1 / Math.sqrt(2)), // ~35.264°
  DISTANCE: 12,
  ZOOM: 1.0,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 2.5,
  ROTATION_SPEED: 2.0, // seconds for 90° rotation
  PAN_SPEED: 0.01,
  FRUSTUM_SIZE: 8,
} as const;

/** Piece visual constants */
export const PIECES = {
  WHITE_COLOR: 0xe8d5b7,
  BLACK_COLOR: 0x2d1b2e,
  WHITE_ACCENT: 0xfff5e6,
  BLACK_ACCENT: 0x5a3660,
  MOVE_DURATION_PER_TILE: 0.18, // seconds per tile of distance
  MOVE_DURATION_MIN: 0.25,      // minimum duration (1-tile moves)
  MOVE_DURATION_MAX: 1.4,       // cap for longest moves
  PIECE_SCALE: 0.35,
} as const;

/** Environment constants */
export const ENVIRONMENT = {
  BG_COLOR: 0x0a0a12,
  AMBIENT_LIGHT: 0x8888aa,
  AMBIENT_INTENSITY: 0.6,
  DIR_LIGHT_COLOR: 0xffeedd,
  DIR_LIGHT_INTENSITY: 0.8,
  DIR_LIGHT_POS: [5, 10, 5] as [number, number, number],
} as const;

/** Piece shape definitions for placeholder meshes */
export const PIECE_SHAPES = {
  k: { name: 'King', baseRadius: 0.3, baseHeight: 0.8, topShape: 'cross' },
  q: { name: 'Queen', baseRadius: 0.3, baseHeight: 0.75, topShape: 'crown' },
  b: { name: 'Bishop', baseRadius: 0.25, baseHeight: 0.65, topShape: 'angle' },
  n: { name: 'Knight', baseRadius: 0.25, baseHeight: 0.6, topShape: 'sphere' },
  r: { name: 'Rook', baseRadius: 0.3, baseHeight: 0.55, topShape: 'flat' },
  p: { name: 'Pawn', baseRadius: 0.2, baseHeight: 0.4, topShape: 'ball' },
} as const;

/** Character key mapping: chess piece (color + type) → character key in asset_index.json */
export const CHARACTER_MAP: Record<string, Record<string, string>> = {
  w: {
    k: 'human_king',
    q: 'sorceress',
    b: 'priest',
    n: 'mounted_knight',
    r: 'stone_golem',
    p: 'foot_soldier',
  },
  b: {
    k: 'dark_king',
    q: 'necromancer',
    b: 'dark_mage',
    n: 'death_knight',
    r: 'dark_golem',
    p: 'skeleton_warrior',
  },
} as const;

/** Sprite rendering constants */
export const SPRITES = {
  /** World-space height for sprite billboards */
  SPRITE_SCALE: 1.2,
  /** Y offset above tile surface */
  SPRITE_Y_OFFSET: 0.5,
  /** Default idle direction for white and black pieces */
  DEFAULT_DIR_WHITE: 'S' as const,
  DEFAULT_DIR_BLACK: 'N' as const,
} as const;
