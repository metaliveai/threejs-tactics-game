# TicTac — Isometric Tactics Prototype

> A browser-based isometric turn-based tactics game built with **Three.js**, **TypeScript**, and **Vite**. Inspired by Final Fantasy Tactics.

<img src="docs/preview.gif" width="600" alt="TicTac gameplay preview" />

> As seen on **["I Vibe Coded a Final Fantasy Tactics Game in 7 Days - Codex & Claude Code (GPT 5.4, 5.3, Opus 4.6)"](https://www.youtube.com/watch?v=wn4CLCNdujs&feature=youtu.be)**

<a href="https://www.youtube.com/@AIOriented"><img src="docs/youtube-aioriented.png" width="220" alt="@AIOriented on YouTube" /></a>&nbsp;&nbsp;<a href="https://builderpack.ai?utm_campaign=tictac-01&utm_source=github&utm_medium=readme"><img src="docs/powered-by-builderpack-light.png" width="220" alt="Powered by builderpack.ai" /></a>

> **Want more game dev vibe coding resources?** Check out the [BuilderPack.ai All Access Pass](https://builderpack.ai?utm_campaign=tictac-01&utm_source=github&utm_medium=readme)

---

## About

TicTac is a playable prototype of a grid-based tactics game rendered in an isometric 3D perspective. It was built entirely in the browser using Three.js, with no game engine — all systems (camera, grid, sprite animation, input, AI, UI) are custom TypeScript.

The full source code and asset pipeline will be coming soon as part of the **[BuilderPack.ai All Access Pass](https://builderpack.ai?utm_campaign=tictac-01&utm_source=github&utm_medium=readme)**. 

---

## What's in this repository

This public repository contains the reference materials and design artifacts for the project:

### Agent Skills

Custom skills for AI-assisted game development, ready to drop into your own projects:

**`.claude/skills/`** — for [Claude Code](https://claude.ai/code)
- `threejs-builder` — Three.js scene construction: scene setup, lighting, geometries, materials, animation, and responsive rendering. Includes reference docs on advanced topics, game patterns, and GLTF loading.
- `playwright-testing` — Game testing with Playwright MCP: canvas/WebGL assertions, screenshot diffing, flake reduction, and a cheatsheet for browser automation. Includes an `imgdiff.py` script for visual regression.

**`.codex/skills/`** — for [OpenAI Codex](https://openai.com/codex) / Codex CLI
- `threejs-builder` — same Three.js skill ported for Codex, with the same reference library and game patterns.

### Assets
- `public/assets/asset_index.json` — sprite sheet manifest (schema reference for the asset pipeline)
- `public/assets/portraits/` — character portrait PNGs (adventurer male, enemy ninja)

### Plans
Feature design documents written before implementation:
- `plans/fft-portrait-turn-timeline.md` — FFT-style portrait-based turn order timeline
- `plans/fft-style-cutscene-speech-bubbles-after-intro.md` — opening cutscene dialogue system
- `plans/full-portraits-asset-index-and-unit-portrait-wiring.md` — portrait registry and HUD wiring

### Learnings
Engineering notes captured after implementation:
- `learnings/cutscene-dialogue-phase-input-gating-and-speaker-focus.md` — scene phase design, input gating, camera framing for dialogue

### Prompts
A prompt engineering archive used during AI-assisted development:
- `prompts/README.md` — index of all prompt categories
- `prompts/gameplay/` — gameplay feature prompts

---

## Full source at builderpack.ai

The soon-to-be released gamedev resources for [All Access Pass](https://builderpack.ai?utm_campaign=tictac-01&utm_source=github&utm_medium=readme) holders will include the following:

**Full TypeScript source**
- `app/src/main.ts` — entry point and scene router
- `app/src/scenes/mainGameScene.ts` — complete turn-based combat scene
- `app/src/scenes/characterPreviewScene.ts` — sprite and animation inspector scene

**All game systems** (`app/src/game/`)
- `config.ts` — all gameplay tuning (HP, damage, move range, turn rules)
- `camera.ts` — isometric camera rig with quarter-turn rotation, smooth lerp, zoom, and pan
- `grid.ts` — tile board, movement/attack overlays, raycasting tile picker
- `spriteAnimator.ts` — sprite sheet loader, billboard rendering, pixel-accurate foot anchor detection
- `direction.ts` — canonical-to-display facing remapping for camera rotation
- `input.ts` — unified keyboard and pointer input router
- `ui.ts` — HUD layout, turn ledger, contextual command menu, status panels

**Gameplay features**
- Turn-based combat with two player units (Spear, Gun) vs. three enemies
- FFT-style nested contextual battle menu (Move, Abilities, Wait)
- Opening cutscene with scripted dialogue, speaker portraits, and camera framing
- Character portraits in the selected-unit panel, enemy hover panel, and turn ledger
- Human-like enemy AI with pacing delays and threat prioritization
- Smooth intro camera swirl into battle
- Height/elevation terrain system
- Weather system (configurable rain with board-bounded impacts)
- Cubeworld scene with procedural terrain and props
- Parchment-themed HUD with collapsible panels

**Controls**
- Arrow keys — move cursor
- Space / Enter — activate (select unit, confirm target, confirm menu item)
- Arrow keys (menu open) — navigate menu (Up/Down rows, Right open submenu, Left close)
- 1 / 2 / 3 — quick Move / Attack / Wait
- Q / E — rotate camera (quarter turns)
- Tab — end turn
- Esc — cancel
- Click — select tile
- Mouse wheel / trackpad scroll — zoom
- Pinch (touch) — zoom
- Middle-mouse drag / two-finger drag — pan camera

**All character sprite sheets**
- `zeggy_top_down` — top-down enemy character (8-directional)
- `sscary_adventurer_female` — player character (8-directional, full action set)
- `sscary_adventurer_male` — player character (8-directional, full action set)

**Full prompt archive** (all categories)
- `assets-pipeline/`, `scene-prototype/`, `gameplay/`, `bugfixes/`, `quality-learning/`, `process/`, `git/`, `combat/`

**Full learnings and lessons archive**

**AI skill files** for Claude Code
- `threejs-builder` — Three.js scene construction patterns and references
- `playwright-testing` — game testing with Playwright MCP, canvas assertions, screenshot diffing

---

## Tech Stack

- **Three.js** — 3D rendering (orthographic isometric camera, sprite billboards)
- **TypeScript** — strict type-checked source
- **Vite** — dev server and bundler
