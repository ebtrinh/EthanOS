/**
 * EthanOS — Knowledge Vault
 * Note management with search, filters, categories, and tags.
 */
(function () {
  'use strict';

  var notes = [];
  var categories = [];
  var selectedNoteId = null;
  var activeTagFilter = null;
  var allTags = [];

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(init, 350);
  });

  async function init() {
    notes = await window.EthanOSData.loadData('notes', []);
    categories = getAllCategories();
    populateCategoryFilter();
    bindEvents();
    refreshTagCloud();
    renderList();
    renderEditor();
  }

  /* ========================================================================
     EVENT BINDING
     ======================================================================== */
  function bindEvents() {
    document.getElementById('btn-new-note').addEventListener('click', createNewNote);
    document.getElementById('search-input').addEventListener('input', debounce(renderList, 200));
    document.getElementById('filter-category').addEventListener('change', renderList);
    document.getElementById('sort-select').addEventListener('change', renderList);
  }

  function populateCategoryFilter() {
    var sel = document.getElementById('filter-category');
    var html = '<option value="">All categories</option>';
    for (var i = 0; i < categories.length; i++) {
      html += '<option value="' + categories[i].id + '">' + categories[i].icon + ' ' + categories[i].name + '</option>';
    }
    sel.innerHTML = html;
  }

  /* ========================================================================
     TAG CLOUD
     ======================================================================== */
  function refreshTagCloud() {
    var tagSet = {};
    for (var i = 0; i < notes.length; i++) {
      var t = notes[i].tags || [];
      for (var j = 0; j < t.length; j++) {
        if (t[j]) tagSet[t[j].trim().toLowerCase()] = true;
      }
    }
    allTags = Object.keys(tagSet).sort();
    renderTagFilter();
  }

  function renderTagFilter() {
    var container = document.getElementById('tag-filter-row');
    if (allTags.length === 0) { container.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < allTags.length; i++) {
      var active = activeTagFilter === allTags[i] ? ' active' : '';
      html += '<span class="tag-pill' + active + '" data-tag="' + allTags[i] + '">' + allTags[i] + '</span>';
    }
    container.innerHTML = html;

    var pills = container.querySelectorAll('.tag-pill');
    for (var k = 0; k < pills.length; k++) {
      pills[k].addEventListener('click', function () {
        var tag = this.getAttribute('data-tag');
        activeTagFilter = activeTagFilter === tag ? null : tag;
        renderTagFilter();
        renderList();
      });
    }
  }

  /* ========================================================================
     FILTER & SORT
     ======================================================================== */
  function getFilteredNotes() {
    var searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    var catFilter = document.getElementById('filter-category').value;
    var sortVal = document.getElementById('sort-select').value;

    var filtered = notes.slice();

    if (searchVal) {
      filtered = filtered.filter(function (n) {
        return (n.title || '').toLowerCase().indexOf(searchVal) !== -1 ||
               (n.content || '').toLowerCase().indexOf(searchVal) !== -1 ||
               (n.tags || []).join(' ').toLowerCase().indexOf(searchVal) !== -1;
      });
    }

    if (catFilter) {
      filtered = filtered.filter(function (n) { return n.categoryId === catFilter; });
    }

    if (activeTagFilter) {
      filtered = filtered.filter(function (n) {
        var tags = (n.tags || []).map(function (t) { return t.trim().toLowerCase(); });
        return tags.indexOf(activeTagFilter) !== -1;
      });
    }

    if (sortVal === 'oldest') {
      filtered.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    } else if (sortVal === 'category') {
      filtered.sort(function (a, b) { return (a.categoryId || '').localeCompare(b.categoryId || ''); });
    } else {
      filtered.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    }

    return filtered;
  }

  /* ========================================================================
     RENDER LIST
     ======================================================================== */
  function renderList() {
    var filtered = getFilteredNotes();
    document.getElementById('note-count').textContent = notes.length + ' note' + (notes.length !== 1 ? 's' : '');

    var container = document.getElementById('note-list');
    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="empty-state" style="padding:var(--space-xl)">' +
          '<div class="empty-state-icon">&#128221;</div>' +
          '<div class="empty-state-title">No notes found</div>' +
          '<div class="empty-state-text">Create your first note or adjust your filters.</div>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var n = filtered[i];
      var sel = n.id === selectedNoteId ? ' selected' : '';
      var tagsHtml = '';
      if (n.tags && n.tags.length > 0) {
        tagsHtml = '<div class="note-tags">';
        for (var j = 0; j < n.tags.length; j++) {
          if (n.tags[j]) tagsHtml += '<span class="tag-pill">' + n.tags[j] + '</span>';
        }
        tagsHtml += '</div>';
      }
      html += '<div class="note-item' + sel + '" data-id="' + n.id + '">' +
        '<div class="note-item-title">' + (n.title || 'Untitled') + '</div>' +
        '<div class="note-item-meta">' +
          getCategoryBadgeHTML(n.categoryId) +
          '<span>' + timeAgo(n.updatedAt || n.createdAt) + '</span>' +
        '</div>' +
        tagsHtml +
      '</div>';
    }
    container.innerHTML = html;

    var items = container.querySelectorAll('.note-item');
    for (var k = 0; k < items.length; k++) {
      items[k].addEventListener('click', function () {
        selectedNoteId = this.getAttribute('data-id');
        renderList();
        renderEditor();
      });
    }
  }

  /* ========================================================================
     RENDER EDITOR
     ======================================================================== */
  function renderEditor() {
    var panel = document.getElementById('editor-content');

    if (!selectedNoteId) {
      panel.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">&#128196;</div>' +
          '<div class="empty-state-title">Select a note</div>' +
          '<div class="empty-state-text">Choose a note from the list or create a new one.</div>' +
        '</div>';
      return;
    }

    var note = null;
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].id === selectedNoteId) { note = notes[i]; break; }
    }
    if (!note) { panel.innerHTML = '<p class="text-muted">Note not found.</p>'; return; }

    var catOptions = '<option value="">No category</option>';
    for (var j = 0; j < categories.length; j++) {
      var sel = note.categoryId === categories[j].id ? ' selected' : '';
      catOptions += '<option value="' + categories[j].id + '"' + sel + '>' + categories[j].icon + ' ' + categories[j].name + '</option>';
    }

    panel.innerHTML =
      '<div class="form-group">' +
        '<label class="form-label">Title</label>' +
        '<input type="text" id="edit-title" value="' + escapeAttr(note.title || '') + '" />' +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="form-group">' +
          '<label class="form-label">Category</label>' +
          '<select id="edit-category">' + catOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Tags (comma-separated)</label>' +
          '<input type="text" id="edit-tags" class="editor-tags-input" value="' + escapeAttr((note.tags || []).join(', ')) + '" />' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Content</label>' +
        '<textarea id="edit-content" class="editor-area">' + escapeHTML(note.content || '') + '</textarea>' +
      '</div>' +
      '<div class="flex gap-2">' +
        '<button class="btn btn-primary" id="btn-save-note">Save</button>' +
        '<button class="btn btn-danger" id="btn-delete-note">Delete</button>' +
      '</div>' +
      '<div class="text-xs text-muted mt-2">Created ' + formatDate(note.createdAt) + (note.updatedAt ? ' &middot; Updated ' + timeAgo(note.updatedAt) : '') + '</div>';

    document.getElementById('btn-save-note').addEventListener('click', saveCurrentNote);
    document.getElementById('btn-delete-note').addEventListener('click', deleteCurrentNote);
  }

  /* ========================================================================
     CRUD
     ======================================================================== */
  async function createNewNote() {
    var note = {
      id: generateId(),
      title: 'New Note',
      content: '',
      categoryId: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    notes.unshift(note);
    selectedNoteId = note.id;
    await saveNotes();
    refreshTagCloud();
    renderList();
    renderEditor();
    showToast('Note created', 'success');
  }

  async function saveCurrentNote() {
    if (!selectedNoteId) return;
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].id === selectedNoteId) {
        notes[i].title = document.getElementById('edit-title').value.trim() || 'Untitled';
        notes[i].categoryId = document.getElementById('edit-category').value;
        notes[i].content = document.getElementById('edit-content').value;
        notes[i].tags = document.getElementById('edit-tags').value
          .split(',')
          .map(function (t) { return t.trim(); })
          .filter(function (t) { return t.length > 0; });
        notes[i].updatedAt = new Date().toISOString();
        break;
      }
    }
    await saveNotes();
    refreshTagCloud();
    renderList();
    renderEditor();
    showToast('Note saved', 'success');
  }

  async function deleteCurrentNote() {
    if (!selectedNoteId) return;
    openModal('Delete Note',
      '<p>Are you sure you want to delete this note? This cannot be undone.</p>' +
      '<div class="flex gap-2 mt-3">' +
        '<button class="btn btn-danger" id="confirm-delete-note">Delete</button>' +
        '<button class="btn" onclick="closeModal()">Cancel</button>' +
      '</div>'
    );
    setTimeout(function () {
      var btn = document.getElementById('confirm-delete-note');
      if (btn) btn.addEventListener('click', async function () {
        notes = notes.filter(function (n) { return n.id !== selectedNoteId; });
        selectedNoteId = null;
        await saveNotes();
        closeModal();
        refreshTagCloud();
        renderList();
        renderEditor();
        showToast('Note deleted', 'success');
      });
    }, 100);
  }

  async function saveNotes() {
    await window.EthanOSData.saveData('notes', notes);
  }

  /* ========================================================================
     UTILS
     ======================================================================== */
  function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();
