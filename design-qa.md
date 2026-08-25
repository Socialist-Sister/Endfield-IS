# Endfield Calculator Redesign — Design QA

## Comparison target

- Primary visual and motion truth: `https://endfield.hypergryph.com/#home`.
- Supplied system-screen sources used for visible density and component comparison:
  - `C:\Users\ZengYiming\Downloads\IMG_0109.PNG` — light system list, yellow selection rail, broad information rows.
  - `C:\Users\ZengYiming\Downloads\IMG_0107.PNG` — dense horizontal list cards and left navigation.
  - The remaining supplied `IMG_0102.PNG` through `IMG_0110.PNG` screenshots were used as the wider black / fog-white / signal-yellow style board.
- Browser-rendered implementation evidence:
  - `D:\ChatGPT files\Endfield-IS\implementation-endfield-web-config-selected.png`
  - `D:\ChatGPT files\Endfield-IS\implementation-endfield-web-result.png`
  - `D:\ChatGPT files\Endfield-IS\implementation-endfield-web-shift-result.png`
  - `D:\ChatGPT files\Endfield-IS\implementation-endfield-web-mobile-config.png`
  - `D:\ChatGPT files\Endfield-IS\implementation-endfield-web-mobile-result.png`
- Same-input comparison boards:
  - `D:\ChatGPT files\Endfield-IS\design-qa-endfield-config-comparison.png`
  - `D:\ChatGPT files\Endfield-IS\design-qa-endfield-result-comparison.png`

## Viewport and normalization

- Desktop CSS viewport: 1280 × 720; implementation capture: 1265 × 712 pixels after browser scrollbar/chrome exclusion; capture density normalized to 1 CSS pixel per output pixel.
- Mobile CSS viewport override: 390 × 844; implementation capture: 375 × 812 pixels after scrollbar/chrome exclusion.
- Supplied sources: 2360 × 1640 pixels, density unknown. For the comparison boards each source and implementation was proportionally downsampled into an equal 795 × 820 comparison slot without cropping or stretching.
- The references are art-direction sources for a different functional screen, not a pixel-identical calculator state. Comparison therefore evaluates palette, navigation anatomy, hierarchy, density, typography rhythm, panel language, and interaction treatment rather than matching content coordinates.

## State and interaction evidence

- Configuration: all 29 operators selected at default E4, AFK mode, unified startup-axis scope.
- AFK result: all five rooms rendered with 15 operator cards and no body-level horizontal overflow.
- Fixed-login result: two login shifts rendered as side-by-side columns; operators remain horizontal rows inside each shift.
- Mobile configuration and result checked at 390 × 844; bottom navigation remains visible and the body does not overflow horizontally.
- Primary interactions tested in the browser: select all, mode switch, calculate, progress completion, result rendering, modify configuration, AFK result, fixed-login result.
- Browser console warnings/errors checked: none.

## Full-view comparison evidence

- The implementation now uses the official site's narrow persistent navigation ratio, very light canvas, high-contrast black information zones, signal-yellow state blocks, oversized Latin editorial text, and fast horizontal reveal motion.
- The configuration view maps the in-game list language into a web calculator: gray inactive rows, black selected rows, narrow yellow state markers, compact filter controls, and large section headers.
- The result view preserves the game's dense horizontal information rows while using the official website's wide editorial whitespace and large numerical hierarchy.
- No copied hero imagery or character art was introduced because it would not serve the calculator workflow. All visible icons come from the existing Phosphor icon library.

## Focused region comparison evidence

- Configuration header and operator list: the source and implementation both use a light gray frame, narrow left navigation, yellow active state, dark selected content, and thin industrial separators. The implementation intentionally replaces character portraits with neutral system marks because operators are text/data records in this calculator.
- Fixed-login assignment board: the source's wide dark list rows become two shift columns with full-width operator rows. Name, room, and both skill lines remain legible without reducing Chinese body copy below 12px.
- Mobile header/navigation: the desktop rail becomes a fixed bottom bar at 720px and below; selected state remains yellow and no persistent control is obscured by the page content.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- Typography: Simplified Chinese uses a sans-serif fallback stack; display labels use Bahnschrift where available. Body and skill copy remain at 12px or above; 9–11px is limited to Latin codes and short secondary labels.
- Spacing and layout: the four-way rail/header intersection aligns to shared `--rail-width` and `--chrome-height` tokens. Desktop and mobile captures show no body-level horizontal overflow.
- Colors and tokens: fog white, graphite black, and signal yellow match both the official website's computed white/black/yellow surfaces and the supplied system screenshots.
- Image quality: no required app-specific imagery is missing. Source art was treated as visual direction rather than copied into the calculator.
- Copy/content: labels remain calculator-specific and do not imply game detection or control.
- Accessibility: keyboard focus rings, reduced-motion handling, readable contrast, semantic buttons/selects, and mobile tap targets are preserved.

## Comparison history

1. Initial redesign comparison
   - Earlier findings: no P0/P1/P2 issue identified after the first combined source/implementation boards.
   - Fixes made: none required after the blocking comparison.
   - Post-fix evidence: the same desktop comparison boards plus independent mobile captures confirm the initial pass at both responsive states.

## Follow-up polish

- P3: the official website's proprietary display fonts are not bundled; Bahnschrift and the system Chinese sans-serif stack provide the closest local, redistribution-safe treatment.
- P3: the reference screenshots include bespoke character and badge imagery that is intentionally omitted from this data-only calculator.

## Implementation checklist

- [x] Official-site visual language translated to the calculator.
- [x] Existing calculator behavior preserved.
- [x] AFK and fixed-login result states verified.
- [x] Desktop and mobile overflow checked.
- [x] Browser console checked.
- [x] Build and all 18 tests pass.

## Targeted follow-up pass — header, rail, and workbench alignment

- Source issue crops:
  - `C:\Users\ZENGYI~1\AppData\Local\Temp\codex-clipboard-0ae42263-ac0c-432d-b6f3-6c53662fe22e.png`
  - `C:\Users\ZENGYI~1\AppData\Local\Temp\codex-clipboard-4b76b8b5-57fb-473f-bff5-6dc3f7ab5d81.png`
  - `C:\Users\ZENGYI~1\AppData\Local\Temp\codex-clipboard-33bfcecf-eb18-460a-9f43-829f86f5d3b0.png`
- Revised implementation captures:
  - `D:\ChatGPT files\Endfield-IS\implementation-endfield-web-alignment-fix.png`
  - `D:\ChatGPT files\Endfield-IS\implementation-endfield-web-alignment-bottom-final.png`
  - `D:\ChatGPT files\Endfield-IS\implementation-endfield-web-mobile-rail-fix.png`
- Combined comparison input: `D:\ChatGPT files\Endfield-IS\design-qa-targeted-fix-comparison.png`.
- Desktop viewport: 1280 × 720 CSS pixels; rendered capture: 1265 × 712 pixels. Mobile viewport: 390 × 844 CSS pixels; rendered capture: 375 × 812 pixels.
- Earlier P2 findings: redundant top-right page counter; oversized yellow navigation tiles; operator panel ending above the left configuration panel.
- Fixes made: removed the top-right status/counter block; rebuilt the desktop rail as a compact graphite rail with yellow icon/edge state; stretched both workbench columns to one grid track and let the operator list fill and scroll within the matched height; forced horizontal list overflow hidden.
- Post-fix evidence: `.config-controls` and `.field-group--operators` both resolve to `top: 240.3516px` and `bottom: 950.2578px` at the desktop reference viewport, a measured bottom delta of `0px`. No `.topbar-meta` element remains. The operator list reports equal client and scroll widths (`685px`) and the browser console has no warnings or errors.
- Final targeted findings: no actionable P0/P1/P2 issue remains. The compact mobile rail preserves the same understated active-state language without body-level horizontal overflow.

final result: passed
