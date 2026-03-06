# Plan: Full Portraits Asset Index + Unit Portrait Wiring

## Summary

Add a `portraits` registry to `public/assets/asset_index.json` for the new full portraits, then update the game’s portrait plumbing so selected-unit panel, enemy-hover panel, and turn-order ledger render those full portraits (cover/center) instead of deriving portraits from the first idle sprite-sheet frame.

Enemy portraits will be mapped deterministically per enemy unit id (`enemy_1/2/3`) via scenario config.

## Key Changes

1. Update `public/assets/asset_index.json`
- Add top-level `portraits`:
  - `adventurer_male`: `portraits/adventurer-male.png` size `1024x1024`
  - `adventurer_female`: `portraits/adventurer-female.png` size `1024x1024`
  - `enemy_ninja_01`: `portraits/enemy-ninja-01.png` size `1024x1024`
  - `enemy_ninja_02`: `portraits/enemy-ninja-02.png` size `1024x1024`
  - `enemy_ninja_03`: `portraits/enemy-ninja-03.png` size `1024x1024`
- Add per-character defaults where applicable:
  - `characters.sscary_adventurer_male.portraitKey = "adventurer_male"`
  - `characters.sscary_adventurer_female.portraitKey = "adventurer_female"`
- Bump `meta.version` from `1` to `2`.

2. Update TypeScript types (`app/src/game/types.ts`)
- Extend `AssetIndexRaw` with optional `portraits?: Record<string, PortraitMetaRaw>`.
- Add `PortraitMetaRaw`:
  - `{ path: string; size: { w: number; h: number } }`
- Extend `CharacterMetaRaw` with optional `portraitKey?: string`.
- Extend `UnitConfig` with optional `portraitKey?: string`.
- Convert `UnitPortraitFrame` into a discriminated union:
  - `{ kind: "frame"; sheetUrl; sheetWidth; sheetHeight; frameX; frameY; frameWidth; frameHeight }`
  - `{ kind: "image"; url: string }`

3. Wire portrait keys into the scenario (`app/src/game/config.ts`)
- Add `portraitKey` on units:
  - `player_spear`: `adventurer_male`
  - `player_gun`: `adventurer_female`
  - `enemy_1`: `enemy_ninja_01`
  - `enemy_2`: `enemy_ninja_02`
  - `enemy_3`: `enemy_ninja_03`

4. Prefer full portraits at runtime
- `app/src/scenes/mainGameScene.ts`
  - Extend `UnitState` with `portraitKey?: string` and carry it from `UnitConfig`.
  - Update `getUnitPortrait(unit)`:
    1. If `unit.portraitKey` maps to `assetIndex.portraits`, return `{ kind:"image", url: encodeURI("/assets/" + path) }`
    2. Else if character’s `portraitKey` maps to `assetIndex.portraits`, return `{ kind:"image", ... }`
    3. Else fall back to existing sprite-sheet-first-frame and return `{ kind:"frame", ... }`

5. Render image-portraits without blowing up layout
- `app/src/game/ui.ts`
  - Update `applyPortrait(...)` and `applyLedgerPortrait(...)`:
    - For `kind:"frame"`: keep current sprite-sheet background cropping behavior.
    - For `kind:"image"`:
      - `background-size: cover`
      - `background-position: center`
      - Do not derive element width/height from source image dimensions.
      - Ledger sizing should stay small (use existing scale factor against a fixed base size like 48px).
- `app/src/game/overlays.ts`
  - Same `kind:"image"` handling as selected-unit panel.

## Test Plan

1. Run `cd app && npm run build`.
2. Run `cd app && npm run dev`, verify:
- Selected-unit panel shows full portraits for `Cid`/`Katniss`.
- Enemy hover shows `enemy-ninja-01/02/03` matching `enemy_1/2/3`.
- Turn-order ledger shows full portraits at small sizes and does not expand to huge dimensions.
- If portraitKey is missing or invalid, code falls back to existing sprite-frame portrait (or initial fallback if that also fails).

