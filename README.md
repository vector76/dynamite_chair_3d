# 💥 Dynamite Chair 3D

The [Dynamite Chair](https://github.com/vector76/dynamite_chair) mechanic —
no throttle, only **fixed-impulse dynamite blasts** fired in the direction
your craft points — taken into 3D. Fly a ballistic arc along a canyon carved
into procedural terrain, blasting to arrest your descent and steer, collecting
coins along the way.

**Status: design phase.** See the docs:

- [Game design](docs/GAME_DESIGN.md) — concept, mechanics, controls, open questions
- [Architecture](docs/ARCHITECTURE.md) — stack, file layout, core systems, deployment
- [Roadmap](docs/ROADMAP.md) — milestones

## Constraints

- 100% static — hosted on GitHub Pages, no backend.
- No build step — clone and open `index.html` (Three.js vendored as an ES module).
- No binary assets — procedural terrain, synthesized audio, primitive-built craft.
