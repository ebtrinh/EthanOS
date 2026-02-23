<script>
  import { categories, goals, focusSessions, saveStore } from '$lib/stores/data.js';
  import { generateId, formatDate, getCategoryById, getCategoryColor, COLOR_MAP, BADGE_CLASS_MAP } from '$lib/helpers.js';
  import { showToast } from '$lib/stores/toast.js';
  import { openModal, closeModal } from '$lib/stores/modal.js';

  // --- Completion Calculator state ---
  let calcHours = $state(10);
  let calcGoalId = $state('');

  let calcResult = $derived.by(() => {
    if (!calcGoalId || calcHours <= 0) return '--';
    const goal = $goals.find(g => g.id === calcGoalId);
    if (!goal) return '--';
    const remaining = 100 - (goal.progress || 0);
    if (remaining <= 0) return 'Already complete!';
    const hoursNeeded = remaining; // rough: 1 hour = 1%
    const weeksNeeded = hoursNeeded / calcHours;
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + Math.ceil(weeksNeeded * 7));
    return formatDate(completionDate);
  });

  // --- Weekly hours calculation ---
  function calcWeeklyHours(goalId) {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    let total = 0;
    for (const s of $focusSessions) {
      const sDate = new Date(s.startTime || s.endTime);
      if (sDate >= weekAgo && sDate <= now) {
        total += (s.duration || 0) / 60;
      }
    }
    return total;
  }

  // --- Projected completion ---
  function getProjected(goal, weeklyHrs) {
    const progress = goal.progress || 0;
    if (progress >= 100) return 'Complete!';
    if (weeklyHrs <= 0) return '--';
    const remaining = 100 - progress;
    const weeksLeft = remaining / weeklyHrs;
    const projDate = new Date();
    projDate.setDate(projDate.getDate() + Math.ceil(weeksLeft * 7));
    return formatDate(projDate);
  }

  // --- Progress color ---
  function progressColor(progress) {
    if (progress >= 100) return 'success';
    if (progress >= 50) return 'warning';
    return '';
  }

  // --- Update progress via slider ---
  function updateProgress(goalId, val) {
    $goals = $goals.map(g => g.id === goalId ? { ...g, progress: parseInt(val) || 0 } : g);
    saveStore('goals', $goals);
  }

  // --- Toggle milestone ---
  function toggleMilestone(goalId, milestoneIdx, checked) {
    $goals = $goals.map(g => {
      if (g.id === goalId && g.milestones && g.milestones[milestoneIdx]) {
        const milestones = [...g.milestones];
        milestones[milestoneIdx] = { ...milestones[milestoneIdx], done: checked };
        return { ...g, milestones };
      }
      return g;
    });
    saveStore('goals', $goals);
  }

  // --- Delete goal ---
  function deleteGoal(id) {
    $goals = $goals.filter(g => g.id !== id);
    saveStore('goals', $goals);
    showToast('Goal deleted', 'warning');
  }

  // --- Goal modal ---
  function openGoalModal(goal) {
    const isEdit = !!goal;
    const cats = $categories;

    let catOptions = '';
    for (const cat of cats) {
      const sel = (goal && goal.categoryId === cat.id) ? ' selected' : '';
      catOptions += `<option value="${cat.id}"${sel}>${cat.icon} ${cat.name}</option>`;
    }

    let milestonesVal = '';
    if (goal && goal.milestones) {
      milestonesVal = goal.milestones.map(m => m.title).join('\n');
    }

    const html = `<form id="goal-form">
      <div class="form-group">
        <label class="form-label">Goal Title</label>
        <input type="text" id="gf-title" value="${goal ? goal.title.replace(/"/g, '&quot;') : ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select id="gf-category">${catOptions}</select>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Target Date</label>
          <input type="date" id="gf-target" value="${goal && goal.targetDate ? goal.targetDate.split('T')[0] : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Weekly Hours</label>
          <input type="number" id="gf-hours" min="0" max="168" value="${goal ? (goal.weeklyHours || '') : ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Milestones (one per line)</label>
        <textarea id="gf-milestones" rows="4" placeholder="Learn basics&#10;Build project&#10;Final review">${milestonesVal}</textarea>
      </div>
      <div class="flex gap-1" style="justify-content:flex-end">
        <button type="button" class="btn" id="gf-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add Goal'}</button>
      </div>
    </form>`;

    openModal(isEdit ? 'Edit Goal' : 'Add Goal', html);

    // Bind after modal renders
    requestAnimationFrame(() => {
      const form = document.getElementById('goal-form');
      const cancelBtn = document.getElementById('gf-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const title = document.getElementById('gf-title').value.trim();
          if (!title) return;

          const milestoneLines = document.getElementById('gf-milestones').value.split('\n').filter(l => l.trim());
          const milestones = milestoneLines.map((line, idx) => {
            if (goal && goal.milestones && goal.milestones[idx]) {
              return { title: line.trim(), done: goal.milestones[idx].done || false };
            }
            return { title: line.trim(), done: false };
          });

          if (isEdit) {
            $goals = $goals.map(g => {
              if (g.id !== goal.id) return g;
              return {
                ...g,
                title,
                categoryId: document.getElementById('gf-category').value,
                targetDate: document.getElementById('gf-target').value || null,
                weeklyHours: parseFloat(document.getElementById('gf-hours').value) || 0,
                milestones
              };
            });
          } else {
            $goals = [...$goals, {
              id: generateId(),
              title,
              categoryId: document.getElementById('gf-category').value,
              targetDate: document.getElementById('gf-target').value || null,
              weeklyHours: parseFloat(document.getElementById('gf-hours').value) || 0,
              milestones,
              progress: 0,
              createdAt: new Date().toISOString()
            }];
          }

          saveStore('goals', $goals);
          closeModal();
          showToast(isEdit ? 'Goal updated' : 'Goal added', 'success');
        });
      }
    });
  }
</script>

<div class="page-header flex-between">
  <div>
    <h1 class="page-title">Goal Engine</h1>
    <p class="page-subtitle">Track your long-term goals and milestones</p>
  </div>
  <button class="btn btn-primary" onclick={() => openGoalModal(null)}>+ Add Goal</button>
</div>

<!-- Completion Calculator -->
<div class="card mb-3">
  <div class="card-header">
    <h2 class="card-title">Completion Calculator</h2>
  </div>
  <div class="card-body">
    <div class="flex flex-wrap gap-2 items-center">
      <span class="text-secondary">If I invest</span>
      <input type="number" min="1" max="168" bind:value={calcHours} style="width:80px">
      <span class="text-secondary">hrs/week, goal</span>
      <select bind:value={calcGoalId} style="width:200px">
        <option value="">Select a goal</option>
        {#each $goals as g (g.id)}
          <option value={g.id}>{g.title}</option>
        {/each}
      </select>
      <span class="text-secondary">finishes by</span>
      <span class="font-bold text-accent">{calcResult}</span>
    </div>
  </div>
</div>

<!-- Goal Cards -->
<div class="grid-dashboard" id="goals-container">
  {#if $goals.length === 0}
    <div class="empty-state span-full">
      <div class="empty-state-icon">&#127919;</div>
      <div class="empty-state-title">No goals yet</div>
      <div class="empty-state-text">Click "Add Goal" to set your first goal</div>
    </div>
  {:else}
    {#each $goals as g (g.id)}
      {@const cat = getCategoryById($categories, g.categoryId)}
      {@const color = getCategoryColor($categories, g.categoryId)}
      {@const progress = g.progress || 0}
      {@const weeklyHrs = calcWeeklyHours(g.id)}
      {@const projected = getProjected(g, weeklyHrs)}
      {@const pColor = progressColor(progress)}

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title" style:color={color}>{g.title}</div>
            <div class="card-subtitle">
              {#if cat}
                <span class="badge {BADGE_CLASS_MAP[cat.color] || ''}">{cat.icon} {cat.name}</span>
              {/if}
              {#if g.targetDate}
                Target: {formatDate(g.targetDate)}
              {/if}
            </div>
          </div>
          <div class="btn-group">
            <button class="btn btn-sm btn-ghost" onclick={() => openGoalModal(g)}>Edit</button>
            <button class="btn btn-sm btn-danger" onclick={() => deleteGoal(g.id)}>Del</button>
          </div>
        </div>
        <div class="card-body">
          <div class="progress-label">
            <span class="progress-label-name">Progress</span>
            <span class="progress-label-value">{progress}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-bar-fill{pColor ? ' ' + pColor : ''}"
              style:width="{progress}%"
            ></div>
          </div>

          <div class="grid-2 mt-2">
            <div class="text-sm"><span class="text-muted">Weekly hours:</span> <strong>{weeklyHrs.toFixed(1)}h</strong></div>
            <div class="text-sm"><span class="text-muted">Projected:</span> <strong>{projected}</strong></div>
          </div>

          <!-- Progress slider -->
          <div class="mt-2">
            <label class="text-xs text-muted">Adjust progress</label>
            <input
              type="range" min="0" max="100" value={progress}
              style="width:100%;accent-color:{color}"
              onchange={(e) => updateProgress(g.id, e.target.value)}
            >
          </div>

          <!-- Milestones -->
          {#if g.milestones && g.milestones.length > 0}
            <div class="mt-2">
              {#each g.milestones as ms, idx}
                <label class="form-check" style="margin-bottom:4px">
                  <input
                    type="checkbox"
                    checked={ms.done}
                    onchange={(e) => toggleMilestone(g.id, idx, e.target.checked)}
                  >
                  <span style={ms.done ? 'text-decoration:line-through;color:var(--text-muted)' : ''}>{ms.title}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>
