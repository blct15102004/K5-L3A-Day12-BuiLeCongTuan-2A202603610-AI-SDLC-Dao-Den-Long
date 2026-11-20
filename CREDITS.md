# Credits & Attributions — Đảo Đèn Lồng

- **Author & Implementation**: Bui Le Cong Tuan (`2A202603610`) — Core simulation engine, 3-Night map geometry, WebGL renderer, procedural audio synthesizer, UI/HUD, and test harness.
- **3D Rendering & Audio Technologies**: Zero-dependency browser WebGL 1.0 API (`src/render/webgl-renderer.js`) and Web Audio API procedural synthesis (`src/render/audio.js`); all meshes, shaders, sound effects, and background music are generated mathematically at runtime with no third-party asset packs or external libraries.
- **Runtime & Platform**: Node.js ES Modules (`src/server.js`, `src/headless/cli.js`, `src/headless/bench.js`, `src/headless/soak.js`).
- **Fonts**: Standard system sans-serif and monospace stacks (zero external font network dependencies).
- **AI SDLC Workflow**: Implemented and verified with Antigravity AI coding assistant under project harness rules (`AGENTS.md`).
