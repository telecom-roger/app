# Design Guidelines - Plataforma de Atendimento Inteligente

## Design Approach

**System:** Linear-inspired design system optimized for data-dense enterprise productivity applications

**Core Principles:**
- Information density with breathing room
- Scannable data hierarchies
- Consistent, predictable patterns
- Professional efficiency over visual flair

---

## Typography System

**Font Family:** Inter (Google Fonts CDN)
- Primary: Inter for all UI elements
- Monospace: 'Fira Code' for data fields, phone numbers, IDs

**Type Scale:**
- **Hero/Headers (h1):** text-3xl (30px), font-semibold, tracking-tight
- **Section Headers (h2):** text-xl (20px), font-semibold
- **Card/Panel Headers (h3):** text-lg (18px), font-medium
- **Body Text:** text-sm (14px), font-normal
- **Secondary/Metadata:** text-xs (12px), font-normal
- **Buttons/Labels:** text-sm (14px), font-medium
- **Table Headers:** text-xs (12px), font-semibold, uppercase, tracking-wide

**Line Heights:**
- Headers: leading-tight (1.25)
- Body: leading-relaxed (1.625)
- Data tables: leading-normal (1.5)

---

## Layout & Spacing System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16 (p-2, m-4, gap-6, space-y-8, py-12, mb-16)

**Container Strategy:**
- App shell: Fixed sidebar (w-64), fluid main content
- Content max-width: max-w-7xl mx-auto
- Page padding: px-6 py-8 (desktop), px-4 py-6 (mobile)
- Card/Panel padding: p-6 (desktop), p-4 (mobile)
- Compact sections: p-4
- Section spacing: space-y-8 for vertical rhythm

**Grid System:**
- Dashboard KPIs: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Client list/table: Full-width with internal column management
- Form layouts: grid-cols-1 md:grid-cols-2 gap-6
- Kanban columns: Dynamic width with min-w-80

---

## Component Library

### Navigation
**Sidebar (Fixed Left):**
- Width: w-64, full height, vertical nav
- Logo/Brand area: h-16 with p-4
- Nav items: px-4 py-2, rounded-md, with icons (20px) + text
- Active state: filled background, medium weight font
- Collapsible groups for Admin section

**Top Bar:**
- Height: h-16, border-bottom
- Search bar (center-left), user menu (right)
- Breadcrumbs for deep navigation

### Data Display
**Tables:**
- Striped rows (subtle), hover states
- Fixed header on scroll
- Cell padding: px-4 py-3
- Actions column (right-aligned): icon buttons
- Bulk selection checkboxes (left column)
- Sortable headers with caret icons

**Timeline Feed:**
- Vertical line connector (left side, 2px)
- Timeline items: ml-8, with dot indicator on line
- Card style for each item: rounded-lg, border, p-4
- Icon badges for item type (message, note, status change)
- Timestamp: text-xs, secondary text, top-right
- Expandable preview → full modal

**Kanban Board:**
- Columns: rounded-lg, min-w-80, max-w-sm, bg-subtle
- Column header: p-4, sticky top, with count badge
- Cards: rounded-md, p-4, mb-3, draggable cursor
- Card content: Client name (font-medium), metadata (text-xs), value (font-semibold if present)

### Forms & Inputs
**Input Fields:**
- Height: h-10, rounded-md, px-3
- Border: 1px solid, focus ring (2px)
- Label: text-sm font-medium, mb-2
- Helper text: text-xs, mt-1
- Error state: border-red, text-red-600

**Modals:**
- Max width: max-w-2xl for forms, max-w-4xl for complex content
- Padding: p-6
- Header: border-bottom, pb-4, with close button (top-right)
- Footer: border-top, pt-4, buttons right-aligned
- Backdrop: semi-transparent dark overlay

**Buttons:**
- Primary (CTAs): rounded-md, px-4 py-2, font-medium, uses #7069FF
- Secondary: border variant
- Ghost: transparent with hover background
- Icon buttons: w-9 h-9, rounded-md, centered icon
- **Buttons on images: backdrop-blur-sm bg-white/20 text-white**

### Cards & Panels
**Standard Card:**
- rounded-lg, border, shadow-sm
- Header section: p-4 border-b with title + actions
- Body: p-6
- Compact variant: p-4 throughout

**Stat Cards (Dashboard):**
- p-6, rounded-lg
- Value: text-2xl font-semibold
- Label: text-sm, secondary
- Icon: top-right, 24px
- Trend indicator: text-xs with arrow icon

### Interactive Elements
**Filters Panel:**
- Collapsible sidebar or top bar
- Filter groups: space-y-6
- Apply/Clear buttons at bottom

**Search:**
- Prominent position, min-w-96
- Magnifying glass icon (left)
- Keyboard shortcut hint (right): ⌘K
- Dropdown results: absolute, shadow-lg, max-h-96, overflow-auto

---

## Page-Specific Layouts

### Dashboard
- 4-column KPI cards at top (grid)
- Below: 2-column layout (graph + activity feed)
- Spacing: gap-6 between sections

### Import Wizard
- Stepper progress (top): 4 steps with connecting lines
- Content area: max-w-4xl mx-auto
- Preview table during mapping step
- Validation results: list with icons (success/error/warning)

### Client Profile
- **Layout:** Two-column (70/30 split on desktop)
- Left: Timeline feed (full height, scrollable)
- Right: Client info card (sticky), Quick actions panel
- Mobile: Stack vertically

### Kanban
- Horizontal scroll container
- Columns: flex, gap-4
- Add column button (right end)
- Filters in top bar

### Admin Panel
- Tab navigation for sections (Users, Fields, Templates, Settings)
- Content: max-w-5xl
- Side-by-side edit pattern: list (left 40%) + detail form (right 60%)

---

## Images

**Dashboard:** No hero image. Focus on data visualization and KPI cards.

**Login Page:** Optional subtle background gradient or abstract pattern (telecom/tech theme), but keep minimal to maintain professional focus. Logo centered.

**Empty States:** Simple illustrations for "No clients yet", "No messages", "Import your first file" - line art style, not photos.

**Client Timeline:** User avatars (32px rounded-full) for notes/actions by team members.

---

## Animations

**Minimal, purposeful only:**
- Modal enter/exit: 200ms ease-out scale + fade
- Dropdown menus: 150ms ease-out
- Kanban drag: smooth transform, no delay
- Button clicks: subtle scale (0.98)
- **No scroll animations, no excessive transitions**

---

## Responsive Behavior

**Breakpoints:**
- Mobile: < 768px - Stack columns, full-width cards, hamburger menu
- Tablet: 768px - 1024px - 2-column grids, visible sidebar
- Desktop: > 1024px - Full layout with fixed sidebar

**Mobile Adaptations:**
- Sidebar becomes slide-over drawer
- Tables: horizontal scroll or card view toggle
- Kanban: one column visible, swipe navigation
- Reduce padding: p-6 → p-4, gap-6 → gap-4