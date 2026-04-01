# Frontend Redesign: Dark GitHub Theme to Light CHAT A.I+ Style

## Context

The Deep Research frontend currently uses a dark GitHub-style theme with hardcoded hex colors. The user wants to adopt the visual language from a CHAT A.I+ Figma prototype — a clean, light-first design with rounded corners, subtle shadows, and a modern chat interface layout. The branding stays "DeepResearch". Both light and dark modes must be supported with a toggle.

## Scope

- **In scope**: Chat screens only (new chat empty state + active conversation)
- **Out of scope**: Sign-up page, "Upgrade to Pro" tab, authentication

## Design Decisions

1. **Theme strategy**: Tailwind `darkMode: 'class'` with `dark` class on `<html>`. CSS variables for `.prose-report` and scrollbar (plain CSS). Tailwind `dark:` prefix for component JSX.
2. **Layout change**: Remove top header bar. Move "DeepResearch" branding into sidebar top. Two-column flex layout: sidebar + chat area.
3. **Default theme**: Light. Persist user preference in `localStorage('deep-research-theme')`.

## Color Palette

### Light Mode (default)
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#F5F5F5` | App background |
| Surface | `#FFFFFF` | Sidebar, cards, input bar |
| Surface-alt | `#F0F4F8` | Code blocks, user message bubble |
| Primary | `#4A6CF7` | Buttons, links, send button, active states |
| Text-primary | `#1A1A2E` | Headings, body text |
| Text-secondary | `#6B7280` | Labels, timestamps |
| Text-tertiary | `#9CA3AF` | Placeholders |
| Border | `#E5E7EB` | Input borders, card borders, dividers |
| Success | `green-600` / `green-50` bg | EEAT high, done status |
| Warning | `amber-600` / `amber-50` bg | EEAT medium, moderate complexity |
| Danger | `red-500` / `red-50` bg | Errors, EEAT low |

### Dark Mode (matches current theme)
| Token | Value |
|-------|-------|
| Background | `#0d1117` |
| Surface | `#161b22` |
| Surface-alt | `#21262d` |
| Primary | `#58a6ff` |
| Text-primary | `#e6edf3` |
| Text-secondary | `#8b949e` |
| Text-tertiary | `#484f58` |
| Border | `#30363d` |

## Component Designs

### Sidebar (rewrite)
- **Top**: FlaskConical icon + "DeepResearch" brand text
- **"New Research" button**: Pill-shaped, `bg-primary`, white text, `rounded-2xl`
- **Search icon button**: Circular, dark, next to the new research button
- **Section header**: "Your conversations" + "Clear All" link
- **History items**: Time-grouped (Today / Yesterday / Last 7 Days / Older), clean card style, hover highlight, trash icon on hover
- **Bottom**: Settings icon + ThemeToggle (Sun/Moon) + User avatar placeholder

### Empty State (rewrite)
- "DeepResearch" pill badge
- "Good day! How may I assist you today?" greeting (large text)
- 3-column grid of 6 capability cards:
  - Academic Research, Market Analysis, Technical Deep Dive
  - Literature Review, Fact Checking, Trend Analysis
- Each card: icon + title + example query, clickable (fills input with example query)

### Chat Input (rewrite)
- Rounded container (`rounded-2xl`), white surface, subtle shadow
- Left: emoji icon (decorative)
- Center: borderless textarea, "What's in your mind?..." placeholder
- Right: attachment icon (decorative) + blue circular send button
- Stop state: red circular button

### User Message (rewrite)
- Right-aligned bubble, `bg-surface-alt`, `rounded-2xl`, `max-w-[80%]`
- Edit icon on hover (decorative)

### Agent Message (color update + action bar)
- "DeepResearch" badge before agent name
- All 36 hardcoded hex colors mapped to light/dark dual values
- New action bar on hover: thumbs up/down, copy, share, more, regenerate
- Copy button wired to clipboard for report content

### EEATBadge (minor update)
- Add light mode colors (green-50/amber-50/gray-100 backgrounds)

## New Files
- `src/contexts/ThemeContext.tsx` — theme state, toggle, localStorage, `useTheme()` hook
- `src/components/ThemeToggle.tsx` — Sun/Moon icon button

## Unchanged Files
- `src/types.ts`
- `src/hooks/useResearch.ts`
- `src/lib/api.ts`
- `src/lib/parseReport.ts`

## Verification
1. Toggle light/dark on all states: empty, running, done, error, history session
2. Check `.prose-report` rendering (tables, code blocks, links) in both modes
3. Verify export MD/PDF still works
4. Run `npm run test` — existing tests should pass unchanged
5. Check WCAG contrast ratios in both modes
