function bookingV2RenderKeep(){ if(typeof bookingV2Render==='function'){ _bkV2OwnScrollUntil = Date.now() + 150; bookingV2KeepScroll(bookingV2Render); } }

/* ══ §btLoadJump (2026-11-28) · "By trip date เลื่อนไปวันถัดไป แล้ว scroll down เลย จะค้างและเด้งใหม่" ══
   Moving to another day starts several reads for that day (its bookings, /operations/by-trip, the van board,
   the overnight holds, the manifests). Each answer redrew the whole page with bookingV2Render() as soon as it
   landed: 3-5 full redraws in a row (the page froze), and the ones without bookingV2KeepScroll put the table
   back at the top (the page jumped) while the person was already scrolling down.
   A redraw that follows a load now goes through bookingV2RedrawAfterLoad(still):
     · answers that land together are drawn once (one redraw per burst, not one per answer)
     · it waits while the person is scrolling (wheel / touch / scroll in the last 350 ms), at most 3 s
     · it keeps every scroll position (bookingV2KeepScroll)
     · still() is asked again when it draws: an answer for a day no longer on screen draws nothing */
var _bkV2LastScrollAt = 0, _bkV2OwnScrollUntil = 0;   // the scroll events bookingV2KeepScroll itself causes are not the person's
(function(){
  try{
    var mark = function(){ _bkV2LastScrollAt = Date.now(); };
    ['wheel','touchmove'].forEach(function(ev){ document.addEventListener(ev, mark, { capture:true, passive:true }); });
    document.addEventListener('scroll', function(){ if(Date.now() > _bkV2OwnScrollUntil) mark(); }, { capture:true, passive:true });   // scrollbar drag, momentum
    document.addEventListener('keydown', function(e){
      if(/^(PageDown|PageUp|ArrowDown|ArrowUp|Home|End| )$/.test(e.key)) mark();
    }, { capture:true, passive:true });
  }catch(_){}
})();
var _bkV2LoadRedraw = { timer:null, since:0, stills:[] };
function bookingV2RedrawAfterLoad(still){
  var q = _bkV2LoadRedraw;
  q.stills.push(typeof still === 'function' ? still : function(){ return true; });
  if(q.timer) return;
  if(!q.since) q.since = Date.now();
  var IDLE = 350, MAX_WAIT = 3000;
  var run = function(){
    q.timer = null;
    var quietFor = Date.now() - _bkV2LastScrollAt;
    if(quietFor < IDLE && Date.now() - q.since < MAX_WAIT){ q.timer = setTimeout(run, IDLE - quietFor + 20); return; }
    var stills = q.stills; q.stills = []; q.since = 0;
    var go = false;
    stills.forEach(function(fn){ try{ if(fn()) go = true; }catch(_){} });
    if(!go || !document.getElementById('bkv2-host')) return;
    try{ bookingV2RenderKeep(); }catch(e){ console.warn('[bookingV2RedrawAfterLoad] redraw failed', e); }
  };
  q.timer = setTimeout(run, 30);
}
