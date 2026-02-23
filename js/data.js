/**
 * EthanOS Data Persistence Layer
 *
 * Uses PutPut.io as cloud storage backend with localStorage as a fast local cache.
 * All files stored on PutPut.io are prefixed with "ethanos_" to namespace them.
 * If PutPut.io is unreachable, falls back gracefully to localStorage-only mode.
 *
 * Usage:
 *   await window.EthanOSData.init();
 *   await window.EthanOSData.saveData('settings', { theme: 'dark' });
 *   const settings = await window.EthanOSData.loadData('settings', {});
 */

class EthanOSData {
  constructor() {
    this.baseUrl = 'https://api.putput.io/v1';
    this.TOKEN_KEY = 'ethanos_putput_token';
    this.CACHE_PREFIX = 'ethanos_cache_';
    this.FILE_PREFIX = 'ethanos_';
    this.token = localStorage.getItem('ethanos_putput_token');
    this.initialized = false;
    this.offlineMode = false;
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  async init() {
    try {
      if (this.token) {
        console.log('[EthanOSData] Reusing existing token.');
        const valid = await this._validateToken();
        if (!valid) {
          console.log('[EthanOSData] Token invalid, requesting new one.');
          await this._requestNewToken();
        }
      } else {
        await this._requestNewToken();
      }
      this.initialized = true;
      this.offlineMode = false;
      console.log('[EthanOSData] Initialized (online).');
    } catch (err) {
      console.warn('[EthanOSData] Cloud init failed, falling back to localStorage-only mode:', err.message);
      this.initialized = true;
      this.offlineMode = true;
    }
  }

  async _requestNewToken() {
    const res = await fetch(this.baseUrl + '/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      throw new Error('Failed to get guest token: ' + res.status);
    }
    const body = await res.json();
    this.token = body.token || (body.data && body.data.token) || null;
    if (!this.token) {
      throw new Error('Guest token not found in response.');
    }
    localStorage.setItem(this.TOKEN_KEY, this.token);
    console.log('[EthanOSData] New guest token acquired.');
  }

  async _validateToken() {
    try {
      const res = await fetch(this.baseUrl + '/files?limit=1', {
        headers: { Authorization: 'Bearer ' + this.token }
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  _filename(key) {
    return this.FILE_PREFIX + key + '.json';
  }

  _cacheKey(key) {
    return this.CACHE_PREFIX + key;
  }

  /* ==========================================================================
     Internal helpers
     ========================================================================== */

  async _listAllFiles() {
    var files = [];
    var cursor = null;
    var limit = 100;
    do {
      var url = this.baseUrl + '/files?limit=' + limit;
      if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
      var res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + this.token }
      });
      if (!res.ok) throw new Error('List files failed: ' + res.status);
      var body = await res.json();
      var pageFiles = body.files || (body.data && body.data.files) || body.data || [];
      if (Array.isArray(pageFiles)) files.push.apply(files, pageFiles);
      cursor = body.cursor || body.next_cursor || (body.data && body.data.cursor) || null;
      if (!cursor || (Array.isArray(pageFiles) && pageFiles.length < limit)) cursor = null;
    } while (cursor);
    return files;
  }

  async _findFile(key) {
    var filename = this._filename(key);
    var files = await this._listAllFiles();
    for (var i = 0; i < files.length; i++) {
      if (files[i].original_name === filename || files[i].name === filename) {
        return files[i];
      }
    }
    return null;
  }

  async _uploadFile(filename, jsonString) {
    var fd = new FormData();
    var blob = new Blob([jsonString], { type: 'application/json' });
    fd.append('file', blob, filename);
    var res = await fetch(this.baseUrl + '/files', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.token },
      body: fd
    });
    if (!res.ok) throw new Error('Upload failed: ' + res.status);
    console.log('[EthanOSData] Uploaded ' + filename);
  }

  async _deleteFileById(fileId) {
    var res = await fetch(this.baseUrl + '/files/' + fileId, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + this.token }
    });
    if (!res.ok) throw new Error('Delete failed: ' + res.status);
    console.log('[EthanOSData] Deleted file id=' + fileId);
  }

  /* ==========================================================================
     Public API
     ========================================================================== */

  async saveData(key, data) {
    var jsonString = JSON.stringify(data);
    localStorage.setItem(this._cacheKey(key), jsonString);

    if (this.offlineMode) {
      console.log('[EthanOSData] saveData("' + key + '") saved to localStorage (offline).');
      return;
    }

    try {
      var existing = await this._findFile(key);
      if (existing) {
        await this._deleteFileById(existing.id);
      }
      await this._uploadFile(this._filename(key), jsonString);
      console.log('[EthanOSData] saveData("' + key + '") synced to cloud.');
    } catch (err) {
      console.warn('[EthanOSData] saveData("' + key + '") cloud sync failed:', err.message);
    }
  }

  async loadData(key, defaultValue) {
    if (defaultValue === undefined) defaultValue = null;

    // Always check localStorage first
    var cached = localStorage.getItem(this._cacheKey(key));
    if (cached !== null) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Corrupted cache, remove it
        localStorage.removeItem(this._cacheKey(key));
      }
    }

    if (this.offlineMode) return defaultValue;

    try {
      var file = await this._findFile(key);
      if (!file) return defaultValue;

      var publicUrl = file.public_url || file.url;
      if (!publicUrl) return defaultValue;

      var res = await fetch(publicUrl);
      if (!res.ok) return defaultValue;

      var text = await res.text();
      var parsed = JSON.parse(text);
      localStorage.setItem(this._cacheKey(key), JSON.stringify(parsed));
      return parsed;
    } catch (err) {
      console.warn('[EthanOSData] loadData("' + key + '") cloud fetch failed:', err.message);
      return defaultValue;
    }
  }

  async deleteData(key) {
    localStorage.removeItem(this._cacheKey(key));

    if (this.offlineMode) return;

    try {
      var file = await this._findFile(key);
      if (file) await this._deleteFileById(file.id);
    } catch (err) {
      console.warn('[EthanOSData] deleteData("' + key + '") cloud delete failed:', err.message);
    }
  }

  async syncAll() {
    if (this.offlineMode) {
      console.log('[EthanOSData] syncAll() skipped (offline mode).');
      return 0;
    }

    try {
      var files = await this._listAllFiles();
      var prefix = this.FILE_PREFIX;
      var ethanosFiles = files.filter(function(f) {
        var name = f.original_name || f.name || '';
        return name.indexOf(prefix) === 0 && name.indexOf('.json') === name.length - 5;
      });

      var synced = 0;
      for (var i = 0; i < ethanosFiles.length; i++) {
        var f = ethanosFiles[i];
        var name = f.original_name || f.name;
        var key = name.slice(prefix.length, name.length - 5);
        var publicUrl = f.public_url || f.url;
        if (!publicUrl) continue;
        try {
          var res = await fetch(publicUrl);
          if (!res.ok) continue;
          var text = await res.text();
          JSON.parse(text); // validate
          localStorage.setItem(this._cacheKey(key), text);
          synced++;
        } catch (e) {
          console.warn('[EthanOSData] syncAll() failed for "' + key + '":', e.message);
        }
      }
      console.log('[EthanOSData] syncAll() synced ' + synced + '/' + ethanosFiles.length + ' files.');
      return synced;
    } catch (err) {
      console.warn('[EthanOSData] syncAll() failed:', err.message);
      return 0;
    }
  }

  exportAll() {
    var result = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf(this.CACHE_PREFIX) === 0) {
        var dataKey = k.slice(this.CACHE_PREFIX.length);
        try {
          result[dataKey] = JSON.parse(localStorage.getItem(k));
        } catch (e) {
          result[dataKey] = localStorage.getItem(k);
        }
      }
    }
    var json = JSON.stringify(result, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  async importAll(blob) {
    var text;
    if (blob instanceof Blob) {
      text = await blob.text();
    } else if (typeof blob === 'string') {
      text = blob;
    } else {
      text = JSON.stringify(blob);
    }

    var data = JSON.parse(text);
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      localStorage.setItem(this._cacheKey(keys[i]), JSON.stringify(data[keys[i]]));
    }
    console.log('[EthanOSData] importAll() imported ' + keys.length + ' keys to localStorage.');

    // Sync imported data to cloud
    await this.syncAll();
    return keys.length;
  }
}

// Register global singleton
window.EthanOSData = new EthanOSData();
