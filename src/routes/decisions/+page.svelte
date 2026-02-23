<script>
  import { categories, goals, tasks, schedule, saveStore } from '$lib/stores/data.js';
  import { getCategoryById, getCategoryColor, COLOR_MAP, BADGE_CLASS_MAP } from '$lib/helpers.js';
  import { showToast } from '$lib/stores/toast.js';

  // --- Tab state ---
  let activeTab = $state('skip');

  // --- Skip Task state ---
  let skipTaskId = $state('');

  let incompleteTasks = $derived($tasks.filter(t => !t.completed));

  let skipResults = $derived.by(() => {
    if (!skipTaskId) return null;
    const task = $tasks.find(t => t.id === skipTaskId);
    if (!task) return null;

    // Stress impact
    let stressScore = 0;
    stressScore += (task.difficulty || 3) * 2;
    if (task.dueDate) {
      const daysUntil = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) stressScore += 10;
      else if (daysUntil < 2) stressScore += 8;
      else if (daysUntil < 7) stressScore += 4;
      else stressScore += 1;
    }
    stressScore = Math.min(10, stressScore);
    const stressColor = stressScore <= 3 ? 'success' : stressScore <= 6 ? 'warning' : 'danger';

    // Goal delay
    let goalDelay = 'No linked goal';
    if (task.goalId) {
      const linkedGoal = $goals.find(g => g.id === task.goalId);
      if (linkedGoal) {
        const estMinutes = task.estimatedMinutes || 30;
        const weeksDelay = (estMinutes / 60) / (linkedGoal.weeklyHours || 1);
        goalDelay = `Delays "${linkedGoal.title}" by ~${weeksDelay.toFixed(1)} week(s)`;
      }
    }

    // Overdue risk
    let overdueRisk = 'Low';
    let overdueColor = 'success';
    if (task.dueDate) {
      const dLeft = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (dLeft < 0) { overdueRisk = 'Already overdue!'; overdueColor = 'danger'; }
      else if (dLeft < 2) { overdueRisk = `Very High -- due in ${dLeft} day(s)`; overdueColor = 'danger'; }
      else if (dLeft < 5) { overdueRisk = `Medium -- due in ${dLeft} days`; overdueColor = 'warning'; }
      else { overdueRisk = `Low -- due in ${dLeft} days`; overdueColor = 'success'; }
    }

    return { stressScore, stressColor, goalDelay, overdueRisk, overdueColor };
  });

  // --- Add Hours state ---
  let hoursCatId = $state('');
  let extraHours = $state(5);

  let hoursResults = $derived.by(() => {
    if (!hoursCatId || extraHours <= 0) return null;
    const cat = getCategoryById($categories, hoursCatId);
    if (!cat) return null;

    // Goal acceleration
    const catGoals = $goals.filter(g => g.categoryId === hoursCatId);
    const accelItems = catGoals.map(goal => {
      const currentWeekly = goal.weeklyHours || 1;
      const newWeekly = currentWeekly + extraHours;
      const remaining = 100 - (goal.progress || 0);
      const currentWeeksLeft = remaining > 0 ? (remaining / (currentWeekly * (100 / 52))) : 0;
      const newWeeksLeft = remaining > 0 ? (remaining / (newWeekly * (100 / 52))) : 0;
      const saved = Math.max(0, currentWeeksLeft - newWeeksLeft);
      return { title: goal.title, weeksSaved: saved };
    });

    // Time trade-offs
    let totalTarget = 0;
    for (const c of $categories) totalTarget += c.weeklyHoursTarget || 0;
    const totalAvailable = 112; // ~16h/day * 7
    const freeHours = totalAvailable - totalTarget;
    let tradeoffFits = extraHours <= freeHours;
    let deficit = extraHours - freeHours;
    const otherCats = $categories.filter(oc => oc.id !== hoursCatId);
    const perCatLoss = deficit / Math.max(otherCats.length, 1);

    // Schedule load
    const newTotal = totalTarget + extraHours;
    const loadPct = Math.round((newTotal / totalAvailable) * 100);
    const loadColor = loadPct < 70 ? 'success' : loadPct < 85 ? 'warning' : 'danger';

    return {
      catGoals,
      accelItems,
      freeHours,
      tradeoffFits,
      deficit,
      otherCats,
      perCatLoss,
      newTotal,
      totalAvailable,
      loadPct,
      loadColor
    };
  });
</script>

<div class="page-header">
  <h1 class="page-title">Decision Simulator</h1>
  <p class="page-subtitle">Model "what if" scenarios using your real data</p>
</div>

<!-- Tabs -->
<div class="tabs" id="decision-tabs">
  <button
    class="tab{activeTab === 'skip' ? ' active' : ''}"
    onclick={() => activeTab = 'skip'}
  >What if I skip a task?</button>
  <button
    class="tab{activeTab === 'hours' ? ' active' : ''}"
    onclick={() => activeTab = 'hours'}
  >What if I add hours?</button>
</div>

<!-- Tab 1: Skip Task -->
{#if activeTab === 'skip'}
  <div>
    <div class="card mb-3">
      <div class="card-header">
        <h2 class="card-title">Select a Task to Skip</h2>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Task</label>
          <select bind:value={skipTaskId}>
            <option value="">-- Choose a task --</option>
            {#each incompleteTasks as t (t.id)}
              <option value={t.id}>{t.title}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    {#if skipResults}
      <div class="grid-3">
        <!-- Stress Impact -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Stress Impact</h3></div>
          <div class="card-body">
            <div class="stat-number {skipResults.stressColor}" style="font-size:var(--font-size-2xl)">{skipResults.stressScore}/10</div>
            <div class="mt-2">
              <div class="progress-bar">
                <div class="progress-bar-fill {skipResults.stressColor}" style:width="{skipResults.stressScore * 10}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Goal Delay -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Goal Delay</h3></div>
          <div class="card-body">
            <p style="font-size:var(--font-size-md)">{skipResults.goalDelay}</p>
          </div>
        </div>

        <!-- Overdue Risk -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Overdue Risk</h3></div>
          <div class="card-body">
            <span class="badge badge-lg badge-{skipResults.overdueColor}">{skipResults.overdueRisk}</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<!-- Tab 2: Add Hours -->
{#if activeTab === 'hours'}
  <div>
    <div class="card mb-3">
      <div class="card-header">
        <h2 class="card-title">Add Hours to a Category</h2>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select bind:value={hoursCatId}>
              <option value="">-- Choose a category --</option>
              {#each $categories as cat (cat.id)}
                <option value={cat.id}>{cat.icon} {cat.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Extra hours per week</label>
            <input type="number" min="1" max="40" bind:value={extraHours}>
          </div>
        </div>
      </div>
    </div>

    {#if hoursResults}
      <div class="grid-3">
        <!-- Goal Acceleration -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Goal Acceleration</h3></div>
          <div class="card-body">
            {#if hoursResults.catGoals.length === 0}
              <p class="text-muted">No goals in this category.</p>
            {:else}
              {#each hoursResults.accelItems as item}
                <div class="list-item">
                  <span>{item.title}: <strong class="text-success">~{item.weeksSaved.toFixed(1)} weeks faster</strong></span>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Time Trade-offs -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Time Trade-offs</h3></div>
          <div class="card-body">
            {#if hoursResults.tradeoffFits}
              <p class="text-success">You have ~{hoursResults.freeHours.toFixed(0)}h of unallocated time. This fits comfortably.</p>
            {:else}
              <p class="text-warning">This exceeds your free time by ~{hoursResults.deficit.toFixed(1)}h. Other categories would need to lose time:</p>
              {#each hoursResults.otherCats as oc}
                <div class="list-item">
                  <span>{oc.icon} {oc.name}: <strong class="text-danger">-{hoursResults.perCatLoss.toFixed(1)}h/week</strong></span>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Schedule Load -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Schedule Load</h3></div>
          <div class="card-body">
            <div class="stat-number {hoursResults.loadColor}" style="font-size:var(--font-size-2xl)">{hoursResults.loadPct}%</div>
            <div class="mt-2">
              <div class="progress-bar">
                <div class="progress-bar-fill {hoursResults.loadColor}" style:width="{hoursResults.loadPct}%"></div>
              </div>
            </div>
            <div class="text-sm text-secondary mt-1">{hoursResults.newTotal.toFixed(0)}h / {hoursResults.totalAvailable}h weekly capacity</div>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
