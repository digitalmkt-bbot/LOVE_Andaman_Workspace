// Display label · "English (ไทย)" · used by modals, report, history
function bookingV2CancelLabel(code){ if(code==='weather') return 'Weather (สภาพอากาศ)'; const r=BKV2_CANCEL_REASONS.find(x=>x.code===code); return r ? (r.en+' ('+r.th+')') : (code||'—'); }
