# EthanOS Updates — Execution Plan

## Update 1: Schedule → Full Calendar App (Google Calendar style)
**Files:** `schedule.html`, `js/schedule.js`, `css/style.css`, `scheduleplan.md`
- Month view (default): full month grid, events as colored pills
- Week view: 7-column × hourly-row grid with event blocks
- Day view: single column hourly view with detailed blocks
- Navigation: Prev/Next + Today button + Month/Week/Day toggle
- Click empty slot to quick-add, click event for popover edit/delete
- Same data schema, no migration needed

## Update 2: Canvas LMS Integration ⏳ DEFERRED
Saved for later.

## Update 3: Fix Cross-Device Data Sync
**Files:** `js/data.js`
- Root cause: loadData() returns localStorage immediately, never checks cloud
- Fix: cloud-first when online, localStorage as fallback
- Ensures notes/data appear across devices and incognito

## Update 4: Remove Confusing "Offline" Indicator
**Files:** `js/shared.js`
- Remove sync-status div from topbar
- Remove setSyncStatus() and all calls
- Data layer unchanged, just hide confusing UI

## Execution Order
1. ✅ Update 4 (smallest)
2. ✅ Update 3 (sync fix)
3. ✅ Update 1 (calendar redesign + scheduleplan.md)
4. ⏳ Update 2 (Canvas — deferred)
