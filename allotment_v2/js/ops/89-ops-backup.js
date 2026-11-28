/* ══════════════════════════════════════════════════════════════════════════
   §opsBackup (2026-11-28) · topbar 💾 Backup and 📥 Import → operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy's flBackupData downloaded this browser's localStorage copy and flImportData wrote a file back into it. Here the data
   lives in operation-backend's database, so both buttons ask the server (operation-backend src/routes/backup.ts):

     💾 Backup  GET /v1/backup            the whole database as backup_YYYY-MM-DD_HHmm.json (any staff login)
     📥 Import  POST /v1/backup/restore   the file goes back; only the rows that differ change (admin only)
                ?dry_run=1 first, so the confirm shows what the file would change. Nothing is written until OK.

   Same buttons, same alerts as legacy. What differs: Backup no longer counts memos/inventory in its alert (that meant parsing
   the whole file in the browser) and says the size instead; Import's confirm lists the rows the file changes, not the rows
   it holds; an old browser-copy backup is refused by the server (not_a_backup) and its message is shown.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.enabled()) return;

  function refusal(r){
    return r.text().then(function(t){
      var j = null; try{ j = t ? JSON.parse(t) : null; }catch(_){}
      var e = new Error((j && (j.message || j.error)) || ('HTTP ' + r.status));
      e.status = r.status; e.code = (j && j.code) || ''; e.body = j;
      throw e;
    });
  }
  function fileNameOf(r){
    var m = /filename="?([^";]+)"?/.exec(r.headers.get('Content-Disposition') || '');
    return m ? m[1] : 'backup.json';
  }
  function mb(n){ return (n / 1048576).toFixed(1) + ' MB'; }

  var backingUp = false;
  window.flBackupData = function(){
    if(backingUp) return;
    backingUp = true;
    O.toast({ kind: 'neutral', title: 'Backup', status: 'INFO', sub: 'กำลังดาวน์โหลดข้อมูลทั้งหมดจากเซิร์ฟเวอร์…', dur: 4000 });
    window.laOpsFetch('/v1/backup').then(function(r){
      if(!r.ok) return refusal(r);
      var name = fileNameOf(r);
      return r.blob().then(function(blob){
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(a.href); }, 60000);
        alert('Backup OK: ' + name + '\n\nSize: ' + mb(blob.size) + '\n\nNow move this file from Downloads into the data_exports folder.');
      });
    }).catch(function(e){
      alert('Backup failed: ' + ((e && e.message) || e));
    }).then(function(){ backingUp = false; });
  };

  function restore(file, dryRun){
    return window.laOpsFetch('/v1/backup/restore' + (dryRun ? '?dry_run=1' : ''), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: file,
    }).then(function(r){ return r.ok ? r.json() : refusal(r); });
  }
  /* The tables the file changes, most changed first: "bookings +2 ~5 −1". */
  function changeLines(rep){
    var rows = Object.keys(rep.tables || {}).map(function(k){
      var c = rep.tables[k]; return { k: k, c: c, n: c.inserted + c.updated + c.deleted };
    }).filter(function(x){ return x.n > 0; }).sort(function(a, b){ return b.n - a.n || a.k.localeCompare(b.k); });
    var lines = rows.slice(0, 12).map(function(x){
      return '  ' + x.k + '   +' + x.c.inserted + '  ~' + x.c.updated + '  −' + x.c.deleted;
    });
    if(rows.length > 12) lines.push('  … อีก ' + (rows.length - 12) + ' ตาราง');
    return { lines: lines, tables: rows.length };
  }

  var importing = false;
  window.flImportData = function(){
    if(typeof laIsAdmin === 'function' && !laIsAdmin()){ alert('นำเข้าข้อมูลได้เฉพาะ admin'); return; }   // §guard (the server checks too)
    if(importing) return;
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = function(){
      var f = inp.files && inp.files[0]; if(!f) return;
      importing = true;
      O.toast({ kind: 'neutral', title: 'Import', status: 'INFO', sub: 'กำลังตรวจไฟล์ ' + f.name + '…', dur: 4000 });
      restore(f, true).then(function(rep){
        var t = rep.totals || { inserted: 0, updated: 0, deleted: 0 };
        var ch = changeLines(rep);
        if(!ch.tables){ alert('Import: ไฟล์ "' + f.name + '" ตรงกับข้อมูลบนเซิร์ฟเวอร์อยู่แล้ว · ไม่มีอะไรต้องเปลี่ยน'); return; }
        if(!confirm('นำเข้าข้อมูลจาก "' + f.name + '"?\n\nเพิ่ม ' + t.inserted + '   แก้ ' + t.updated + '   ลบ ' + t.deleted + ' แถว ใน ' + ch.tables + ' ตาราง\n\n'
          + ch.lines.join('\n') + '\n\n⚠ จะเขียนทับข้อมูลบนเซิร์ฟเวอร์ ให้ตรงกับไฟล์นี้ (ทุกคนเห็นผล)')) return;
        return restore(f, false).then(function(){
          alert('Import OK ✓\n\nกำลังรีโหลดหน้าเพื่อแสดงข้อมูล');
          location.reload();
        });
      }).catch(function(e){
        alert('Import failed: ' + ((e && e.message) || e) + '\n\n(ไฟล์ต้องเป็น backup_xxx.json ที่ได้จากปุ่ม Backup)');
      }).then(function(){ importing = false; });
    };
    inp.click();
  };
})();
