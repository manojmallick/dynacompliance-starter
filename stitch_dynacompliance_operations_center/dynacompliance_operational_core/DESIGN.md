---
name: DynaCompliance Operational Core
colors:
  surface: '#0f131f'
  surface-dim: '#0f131f'
  surface-bright: '#353946'
  surface-container-lowest: '#0a0e1a'
  surface-container-low: '#171b28'
  surface-container: '#1b1f2c'
  surface-container-high: '#262a37'
  surface-container-highest: '#313442'
  on-surface: '#dfe2f3'
  on-surface-variant: '#bcc9ce'
  inverse-surface: '#dfe2f3'
  inverse-on-surface: '#2c303d'
  outline: '#869398'
  outline-variant: '#3d494d'
  surface-tint: '#4cd6fb'
  primary: '#4cd6fb'
  on-primary: '#003642'
  primary-container: '#00b4d8'
  on-primary-container: '#00414f'
  inverse-primary: '#00677d'
  secondary: '#b7c6eb'
  on-secondary: '#21304d'
  secondary-container: '#3a4967'
  on-secondary-container: '#a9b8dc'
  tertiary: '#ffb77d'
  on-tertiary: '#4d2600'
  tertiary-container: '#eb8f3b'
  on-tertiary-container: '#5d2f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b3ebff'
  primary-fixed-dim: '#4cd6fb'
  on-primary-fixed: '#001f27'
  on-primary-fixed-variant: '#004e5f'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#b7c6eb'
  on-secondary-fixed: '#0a1b37'
  on-secondary-fixed-variant: '#384765'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#0f131f'
  on-background: '#dfe2f3'
  surface-variant: '#313442'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for high-stakes regulatory environments, specifically DORA compliance within financial services. The brand personality is **authoritative, precise, and vigilant**, designed to instill a sense of absolute control over complex data streams.

The visual style follows a **Corporate Modern** aesthetic with a heavy emphasis on **utilitarian data-density**. It prioritizes immediate cognitive processing of compliance statuses through a "Dashboard-as-an-Instrument" metaphor. The interface utilizes a deep, multi-layered dark theme to reduce eye strain during long monitoring sessions while using high-vibrancy electric accents to highlight critical action items.

## Colors

The palette is anchored in a **Deep Navy Tiering** system to create structural depth without relying on heavy shadows.

- **Primary (#00B4D8):** Used exclusively for active states, primary actions, and "live" data indicators. It represents the "electric" pulse of the system.
- **Surface & Borders:** The background (#0A0E1A) and surface (#131929) provide a low-contrast base, while the border color (#1E2D4A) provides the necessary definition for modular layouts.
- **Semantic Logic:** Success, Warning, and Danger colors are calibrated for high luminosity against the dark background, ensuring that compliance breaches or alerts are impossible to miss.

## Typography

This design system utilizes **Inter** across all levels to maintain a systematic, neutral, and highly legible environment. 

- **Data Density:** Use `body-sm` and `label-md` for the majority of dashboard content to maximize information visible on a single screen.
- **Hierarchy:** `display-lg` is reserved for critical high-level KPIs (e.g., Overall Compliance Score).
- **Labels:** All labels use a slight tracking increase (0.05em) and uppercase transformation when used in table headers or section overviews to differentiate from interactive content.
- **Data Rendering:** Numbers should utilize tabular figures (tnum) features of Inter to ensure vertical alignment in data grids.

## Layout & Spacing

The layout utilizes a **Fixed Grid** philosophy for desktop monitoring, ensuring that dashboard widgets remain in predictable locations for "glance-and-act" workflows.

- **Grid System:** 12-column grid with 16px gutters.
- **Modular Widgets:** Content is organized into "Cards" that span 3, 4, 6, or 12 columns.
- **Density:** A strict 4px baseline grid is used. For data-heavy tables, use 8px (sm) vertical padding. For general layout containers, use 24px (lg) or 32px (xl) padding to provide visual breathing room between distinct functional areas.
- **Breakpoints:** 
  - Desktop: 1440px+ (Full 12-column)
  - Tablet: 768px - 1439px (8-column, sidebar collapses to icons)
  - Mobile: Under 767px (Single column, horizontal scrolling for data tables).

## Elevation & Depth

This design system avoids traditional shadows in favor of **Tonal Layering and Outlines** to maintain a "glass-cockpit" feel.

- **Level 0 (Background):** #0A0E1A - The primary canvas.
- **Level 1 (Surface):** #131929 - Used for cards and widgets. Defined by a 1px solid border of #1E2D4A.
- **Level 2 (Interaction):** When a card or element is hovered, the border color shifts to the Primary Accent (#00B4D8) at 50% opacity, rather than using a shadow.
- **Status Indicators:** Use a soft outer glow (0px 0px 8px) of the semantic color (Success/Warning/Danger) only for "Live" pulsing indicators to signify active monitoring.

## Shapes

The shape language is **Soft (0.25rem)**, providing a subtle professional refinement without appearing overly "consumer-grade" or friendly. 

- **Standard Elements:** Buttons, Input fields, and Cards use the 4px base radius.
- **Tags/Status Pills:** Use the `rounded-lg` (8px) setting to distinguish them from larger structural blocks.
- **Selection States:** Use sharp internal corners for "Tabs" or "Segmented Controls" to maintain the architectural feel of the system.

## Components

- **Buttons:** Primary buttons use a solid #00B4D8 fill with dark text. Secondary buttons use a #1E2D4A ghost style with a 1px border.
- **Compliance Cards:** Every card must feature a `label-sm` header and a border-top accent color (Primary, Success, or Danger) to categorize the widget content immediately.
- **Status Indicators:** A small 8px circle with a "pulse" animation (expanding ring) used next to "System Health" or "Real-time Feed" labels.
- **Data Tables:** Row borders should be #1E2D4A. Alternate row striping is discouraged; use subtle hover highlights instead. 
- **Input Fields:** Dark background (#0A0E1A) with 1px #1E2D4A borders. Focus state must trigger the #00B4D8 primary border.
- **DORA Classification Tags:** Use high-contrast background tints of semantic colors (e.g., Danger color at 15% opacity with solid Danger text) for risk levels (Critical, Important, Standard).