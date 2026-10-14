/* ══════════════════════════════════════════════════════════════════════════
   §opsMoneyReports · accounting/report reads ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The four report views below are computed reads. In operations mode their
   figures come from the documented report endpoints; no report result is
   written into the legacy blob. The Trip P&L/cost-plan screens are deliberately
   not wrapped: their endpoints are not verified and remain legacy-only.

   GET /v1/reports/accounting
   GET /v1/agents/:id/statement
   GET /v1/reports/travel-summary?date=YYYY-MM-DD
   GET /v1/reports/daily?date=YYYY-MM-DD
   GET|PUT /v1/reports/daily/settings
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var legacyAccounting = window.renderAccounting;
  var reports = { accounting:null, statements:{}, travel:{}, daily:{}, loading:{}, errors:{} };

  function enabled(){ return O.enabled(); }
  function text(v){ return v == null ? '' : String(v); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function money(v){ return '฿' + Math.round(n(v)).toLocaleString('en-US'); }
  function dateOf(v){ return /^\d{4}-\d{2}-\d{2}$/.test(text(v)) ? text(v) : O.today(); }
  function fmtDate(v){ return v ? text(v).slice(0,10) : '—'; }
  function setLoading(key, p){ reports.loading[key] = p; return p.finally(function(){ delete reports.loading[key]; }); }
  function fail(title, e){ reports.errors[title] = e; O.fail(title, e); return null; }
  function hostError(id, message){
    var el = document.getElementById(id);
    if(el) el.innerHTML = '<div style="padding:32px;text-align:center;color:#A32D2D">'+esc(message)+'</div>';
  }
  function card(title, value, color){
    return '<div style="flex:1;min-width:150px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:13px 15px">'
      + '<div style="font-size:10.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:600">'+esc(title)+'</div>'
      + '<div style="font-size:22px;font-weight:700;color:'+(color||'var(--fd-ink)')+';font-variant-numeric:tabular-nums;margin-top:3px">'+value+'</div></div>';
  }
  function table(headers, rows, empty){
    return '<div style="background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;overflow:auto">'
      + '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#fafaf8">'
      + headers.map(function(h){ return '<th style="padding:8px 10px;text-align:'+(h.right?'right':'left')+';font-size:9.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em">'+esc(h.label)+'</th>'; }).join('')
      + '</tr></thead><tbody>'+(rows || '<tr><td colspan="'+headers.length+'" style="padding:20px;text-align:center;color:var(--fd-ink-soft)">'+esc(empty||'No data')+'</td></tr>')+'</tbody></table></div>';
  }
  function row(cells){ return '<tr style="border-top:0.5px solid var(--fd-line-soft)">'+cells.map(function(c,i){
    return '<td style="padding:8px 10px;font-size:11.5px;text-align:'+(i && c && c.right?'right':'left')+';font-variant-numeric:tabular-nums">'+(c && c.html!=null ? c.html : esc(c && c.value!=null ? c.value : c))+'</td>';
  }).join('')+'</tr>'; }

  function accountingHtml(d){
    d=d||{};
    var a=d.aging||{}, refunds=d.refunds_to_pay||{};
    var kpis='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">'
      +card('Outstanding',money(d.outstanding),'#A05A1A')
      +card('Paid this month',money(d.paid_this_month),'#0F6E56')
      +card('Credit exposure',money(d.credit_exposure),'#185FA5')
      +card('Overdue invoices',String(n(d.overdue_invoices)),n(d.overdue_invoices)>0?'#A32D2D':'var(--fd-ink)')
      +card('Deposits held',money(d.deposits_held),'#5B289A')
      +card('Extras · cash · mo',money(d.extras_this_month),'#0F6E56')+'</div>';
    var ageMax=Math.max(1,n(a.not_due),n(a.days_1_30),n(a.days_31_60),n(a.days_60_plus));
    var age=[['Not due',a.not_due,'#1D9E75'],['1–30d',a.days_1_30,'#D4A017'],['31–60d',a.days_31_60,'#D87A30'],['60d+',a.days_60_plus,'#A32D2D']].map(function(x){
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:64px;font-size:10.5px;color:var(--fd-ink-soft)">'+x[0]+'</span><div style="flex:1;height:13px;background:#f1efe9;border-radius:4px;overflow:hidden"><div style="width:'+Math.round(n(x[1])/ageMax*100)+'%;height:100%;background:'+x[2]+'"></div></div><span style="width:74px;text-align:right;font-size:10.5px">'+money(x[1])+'</span></div>';
    }).join('');
    var collections=(d.collections||[]).map(function(x){ return row([{value:x.month},{value:money(x.amount),right:true}]); }).join('');
    var top=(d.top_outstanding||[]).map(function(x){ return row([{value:x.name||x.agent_id||'—'},{value:money(x.balance),right:true}]); }).join('');
    var refundsHtml='<div style="margin-top:12px;font-size:11px;color:var(--fd-ink-soft)">Refunds to pay: <b>'+String(n(refunds.count))+'</b> · '+money(refunds.amount)+'</div>';
    return '<div data-ops-money-dashboard="1" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">'
      +'<div style="flex:1;min-width:250px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:14px 16px"><div style="font-size:12px;font-weight:600;margin-bottom:11px">Receivables aging · server snapshot</div>'+age+'</div>'
      +'<div style="flex:1;min-width:250px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:14px 16px"><div style="font-size:12px;font-weight:600;margin-bottom:11px">Collection · last 6 mo</div>'+table([{label:'Month'},{label:'Amount',right:true}],collections,'No collections')+'</div>'
      +'<div style="flex:1;min-width:250px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:14px 16px"><div style="font-size:12px;font-weight:600;margin-bottom:11px">Top outstanding · agents</div>'+table([{label:'Agent'},{label:'Balance',right:true}],top,'No outstanding balance')+refundsHtml+'</div>'
      +'</div>';
  }
  function renderAccountingFromServer(){
    if(!reports.accounting) return;
    var host=document.getElementById('acct-body'); if(!host) return;
    // The invoice table remains owned by the M1 server projection. Replace only
    // the old browser aggregate/KPI block with this computed server response.
    try{ legacyAccounting.call(this); }catch(e){ hostError('acct-body','Accounting could not render: '+e.message); return; }
    var first=host.firstElementChild;
    if(first) first.outerHTML=accountingKpis(reports.accounting);
  }
  function accountingKpis(d){
    return '<div data-ops-money-kpis="1" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">'
      +card('Outstanding',money(d.outstanding),'#A05A1A')+card('Paid this month',money(d.paid_this_month),'#0F6E56')
      +card('Credit exposure',money(d.credit_exposure),'#185FA5')+card('Overdue invoices',String(n(d.overdue_invoices)),n(d.overdue_invoices)>0?'#A32D2D':'var(--fd-ink)')
      +card('Deposits held',money(d.deposits_held),'#5B289A')+card('Extras · cash · mo',money(d.extras_this_month),'#0F6E56')+'</div>';
  }
  function loadAccounting(){
    if(reports.accounting) return Promise.resolve(reports.accounting);
    if(reports.loading.accounting) return reports.loading.accounting;
    return setLoading('accounting',O.get('/v1/reports/accounting').then(function(d){
      if(!d || typeof d.outstanding!=='number') throw new Error('invalid accounting report response');
      reports.accounting=d; return d;
    }));
  }

  function modal(html){
    var ov=document.getElementById('acct-modal');
    if(!ov){ ov=document.createElement('div'); ov.id='acct-modal'; document.body.appendChild(ov); }
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,20,25,.45);display:flex;align-items:center;justify-content:center;padding:24px';
    ov.innerHTML='<div style="background:#fff;border-radius:14px;max-width:760px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">'+html+'</div>';
    ov.onclick=function(e){ if(e.target===ov && typeof window.acctModalClose==='function') window.acctModalClose(); };
  }
  function statementHtml(d){
    var inv=(d&&d.invoices)||[], dep=(d&&d.deposits)||[], credit=d&&d.credit||{}, cb=d&&d.credit_balance||{};
    var stat=function(label,value,color){ return '<div style="flex:1;min-width:120px;background:#fafaf8;border-radius:9px;padding:9px 11px"><div style="font-size:9.5px;color:var(--fd-ink-soft);text-transform:uppercase">'+label+'</div><div style="font-size:16px;font-weight:700;color:'+(color||'var(--fd-ink)')+'">'+value+'</div></div>'; };
    var ir=inv.map(function(x){ return row([{value:x.number},{value:fmtDate(x.issued_at)},{value:money(x.total),right:true},{value:money(x.paid),right:true},{value:money(x.balance),right:true},{value:x.status}]); }).join('');
    var dr=dep.map(function(x){ return row([{value:fmtDate(x.received_on)},{value:x.method},{value:money(x.amount),right:true},{value:x.ref||x.note||'—'}]); }).join('');
    return '<div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700">Statement · '+esc(d.name)+'</div><div style="font-size:11px;color:var(--fd-ink-soft)">'+esc(d.code||'')+' · '+esc(d.pay_type||'')+'</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>'
      +'<div style="padding:16px 20px"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+stat('Invoiced',money(d.invoiced))+stat('Paid',money(d.paid),'#0F6E56')+stat('Outstanding',money(d.outstanding),'#A05A1A')+stat('Credit available',money(cb.available),'#185FA5')+'</div>'
      +'<div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;font-weight:700;margin:12px 0 6px">Invoices · server statement</div>'
      +table([{label:'Invoice'},{label:'Issued'},{label:'Total',right:true},{label:'Paid',right:true},{label:'Balance',right:true},{label:'Status'}],ir,'No invoices')
      +(dep.length?'<div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;font-weight:700;margin:16px 0 6px">Deposits</div>'+table([{label:'Date'},{label:'Method'},{label:'Amount',right:true},{label:'Reference'}],dr,'No deposits'):'')
      +(d.credits&&d.credits.length?'<div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;font-weight:700;margin:16px 0 6px">Credits</div>'+table([{label:'Invoice'},{label:'Created'},{label:'Reason'},{label:'Amount',right:true}],d.credits.map(function(x){ return row([{value:x.invoice_number||x.invoice_id},{value:fmtDate(x.created_at)},{value:x.reason||'—'},{value:money(x.amount),right:true}]); }).join(''),'No credits'):'')
      +'<div style="margin-top:12px;font-size:11px;color:var(--fd-ink-soft)">Credit limit: '+money(credit.limit)+' · Available: '+money(credit.available)+'</div></div>';
  }
  function loadStatement(id){
    id=text(id); if(reports.statements[id]) return Promise.resolve(reports.statements[id]);
    var key='statement:'+id; if(reports.loading[key]) return reports.loading[key];
    return setLoading(key,O.get('/v1/agents/'+encodeURIComponent(id)+'/statement').then(function(d){
      if(!d || d.agent_id!==id) throw new Error('invalid agent statement response'); reports.statements[id]=d; return d;
    }));
  }

  function reportNav(title,date,fnPrev,fnNext){
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px"><div><h2 style="margin:0;font-size:20px">'+title+'</h2><div style="font-size:11px;color:var(--fd-ink-soft)">Server snapshot · '+esc(date)+'</div></div><div style="display:flex;gap:6px"><button onclick="'+fnPrev+'" style="padding:7px 11px">‹ Previous</button><button onclick="'+fnNext+'" style="padding:7px 11px">Next ›</button></div></div>';
  }
  function travelHtml(d){
    d=d||{}; var m=d.money||{}, c=d.cot||{}, ns=d.noshow||{};
    var rows=(d.collect_rows||[]).map(function(x){ return row([{value:x.voucher_ref||x.booking_id},{value:x.route_id},{value:money(x.target),right:true},{value:money(x.paid),right:true},{value:money(x.due),right:true},{value:x.not_counted||'—'}]); }).join('');
    // §tsEmpty (2026-10-14) · an all-zero grid looks broken; say outright that the SERVER has
    // no bookings for the day (its honest answer), so staff don't read zeros as a loading bug.
    var emptyNote=(!n(d.bookings) && !(d.collect_rows||[]).length)
      ? '<div data-ops-ts-empty="1" style="margin-bottom:16px;padding:12px 15px;background:#fdf8ee;border:0.5px solid #e8dcc0;border-radius:12px;font-size:12px;color:#8a6d1a">operation-backend reports no bookings for '+esc(d.date)+'. The snapshot below is genuinely empty, not still loading.</div>' : '';
    return reportNav('Travel Summary',d.date,'tsDateShift(-1)','tsDateShift(1)')
      +emptyNote
      +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">'+card('Bookings',String(n(d.bookings)))+card('Booked',String(n(d.booked)))+card('Travelled',String(n(d.travelled)),'#0F6E56')+card('No-show / CXL',String(n(d.no_show))+' / '+String(n(d.cxl)),'#A05A1A')+card('Received',money(m.received),'#0F6E56')+card('To collect',money(m.to_collect),'#A05A1A')+'</div>'
      +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"><div style="flex:1;min-width:260px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:14px"><b>Money by method</b><div style="margin-top:9px;font-size:12px">Cash '+money(m.cash)+' · Transfer '+money(m.transfer)+' · Card '+money(m.card)+' · Fees '+money(m.fees)+'</div><div style="margin-top:7px;font-size:12px">Sales '+money(m.sales)+' · Sales due '+money(m.sales_due)+' · Commission '+money(m.commission)+'</div></div><div style="flex:1;min-width:260px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:14px"><b>COT / no-show</b><div style="margin-top:9px;font-size:12px">COT total '+money(c.total)+' · Payout '+money(c.payout)+' · Deduct '+money(c.deduct)+'</div><div style="margin-top:7px;font-size:12px">No-show cases '+String(n(ns.cases))+' · Pending '+String(n(ns.pending))+' · Charged '+money(ns.charged)+'</div></div></div>'
      +table([{label:'Booking'},{label:'Route'},{label:'Target',right:true},{label:'Paid',right:true},{label:'Due',right:true},{label:'Note'}],rows,'No money rows');
  }
  function loadTravel(date){
    date=dateOf(date); if(reports.travel[date]) return Promise.resolve(reports.travel[date]);
    var key='travel:'+date; if(reports.loading[key]) return reports.loading[key];
    return setLoading(key,O.get('/v1/reports/travel-summary',{date:date}).then(function(d){ if(!d || d.date!==date) throw new Error('invalid travel summary response'); reports.travel[date]=d; return d; }));
  }

  function dailyHtml(d){
    d=d||{}; var p=d.pax||{}, v=d.van_cost||{}, s=d.settings||{};
    var routes=(d.by_route||[]).map(function(x){ return row([{value:x.name||x.route_id},{value:x.bookings},{value:x.pax},{value:money(x.revenue),right:true},{value:money(x.per_pax),right:true}]); }).join('');
    var agents=(d.by_agent||[]).map(function(x){ return row([{value:x.name||x.key},{value:x.bookings},{value:x.pax},{value:money(x.revenue),right:true},{value:money(x.due),right:true}]); }).join('');
    return reportNav('Daily Report',d.date,'drDateShift(-1)','drDateShift(1)')
      +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">'+card('Bookings',String(n(d.bookings)))+card('Pax',String(n(p.total)))+card('Revenue',money(d.revenue),'#0F6E56')+card('Per paying pax',money(d.revenue_per_pax))+card('Due',money(d.due),'#A05A1A')+card('Got',money(d.got),'#0F6E56')+'</div>'
      +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"><div style="flex:1;min-width:260px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:14px"><b>Passenger mix</b><div style="margin-top:9px;font-size:12px">Adult '+String(n(p.ad))+' · Child '+String(n(p.chd))+' · Infant '+String(n(p.inf))+' · FOC '+String(n(p.foc))+'</div></div><div style="flex:1;min-width:260px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:14px"><b>Van cost</b><div style="margin-top:9px;font-size:12px">'+money(v.total)+' · '+String(n(v.vans))+' vans'+(v.estimated?' · estimated':'')+'</div><div style="margin-top:8px;font-size:11px;color:var(--fd-ink-soft)">Settings: '+money(s.van_cost)+' / van · quota '+String(n(s.van_quota))+' · target '+money(s.target_per_pax)+'/pax</div><div style="margin-top:10px;display:flex;gap:6px;align-items:center"><input id="ops-dr-van-cost" type="number" value="'+esc(s.van_cost)+'" style="width:90px"><button onclick="drCfgSet(\'vanCost\',document.getElementById(\'ops-dr-van-cost\').value)">Save van cost</button></div></div></div>'
      +'<div style="display:flex;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:360px">'+table([{label:'Route'},{label:'Bookings'},{label:'Pax'},{label:'Revenue',right:true},{label:'Per pax',right:true}],routes,'No route rows')+'</div><div style="flex:1;min-width:360px">'+table([{label:'Agent'},{label:'Bookings'},{label:'Pax'},{label:'Revenue',right:true},{label:'Due',right:true}],agents,'No agent rows')+'</div></div>';
  }
  function loadDaily(date){
    date=dateOf(date); if(reports.daily[date]) return Promise.resolve(reports.daily[date]);
    var key='daily:'+date; if(reports.loading[key]) return reports.loading[key];
    return setLoading(key,Promise.all([O.get('/v1/reports/daily',{date:date}),O.get('/v1/reports/daily/settings')]).then(function(x){
      var d=x[0]; if(!d || d.date!==date) throw new Error('invalid daily report response'); d.settings=x[1]||d.settings; reports.daily[date]=d; return d;
    }));
  }

  function wrap(name, replacement){
    var orig=window[name]; if(typeof orig!=='function' || orig.__opsMoneyReports) return;
    var w=function(){ return replacement.apply(this,[orig].concat([].slice.call(arguments))); };
    w.__opsMoneyReports=true; window[name]=w;
  }
  wrap('renderAccounting',function(orig){
    if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
    var self=this; var host=document.getElementById('acct-body');
    if(!reports.accounting){ if(host) host.innerHTML=O.loadingHtml('Loading accounting…'); return loadAccounting().then(function(){ renderAccountingFromServer.call(self); },function(e){ fail('Accounting report did not load',e); hostError('acct-body','Accounting report did not load from operation-backend.'); }); }
    return renderAccountingFromServer.call(self);
  });
  wrap('acctDashboardHtml',function(orig){
    if(!enabled() || !reports.accounting) return orig.apply(this,[].slice.call(arguments,1));
    return accountingHtml(reports.accounting);
  });
  wrap('acctStatementOpen',function(orig,agentId){
    if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
    var id=text(agentId); if(!id) return;
    if(reports.statements[id]) return modal(statementHtml(reports.statements[id]));
    modal(O.loadingHtml('Loading statement…'));
    return loadStatement(id).then(function(d){ modal(statementHtml(d)); },function(e){ fail('Agent statement did not load',e); modal('<div style="padding:32px;color:#A32D2D">Agent statement did not load from operation-backend.</div>'); });
  });
  wrap('renderTravelSum',function(orig){
    if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
    var host=document.getElementById('travelsum-host'), date=dateOf(typeof _tsDate!=='undefined'?_tsDate:null);
    if(!reports.travel[date]){ if(host) host.innerHTML=O.loadingHtml('Loading Travel Summary…'); return loadTravel(date).then(function(d){ if(host) host.innerHTML=travelHtml(d); },function(e){ fail('Travel Summary did not load',e); hostError('travelsum-host','Travel Summary did not load from operation-backend.'); }); }
    if(host) host.innerHTML=travelHtml(reports.travel[date]);
  });
  wrap('renderDailyReport',function(orig){
    if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
    var host=document.getElementById('dailyreport-host'), date=dateOf(typeof _drDate!=='undefined'?_drDate:null);
    if(!reports.daily[date]){ if(host) host.innerHTML=O.loadingHtml('Loading Daily Report…'); return loadDaily(date).then(function(d){ if(host) host.innerHTML=dailyHtml(d); },function(e){ fail('Daily Report did not load',e); hostError('dailyreport-host','Daily Report did not load from operation-backend.'); }); }
    if(host) host.innerHTML=dailyHtml(reports.daily[date]);
  });
  wrap('drCfgSet',function(orig,key,value){
    if(!enabled()) return orig.apply(this,[].slice.call(arguments,1));
    var field={vanCost:'van_cost',vanQuota:'van_quota',targetPerPax:'target_per_pax'}[key];
    if(!field){ O.fail('Daily report setting not saved',new Error('Unknown setting '+key)); return; }
    var body={}; body[field]=Math.max(0,Math.round(parseFloat(String(value).replace(/[^0-9.]/g,''))||0));
    return O.queue(function(){ return O.call('PUT','/v1/reports/daily/settings',body); }).then(function(settings){
      var date=dateOf(typeof _drDate!=='undefined'?_drDate:null);
      if(reports.daily[date]) reports.daily[date].settings=settings;
      O.wrote('daily-report-settings');
      if(typeof window.renderDailyReport==='function') window.renderDailyReport();
    },function(e){ fail('Daily report setting not saved',e); });
  });
  O.onWrite(function(){ reports.accounting=null; reports.statements={}; reports.travel={}; reports.daily={}; reports.errors={}; });
  window.laOps.moneyReports={ loadAccounting:loadAccounting, loadStatement:loadStatement, loadTravel:loadTravel, loadDaily:loadDaily, clear:function(){ reports={accounting:null,statements:{},travel:{},daily:{},loading:{},errors:{}}; } };
})();
