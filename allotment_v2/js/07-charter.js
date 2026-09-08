
function openCharterModal(){
  ['ch-name','ch-note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ch-cap').value='40';
  document.getElementById('ch-from').value=TODAY_STR;
  document.getElementById('ch-to').value=TODAY_STR;
  document.getElementById('ch-pier').value='tublamu';
  document.querySelectorAll('#ch-pier-pills .loc-pill').forEach((el,i)=>el.classList.toggle('on',i===0));
  openModal('charter-modal');
  // Auto-sync from→to
  const fromInp=document.getElementById('ch-from');
  const toInp=document.getElementById('ch-to');
  fromInp.onchange=()=>{
    if(!toInp.value||toInp.value<fromInp.value){toInp.value=fromInp.value;}
  };
}
function chSelPier(val,el){
  document.getElementById('ch-pier').value=val;
  document.querySelectorAll('#ch-pier-pills .loc-pill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
}
function saveCharterBoat(){
  const name=document.getElementById('ch-name').value.trim();if(!name){alert('กรุณาระบุชื่อเรือ');return;}
  const pier=document.getElementById('ch-pier').value;
  const from=document.getElementById('ch-from').value;
  const to=document.getElementById('ch-to').value;
  if(!from){alert('กรุณาระบุวันที่เริ่ม');return;}
  if(!to){alert('กรุณาระบุวันที่สิ้นสุด');return;}
  if(to<from){alert('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม');return;}
  const note=document.getElementById('ch-note').value.trim();
  const locMap={tublamu:'Tub Lamu Pier',panwa:'Visit Panwa',ranong:'Ranong Pier'};
  BOATS.push({
    id:'b'+Date.now(),
    name,
    type:document.getElementById('ch-type').value,
    pier,
    cap:parseInt(document.getElementById('ch-cap').value)||40,
    ownership:'charter',
    log:[{id:'sl'+Date.now(),s:'available',from,to,loc:locMap[pier]||pier,note}]
  });
  closeModal('charter-modal');renderBoats();save('config');
}
