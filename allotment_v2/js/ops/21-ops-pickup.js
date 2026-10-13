/* ══════════════════════════════════════════════════════════════════════════
   §opsPickup · Pickup Setup ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Areas and schedule profiles are server-owned in operations mode. The legacy
   functions remain the complete implementation for a real lk-inbox session;
   these wrappers only replace their persistence when laOps.enabled() is true.

   GET    /v1/pickup-areas?active=true
   POST|PATCH|DELETE /v1/pickup-areas
   GET    /v1/pickup-time-profiles[/{id}]
   POST|PATCH|DELETE /v1/pickup-time-profiles
   PUT|DELETE /v1/pickup-time-profiles/{id}/times/{route_id}/{target}
   GET    /v1/pickup-time?route_id=&area_id=&date=

   The API stores pickup windows as fields. The existing Pickup Setup screen
   still displays its deliberately free-form legacy text, so only the three
   documented forms are sent: HH:MM, HH:MM-HH:MM, and Before HH:MM at pier.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var ready = false, loading = null;

  function enabled(){ return O.enabled(); }
  function areas(){ return (typeof SB_PICKUP_AREAS !== 'undefined' && Array.isArray(SB_PICKUP_AREAS)) ? SB_PICKUP_AREAS : null; }
  function profiles(){ return (typeof SB_PICKUP_TIME_PROFILES !== 'undefined' && Array.isArray(SB_PICKUP_TIME_PROFILES)) ? SB_PICKUP_TIME_PROFILES : null; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  function mapArea(s){
    return { id:s.id, name:s.name || '', zone:s.zone || '', region:s.region || '', timeGroup:s.time_group || '', active:s.active !== false };
  }
  function cellText(c){
    if(c && c.pickup_at_pier && c.pickup_time_end) return 'Before ' + c.pickup_time_end + ' at pier';
    if(c && c.pickup_time && c.pickup_time_end) return c.pickup_time + '-' + c.pickup_time_end;
    return (c && c.pickup_time) || '';
  }
  function mapProfile(s){
    var p = { id:s.id, name:s.name || '', from:s.from_date || '', to:s.to_date || '', notes:s.notes || '',
      clonedFrom:s.cloned_from || null, createdAt:s.created_at || '', times:{} };
    (s.times || []).forEach(function(c){
      if(!c || !c.route_id || !c.target) return;
      (p.times[c.route_id] = p.times[c.route_id] || {})[c.target] = cellText(c);
    });
    return p;
  }
  function replaceArray(target, next){
    if(!target) return;
    target.length = 0; Array.prototype.push.apply(target, next);
  }
  function applyState(areaRows, detailRows){
    replaceArray(areas(), areaRows.map(mapArea).filter(function(a){ return a.active !== false; }));
    replaceArray(profiles(), detailRows.map(mapProfile));
    // The server's fallback profile is authoritative. The old flat seed must not
    // remain available as a second source of truth in operations mode.
    if(typeof SB_PICKUP_TIMES !== 'undefined') SB_PICKUP_TIMES = {};
  }
  function load(){
    if(!enabled()) return Promise.resolve(null);
    if(loading) return loading;
    loading = Promise.all([
      O.get('/v1/pickup-areas', { active:'true' }),
      O.get('/v1/pickup-time-profiles')
    ]).then(function(base){
      var rows = (base[0] && base[0].areas) || [];
      var list = (base[1] && base[1].profiles) || [];
      return Promise.all(list.map(function(p){ return O.get('/v1/pickup-time-profiles/' + encodeURIComponent(p.id)); }))
        .then(function(details){
          applyState(rows, details);
          ready = true;
          try{ console.log('[ops] pickup · ' + rows.length + ' areas · ' + details.length + ' profiles'); }catch(_){ }
          return { areas:rows, profiles:details };
        });
    }).finally(function(){ loading = null; });
    return loading;
  }
  function redraw(){ try{ if(typeof window.renderPickupSetup === 'function') window.renderPickupSetup(); }catch(_){ } }
  function refresh(){ return load().then(function(result){ redraw(); return result; }); }
  function show(message){
    var host = document.getElementById('psu-host');
    if(host) host.innerHTML = '<div style="padding:32px;text-align:center;color:#5a5a52">' + esc(message) + '</div>';
  }
  function showLoading(message){
    var host = document.getElementById('psu-host');
    if(host) host.innerHTML = O.loadingHtml(message);
  }
  function showError(){ show('Pickup Setup could not load from operation-backend. Reload and try again.'); }

  function wrap(name, replacement){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsPickup) return;
    var w = function(){ return replacement.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsPickup = true; window[name] = w;
  }

  function saveArea(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var d = (typeof _psuAreaDraft !== 'undefined') ? _psuAreaDraft : null;
    if(!d) return;
    var name = String(d.name || '').trim();
    if(!name){ alert('Name is required'); return; }
    if(!String(d.timeGroup || '').trim()){ alert('Time group is required'); return; }
    var body = { name:name, zone:d.zone, time_group:String(d.timeGroup).trim() };
    if(String(d.region || '').trim()) body.region = String(d.region).trim();
    else body.region = null;
    return O.queue(function(){
      return d.isNew ? O.post('/v1/pickup-areas', body) : O.patch('/v1/pickup-areas/' + encodeURIComponent(d.id), body);
    }).then(function(){
      return refresh().then(function(){
        _psuAreaDraft = null;
        redraw();
      });
    }).catch(function(e){ O.fail('Pickup area not saved', e); });
  }

  function deleteArea(orig, aid){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var a = areas() && areas().find(function(x){ return x && x.id === aid; });
    if(!a) return;
    if(!confirm('Delete "' + (a.name || aid) + '"?\nThis will keep existing bookings valid and deactivate the area.')) return;
    return O.queue(function(){ return O.del('/v1/pickup-areas/' + encodeURIComponent(aid)); }).then(refresh)
      .catch(function(e){ O.fail('Pickup area not deleted', e); });
  }

  function saveProfile(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var d = (typeof _psuProfileDraft !== 'undefined') ? _psuProfileDraft : null;
    if(!d) return;
    var name = String(d.name || '').trim();
    if(!name){ alert('Profile name is required'); return; }
    if(!d.from || !d.to){ alert('Validity period is required'); return; }
    if(d.from > d.to){ alert('Start date must be before end date'); return; }
    if(d.isNew){
      var overlap = (profiles() || []).find(function(p){ return p.from && p.to && p.from <= d.to && p.to >= d.from; });
      if(overlap && !confirm('Validity overlaps with "' + overlap.name + '" (' + overlap.from + ' to ' + overlap.to + ').\nContinue?')) return;
    }
    var body = { name:name, from_date:d.from, to_date:d.to, notes:String(d.notes || '') };
    if(d.isNew && d.startFrom === 'clone' && d.cloneSourceId) body.clone_from = d.cloneSourceId;
    return O.queue(function(){
      return d.isNew ? O.post('/v1/pickup-time-profiles', body) : O.patch('/v1/pickup-time-profiles/' + encodeURIComponent(d.id), body);
    }).then(function(result){
      return refresh().then(function(){
        if(d.isNew){
          var p = result && result.id;
          if(p) _psuActiveProfileId = p;
          _psuTab = 'matrix';
        }
        _psuProfileDraft = null;
        redraw();
      });
    }).catch(function(e){ O.fail('Pickup profile not saved', e); });
  }

  function deleteProfile(orig, pid){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var p = profiles() && profiles().find(function(x){ return x && x.id === pid; });
    if(!p) return;
    if(!confirm('Delete profile "' + (p.name || pid) + '"?\nAll pickup times in this profile will be lost.')) return;
    return O.queue(function(){ return O.del('/v1/pickup-time-profiles/' + encodeURIComponent(pid)); }).then(function(){
      return refresh().then(function(){
        if(_psuActiveProfileId === pid) _psuActiveProfileId = (profiles() && profiles()[0] && profiles()[0].id) || null;
        redraw();
      });
    }).catch(function(e){ O.fail('Pickup profile not deleted', e); });
  }

  var CLOCK = '(\\d{2}:\\d{2})';
  var ONE = new RegExp('^' + CLOCK + '$');
  var WIN = new RegExp('^' + CLOCK + '-' + CLOCK + '$');
  var PIER = new RegExp('^Before ' + CLOCK + ' at pier$', 'i');
  function clock(text){
    var parts = String(text || '').split(':');
    return Number(parts[0]) <= 23 && Number(parts[1]) <= 59 ? text : null;
  }
  function parseCell(value){
    var text = String(value == null ? '' : value).trim(), m, start, end;
    if(!text) return {};
    m = PIER.exec(text); if(m){ end = clock(m[1]); return end ? { pickup_time_end:end, pickup_at_pier:true } : null; }
    m = WIN.exec(text);
    if(m){ start = clock(m[1]); end = clock(m[2]); return start && end && end > start ? { pickup_time:start, pickup_time_end:end } : null; }
    m = ONE.exec(text); if(m){ start = clock(m[1]); return start ? { pickup_time:start } : null; }
    return null;
  }
  function applyCell(profileId, routeId, target, value){
    var p = (profiles() || []).find(function(x){ return x && x.id === profileId; });
    if(!p) return;
    p.times = p.times || {};
    p.times[routeId] = p.times[routeId] || {};
    if(value) p.times[routeId][target] = value;
    else delete p.times[routeId][target];
  }
  function setTimeCell(orig, routeId, target, value){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var pid = (typeof _psuActiveProfileId !== 'undefined') ? _psuActiveProfileId : null;
    var parsed = parseCell(value);
    if(!pid){ O.fail('Pickup time not saved', new Error('No active pickup profile')); return; }
    if(parsed === null){ O.fail('Pickup time not saved', new Error('Use HH:MM, HH:MM-HH:MM, or Before HH:MM at pier')); return; }
    var path = '/v1/pickup-time-profiles/' + encodeURIComponent(pid) + '/times/' + encodeURIComponent(routeId) + '/' + encodeURIComponent(target);
    return O.queue(function(){
      return Object.keys(parsed).length ? O.call('PUT', path, parsed) : O.del(path);
    }).then(function(result){
      applyCell(pid, routeId, target, Object.keys(parsed).length ? cellText(result || parsed) : '');
      O.wrote('pickup');
    }).catch(function(e){ O.fail('Pickup time not saved', e); });
  }

  function resolve(routeId, areaId, date){
    if(!enabled()) return Promise.resolve(null);
    return O.get('/v1/pickup-time', { route_id:routeId, area_id:areaId, date:date });
  }

  wrap('renderPickupSetup', function(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    if(ready) return orig.apply(this, [].slice.call(arguments, 1));
    showLoading('Loading pickup areas and time profiles…');
    return load().then(function(){ return orig.apply(this, [].slice.call(arguments, 1)); }.bind(this), function(e){
      O.fail('Could not load Pickup Setup', e); showError();
    });
  });
  wrap('psuPersist', function(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    return undefined;
  });
  wrap('_psuInheritTimesForArea', function(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    return 0;
  });
  wrap('psuSaveArea', saveArea);
  wrap('psuDeleteArea', deleteArea);
  wrap('psuSaveProfile', saveProfile);
  wrap('psuDeleteProfile', deleteProfile);
  wrap('psuSetTimeCell', setTimeCell);

  // The legacy resolver intentionally ignored a fallback profile because its old
  // flat table was separate. In operations mode the fallback is in the server
  // profile list, so make the same authoritative data visible to booking quotes.
  wrap('psuResolveProfile', function(orig, date){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var found = orig.apply(this, [].slice.call(arguments, 1));
    if(found) return found;
    var list = (profiles() || []).filter(function(p){ return !p.from && !p.to; });
    list.sort(function(a,b){ return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
    return list[0] || null;
  });

  O.pickup = { load:load, refresh:refresh, resolve:resolve, isReady:function(){ return ready; } };
})();
