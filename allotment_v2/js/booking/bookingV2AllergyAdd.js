function bookingV2AllergyAdd(){ const sm=_bkV2EnsureSM(); if(!sm) return; const ne=document.getElementById('bkv2-allerg-name'); const qe=document.getElementById('bkv2-allerg-qty'); const name=((ne&&ne.value)||'').trim(); if(!name) return; const qty=Math.max(1,Math.floor(Number(qe&&qe.value)||1));
  /* §mealNote · พิมพ์ประเภทอาหารลงช่องสิ่งที่แพ้ · ถามก่อน เพราะจะกลายเป็น "แพ้อาหาร N ราย" และยอดมังสวิรัติไม่ถูกนับ */
  const _dk=(arguments[0]===true)?'':bookingV2DietKeyOf(name);
  if(_dk && typeof laAskSheet==='function'){ laAskSheet({ title:'นี่คือประเภทอาหาร ไม่ใช่สิ่งที่แพ้',
      body:'"'+name+'" ดูเป็น '+BKV2_DIET_LBL[_dk]+'\nถ้าใส่ในช่อง Allergies ครัวจะเห็นเป็น "แพ้อาหาร '+qty+' ราย" และยอด '+BKV2_DIET_LBL[_dk]+' จะไม่ถูกนับ',
      okLabel:'ย้ายไป '+BKV2_DIET_LBL[_dk]+' '+qty+' คน', color:'#0F6E56', noLabel:'แพ้จริง · เพิ่มช่องนี้',
      onYes:function(){ bookingV2DietFromText(_dk,name,qty); }, onNo:function(){ bookingV2AllergyAdd(true); } }); return; }
  const ex=sm.allergyList.find(a=>(a.name||'').toLowerCase()===name.toLowerCase()); if(ex) ex.qty=Math.floor(+ex.qty||0)+qty; else sm.allergyList.push({name,qty}); bookingV2Render(); }
