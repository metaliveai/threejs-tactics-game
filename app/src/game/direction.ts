import type { BoardPos, Direction8, CameraOctant } from './types';

/**
 * 8-direction system for sprite sheet row selection.
 *
 * Maps world movement direction to sprite sheet row, accounting for
 * camera rotation (Q/E quarter turns). The sprite sheet row order is
 * defined in asset_index.json per-clip — we resolve direction first,
 * then look up the row from the clip data.
 */

/** All 8 directions in clockwise order starting from N */
export const DIRECTIONS: readonly Direction8[] = [
  'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW',
] as const;

/** Index of each direction in the clockwise ring (for rotation math) */
const DIR_INDEX: Record<Direction8, number> = {
  N: 0, NE: 1, E: 2, SE: 3, S: 4, SW: 5, W: 6, NW: 7,
};

/**
 * Compute the world direction from one board position to another.
 * Uses sign of delta-col and delta-row to pick one of 8 directions.
 *
 * Board coordinate system:
 *   col+ = east (a→h), row+ = north (rank 1→8)
 *
 * Returns null if from === to (no movement).
 */
export function getDirection(from: BoardPos, to: BoardPos): Direction8 | null {
  const dc = to.col - from.col;
  const dr = to.row - from.row;

  if (dc === 0 && dr === 0) return null;

  // Normalize to sign only (-1, 0, +1)
  const sx = Math.sign(dc); // -1=west, 0=none, +1=east
  const sy = Math.sign(dr); // -1=south, 0=none, +1=north

  // Map (sx, sy) → Direction8
  if (sx === 0 && sy === 1) return 'N';
  if (sx === 1 && sy === 1) return 'NE';
  if (sx === 1 && sy === 0) return 'E';
  if (sx === 1 && sy === -1) return 'SE';
  if (sx === 0 && sy === -1) return 'S';
  if (sx === -1 && sy === -1) return 'SW';
  if (sx === -1 && sy === 0) return 'W';
  if (sx === -1 && sy === 1) return 'NW';

  return null; // unreachable
}

/**
 * Rotate a world direction to account for camera rotation.
 *
 * Camera octant 0 = default view (white at bottom).
 * Each increment rotates the view 45° clockwise.
 * Since we have 8 directions and 8 octants, each octant step
 * maps exactly to 1 step in the direction ring.
 */
export function rotateDirection(dir: Direction8, cameraOctant: CameraOctant): Direction8 {
  const idx = DIR_INDEX[dir];
  const rotated = (idx + cameraOctant) % 8;
  return DIRECTIONS[rotated];
}

/**
 * Flip a direction's N/S component to convert between board coords and screen coords.
 * Board row+ = 'N' but screen z+ = down = visual 'S', so N↔S, NE↔SE, NW↔SW.
 */
export function flipBoardToScreen(dir: Direction8): Direction8 {
  const FLIP: Record<Direction8, Direction8> = {
    N: 'S', NE: 'SE', E: 'E', SE: 'NE',
    S: 'N', SW: 'NW', W: 'W', NW: 'SW',
  };
  return FLIP[dir];
}

/**
 * Get the sprite sheet row for a direction, given clip data.
 * This is a convenience that combines rotation + clip lookup.
 *
 * @param worldDir  - The raw world movement direction
 * @param cameraOctant - Current camera rotation (0-7)
 * @param clips - The clips record from the SpriteAction
 * @returns The sprite sheet row index, or 0 as fallback
 */
export function directionToRow(
  worldDir: Direction8,
  cameraOctant: CameraOctant,
  clips: Record<Direction8, { row: number; frames: number[] }>,
): number {
  const visualDir = rotateDirection(worldDir, cameraOctant);
  return clips[visualDir]?.row ?? 0;
}
