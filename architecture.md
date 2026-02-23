# EthanOS — Website Architecture Plan

## Overview
A Personal Operating System website — a decision engine for your life. Modular, customizable categories (not hardcoded to any activity), responsive (phone/tablet/desktop), cloud-synced via PutPut.io.

---

## File Structure

```
EthanOS/
├── index.html              ← Landing/Command Center (home page)
├── academic.html           ← Academic Brain
├── schedule.html           ← Schedule Intelligence
├── goals.html              ← Goal Engine
├── analytics.html          ← Performance Analytics
├── focus.html              ← Focus Mode
├── energy.html             ← Energy & Mood Tracking
├── roadmap.html            ← Roadmap Visualizer
├── decisions.html          ← Decision Simulator
├── identity.html           ← Identity System
├── balance.html            ← Life Balance
├── burnout.html            ← Burnout Monitor
├── procrastination.html    ← Procrastination Predictor
├── bigpicture.html         ← Big Picture View
├── vault.html              ← Knowledge Vault
├── xp.html                 ← XP & Competitive
├── settings.html           ← Settings & Category Manager
│
├── css/
│   └── style.css           ← Single shared stylesheet (theme, components, responsive)
│
├── js/
│   ├── data.js             ← PutPut.io data layer (cloud sync + localStorage cache)
│   ├── shared.js           ← Shared nav, helpers, sidebar, clock, modals, toasts
│   ├── command-center.js   ← index.html logic
│   ├── academic.js         ← academic.html logic
│   ├── schedule.js         ← schedule.html logic
│   ├── goals.js            ← goals.html logic
│   ├── analytics.js        ← analytics.html logic
│   ├── focus.js            ← focus.html logic
│   ├── energy.js           ← energy.html logic
│   ├── roadmap.js          ← roadmap.html logic
│   ├── decisions.js        ← decisions.html logic
│   ├── identity.js         ← identity.html logic
│   ├── balance.js          ← balance.html logic
│   ├── burnout.js          ← burnout.html logic
│   ├── procrastination.js  ← procrastination.html logic
│   ├── bigpicture.js       ← bigpicture.html logic
│   ├── vault.js            ← vault.html logic
│   ├── xp.js               ← xp.html logic
│   └── settings.js         ← settings.html logic
│
└── plan.md                 ← Original brainstorm
```

**Total: 17 HTML pages, 1 CSS file, 20 JS files**

---

## Why Multi-Page?

| Concern | Single-Page | Multi-Page (our choice) |
|---|---|---|
| Build complexity | One massive file | Each page is self-contained and small |
| Agent parallelism | Agents collide on same file | Each agent works on separate files |
| Load speed | Loads everything upfront | Only loads what you need |
| Maintainability | Find-and-fix in 5000 lines | Each module is ~200-400 lines |
| Adding/removing modules | Edit a megafile | Add/delete a file pair |

---

## Shared Layout (every page gets this)

Every HTML page includes the same shell:

```
┌─────────────────────────────────────────────┐
│  TOP BAR: Logo | Clock | Sync Status | ☰    │
├──────────┬──────────────────────────────────┤
│          │                                   │
│ SIDEBAR  │         PAGE CONTENT              │
│  NAV     │                                   │
│          │  (unique per page)                │
│ -----    │                                   │
│ 📊 Home  │                                   │
│ 📚 Acad  │                                   │
│ 📅 Sched │                                   │
│ 🎯 Goals │                                   │
│ 📈 Stats │                                   │
│ 🔥 Focus │                                   │
│ 💚 Mood  │                                   │
│ 🗺 Road  │                                   │
│ ⚖ Decis  │                                   │
│ 🧬 Ident │                                   │
│ ⚡ Balan  │                                   │
│ 🛡 Burn  │                                   │
│ ⏳ Procr  │                                   │
│ 👁 Big P │                                   │
│ 📝 Vault │                                   │
│ 🏆 XP    │                                   │
│ ⚙ Setti  │                                   │
│          │                                   │
└──────────┴──────────────────────────────────┘
```

- Sidebar highlights the current page
- Mobile: sidebar collapses to hamburger drawer
- The nav is actual `<a href="...">` links between pages
- shared.js injects the nav into each page (no copy-paste)

---

## Shared Files Detail

### css/style.css
- CSS custom properties for theming (dark theme default)
- Component library: cards, buttons, badges, progress bars, forms, modals, toasts, toggles, stat cards, grids
- Responsive breakpoints: 480px, 768px, 1024px
- Sidebar + topbar layout styles
- Utility classes
- Animations

### js/data.js — PutPut.io Integration
- `EthanOSData` class on `window.EthanOSData`
- **init()** — get/reuse guest token
- **saveData(key, data)** — upload JSON as txt file (delete old first, then upload new)
- **loadData(key, defaultValue)** — localStorage first, then fetch from PutPut.io
- **deleteData(key)** — remove from both
- **syncAll()** — pull all cloud data into localStorage
- **exportAll() / importAll(blob)** — backup/restore
- Files stored as `ethanos_{key}.json` on PutPut.io
- localStorage keys: `ethanos_cache_{key}`
- Token in: `ethanos_putput_token`

### js/shared.js — Common UI & Helpers
- Injects sidebar nav + topbar into every page
- Live clock
- Modal system: `openModal()`, `closeModal()`
- Toast system: `showToast()`
- Helper functions: `generateId()`, `formatDate()`, `formatTime()`, `timeAgo()`
- Category helpers: `getCategoryById()`, `getCategoryColor()`, etc.
- UI builders: `createProgressBar()`, `createStarRating()`, `createCategoryBadge()`
- XP helper: `awardXP(amount, reason)`
- Default data initializer (creates starter categories if none exist)
- Keyboard shortcuts (Escape closes modals)

---

## Data Schema (stored as JSON via PutPut.io)

Each key below = one JSON file in the cloud:

| Key | Shape | Description |
|-----|-------|-------------|
| `categories` | `[{id, name, icon, color, weeklyHoursTarget}]` | User-defined life categories |
| `tasks` | `[{id, title, categoryId, goalId?, difficulty:1-5, estimatedMinutes, actualMinutes?, completed, dueDate, completedAt?, createdAt}]` | All tasks/assignments |
| `goals` | `[{id, title, categoryId, targetDate, weeklyHours, milestones:[], progress:0-100, createdAt}]` | Long-term goals |
| `schedule` | `[{id, title, categoryId, startTime, endTime, recurring?, days:[]}]` | Recurring/one-time schedule blocks |
| `focusSessions` | `[{id, taskId?, categoryId, startTime, endTime, duration, distractionCount, difficultyRating, notes}]` | Focus mode logs |
| `moodEntries` | `[{id, date, energy:1-10, stress:1-10, sleep, workout:bool, notes}]` | Daily mood/energy check-ins |
| `notes` | `[{id, title, content, categoryId?, goalId?, tags:[], createdAt, updatedAt}]` | Knowledge vault entries |
| `identity` | `[{id, statement, categoryId}]` | Identity statements |
| `xp` | `{totalXp, level, weeklyScores:[], streaks:{}, achievements:[]}` | XP/gamification state |
| `settings` | `{userName, theme, focusDuration, breakDuration}` | User preferences |
| `roadmapEvents` | `[{id, title, date, categoryId, type}]` | Timeline events |

---

## Page-by-Page Breakdown

### 1. index.html — Command Center (Home)
**JS:** js/command-center.js
**What it shows:**
- Current time (large)
- "You have Xh Xm free today" (calculated from schedule)
- Top 3 priority tasks (soonest due + highest difficulty)
- Next hard deadline countdown
- Streak tracker per category
- Quick-add task (inline form)
- Today's schedule mini-timeline

### 2. academic.html — Academic Brain
**JS:** js/academic.js
**What it shows:**
- Task list with: difficulty stars, estimated time, due date, completion status
- "Overdue" / "Due soon" badges
- Sort by: due date, difficulty, time estimate
- Filter by category
- Add / Edit / Delete tasks (modal forms)
- Mark complete (awards XP)

### 3. schedule.html — Schedule Intelligence
**JS:** js/schedule.js
**What it shows:**
- Day view: 6am-11pm vertical timeline with color-coded blocks
- "Free time today" + "Longest uninterrupted block" stats
- Week view toggle (7-column grid)
- Add / Edit / Delete schedule items
- Today's task deadlines on the timeline

### 4. goals.html — Goal Engine
**JS:** js/goals.js
**What it shows:**
- Goal cards with progress bars
- Weekly hours, projected completion date
- "If X hrs/week -> done by [date]" calculator
- Milestone checklists per goal
- Add / Edit / Delete goals
- Progress slider

### 5. analytics.html — Performance Analytics
**JS:** js/analytics.js
**What it shows:**
- Hours by category (CSS horizontal bars)
- Planned vs actual hours
- Deep work stats
- GitHub-style activity heatmap (12 weeks of colored squares)
- Category breakdown

### 6. focus.html — Focus Mode
**JS:** js/focus.js
**What it shows:**
- Task selector or freeform mode
- Big countdown timer
- "Why this matters" (linked goal)
- Start / Pause / Stop
- Post-session: rate difficulty, log distractions, notes
- Awards +100 XP per session
- Recent session log

### 7. energy.html — Energy & Mood
**JS:** js/energy.js
**What it shows:**
- Daily check-in: energy (1-10), stress (1-10), sleep hours, workout toggle
- Awards +25 XP per check-in
- 14-day history bar chart
- Sleep trend + insight correlations
- Check-in streak

### 8. roadmap.html — Roadmap Visualizer
**JS:** js/roadmap.js
**What it shows:**
- Horizontal scrollable timeline
- Color-coded events by category
- Zoom: Year / Quarter / Month
- Goal target dates + task deadlines as markers
- Add / Edit / Delete events
- Today marker line

### 9. decisions.html — Decision Simulator
**JS:** js/decisions.js
**What it shows:**
- Tab 1: "What if I skip this task?" -> stress impact, goal delay, overdue risk
- Tab 2: "What if I add hours to [category]?" -> goal acceleration, trade-offs
- Uses real data for calculations

### 10. identity.html — Identity System
**JS:** js/identity.js
**What it shows:**
- "You are becoming someone who..." statements
- Daily spotlight (random statement, prominent card)
- Linked goal progress per statement
- Add / Edit / Delete statements

### 11. balance.html — Life Balance
**JS:** js/balance.js
**What it shows:**
- Target vs actual hours per category (horizontal bars)
- Warnings: "Below target" / "Neglected" / "Dominating"
- Balance score (0-100)
- CSS conic-gradient donut chart
- Suggestions based on imbalances

### 12. burnout.html — Burnout Monitor
**JS:** js/burnout.js
**What it shows:**
- Risk meter: Low / Medium / High / Critical
- Factor cards: consecutive heavy days, sleep trend, stress trend, overdue count, rest days
- Color-coded risk bar
- Recommendations
- Stress trend mini chart

### 13. procrastination.html — Procrastination Predictor
**JS:** js/procrastination.js
**What it shows:**
- Upcoming tasks with procrastination risk %
- Risk based on: difficulty, deadline distance, past patterns, category completion rates
- Color coded: green/yellow/red
- Tips per task
- Overall procrastination score

### 14. bigpicture.html — Big Picture
**JS:** js/bigpicture.js
**What it shows:**
- "Where time goes" vs "Where you want it" (side-by-side bars)
- Gap analysis per category
- Auto-generated key insight text
- Total productive hours comparison (this week vs last)

### 15. vault.html — Knowledge Vault
**JS:** js/vault.js
**What it shows:**
- Note list with search + filters (category, tags)
- Note editor (title, category, tags, textarea)
- Add / Edit / Delete notes
- Sort by newest, oldest, category

### 16. xp.html — XP & Competitive
**JS:** js/xp.js
**What it shows:**
- Level display + name (Beginner -> Legend)
- XP progress bar to next level
- This week vs last week XP
- XP earning rates reference
- Achievement badges grid (locked vs unlocked)

### 17. settings.html — Settings
**JS:** js/settings.js
**What it shows:**
- User name
- Category manager (add/edit/delete categories with emoji, color, hours target)
- Focus timer + break duration settings
- Cloud sync button
- Export / Import data
- Reset all data (danger zone)

---

## Agent Build Plan

Given the file structure, here's how to split the work across parallel agents:

| Agent | Files to Write | Depends On |
|-------|---------------|------------|
| **Agent 1: Foundation** | `css/style.css`, `js/data.js`, `js/shared.js` | Nothing |
| **Agent 2: Pages A** | `index.html`, `academic.html`, `schedule.html`, `goals.html`, `analytics.html`, `focus.html` + their JS files | Agent 1 (needs to know the CSS classes and shared.js API) |
| **Agent 3: Pages B** | `energy.html`, `roadmap.html`, `decisions.html`, `identity.html`, `balance.html`, `burnout.html` + their JS files | Agent 1 |
| **Agent 4: Pages C** | `procrastination.html`, `bigpicture.html`, `vault.html`, `xp.html`, `settings.html` + their JS files | Agent 1 |

**Agent 1 runs first.** Then Agents 2, 3, 4 run in parallel.

Each HTML page follows the same template:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EthanOS — [Page Name]</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app-shell"></div>  <!-- shared.js injects nav + topbar here -->
  <main class="main-content" id="page-content">
    <!-- Page-specific HTML here -->
  </main>
  <div id="modal-root"></div>
  <div id="toast-container"></div>
  <script src="js/data.js"></script>
  <script src="js/shared.js"></script>
  <script src="js/[page-name].js"></script>
</body>
</html>
```

---

## Responsive Behavior

| Breakpoint | Layout |
|---|---|
| > 1024px | Sidebar (240px) + content, multi-column grids |
| 768-1024px | Narrower sidebar (200px), 2-col grids |
| < 768px | Sidebar hidden (hamburger drawer), single column, stacked cards |
| < 480px | Minimal padding, compact stat cards |

---

## Customization System

Categories are the backbone. Everything references categories, nothing is hardcoded.

**Default starter categories** (created on first visit):
- School (📚, blue, 15 hrs/week)
- Coding (💻, purple, 10 hrs/week)
- Fitness (💪, green, 5 hrs/week)
- Projects (🔨, orange, 8 hrs/week)
- Personal (🌟, pink, 5 hrs/week)

User can add/edit/delete these freely in Settings. Every module adapts.

---

## Cross-Device Sync Flow

1. First visit: auto-creates PutPut.io guest token, stores in localStorage
2. All data writes: save to localStorage (instant) + upload to PutPut.io (background)
3. New device: enters token (or gets new one), hits "Sync" to pull cloud data
4. Export/Import as JSON backup for manual transfer
