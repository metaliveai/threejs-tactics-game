# Plan: FFT-Style Cutscene Speech Bubbles After Intro

## Summary

Add a configurable cutscene dialogue system that runs right after the intro swirl, displays FFT-inspired speech bubbles with speaker name + portrait, blocks normal gameplay input during dialogue, and then transitions into the existing battle-start flow. Dialogue advances manually and supports Esc skip.

## Implementation Changes

1. Extend scenario config with cutscene script
- Add optional `cutscene` on `MainGameScenarioConfig`.
- Include:
  - `delayMs` (time after intro swirl before first line)
  - `lines: Array<{ speakerUnitId: UnitId; placement: "top" | "bottom"; text: string }>`
  - `controls` (manual advance, skippable)
- Populate `MAIN_GAME_SCENARIO.cutscene` with 4 lines:
  - `enemy_1`: threat
  - `player_spear`: response
  - `player_gun`: response
  - `enemy_1`: `"Prepare to die."`

2. Add cutscene dialogue overlay UI
- Create a new overlay class for dialogue bubble rendering:
  - `showLine({ speakerName, portrait, text, placement })`
  - `setVisible()`
  - `dispose()`
  - optional `onNext` callback for button/click advance
- Add CSS for parchment-like bubble, speaker label, portrait frame, top/bottom placement, tail pointer, and responsive behavior.
- Reuse current unit portrait data path so portrait can render from full image or frame fallback.

3. Integrate cutscene into scene phase flow
- Add new scene phase/state for cutscene between `intro` and playable turn flow.
- Replace direct post-intro transition with:
  - intro ends -> cutscene delay -> cutscene line progression -> start battle flow.
- Ensure start battle flow uses existing first-player auto-select logic (same result as now).

4. Gate inputs during cutscene
- In keyboard/pointer handlers, ignore gameplay actions while cutscene is active.
- Keep only:
  - advance line on Space/Enter/activate
  - skip on Esc
  - optional click on Next in cutscene UI
- Hide/disable HUD elements that could conflict with dialogue interaction.

5. Keep transition logic single-sourced
- Factor battle start handoff into one helper used by both cutscene complete and cutscene skip paths.
- This guarantees skip behavior remains consistent with current auto-select-first-player behavior.

## Test Plan

1. Intro and trigger
- Start scene and confirm intro swirl still runs.
- Confirm cutscene appears after configured delay.

2. Dialogue progression
- Confirm four lines appear in order with correct speaker name/portrait/placement.
- Space/Enter and Next click advance one line at a time.

3. Skip behavior
- Press Esc mid-cutscene and verify it exits immediately.
- Confirm game auto-selects first player unit and enters normal control state.

4. Input lock and cleanup
- During cutscene, verify cursor/menu/combat inputs do not affect gameplay state.
- After cutscene ends, verify all normal controls work.

## Assumptions

- v1 uses manual dialogue progression only (no auto-timed line advance).
- Cutscene text lives in scenario config for easy editing.
- Existing portrait pipeline is sufficient for dialogue portraits.

