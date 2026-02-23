/**
 * EthanOS — Settings & Category Manager
 * User preferences, category CRUD, timer settings, data management.
 */
(function () {
  'use strict';

  var settings = {};
  var categories = [];

  var COLOR_OPTIONS = [
    { value: 'blue',   label: 'Blue',   hex: '#45aaf2' },
    { value: 'purple', label: 'Purple', hex: '#a78bfa' },
    { value: 'green',  label: 'Green',  hex: '#00d67e' },
    { value: 'orange', label: 'Orange', hex: '#ffa502' },
    { value: 'pink',   label: 'Pink',   hex: '#ff6b9d' }
  ];

  var COLOR_MAP = {
    blue: '#45aaf2',
    purple: '#a78bfa',
    green: '#00d67e',
    orange: '#ffa502',
    pink: '#ff6b9d'
  };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(init, 350);
  });

  async function init() {
    settings = await window.EthanOSData.loadData('settings', {
      userName: 'Ethan', theme: 'dark', focusDuration: 25, breakDuration: 5
    });
    categories = await window.EthanOSData.loadData('categories', getAllCategories());
    renderProfile();
    renderCategories();
    renderTimerSettings();
    bindDataButtons();
  }

  /* ========================================================================
     PROFILE
     ======================================================================== */
  function renderProfile() {
    var input = document.getElementById('input-username');
    input.value = settings.userName || '';
    input.addEventListener('change', async function () {
      settings.userName = this.value.trim() || 'Ethan';
      await window.EthanOSData.saveData('settings', settings);
      showToast('Name updated', 'success');
    });
  }

  /* ========================================================================
     CATEGORIES
     ======================================================================== */
  function renderCategories() {
    var container = document.getElementById('category-list');
    if (categories.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm">No categories. Add one to get started.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < categories.length; i++) {
      var c = categories[i];
      var hex = COLOR_MAP[c.color] || '#888';
      html += '<div class="category-row" data-id="' + c.id + '">' +
        '<div class="category-swatch" style="background:' + hex + '"></div>' +
        '<span style="font-size:1.2rem">' + (c.icon || '') + '</span>' +
        '<div class="category-info">' +
          '<div class="category-name">' + c.name + '</div>' +
          '<div class="category-meta">' + c.weeklyHoursTarget + ' hrs/week target</div>' +
        '</div>' +
        '<div class="btn-group">' +
          '<button class="btn btn-sm btn-ghost btn-edit-cat" data-id="' + c.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-ghost text-danger btn-del-cat" data-id="' + c.id + '">Delete</button>' +
        '</div>' +
      '</div>';
    }
    container.innerHTML = html;

    // Bind edit buttons
    var editBtns = container.querySelectorAll('.btn-edit-cat');
    for (var j = 0; j < editBtns.length; j++) {
      editBtns[j].addEventListener('click', function () {
        openCategoryModal(this.getAttribute('data-id'));
      });
    }

    // Bind delete buttons
    var delBtns = container.querySelectorAll('.btn-del-cat');
    for (var k = 0; k < delBtns.length; k++) {
      delBtns[k].addEventListener('click', function () {
        confirmDeleteCategory(this.getAttribute('data-id'));
      });
    }

    // Bind add button
    document.getElementById('btn-add-category').onclick = function () {
      openCategoryModal(null);
    };
  }

  function openCategoryModal(catId) {
    var cat = null;
    if (catId) {
      for (var i = 0; i < categories.length; i++) {
        if (categories[i].id === catId) { cat = categories[i]; break; }
      }
    }

    var title = cat ? 'Edit Category' : 'Add Category';
    var colorOptions = '';
    for (var c = 0; c < COLOR_OPTIONS.length; c++) {
      var co = COLOR_OPTIONS[c];
      var sel = (cat && cat.color === co.value) ? ' selected' : '';
      colorOptions += '<option value="' + co.value + '"' + sel + '>' + co.label + '</option>';
    }

    var formHTML =
      '<div class="form-group">' +
        '<label class="form-label">Emoji Icon</label>' +
        '<input type="text" id="cat-icon" value="' + (cat ? cat.icon : '') + '" placeholder="e.g. &#128218;" />' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Name</label>' +
        '<input type="text" id="cat-name" value="' + (cat ? cat.name : '') + '" placeholder="Category name" />' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Color</label>' +
        '<select id="cat-color">' + colorOptions + '</select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Weekly Hours Target</label>' +
        '<input type="number" id="cat-hours" min="0" max="168" value="' + (cat ? cat.weeklyHoursTarget : 5) + '" />' +
      '</div>' +
      '<div class="flex gap-2">' +
        '<button class="btn btn-primary" id="btn-save-cat">Save</button>' +
        '<button class="btn" onclick="closeModal()">Cancel</button>' +
      '</div>';

    openModal(title, formHTML);

    setTimeout(function () {
      var saveBtn = document.getElementById('btn-save-cat');
      if (saveBtn) {
        saveBtn.addEventListener('click', async function () {
          var name = document.getElementById('cat-name').value.trim();
          var icon = document.getElementById('cat-icon').value.trim();
          var color = document.getElementById('cat-color').value;
          var hours = parseInt(document.getElementById('cat-hours').value, 10) || 0;

          if (!name) { showToast('Name is required', 'warning'); return; }

          if (cat) {
            cat.name = name;
            cat.icon = icon;
            cat.color = color;
            cat.weeklyHoursTarget = hours;
          } else {
            categories.push({
              id: 'cat_' + generateId(),
              name: name,
              icon: icon,
              color: color,
              weeklyHoursTarget: hours
            });
          }

          await window.EthanOSData.saveData('categories', categories);
          closeModal();
          renderCategories();
          showToast('Category ' + (catId ? 'updated' : 'added'), 'success');
        });
      }
    }, 100);
  }

  function confirmDeleteCategory(catId) {
    var cat = null;
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === catId) { cat = categories[i]; break; }
    }
    if (!cat) return;

    openModal('Delete Category',
      '<p>Delete <strong>' + cat.icon + ' ' + cat.name + '</strong>? This won\'t delete associated tasks or data.</p>' +
      '<div class="flex gap-2 mt-3">' +
        '<button class="btn btn-danger" id="confirm-del-cat">Delete</button>' +
        '<button class="btn" onclick="closeModal()">Cancel</button>' +
      '</div>'
    );

    setTimeout(function () {
      var btn = document.getElementById('confirm-del-cat');
      if (btn) btn.addEventListener('click', async function () {
        categories = categories.filter(function (c) { return c.id !== catId; });
        await window.EthanOSData.saveData('categories', categories);
        closeModal();
        renderCategories();
        showToast('Category deleted', 'success');
      });
    }, 100);
  }

  /* ========================================================================
     TIMER SETTINGS
     ======================================================================== */
  function renderTimerSettings() {
    var focusRange = document.getElementById('range-focus');
    var focusVal = document.getElementById('focus-value');
    var breakRange = document.getElementById('range-break');
    var breakVal = document.getElementById('break-value');

    focusRange.value = settings.focusDuration || 25;
    focusVal.textContent = (settings.focusDuration || 25) + ' min';

    breakRange.value = settings.breakDuration || 5;
    breakVal.textContent = (settings.breakDuration || 5) + ' min';

    focusRange.addEventListener('input', function () {
      focusVal.textContent = this.value + ' min';
    });
    focusRange.addEventListener('change', async function () {
      settings.focusDuration = parseInt(this.value, 10);
      await window.EthanOSData.saveData('settings', settings);
      showToast('Focus duration updated', 'success');
    });

    breakRange.addEventListener('input', function () {
      breakVal.textContent = this.value + ' min';
    });
    breakRange.addEventListener('change', async function () {
      settings.breakDuration = parseInt(this.value, 10);
      await window.EthanOSData.saveData('settings', settings);
      showToast('Break duration updated', 'success');
    });
  }

  /* ========================================================================
     DATA MANAGEMENT
     ======================================================================== */
  function bindDataButtons() {
    // Sync
    document.getElementById('btn-sync').addEventListener('click', async function () {
      this.disabled = true;
      this.textContent = 'Syncing...';
      setSyncStatus('syncing');
      try {
        var count = await window.EthanOSData.syncAll();
        showToast('Synced ' + count + ' files from cloud', 'success');
        setSyncStatus('synced');
      } catch (e) {
        showToast('Sync failed: ' + e.message, 'error');
        setSyncStatus('error');
      }
      this.disabled = false;
      this.textContent = 'Sync Now';
    });

    // Export
    document.getElementById('btn-export').addEventListener('click', function () {
      var blob = window.EthanOSData.exportAll();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'ethanos-backup-' + new Date().toISOString().split('T')[0] + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded', 'success');
    });

    // Import
    document.getElementById('btn-import').addEventListener('click', function () {
      document.getElementById('file-import').click();
    });

    document.getElementById('file-import').addEventListener('change', async function () {
      var file = this.files[0];
      if (!file) return;
      try {
        var count = await window.EthanOSData.importAll(file);
        showToast('Imported ' + count + ' data keys', 'success');
        // Reload to reflect changes
        setTimeout(function () { window.location.reload(); }, 1000);
      } catch (e) {
        showToast('Import failed: ' + e.message, 'error');
      }
      this.value = '';
    });

    // Reset
    document.getElementById('btn-reset').addEventListener('click', function () {
      openModal('Reset All Data',
        '<p class="text-danger font-bold">This will permanently delete ALL your EthanOS data.</p>' +
        '<p class="text-secondary text-sm mt-1">Categories, tasks, goals, notes, XP, settings — everything will be reset to defaults.</p>' +
        '<div class="flex gap-2 mt-3">' +
          '<button class="btn btn-danger" id="confirm-reset">Yes, Reset Everything</button>' +
          '<button class="btn" onclick="closeModal()">Cancel</button>' +
        '</div>'
      );

      setTimeout(function () {
        var btn = document.getElementById('confirm-reset');
        if (btn) btn.addEventListener('click', async function () {
          // Clear all ethanos localStorage keys
          var keysToRemove = [];
          for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf('ethanos_') === 0) keysToRemove.push(key);
          }
          for (var j = 0; j < keysToRemove.length; j++) {
            localStorage.removeItem(keysToRemove[j]);
          }
          closeModal();
          showToast('All data reset. Reloading...', 'success');
          setTimeout(function () { window.location.reload(); }, 1200);
        });
      }, 100);
    });
  }

})();
