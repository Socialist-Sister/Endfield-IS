# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

## Selected product direction

- Treat the official Endfield website (`https://endfield.hypergryph.com/#home`) as the primary visual and motion reference for the web calculator. Use the supplied in-game system screenshots as the secondary reference for information density, list anatomy, and control details.
- Do not show a page counter or current-section status block in the top-right header; the active content and navigation state are sufficient.
- Keep the desktop step rail understated: graphite background, compact buttons, signal-yellow icon/edge marker for the active step, and no large filled yellow navigation tiles.
- In the desktop configuration workbench, the left condition panel and right operator-selection panel share the same top and bottom edges. Let the operator list fill and scroll within that matched height instead of ending early.
- Translate the official website into a utility UI through a restrained black / fog-white / signal-yellow palette, oversized bilingual typography, persistent narrow navigation, editorial whitespace, and 0.2–0.3 second horizontal reveal or expansion transitions. Do not copy hero imagery that has no calculator function.
- Prefer sharp technical panels, thin rules, narrow yellow state markers, and capsule controls only where the reference uses them. Avoid generic rounded dashboard cards, decorative gradients, and ornamental shapes that do not support the calculator.
- Use the second generated concept's black/white/signal-yellow industrial timeline language.
- Keep the calculator flow as direct as the first concept: manual setup, local calculation, readable result.
- This prototype must never imply that it detects, syncs with, or controls the game. Player/operator state is manually entered and all calculations are local demonstrations.
- Do not display generic “仅本地”, “演示数据”, or “不读取/操作游戏” disclaimers in persistent navigation or headers. Surface limitations only where they directly affect an input, assumption, or calculation result.
- Do not display current operator mood by default because the calculator cannot monitor it. Use an explicit full-mood-start assumption unless a future flow asks the user to enter starting mood manually.
- Prioritize the two real modes: a long-run AFK plan and fixed-login manual shift rotation.
- Use a two-step single-screen flow: show either configuration or results, never both at once. Calculating advances to the full-width result view; “修改配置” returns to configuration.
- In fixed-login mode, every manually entered login time is a distinct shift node with its own rotated operator assignment; never collapse this mode into one static team.
- Treat the current assignable roster as 29 operators. Exclude both Administrator variants because the protagonist has no confirmed logistics assignment data.
- Use locally bundled, consistently framed square operator portraits everywhere an operator is identified in configuration or results. Keep the abstract symbol only as an image-load fallback; do not hotlink runtime portrait assets.
- Treat EdgeOne Makers as the zero-cost mainland-oriented primary deployment and Vercel as the overseas/fallback deployment. Both track GitHub `main`; EdgeOne builds with `npm install`, `npm run build`, and serves `dist/client`.
- Each operator defaults to E4. Per-operator E0–E4 selection controls automatic unlocks and upgrades for up to two infrastructure skills and must affect assignment scoring.
- Administrator is excluded from the assignable roster rather than shown as pending.
- AFK results do not use a time axis. The result summary should prioritize concrete daily outputs over abstract fit scores or roster counts.
- Manufacturing daily output assumes max-level cabins and uses the published product duration with a 40% assignment bonus per operator, then applies matching production skills multiplicatively.
- Manufacturing priority selects the recipe for both manufacturing cabins. In weapon-priority mode, sum both cabins into weapon output and report operator EXP as zero; in operator-priority mode, do the reverse. Result cards mirror the configuration roster by showing both skill slots at the selected promotion in two rows. Put active skills for the assigned facility first; keep locked skills, skills for another facility, and production skills that do not match the active recipe visible in muted gray rows below them.
- Control Nexus recovery uses 12% mood per hour as the base and multiplies it by the summed Mood Regen skill bonus. Specific-Clue skills remain qualitative L1/L2 tendencies because reliable probability weights are not public and identical effects do not stack.
- The operator roster starts with no owned operators selected. “全选” always selects the complete assignable roster, independent of active search or facility filters, and its count is derived from the data.
- When the complete roster is selected, the same control changes to “全不选” and clears the whole roster on the next click.
- Keep configuration and result content on one shared responsive alignment grid. Wide windows should use available space without excessive gutters, while narrow windows must avoid sticky-action overlap, horizontal overflow, and sparse card layouts.
- The desktop brand block, top bar, side rail, and main content must meet on one exact four-way intersection. Derive the rail width and top chrome height from shared tokens, and continue both separator lines through the brand block without a one-pixel break.
- On desktop, the first rail step begins directly below the brand block with no decorative spacer. In operator cards, the selection checkbox and promotion selector share one vertical centerline in the card's first row.
- AFK calculation simulates Dijiang's automatic duty cycle: an operator leaves at zero mood and returns at full mood. Use 7% mood drain per hour in working facilities and 12% recovery per hour from the Control Nexus before matching skill modifiers.
- For manufacturing, cultivation, and reception, calculate each time slice as `(1 + 40% × active operator count) × (1 + matching skill total)`; a facility with no active operators produces nothing.
- In AFK mode, let the user choose only the solution scope: one unified startup axis for all facilities, or independently optimized axes per facility. The calculator searches the actual 30-minute startup offsets; do not ask the user to choose fixed 0/5/10 or 0/0/8 presets. Evaluate candidates after a long warmup and report the stable-cycle result.
- Optimize AFK startup axes for actual long-run daily output after downtime is included. Full coverage is not a hard constraint: prefer a schedule with downtime only when its higher staffed-time efficiency more than offsets the lost production. Use coverage as a tie-breaker, and never present an independently optimized facility plan as better unless its verified daily output exceeds the unified-axis baseline.
- Keep infrastructure skill text in one predictable reading order everywhere: production, cultivation, clue, or other output effects first; mood recovery next; mood-consumption reduction last. When multiple same-facility skills are active, show all of them in that order.
- Treat 12px as the default minimum for readable Chinese body copy on the calculator. Use 11px only for short secondary labels, and reserve anything smaller for nonessential Latin eyebrows or decorative codes; skill descriptions, result annotations, controls, and assumptions must remain legible at normal desktop and mobile scale.
- Use an explicit Simplified Chinese sans-serif fallback stack throughout the interface. Bahnschrift may lead Latin labels and numbers, but Chinese glyphs must fall back to Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Noto Sans SC, or Source Han Sans SC rather than a serif/Songti face. Keep the two result skill rows visually separate with a readable 1.5 line height and a small vertical gap.
- In AFK results, separate startup timing from operator information. Put a compact `T 0h / T +2h / T +7h` timing rail directly above each corresponding operator card, aligned to the three assignment columns. Do not append Chinese “启动” labels to operator names; keep names and the two skill rows uninterrupted inside the card.
- Do not show a separate startup-axis summary banner in AFK results. The per-operator startup labels are the actionable source of truth; place the assignment board directly beneath the section heading.
- In fixed-login results, keep login shifts as side-by-side columns. Within each shift column, stack operators as full-width horizontal rows instead of three narrow operator columns; align each row as icon, operator name, then the two skill rows.
- Outside the Control Nexus, never mix mood-consumption-reduction operators with ordinary operators in one AFK facility team. Choose either an all-reduction group or a no-reduction group to prevent schedule drift.
- Fixed-login mode uses full-team replacement at every login node and treats any interval without active operators as facility downtime.
- Fixed-login calculations must continuously track each operator's mood across shifts and days. Never reset an incoming group to full mood; allow deliberate reuse or downtime only when the simulated long-run output is higher.
- Operators without an unlocked or matching room skill remain valid assignment candidates and still provide the universal 40% assignment bonus.
- Growth Chamber calculations require one explicit, fixed material category (mineral, vitrified plant, or fungal) for the entire simulation; never switch recipes between time slices.
- Growth Chamber controls and results name only the selected material category; do not imply that fungal, vitrified-plant, or mineral materials each contain only one specific item.
- Compare cross-room schedules using equal-weight standardized production efficiency per productive facility. Report manufacturing, selected growth-material, and clue outputs separately rather than blending unlike units into one claimed resource total.
- Specific-clue skills do not increase total clue count and identical clue effects do not stack. Do not add an unverified fixed daily clue to the estimate.
- Long calculations run off the main UI thread and show a slim signal-yellow progress bar fixed flush to the bottom edge; the bar reaches 100% and then dismisses when results are ready.
- Use specific labels such as “模拟口径” and “产量口径” to explain assumptions at the point they affect the result; avoid generic boundary or disclaimer copy.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
