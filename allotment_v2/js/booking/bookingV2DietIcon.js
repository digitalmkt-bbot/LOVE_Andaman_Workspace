// ── SVG icon helpers for booking ──
function bookingV2DietIcon(name, color){
  const c = color||'currentColor';
  const map = {
    veg:    '<path d="M12 22c-4 0-8-3-8-9 0-4 3-7 7-7 1.5 0 3 .5 4 1.5C16 6.5 18 5 20 5c0 5-3 9-7 10v7z"/>',
    vegan:  '<path d="M12 2C7 7 4 10 4 14a8 8 0 0 0 16 0c0-4-3-7-8-12z"/><line x1="12" y1="22" x2="12" y2="14"/>',
    halal:  '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    luggage:'<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/><line x1="5" y1="13" x2="19" y2="13"/>'
  };
  const p = map[name] || map.luggage;
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${p}</svg>`;
}
