function bookingV2TogShow(el, pin){
  try{
    clearTimeout(_bkV2TogT);
    var pop = document.getElementById('t2-tog-pop');
    if(!pop){ pop = document.createElement('div'); pop.id = 't2-tog-pop';
      pop.addEventListener('mouseenter', function(){ clearTimeout(_bkV2TogT); });
      pop.addEventListener('mouseleave', function(){ bookingV2TogHide(); });
      pop.addEventListener('click', function(ev){ ev.stopPropagation(); });
      document.body.appendChild(pop);
      document.addEventListener('click', function(){ bookingV2TogHide(true); });
      document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') bookingV2TogHide(true); });
    }
    if(pin){ if(_bkV2TogPin && pop.getAttribute('data-al') === el.getAttribute('data-al') && pop.style.display === 'block'){ bookingV2TogHide(true); return; } _bkV2TogPin = true; }
    else if(_bkV2TogPin) return;   // ปักไว้อยู่ · ชี้ป้ายอื่นไม่เปลี่ยน
    var h = bookingV2TogHtml(el.getAttribute('data-tog'), el.getAttribute('data-d'), el.getAttribute('data-al'));
    if(!h){ pop.style.display = 'none'; return; }
    pop.innerHTML = h; pop.setAttribute('data-al', el.getAttribute('data-al')||'');
    pop.style.setProperty('--tgc', el.style.getPropertyValue('--tgc') || '#7C3AED');
    pop.style.display = 'block'; pop.style.left = '0px'; pop.style.top = '0px';
    var r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
    var y = r.bottom + 6; if(y + ph > window.innerHeight - 8) y = Math.max(8, r.top - ph - 6);
    pop.style.left = Math.round(x) + 'px'; pop.style.top = Math.round(y) + 'px';
  }catch(e){ console.error('[together] show', e); }
}
