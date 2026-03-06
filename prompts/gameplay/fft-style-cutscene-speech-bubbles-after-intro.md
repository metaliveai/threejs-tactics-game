# Prompt: FFT-Style Cutscene Speech Bubbles After Intro

Implement a short, configurable cutscene dialogue sequence with speech bubbles inspired by Final Fantasy Tactics.

Requirements:
- Trigger the cutscene shortly after the spinning intro to the map ends.
- Keep it short for now, but make it configurable for future lines/scenes.
- Include one enemy threat line, both player characters responding, and end with enemy saying: `"Prepare to die."`
- Dialogue should feel similar to FFT references:
  - parchment-like speech bubble
  - speaker name
  - speaker portrait
  - top/bottom placement variation

Input behavior:
- Manual advance using Space/Enter (and a clickable Next affordance).
- Esc skips cutscene immediately.
- On skip or completion, game should auto-select the first player unit exactly like current post-intro flow.

Gameplay integration:
- While cutscene is active, lock gameplay/menu/cursor interactions.
- After cutscene, transition cleanly into normal battle control.

