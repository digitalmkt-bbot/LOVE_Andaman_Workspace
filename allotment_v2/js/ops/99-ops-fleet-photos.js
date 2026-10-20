/* ════════════════════════════════════════════════════════════════════════
   §opsFleetPhotos (2026-10-20) · FE-4 · photos and video clips on fleet jobs, incidents and projects (05-fleet.js flp*)
   ────────────────────────────────────────────────────────────────────────
   GET    /v1/fleet/{jobs|incidents|projects}/{id}/photos            (also photos[] on every job and incident, mapped by O.fleetPhotoFrom)
   POST   …/photos            {attachment_ids | url, caption?, note?}  the server stamps the stage, the kind (photo / video) and the log line
   PATCH  …/photos/{pid}      {caption}
   POST   …/photos/{pid}/hide | /restore
   DELETE …/photos/{pid}      only a hidden photo; the server deletes the file when nothing else names it
   Kinds: mj → jobs, inc → incidents, prj → projects. Legacy's picker, the 6 MB clip check and the prompts stay; the files go up through
   _flProjUploadAll (POST /v1/attachments through laOpsAttachments), then ONE photos call names them all. The record is then read again
   (its photos and its log are the server's). Not called in ops: flpPush, flpLog, flpStageNow (the server owns stage and log).
   Replaced: flpAdd, flpAddUrl, flpCap, flpHide, flpRestore, flpPurge. Classic script · after 98-…, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var KIND = { mj: 'jobs', inc: 'incidents', prj: 'projects' };
  var NAMES = ['flpAdd', 'flpAddUrl', 'flpCap', 'flpHide', 'flpRestore', 'flpPurge'];
  var orig = {};
  NAMES.forEach(function(n){ orig[n] = window[n]; });

  function enc(x){ return encodeURIComponent(x); }
  function base(kind, id){ return '/v1/fleet/' + KIND[kind] + '/' + enc(id) + '/photos'; }
  function can(){ return typeof window.flpCan !== 'function' || window.flpCan(); }
  function reload(kind, id){
    var p = kind === 'mj' ? O.fleetJobs.reloadJob(id) : kind === 'inc' ? O.fleetJobs.reloadIncident(id) : O.fleetDaily.reloadProject(id);
    return p.then(function(){ O.wrote('fleet-photo'); if(typeof window.flpRefresh === 'function') window.flpRefresh(kind, id, true); });
  }
  /* one write, then the record again; a refusal shows the server's words and changes nothing */
  function write(kind, id, title, send){
    return O.queue(send).then(function(){ return reload(kind, id); }, function(e){ O.fail(title, e); return null; });
  }
  function wrap(name, fn){
    window[name] = function(){
      if(!O.enabled()) return orig[name] ? orig[name].apply(this, arguments) : undefined;
      return fn.apply(this, arguments);
    };
  }
  function removeFiles(ids){
    var A = window.laOpsAttachments;
    (ids || []).forEach(function(i){ try{ if(A && A.remove) A.remove(i).catch(function(){}); }catch(_){} });
  }

  wrap('flpAdd', function(kind, id, note){
    if(!can() || !KIND[kind] || !window.flpRec(kind, id)) return null;
    if(typeof window._flProjPickFiles !== 'function' || typeof window._flProjUploadAll !== 'function'){ alert('Photo upload is not available on this page.'); return null; }
    window._flProjPickFiles('image/*,video/*', true, function(files){
      var max = window.FLP_VID_MAX || 6 * 1024 * 1024;
      var big = files.filter(function(f){ return /^video\//i.test(f.type || '') && f.size > max; });
      if(big.length){
        alert('Video too large: ' + big.map(function(f){ return (f.name || 'clip') + ' (' + (f.size / 1048576).toFixed(1) + ' MB)'; }).join(', ') + '\nLimit 6 MB per clip. Trim it, or upload it to Drive and use "Paste link".');
        files = files.filter(function(f){ return big.indexOf(f) < 0; });
      }
      if(!files.length) return;
      var ids = [], t = String(note || '').trim();
      window._flProjUploadAll(files, kind + '_' + id, function(meta){ ids.push(meta.id); }, function(){
        if(!ids.length) return;
        var body = { attachment_ids: ids }; if(t) body.note = t;
        O.queue(function(){ return O.post(base(kind, id), body); }).then(function(){ return reload(kind, id); }, function(e){
          O.fail('Photo not added', e); removeFiles(ids);   // the files went up but nothing names them
        });
      });
    });
    return null;
  });
  wrap('flpAddUrl', function(kind, id){
    if(!can() || !KIND[kind] || !window.flpRec(kind, id)) return null;
    var url = prompt('Image or video URL (YouTube · Google Drive · .jpg/.mp4):', ''); if(!url) return null; url = String(url).trim(); if(!url) return null;
    var cap = prompt('Caption (optional):', '') || '';
    var body = { url: url }; if(cap) body.caption = cap;
    return write(kind, id, 'Link not added', function(){ return O.post(base(kind, id), body); });
  });
  function photoOf(kind, id, pid){
    var rec = window.flpRec(kind, id); return rec ? window.flpFind(kind, rec, pid) : null;
  }
  wrap('flpCap', function(kind, id, pid){
    if(!can() || !KIND[kind]) return null;
    var p = photoOf(kind, id, pid); if(!p) return null;
    var v = prompt('Caption:', p.cap || ''); if(v == null) return null; v = String(v).trim();
    return write(kind, id, 'Caption not saved', function(){ return O.patch(base(kind, id) + '/' + enc(pid), { caption: v }); });
  });
  wrap('flpHide', function(kind, id, pid){
    if(!can() || !KIND[kind] || !photoOf(kind, id, pid)) return null;
    return write(kind, id, 'Photo not hidden', function(){ return O.post(base(kind, id) + '/' + enc(pid) + '/hide', {}); });
  });
  wrap('flpRestore', function(kind, id, pid){
    if(!can() || !KIND[kind] || !photoOf(kind, id, pid)) return null;
    return write(kind, id, 'Photo not restored', function(){ return O.post(base(kind, id) + '/' + enc(pid) + '/restore', {}); });
  });
  wrap('flpPurge', function(kind, id, pid){
    if(!can() || !KIND[kind]) return null;
    var p = photoOf(kind, id, pid); if(!p || !p.removed) return null;
    if(!confirm('Delete this photo permanently? This cannot be undone.')) return null;
    return write(kind, id, 'Photo not deleted', function(){ return O.del(base(kind, id) + '/' + enc(pid)); });
  });
})();
