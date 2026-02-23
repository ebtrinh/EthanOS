/**
 * EthanOS — Academic Brain (academic.html)
 *
 * Full task list with difficulty stars, estimated time, due date, completion status.
 * Overdue/Due soon badges. Sort/Filter. Add/Edit/Delete via modals. Mark complete awards XP.
 */

(function () {
  'use strict';

  var tasks = [];
  var categories = [];
  var currentSort = 'dueDate';
  var currentFilter = 'all';

  /* ======================================================================
     BOOT
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(async function () {
      await loadData();
      populateFilterDropdown();
      bindEvents();
      render();
    }, 400);
  });

  async function loadData() {
    tasks = await window.EthanOSData.loadData('tasks', []);
    categories = getAllCategories();
  }

  /* ======================================================================
     EVENTS
     ====================================================================== */
  function bindEvents() {
    document.getElementById('add-task-btn').addEventListener('click', function () {
      openTaskModal(null);
    });

    document.getElementById('sort-select').addEventListener('change', function () {
      currentSort = this.value;
      render();
    });

    document.getElementById('filter-category').addEventListener('change', function () {
      currentFilter = this.value;
      render();
    });
  }

  function populateFilterDropdown() {
    var sel = document.getElementById('filter-category');
    sel.innerHTML = '<option value="all">All Categories</option>';
    var cats = getAllCategories();
    for (var i = 0; i < cats.length; i++) {
      var opt = document.createElement('option');
      opt.value = cats[i].id;
      opt.textContent = cats[i].icon + ' ' + cats[i].name;
      sel.appendChild(opt);
    }
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function render() {
    var filtered = tasks.slice();

    // Filter
    if (currentFilter !== 'all') {
      filtered = filtered.filter(function (t) { return t.categoryId === currentFilter; });
    }

    // Sort
    filtered.sort(function (a, b) {
      if (currentSort === 'dueDate') {
        var dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        var dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dA - dB;
      } else if (currentSort === 'difficulty') {
        return (b.difficulty || 0) - (a.difficulty || 0);
      } else if (currentSort === 'estimate') {
        return (a.estimatedMinutes || 0) - (b.estimatedMinutes || 0);
      }
      return 0;
    });

    // Count badges
    var now = new Date();
    var overdue = 0;
    var dueSoon = 0;
    var completed = 0;

    for (var k = 0; k < tasks.length; k++) {
      if (tasks[k].completed) { completed++; continue; }
      if (!tasks[k].dueDate) continue;
      var due = new Date(tasks[k].dueDate);
      var diffDays = Math.ceil((due - now) / 86400000);
      if (diffDays < 0) overdue++;
      else if (diffDays <= 2) dueSoon++;
    }

    document.getElementById('overdue-count').textContent = overdue + ' overdue';
    document.getElementById('due-soon-count').textContent = dueSoon + ' due soon';
    document.getElementById('completed-count').textContent = completed + ' completed';

    var container = document.getElementById('task-list');

    if (filtered.length === 0) {
      container.innerHTML = '<div class="card"><div class="empty-state">' +
        '<div class="empty-state-icon">&#128218;</div>' +
        '<div class="empty-state-title">No tasks found</div>' +
        '<div class="empty-state-text">Click "Add Task" to create your first task</div></div></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var t = filtered[i];
      var due = t.dueDate ? new Date(t.dueDate) : null;
      var badgeHTML = '';
      if (!t.completed && due) {
        var diff = Math.ceil((due - now) / 86400000);
        if (diff < 0) badgeHTML = '<span class="badge badge-danger">Overdue</span>';
        else if (diff <= 2) badgeHTML = '<span class="badge badge-warning">Due soon</span>';
      }
      if (t.completed) badgeHTML = '<span class="badge badge-success">Completed</span>';

      html += '<div class="card' + (t.completed ? '' : ' card-clickable') + '" style="margin-bottom:var(--space-md);' + (t.completed ? 'opacity:0.6' : '') + '">' +
        '<div class="flex items-center gap-2">' +
          '<div class="flex-1">' +
            '<div class="flex items-center gap-1 flex-wrap">' +
              '<strong style="' + (t.completed ? 'text-decoration:line-through' : '') + '">' + escapeHtml(t.title) + '</strong> ' +
              badgeHTML + ' ' +
              getCategoryBadgeHTML(t.categoryId) +
            '</div>' +
            '<div class="flex items-center gap-2 mt-1 text-sm">' +
              createStarRating(t.difficulty || 1) +
              (t.estimatedMinutes ? '<span class="text-muted">' + t.estimatedMinutes + ' min</span>' : '') +
              (due ? '<span class="text-muted">' + formatDate(due) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="btn-group">' +
            (!t.completed ? '<button class="btn btn-sm btn-success" onclick="window._acCompleteTask(\'' + t.id + '\')">Done</button>' : '') +
            '<button class="btn btn-sm btn-ghost" onclick="window._acEditTask(\'' + t.id + '\')">Edit</button>' +
            '<button class="btn btn-sm btn-danger" onclick="window._acDeleteTask(\'' + t.id + '\')">Del</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  /* ======================================================================
     TASK MODAL — Add / Edit
     ====================================================================== */
  function openTaskModal(task) {
    var isEdit = !!task;
    var cats = getAllCategories();

    var catOptions = '';
    for (var i = 0; i < cats.length; i++) {
      var sel = (task && task.categoryId === cats[i].id) ? ' selected' : '';
      catOptions += '<option value="' + cats[i].id + '"' + sel + '>' + cats[i].icon + ' ' + cats[i].name + '</option>';
    }

    var diffOptions = '';
    for (var d = 1; d <= 5; d++) {
      var sel = (task && task.difficulty === d) ? ' selected' : ((!task && d === 3) ? ' selected' : '');
      diffOptions += '<option value="' + d + '"' + sel + '>' + d + ' Star' + (d > 1 ? 's' : '') + '</option>';
    }

    var html = '<form id="task-form">' +
      '<div class="form-group">' +
        '<label class="form-label">Title</label>' +
        '<input type="text" id="tf-title" value="' + (task ? escapeAttr(task.title) : '') + '" required>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Category</label>' +
        '<select id="tf-category">' + catOptions + '</select>' +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="form-group">' +
          '<label class="form-label">Difficulty</label>' +
          '<select id="tf-difficulty">' + diffOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Estimated Minutes</label>' +
          '<input type="number" id="tf-minutes" min="1" max="600" value="' + (task && task.estimatedMinutes ? task.estimatedMinutes : '') + '">' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Due Date</label>' +
        '<input type="date" id="tf-due" value="' + (task && task.dueDate ? task.dueDate.split('T')[0] : '') + '">' +
      '</div>' +
      '<div class="flex gap-1" style="justify-content:flex-end">' +
        '<button type="button" class="btn" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Add Task') + '</button>' +
      '</div>' +
    '</form>';

    openModal(isEdit ? 'Edit Task' : 'Add Task', html);

    document.getElementById('task-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var title = document.getElementById('tf-title').value.trim();
      if (!title) return;

      if (isEdit) {
        task.title = title;
        task.categoryId = document.getElementById('tf-category').value;
        task.difficulty = parseInt(document.getElementById('tf-difficulty').value) || 3;
        task.estimatedMinutes = parseInt(document.getElementById('tf-minutes').value) || null;
        task.dueDate = document.getElementById('tf-due').value || null;
      } else {
        tasks.push({
          id: generateId(),
          title: title,
          categoryId: document.getElementById('tf-category').value,
          difficulty: parseInt(document.getElementById('tf-difficulty').value) || 3,
          estimatedMinutes: parseInt(document.getElementById('tf-minutes').value) || null,
          dueDate: document.getElementById('tf-due').value || null,
          completed: false,
          actualMinutes: null,
          completedAt: null,
          createdAt: new Date().toISOString()
        });
      }

      await window.EthanOSData.saveData('tasks', tasks);
      closeModal();
      showToast(isEdit ? 'Task updated' : 'Task added', 'success');
      render();
    });
  }

  /* ======================================================================
     ACTIONS — complete, edit, delete
     ====================================================================== */
  window._acCompleteTask = async function (id) {
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === id) {
        tasks[i].completed = true;
        tasks[i].completedAt = new Date().toISOString();
        break;
      }
    }
    await window.EthanOSData.saveData('tasks', tasks);
    await awardXP(50, 'Task completed');
    render();
  };

  window._acEditTask = function (id) {
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === id) {
        openTaskModal(tasks[i]);
        return;
      }
    }
  };

  window._acDeleteTask = async function (id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    await window.EthanOSData.saveData('tasks', tasks);
    showToast('Task deleted', 'warning');
    render();
  };

  /* ======================================================================
     UTIL
     ====================================================================== */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

})();
