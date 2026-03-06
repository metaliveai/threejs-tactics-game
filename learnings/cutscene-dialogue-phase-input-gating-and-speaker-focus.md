# Learnings: Cutscene Dialogue Phase, Input Gating, and Speaker Focus

1. A dedicated scene phase is the cleanest way to add narrative flow between intro and battle.
- Treating cutscene as its own phase avoids fragile condition chains and prevents battle state from partially activating early.
- Intro completion and cutscene completion should both feed one shared battle-start helper to keep skip/completion behavior identical.

2. Dialogue overlays work best when gameplay input is explicitly gated at handler boundaries.
- Blocking `activate`, `cancel`, pointer picking, rotate, zoom, and pan during cutscene prevents accidental state drift.
- A temporary body class (`cutscene-active`) is a reliable way to suppress unrelated HUD layers while keeping the dialogue UI interactive.

3. Short pacing beats need explicit timers in config, not hardcoded sleeps.
- A configurable `prepareForBattleMs` produces a better transition rhythm and is easy to tune per scenario.
- Skip behavior should bypass pacing timers and transition immediately to battle for responsiveness.

4. Camera framing must follow speaker changes for readable dialogue scenes.
- Re-centering to each speaker tile on every new line dramatically improves narrative clarity.
- Reusing existing camera tweening (`tweenCenterTo`) keeps motion consistent with turn-start camera behavior.

5. Cutscene scripts are most maintainable when authored in scenario config.
- Storing line order, speaker IDs, and placement in config keeps story iteration decoupled from scene logic.
- Speaker portraits can reuse the same unit portrait resolution path used elsewhere (full-image first, frame fallback).

6. Speech-bubble tails should be screen-space anchored, not fixed by static CSS percentages.
- Static `left` offsets drift away from speakers as camera framing changes.
- Projecting speaker world position each frame and mapping to bubble-local percentage keeps the tail visually attached.

7. Bubble placement needs placement-specific anchor heights to avoid occluding sprites.
- Using one world-space anchor height for both top and bottom dialogue can put bottom bubbles on top of the speaking unit.
- Bottom lines align better when anchored nearer unit feet, while top lines align better with a higher anchor above the character.
- Camera reframe and tail tracking are not enough by themselves; vertical anchor semantics must match placement.
