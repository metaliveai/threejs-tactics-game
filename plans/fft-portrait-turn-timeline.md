# Plan: FFT-Style Portrait Turn Timeline

## Context

The turn ledger currently shows small colored squares + text labels in a card panel. The user wants it redesigned to match the FF Tactics War of the Lions combat timeline (reference screenshot provided): portrait-based, larger, dynamic with slide animations, and minimal/transparent card background.

## Reference Design (from screenshot)

- Vertical column on the left edge, numbered top-to-bottom (highest = furthest from acting)
- Each row: **order number** + **character portrait thumbnail** (square, from sprite sheet) + small HP bar
- Active unit (#1) is at the **bottom**, significantly larger, slides out to the right
- When a turn advances: active portrait slides out/fades, all rows slide down, new active appears at bottom
- No opaque card — portraits sit directly over the 3D scene (transparent or very subtle bg)
- Player portraits have a blue-tinted color bar, enemies have red/pink

## Files to Modify

### 1. `app/src/game/ui.ts` — Major rework of turn ledger

**Data model change** — Add portrait to `TurnLedgerEntry`:
```ts
export interface TurnLedgerEntry {
  id: UnitId;
  label: string;
  side: SideId;
  active: boolean;
  upcoming: boolean;
  down?: boolean;
  portrait: UnitPortraitFrame | null;  // NEW
}
```

**DOM structure change** — Replace the current list rebuild approach:
- Remove `turn-ledger-current` text ("Now: X") — active unit shown as enlarged portrait instead
- Keep persistent row elements keyed by `UnitId` to enable CSS transitions
- Each row becomes: `[order-badge] [portrait-thumbnail] [hp-bar-mini]` instead of `[order-badge] [square] [label]`
- Active unit row gets `.active` class which CSS enlarges and slides right
- Use `applyPortrait()` (already exists at line 431) to set portrait thumbnails — reuse with a smaller scale

**Animation approach** — Instead of `innerHTML = ""` every frame:
- Maintain a `Map<UnitId, HTMLElement>` of persistent row elements
- On each `setTurnLedger()` call, diff against existing rows
- Use CSS `transition` on `transform` and `opacity` for slide/fade
- Set `order` CSS property or explicit `translateY` positions to animate reordering
- Active row gets `transform: translateX(20px) scale(1.3)` or similar to "pop out"

### 2. `app/src/style.css` — Turn ledger CSS overhaul

- `.turn-ledger`: Remove parchment background → `background: transparent` or very subtle `rgba(0,0,0,0.15)`
- Remove border and box-shadow on the container
- `.turn-ledger-item`: Add `transition: transform 300ms ease, opacity 300ms ease`
- `.turn-ledger-item.active`: Larger, slides right, slight glow/highlight
- New `.turn-ledger-portrait` class: square thumbnail (~48px for queue, ~72px for active), `image-rendering: pixelated`, rounded corners, side-colored border (blue for player, red for enemy)
- `.turn-ledger-hp-mini`: Thin HP bar under each portrait (~4px tall)
- Remove `.turn-ledger-square` styles (replaced by portrait)
- Keep `.turn-ledger-order` badge but restyle slightly

### 3. `app/src/scenes/mainGameScene.ts` — Pass portrait data to ledger

At the `setTurnLedger()` callsite (line 2027), add portrait to each entry:
```ts
hud.setTurnLedger(
  turnOrder.map((unitId, index) => {
    const unit = getUnitById(unitId);
    return {
      ...existing fields...,
      portrait: getUnitPortrait(unit)  // already defined at line 540
    };
  })
);
```

## Key Reuse

- `getUnitPortrait()` — `mainGameScene.ts:540-568` — computes sprite frame for any unit
- `applyPortrait()` — `ui.ts:431-452` — CSS background-image cropping at arbitrary scale
- `UnitPortraitFrame` type — `types.ts:118-126` — already imported in ui.ts

## Animation Details

When active turn changes:
1. Previous active row: transition `opacity → 0`, `transform: translateX(-20px)` (slide out left)
2. All other rows: `translateY` shifts down by one row height (~56px)
3. New active row: transition to enlarged state at bottom position
4. After transition completes (~300ms), remove the departed row element

Between calls (steady state): rows stay in place with no DOM thrashing.

## Verification

1. `npm run dev` from `app/`
2. Turn ledger shows portrait thumbnails instead of colored squares
3. Active unit portrait is larger at bottom of timeline
4. When turn advances, smooth slide animation (rows shift down, old active fades out)
5. No opaque card background — game scene visible behind portraits
6. Player portraits have blue-ish border, enemy have red-ish
7. Dead units shown at reduced opacity
8. Works at < 900px responsive breakpoint
