// ── Dietary + Luggage ── (1-line · SVG icons · compact)
function bookingV2RenderDietaryLuggageSection(){
  const d = _bkV2.newBooking;
  const m = d.specialMeals || (d.specialMeals = { veg:0, vegan:0, halal:0, allergies:'' });
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const luggage = d.largeLuggage || 0;
  // Compact pill style · all 4 items in 1 row
  const pill = (on, val, label, color, iconKey, onToggleStmt, onSetQtyStmt) => `
    <label style="display:inline-flex;align-items:center;gap:8px;padding:7px 12px;background:${on?color+'14':'var(--white)'};border:1px solid ${on?color+'55':'var(--border)'};border-radius:14px;cursor:pointer;font-size:11.5px;font-weight:600;color:${on?color:'var(--ink)'}">
      <input type="checkbox" ${on?'checked':''} onchange="${onToggleStmt}" style="accent-color:${color};width:14px;height:14px;margin:0;flex-shrink:0">
      ${bookingV2DietIcon(iconKey, on?color:'#94A3B8')}
      <span>${label}</span>
      ${on ? `<span onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:4px;margin-left:2px"><input type="number" min="1" max="99" value="${val}" oninput="${onSetQtyStmt}" style="width:40px;height:22px;font-size:12px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums;border:1px solid ${color}55;border-radius:4px;padding:0 3px;background:#fff;color:${color};font-family:inherit"></span>` : ''}
    </label>
  `;
  const totalSpecial = (m.veg||0) + (m.vegan||0) + (m.halal||0);
  const luggageWarn = luggage >= 3 ? `<div style="background:#FFF6E5;border:1px solid #EAD9B0;border-radius:var(--r-sm);padding:7px 11px;margin-top:8px;font-size:11px;color:#633806">&#9888; ${luggage} large bag(s) may require van seat reduction · check with dispatcher</div>` : '';
  return `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">
      <span style="font-size:10px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-right:3px">Diet</span>
      ${pill((m.veg||0)>0, m.veg||0, 'Vegetarian', '#246b43', 'veg', "bookingV2ToggleMealOn('veg',this.checked)", "bookingV2SetMealQty('veg',this)")}
      ${pill((m.vegan||0)>0, m.vegan||0, 'Vegan', '#1f8a4a', 'vegan', "bookingV2ToggleMealOn('vegan',this.checked)", "bookingV2SetMealQty('vegan',this)")}
      ${pill((m.halal||0)>0, m.halal||0, 'Halal', '#8a5b1f', 'halal', "bookingV2ToggleMealOn('halal',this.checked)", "bookingV2SetMealQty('halal',this)")}
      <span style="width:1px;height:18px;background:var(--border);margin:0 4px"></span>
      ${pill(luggage>0, luggage, 'Large luggage', '#5A4F2A', 'luggage', "bookingV2ToggleLuggageOn(this.checked)", "bookingV2SetLuggageQty(this.value)")}
    </div>
    ${luggageWarn}
    <div style="margin-top:10px">
      <label class="bkv2-nb-label">Food allergies ${(typeof bookingV2AllergyCount==='function'&&bookingV2AllergyCount(m)>0)?`<em style="font-weight:600;color:#A32D2D;font-style:normal">· &#9888; ${bookingV2AllergyCount(m)} ราย</em>`:''}</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;align-items:center">
        ${(Array.isArray(m.allergyList)?m.allergyList:[]).map((a,i)=>`<span style="display:inline-flex;align-items:center;gap:5px;background:#FCEBEB;border:1px solid #F0C9C9;color:#A32D2D;border-radius:12px;padding:4px 5px 4px 11px;font-size:11.5px;font-weight:700">${escapeHTML(a.name)} &times;<input type="number" min="1" max="99" value="${Math.floor(+a.qty||1)}" onchange="bookingV2AllergySetQty(${i},this.value)" onclick="event.stopPropagation()" style="width:36px;height:21px;text-align:center;border:1px solid #E6B8B8;border-radius:4px;font-size:11px;font-weight:700;color:#A32D2D;font-family:inherit;background:#fff"><span onclick="bookingV2AllergyRemove(${i})" style="cursor:pointer;color:#C77;font-size:14px;padding:0 3px;line-height:1" title="ลบ">&times;</span></span>`).join('')}
        <input id="bkv2-allerg-name" placeholder="เพิ่มสิ่งที่แพ้ เช่น Peanut" onkeydown="if(event.key==='Enter'){event.preventDefault();bookingV2AllergyAdd();}" style="flex:1;min-width:150px;height:30px;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;padding:0 9px;font-size:12px;font-family:inherit">
        <input id="bkv2-allerg-qty" type="number" min="1" max="99" value="1" title="จำนวนคน" style="width:48px;height:30px;box-sizing:border-box;text-align:center;border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:700;font-family:inherit">
        <button type="button" onclick="bookingV2AllergyAdd()" style="height:30px;background:#A32D2D;color:#fff;border:none;border-radius:8px;padding:0 13px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">+ เพิ่ม</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
        ${['Peanut','Tree nuts','Shellfish','Fish','Egg','Milk/Lactose','Gluten','Soy'].map(p=>`<button type="button" onclick="bookingV2AllergyAddPreset('${p}')" style="font-size:10.5px;color:#7a4a4a;background:#FBF1F1;border:1px solid #EAD2D2;border-radius:11px;padding:3px 9px;cursor:pointer;font-family:inherit">+ ${p}</button>`).join('')}
      </div>
      ${/* §bkAlFree (2026-09-14) · ช่องข้อความอิสระเรื่องอาหาร (specialMeals.allergies)
           ช่องนี้มีมานานแล้ว · ครัวกับใบพิมพ์อ่านมันอยู่ และหน้าเช็คอินหน้าท่าเขียนลงช่องนี้ได้
           แต่ในใบจองไม่เคยมีช่องให้เห็นหรือแก้เลย · ของที่หน้าท่าใส่ไว้จึงอ่านไม่ได้จากตรงนี้
           และคนที่อยากโน้ตเป็นประโยค (ไม่ใช่ชื่อวัตถุดิบ) ไม่มีที่ให้ลง
           ชิปข้างบนไว้ของที่นับจำนวนคนได้ · ช่องนี้ไว้รายละเอียดที่นับไม่ได้ */''}
      <div style="margin-top:8px">
        <label class="bkv2-nb-label" style="display:flex;align-items:center;gap:7px">รายละเอียดเพิ่มเติมเรื่องอาหาร
          <em style="font-weight:600;font-style:normal;color:var(--ink-soft);font-size:10px">ประโยคที่ครัวกับไกด์ต้องอ่าน · ขึ้นบนใบพิมพ์</em>
          ${(m.pierBy||m.pierAt)?`<em style="font-weight:700;font-style:normal;color:#0C6285;background:#E4F2F8;border-radius:9px;padding:1px 8px;font-size:9.5px">หน้าท่าบันทึก${m.pierBy?(' · '+escapeHTML(m.pierBy)):''}${m.pierAt?(' · '+escapeHTML(m.pierAt)):''}</em>`:''}
        </label>
        <textarea id="bkv2-allerg-free" rows="2" placeholder="เช่น เด็ก 1 คนไม่กินเผ็ด · ขอข้าวสวยเพิ่ม 2 ที่ · ห้ามใส่ถั่วทุกจาน"
          oninput="bookingV2SetMealNote(this.value)"
          style="width:100%;box-sizing:border-box;margin-top:5px;border:1px solid ${(m.allergies||'').trim()?'#F0C9C9':'var(--border)'};background:${(m.allergies||'').trim()?'#FFFBFB':'var(--white)'};border-radius:8px;padding:7px 9px;font-size:12px;font-family:inherit;line-height:1.45;resize:vertical">${escapeHTML(m.allergies||'')}</textarea>
      </div>
    </div>
  `;
}
