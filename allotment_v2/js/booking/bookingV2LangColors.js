function bookingV2LangColors(code){
  // distinct color per guide language · used in trip-header prep + manifest row
  const m={ EN:['#E6F1FB','#185FA5'], RU:['#FCEBEB','#A32D2D'], CN:['#FAEEDA','#854F0B'], TH:['#EAF3DE','#3B6D11'], FR:['#EDE7FB','#5B289A'], DE:['#E1F5EE','#0F6E56'] };
  return m[code] || ['#F1EFE8','#5F5E5A'];
}
