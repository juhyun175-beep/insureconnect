# InsureConnect Design Tokens v1

## Purpose and Stage 1 boundary

This document is the canonical design-token contract for InsureConnect. Stage 1 introduces it additively: no existing selector uses these tokens yet, and no legacy CSS variable is removed or changed. The production default remains light mode. The existing dark mode is opt-in through `data-theme="dark"`; automatic `prefers-color-scheme` detection is not permitted.

## Color tokens

| Token | Value | Purpose |
| --- | --- | --- |
| `--ic-blue` | `#1a3de8` | Brand blue and primary accent |
| `--ic-blue-hover` | `#1533c4` | Primary interactive hover state |
| `--ic-blue-soft` | `rgba(26,61,232,0.08)` | Soft brand-tinted background |
| `--ic-gray-900` | `#37352f` | Primary text |
| `--ic-gray-600` | `#6b6a66` | Secondary text |
| `--ic-gray-400` | `#9b9a97` | Placeholder and tertiary text |
| `--ic-gray-200` | `rgba(55,53,47,0.12)` | Borders |
| `--ic-gray-100` | `#f1f1ef` | Light neutral background |
| `--ic-bg` | `#f7f7f5` | Page background |
| `--ic-surface` | `#ffffff` | Card and surface background |
| `--ic-success` | `#16a34a` | Success state |
| `--ic-warning` | `#d97706` | Warning state |
| `--ic-danger` | `#dc2626` | Error and destructive state |

## Typography tokens

| Token | Value |
| --- | --- |
| `--fs-xs` | `12px` |
| `--fs-sm` | `13px` |
| `--fs-base` | `14px` |
| `--fs-lg` | `16px` |
| `--fs-xl` | `20px` |
| `--fs-2xl` | `24px` |

Only font weights `400`, `600`, and `700` are allowed for new UI work. The minimum new UI font size is `12px`; fractional font-size values are not allowed.

## Radius and shadow tokens

| Category | Token | Value | Intended use |
| --- | --- | --- |
| Radius | `--r-sm` | `6px` | Buttons and inputs |
| Radius | `--r-md` | `10px` | Cards and modals |
| Radius | `--r-full` | `999px` | Badges and pills |
| Shadow | `--sh-1` | `0 1px 3px rgba(15,15,15,0.06)` | Subtle elevation |
| Shadow | `--sh-2` | `0 8px 24px rgba(15,15,15,0.10)` | Dialog and high elevation |

## Compatibility mapping

The following mapping explains the relationship to legacy variables. It is informational only and does not authorize selector replacement in Stage 1.

| Legacy variable | Canonical token |
| --- | --- |
| `--blue-mid` | `--ic-blue` |
| `--bg` | `--ic-bg` |
| `--bg-card` | `--ic-surface` |
| `--txt-hi` | `--ic-gray-900` |
| `--txt-mid` | `--ic-gray-600` |
| `--txt-lo` | `--ic-gray-400` |
| `--radius` | `--r-md` |
| `--sh-sm` | `--sh-1` |

## Non-negotiable rules

1. `linear-gradient` is prohibited except inside the logo SVG, including text gradients.
2. Emoji are prohibited as UI icons. User-created content remains exempt.
3. New badges use one base badge style; only semantic color variation is allowed (`--ic-blue`, `--ic-success`, `--ic-warning`, `--ic-danger`).
4. Hover states must not use `transform: translateY`; use background or border changes instead.
5. New UI work must not introduce hard-coded hex colors; use these tokens through `var()`.
6. Dark token overrides remain opt-in under `[data-theme="dark"]`; do not remove the existing user choice or add automatic theme detection.
