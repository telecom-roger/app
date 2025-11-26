# Design Guidelines - Plataforma de Atendimento Inteligente

## Design Approach

**System:** Modern Startup Design (Linear + Vercel + Figma inspired)

**Core Principles:**
- Clean, spacious layouts with premium whitespace
- Modern sans-serif typography (Inter)
- Smooth micro-interactions and elevation effects
- Data-driven UI with visual hierarchy
- Professional but approachable aesthetic
- Dark/Light mode fully supported

---

## Typography System

**Font Family:** Inter (sans-serif, modern)
- Primary: Inter for all UI
- Monospace: 'Fira Code' for data/codes

**Type Scale:**
- **Hero (h1):** text-4xl, font-bold, tracking-tight
- **Page Title (h2):** text-3xl, font-semibold, tracking-tight
- **Section Headers (h3):** text-xl, font-semibold
- **Card Headers (h4):** text-lg, font-medium
- **Body Text:** text-sm (14px), font-normal, leading-relaxed
- **Secondary/Meta:** text-xs (12px), font-normal, text-muted-foreground
- **Buttons:** text-sm (14px), font-medium
- **Table Headers:** text-xs, font-semibold, uppercase

---

## Color Palette

**Primary Brand Colors:**
- Dark Blue (Primary): #1A0B41 - Deep, professional, trustworthy
- Purple Accent (CTA): #7069FF - Vibrant, modern, action-oriented
- Neutral Base: White (#FFFFFF) & Dark (#0F0F0F)

**Semantic Colors:**
- Success: #10B981 (emerald)
- Warning: #F59E0B (amber)
- Destructive: #EF4444 (red)
- Info: #3B82F6 (blue)

**Background Layers:**
- Canvas: Pure white (light) / Dark slate (dark)
- Surface: Subtle gray (light) / Elevated dark (dark)
- Muted: 95% opacity overlays

---

## Layout & Spacing System

**Spacing Scale (Tailwind):**
- Extra Small: 2px (gap-0.5, p-0.5)
- Small: 8px (gap-2, p-2, mb-2)
- Medium: 16px (gap-4, p-4, space-y-4) ← MOST COMMON
- Large: 24px (gap-6, p-6, space-y-6)
- Extra Large: 32px (gap-8, p-8, space-y-8)

**Container Strategy:**
- App shell: Fixed sidebar (w-64) + fluid main content
- Page max-width: max-w-7xl mx-auto
- Page padding: px-6 py-8 (desktop), px-4 py-6 (mobile)
- Card padding: p-6 (default), p-4 (compact)
- Content columns: gap-6 (default), gap-4 (mobile)

**Grid & Layout:**
- Dashboard: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Forms: grid-cols-1 md:grid-cols-2 gap-6
- Campaign Editor: 2-column (60/40) on desktop, stacked on mobile
- Kanban: Horizontal scroll with min-w-80 columns

---

## Component Library

### Navigation
**Sidebar (Fixed Left):**
- Width: w-64 (fixed), full height, border-right
- Logo area: h-16, p-4, flex items-center justify-center
- Nav items: px-4 py-2, rounded-md, with icon (20px) + text
- Active state: bg-primary text-white, font-semibold
- Hover: hover-elevate effect (preset)
- Groups: Collapsible with label (uppercase, smaller text)

**Header Bar:**
- Height: h-16, fixed top, border-bottom
- Flex row: items-center justify-between
- Left: SidebarTrigger + page title
- Right: Theme toggle, user menu

### Forms & Inputs
**Text Input / Select:**
- Height: h-10 (default), rounded-md
- Padding: px-3 py-2
- Border: 1px solid border-input
- Focus: ring-2 ring-primary/50
- Label: text-sm font-medium, block mb-2
- Helper: text-xs text-muted-foreground

**Textarea:**
- Min-height: h-48 (for campaign editor)
- Font: font-mono text-sm
- Resize: resize-none (controlled)
- Padding: p-3, line-height: leading-relaxed

**Select/Dropdown:**
- Height: h-10, px-3
- Max-height content: max-h-72 (scrollable)
- Item size: text-sm py-2 px-2
- Hover: hover-elevate

### Buttons
**Variants:**
- **Primary (default):** bg-primary text-white, px-4 py-2
- **Outline:** border-1 border-input, hover-elevate
- **Ghost:** transparent, hover:bg-muted
- **Secondary:** bg-secondary text-secondary-foreground
- **Destructive:** bg-destructive text-white

**Sizes:**
- **sm:** px-3 py-1, text-sm
- **default:** px-4 py-2, text-sm
- **lg:** px-6 py-3, text-base
- **icon:** h-10 w-10, rounded-md, centered

**Interactions:**
- Hover: hover-elevate (preset in index.css)
- Active/Press: active-elevate-2 (preset)
- Disabled: opacity-50 cursor-not-allowed

### Cards
**Standard Card:**
- rounded-lg, border-1, shadow-sm
- Header: border-b pb-4, mb-4
- Content: p-6 (comfortable padding)
- Footer: border-t pt-4 (optional)
- Hover: hover-elevate for interactive cards

**Badge:**
- Inline, small padding: px-2.5 py-0.5
- Rounded-full, text-xs
- Variant colors: default, secondary, outline, destructive

### Data Display
**Table:**
- Striped rows: odd:bg-muted/40
- Hover: hover:bg-muted/60 transition
- Cell padding: px-4 py-3
- Header: uppercase text-xs font-semibold
- Scrollable: overflow-x-auto on mobile

**Progress Bar:**
- Height: h-2 (default), h-3 (large)
- Rounded-full, bg-muted, overflow-hidden
- Fill: bg-primary with smooth animation

### Modals & Dialogs
**Modal Container:**
- Max-width: max-w-2xl (default), max-w-4xl (large)
- Rounded-lg, shadow-2xl
- Padding: p-6
- Header: border-b pb-4, mb-6
- Footer: border-t pt-4, flex justify-end gap-2
- Backdrop: bg-black/50 fixed inset-0

---

## Page-Specific Layouts

### Campaigns (WhatsApp / Scheduled)
**Layout:** 2-column grid on desktop, stacked on mobile
- **Left (60%):** Contacts input + preview table
- **Right (40%):** Message template editor + model selector
- Spacing: gap-8 between columns, space-y-6 within sections

**Components:**
- Input section: Card with large textarea (h-56)
- Preview table: max-h-64 with overflow-auto
- Template selector: w-full, h-10
- Live preview: bg-primary/5 border-primary/20, max-h-32

### Dashboard
- KPI cards: 4-column grid (responsive: 1→2→4)
- Each card: p-6, value text-2xl font-semibold
- Below: 2-column (charts + activity feed)

### Admin / Settings
- Tab navigation: TabsList with TabsTriggers
- Content: max-w-5xl mx-auto
- Two-column form: left (list) + right (detail)

### Client Profile / Details
- Timeline: Left side (full-height scrollable)
- Info panel: Right side (sticky on desktop)
- Mobile: Stack vertically

---

## Animations & Transitions

**Micro-interactions:**
- Hover elevation: Use hover-elevate class (preset)
- Button clicks: Active-elevate-2 (preset)
- Page transitions: fade-in 150ms ease-out
- Modal open/close: scale 95→100 + fade 200ms

**Avoid:**
- Excessive animations on scroll
- Layout shifts on hover (use visibility:hidden instead of display:none)
- Animations on mobile (keep snappy)

---

## Dark Mode

**Implementation:**
- CSS variables with light/dark variants
- Automatic toggle via theme provider
- Color scale: All semantic colors have dark equivalents
- Example: `bg-white dark:bg-slate-950`

**Color Adjustments:**
- Text: dark:text-slate-100
- Borders: dark:border-slate-700
- Backgrounds: Inverted contrast hierarchy

---

## Responsive Design

**Breakpoints:**
- Mobile: < 768px (compact, single column)
- Tablet: 768px - 1024px (2 columns)
- Desktop: > 1024px (full layout, sidebar visible)

**Adaptations:**
- Sidebar: Hamburger menu on mobile (drawer)
- Grids: 1 column → 2 columns → full responsive
- Tables: Horizontal scroll or card view on mobile
- Modals: max-w-full on mobile, p-4 padding

---

## Design Tokens (CSS Variables)

Primary theme colors already configured in `index.css` as HSL variables:
- `--primary`: 266 95% 27% (Primary Blue)
- `--accent`: 266 95% 44% (Purple CTA)
- `--background`: Light/Dark backgrounds
- `--foreground`: Text colors
- `--muted`: Secondary/tertiary text
- `--border`: Border colors

Use throughout: `bg-primary`, `text-primary`, `border-primary`, etc.

---

## Accessibility

**Requirements:**
- All interactive elements: data-testid (button, input, link)
- Keyboard navigation: Tab, Enter, Escape
- Color contrast: WCAG AA minimum (4.5:1 for text)
- ARIA labels: form fields with `<Label>` + htmlFor
- Focus states: ring-2 ring-primary always visible

---

## Professional Polish Checklist

- ✅ Consistent spacing (use multiples of 4px)
- ✅ Hover states on all interactive elements
- ✅ Loading states (spinners, skeletons)
- ✅ Empty states (illustrations, helpful text)
- ✅ Error handling (validation messages, toasts)
- ✅ Responsive on all breakpoints
- ✅ Dark mode support
- ✅ Fast interactions (200ms max for perceived delays)
