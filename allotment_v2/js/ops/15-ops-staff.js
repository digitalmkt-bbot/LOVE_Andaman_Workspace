/* ══════════════════════════════════════════════════════════════════════════
   §opsStaff · Staff & Welfare ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Server first in operation mode. The legacy roster functions remain intact
   for lk-inbox; these wrappers replace their localStorage writes only when
   LA_LEGACY_UNAVAILABLE is true.

   GET    /v1/staff?year=YYYY
   GET    /v1/staff/trips?year=YYYY
   POST   /v1/staff
   PATCH  /v1/staff/:id
   PUT    /v1/staff/:id/quotas/:year {free_seats}
   DELETE /v1/staff/:id
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var rosterYear=null, rosterById={}, fieldTimers={}, tripsByYear={};

  function enabled(){ return O.enabled(); }
  function map(row){
    return { id:row.id, code:row.code||'', name:row.name||'', dept:row.dept||'', active:row.active!==false,
      quota:Math.max(0, Number(row.quota)||0), used:Math.max(0, Number(row.used)||0),
      remaining:Number(row.remaining)||0, quotaMap:Object.assign({},row.quotas||{}) };
  }
  function applyRoster(j){
    var rows=(j&&j.staff)||[], year=Number(j&&j.year)||new Date().getFullYear();
    rosterYear=year; rosterById={};
    rows.forEach(function(row){ rosterById[row.id]=map(row); });
    if(typeof SB_STAFF!=='undefined' && Array.isArray(SB_STAFF)){
      SB_STAFF.length=0;
      rows.forEach(function(row){
        var s=map(row); SB_STAFF.push({id:s.id,code:s.code,name:s.name,dept:s.dept,active:s.active,quota:s.quotaMap});
      });
    }
    return j;
  }
  function render(){ try{ if(typeof renderStaff==='function') renderStaff(); }catch(_){} }
  function load(year, redraw){
    if(!enabled()) return Promise.resolve(null);
    year=Number(year)||new Date().getFullYear();
    return O.get('/v1/staff',{year:year}).then(function(j){ applyRoster(j); if(redraw!==false) render(); return j; },function(e){ O.fail('Could not load Staff & Welfare',e); throw e; });
  }
  function currentRow(id){ return rosterById[id]||null; }
  function loadTrips(year){
    year=Number(year)||new Date().getFullYear();
    if(!enabled()) return Promise.resolve([]);
    return O.get('/v1/staff/trips',{year:year}).then(function(j){
      tripsByYear[year]=((j&&j.trips)||[]).map(function(x){ return {
        bk:{id:x.booking_id,code:x.booking_id}, staff:(typeof staffGet==='function'?staffGet(x.staff_id):null),
        t:{date:x.service_date,routeId:x.route_id}, route:(typeof getRoute==='function'?getRoute(x.route_id):null),
        purpose:x.purpose, foc:Number(x.foc)||0, head:Number(x.head)||0, paid:Number(x.paid)||0
      }; });
      return tripsByYear[year];
    },function(e){ O.fail('Could not load staff trips',e); throw e; });
  }
  function setRow(row){ if(!row) return; rosterById[row.id]=map(row); var s=(typeof staffGet==='function')&&staffGet(row.id); if(s) Object.assign(s,{code:row.code||'',name:row.name||'',dept:row.dept||'',active:row.active!==false,quota:Object.assign({},row.quotas||{})}); }

  function wrap(name, replacement){
    var orig=window[name]; if(typeof orig!=='function'||orig.__opsStaff) return;
    var w=function(){ return replacement.apply(this,[orig].concat([].slice.call(arguments))); };
    w.__opsStaff=true; window[name]=w;
  }

  function install(){
    wrap('staffAdd',function(orig){
      if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
      return O.queue(function(){ return O.post('/v1/staff',{}); }).then(function(row){ setRow(row); return load(rosterYear||new Date().getFullYear(),true); }).catch(function(e){ O.fail('Could not add staff member',e); });
    });
    wrap('staffSetField',function(orig,id,field,val){
      if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
      var allowed={code:1,name:1,dept:1,active:1}; if(!allowed[field]) return;
      var key=id+'|'+field; clearTimeout(fieldTimers[key]);
      var send=function(){
        delete fieldTimers[key]; var body={}; body[field]=field==='active'?!!val:String(val||'');
        O.queue(function(){ return O.patch('/v1/staff/'+encodeURIComponent(id),body); }).then(function(row){ setRow(row); },function(e){ O.fail('Could not save staff member',e); load(rosterYear||new Date().getFullYear(),true).catch(function(){}); });
      };
      // Text fields are wired to legacy oninput. Collapse keystrokes into one server write.
      if(field==='active') send(); else fieldTimers[key]=setTimeout(send,350);
    });
    wrap('staffSetQuota',function(orig,id,year,val){
      if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
      var n=Math.max(0,parseInt(val,10)||0);
      return O.queue(function(){ return O.call('PUT','/v1/staff/'+encodeURIComponent(id)+'/quotas/'+encodeURIComponent(year),{free_seats:n}); })
        .then(function(row){ setRow(row); return load(year,true); }).catch(function(e){ O.fail('Could not save staff quota',e); });
    });
    wrap('staffDelete',function(orig,id){
      if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
      var s=(typeof staffGet==='function')&&staffGet(id), label=(s&&(s.name||s.code))||id;
      if(!confirm('Delete staff "'+label+'"?')) return;
      return O.queue(function(){ return O.del('/v1/staff/'+encodeURIComponent(id)); }).then(function(){ return load(rosterYear||new Date().getFullYear(),true); })
        .catch(function(e){ O.fail('Could not delete staff member',e); });
    });
    wrap('staffSetTab',function(orig,tab){
      if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
      var ret=orig.call(this,tab);
      if(tab==='trips') loadTrips(rosterYear||new Date().getFullYear()).then(render).catch(function(){});
      return ret;
    });
    wrap('staffSetYear',function(orig,delta){
      if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
      // Keep the legacy lexical year and its UI controls intact, then replace its local
      // calculation with the matching authoritative server roster.
      orig.call(this,delta);
      return load((rosterYear||new Date().getFullYear())+Number(delta||0),true);
    });
    // The legacy report calculations only see the locally loaded booking window. Prefer the
    // server's roster totals whenever that roster is for the viewed year.
    wrap('staffTripsFor',function(orig,year){
      if(enabled()&&tripsByYear[Number(year)]) return tripsByYear[Number(year)].slice();
      if(enabled()) loadTrips(year).then(render).catch(function(){});
      return orig.apply(this,[].slice.call(arguments,1));
    });
    wrap('staffQuota',function(orig,id,year){
      if(enabled()&&Number(year)===rosterYear&&currentRow(id)) return currentRow(id).quota;
      return orig.apply(this,[].slice.call(arguments,1));
    });
    wrap('staffWelfareUsed',function(orig,id,year){
      if(enabled()&&Number(year)===rosterYear&&currentRow(id)) return currentRow(id).used;
      return orig.apply(this,[].slice.call(arguments,1));
    });
    wrap('staffRemaining',function(orig,id,year){
      if(enabled()&&Number(year)===rosterYear&&currentRow(id)) return currentRow(id).remaining;
      return orig.apply(this,[].slice.call(arguments,1));
    });
  }

  install();
  O.staff={load:load,loadTrips:loadTrips,refresh:function(){ return load(rosterYear||new Date().getFullYear(),true); }};
})();
