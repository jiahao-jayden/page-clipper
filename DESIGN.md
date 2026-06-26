---
name: Wiki Clipper
description: A calm, precise clipping tool for moving web content into a knowledge base.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0.006 145)"
  primary: "oklch(0.42 0.08 145)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.97 0.006 145)"
  secondary-foreground: "oklch(0.205 0.006 145)"
  muted: "oklch(0.97 0.006 145)"
  muted-foreground: "oklch(0.50 0.01 145)"
  accent: "oklch(0.97 0.006 145)"
  accent-foreground: "oklch(0.205 0.006 145)"
  border: "oklch(0.922 0.005 145)"
  input: "oklch(0.922 0.005 145)"
  ring: "oklch(0.55 0.06 145)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.025em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  badge-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "999px"
    padding: "2px 8px"
  textarea:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: Wiki Clipper

## 1. Overview

**Creative North Star: "Quiet Workbench"**

This system is a compact work surface for clipping knowledge. It should feel calm, precise, and restrained: a place where the user can inspect Markdown, add a note, and send the result onward without visual noise.

The visual language is intentionally familiar. It uses neutral surfaces, small type, clear borders, modest radii, and standard product controls. Personality comes from confidence and clarity, not from decoration.

It explicitly rejects SaaS marketing polish, heavy Obsidian cosplay, unnecessary darkness, terminal styling, inflated cards, gradients, and decorative motion.

**Key Characteristics:**
- Dense enough for repeated popup use.
- Neutral-first, with color reserved for state and primary action.
- Border and tonal layers before shadow.
- Familiar controls with visible hover, focus, disabled, loading, and error states.
- Text preview is the hero; chrome stays quiet.

## 2. Colors

The palette is Functional Sage: a restrained sage green brand hue (OKLCH hue 145) tints the primary action and subtly warms the neutral scale, while the interface remains predominantly white and gray. Accent usage stays under 10% of surface area. Destructive red is reserved for errors.

### Primary
- **Sage Ink** (`primary`): Deep sage green used for the primary clipping action, success states, and active emphasis. It should remain rare so it keeps authority.
- **Sage Ink Foreground** (`primary-foreground`): Used only on Sage Ink surfaces.

### Neutral (sage-tinted)
- **Workbench Surface** (`background`, `card`, `popover`): The default white surface for the popup and controls.
- **Workbench Ink** (`foreground`, `card-foreground`, `popover-foreground`): The main reading color, carrying a barely perceptible sage tint for cohesion.
- **Soft Layer** (`secondary`, `muted`, `accent`): The secondary background layer for badges, preview containers, and hover states, with a subtle sage warmth.
- **Muted Ink** (`muted-foreground`): Secondary text, placeholder text, loading copy, and quiet labels.
- **Hairline Border** (`border`, `input`): Dividers and field outlines, faintly sage-tinted.
- **Focus Ring** (`ring`): Sage-tinted focus-visible affordance, always paired with a clear border shift.
- **Error Red** (`destructive`): Error messages and destructive states only.

### Named Rules
**The Rarity Rule.** Sage ink is for the action that matters now. Do not spend it on decoration.

**The Neutral Honesty Rule.** Neutral roles must stay functional: surface, border, muted copy, focus, or state. The sage tint is atmospheric, not ornamental — no sage gradients or colored fills beyond the defined tokens.

## 3. Typography

**Display Font:** system UI sans stack.
**Body Font:** system UI sans stack.
**Label/Mono Font:** system UI sans for labels; UI monospace stack for Markdown preview.

**Character:** The type system is compact and utilitarian. It uses weight, size, and case sparingly so the popup reads like a tool, not a landing page.

### Hierarchy
- **Title** (600, `0.875rem`, tight line-height): Popup title and key section headings.
- **Body** (400, `0.875rem`, comfortable line-height): Controls, form text, and general interface copy.
- **Label** (600, `0.6875rem`, slight tracking, uppercase only for section labels): Small structural markers such as "Markdown 预览" and "备注".
- **Mono** (400, `0.75rem`, relaxed line-height): Markdown preview content where scanability matters more than typographic expression.

### Named Rules
**The No Display Drama Rule.** Product UI labels never use display typography, oversized headings, or decorative font pairings.

**The Preview Leads Rule.** Monospace belongs to the Markdown preview, not to the whole product. Do not let it turn the interface into terminal styling.

## 4. Elevation

The system is flat by default and tonal when needed. Depth is expressed with borders, muted backgrounds, and focus rings; shadows are minimal and reserved for standard component affordance rather than atmosphere.

### Shadow Vocabulary
- **Shadow XS** (`shadow-xs`): A tiny structural shadow for outline controls and text fields. Use only when a control needs separation from a flat surface.

### Named Rules
**The Flat Workbench Rule.** Surfaces rest flat. If a shadow becomes visually noticeable before interaction, it is probably too much.

## 5. Components

### Buttons
- **Shape:** gently rounded rectangle (`8px` radius).
- **Primary:** Action Ink background with Action Ink Foreground text; compact height (`36px`) and horizontal padding (`16px`).
- **Hover / Focus:** hover slightly darkens the primary surface; focus uses border plus a `3px` ring at 50% ring opacity.
- **Secondary / Outline:** white background, border, tiny shadow, and Soft Layer hover. It must read as available but secondary.
- **Loading / Disabled:** loading keeps the button footprint stable with an inline spinner; disabled lowers opacity and blocks interaction.

### Chips
- **Style:** rounded-full secondary badge with compact horizontal padding.
- **Role:** show source platform or metadata. Chips are labels, not calls to action.
- **State:** avoid heavy accent fills for inactive metadata.

### Cards / Containers
- **Corner Style:** medium to large rounded corners (`8px` to `10px`) depending on density.
- **Background:** Workbench Surface at rest; Soft Layer at low emphasis, such as preview container fill.
- **Shadow Strategy:** flat by default; use borders first.
- **Border:** Hairline Border is the normal separation mechanism.
- **Internal Padding:** compact (`12px`) for preview blocks, slightly larger (`16px`) for popup frame padding.

### Inputs / Fields
- **Style:** transparent or surface background, Hairline Border, `8px` radius, compact padding.
- **Focus:** border shifts to Focus Ring and adds a `3px` ring; never rely on color alone.
- **Error / Disabled:** destructive ring for invalid states; disabled uses opacity and cursor state.

## 6. Do's and Don'ts

### Do:
- **Do** keep the popup dense and task-first; the Markdown preview is the primary content.
- **Do** use the neutral tokens from `assets/tailwind.css` instead of inventing new grays.
- **Do** reserve Action Ink for primary action, active emphasis, and essential state.
- **Do** show status with text and iconography, not color alone.
- **Do** keep motion to state feedback between `150ms` and `250ms`, with reduced-motion alternatives.

### Don't:
- **Don't** make this look like a SaaS marketing surface with gradients, inflated cards, hero metrics, or decorative motion.
- **Don't** over-mimic Obsidian with a heavy plugin aesthetic or unnecessary darkness.
- **Don't** introduce terminal or hacker styling; monospace is for Markdown preview only.
- **Don't** add glassmorphism, colored side-stripe borders, gradient text, or oversized rounded cards.
- **Don't** use shadow as atmosphere. If a card needs structure, use border and tonal fill first.
