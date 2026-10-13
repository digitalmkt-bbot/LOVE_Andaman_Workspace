function bookingV2WeatherMark(routeId,date){
  const rname=((typeof ROUTES!=='undefined'&&ROUTES.find(r=>r.id===routeId))||{}).name||routeId;
  const closed=bookingV2IsWeatherClosed(routeId,date);
  acctModal(`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700;color:#A32D2D">Cancel trip (weather)</div><div style="font-size:11px;color:var(--fd-ink-soft)">${rname} · ${date}</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>
    <div style="padding:16px 20px">
      <label style="font-size:11px;color:var(--fd-ink-soft);display:block;margin-bottom:5px">Note (e.g. high waves 3m · port closed · heavy rain)</label>
      <textarea id="wx-note" placeholder="Reason..." style="width:100%;min-height:72px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:8px;box-sizing:border-box">${closed?bookingV2WeatherNote(routeId,date):''}</textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px">
        <div>${closed?`<button onclick="bookingV2WeatherUncancel('${routeId}','${date}')" style="background:#fff;border:1px solid #0F7A5A;color:#0F7A5A;font-family:inherit;font-size:12px;font-weight:600;padding:9px 15px;border-radius:9px;cursor:pointer">&#8630; Undo cancel &middot; re-open trip</button>`:''}</div>
        <div style="display:flex;gap:8px">
          <button onclick="acctModalClose()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">Cancel</button>
          <button onclick="bookingV2WeatherMarkConfirm('${routeId}','${date}')" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">${closed?'Update note':'Confirm cancel trip'}</button>
        </div>
      </div>
    </div>`);
}
