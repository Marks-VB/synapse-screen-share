---
name: Aggressive Cyberpunk OS
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191c23'
  surface-container: '#1d2027'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e0e2ec'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#e0e2ec'
  inverse-on-surface: '#2d3038'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#ddb7ff'
  on-secondary: '#490080'
  secondary-container: '#6f00be'
  on-secondary-container: '#d6a9ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#1bbd85'
  on-tertiary-container: '#00452e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#ddb7ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6900b3'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#10131a'
  on-background: '#e0e2ec'
  surface-variant: '#32353c'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.04em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.01em
  body-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.1em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.12em
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system channels the uncompromising militarized aesthetic of late 20th-century anime cybernetics merged with modern operating systems. The visual language embodies an operational HUD running within high-threat networks, where tactical data density, machine feedback, and rapid cognitive ingestion take precedence.

The UI is built on high-contrast brutalism fused with precision telemetry. Surfaces are treated like fortified optical display monitors: layered scanline filters, strict planar boundaries, sharp angles, and data-rich system brackets. The emotional response is intense, clinical, and covert—evoking the tension of navigating compromised networks in a rain-slicked megalopolis under persistent surveillance.

## Colors

The palette is engineered around an absolute void: deep obsidian (`#010203`) provides an impenetrable background, layered under tactical zinc panels (`#12151c`). Chrome-cold phosphors cut through this darkness with maximum visual urgency:

- **Primary Cyan (`#06b6d4`):** Primary command triggers, active optical readouts, targeted coordinates, and baseline reticle lines.
- **Secondary Neon Violet (`#a855f7`):** Elevated authority states, secondary functional nodes, sub-routine highlights, and high-frequency data pipelines.
- **Tertiary Terminal Green (`#10b981`):** Core health states, stabilized connections, encrypted data streams, and valid ping signals.
- **Warning Amber (`#f59e0b`):** Threat escalations, buffer overflows, latency warnings, and manual override confirmations.
- **Structural Borders (`#1a3d4f`, `#c026d3`):** Precision 1px grid partitions that maintain modular container boundaries across telemetry viewports.

## Typography

The type system prioritizes computational authenticity and instant data decipherability. Space Grotesk governs macro-level headers, injecting structural mechanical tension through its sharp grotesque curves and geometric ink-traps. 

JetBrains Mono delivers all operational context, metadata, and telemetry. It anchors readability across high-frequency visual noise, ensuring tabular alignment of metrics, hardware states, and hexadecimal timestamps. Labels and sub-headers must always use uppercase styling paired with tracked letter-spacing to reinforce industrial cockpit displays.

## Layout & Spacing

The spatial engine utilizes a strict 12-column tactical grid on desktop screens, transitioning to an 8-column layout on tablets and a 4-column layout on mobile units. The layout is fluid within capped maximum boundaries, maintaining data density without visual collapse.

Margins represent optical viewport frame bounds. Content reflow obeys vertical module stacking: when viewport width decreases below 768px, horizontal HUD panels break into vertically queued telemetric canisters. Spacing remains intentionally compact and calculated; negative space is treated as functional margin between radar tracks, rather than decorative white space.

## Elevation & Depth

Depth is defined by emissive luminance, geometric containment, and hard laser borders rather than diffuse, natural drop shadows.

- **Level 0 (Surface Base):** Obsidian Black (`#010203`) overlaid with an optional SVG scanline texture (1px repeating dark lines with 4% opacity).
- **Level 1 (Sub-Panels):** Zinc Grey (`#12151c`) with solid 1px borders of Dark Cyan (`#1a3d4f`).
- **Level 2 (Active Containers):** Zinc Grey with high-intensity 1px borders (`#06b6d4` or `#c026d3`), cast against an inner glow (`box-shadow: inset 0 0 12px rgba(6, 182, 212, 0.15)`).
- **Level 3 (Alerts & Overlays):** Full-bleed floating containers flanked by warning telemetry headers, using external hard neon halos (`0 0 16px rgba(168, 85, 247, 0.35)` or `0 0 16px rgba(245, 158, 11, 0.4)`).

## Shapes

All UI surfaces feature zero corner rounding (`0px`). Curves represent soft systemic vulnerability; absolute right angles and 45-degree chamfered corners communicate hardened tactical gear.

Where corners require functional articulation, cut-corner polygons (`clip-path: polygon(...)`) provide diagonal 6px to 12px technical bevels. Corner brackets (`┌ ┐ └ ┘`) in 1px stroke delineate focus zones, framing tabular information with mechanical precision.

## Components

### Buttons & Interactive Triggers
- **Primary:** Obsidian background framed by a 1px Cyan border (`#06b6d4`), Cyan monospace text, chamfered top-right corner. On hover: instant state swap to solid Cyan background with Obsidian text and a 12px horizontal scanline glitch transition.
- **Destructive / Hazard:** Border and text in Warning Amber (`#f59e0b`) or Alert Magenta (`#c026d3`), with hazard-striped diagonal background patterns on press.

### Telemetry Pills & Chips
- Monospaced, all-caps status nodes with a leading geometric marker (e.g., solid green square for nominal states, blinking amber diamond for latency).
- Encased in a 1px border with a semi-transparent dark zinc core (`rgba(18, 21, 28, 0.85)`).

### Input Fields & Terminal Consoles
- Dark background (`#010203`) with an active bottom-only or fully bracketed cyan border.
- Prefixed with terminal path indicators (`sys://net.01/ >`).
- Focus state triggers an immediate cyan glow with a solid block caret (`█`) blinking at 1Hz.

### Cards & Modular Canisters
- High-density containment pods with visible technical headers featuring sub-pixel coordinates, revision numbers, and status pings.
- Framed with 1px border lines accented by corner reticle crosses (`+`).

### Checkboxes & Segmented Controls
- Checkboxes are rigid squares containing sharp diagonal check strokes or an interior solid block when active.
- Segmented switches function as physical mechanical toggle banks, illuminated with neon green or violet backlights to denote engagement.

### HUD Elements & Brackets
- Specialized viewport guides, screen calibration crosshairs, and hexagonal radar indicators applied dynamically to screen corners and floating modals.