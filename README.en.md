# Endfield-IS

[简体中文](./README.md) | English

An infrastructure shift calculator for the Dijiang in *Arknights: Endfield*. Based on manually selected operators, promotion levels, and production goals, it simulates infrastructure skills, morale consumption, automatic duty cycles, and fixed-login rotations to provide long-run schedule and output estimates.

> This is an unofficial calculator. It does not read, detect, or control the game client. Operator ownership, promotion levels, production targets, and login times are entered manually by the user.

## Live App

[https://endfield-is.vercel.app](https://endfield-is.vercel.app)

## Interface Preview

![Configuration view](./implementation-endfield-web-config.png)

![Result view](./implementation-endfield-web-result.png)

## Key Features

- Includes 29 assignable operators and excludes both Administrator variants, which currently lack reliable infrastructure assignment data.
- Supports per-operator E0–E4 promotion selection. Operators default to E4, and promotion controls the unlocks and upgrades of up to two infrastructure skills.
- Calculates skill matching, morale cycles, and assignments for manufacturing cabins, growth chambers, the reception room, and the Control Nexus.
- Reports weapon EXP, operator EXP, the selected growth-material category, and clue results separately instead of mixing incompatible resource units.
- Shows both skill slots available at the selected promotion. Skills active for the assigned facility appear first; locked or inactive skills remain visible in a muted state.
- Runs long calculations in a Web Worker and reports progress through a bottom-edge progress bar.
- Adapts to desktop and narrow viewports with a black, fog-white, and signal-yellow industrial design inspired by Endfield.

## Scheduling Modes

### Long-run AFK

This mode simulates Dijiang's automatic duty cycle: an operator leaves when morale reaches zero and returns after recovering to full morale. The solver searches 30-minute startup offsets and compares actual stable-cycle daily output after a long warm-up period.

The user only selects the search scope:

- **Unified startup axis:** every facility shares one startup timeline, making the plan easier to execute.
- **Per-facility startup axes:** facilities search independently and use separate axes only when verified daily output exceeds the unified baseline.

Full coverage is not a hard constraint. A schedule may include short downtime when the efficiency of fully staffed, high-skill periods more than offsets the lost production.

### Fixed-login Rotation

The user enters daily login times, and every time point performs a full-team replacement. Morale is tracked continuously for every operator across shifts and days. Reused operators are never reset to full morale; reuse or deliberate downtime is allowed only when it improves verified long-run output.

## Calculation Model

- Base morale drain in a working facility: `7% per hour`.
- Base recovery in the Control Nexus: `12% per hour`, multiplied by active recovery-skill modifiers.
- Manufacturing, growth, and reception efficiency per time slice: `(1 + 40% × active operators) × (1 + total matching skills)`.
- Operators without a matching facility skill remain valid candidates and still provide the universal 40% assignment bonus.
- Manufacturing assumes max-level cabins and published product durations. Both cabins produce the selected priority product, while the other EXP output is reported as zero.
- Growth calculations keep one category—mineral, vitrified plant, or fungal—fixed throughout the simulation.
- Specific-clue skills are qualitative L1/L2 tendencies. Identical effects do not stack, and the model does not invent a fixed daily clue count.
- Outside the Control Nexus, AFK teams do not mix morale-consumption-reduction operators with ordinary operators, preventing duty-cycle drift.

Results are estimates based on the current dataset and model, not real-time game state. Operator data and calculation rules should be updated when in-game values or mechanics change.

## Technology

React 19, Vite 6, Phosphor Icons, Web Workers, the Node.js native test runner, and Vercel.

## Asset Notice

Operator portraits are bundled as local static assets so the interface does not depend on a third-party image service at runtime. Portrait mapping was cross-checked against the public [MR-LORD-REX/endfield-builds](https://github.com/MR-LORD-REX/endfield-builds) metadata. Character artwork remains the property of Hypergryph / GRYPHLINE; this project claims no ownership of those assets.

## Local Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

Browser assets are written to `dist/client`. The build also creates `dist/server/index.js` and `dist/.openai/hosting.json` for Sites-compatible handoff.

## Testing

```bash
node --test tests/schedule-model.test.mjs
npm run test:sites
```

Tests cover stable-cycle startup optimization, continuous morale tracking, unique cross-facility assignments, fixed material categories, production priorities, and clue estimation.

## Deployment

Vercel is connected to this repository. Every push to `main` automatically builds and publishes the production site. Build settings are defined in [`vercel.json`](./vercel.json).
