
// ══════════════════════════════════════
// DATA + localStorage
// ══════════════════════════════════════
const TODAY = new Date();
const TODAY_STR = fmt(TODAY);
function fmt(d){return d.toISOString().slice(0,10);}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function dStr(n){return fmt(addDays(TODAY,n));}

const DEFAULT_ROUTES = [
  // ── TUB LAMU ──
  {id:'r1', name:'Early Tratato Similan Islands', islands:'เกาะ 5,6,7,8,9', times:['05:30'], color:'#1a7fa0', pier:'tublamu',
    seasons:[{id:'ss1',type:'open',from:'2025-10-15',to:'2026-05-15'},{id:'ss2',type:'closed',from:'2026-05-16',to:'2026-10-14'},{id:'ss3',type:'open',from:'2026-10-15',to:'2027-05-15'}]},
  {id:'r2', name:'Early Tiger Similan Islands', islands:'เกาะ 5,6,7,8,9', times:['07:00'], color:'#378ADD', pier:'tublamu',
    seasons:[{id:'ss4',type:'open',from:'2025-10-15',to:'2026-05-15'},{id:'ss5',type:'closed',from:'2026-05-16',to:'2026-10-14'},{id:'ss6',type:'open',from:'2026-10-15',to:'2027-05-15'}]},
  {id:'r3', name:'Similan Islands - PG', islands:'เกาะ 5,6,7,8,9', times:['08:00'], color:'#185fa5', pier:'tublamu',
    seasons:[{id:'ss7',type:'open',from:'2025-10-15',to:'2026-05-15'},{id:'ss8',type:'closed',from:'2026-05-16',to:'2026-10-14'},{id:'ss9',type:'open',from:'2026-10-15',to:'2027-05-15'}]},
  {id:'r4', name:'Similan Islands by Catamaran', islands:'เกาะ 5,6,7,8,9', times:['08:30'], color:'#4a90d9', pier:'tublamu',
    seasons:[{id:'ss10',type:'open',from:'2025-10-15',to:'2026-05-15'},{id:'ss11',type:'closed',from:'2026-05-16',to:'2026-10-14'},{id:'ss12',type:'open',from:'2026-10-15',to:'2027-05-15'}]},
  {id:'r5', name:'Similan Islands by Speedboat', islands:'เกาะ 5,6,7,8,9', times:['08:30'], color:'#6aaee0', pier:'tublamu',
    seasons:[{id:'ss13',type:'open',from:'2025-10-15',to:'2026-05-15'},{id:'ss14',type:'closed',from:'2026-05-16',to:'2026-10-14'},{id:'ss15',type:'open',from:'2026-10-15',to:'2027-05-15'}]},
  {id:'r6', name:'Surin Islands by Speedboat', islands:'เกาะสุรินทร์เหนือ-ใต้', times:['08:00'], color:'#3B6D11', pier:'tublamu',
    seasons:[{id:'ss16',type:'open',from:'2025-10-15',to:'2026-05-15'},{id:'ss17',type:'closed',from:'2026-05-16',to:'2026-10-14'},{id:'ss18',type:'open',from:'2026-10-15',to:'2027-05-15'}]},
  // ── VISIT PANWA ──
  {id:'r7', name:'Early OTA Phi Phi Bamboo', islands:'เกาะพีพี, ไม้ไผ่', times:['06:30'], color:'#c0392b', pier:'panwa',
    seasons:[{id:'ss19',type:'open',from:'2026-01-01',to:'2026-12-31'}]},
  {id:'r8', name:'Early SY Phi Phi Bamboo', islands:'เกาะพีพี, ไม้ไผ่', times:['06:30'], color:'#e74c3c', pier:'panwa',
    seasons:[{id:'ss20',type:'open',from:'2026-01-01',to:'2026-12-31'}]},
  {id:'r9', name:'Phi Phi Bamboo - FS', islands:'เกาะพีพี, ไม้ไผ่', times:['07:00'], color:'#e85d5d', pier:'panwa',
    seasons:[{id:'ss21',type:'open',from:'2026-01-01',to:'2026-12-31'}]},
  {id:'r10', name:'Phi Phi Bamboo by Speedboat', islands:'เกาะพีพี, ไม้ไผ่', times:['09:00'], color:'#f08080', pier:'panwa',
    seasons:[{id:'ss22',type:'open',from:'2026-01-01',to:'2026-12-31'}]},
  {id:'r11', name:'Early Krabi + Phang Nga', islands:'เกาะปอดะ, ทะเลแหวก, อ่าวพังงา', times:['06:30'], color:'#0F6E56', pier:'panwa',
    seasons:[{id:'ss23',type:'open',from:'2026-01-01',to:'2026-12-31'}]},
  {id:'r12', name:'Whale Shark Phi Phi Maiton Sunset', islands:'Whale Shark Point, พีพี, ไม้ตอน', times:['10:00'], color:'#BA7517', pier:'panwa',
    seasons:[{id:'ss24',type:'open',from:'2025-10-15',to:'2026-05-15'},{id:'ss25',type:'closed',from:'2026-05-16',to:'2026-10-14'},{id:'ss26',type:'open',from:'2026-10-15',to:'2027-05-15'}]},
];

const DEFAULT_BOATS = [
  {id:'b1',name:'Aluminous1',type:'Catamaran',pier:'tublamu',cap:64,
    engineCount:4,use:'บรรทุกคนโดยสาร (เร็ว)',material:'อลูมิเนียม',
    reg:'6051/0271/4',callsign:'',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:24.58,nt:16.72,dwt:null,loa:16.00,beam:4.60,depth:2.40,draft:null,lbp:14.00,bhp:186.50,
    licensePax:75,crew:5,fishcrew:null,totalcap:80,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/239-240 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2027-03-09'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2027-03-09'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2026-05-26',renewStatus:'processing'},
    ],
    log:[{id:'sl1',s:'available',from:'2026-04-01',to:null,loc:'Tub Lamu Pier',note:''}]},
  {id:'b2',name:'Artemis',type:'Speedboat',pier:'tublamu',cap:65,
    engineCount:4,use:'บรรทุกคนโดยสาร (เร็ว)',material:'อลูมิเนียม',
    reg:'6051/0199/6',callsign:'HSB7776',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:22.33,nt:15.18,dwt:null,loa:18.00,beam:4.20,depth:1.20,draft:null,lbp:16.00,bhp:186.50,
    licensePax:75,crew:5,fishcrew:null,totalcap:80,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/244 ซอยศักดิเดช 1 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมือง ฯ จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2026-12-17'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2026-12-17'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2026-05-26',renewStatus:'processing'},
      {name:'ใบอนุญาต สุรินทร์',exp:'2026-12-15'},
    ],
    log:[{id:'sl2',s:'available',from:'2026-04-01',to:null,loc:'Tub Lamu Pier',note:''}]},
  {id:'b3',name:'Okeanos',type:'Speedboat',pier:'tublamu',cap:56,
    engineCount:4,use:'บรรทุกคนโดยสาร (เร็ว)',material:'อลูมิเนียม',
    reg:'5951/0151/1',callsign:'',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:27.82,nt:18.92,dwt:null,loa:17.50,beam:3.85,depth:1.97,draft:null,lbp:null,bhp:186.50,
    licensePax:75,crew:4,fishcrew:null,totalcap:79,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/239-240 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2027-01-08'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2027-01-08'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2026-05-26',renewStatus:'processing'},
      {name:'ใบอนุญาต สุรินทร์',exp:'2026-12-15'},
    ],
    log:[{id:'sl3',s:'available',from:'2026-04-01',to:null,loc:'Tub Lamu Pier',note:''}]},
  {id:'b4',name:'Irena',type:'Speedboat',pier:'tublamu',cap:56,
    engineCount:4,use:'บรรทุกคนโดยสาร (เร็ว)',material:'ไฟเบอร์กลาส',
    reg:'6151/0060/9',callsign:'',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:21.22,nt:14.43,dwt:null,loa:17.50,beam:4.00,depth:1.05,draft:null,lbp:17.35,bhp:186.50,
    licensePax:70,crew:5,fishcrew:null,totalcap:75,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/244 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2027-03-09'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2027-03-09'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2027-01-15'},
    ],
    log:[{id:'sl4',s:'available',from:'2026-04-01',to:null,loc:'Tub Lamu Pier',note:''}]},
  {id:'b5',name:'Andaman Ryder',type:'Speedboat',pier:'tublamu',cap:56,
    engineCount:4,use:'บรรทุกคนโดยสาร (เร็ว)',material:'ไฟเบอร์กลาส',
    reg:'5951/0458/5',callsign:'HSB9188',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:30.28,nt:20.59,dwt:null,loa:17.66,beam:3.93,depth:2.12,draft:null,lbp:null,bhp:186.50,
    licensePax:70,crew:5,fishcrew:null,totalcap:75,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ ภูเก็ต',ownerAddr:'9/244 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2026-01-27'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2026-01-27'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2027-01-15'},
      {name:'ใบอนุญาต พีพี',exp:'2025-02-17',renewStatus:'processing'},
    ],
    log:[{id:'sl5',s:'available',from:'2026-04-01',to:null,loc:'Tub Lamu Pier',note:''}]},
  {id:'b6',name:'Zeus',type:'Speedboat',pier:'tublamu',cap:40,
    engineCount:3,use:'บรรทุกคนโดยสาร (เร็ว)',material:'อลูมิเนียม',
    reg:'5951/0127/8',callsign:'HSB7689',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:23.05,nt:15.68,dwt:null,loa:15.60,beam:3.72,depth:1.89,draft:null,lbp:null,bhp:186.50,
    licensePax:47,crew:3,fishcrew:null,totalcap:50,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/239-240 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2026-10-13'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2026-10-13'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2026-05-26',renewStatus:'processing'},
      {name:'ใบอนุญาต สุรินทร์',exp:'2027-01-27'},
    ],
    log:[{id:'sl6',s:'available',from:'2026-04-01',to:null,loc:'Tub Lamu Pier',note:''}]},
  {id:'b7',name:'Verona',type:'Speedboat',pier:'tublamu',cap:34,
    engineCount:3,use:'บรรทุกคนโดยสาร (เร็ว)',material:'ไฟเบอร์กลาส',
    reg:'5951/0064/6',callsign:'',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:18.19,nt:12.37,dwt:null,loa:14.30,beam:3.50,depth:1.70,draft:null,lbp:null,bhp:186.50,
    licensePax:45,crew:3,fishcrew:null,totalcap:48,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/239-240 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2026-10-26'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2026-10-26'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2027-01-15'},
      {name:'ใบอนุญาต สุรินทร์',exp:'2026-12-15'},
    ],
    log:[{id:'sl7',s:'available',from:'2026-04-01',to:null,loc:'Tub Lamu Pier',note:''}]},
  {id:'b8',name:'Tadeo',type:'Speedboat',pier:'tublamu',cap:38,
    engineCount:3,use:'บรรทุกคนโดยสาร (เร็ว)',material:'ไฟเบอร์กลาส',
    reg:'6051/0074/6',callsign:'',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:15.98,nt:10.86,dwt:null,loa:14.72,beam:3.28,depth:1.52,draft:null,lbp:null,bhp:186.50,
    licensePax:47,crew:3,fishcrew:null,totalcap:50,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/244 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2026-12-17'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2026-12-17'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2027-02-24'},
      {name:'ใบอนุญาต สุรินทร์',exp:null,renewStatus:'processing'},
    ],
    log:[{id:'sl8',s:'unavailable',from:'2026-04-01',to:null,loc:'Ranong',note:'ย้ายไปปฏิบัติงานที่ Ranong'}]},
  {id:'b9',name:'Romeo',type:'Speedboat',pier:'tublamu',cap:34,
    engineCount:3,use:'บรรทุกคนโดยสาร (เร็ว)',material:'ไฟเบอร์กลาส',
    reg:'5751/0366/6',callsign:'',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:18.19,nt:12.37,dwt:null,loa:14.30,beam:3.50,depth:1.70,draft:null,lbp:null,bhp:186.50,
    licensePax:45,crew:3,fishcrew:null,totalcap:48,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/239-240 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2026-10-13'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2026-10-13'},
      {name:'ใบอนุญาต สิมิลัน',exp:null,renewStatus:'processing'},
    ],
    log:[]},
  {id:'b10',name:'Aluminous2',type:'Catamaran',pier:'panwa',cap:44,
    engineCount:4,use:'บรรทุกคนโดยสาร (เร็ว)',material:'อลูมิเนียม',
    reg:'6151/0073/3',callsign:'HSB7796',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:29.54,nt:20.09,dwt:null,loa:17.80,beam:4.60,depth:1.50,draft:null,lbp:null,bhp:242.45,
    licensePax:75,crew:5,fishcrew:null,totalcap:80,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ ภูเก็ต',ownerAddr:'9/244 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2025-11-18'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2025-11-18'},
      {name:'ใบอนุญาต สิมิลัน',exp:'2026-05-26',renewStatus:'processing'},
      {name:'ใบอนุญาต พีพี',exp:'2025-02-17',renewStatus:'processing'},
      {name:'ใบอนุญาต อ่าวพังงา',exp:'2025-02-11'},
    ],
    log:[{id:'sl10',s:'available',from:'2026-04-01',to:null,loc:'Visit Panwa',note:''}]},
  {id:'b11',name:'Achilles',type:'Speedboat',pier:'panwa',cap:65,
    engineCount:4,use:'บรรทุกคนโดยสาร (เร็ว)',material:'อลูมิเนียม',
    reg:'6051/0245/5',callsign:'',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:22.33,nt:15.18,dwt:null,loa:18.00,beam:4.20,depth:1.20,draft:null,lbp:16.00,bhp:186.50,
    licensePax:75,crew:5,fishcrew:null,totalcap:80,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ ภูเก็ต',ownerAddr:'9/244 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2026-10-26'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2026-10-26'},
      {name:'ใบอนุญาต สิมิลัน',exp:null,renewStatus:'processing'},
      {name:'ใบอนุญาต พีพี',exp:'2025-02-17',renewStatus:'processing'},
    ],
    log:[{id:'sl11',s:'available',from:'2026-04-01',to:null,loc:'Visit Panwa',note:''}]},
  {id:'b12',name:'Hermetis',type:'Speedboat',pier:'panwa',cap:65,
    engineCount:4,use:'บรรทุกคนโดยสาร (เร็ว)',material:'อลูมิเนียม',
    reg:'6051/0244/7',callsign:'HSB7808',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:22.33,nt:15.18,dwt:null,loa:18.00,beam:4.20,depth:1.20,draft:null,lbp:16.00,bhp:186.50,
    licensePax:75,crew:5,fishcrew:null,totalcap:80,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ ภูเก็ต',ownerAddr:'9/244 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2025-11-18'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2025-11-18'},
      {name:'ใบอนุญาต พีพี',exp:'2025-02-17'},
      {name:'ใบอนุญาต อ่าวพังงา',exp:'2025-08-28'},
    ],
    log:[{id:'sl12',s:'available',from:'2026-04-01',to:null,loc:'Visit Panwa',note:''}]},
  {id:'b13',name:'Oceanus',type:'Speedboat',pier:'panwa',cap:38,
    engineCount:3,use:'บรรทุกคนโดยสาร (เร็ว)',material:'ไฟเบอร์กลาส',
    reg:'6751/0097/8',callsign:'HSB9326',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:19.73,nt:13.41,dwt:null,loa:16.40,beam:3.60,depth:1.80,draft:null,lbp:14.40,bhp:186.50,
    licensePax:45,crew:3,fishcrew:null,totalcap:48,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ ภูเก็ต',ownerAddr:'9/239-240 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2027-01-08'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2027-01-08'},
      {name:'ใบอนุญาต พีพี',exp:'2025-02-17'},
      {name:'ใบอนุญาต อ่าวพังงา',exp:'2025-06-25'},
    ],
    log:[{id:'sl13',s:'available',from:'2026-04-01',to:null,loc:'Visit Panwa',note:''}]},
  {id:'b14',name:'Juliet',type:'Speedboat',pier:'panwa',cap:34,
    engineCount:3,use:'บรรทุกคนโดยสาร (เร็ว)',material:'ไฟเบอร์กลาส',
    reg:'5751/0365/8',callsign:'',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:18.19,nt:12.37,dwt:null,loa:14.30,beam:3.50,depth:1.70,draft:null,lbp:null,bhp:186.50,
    licensePax:45,crew:3,fishcrew:null,totalcap:48,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ ภูเก็ต',ownerAddr:'9/239-240 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2025-08-18'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2025-08-18'},
      {name:'ใบอนุญาต พีพี',exp:'2025-02-17',renewStatus:'processing'},
    ],
    log:[{id:'sl14',s:'available',from:'2026-04-01',to:null,loc:'Visit Panwa',note:''}]},
  {id:'b15',name:'Rolanda',type:'Speedboat',pier:'panwa',cap:38,
    engineCount:3,use:'บรรทุกคนโดยสาร (เร็ว)',material:'ไฟเบอร์กลาส',
    reg:'5951/0442/2',callsign:'HSB7874',imo:'',year:'',homeportCity:'ภูเก็ต',
    gt:15.98,nt:10.86,dwt:null,loa:14.72,beam:3.28,depth:1.52,draft:null,lbp:null,bhp:186.50,
    licensePax:47,crew:3,fishcrew:null,totalcap:50,
    owner:'บริษัท เลิฟ ไอแลนด์ จำกัด',homeport:'ท่าการ พังงา',ownerAddr:'9/244 ถนนศักดิเดช ตำบลลาดเหนือ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต',
    docs:[
      {name:'ใบอนุญาตใช้เรือ',exp:'2025-11-18'},
      {name:'ใบสำคัญรับรองการตรวจเรือ',exp:'2025-11-18'},
      {name:'ใบอนุญาต สิมิลัน',exp:null},
      {name:'ใบอนุญาต พีพี',exp:'2025-02-17'},
    ],
    log:[{id:'sl15',s:'fixing',from:'2026-04-01',to:null,loc:'Thai Marine',note:'ซ่อมตัวเรือ'}]},
];

const LS_KEY = 'loveandaman_v2';
const DATA_VERSION = '2026o';

// ── load / save ──
function loadData(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(raw){
      const d=JSON.parse(raw);
      // 2026-07-10 incident fix: a version-tag mismatch must NEVER reset boats/routes to DEFAULT.
      // boats/routes hold real edits synced from the cloud; a transient missing `version` scalar
      // (relational round-trip after a deploy/restart) used to reset them to seed here, then a save
      // pushed the seed over everyone's data. Always keep the loaded data; DEFAULT only when absent.
      // (A real schema migration, if ever needed, must be an explicit migration — not a blind wipe.)
      return {routes:laApplySort(d.routes||DEFAULT_ROUTES), boats:d.boats||DEFAULT_BOATS, trips:d.trips||{}};
    }
  }catch(e){}
  return {routes:DEFAULT_ROUTES, boats:DEFAULT_BOATS, trips:{}};
}

/* §edit-guard · save() เขียน routes/boats (config) + trips (operations) ปนกัน — guard ตัวเดียวไม่ได้
   จึงรับ area เป็นพารามิเตอร์: call ที่เป็น "user แก้" ส่ง area มา ('config' ตอนแก้โปรแกรม/เรือ ·
   'operations' ตอนจัด Boat Operation) → ถ้า view-only ของ area นั้น จะไม่ persist
   call ภายใน (seed · migration · โหลด) เรียก save() เปล่า → ไม่ถูก guard ทำงานตามปกติ */
function save(area){
  if(area && typeof window.laCanEditArea==='function' && !window.laCanEditArea(area)) return;
  // READ-MODIFY-WRITE: preserve fleet_* fields (managed by flSave) — do NOT clobber the whole key
  try{
    const d = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    d.version=DATA_VERSION; d.routes=ROUTES; d.boats=BOATS; d.trips=TRIPS;
    localStorage.setItem(LS_KEY, JSON.stringify(d));
  }
  catch(e){ console.warn('localStorage save failed',e); }
}

const _loaded = loadData();
let ROUTES = _loaded.routes;
let BOATS  = _loaded.boats;
let TRIPS  = _loaded.trips;

// Auto-cleanup: close any log entries with to=null (set to=from for single-day)
// EXCEPT: 'fixing' logs — keep them open (to=null is intentional for active repair)
// Available/unavailable logs CAN be auto-closed when there's a newer entry
BOATS.forEach(boat=>{
  if(!boat.log)return;
  // Sort by from ASC to find the "latest" open entry of each type
  const sorted=[...boat.log].sort((a,z)=>(a.from||'').localeCompare(z.from||''));
  // For each non-fixing entry: if there's a newer entry, close it before the next one
  sorted.forEach((e,idx)=>{
    if(e.from && !e.to){
      // FIXING entries: always keep open (to:null is intentional)
      if(e.s === 'fixing') return;
      // Available/unavailable: only close if there's a later entry to bound it
      const next = sorted.slice(idx+1).find(x => x.from && x.from > e.from);
      if(next){
        const p=next.from.split('-').map(Number);
        const d=new Date(p[0],p[1]-1,p[2]);
        d.setDate(d.getDate()-1);
        e.to = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      }
      // If no next entry → keep open (current state extends to today)
    }
  });
});

// Seed operations (only if TRIPS is empty)
function seed(){
  // Demo trip seeder — randomly assigns trips to boats for the next ~17 days
  // DISABLED BY DEFAULT to prevent phantom data appearing in Calendar / Boat Operation
  // To re-enable: localStorage.setItem('_demo_trips_seed','1') then refresh
  if(localStorage.getItem('_demo_trips_seed') !== '1') return;
  if(Object.keys(TRIPS).length>0) return;
  const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  for(let d=-3;d<14;d++){
    const ds=dStr(d);
    BOATS.forEach(boat=>{
      const cur=getCurStatus(boat,ds);
      if(cur.s!=='available') return;
      const rPier=ROUTES.filter(r=>r.pier===boat.pier);
      if(!rPier.length) return;
      if(Math.random()<0.25) return;
      if(!TRIPS[ds]) TRIPS[ds]={};
      const r=rPier[rnd(0,rPier.length-1)];
      const types=['early','normal','normal','normal'];
      const booked=rnd(Math.floor(boat.cap*.1),Math.floor(boat.cap*.85));
      TRIPS[ds][boat.id]={
        route:r.id,
        type:types[rnd(0,types.length-1)],
        booked:Math.min(booked,boat.cap)
      };
    });
  }
}
seed();

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
function getCurStatus(boat,ds){
  // §flBoatPersist · วันที่มีผลเท่ากัน ให้ entry ที่บันทึกทีหลังชนะ (ถือเป็นการแก้ไขล่าสุด)
  //   เดิมเรียงด้วย from อย่างเดียว · เสมอกันแล้ว sort คงลำดับเดิม → ของเก่าชนะ
  //   เคสจริง: เริ่มซ่อมวันนี้ แล้วเปลี่ยนเป็น Available วันเดียวกัน จะยังขึ้น Fixing
  const sorted=(boat.log||[]).map((e,i)=>({e,i}))
    .sort((a,b)=> b.e.from.localeCompare(a.e.from) || (b.i-a.i))
    .map(x=>x.e);
  return sorted.find(e=>e.from<=ds&&(!e.to||e.to>=ds))||{s:'available',loc:'-'};
}
function getBoat(id){return BOATS.find(b=>b.id===id);}

// ── Boat color palette ── consistent visual identity across views
// 16 distinct, accessible colors (good contrast on white + light backgrounds)
const BOAT_COLORS = {
  b1:  {bg:'#E6F1FB', text:'#185FA5', soft:'#F0F7FC'},  // Aluminous1   — ocean blue
  b2:  {bg:'#E6F4ED', text:'#0F6E56', soft:'#F0F9F4'},  // Artemis      — sea green
  b3:  {bg:'#FAEEDA', text:'#854F0B', soft:'#FDF6E9'},  // Asher        — sand amber
  b4:  {bg:'#F0E6FB', text:'#5B3FA5', soft:'#F7F2FC'},  // Atlas        — violet
  b5:  {bg:'#FBE9E9', text:'#A32D2D', soft:'#FCF1F1'},  // Aurora       — coral red
  b6:  {bg:'#E1F0F5', text:'#0E5E73', soft:'#EDF6F9'},  // Zeus         — teal
  b7:  {bg:'#F5E6F0', text:'#7B2D63', soft:'#F9EFF5'},  // Verona       — wine plum
  b8:  {bg:'#FFF0E0', text:'#A04E0F', soft:'#FFF7EE'},  // Tadeo        — burnt orange
  b9:  {bg:'#E8F5E1', text:'#3E6E1E', soft:'#F0F9EB'},  // (b9)         — olive green
  b10: {bg:'#E0EAF7', text:'#2D4A8C', soft:'#EBF1F9'},  // Aluminous2   — navy blue
  b11: {bg:'#FCEEEC', text:'#A8331B', soft:'#FDF4F2'},  // (b11)        — rust
  b12: {bg:'#EAE4F7', text:'#4D3989', soft:'#F2EEF9'},  // (b12)        — indigo
  b13: {bg:'#FCEAF3', text:'#A82E73', soft:'#FDF1F7'},  // (b13)        — magenta
  b14: {bg:'#FFEAE0', text:'#B5471F', soft:'#FFF2EB'},  // Juliet       — terra cotta
  b15: {bg:'#E5F0E1', text:'#3F6E2D', soft:'#EDF5EA'},  // (b15)        — forest
  b16: {bg:'#F5EBD9', text:'#7B5C1E', soft:'#FAF3E5'},  // (b16)        — gold
};
function _hexToRgb(h){ if(!h) return null; h=String(h).trim().replace('#',''); if(h.length===3) h=h.split('').map(x=>x+x).join(''); if(h.length!==6) return null; const n=parseInt(h,16); if(isNaN(n)) return null; return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
// §boatInk · ความสว่างสัมพัทธ์ + อัตราส่วนความต่าง (สูตรมาตรฐาน WCAG)
function _relLum(c){ const f=v=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); }
function _cRatio(a,b){ const la=_relLum(a), lb=_relLum(b); return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05); }
function _boatColorFromHex(hex){
  const c=_hexToRgb(hex);
  if(!c) return {bg:'#F4F2EE', text:'#666', soft:'#F8F6F2', raw:'#666'};
  const mixO=a=>({ r:Math.round(c.r*a+255*(1-a)), g:Math.round(c.g*a+255*(1-a)), b:Math.round(c.b*a+255*(1-a)) });
  const css=o=>`rgb(${o.r},${o.g},${o.b})`;
  const bgO=mixO(0.15), softO=mixO(0.06);
  /* §boatInk · ไล่เข้มลงจนอ่านออกบนพื้นของตัวเอง · สีเข้มอยู่แล้วจะไม่เข้าลูปเลย
     ต้องอ่านออกทั้งบนพื้นอ่อน (ป้ายปกติ) และเป็นพื้นตัวเองคู่กับตัวหนังสือขาว (ตอนถูกเลือก) */
  let ink={r:c.r, g:c.g, b:c.b}, n=0;
  while(n<40 && (_cRatio(ink,bgO)<4.5 || _cRatio(ink,{r:255,g:255,b:255})<4.5)){
    ink={ r:Math.round(ink.r*0.92), g:Math.round(ink.g*0.92), b:Math.round(ink.b*0.92) }; n++;
  }
  return {bg:css(bgO), text:css(ink), soft:css(softO), raw:hex};
}
// §per-boat identity colour · editable override (b.color hex) → falls back to the baked BOAT_COLORS, then generic grey · single source used by Boat Asset, Boat Status, By-trip, n8n canvas, job rows
function getBoatColor(boatId){
  const b=(typeof BOATS!=='undefined'&&Array.isArray(BOATS))?BOATS.find(x=>x&&x.id===boatId):null;
  if(b && b.color) return _boatColorFromHex(b.color);
  return BOAT_COLORS[boatId] || {bg:'#F4F2EE', text:'#666', soft:'#F8F6F2'};
}
function getRoute(id){return ROUTES.find(r=>r.id===id);}
function fcClass(pct){return pct>=95?'fb-red':pct>=65?'fb-amber':'fb-green';}
function freeClass(pct){return pct>=95?'full':pct>=70?'warn':'ok';}
function freeColor(pct){return pct>=95?'var(--red)':pct>=70?'#7a4a00':'var(--green-dark)';}
function fillColor(pct){return pct>=85?'var(--red)':pct>=60?'var(--amber)':'var(--green)';}

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
// §Per-user sidebar personalization — accent colour + collapsible groups · stored in
// localStorage keyed by username (per-device, no backend) · only the logged-in user sees theirs.
function laSbUser(){ return (window.LA_ME && (LA_ME.username||LA_ME.name)) || 'guest'; }
const LA_SB_COLORS=['#1683C7','#0F6E56','#D4537E','#854F0B','#534AB7','#A32D2D','#1f2937'];
function laApplySidebarColor(){
  let c=''; try{ c=localStorage.getItem('la_sbcolor_'+laSbUser())||''; }catch(e){}
  let st=document.getElementById('la-sbcolor');
  if(!c){ if(st) st.remove(); }
  else { if(!st){ st=document.createElement('style'); st.id='la-sbcolor'; document.head.appendChild(st); }
    st.textContent='.sidebar .nav-item.active{background:'+c+' !important;border-color:'+c+' !important}.sidebar .nav-item.active svg{color:#fff !important;opacity:1 !important}'; }
  const box=document.getElementById('la-sbcolor-sw'); if(box) box.querySelectorAll('[data-c]').forEach(el=>el.style.boxShadow=(el.getAttribute('data-c')===c?'0 0 0 2px #888':'0 0 0 1px rgba(128,128,128,.35)'));
}
function laSetSidebarColor(c){ try{ localStorage.setItem('la_sbcolor_'+laSbUser(), c); }catch(e){} laApplySidebarColor(); }
function laSbResetColor(){ try{ localStorage.removeItem('la_sbcolor_'+laSbUser()); }catch(e){} laApplySidebarColor(); }
function laSbColorPickerHTML(){
  return '<div style="padding:9px 4px 3px"><div onclick="laSbToggleColorPicker()" style="font-size:10px;color:#8a93a0;letter-spacing:.05em;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px">🎨 สีแท็บ<span id="la-sbcolor-ch" style="margin-left:auto;font-size:10px;opacity:.6;transition:transform .2s">⌄</span></div><div id="la-sbcolor-sw" style="display:none;gap:7px;flex-wrap:wrap;align-items:center;margin-top:8px">'
    + LA_SB_COLORS.map(c=>'<span data-c="'+c+'" onclick="laSetSidebarColor(\''+c+'\')" title="'+c+'" style="width:18px;height:18px;border-radius:50%;background:'+c+';cursor:pointer;box-shadow:0 0 0 1px rgba(128,128,128,.35)"></span>').join('')
    + '<span onclick="laSbResetColor()" title="ค่าเริ่มต้น" style="font-size:13px;color:#9aa3af;cursor:pointer;margin-left:2px">↺</span>'
    + '</div></div>';
}
function laSbToggleColorPicker(){
  const sw=document.getElementById('la-sbcolor-sw'); if(!sw) return;
  const open=(sw.style.display==='none'||!sw.style.display);
  sw.style.display=open?'flex':'none';
  const ch=document.getElementById('la-sbcolor-ch'); if(ch) ch.style.transform=open?'rotate(180deg)':'none';
}
// ── collapsible groups (accordion) · coexists with permission auto-hide (inline display:none wins) ──
function laSbCollapsed(){ try{ return JSON.parse(localStorage.getItem('la_sbacc_'+laSbUser())||'[]'); }catch(e){ return []; } }
function laSbSetCollapsed(a){ try{ localStorage.setItem('la_sbacc_'+laSbUser(), JSON.stringify(a)); }catch(e){} }
function laSbSecItems(sec){ const out=[]; let n=sec.nextElementSibling; while(n && !n.classList.contains('nav-section')){ if(n.classList.contains('nav-item')) out.push(n); n=n.nextElementSibling; } return out; }
function laSbToggleSection(sec){ const lbl=sec.dataset.acclbl||''; if(!lbl) return; let col=laSbCollapsed(); const items=laSbSecItems(sec);
  if(col.indexOf(lbl)>=0){ col=col.filter(x=>x!==lbl); items.forEach(it=>it.classList.remove('acc-hidden')); sec.classList.remove('acc-collapsed'); }
  else { col.push(lbl); items.forEach(it=>it.classList.add('acc-hidden')); sec.classList.add('acc-collapsed'); }
  laSbSetCollapsed(col);
}
function laSbInitAccordion(){
  const col=laSbCollapsed();
  document.querySelectorAll('.sidebar .nav-section').forEach(sec=>{ if(sec.dataset.acc) return;
    sec.dataset.acclbl=(sec.textContent||'').trim().slice(0,40); sec.dataset.acc='1'; sec.style.cursor='pointer';
    if(!sec.querySelector('.acc-ch')){ const ch=document.createElement('span'); ch.className='acc-ch'; ch.textContent='⌄'; ch.style.cssText='margin-left:auto;font-size:11px;opacity:.55;transition:transform .2s'; sec.appendChild(ch); }
    sec.addEventListener('click', function(){ laSbToggleSection(sec); });
    if(col.indexOf(sec.dataset.acclbl)>=0){ laSbSecItems(sec).forEach(it=>it.classList.add('acc-hidden')); sec.classList.add('acc-collapsed'); }
  });
}
/* §pierSub · พับ/กางกลุ่มท่าเรือ · จำสถานะไว้ต่อเครื่อง
   ถ้าเมนูซ้ายย่ออยู่ (รางไอคอน) เมนูย่อยไม่โชว์ กดหัวกลุ่ม = เข้างานแรกของท่านั้นเลย */
function poNavGroupKids(g){ return [].slice.call(document.querySelectorAll('.nav-item.po-sub[data-pogrp="'+g+'"]')); }
function poNavGroup(el){
  var g=el.dataset.pogrp; if(!g) return;
  var sb=document.querySelector('.sidebar');
  var kids=poNavGroupKids(g).filter(function(k){ return k.style.display!=='none'; });
  if(sb && sb.classList.contains('sb-collapsed')){ if(kids[0]) kids[0].click(); return; }
  var col=el.classList.toggle('po-collapsed');
  kids.forEach(function(k){ if(col) k.classList.add('po-hide'); else k.classList.remove('po-hide'); });
  try{ var st=JSON.parse(localStorage.getItem('la_pogrp')||'{}'); st[g]=col?1:0; localStorage.setItem('la_pogrp',JSON.stringify(st)); }catch(_){}
}
function poNavGroupOpen(g){
  var el=document.querySelector('.nav-item.po-grp[data-pogrp="'+g+'"]'); if(!el) return;
  el.classList.remove('po-collapsed');
  poNavGroupKids(g).forEach(function(k){ k.classList.remove('po-hide'); });
  try{ var st=JSON.parse(localStorage.getItem('la_pogrp')||'{}'); st[g]=0; localStorage.setItem('la_pogrp',JSON.stringify(st)); }catch(_){}
}
function poNavGroupInit(){
  var st={}; try{ st=JSON.parse(localStorage.getItem('la_pogrp')||'{}'); }catch(_){}
  document.querySelectorAll('.nav-item.po-grp[data-pogrp]').forEach(function(el){
    var g=el.dataset.pogrp;
    var kids=poNavGroupKids(g);
    if(kids.some(function(k){ return k.classList.contains('active'); })) return;   /* กลุ่มที่กำลังเปิดอยู่ ห้ามพับ */
    if(!st[g]) return;
    el.classList.add('po-collapsed');
    kids.forEach(function(k){ k.classList.add('po-hide'); });
  });
}
function laSbInit(){
  if(!document.getElementById('la-sb-base')){ const s=document.createElement('style'); s.id='la-sb-base';
    s.textContent='.sidebar .nav-item.acc-hidden{display:none !important}.sidebar .nav-section{display:flex;align-items:center}.sidebar .nav-section.acc-collapsed .acc-ch{transform:rotate(-90deg)}';
    document.head.appendChild(s); }
  const foot=document.querySelector('.sidebar .sidebar-footer');
  if(foot && !document.getElementById('la-sbcolor-sw')){ const w=document.createElement('div'); w.innerHTML=laSbColorPickerHTML(); if(w.firstElementChild) foot.parentNode.insertBefore(w.firstElementChild, foot); }
  try{ laSbInitAccordion(); }catch(e){}
  try{ poNavGroupInit(); }catch(e){}
  try{ laApplySidebarColor(); }catch(e){}
}
// ══════════════════════════════════════
function nav(el){
  try{ if(typeof laNavClose==='function') laNavClose(); }catch(e){}   // §mobile · เลือกเมนูแล้วลิ้นชักต้องปิดเอง
  try{ if(typeof laSbInit==='function' && !document.getElementById('la-sbcolor-sw')) laSbInit(); }catch(e){}   // §re-add sidebar picker if a re-render dropped it
  const view=el.dataset.view;
  // fl-boatstatus → unified view-boats
  const actualView=view==='fl-boatstatus'?'boats':view;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  el.classList.add('active');
  const viewEl=document.getElementById('view-'+actualView);
  if(viewEl) viewEl.classList.add('active');
  // fleet views
  if(view.startsWith('fl-')){
    const flView=view.replace('fl-','');
    if(flView==='boatstatus') renderBoats();
    else if(flView==='dashboard') flRenderDashboard();
    else if(flView==='dailyreport') flRenderDR();
    else if(flView==='asset') flRenderAsset();
    else if(flView==='maintenance') flRenderMaint();
    else if(flView==='projects') flRenderProjects();
    else if(flView==='incident') flRenderIncident();
    else if(flView==='inventory') flRenderInventory();
    else if(flView==='consumables') renderConsumables();
    else if(flView==='cost') flRenderCostAnalytics();
    else if(flView==='insights') flRenderInsights();
    else if(flView==='fuel') renderFuelIntel();
  } else {
    if(view==='dashboard') renderDash();
    else if(view==='calendar') renderCal();
    else if(view==='daily') renderDA();
    else if(view==='boats') renderBoats();
    else if(view==='operation') renderOp();
    else if(view==='fleetcal') renderFleetCal();   // §fleetCal
    else if(view==='costing') ctRender();   // §costing
    else if(view==='trippl') renderTripPL();   // §tripPL
    else if(view==='settings') renderSettings();
    else if(view==='agents') renderAgents();
    else if(view==='rate-types') renderRateTypes();
    else if(view==='sales-board') renderSalesBoard();
    else if(view==='b2b-dash') renderB2BDash();
    else if(view==='contract-tmpl') renderContractTemplates();
    else if(view==='b2c') renderB2C();
    else if(view==='booking') renderBooking();
    else if(view==='doccheck') renderDocCheck();
    else if(view==='pickup-setup') renderPickupSetup();
    else if(view==='staff') renderStaff();
    else if(view==='teammkt') renderTeamMkt();
    else if(view==='addonsvc') renderAddonSvc();
    else if(view==='dailypfm') renderDailyPFM();
    else if(view==='vehicles') renderVehicles();
    else if(view==='vanjobs') renderVanJobs();
    else if(view==='vancheckin') renderVanCheckin();
    else if(view==='piercheckin') renderPierCheckin();
    else if(view.indexOf('poa-')===0){ try{ if(el.dataset.pogrp) poNavGroupOpen(el.dataset.pogrp); }catch(_){} renderPierAtt(view.slice(4)); }
    else if(view.indexOf('pol-')===0){ try{ if(el.dataset.pogrp) poNavGroupOpen(el.dataset.pogrp); }catch(_){} renderPierLic(view.slice(4)); }
    else if(view.indexOf('poj-')===0){ try{ if(el.dataset.pogrp) poNavGroupOpen(el.dataset.pogrp); }catch(_){} renderPierJob(view.slice(4)); }
    else if(view.indexOf('po-')===0){ try{ if(el.dataset.pogrp) poNavGroupOpen(el.dataset.pogrp); }catch(_){} renderPierOffice(view.slice(3)); }
    else if(view==='travelsum') renderTravelSum();
    else if(view==='dailyreport') renderDailyReport();
    else if(view==='boatassign') renderBoatAssign();
    else if(view==='accounting') renderAccounting();
    else if(view==='marketdata') renderMarketData();
    else if(view==='focdetail') renderFocDetail();
    else if(view==='insurance') renderInsurance();
    else if(view==='bookingflow') renderBookingFlow();
    else if(view==='pickupmap') renderPickupMap();
    else if(view==='devlog') renderDevLog();
    else if(view==='reconfirm') renderReconfirm();
  }
}
function refreshData(){seed();renderDash();}

// topbar date
function updateDate(){
  document.getElementById('topbar-date').textContent=TODAY.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
function setDashDate(d){
  if(!d) return;
  window._dashDate = d;
  renderDash();
}
function resetDashDate(){
  window._dashDate = TODAY_STR;
  renderDash();
}
// ── Center-card seat-availability calendar (Dashboard) ──
function _dashSeatCalHtml(dx,F){
  var pad=function(n){return String(n).padStart(2,'0');};
  var famFilter=window._dashCalFam||'';
  var month=window._dashCalMonth||(window._dashDate||TODAY_STR).slice(0,7);
  var allRoutes=(typeof ROUTES!=='undefined'?ROUTES:[]);
  var routes=allRoutes.filter(function(r){ return !famFilter || (((typeof bkV2RouteFamily==='function'&&bkV2RouteFamily(r.id))||{}).id===famFilter); });
  var fams={}; allRoutes.forEach(function(r){ var f=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(r.id):null; if(f&&!fams[f.id]) fams[f.id]=f.name; });
  function dayAgg(ds){ var cap=0,free=0,booked=0,has=false,wxN=0; routes.forEach(function(r){
    // respect the program's open/closed schedule (seasons + per-day overrides) — a route marked closed that day is not running
    if(typeof bkV2IsRouteOpenOn==='function' && !bkV2IsRouteOpenOn(r.id,ds)) return;
    // trip cancelled in Boat Operation (weather) — not running, don't count its seats
    if(typeof bkV2IsWeatherClosed==='function' && bkV2IsWeatherClosed(r.id,ds)){ wxN++; return; }
    var al=(typeof getAllotment==='function')?getAllotment(r.id,ds):null; if(al&&al.hasAllotment){ has=true; cap+=al.availableCapacity||0; free+=Math.max(0,al.seatsAvailable||0); booked+=(al.seatsConsumed||0); }
  }); return {cap:cap,free:free,booked:booked,has:has,wxN:wxN}; }
  var yy=parseInt(month.slice(0,4),10), mm=parseInt(month.slice(5,7),10);
  var first=new Date(yy,mm-1,1);
  var startDow=(first.getDay()+6)%7;   // Monday = 0
  var daysIn=new Date(yy,mm,0).getDate();
  var monthLbl=first.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  // INVERTED + 5-TIER (2026-07-08): high occupancy = green (selling well), many free = red (aware)
  var PAL={soldout:['#BCE595','#1F4D2C'],t5:['#CFE9AC','#1F4D2C'],t4:['#E8F5D8','#3B6D11'],t3:['#FAF0C8','#8A6A0B'],t2:['#FBE1C6','#B4600F'],t1:['#FBE9E9','#A32D2D'],none:['#F5F5F2','#b9beb6'],wx:['#F7E7E7','#A32D2D']};
  var cells='';
  for(var i=0;i<startDow;i++) cells+='<div></div>';
  for(var day=1;day<=daysIn;day++){
    var ds=yy+'-'+pad(mm)+'-'+pad(day);
    var a=dayAgg(ds), state;
    if(!a.has){ state=(a.wxN>0)?'wx':'none'; }
    else { if(a.free<=0){ state='soldout'; } else { var pf=a.cap>0?((a.cap-a.free)/a.cap*100):0; state=(pf>=80?'t5':(pf>=60?'t4':(pf>=40?'t3':(pf>=20?'t2':'t1')))); } }
    var col=PAL[state], today=(ds===TODAY_STR);
    var _glass='0 1px 2px rgba(20,45,35,.06),0 5px 12px rgba(20,45,35,.08),inset 0 1px 0 rgba(255,255,255,.55)';
    var ring='box-shadow:'+(today?('inset 0 0 0 2px #0F6E56,'+_glass):_glass)+';border:1px solid rgba(0,0,0,.05);';
    var closedLike=(state==='none'||state==='wx');
    var num=(state==='wx')?'&#9928;':((state==='none')?'&mdash;':a.free);
    var sub=(state==='wx')?'Cancelled':((state==='none')?'Closed':('/'+a.cap+' free'));
    var extraLine='';
    if(!closedLike){ extraLine='<div style="margin-top:3px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">'
        +'<span style="font-size:9px;font-weight:700;color:#1B6AA6;background:#E4EFFA;border-radius:5px;padding:1px 5px;'+F+'">'+a.booked+' pax</span>'
        +(a.wxN>0?'<span style="font-size:8.5px;font-weight:600;color:#A32D2D">&#9928; '+a.wxN+' cxl</span>':'')
      +'</div>'; }
    var click=closedLike?'':(' onclick="bkV2OpenFiltered(\'\',\''+ds+'\')"');
    cells+='<div'+click+' style="'+ring+'background:'+col[0]+';border-radius:11px;min-height:70px;padding:6px 8px;display:flex;flex-direction:column;'+(closedLike?'':'cursor:pointer')+'">'
      +'<div style="font-size:10.5px;font-weight:600;color:'+col[1]+'">'+day+(today?' &middot; Today':'')+'</div>'
      +'<div style="margin-top:auto;display:flex;align-items:baseline;gap:3px"><span style="font-size:'+(state==='wx'?'16':'20')+'px;font-weight:700;color:'+col[1]+';'+F+'">'+num+'</span>'
      +'<span style="font-size:9.5px;color:'+col[1]+';opacity:.75">'+sub+'</span></div>'
      +extraLine+'</div>';
  }
  var chip=function(id,label){ var on=(famFilter===id); return '<span onclick="dashCalSetFam(\''+id+'\')" style="cursor:pointer;font-size:11px;'+(on?'font-weight:600;background:#1C4A30;color:#fff;':'border:1px solid #dfe6da;color:#5a6b5e;')+'padding:4px 12px;border-radius:20px">'+label+'</span>'; };
  var chips=chip('','All'); Object.keys(fams).forEach(function(fid){ chips+=chip(fid,fams[fid]); });
  var wk=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(w){return '<div style="text-align:center;font-size:11px;color:#9aa79d;font-weight:600">'+w+'</div>';}).join('');
  var t=dayAgg(TODAY_STR);
  return '<div style="background:#fff;border-radius:24px;padding:16px 18px;'+F+'box-shadow:0 2px 4px rgba(20,45,35,.06),0 16px 38px rgba(20,45,35,.12),inset 0 1px 0 rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.05)">'
    +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      +'<span style="width:30px;height:30px;border-radius:9px;background:#EAF3DE;display:inline-flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>'
      +'<span style="font-size:16px;font-weight:600;color:#1a2e22">Seats available</span>'
      +'<div style="display:inline-flex;align-items:center;gap:8px;margin-left:2px">'
        +'<span onclick="dashCalMonthShift(-1)" style="cursor:pointer;color:#8a978d;font-size:17px;line-height:1">&#8249;</span>'
        +'<span style="font-size:13px;font-weight:600;color:#3a463f;min-width:96px;text-align:center">'+monthLbl+'</span>'
        +'<span onclick="dashCalMonthShift(1)" style="cursor:pointer;color:#3a463f;font-size:17px;line-height:1">&#8250;</span>'
      +'</div>'
      +'<div style="margin-left:auto;display:flex;gap:5px;flex-wrap:wrap">'+chips+'</div>'
    +'</div>'
    +'<div style="display:flex;gap:16px;margin-bottom:10px;font-size:11px;color:#5a6b5e;flex-wrap:wrap">'
      +'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#CFE9AC;border:1px solid rgba(0,0,0,.12)"></span>Full</span>'
      +'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#E8F5D8;border:1px solid rgba(0,0,0,.12)"></span>Selling</span>'
      +'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#FAF0C8;border:1px solid rgba(0,0,0,.12)"></span>Medium</span>'
      +'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#FBE1C6;border:1px solid rgba(0,0,0,.12)"></span>Under-sold</span>'
      +'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#FBE9E9;border:1px solid rgba(0,0,0,.12)"></span>Many free</span>'
      +'<span style="margin-left:auto;color:#8a978d">free seats / capacity</span>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">'+wk+cells+'</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid #eef1ec">'
      +'<div style="font-size:13px;color:#3a463f"><span style="font-weight:600">Today</span>'+(t.has?' &middot; <span style="font-weight:700;color:#1B6AA6;background:#E4EFFA;border-radius:5px;padding:1px 7px;'+F+'">'+t.booked+' pax booked</span>':'')+'</div>'
      +'<div style="margin-left:auto;font-size:13px;color:#5a6b5e"><span style="font-size:20px;font-weight:700;color:#1a2e22;'+F+'">'+t.free+'</span> / '+t.cap+' seats free</div>'
      +'<button onclick="bkV2OpenFiltered(\'\',\''+TODAY_STR+'\')" style="background:#cdeba0;color:#2c5218;border:none;border-radius:12px;padding:8px 14px;font-size:12.5px;font-weight:600;'+F+'cursor:pointer">Open today</button>'
    +'</div>'
  +'</div>';
}
window.dashCalMonthShift=function(delta){ var m=window._dashCalMonth||(window._dashDate||TODAY_STR).slice(0,7); var yy=parseInt(m.slice(0,4),10),mm=parseInt(m.slice(5,7),10); var d=new Date(yy,mm-1+delta,1); window._dashCalMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); if(typeof renderDash==='function') renderDash(); };
window.dashCalSetFam=function(id){ window._dashCalFam=id||''; if(typeof renderDash==='function') renderDash(); };
window.dashBkSetMode=function(m){ window._dashBkMode=(['day','month','year'].includes(m)?m:'day'); if(typeof renderDash==='function') renderDash(); };

// ── Left-column: Booking notice board + real-time Live feed ──
(function(){ if(document.getElementById('dash-live-anim'))return; try{ var s=document.createElement('style'); s.id='dash-live-anim'; s.textContent='@keyframes dashlvpulse{0%{opacity:.35}50%{opacity:1}100%{opacity:.35}}'; (document.head||document.documentElement).appendChild(s); }catch(e){} })();
function _dashAgo(ts){ if(!ts) return ''; var d=Date.now()-ts; if(d<0)d=0; var s=Math.floor(d/1000); if(s<60)return s+'s'; var m=Math.floor(s/60); if(m<60)return m+'m'; var h=Math.floor(m/60); if(h<24)return h+'h'; return Math.floor(h/24)+'d'; }
function _dashBkTs(bk){ var h=(bk.history||[]).find(function(e){return e.tag==='Created'||e.kind==='created';}); var iso=(h&&h.at)||bk.createdAt||(bk.bookingDate?bk.bookingDate+'T12:00:00':''); var t=iso?Date.parse(iso):0; return isNaN(t)?0:t; }
function _dashDateShort(ds){ try{ return new Date(ds+'T00:00:00').toLocaleDateString('en-GB',{month:'short',day:'numeric'}); }catch(e){ return ds||''; } }
function _dashBoardData(){
  var today=TODAY_STR; var BK=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]); var CXL=['cancelled','rejected','cancelled_weather'];
  var pend=BK.filter(function(b){return b.status==='pending_approval';}).length;
  var wxDates=[]; var wx=BK.filter(function(b){ var ok=b.weatherResolve && b.weatherResolve.status && b.weatherResolve.status!=='resolved' && CXL.indexOf(b.status)<0; if(ok){ (b.trips||[]).forEach(function(t){ if(t.date)wxDates.push(t.date); }); } return ok; }).length;
  wxDates.sort(); var wxDate=wxDates[0]||today;
  var fin=0;
  BK.forEach(function(b){ if(CXL.indexOf(b.status)>=0||b.status==='pending_approval')return; var a=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null; var pt=a?a.payType:''; if(pt!=='invoice'&&pt!=='proforma')return; if(typeof acctBookingPaid==='function'&&acctBookingPaid(b))return; var ds=(b.trips||[]).map(function(t){return t.date;}).filter(Boolean).sort(); if(!ds.length)return; var c=(typeof pfmCutoff==='function')?pfmCutoff(ds[0]):null; if(c&&Date.now()>c.getTime())fin++; });
  var seen={}; BK.forEach(function(b){ if(!b.agentId||seen[b.agentId])return; seen[b.agentId]=1; if(typeof agCreditState==='function'){ var cs=agCreditState(b.agentId); if(cs.limit>0&&cs.available<0)fin++; } });
  var cxl=BK.filter(function(b){ if(CXL.indexOf(b.status)<0)return false; var at=((b.cancellation&&b.cancellation.at)||b.cancelledAt||'').slice(0,10); return at===today; }).length;
  return {pend:pend, wx:wx, wxDate:wxDate, fin:fin, cxl:cxl};
}
function _dashBoardRow(icon, bg, fg, title, sub, n, onclick){
  var active=n>0;
  var chipBg=active?bg:'#F3F2EE', chipFg=active?fg:'#b7b1a6';
  return '<div onclick="'+onclick+'" style="display:flex;align-items:center;gap:10px;padding:8px 9px;border-radius:11px;background:'+(active?'#FBF9F5':'#FAFAF8')+';cursor:pointer">'
    +'<span style="width:26px;height:26px;border-radius:7px;background:'+chipBg+';display:inline-flex;align-items:center;justify-content:center;color:'+chipFg+';flex:none"><i class="ti '+icon+'" style="font-size:15px"></i></span>'
    +'<div style="min-width:0;flex:1"><div style="font-size:12.5px;font-weight:600;color:'+(active?'#1a1a1a':'#9a958c')+'">'+title+'</div><div style="font-size:11px;color:#9a958c">'+sub+'</div></div>'
    +'<span style="font-size:13px;font-weight:700;color:'+(active?fg:'#c3beb4')+';font-family:Manrope,sans-serif">'+n+'</span>'
    +'<i class="ti ti-chevron-right" style="font-size:15px;color:#c3beb4"></i></div>';
}
function _dashBookingBoardHtml(dx,F){
  var d=_dashBoardData(); var total=d.pend+d.wx+d.fin+d.cxl;
  var rows=''
    +_dashBoardRow('ti-clock-hour-4','#FAEEDA','#854F0B','รออนุมัติ','over-cap · discount · FOC',d.pend,'dashGoApprovals()')
    +_dashBoardRow('ti-cloud-storm','#FCEBEB','#A32D2D','ทริป Cancel (weather)','รอ resolve',d.wx,"dashGoBytrip('"+d.wxDate+"')")
    +_dashBoardRow('ti-cash','#EEEDFE','#534AB7','การเงินเสี่ยง','PFM เลย cutoff · เครดิตเกิน',d.fin,'dashGoAccounting()')
    +_dashBoardRow('ti-ban','#F1EFE8','#5F5E5A','ยกเลิกวันนี้','booking ที่ถูกยกเลิก',d.cxl,'dashGoCancels()');
  return '<div style="background:'+dx.card+';border-radius:18px;padding:14px 15px;'+F+'">'
    +'<div style="display:flex;align-items:center;gap:9px;margin-bottom:11px">'
      +'<span style="width:28px;height:28px;border-radius:8px;background:#FBEAEA;display:inline-flex;align-items:center;justify-content:center;color:#A32D2D"><i class="ti ti-bell" style="font-size:16px"></i></span>'
      +'<span style="font-size:14px;font-weight:600;letter-spacing:-.015em;color:#1a1a1a">Booking board</span>'
      +(total>0?'<span style="margin-left:auto;font-size:11px;font-weight:600;color:#A32D2D;background:#FCEBEB;border-radius:20px;padding:2px 9px">'+total+' need action</span>':'<span style="margin-left:auto;font-size:11px;font-weight:600;color:#1C7A43;background:#E7F5EC;border-radius:20px;padding:2px 9px">✓ all clear</span>')
    +'</div>'
    +'<div style="display:flex;flex-direction:column;gap:7px">'+rows+'</div></div>';
}
function _dashLiveFeedHtml(dx,F){
  var BK=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]); var CXL=['cancelled','rejected','cancelled_weather'];
  var arr=BK.filter(function(b){return b.schemaVer===2 && b.status!=='rejected';}).map(function(b){return {b:b, ts:_dashBkTs(b)};});
  arr.sort(function(x,y){return y.ts-x.ts;}); arr=arr.slice(0,12);
  var AV=['#E6F1FB|#185FA5','#EEEDFE|#534AB7','#FCEBEB|#A32D2D','#E7F5EC|#0A6B3F','#FAEEDA|#854F0B','#FBEAF0|#993556'];
  var rows='';
  arr.forEach(function(o,i){ var b=o.b; var a=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null; var nm=a?(a.name||a.code||'Agent'):(b.b2cChannel||'B2C / Walk-in');
    var t0=(b.trips||[])[0]||{}; var fam=(typeof bkV2RouteFamily==='function'&&t0.routeId)?bkV2RouteFamily(t0.routeId):null; var rn=fam?fam.name:(((typeof getRoute==='function'&&t0.routeId)?getRoute(t0.routeId):null)||{}).name||'—';
    var pax=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t0.pax||{}):0; var val=(typeof acctBookingTotal==='function')?acctBookingTotal(b):(b.total||0);
    var ini=(nm||'?').replace(/[^A-Za-z0-9ก-๙ ]/g,'').trim().split(/\s+/).map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()||'?';
    var pair=AV[i%AV.length].split('|'); var isNew=o.ts>0 && (Date.now()-o.ts)<600000; var cx=CXL.indexOf(b.status)>=0;
    rows+='<div onclick="dashOpenBooking(\''+b.id+'\')" style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;border:1px solid '+(isNew?'#CFEBB0':'#eee')+';cursor:pointer;'+(cx?'opacity:.55':'')+'">'
      +'<span style="width:32px;height:32px;border-radius:50%;background:'+pair[0]+';color:'+pair[1]+';display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex:none">'+ini+'</span>'
      +'<div style="min-width:0;flex:1"><div style="font-size:12.5px;font-weight:600;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+nm+' &middot; '+rn+(cx?' <span style="color:#A32D2D">· cancelled</span>':'')+'</div>'
      +'<div style="font-size:11px;color:#9a958c">'+pax+' pax &middot; '+_dashDateShort(t0.date)+' &middot; ฿'+Math.round(val).toLocaleString()+'</div></div>'
      +'<div style="text-align:right;flex:none">'+(isNew?'<span style="font-size:9.5px;font-weight:700;color:#1C7A43;background:#DFF3C4;border-radius:5px;padding:1px 6px">NEW</span>':'')+'<div style="font-size:10.5px;color:#9a958c;margin-top:3px">'+_dashAgo(o.ts)+'</div></div></div>';
  });
  if(!rows) rows='<div style="font-size:12px;color:#9a958c;text-align:center;padding:14px 0">ยังไม่มี booking</div>';
  return '<div style="background:'+dx.card+';border-radius:18px;padding:14px 15px;'+F+'box-shadow:0 1px 2px rgba(20,45,35,.05),0 12px 30px rgba(20,45,35,.11),inset 0 1px 0 rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.05)">'
    +'<div style="display:flex;align-items:center;gap:9px;margin-bottom:11px">'
      +'<span style="width:28px;height:28px;border-radius:8px;background:#E7F5EC;display:inline-flex;align-items:center;justify-content:center;color:#0A6B3F"><i class="ti ti-bolt" style="font-size:16px"></i></span>'
      +'<span style="font-size:14px;font-weight:600;letter-spacing:-.015em;color:#1a1a1a">Live bookings</span>'
      +'<span style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#1C7A43;background:#E7F5EC;border-radius:20px;padding:3px 10px"><span style="width:8px;height:8px;border-radius:50%;background:#2F9E5B;animation:dashlvpulse 1.4s infinite"></span>live</span>'
    +'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'+rows+'</div>'
    +'<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:11px;font-size:10.5px;color:#9a958c"><i class="ti ti-refresh" style="font-size:13px"></i>streams in without refresh</div></div>';
}
window.dashGoApprovals=function(){ var el=document.querySelector('[data-view=booking]'); if(el&&typeof nav==='function')nav(el); if(typeof bkV2SwitchTab==='function')bkV2SwitchTab('approvals'); };
window.dashGoBytrip=function(ds){ if(typeof bkV2OpenFiltered==='function')bkV2OpenFiltered('',ds||TODAY_STR); };
window.dashGoAccounting=function(){ var el=document.querySelector('[data-view=accounting]'); if(el&&typeof nav==='function')nav(el); };
window.dashGoCancels=function(){ var el=document.querySelector('[data-view=booking]'); if(el&&typeof nav==='function')nav(el); if(typeof bkV2SwitchTab==='function')bkV2SwitchTab('all'); };
window.dashOpenBooking=function(id){ var el=document.querySelector('[data-view=booking]'); if(el&&typeof nav==='function')nav(el); if(typeof bkV2OpenDetail==='function')bkV2OpenDetail(id); };

function renderDash(){
  const wrap=document.getElementById('dash-wrap');
  if(!wrap)return;

  // ── Cream + Manrope + brighter lime/forest tokens (match reference) ──
  const dx={bg:'#E8E3DA',card:'#FFFFFF',line:'rgba(0,0,0,.05)',line2:'rgba(0,0,0,.04)',
            ink:'#1A1A1A',ink2:'#666666',ink3:'#8A8A8A',ink4:'#B5B0A6',
            lime:'#A6EB7E',limeBright:'#8FE05F',limeSoft:'#CCF5A2',limePale:'#E2F6C4',
            forest:'#0A6B3F',forestDark:'#064A2A',forestLight:'#3F8E16',
            coral:'#F0792B',coralBg:'#F7AE8C',coralDeep:'#8A2B0A',
            yellow:'#F2E534',blue:'#A8D6F7',blueDeep:'#0C447C',
            soft:'#F2EFE8',black:'#1A1A1A',brown:'#27201A',brownDark:'#1A140F',brownText:'#F5EFE5',brownMute:'#9B9590'};
  const F="font-family:Manrope,-apple-system,system-ui,sans-serif;";
  const GLASS="box-shadow:0 1px 2px rgba(20,45,35,.05),0 12px 30px rgba(20,45,35,.11),inset 0 1px 0 rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.05);";

  // ── Selected date state — Dashboard shows data for this date ──
  const _ds = window._dashDate || TODAY_STR;
  const _dsAt = (offset)=>{
    const d = new Date(_ds);
    d.setDate(d.getDate()+offset);
    return d.toISOString().slice(0,10);
  };

  // ── Aggregate today ──
  const ops=TRIPS[_ds]||{};
  let totAllot=0,totBooked=0;
  const routeData={};
  const _seatRoutesD=new Set();
  const _capBoatsD=new Set();
  Object.entries(ops).forEach(([bid,op])=>{
    if(!op.route) return;
    const b=getBoat(bid); if(!b) return;
    if(getCurStatus(b,_ds).s!=='available') return;
    const r=getRoute(op.route); if(!r) return;
    const _s=(typeof getDayStatus==='function')?getDayStatus(r,_ds):null;
    if(_s && _s.type==='closed') return;
    totAllot+=b.cap; _capBoatsD.add(bid);
    if(!routeData[op.route]) routeData[op.route]={allot:0,booked:0,r};
    routeData[op.route].allot+=b.cap;
    const _isCharter = op.type==='charter' || op.charterBookingId;
    if(_isCharter){ const _bk=op.booked||0; totBooked+=_bk; routeData[op.route].booked+=_bk; }
    else { _seatRoutesD.add(op.route); }
  });
  // bookings → routes/boats not in TRIPS (assigned via booking only) — count both capacity + booked so the card matches the chart
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(bk=>{
    if(['cancelled','rejected','cancelled_weather'].includes(bk.status)) return;
    if(bk.schemaVer!==2 || !Array.isArray(bk.trips)) return;
    bk.trips.forEach(t=>{
      if((t.date||'')!==_ds || t.bookingMode==='charter') return;
      const rid=t.routeId; if(!rid) return;
      const r=getRoute(rid); if(!r) return;
      const _s=(typeof getDayStatus==='function')?getDayStatus(r,_ds):null;
      if(_s && _s.type==='closed') return;
      if(!_seatRoutesD.has(rid) && (!routeData[rid])) { _seatRoutesD.add(rid); routeData[rid]={allot:0,booked:0,r}; }
      const abid=bk.ops&&bk.ops.boatId;
      if(abid && !_capBoatsD.has(abid)){ const ab=getBoat(abid); if(ab){ totAllot+=(ab.cap||0); _capBoatsD.add(abid); if(routeData[rid]) routeData[rid].allot+=(ab.cap||0); } }
    });
  });
  // seat routes → booked from actual sales (SB_BOOKINGS · once per route) so it matches the chart
  _seatRoutesD.forEach(rid=>{ const sc=(typeof getSeatsConsumed==='function')?getSeatsConsumed(rid,_ds):0; totBooked+=sc; if(routeData[rid]) routeData[rid].booked+=sc; });
  const totFree=totAllot-totBooked;
  const fillPct=totAllot>0?Math.round(totBooked/totAllot*100):0;
  const companyBoats=BOATS.filter(b=>!b.retired);
  const activeBoats=Object.entries(ops).filter(([bid,op])=>{
    if(!op.route) return false;
    const b=getBoat(bid); if(!b) return false;
    return getCurStatus(b,_ds).s==='available';
  }).length;
  const availTotal=companyBoats.filter(b=>getCurStatus(b,_ds).s==='available').length;
  const fixCount=companyBoats.filter(b=>getCurStatus(b,_ds).s==='fixing').length;
  const unavailCount=companyBoats.filter(b=>getCurStatus(b,_ds).s==='unavailable').length;

  // Fleet score = utilization (boats operating ÷ boats ready × 100)
  const operatingCount=Object.entries(ops).filter(([bid,op])=>{
    if(!op.route) return false;
    const b=getBoat(bid); if(!b) return false;
    if(getCurStatus(b,_ds).s!=='available') return false;
    const r=getRoute(op.route); if(!r) return false;
    const _s=(typeof getDayStatus==='function')?getDayStatus(r,_ds):null;
    if(_s && _s.type==='closed') return false;
    return true;
  }).length;
  const fleetScore=availTotal>0?Math.min(100,Math.round(operatingCount/availTotal*100)):0;
  const fleetLabel=fleetScore>=90?'Excellent':fleetScore>=70?'Good':fleetScore>=50?'Fair':availTotal===0?'No fleet':'Watch';
  const fmtN=(n)=>(n||0).toLocaleString();

  // Best / Idle routes
  const routeEntries=Object.values(routeData).map(s=>({...s,pct:s.allot?s.booked/s.allot*100:0}));
  const bestRoute=routeEntries.slice().sort((a,b)=>b.pct-a.pct)[0];
  let idleRoute=null;
  for(const r of ROUTES){
    const _s=(typeof getDayStatus==='function')?getDayStatus(r,_ds):null;
    if(_s && _s.type==='closed'){ idleRoute={r,closed:true}; break; }
  }
  if(!idleRoute){
    const sorted=routeEntries.slice().sort((a,b)=>a.pct-b.pct);
    if(sorted.length) idleRoute={r:sorted[0].r,pct:sorted[0].pct,closed:false};
  }
  const shortName=(n)=>n.replace('Phi Phi Bamboo by Speedboat','Phi Phi Spd').replace('Whale Shark Phi Phi Maiton Sunset','Whale Shark').replace('Early OTA Phi Phi Bamboo','E.OTA Phi Phi').replace('Early SY Phi Phi Bamboo','E.SY Phi Phi').replace('Phi Phi Bamboo - FS','Phi Phi FS').replace('Early Krabi + Phang Nga','E.Krabi+PgNga').replace('Similan Islands by Speedboat','Similan Spd').replace('Similan Islands by Catamaran','Similan Cat').replace('Surin Islands by Speedboat','Surin Spd').replace('Early Tratato Similan Islands','E.Tratato').replace('Early Tiger Similan Islands','Early Tiger').replace('Similan Islands - PG','Similan PG');

  // Yesterday vs today delta (same reality filter as today)
  const yDs=_dsAt(-1);
  const yOps=TRIPS[yDs]||{};
  let yBooked=0; const _ySeat=new Set();
  Object.entries(yOps).forEach(([bid,op])=>{
    if(!op.route) return;
    const b=getBoat(bid); if(!b) return;
    if(getCurStatus(b,yDs).s!=='available') return;
    const r=getRoute(op.route); if(!r) return;
    const _s=(typeof getDayStatus==='function')?getDayStatus(r,yDs):null;
    if(_s && _s.type==='closed') return;
    const _isC=op.type==='charter'||op.charterBookingId;
    if(_isC) yBooked+=(op.booked||0); else _ySeat.add(op.route);
  });
  _ySeat.forEach(rid=>{ yBooked+=(typeof getSeatsConsumed==='function')?getSeatsConsumed(rid,yDs):0; });
  const deltaSeats=totBooked-yBooked;
  const deltaPct=yBooked>0?Math.round(Math.abs(deltaSeats)/yBooked*100):(totBooked>0?100:0);
  const deltaSign=deltaSeats>=0;

  // ── Bookings overview — reusable per-day aggregation (day / month / year modes) ──
  const _bkDay=(ds)=>{
    const dOps=TRIPS[ds]||{};
    let booked=0, capacity=0, charter=0;
    const routeBooked={};
    const _seatRoutes=new Set();   // seat-mode routes operating this day (count via actual sales bookings, once per route)
    const _capBoats=new Set();     // boats already counted toward capacity (avoid double-count)
    Object.entries(dOps).forEach(([bid,op])=>{
      if(!op.route) return;
      const b=getBoat(bid); if(!b) return;
      if(getCurStatus(b,ds).s!=='available') return;
      const r=getRoute(op.route); if(!r) return;
      const _s=(typeof getDayStatus==='function')?getDayStatus(r,ds):null;
      if(_s && _s.type==='closed') return;
      capacity+=(b.cap||0); _capBoats.add(bid);
      const isCharter = op.type==='charter' || op.charterBookingId;
      // ⚠ Boat-Op charter ops carry pax on the sales booking (op.booked is usually 0). A LINKED charter
      // (has charterBookingId) is counted from SB_BOOKINGS below (real pax) — only an UNLINKED manual
      // Boat-Op charter falls back to op.booked. Boat capacity is already counted above either way.
      if(isCharter){ if(!op.charterBookingId) charter+=(op.booked||0); }
      else { _seatRoutes.add(op.route); }
    });
    // Seat bookings from actual sales (SB_BOOKINGS v2 + legacy) · once per route
    _seatRoutes.forEach(rid=>{
      const sc=(typeof getSeatsConsumed==='function')?getSeatsConsumed(rid,ds):0;
      booked+=sc; routeBooked[rid]=(routeBooked[rid]||0)+sc;
    });
    // Weather-cancelled routes this day (Boat-Op weather closures) → surfaced as a marker, not counted
    let wx=0;
    (typeof ROUTES!=='undefined'?ROUTES:[]).forEach(r=>{ if(typeof bkV2IsWeatherClosed==='function' && bkV2IsWeatherClosed(r.id,ds)) wx++; });
    // Bookings on this day → seat demand + charter pax + capacity of the boat each booking actually rides
    (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(bk=>{
      if(['cancelled','rejected','cancelled_weather'].includes(bk.status)) return;
      if(bk.schemaVer!==2 || !Array.isArray(bk.trips)) return;
      bk.trips.forEach(t=>{
        if((t.date||'')!==ds) return;
        const rid=t.routeId; if(!rid) return;
        const r=getRoute(rid); if(!r) return;
        if(t.bookingMode==='charter'){
          // charter pax always from the sales booking (source of truth) — counts even if seat-season closed
          charter+=(typeof bkV2PaxAllTot==='function'?bkV2PaxAllTot(t.pax||{}):0);
          // §boatSplit · เหมา 1 ใบอาจกินหลายลำ · เดิมนับความจุแค่ลำแรก
          let _cbids=(typeof bkBoatIdsOn==='function')?bkBoatIdsOn(bk,ds):[];
          if(!_cbids.length){ const _one=t.charterBoatId||(bk.ops&&bk.ops.boatId); if(_one) _cbids=[_one]; }
          _cbids.forEach(cbid=>{ if(cbid && !_capBoats.has(cbid)){ const cb=getBoat(cbid); if(cb){ capacity+=(cb.cap||0); _capBoats.add(cbid); } } });
          return;
        }
        const _s=(typeof getDayStatus==='function')?getDayStatus(r,ds):null;
        if(_s && _s.type==='closed') return;   // off-season / closed → don't count seat demand
        if(!_seatRoutes.has(rid) && routeBooked[rid]==null){
          _seatRoutes.add(rid);
          const sc=(typeof getSeatsConsumed==='function')?getSeatsConsumed(rid,ds):0;
          booked+=sc; routeBooked[rid]=(routeBooked[rid]||0)+sc;
        }
        const abid=bk.ops&&bk.ops.boatId;
        if(abid && !_capBoats.has(abid)){
          const ab=getBoat(abid);
          if(ab){ capacity+=(ab.cap||0); _capBoats.add(abid); }
        }
      });
    });
    return {ds,booked,capacity,routeBooked,charter,wx};
  };
  const CHARTER_COLOR='#B69CE8';   // distinct purple for the Charter (เหมาลำ) segment
  // Active mode — 'day' (today · bar per route) | 'month' (30 days · stacked) | 'year' (12 months · stacked)
  const _bkMode = ['day','month','year'].includes(window._dashBkMode) ? window._dashBkMode : 'day';
  const _todayDS = _dsAt(0);
  const bkBuckets=[];   // {dt, booked, capacity, routeBooked, isToday}
  if(_bkMode==='day'){
    const a=_bkDay(_todayDS); bkBuckets.push({...a, dt:new Date(_todayDS), isToday:true});
  } else if(_bkMode==='month'){
    for(let d=-29;d<=0;d++){ const a=_bkDay(_dsAt(d)); bkBuckets.push({...a, dt:new Date(a.ds), isToday:d===0}); }
  } else { // year — last 12 calendar months (sum of days, per route)
    const anchor=new Date(_ds);
    for(let mOff=-11;mOff<=0;mOff++){
      const md=new Date(anchor.getFullYear(), anchor.getMonth()+mOff, 1);
      const y=md.getFullYear(), mo=md.getMonth();
      let booked=0, capacity=0, charter=0, wx=0; const routeBooked={};
      const nDays=new Date(y,mo+1,0).getDate();
      for(let dd=1;dd<=nDays;dd++){
        const ds=y+'-'+String(mo+1).padStart(2,'0')+'-'+String(dd).padStart(2,'0');
        if(ds>_todayDS) break;   // don't count future days
        const a=_bkDay(ds); booked+=a.booked; capacity+=a.capacity; charter+=a.charter; wx+=a.wx;
        Object.entries(a.routeBooked).forEach(([rid,v])=>routeBooked[rid]=(routeBooked[rid]||0)+v);
      }
      bkBuckets.push({dt:md, booked, capacity, routeBooked, charter, wx, isToday:mOff===0});
    }
  }
  // total pax per bucket = seat booked + charter
  bkBuckets.forEach(b=>{ b.tot=(b.booked||0)+(b.charter||0); });
  // Route totals over the active period → top 3 + Other
  const routeWeekTotals={};
  bkBuckets.forEach(bt=>Object.entries(bt.routeBooked).forEach(([rid,v])=>routeWeekTotals[rid]=(routeWeekTotals[rid]||0)+v));
  const topRouteIds=Object.entries(routeWeekTotals).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
  const otherRouteIds=Object.keys(routeWeekTotals).filter(id=>!topRouteIds.includes(id));
  const otherWeekTotal=otherRouteIds.reduce((s,id)=>s+routeWeekTotals[id],0);
  const charterWeekTotal=bkBuckets.reduce((s,d)=>s+(d.charter||0),0);
  const wxWeekTotal=bkBuckets.reduce((s,d)=>s+(d.wx||0),0);
  // Fixed palette so segments stay readable on forest green
  const segPalette=['#B8E89A','#F5E84F','#F4B89F','#9FB89E'];
  const topRoutes=topRouteIds.map((id,i)=>({id,r:getRoute(id),total:routeWeekTotals[id],color:segPalette[i]}));
  const trendMax=Math.max(...bkBuckets.map(d=>Math.max(d.capacity,d.tot)),1);
  const totalBookedWeek=bkBuckets.reduce((s,d)=>s+d.tot,0);
  const totalCapWeek=bkBuckets.reduce((s,d)=>s+d.capacity,0);
  const fillWeekPct=totalCapWeek>0?Math.round(totalBookedWeek/totalCapWeek*100):0;
  // Peak / slow bucket by fill % (month/year only) + avg per bucket
  const bktFills=bkBuckets.map(d=>({dt:d.dt,booked:d.tot,cap:d.capacity,pct:d.capacity>0?Math.round(d.tot/d.capacity*100):0}));
  const bktsWithCap=bktFills.filter(d=>d.cap>0);
  const bestDay=bktsWithCap.length?bktsWithCap.reduce((b,c)=>c.pct>b.pct?c:b,bktsWithCap[0]):null;
  const slowDay=bktsWithCap.length?bktsWithCap.reduce((b,c)=>c.pct<b.pct?c:b,bktsWithCap[0]):null;
  const avgPerDay=Math.round(totalBookedWeek/Math.max(1,bkBuckets.length));
  const topRouteWeek=topRoutes[0]||null;

  // Ticker per pier (today vs yesterday)
  const pierBookedToday={tublamu:0,panwa:0,ranong:0};
  const pierBookedY={tublamu:0,panwa:0,ranong:0};
  Object.entries(ops).forEach(([bid,op])=>{
    if(!op.route) return;
    const r=getRoute(op.route); if(!r) return;
    const b=getBoat(bid); if(!b) return;
    if(getCurStatus(b,_ds).s!=='available') return;
    if(pierBookedToday[r.pier]!=null) pierBookedToday[r.pier]+=(op.booked||0);
  });
  Object.entries(yOps).forEach(([bid,op])=>{
    if(!op.route) return;
    const r=getRoute(op.route); if(!r) return;
    const b=getBoat(bid); if(!b) return;
    if(getCurStatus(b,yDs).s!=='available') return;
    const _s=(typeof getDayStatus==='function')?getDayStatus(r,yDs):null;
    if(_s && _s.type==='closed') return;
    if(pierBookedY[r.pier]!=null) pierBookedY[r.pier]+=(op.booked||0);
  });
  const tickerCells=[
    {lbl:'TL',d:(()=>{const y=pierBookedY.tublamu||0;return y>0?Math.round((pierBookedToday.tublamu-y)/y*100):(pierBookedToday.tublamu>0?100:0);})(),unit:'%'},
    {lbl:'VP',d:(()=>{const y=pierBookedY.panwa||0;return y>0?Math.round((pierBookedToday.panwa-y)/y*100):(pierBookedToday.panwa>0?100:0);})(),unit:'%'},
    {lbl:'RN',d:(()=>{const y=pierBookedY.ranong||0;return y>0?Math.round((pierBookedToday.ranong-y)/y*100):(pierBookedToday.ranong>0?100:0);})(),unit:'%'},
    {lbl:'SHOP',d:fixCount,unit:''}
  ];

  // Operating boats — keep top 2 for compact list + count remaining for "+N more" chip
  // per-route consumed seats (real sales) · allocated across that route's boats (fill first → overflow)
  const _routePool={};
  const opBoatsAll=Object.entries(ops).filter(([bid,op])=>{
    if(!op.route) return false;
    const b=getBoat(bid); if(!b) return false;
    if(getCurStatus(b,_ds).s!=='available') return false;
    const r=getRoute(op.route); if(!r) return false;
    const _s=(typeof getDayStatus==='function')?getDayStatus(r,_ds):null;
    if(_s && _s.type==='closed') return false;
    return true;
  }).map(([bid,op])=>{
    const b=getBoat(bid); const r=getRoute(op.route);
    const _isCharter = op.type==='charter' || op.charterBookingId;
    let bk;
    if(_isCharter){ bk=op.booked||0; }
    else {
      if(_routePool[op.route]==null) _routePool[op.route]=(typeof getSeatsConsumed==='function')?getSeatsConsumed(op.route,_ds):0;
      bk=Math.min(b.cap, _routePool[op.route]); _routePool[op.route]-=bk;   // allocate this boat's share
    }
    const free=b.cap-bk;
    const pct=b.cap>0?Math.round(bk/b.cap*100):0;
    return {bid,b,r,booked:bk,cap:b.cap,free,pct};
  }).sort((a,b)=>b.pct-a.pct);
  const opBoats=opBoatsAll;

  // ── Aggregate for new layout ──
  // Active maintenance — newest in-progress job
  const activeMaint=(FL_MAINT||[]).filter(m=>m.status!=='done').sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''))[0];
  const activeMaintBoat=activeMaint?BOATS.find(b=>b.id===activeMaint.boatId):null;
  const activeMaintCnt=(FL_MAINT||[]).filter(m=>m.status!=='done').length;

  // Next document renewal + alert counts
  let nextDoc=null, docExpired=0, docExpiring=0;
  BOATS.forEach(b=>{
    if(b.retired||b.ownership==='charter') return;
    (b.docs||[]).forEach(d=>{
      if(!d.exp) return;
      const expD=new Date(d.exp); if(isNaN(expD.getTime())) return;
      const days=Math.floor((expD-new Date(_ds))/86400000);
      if(days<0){ docExpired++; return; } // expired = alert, skip for nextDoc
      if(days<=60) docExpiring++;
      if(!nextDoc || days<nextDoc.days) nextDoc={boat:b,doc:d,exp:d.exp,days};
    });
  });

  // Pending memos (awaiting approval)
  const memosPending=(FL_MEMOS||[]).filter(m=>m.status==='pending_approval');
  // Documents — count all
  let docTotal=0;
  BOATS.forEach(b=>{ if(!b.retired&&b.ownership!=='charter') docTotal+=(b.docs||[]).length; });

  // ── HTML pieces ──
  const seg=`<div style="display:flex;justify-content:center;margin-bottom:14px">
    <div style="display:inline-flex;background:${dx.card};border:1px solid ${dx.line};border-radius:14px;padding:3px;gap:2px;${F}">
      <button style="background:${dx.forest};color:#FFFFFF;border:none;border-radius:11px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer;${F}letter-spacing:-.005em">Today</button>
      <button onclick="nav(document.querySelector('[data-view=calendar]'))" style="background:transparent;color:${dx.ink2};border:none;border-radius:11px;padding:7px 16px;font-size:12px;font-weight:500;cursor:pointer;${F}letter-spacing:-.005em">Week</button>
    </div>
  </div>`;

  // Shared date helpers
  const EN_MON_S=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WD_EN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayDt=new Date(_ds);

  // ─── LEFT COLUMN ───
  // Clickable date row · opens native picker · changes Dashboard date
  const EN_MON_LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const WD_EN_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayLabel=`${WD_EN_LONG[todayDt.getDay()]}, ${EN_MON_LONG[todayDt.getMonth()]} ${todayDt.getDate()}`;
  const isToday=_ds===TODAY_STR;
  const profile=`<div onclick="(function(el){var i=el.querySelector('#dash-date-picker');if(!i){console.warn('[Dash] input not found');return;}try{if(typeof i.showPicker==='function'){i.showPicker();return;}}catch(e){console.warn('[Dash] showPicker threw',e);}i.focus();})(this)" style="padding:6px 8px;display:flex;align-items:center;gap:10px;border-radius:12px;cursor:pointer;${F}" onmouseover="this.style.background='rgba(255,255,255,.4)'" onmouseout="this.style.background='transparent'">
    <span style="width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;color:${dx.forest};flex-shrink:0">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    </span>
    <div style="flex:1;min-width:0">
      <div style="font-size:10px;color:${dx.coral};font-weight:600;letter-spacing:.06em;text-transform:uppercase">${WD_EN[todayDt.getDay()]} · ${EN_MON_S[todayDt.getMonth()]} ${todayDt.getDate()}${isToday?'':' · Selected'}</div>
      <div style="font-size:13px;font-weight:600;letter-spacing:-.01em;color:${dx.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${todayLabel}</div>
    </div>
    ${!isToday?`<button onclick="event.stopPropagation();resetDashDate()" style="background:${dx.soft};border:none;border-radius:8px;padding:3px 9px;font-size:10px;font-weight:600;color:${dx.forest};cursor:pointer;flex-shrink:0;${F}" title="กลับมาวันนี้">Today</button>`:''}
    <input id="dash-date-picker" type="date" value="${_ds}" onchange="setDashDate(this.value)" style="position:absolute;width:0;height:0;padding:0;border:0;margin:0;opacity:0;pointer-events:none">
  </div>`;

  const TH_MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const fmtTodoDate=(ds)=>{const d=new Date(ds);return `${d.getDate()} ${TH_MON[d.getMonth()]}`;};

  // Boat Operating stats card (replaces To do list)
  // Per-pier breakdown
  const pierStats={tublamu:{name:'Tub Lamu',short:'TL',color:'#185FA5',op:0,allot:0,booked:0},
                   panwa:{name:'Visit Panwa',short:'VP',color:'#0F6E56',op:0,allot:0,booked:0}};
  opBoatsAll.forEach(ob=>{
    const p=ob.r.pier;
    if(pierStats[p]){
      pierStats[p].op++;
      pierStats[p].allot+=ob.cap;
      pierStats[p].booked+=ob.booked;
    }
  });
  const pierRows=Object.values(pierStats).filter(p=>p.op>0||p.allot>0).map(p=>{
    const free=p.allot-p.booked;
    const pct=p.allot>0?Math.round(p.booked/p.allot*100):0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid ${dx.line2}">
      <div style="width:26px;height:26px;border-radius:50%;background:${p.color};color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${p.short}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:${dx.ink}">${p.name}</div>
        <div style="font-size:10px;color:${dx.ink3};margin-top:1px">${p.op} boat${p.op>1?'s':''} · ${pct}% fill</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:600;color:${dx.forest};font-variant-numeric:tabular-nums">${free}</div>
        <div style="font-size:9px;color:${dx.ink3}">free / ${p.allot}</div>
      </div>
    </div>`;
  }).join('');
  const todoCard=`<div style="background:${dx.card};border-radius:18px;padding:14px 15px;${F}${GLASS}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px">
      <span style="font-size:14px;font-weight:600;letter-spacing:-.015em">Boat Operating</span>
      <span style="background:${dx.limeSoft};color:${dx.forestLight};padding:2px 8px;border-radius:8px;font-size:9.5px;font-weight:600;font-variant-numeric:tabular-nums">Today</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:6px">
      <div style="background:${dx.blue};border-radius:10px;padding:9px 10px">
        <div style="font-size:8.5px;color:${dx.blueDeep};font-weight:600;letter-spacing:.05em;text-transform:uppercase">Boats</div>
        <div style="font-size:18px;font-weight:700;color:${dx.blueDeep};line-height:1;margin-top:4px;font-variant-numeric:tabular-nums">${operatingCount}</div>
        <div style="font-size:9px;color:${dx.blueDeep};margin-top:2px">/ ${availTotal} ready</div>
      </div>
      <div style="background:${dx.soft};border-radius:10px;padding:9px 10px">
        <div style="font-size:8.5px;color:${dx.ink2};font-weight:600;letter-spacing:.05em;text-transform:uppercase">Fill</div>
        <div style="font-size:18px;font-weight:700;color:${dx.ink};line-height:1;margin-top:4px;font-variant-numeric:tabular-nums">${fillPct}<span style="font-size:11px;font-weight:500;color:${dx.ink3}">%</span></div>
        <div style="font-size:9px;color:${dx.ink3};margin-top:2px">${totBooked}/${totAllot}</div>
      </div>
      <div style="background:${dx.soft};border-radius:10px;padding:9px 10px">
        <div style="font-size:8.5px;color:${dx.ink2};font-weight:600;letter-spacing:.05em;text-transform:uppercase">Free</div>
        <div style="font-size:18px;font-weight:700;color:${dx.coral};line-height:1;margin-top:4px;font-variant-numeric:tabular-nums">${totFree}</div>
        <div style="font-size:9px;color:${dx.ink3};margin-top:2px">seats left</div>
      </div>
    </div>
    ${pierRows||`<div style="padding:12px 4px 2px;text-align:center;font-size:10.5px;color:${dx.ink3};border-top:1px solid ${dx.line2}">ไม่มีเรือออกวันนี้</div>`}
  </div>`;

  // Boats operating today card (replaces Notifications)
  const opBoatColor=(idx)=>['#9FB89E','#C4A874','#A8C8D8','#D4B89F','#B4D4A0','#C8A8D8'][idx%6];
  const opBoatRows=opBoatsAll.slice(0,5).map((ob,i)=>{
    const fillColor=ob.pct>=95?dx.coralDeep:ob.pct>=70?dx.coral:dx.forestLight;
    const inits=ob.b.name.slice(0,2).toUpperCase();
    return `<div onclick="nav(document.querySelector('[data-view=op]'))" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:${i?'1px solid '+dx.line2:'none'};cursor:pointer">
      <div style="width:30px;height:30px;border-radius:50%;background:${opBoatColor(i)};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${inits}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:${dx.ink};letter-spacing:-.005em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ob.b.name}</div>
        <div style="font-size:10px;color:${dx.ink3};margin-top:1px">${ob.r.pier==='panwa'?'VP':ob.r.pier==='tublamu'?'TL':'RN'} · ${ob.r.name.length>22?ob.r.name.slice(0,21)+'…':ob.r.name}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:600;color:${fillColor};font-variant-numeric:tabular-nums;letter-spacing:-.005em">${ob.free}</div>
        <div style="font-size:9px;color:${dx.ink3}">free / ${ob.cap}</div>
      </div>
    </div>`;
  }).join('');
  const moreOps=Math.max(0,opBoatsAll.length-5);
  const notifCard=`<div style="background:${dx.card};border-radius:18px;padding:12px 15px;${F}${GLASS}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
      <span style="font-size:13px;font-weight:600;letter-spacing:-.015em">Boats operating</span>
      <span style="background:${dx.limeSoft};color:${dx.forestLight};padding:2px 7px;border-radius:7px;font-size:9.5px;font-weight:600;font-variant-numeric:tabular-nums">${opBoatsAll.length}</span>
    </div>
    ${opBoatRows||`<div style="padding:12px 4px;text-align:center;font-size:10.5px;color:${dx.ink3}">No boats operating today</div>`}
    ${moreOps>0?`<div onclick="nav(document.querySelector('[data-view=op]'))" style="margin-top:6px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10px;color:${dx.ink2};cursor:pointer"><span style="background:${dx.soft};color:${dx.forestLight};padding:1px 7px;border-radius:7px;font-weight:600;font-variant-numeric:tabular-nums">+${moreOps}</span> more boats <span style="opacity:.5;font-size:13px">›</span></div>`:''}
  </div>`;

  // leftCol assembled below (after sched + filesCard are defined)

  // ─── CENTER COLUMN ───
  // Hero card — today's best route
  const heroRoute=bestRoute?bestRoute.r:null;
  const heroBoats=opBoatsAll.filter(o=>heroRoute&&o.r&&o.r.id===heroRoute.id).slice(0,3);
  const heroAvatars=heroBoats.map((o,i)=>`<div style="width:26px;height:26px;border-radius:50%;background:${['#9FB89E','#C4A874','#A8C8D8'][i%3]};border:2px solid #fff;margin-left:${i?'-9px':'0'}"></div>`).join('');
  const heroBoatNames=heroBoats.map(o=>o.b.name).join(', ');
  const heroTotalFree=heroBoats.reduce((s,o)=>s+o.free,0);
  const heroTotalCap=heroBoats.reduce((s,o)=>s+o.cap,0);
  const hero=`<div style="background:${dx.card};border-radius:24px;padding:14px;${F}">
    <div style="position:relative;height:330px;background:linear-gradient(135deg,#2D4F3B 0%,#4A6E4F 35%,#7A9C75 70%,#A3BEA0 100%);border-radius:18px;overflow:hidden">
      <div style="position:absolute;top:14px;left:14px;display:flex;flex-direction:column;gap:7px">
        <button onclick="nav(document.querySelector('[data-view=calendar]'))" style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.92);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${dx.ink}" title="ดู Calendar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg></button>
        <button onclick="nav(document.querySelector('[data-view=op]'))" style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.92);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${dx.ink}" title="ไป Boat Operation"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></button>
      </div>
      <div style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);background:rgba(255,255,255,.96);border-radius:28px;padding:6px 16px 6px 7px;display:flex;align-items:center;gap:7px;backdrop-filter:blur(8px)">
        <div style="display:flex">${heroAvatars||`<div style="width:30px;height:30px;border-radius:50%;background:${dx.limeSoft};border:2px solid #fff"></div>`}</div>
        ${heroBoats.length>2?`<span style="font-size:12px;font-weight:600;color:${dx.ink}">+${heroBoats.length-2}</span>`:''}
        <button onclick="nav(document.querySelector('[data-view=op]'))" style="width:28px;height:28px;border-radius:50%;background:${dx.forest};color:#fff;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px">+</button>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:start;margin-top:18px;padding:0 4px;gap:14px">
      <div style="flex:1;min-width:0">
        <div style="font-size:21px;font-weight:600;letter-spacing:-.02em;color:${dx.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${heroRoute?heroRoute.name:'No trip today'}">${heroRoute?heroRoute.name:'ไม่มีเที่ยวออกวันนี้'}</div>
        <div style="font-size:12px;color:${dx.ink3};margin-top:4px">${heroRoute?(heroRoute.pier==='tublamu'?'Tub Lamu · ':heroRoute.pier==='panwa'?'Visit Panwa · ':'')+(heroBoats.length+' boat'+(heroBoats.length>1?'s':'')):'-'}${heroBoatNames?' · '+heroBoatNames:''}</div>
        <button onclick="nav(document.querySelector('[data-view=op]'))" style="margin-top:10px;background:${dx.limeSoft};color:${dx.forestLight};border:none;border-radius:10px;padding:6px 13px;font-size:11.5px;font-weight:600;cursor:pointer;${F};display:inline-flex;align-items:center;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Open trip details
        </button>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:18px;color:${dx.ink};font-weight:600;letter-spacing:-.015em">${heroTotalFree}<span style="color:${dx.ink3};font-weight:400;font-size:14px"> / ${heroTotalCap||'-'} free</span></div>
        <div style="font-size:11px;color:${dx.ink3};margin-top:3px">${heroRoute?(heroRoute.times||[]).join(' / ')||'-':''}</div>
      </div>
    </div>
  </div>`;

  // Bookings overview (forest green) — day / month / year modes
  // Short route labels for legend
  const _shortName=(name)=>name
    .replace('Phi Phi Bamboo by Speedboat','Phi Phi Spd')
    .replace('Early OTA Phi Phi Bamboo','E.OTA Phi Phi')
    .replace('Early SY Phi Phi Bamboo','E.SY Phi Phi')
    .replace('Phi Phi Bamboo - FS','Phi Phi FS')
    .replace('Similan Islands by Speedboat','Similan Spd')
    .replace('Similan Islands by Catamaran','Similan Cat')
    .replace('Surin Islands by Speedboat','Surin Spd')
    .replace('Early Krabi + Phang Nga','Krabi+PgNga')
    .replace('Whale Shark Phi Phi Maiton Sunset','Whale Shark');
  const _bkLabel=(d)=> _bkMode==='year' ? TH_MON[d.dt.getMonth()] : (_bkMode==='month' ? String(d.dt.getDate()) : 'Today');
  // liquid-glass bar fill — diagonal light streak over the solid colour
  const _glassBar=(c)=>`linear-gradient(118deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,.12) 20%,rgba(255,255,255,0) 44%,rgba(0,0,0,.10) 100%),${c}`;
  // today's per-route rows (for day mode + its stats)
  const dayRB = bkBuckets[0] ? bkBuckets[0].routeBooked : {};
  const dayRows = Object.entries(dayRB).filter(([id,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  // ── build the plot (mode-aware) ──
  let plotHtml, plotCols, plotGap;
  const dayCharter = bkBuckets[0] ? (bkBuckets[0].charter||0) : 0;
  const dayWx = bkBuckets[0] ? (bkBuckets[0].wx||0) : 0;
  if(_bkMode==='day'){
    // TODAY only — one bar per route (separated) + a Charter bar, tallest→shortest
    const dayPal=['#B8E89A','#F5E84F','#F4B89F','#9DC7E6','#C9B6E8','#7FD0A0','#F0A5C0','#E8C97F','#8FD9C8'];
    const dayEntries = dayRows.map(([id,v],i)=>{ const r=getRoute(id); return {label:r?_shortName(r.name):id, val:v, color:dayPal[i%dayPal.length]}; });
    if(dayCharter>0) dayEntries.push({label:'เหมาลำ Charter', val:dayCharter, color:CHARTER_COLOR});
    const dayMax=Math.max(...dayEntries.map(e=>e.val),1);
    plotCols='repeat('+Math.max(dayEntries.length,1)+',1fr)'; plotGap='12px';
    plotHtml = dayEntries.length ? dayEntries.map(e=>{
      const h=Math.max((e.val/dayMax)*100,3);
      return `<div style="display:flex;flex-direction:column;align-items:center;min-width:0">
        <div style="width:100%;height:150px;display:flex;align-items:flex-end;justify-content:center">
          <div style="position:relative;width:62%;max-width:48px;height:${h}%;background:${_glassBar(e.color)};border-radius:6px 6px 0 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),inset -1px 0 0 rgba(0,0,0,.07),0 2px 6px rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.18)">
            <div style="position:absolute;left:50%;transform:translateX(-50%);top:-19px;font-size:12px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums">${e.val}</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:9px;font-size:10px;color:#DDEBD8;font-weight:600;line-height:1.25;word-break:break-word">${e.label}</div>
      </div>`;
    }).join('') : `<div style="grid-column:1/-1;text-align:center;color:#9FB89E;font-size:12.5px;padding:54px 0">ยังไม่มี booking วันนี้</div>`;
  } else {
    // MONTH (30 days) / YEAR (12 months) — stacked route bars + capacity outline
    plotCols='repeat('+bkBuckets.length+',1fr)';
    plotGap=_bkMode==='month'?'3px':'6px';
    plotHtml=bkBuckets.map((d,i)=>{
      const isTdy=d.isToday;
      const tot=d.tot||0;
      const capH=(d.capacity/trendMax)*100;
      const totH=(tot/trendMax)*100;
      const noBoat = d.capacity===0 && tot>0;
      const segs=[];
      topRoutes.forEach(tr=>{ const v=d.routeBooked[tr.id]||0; if(v>0) segs.push({v,color:tr.color,label:_shortName(tr.r.name)}); });
      const otherV=otherRouteIds.reduce((s,id)=>s+(d.routeBooked[id]||0),0);
      if(otherV>0) segs.push({v:otherV,color:segPalette[3],label:'Other'});
      if((d.charter||0)>0) segs.push({v:d.charter,color:CHARTER_COLOR,label:'Charter เหมาลำ'});
      const segDivs = noBoat
        ? `<div style="flex:1;background:${_glassBar('rgba(157,199,230,.55)')}" title="${tot} จอง · ยังไม่จัดเรือ"></div>`
        : segs.map(s=>`<div style="flex:0 0 ${tot>0?(s.v/tot*100):0}%;background:${_glassBar(s.color)}" title="${s.label}: ${s.v}"></div>`).join('');
      const barW=_bkMode==='month'?'86%':'70%';
      const barMax=_bkMode==='month'?'13px':'34px';
      const _wx=(d.wx||0)>0;
      const showLbl=_bkMode==='year' || isTdy || _wx || (i%5===0);
      // weather-cancelled column → red tinted band + red ⛈ badge on top (clearly visible)
      const wxWrap=_wx?`background:rgba(232,74,63,.20);box-shadow:inset 0 0 0 1px rgba(232,74,63,.45);border-radius:7px;padding-top:16px`:'';
      const wxBadge=_wx?`<div title="${d.wx} เส้นทางถูกยกเลิกเพราะสภาพอากาศ" style="position:absolute;left:50%;transform:translateX(-50%);top:-1px;font-size:13px;line-height:1;text-shadow:0 0 6px rgba(232,74,63,.9);z-index:2">⛈</div>`:'';
      return `<div style="position:relative;display:flex;flex-direction:column;align-items:center;min-width:0;${wxWrap}">
        ${wxBadge}
        <div style="position:relative;width:100%;height:150px;display:flex;align-items:flex-end;justify-content:center">
          <div style="position:relative;width:${barW};max-width:${barMax};height:100%">
            <div style="position:absolute;left:0;right:0;bottom:0;height:${noBoat?totH:capH}%;border:1.5px dashed ${noBoat?'rgba(157,199,230,.85)':(_wx?'rgba(232,74,63,.6)':'rgba(255,255,255,'+(isTdy?.55:.18)+')')};border-radius:4px;pointer-events:none"></div>
            <div style="position:absolute;left:0;right:0;bottom:0;height:${totH}%;display:flex;flex-direction:column-reverse;border-radius:3px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset -1px 0 0 rgba(0,0,0,.06),0 1px 4px rgba(0,0,0,.14);border:1px solid rgba(255,255,255,.14)">${segDivs}</div>
            ${isTdy?`<div style="position:absolute;left:50%;transform:translateX(-50%);top:-20px;background:#fff;color:${dx.forestDark};font-size:8.5px;font-weight:700;padding:2px 5px;border-radius:6px;font-variant-numeric:tabular-nums;white-space:nowrap">${tot}</div>`:''}
          </div>
        </div>
        <div style="text-align:center;margin-top:7px;font-size:${_bkMode==='month'?'8px':'9.5px'};color:${_wx?'#FF8B7F':(isTdy?dx.lime:'#9FB89E')};font-weight:${(isTdy||_wx)?'700':'500'};font-variant-numeric:tabular-nums;height:12px;white-space:nowrap">${showLbl?_bkLabel(d):''}</div>
      </div>`;
    }).join('');
  }
  // Legend (month/year only — day mode labels each bar directly)
  const legendItems=(_bkMode==='day')?'':topRoutes.map(tr=>`<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:${tr.color}"></span><span style="color:#fff;font-weight:500">${_shortName(tr.r.name)}</span><span style="color:#9FB89E;font-variant-numeric:tabular-nums">${tr.total}</span></span>`).join('');
  const otherLegend=(_bkMode!=='day'&&otherWeekTotal>0)?`<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:${segPalette[3]}"></span><span style="color:#fff;font-weight:500">Other</span><span style="color:#9FB89E;font-variant-numeric:tabular-nums">${otherWeekTotal}</span></span>`:'';
  const charterLegend=(_bkMode!=='day'&&charterWeekTotal>0)?`<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:${CHARTER_COLOR}"></span><span style="color:#fff;font-weight:500">Charter เหมาลำ</span><span style="color:#9FB89E;font-variant-numeric:tabular-nums">${charterWeekTotal}</span></span>`:'';
  const wxLegend=(_bkMode!=='day'&&wxWeekTotal>0)?`<span style="display:inline-flex;align-items:center;gap:5px"><span style="font-size:11px;line-height:1">⛈</span><span style="color:#9FB89E">ยกเลิกจากอากาศ ${wxWeekTotal}</span></span>`:'';
  const capLegend=(_bkMode==='day')?'':`<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:8px;border:1.2px dashed rgba(255,255,255,.55);border-radius:2px"></span><span style="color:#9FB89E">Capacity</span></span>`;
  // ── period toggle (วัน / เดือน / ปี) ──
  const _bkSeg=(m,lbl)=>`<button onclick="dashBkSetMode('${m}')" style="border:none;cursor:pointer;font-size:10.5px;font-weight:600;padding:5px 12px;border-radius:8px;${F}${_bkMode===m?'background:'+dx.lime+';color:'+dx.forestDark:'background:transparent;color:#9FB89E'}">${lbl}</button>`;
  const bkToggle=`<div style="display:inline-flex;background:rgba(255,255,255,.08);border-radius:10px;padding:2px;flex-shrink:0">${_bkSeg('day','วัน')}${_bkSeg('month','เดือน')}${_bkSeg('year','ปี')}</div>`;
  const bkTitle=_bkMode==='day'?'Bookings overview · วันนี้':_bkMode==='month'?'Bookings overview · 30 วัน':'Bookings overview · 12 เดือน';
  const _periodLbl=_bkMode==='day'?'วันนี้':_bkMode==='month'?'30 วัน':'12 เดือน';
  const bkSub=`รวม <span style="color:#fff;font-weight:600">${fmtN(totalBookedWeek)}</span> seats${totalCapWeek>0?' / <span style="color:#fff;font-weight:600">'+fmtN(totalCapWeek)+'</span> cap · <span style="color:'+dx.lime+';font-weight:600">'+fillWeekPct+'%</span> fill':''} · ${_periodLbl} · วันนี้ ${deltaSign?'+':''}${deltaSeats} vs เมื่อวาน`;
  // ── stats footer (mode-aware) ──
  const _fmtDt=(dt)=> _bkMode==='year' ? TH_MON[dt.getMonth()] : dt.getDate()+' '+TH_MON[dt.getMonth()];
  // liquid-glass surfaces (inner cards + plot) — gradient sheen + inset highlight + depth shadow
  const GLASS_IN="background-image:linear-gradient(155deg,rgba(255,255,255,.14),rgba(255,255,255,.03));box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 1px 2px rgba(0,0,0,.18),0 8px 18px rgba(0,0,0,.14);backdrop-filter:blur(6px) saturate(1.2);-webkit-backdrop-filter:blur(6px) saturate(1.2);border:1px solid rgba(255,255,255,.10);";
  const _statCard=(lbl,val,valCol,sub)=>`<div style="background:rgba(255,255,255,.06);${GLASS_IN}border-radius:11px;padding:8px 11px"><div style="font-size:8.5px;color:#9FB89E;letter-spacing:.05em;text-transform:uppercase">${lbl}</div><div style="font-size:13px;font-weight:600;margin-top:2px;color:${valCol};font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${val}</div><div style="font-size:9px;color:#9FB89E;margin-top:1px">${sub||''}</div></div>`;
  let statsHtml;
  if(_bkMode==='day'){
    statsHtml =
      _statCard('ที่นั่งวันนี้', fmtN(totalBookedWeek), dx.lime, 'seats booked')
    + _statCard('Fill', fillWeekPct+'%', '#fff', totalBookedWeek+' / '+(totalCapWeek||'-'))
    + _statCard('Top route', topRouteWeek?_shortName(topRouteWeek.r.name):'—', '#fff', topRouteWeek?topRouteWeek.total+' seats':'')
    + _statCard('เส้นทาง', dayRows.length, '#fff', 'routes today');
  } else {
    const perLbl=_bkMode==='year'?'เดือน':'วัน';
    statsHtml =
      _statCard(_bkMode==='year'?'Peak month':'Peak day', bestDay?_fmtDt(bestDay.dt):'—', dx.lime, bestDay?bestDay.pct+'% fill':'—')
    + _statCard(_bkMode==='year'?'Slow month':'Slow day', slowDay?_fmtDt(slowDay.dt):'—', dx.coralBg, slowDay?slowDay.pct+'% fill':'—')
    + _statCard('Top route', topRouteWeek?_shortName(topRouteWeek.r.name):'—', '#fff', topRouteWeek?topRouteWeek.total+' seats':'')
    + _statCard('Avg / '+perLbl, fmtN(avgPerDay), '#fff', 'seats');
  }
  const legendRow=(legendItems||otherLegend||charterLegend||wxLegend||capLegend)?`<div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:14px;font-size:10.5px;font-variant-numeric:tabular-nums">${legendItems}${otherLegend}${charterLegend}${wxLegend}${capLegend}</div>`:'';
  // day-mode weather note (chip next to title)
  const dayWxChip=(_bkMode==='day'&&dayWx>0)?`<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(232,74,63,.18);color:#FFB4AC;padding:3px 9px;border-radius:8px;font-size:10px;font-weight:600;flex-shrink:0">⛈ ยกเลิกจากอากาศ ${dayWx}</span>`:'';
  const proj=`<div class="dgx-bookings" style="background:${dx.forest};border-radius:24px;padding:22px 24px;color:#fff;${F}box-shadow:0 2px 4px rgba(10,40,25,.10),0 16px 38px rgba(10,50,30,.20);border:1px solid rgba(255,255,255,.08);">
    <div style="display:flex;align-items:start;justify-content:space-between;gap:14px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:17px;font-weight:600;letter-spacing:-.015em">${bkTitle}</span>${dayWxChip}</div>
        <p style="font-size:12px;color:#9FB89E;margin:5px 0 0;line-height:1.55">${bkSub}</p>
      </div>
      ${bkToggle}
    </div>
    <div style="margin-top:20px;position:relative;background:rgba(255,255,255,.05);${GLASS_IN}border-radius:14px;padding:18px 10px 8px">
      <div style="display:grid;grid-template-columns:${plotCols};gap:${plotGap};align-items:end">${plotHtml}</div>
    </div>
    ${legendRow}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:14px">${statsHtml}</div>
  </div>`;

  const centerCol=`<div style="display:flex;flex-direction:column;gap:12px">${_dashSeatCalHtml(dx,F)}${proj}</div>`;

  // ─── RIGHT COLUMN ───
  // Fleet Score (dark brown) — 7-day comparison grid + WoW trend + red alert for low days
  const scoreColor=fleetScore>=70?dx.lime:fleetScore>=50?'#F5E84F':fleetScore>=30?dx.coral:'#E84A3F';
  // Helper: compute fleet score for any ds
  const _fsForDay=(ds)=>{
    const dayOps=TRIPS[ds]||{};
    const availD=companyBoats.filter(b=>getCurStatus(b,ds).s==='available').length;
    const opCount=Object.entries(dayOps).filter(([bid,op])=>{
      if(!op.route) return false;
      const b=getBoat(bid); if(!b) return false;
      if(getCurStatus(b,ds).s!=='available') return false;
      const r=getRoute(op.route); if(!r) return false;
      const _s=(typeof getDayStatus==='function')?getDayStatus(r,ds):null;
      if(_s && _s.type==='closed') return false;
      return true;
    }).length;
    const sc=availD>0?Math.min(100,Math.round(opCount/availD*100)):0;
    return {score:sc,op:opCount,avail:availD};
  };
  // ── Bookings + pax per day (counted by bookingDate = creation date) ──
  const _bkForDay=(ds)=>{ let pax=0,bk=0; (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
    const cd=String(b.bookingDate||b.createdAt||'').slice(0,10); if(cd!==ds) return;
    bk++; const t0=(b.trips||[])[0]; pax += (t0 && typeof bkV2PaxAllTot==='function') ? bkV2PaxAllTot(t0.pax||{}) : 0;
  }); return {pax:pax,bk:bk}; };
  // Last 7 days
  const fleetScoreData=[];
  for(let dOff=-6;dOff<=0;dOff++){ const ds=_dsAt(dOff); fleetScoreData.push({ds,dt:new Date(ds),..._bkForDay(ds)}); }
  // Previous 7 days (-13 .. -7) for WoW trend (avg pax)
  const prevWeekPax=[];
  for(let dOff=-13;dOff<=-7;dOff++){ prevWeekPax.push(_bkForDay(_dsAt(dOff)).pax); }
  const todayIdxFS=fleetScoreData.length-1;
  const weekMaxPax=Math.max(1,...fleetScoreData.map(d=>d.pax));        // for bar scaling (relative to busiest day)
  const weekAvgFS=Math.round(fleetScoreData.reduce((s,d)=>s+d.pax,0)/fleetScoreData.length);
  const prevWeekAvg=Math.round(prevWeekPax.reduce((s,p)=>s+p,0)/prevWeekPax.length);
  const trendDelta=weekAvgFS-prevWeekAvg;
  const trendUp=trendDelta>=0;
  const trendPct=prevWeekAvg>0?Math.round(Math.abs(trendDelta)/prevWeekAvg*100):(weekAvgFS>0?100:0);
  // Color tiers — red for very low
  const fsColor=(sc)=>{
    if(sc>=90) return dx.lime;
    if(sc>=70) return dx.lime;
    if(sc>=50) return '#F5E84F';
    if(sc>=30) return dx.coral;     // orange
    if(sc>0)   return '#E84A3F';    // alert red
    return 'rgba(255,255,255,.15)';
  };
  const fsNumColor=(sc,isTdy)=>{
    if(sc<30 && sc>0) return '#FF6B5E';        // red text
    if(sc<50 && sc>0) return '#F5C088';        // orange tint
    return dx.brownText;
  };
  const fsBorder=(sc,isTdy)=>{
    if(isTdy) return 'rgba(255,255,255,.18)';
    if(sc<30 && sc>0) return 'rgba(232,74,63,.45)';
    return 'rgba(255,255,255,.05)';
  };
  const fsBg=(sc,isTdy)=>{
    if(isTdy) return 'rgba(255,255,255,.07)';
    if(sc<30 && sc>0) return 'rgba(232,74,63,.08)';
    return 'transparent';
  };
  const THAI_DAY=['#FF6B5E','#F5D84A','#FF7FB0','#6FD07F','#FFA24D','#5FB4F0','#B98BE0'];   // สีประจำวัน อา·จ·อ·พ·พฤ·ศ·ส (ปรับให้อ่านบนพื้นเข้ม)
  const fsCells=fleetScoreData.map((d,i)=>{
    const isTdy=i===todayIdxFS;
    const pct=weekMaxPax>0?Math.round(d.pax/weekMaxPax*100):0;   // relative fill vs busiest day → same colour tiers
    const c=fsColor(pct);
    const isAlert=pct<30 && d.pax>0;
    return `<div class="dgx-fcell" style="position:relative;background:${fsBg(pct,isTdy)};border:1px solid ${fsBorder(pct,isTdy)};border-radius:9px;padding:7px 3px 6px;text-align:center;min-width:0">
      ${isAlert?`<span style="position:absolute;top:3px;right:3px;width:5px;height:5px;background:#E84A3F;border-radius:50%;box-shadow:0 0 4px rgba(232,74,63,.6)"></span>`:''}
      <div style="font-size:8px;color:${THAI_DAY[d.dt.getDay()]};letter-spacing:.06em;text-transform:uppercase;font-weight:700">${WD_EN[d.dt.getDay()].slice(0,3)}</div>
      <div style="font-size:8.5px;color:${dx.brownMute};margin-top:1px;font-variant-numeric:tabular-nums">${d.dt.getDate()}</div>
      <div style="font-size:14px;font-weight:700;color:${fsNumColor(pct,isTdy)};margin-top:5px;font-variant-numeric:tabular-nums;letter-spacing:-.02em">${d.pax}</div>
      <div style="margin-top:5px;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${c};border-radius:2px"></div>
      </div>
      <div style="font-size:7.5px;color:${dx.brownMute};margin-top:3px;font-variant-numeric:tabular-nums">${d.bk} bk</div>
    </div>`;
  }).join('');
  // today volume label/colour for the header chip + footer (same tiers as the cells)
  const _tdBk=fleetScoreData[todayIdxFS]||{pax:0,bk:0};
  const _tdPct=weekMaxPax>0?Math.round(_tdBk.pax/weekMaxPax*100):0;
  const volColor=fsColor(_tdPct);
  const volLabel=_tdBk.pax<=0?'—':_tdPct>=70?'Busy':_tdPct>=30?'OK':'Quiet';
  // Trend pill colors
  const trendIsFlat=trendDelta===0;
  const trendBg=trendIsFlat?'rgba(255,255,255,.08)':trendUp?'rgba(184,232,154,.16)':'rgba(232,74,63,.18)';
  const trendFg=trendIsFlat?dx.brownMute:trendUp?dx.lime:'#FF8B7F';
  const trendArrow=trendIsFlat?'→':trendUp?'↗':'↘';
  const ai=`<div class="dgx-fleet" style="background:${dx.brown};border-radius:18px;padding:14px 14px 13px;color:${dx.brownText};${F}">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:${dx.lime}"><span>✦</span> Bookings/day</div>
      <span style="font-size:9px;color:${volColor};background:rgba(255,255,255,.08);padding:2px 8px;border-radius:7px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">${volLabel}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:11px">${fsCells}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:11px;font-size:10px;color:${dx.brownMute};font-weight:500">
      <div style="display:inline-flex;align-items:center;gap:6px">
        <span>7-day avg <span style="color:${dx.brownText};font-weight:700;font-variant-numeric:tabular-nums">${weekAvgFS}</span> pax</span>
        <span style="display:inline-flex;align-items:center;gap:3px;background:${trendBg};color:${trendFg};padding:2px 7px;border-radius:7px;font-size:9.5px;font-weight:700;font-variant-numeric:tabular-nums">${trendArrow} ${trendIsFlat?'flat':(trendUp?'+':'−')+trendPct+'%'}</span>
      </div>
      <span>Today <span style="color:${volColor};font-weight:700;font-variant-numeric:tabular-nums">${_tdBk.pax}</span> pax · <span style="color:${dx.brownText};font-weight:700;font-variant-numeric:tabular-nums">${_tdBk.bk}</span> bk</span>
    </div>
    ${trendDelta!==0?`<div style="font-size:9px;color:${dx.brownMute};margin-top:4px;text-align:left">vs prev week <span style="color:${dx.brownText};font-weight:600;font-variant-numeric:tabular-nums">${prevWeekAvg}</span></div>`:''}
  </div>`;

  // Scheduling — Today's headline trip (hero route)
  const schedRoute=bestRoute?bestRoute.r:null;
  const schedBoats=heroBoats.length;
  const schedFree=heroTotalFree;
  const sched=`<div style="background:${dx.card};border-radius:18px;padding:14px;${F}${GLASS}">
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
      <div style="min-width:0;flex:1;padding-right:8px">
        <div style="font-size:13px;font-weight:600;color:${dx.ink}">Today's headline</div>
        <div style="font-size:10px;color:${dx.ink3};margin-top:4px;line-height:1.45">${schedRoute?'route ที่ booking เยอะที่สุด':'ไม่มี trip วันนี้'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:8.5px;color:${dx.ink3};letter-spacing:.05em;text-transform:uppercase">${WD_EN[todayDt.getDay()]}</div>
        <div style="display:inline-block;background:${dx.yellow};padding:2px 8px;border-radius:7px;font-size:11px;font-weight:600;color:${dx.ink};margin-top:3px">${EN_MON_S[todayDt.getMonth()]} ${todayDt.getDate()}</div>
      </div>
    </div>
    <div style="height:82px;background:linear-gradient(135deg,#3E5A1E 0%,#5A8C40 40%,#9FB89E 100%);border-radius:12px;position:relative;overflow:hidden;display:flex;align-items:end;justify-content:space-between;padding:9px 12px">
      <span style="font-size:9.5px;color:rgba(255,255,255,.95);font-weight:600">${schedRoute?(schedRoute.pier==='tublamu'?'Tub Lamu':schedRoute.pier==='panwa'?'Visit Panwa':schedRoute.pier):''}</span>
      <span style="font-size:18px;font-weight:700;color:#fff;line-height:1;font-variant-numeric:tabular-nums">${schedRoute?Math.round(bestRoute.pct):0}<span style="font-size:12px;font-weight:500">%</span></span>
    </div>
    <div style="font-size:12px;font-weight:600;margin-top:8px;color:${dx.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${schedRoute?schedRoute.name:''}">${schedRoute?schedRoute.name:'—'}</div>
    <div style="display:flex;justify-content:space-between;font-size:9.5px;color:${dx.ink3};margin-top:4px"><span>${schedBoats} boat${schedBoats>1?'s':''}</span><span>${schedFree} free / ${heroTotalCap||'-'}</span></div>
    <div onclick="nav(document.querySelector('[data-view=op]'))" style="text-align:center;margin-top:8px;font-size:11px;color:${dx.forest};font-weight:600;cursor:pointer">View boat operation</div>
  </div>`;

  // Departures next 48h — list
  const upcoming48=[];
  for(let d=0;d<3;d++){
    const ds=_dsAt(d);
    const dayOps=TRIPS[ds]||{};
    Object.entries(dayOps).forEach(([bid,op])=>{
      if(!op.route) return;
      const r=getRoute(op.route); if(!r) return;
      const b=getBoat(bid); if(!b) return;
      if(getCurStatus(b,ds).s!=='available') return;
      const _s=(typeof getDayStatus==='function')?getDayStatus(r,ds):null;
      if(_s && _s.type==='closed') return;
      const free=b.cap-(op.booked||0);
      const pct=b.cap>0?Math.round((op.booked||0)/b.cap*100):0;
      upcoming48.push({ds,r,b,free,pct});
    });
  }
  upcoming48.sort((a,b)=>a.ds.localeCompare(b.ds)||b.pct-a.pct);
  const upcoming48Top=upcoming48.slice(0,5);
  const moreDep=Math.max(0,upcoming48.length-5);
  const upcomingRows=upcoming48Top.map(u=>{
    const dt=new Date(u.ds);
    const isTdy=u.ds===_ds;
    const freeColor=u.pct>=95?dx.coralDeep:u.pct>=70?dx.coral:dx.forestLight;
    return `<div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid ${dx.line2}">
      <span style="background:${isTdy?dx.lime:dx.soft};color:${isTdy?dx.forestLight:dx.ink2};padding:3px 8px;border-radius:7px;font-size:10px;font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0;letter-spacing:-.005em">${isTdy?'Today':dt.getDate()+' '+TH_MON[dt.getMonth()]}</span>
      <div style="width:3px;height:20px;background:${u.r.color};border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:${dx.ink};letter-spacing:-.005em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${u.r.name}">${u.r.name}</div>
        <div style="font-size:9.5px;color:${dx.ink3};margin-top:1px">${u.b.name}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:600;color:${freeColor};font-variant-numeric:tabular-nums;letter-spacing:-.005em">${u.free}</div>
        <div style="font-size:9px;color:${dx.ink3}">free</div>
      </div>
    </div>`;
  }).join('');
  const filesCard=`<div style="background:${dx.card};border-radius:18px;padding:14px 15px;${F}${GLASS}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="font-size:13px;font-weight:600;letter-spacing:-.015em;color:${dx.ink}">Departures · 48h</div>
      <span style="background:${dx.limeSoft};color:${dx.forestLight};padding:2px 8px;border-radius:8px;font-size:9.5px;font-weight:600;font-variant-numeric:tabular-nums">${upcoming48.length} TRIPS</span>
    </div>
    ${upcomingRows||`<div style="padding:26px 4px;text-align:center;font-size:10.5px;color:${dx.ink3}">ไม่มีเที่ยวออกใน 48 ชม.</div>`}
    ${moreDep>0?`<div onclick="nav(document.querySelector('[data-view=calendar]'))" style="margin-top:6px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10.5px;color:${dx.ink2};cursor:pointer"><span style="background:${dx.soft};color:${dx.forestLight};padding:1px 7px;border-radius:7px;font-weight:600;font-variant-numeric:tabular-nums">+${moreDep}</span> more · open Calendar <span style="opacity:.5;font-size:13px">›</span></div>`:''}
    <button onclick="nav(document.querySelector('[data-view=op]'))" style="display:block;width:100%;margin:10px 0 0;background:${dx.forest};color:#fff;border:none;border-radius:16px;padding:8px;font-size:11.5px;font-weight:500;cursor:pointer;${F}">Open Boat Operation</button>
  </div>`;

  const leftCol=`<div style="display:flex;flex-direction:column;gap:18px">${profile}${todoCard}${notifCard}${sched}${filesCard}</div>`;
  const rightCol=`<div style="display:flex;flex-direction:column;gap:18px">${ai}${_dashLiveFeedHtml(dx,F)}</div>`;

  // ── COMPOSE 3-column layout (match reference: 1 | 1.7 | 1) ──
  wrap.innerHTML = seg + `<div style="display:grid;grid-template-columns:1fr 1.7fr 1fr;gap:14px;align-items:start">${leftCol}${centerCol}${rightCol}</div>`;
}

// ══════════════════════════════════════
// CALENDAR (redesigned — Fleet Insights style + per-route averages)
// ══════════════════════════════════════
let calYear=TODAY.getFullYear(),calMonth=TODAY.getMonth(),calPier='all';
const WDS=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MONTHS_TH=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTHS_EN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_TH_SHORT=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function setCalPier(v){ calPier=v; renderCal(); }
function setCalAvgMode(m){ window._calAvgMode=m; renderCal(); }
function setCalViewMode(m){ window._calViewMode=m; localStorage.setItem('_cal_view_mode',m); renderCal(); }
function changeMonth(d){calMonth+=d;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}renderCal();}

// ── Matrix: hidden routes (per-user, persisted) ──
function _calGetHiddenRoutes(){
  try {
    const raw = localStorage.getItem('_cal_hidden_routes');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch(e){ return new Set(); }
}
function _calSaveHiddenRoutes(set){
  try { localStorage.setItem('_cal_hidden_routes', JSON.stringify([...set])); } catch(e){}
}
function calHideRoute(rId){
  const s = _calGetHiddenRoutes();
  s.add(rId);
  _calSaveHiddenRoutes(s);
  renderCal();
}
function calUnhideRoute(rId){
  const s = _calGetHiddenRoutes();
  s.delete(rId);
  _calSaveHiddenRoutes(s);
  renderCal();
}
function calShowAllRoutes(){
  _calSaveHiddenRoutes(new Set());
  renderCal();
}
function calToggleHidePanel(){
  window._calShowHidePanel = !window._calShowHidePanel;
  renderCal();
}

// §cal2b · ชื่อโปรแกรมที่จะโชว์ในปฏิทิน · ตั้งเองได้ต่อเส้นทาง
//   เก็บเป็น JSON string ใน blob (cal_route_names · sync app_meta)
//   แยกชุดจาก da_route_names เพราะช่องปฏิทินแคบกว่าข้อความ LINE คนละเงื่อนไข
let CAL_ROUTE_NAMES={};
(function(){ try{ const d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); const v=d.cal_route_names;
  if(typeof v==='string'){ CAL_ROUTE_NAMES=JSON.parse(v)||{}; } else if(v && typeof v==='object'){ CAL_ROUTE_NAMES=v; } }catch(e){} })();
// ชื่อที่ตั้งเอง → รายการย่อเดิม → ชื่อเต็ม
function _calName(r){ return (r && ((CAL_ROUTE_NAMES[r.id]||'').trim())) || _calShortName((r&&r.name)||''); }
function calEditRouteName(rid){
  const r=(typeof getRoute==='function')?getRoute(rid):null; if(!r) return;
  const v=prompt('Calendar label\nRoute: '+r.name+'\n(leave blank to use the default short name)', CAL_ROUTE_NAMES[rid]||'');
  if(v===null) return;
  const nv=v.trim();
  if(nv) CAL_ROUTE_NAMES[rid]=nv; else delete CAL_ROUTE_NAMES[rid];
  try{ const d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); d.cal_route_names=JSON.stringify(CAL_ROUTE_NAMES); localStorage.setItem('loveandaman_v2', JSON.stringify(d)); }catch(e){}
  if(typeof renderCal==='function') renderCal();
}

// Helpers shared by renderCal
function _calShortName(name){
  return name
    .replace('Early Tratato Similan Islands','E.Tratato Similan')
    .replace('Early Tiger Similan Islands','Early Tiger')
    .replace('Similan Islands - PG','Similan PG')
    .replace('Similan Islands by Catamaran','Similan by Cat')
    .replace('Similan Islands by Speedboat','Similan by Spd')
    .replace('Surin Islands by Speedboat','Surin Spd')
    .replace('Early OTA Phi Phi Bamboo','E.OTA Phi Phi')
    .replace('Early SY Phi Phi Bamboo','E.SY Phi Phi')
    .replace('Phi Phi Bamboo - FS','Phi Phi FS')
    .replace('Phi Phi Bamboo by Speedboat','Phi Phi Spd')
    .replace('Early Krabi + Phang Nga','E.Krabi+PgNga')
    .replace('Whale Shark Phi Phi Maiton Sunset','Whale Shark');
}
function _calPierClosed(pier, ds){
  const _pRts=ROUTES.filter(rt=>rt.pier===pier);
  return _pRts.length>0 && _pRts.every(rt=>{
    const _s=getDayStatus(rt,ds);
    return _s && _s.type==='closed';
  });
}
function _calTripsFor(ds, pier){
  // Returns valid trips only · skip if Program is closed (boat cannot operate when program is off-season)
  const dayOps=TRIPS[ds]||{};
  const raw=[];
  Object.entries(dayOps).forEach(([bid,op])=>{
    if(!op.route) return;
    const r=getRoute(op.route); if(!r) return;
    if(pier && r.pier!==pier) return;
    const b=getBoat(bid); if(!b) return;
    if(getCurStatus(b,ds).s!=='available') return;
    // Program closed on this date → trip is stale/invalid · do not display
    const _rds=getDayStatus(r,ds);
    if(_rds && _rds.type==='closed') return;
    raw.push({r,b,op});
  });
  // ⚠ Also include routes that have ACTUAL sales bookings this day but no Boat-Op boat in raw
  //   (boat only on bk.ops.boatId, or its assigned boat got flagged unavailable after running) — use the boat the guests ride for capacity.
  {
    const _rawRoutes=new Set(raw.map(x=>x.r.id));
    const _rawBoats=new Set(raw.map(x=>x.b.id));
    (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(bk=>{
      if(['cancelled','rejected','cancelled_weather'].includes(bk.status)) return;
      if(bk.schemaVer!==2 || !Array.isArray(bk.trips)) return;
      bk.trips.forEach(t=>{
        if((t.date||'')!==ds || t.bookingMode==='charter') return;
        const rid=t.routeId; if(!rid || _rawRoutes.has(rid)) return;
        const r=getRoute(rid); if(!r) return;
        if(pier && r.pier!==pier) return;
        const _rds=getDayStatus(r,ds); if(_rds && _rds.type==='closed') return;
        const abid=bk.ops&&bk.ops.boatId; const ab=abid?getBoat(abid):null;
        if(!ab || _rawBoats.has(ab.id)) return;   // need the actual boat (for capacity) and not already used
        raw.push({r, b:ab, op:{route:rid, booked:0}});
        _rawRoutes.add(rid); _rawBoats.add(ab.id);
      });
    });
  }
  // Seats consumed by actual sales bookings (SB_BOOKINGS) · allocate route total across its seat boats
  // (was b.cap - op.booked · ops counter only · did NOT reflect bookings → matrix never decremented)
  const remain={};
  raw.forEach(x=>{ if(remain[x.r.id]===undefined) remain[x.r.id]=(typeof getSeatsConsumed==='function')?getSeatsConsumed(x.r.id,ds):0; });
  // Charter boats this day (from the booking's charterBoatId · even if Boat-Op doesn't flag the boat) → key route|boat → charter pax.
  //   Such a boat is taken WHOLE by the charter: excluded from the seat pool (0 free) + labelled Charter · its pax NOT counted in seat consumption.
  const _chtrBoat={};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(bk=>{
    if(['cancelled','rejected','cancelled_weather'].includes(bk.status)) return;
    if(bk.schemaVer!==2 || !Array.isArray(bk.trips)) return;
    bk.trips.forEach(t=>{ if((t.date||'')!==ds || t.bookingMode!=='charter') return;
      const _sp=(typeof bkBoatSplits==='function')?bkBoatSplits(bk,ds):null;
      if(_sp){ _sp.forEach(x=>{ if(!x||!x.boatId) return; const k=t.routeId+'|'+x.boatId; _chtrBoat[k]=(_chtrBoat[k]||0)+bkPaxSum(bkSplitPax(x)); }); return; }   // §boatSplit
      const bid=t.charterBoatId||(bk.ops&&bk.ops.boatId); if(!bid) return; const k=t.routeId+'|'+bid; _chtrBoat[k]=(_chtrBoat[k]||0)+((typeof getTripPaxTotal==='function')?getTripPaxTotal(t):0); });
  });
  const out=[];
  raw.forEach(x=>{
    const cap=x.b.cap, op=x.op;
    const _ck=x.r.id+'|'+x.b.id;
    const isCharter = op.type==='charter' || op.charterBookingId || (_chtrBoat[_ck]!==undefined);
    let booked, free;
    if(isCharter){ booked = (_chtrBoat[_ck]!==undefined) ? _chtrBoat[_ck] : (op.booked||0); free = 0; }   // whole boat chartered → 0 sellable seats
    else { const take=Math.min(cap, Math.max(0, remain[x.r.id]||0)); remain[x.r.id]=(remain[x.r.id]||0)-take; booked=take; free=Math.max(0, cap-booked); }
    const weatherClosed=(typeof bkV2IsWeatherClosed==='function' && bkV2IsWeatherClosed(x.r.id, ds));
    out.push({r:x.r,b:x.b,op,free,cap,booked,locked:0,isCharter,routeClosed:false,weatherClosed});
  });
  // §lkAvail · ที่นั่งที่ล็อกไว้ยังขายไม่ได้ · หักออกจากที่ว่าง
  //   หักเฉพาะส่วนที่ยังกันอยู่ · ส่วนที่ถูกดึงไปขายแล้วอยู่ใน seatsConsumed แล้ว
  //   เกลี่ยลงเรือของเส้นทางนั้นทีละลำ (เรือเหมาลำไม่มีที่ขายอยู่แล้ว ข้ามไป)
  try{
    if(typeof bkV2LockedTotal==='function'){
      const _lkNeed={};
      out.forEach(o=>{ if(!o.isCharter && _lkNeed[o.r.id]===undefined) _lkNeed[o.r.id]=bkV2LockedTotal(o.r.id, ds); });
      out.forEach(o=>{
        if(o.isCharter) return;
        const need=_lkNeed[o.r.id]||0; if(need<=0) return;
        const take=Math.min(o.free, need);
        o.free-=take; o.locked=take; _lkNeed[o.r.id]=need-take;
      });
    }
  }catch(e){ console.warn('[cal] lock deduction failed', e); }
  return out;
}
// Weather-resolution pax tally for a route+date (cancelled / rescheduled / pending) · used by Calendar
function bkV2WeatherCountsFor(routeId, date){
  const key=routeId+'|'+date; let cancelled=0, rescheduled=0, pending=0;
  (SB_BOOKINGS||[]).forEach(b=>{
    if(!b.weatherResolve || b.weatherResolve.event!==key) return;
    const wr=b.weatherResolve;
    const t=(b.trips||[]).find(tt=>tt.routeId===routeId) || {};
    const p=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0;
    if(wr.status==='resolved'){ if(wr.outcome==='reschedule') rescheduled+=p; else cancelled+=p; }
    else pending+=p;
  });
  return {cancelled, rescheduled, pending, total:cancelled+rescheduled+pending};
}
function showCalDay(ds){ window._calSel=ds; renderCal(); }

// ═══ §cal2 · ตัวช่วยของปฏิทินโฉมใหม่ ═══════════════════════════════════
// สีจากสีประจำเส้นทาง · จาง ๆ ไว้เป็นพื้น · หรี่ลงไว้เป็นตัวอักษรบนพื้นจาง
function _calHx(c){ c=String(c||'#888').replace('#',''); if(c.length===3) c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  return [parseInt(c.slice(0,2),16)||136, parseInt(c.slice(2,4),16)||136, parseInt(c.slice(4,6),16)||136]; }
function _calRgba(c,a){ const [r,g,b]=_calHx(c); return 'rgba('+r+','+g+','+b+','+a+')'; }
// §calHead/§fit · ความสูงของกระดานเคยเดาด้วย calc(100vh - 168px) · แถบบนสูงเท่าไรจริง ๆ ไม่มีใครรู้
//   เดาต่ำไปกระดานล้นจอ เดาสูงไปเหลือที่ว่างข้างล่างแล้วกลับมาต้องเลื่อนอยู่ดี
//   วัดจากตำแหน่งจริงของตัวเองแทน · ถูกทุกความสูงหน้าจอและทุกความสูงแถบบน
function _calFitPage(){
  try{
    const el=document.querySelector('.cal2-page'); if(!el) return;
    const top=el.getBoundingClientRect().top+(window.scrollY||0);
    el.style.height=Math.max(520, Math.round(window.innerHeight-top-10))+'px';
  }catch(_){}
}
if(!window.__calFitBound){ window.__calFitBound=1; window.addEventListener('resize', function(){ _calFitPage(); }); }
function _calDk(c,k){ const [r,g,b]=_calHx(c); k=(k==null)?0.45:k;
  return 'rgb('+Math.round(r*(1-k))+','+Math.round(g*(1-k))+','+Math.round(b*(1-k))+')'; }
/* §calChip · ดันความอิ่มสีขึ้นก่อนเอาไปทาชิป · แปลงเป็น HSL ดัน S แล้วบีบ L เข้าช่วงที่อ่านออก
   ไม่ได้แก้ค่าสีที่เก็บไว้ของเส้นทาง · หน้าอื่นที่ใช้สีเดียวกันจึงไม่ขยับ */
function _calVivid(c, amt){
  let [r,g,b]=_calHx(c).map(x=>x/255);
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b); let h=0, sa=0, l=(mx+mn)/2;
  if(mx!==mn){ const d=mx-mn; sa = l>0.5 ? d/(2-mx-mn) : d/(mx+mn);
    h = mx===r ? ((g-b)/d+(g<b?6:0)) : mx===g ? ((b-r)/d+2) : ((r-g)/d+4); h/=6; }
  /* §calVivid2 · ดันเข้าหาเต็มทีละส่วน ไม่ใช่คูณ · สีที่อิ่มอยู่แล้วจึงแทบไม่ขยับ */
  const k=(amt==null)?0.30:amt;
  sa = sa + (1-sa)*k;
  l = Math.min(0.62, Math.max(0.36, l));
  const q = l<0.5 ? l*(1+sa) : l+sa-l*sa, p = 2*l-q;
  const f=(t)=>{ t=(t+1)%1; if(t<1/6) return p+(q-p)*6*t; if(t<0.5) return q;
                 if(t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
  const to=(x)=>Math.round(x*255).toString(16).padStart(2,'0');
  return '#'+to(f(h+1/3))+to(f(h))+to(f(h-1/3));
}
/* §calChip · ความชอบของคนดู · เก็บในเครื่อง ไม่ใช่ข้อมูลที่ต้องแชร์ */
var CAL_CHIP_SZ={M:{h:20,f:10.5,p:6},L:{h:23,f:12,p:7},XL:{h:26,f:13.5,p:8},XXL:{h:29,f:15,p:9}};
var CAL_CHIP_INK={
  white:{t:'White', bg:'#22C55E', fg:'#FFFFFF', bgf:'#EF4444', fgf:'#FFFFFF'},
  deep :{t:'Deep green', bg:'#4ADE80', fg:'#064E32', bgf:'#FCA5A5', fgf:'#7F1D1D'},
  ink  :{t:'Ink', bg:'#4ADE80', fg:'#0F172A', bgf:'#FCA5A5', fgf:'#0F172A'},
  soft :{t:'Soft', bg:'#DCFCE7', fg:'#15803D', bgf:'#FEE2E2', fgf:'#B91C1C'}};
function calChipCfg(){
  let st='C', sz='L', ik='white';
  try{ st=localStorage.getItem('la_cal_chip')||st;
       sz=localStorage.getItem('la_cal_chipsz')||sz;
       ik=localStorage.getItem('la_cal_chipink')||ik; }catch(_){}
  if(['C','D'].indexOf(st)<0) st='C';
  if(!CAL_CHIP_SZ[sz]) sz='L';
  if(!CAL_CHIP_INK[ik]) ik='white';
  return {st:st, sz:sz, ik:ik};
}
function calChipSet(k,v){ try{ localStorage.setItem(k,v); }catch(_){} window._calChipOpen=true; renderCal(); }
function calChipPop(e){
  window._calChipOpen=!window._calChipOpen;
  const p=document.getElementById('cal-chippop');
  if(p) p.classList.toggle('on', !!window._calChipOpen);
  if(e && e.stopPropagation) e.stopPropagation();
}
if(!window.__calChipBound){ window.__calChipBound=1;
  document.addEventListener('click', function(ev){
    try{ if(!window._calChipOpen) return;
      if(ev.target.closest && ev.target.closest('.calx-cfgw')) return;
      window._calChipOpen=false;
      const p=document.getElementById('cal-chippop'); if(p) p.classList.remove('on');
    }catch(_){}
  });
}
// เวลาออกของเส้นทาง เป็นนาทีจากเที่ยงคืน · ไม่ได้ตั้งเวลาไว้ให้ไปอยู่ท้ายสุด
function _calDepMin(r){
  const t=String(((r&&r.times)||[])[0]||'').trim();
  const m=t.match(/^(\d{1,2}):(\d{2})/);
  return m ? (+m[1]*60 + +m[2]) : 9999;
}
// ── ช่วงวันที่จะแสดง · เก็บเป็นเลขวันที่ · เปลี่ยนเดือนแล้วรีเซ็ตเป็นทั้งเดือน ──
function _calRange(daysInMonth, viewMonth){
  if(window._calRngMonth!==viewMonth){ window._calRngMonth=viewMonth; window._calRngF=1; window._calRngT=daysInMonth; }
  let f=Math.max(1, Math.min(daysInMonth, window._calRngF||1));
  let t=Math.max(1, Math.min(daysInMonth, window._calRngT||daysInMonth));
  if(t<f) t=f;
  window._calRngF=f; window._calRngT=t;
  return {f,t};
}
function calSetRange(which, val){
  const d=+String(val||'').slice(-2); if(!d) return;
  if(which==='f'){ window._calRngF=d; if((window._calRngT||31)<d) window._calRngT=d; }
  else { window._calRngT=d; if((window._calRngF||1)>d) window._calRngF=d; }
  renderCal();
}
// ปุ่มลัด · n=0 คือทั้งเดือน · n>0 นับจากวันนี้ (ถ้าวันนี้ไม่ได้อยู่ในเดือนที่ดู ให้เริ่มวันที่ 1)
function calRangePreset(n){
  const dim=new Date(calYear, calMonth+1, 0).getDate();
  if(!n){ window._calRngF=1; window._calRngT=dim; renderCal(); return; }
  const vm=calYear+'-'+String(calMonth+1).padStart(2,'0');
  const start=(TODAY_STR||'').startsWith(vm) ? +TODAY_STR.slice(-2) : 1;
  window._calRngF=start; window._calRngT=Math.min(dim, start+n-1);
  renderCal();
}
// ── ลิ้นชักรายละเอียดวัน ─────────────────────────────────────────────
function calOpenDay(ds){ window._calSel=ds; window._calDrawer=true; renderCal(); }
/* §calSkin · กดช่องวัน = เลือกวัน · แผงซ้ายอัปเดตให้เอง ไม่ต้องเด้งลิ้นชักทับทุกครั้ง
   รายละเอียดรายลำยังเปิดได้จากปุ่มในแผงซ้าย */
function calSelDay(ds){ window._calSel=ds; window._calDrawer=false; renderCal(); }
function calCloseDay(){ window._calDrawer=false; renderCal(); }

function renderCal(){
  const wrap=document.getElementById('cal-wrap');
  if(!wrap) return;

  // ── Theme ──
  const FOREST='#1F4D2C', LIME='#C8F47C', LIME_SOFT='#E8F5D8', LIME_DARK='#3B6D11';
  const PIER_COL={tublamu:'#185FA5', panwa:'#0F6E56', ranong:'#BA7517'};
  const PIER_LBL={tublamu:'TL', panwa:'VP', ranong:'RN'};
  const PIER_NAME={tublamu:'Tub Lamu', panwa:'Visit Panwa', ranong:'Ranong'};
  const CAL_PIERS=['tublamu','panwa','ranong'];
  const ink={1:'#1A1A1A',2:'#666',3:'#999',4:'#bbb',line:'rgba(0,0,0,.09)',line2:'rgba(0,0,0,.07)'};
  // INVERTED + 5-TIER (2026-07-08): pct = % full (sold). Higher occupancy = greener (selling well); many free = red (aware).
  // Bands: >=80 deep green · >=60 green · >=40 yellow · >=20 orange · <20 red.
  const colorFor=(pct)=>{ if(pct>=80) return FOREST; if(pct>=60) return '#3B6D11'; if(pct>=40) return '#8A6A0B'; if(pct>=20) return '#B4600F'; return '#A32D2D'; };
  const bgFor=(pct)=>{ if(pct>=80) return '#CFE9AC'; if(pct>=60) return LIME_SOFT; if(pct>=40) return '#FAF0C8'; if(pct>=20) return '#FBE1C6'; return '#FBE9E9'; };

  // ── §cal2 · CSS · ใส่ครั้งเดียวตอนวาด (ทั้งก้อนอยู่ใน innerHTML ของ cal-wrap) ──
  const CAL2CSS=`<style>
  .cal2-page{display:flex;flex-direction:column;gap:7px;height:calc(100vh - 150px);min-height:540px}
  .cal2-box{flex:1;min-height:0;background:#fff;border:1px solid ${ink.line2};border-radius:14px;padding:7px;display:flex;flex-direction:column;gap:5px}
  /* §calSkin · กล่องปฏิทินเป็นการ์ดขาวใบเดียว · แผงวันที่อยู่ซ้าย ตารางอยู่ขวา */
  .cal2-box{background:#fff;border:1px solid #F1F5F9;border-radius:20px;padding:0;gap:0;flex-direction:row;
            box-shadow:0 10px 30px -5px rgba(0,0,0,.05),0 3px 10px -2px rgba(0,0,0,.03)}
  .calx-side{width:344px;flex:0 0 auto;padding:18px 20px 18px;border-right:1px solid #F1F5F9;display:flex;flex-direction:column;min-height:0}
  .calx-pane{flex:1;min-width:0;padding:14px 16px 14px;display:flex;flex-direction:column;gap:6px;min-height:0}
  @media(max-width:1180px){.cal2-box{flex-direction:column}.calx-side{width:auto;border-right:0;border-bottom:1px solid #F1F5F9}}
  .calx-sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;flex:none}
  .calx-sh .t{font-size:10.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#94A3B8}
  .calx-now{border:none;background:#F1F5F9;color:#475569;border-radius:999px;padding:5px 13px;font:700 11px inherit;cursor:pointer}
  .calx-now:hover{background:#E2E8F0}
  .calx-day{font-size:60px;font-weight:800;color:#1E293B;letter-spacing:-.045em;line-height:.92;flex:none}
  .calx-dn2{font-family:'Quicksand','DM Sans',sans-serif;font-weight:600;font-size:30px;letter-spacing:-.01em;
            color:#334155;margin-top:5px;line-height:1.15;flex:none}
  .calx-meta{font-size:10.5px;font-weight:700;color:#94A3B8;letter-spacing:.06em;text-transform:uppercase;margin-top:8px;line-height:1.7;flex:none}
  .calx-meta b{color:#475569}
  .calx-hr{border:0;border-top:1px solid #F1F5F9;margin:15px 0;flex:none}
  .calx-lhd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex:none}
  .calx-lhd .t{font-size:10.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#94A3B8}
  .calx-list{display:flex;flex-direction:column;gap:9px;overflow:auto;min-height:0;flex:1;padding-right:3px}
  .calx-list::-webkit-scrollbar{width:4px}
  .calx-list::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px}
  .calx-tc{padding:12px 14px 13px;border:1px solid;border-radius:16px;cursor:pointer;transition:box-shadow .14s;flex:none}
  .calx-tc:hover{box-shadow:0 4px 14px rgba(15,23,42,.09)}
  .calx-tc .r1{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
  .calx-tc .tm{font:700 10.5px 'DM Mono',monospace;border-radius:6px;padding:2px 8px}
  .calx-tc .pr{font-size:10px;font-weight:700;letter-spacing:.03em}
  /* ชื่อเส้นทางกับที่นั่งว่างอยู่บรรทัดเดียวกัน ตัวใหญ่ทั้งคู่ */
  .calx-tc .r2{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  .calx-tc .rn{font-size:16.5px;font-weight:800;letter-spacing:-.015em;line-height:1.25;min-width:0}
  .calx-tc .sv{font:800 30px 'DM Mono',monospace;letter-spacing:-.04em;line-height:1;flex:0 0 auto}
  .calx-tc .sv.f{font-size:17px;font-weight:800;color:#B91C1C;letter-spacing:.02em;font-family:inherit}
  .calx-empty{padding:24px 14px;text-align:center;border:1px dashed #E2E8F0;border-radius:16px;color:#94A3B8;font-size:12px}
  .calx-foot{flex:none;margin-top:12px;padding-top:12px;border-top:1px solid #F1F5F9;font-size:10.5px;color:#94A3B8;line-height:1.7}
  .calx-foot b{color:#475569}
  .calx-more{border:1px solid #E2E8F0;background:#fff;border-radius:10px;padding:6px 12px;font:700 11px inherit;
             color:#475569;cursor:pointer;margin-top:8px}
  .calx-more:hover{background:#F8FAFC;color:#0F172A}
  /* หัวปฏิทิน · ชื่อเดือนกับป้ายสรุป */
  .cal2-mb{flex:none;background:transparent;border:0;border-radius:0;padding:0 2px 4px;text-align:left;
           display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .cal2-mb .mo{font-size:19px;font-weight:800;color:#0F172A;letter-spacing:-.01em}
  .cal2-mb .bar{width:5px;height:19px;border-radius:3px;flex:none;display:inline-block;vertical-align:-2px;margin-right:7px}
  .cal2-mb .st{display:flex;gap:6px;flex-wrap:wrap}
  .cal2-mb .st span{border:1px solid #E2E8F0;background:#F8FAFC;border-radius:999px;padding:4px 12px;
                    font-size:10.5px;font-weight:600;color:#475569}
  .cal2-mb .st span b{font-family:'DM Mono',monospace;font-weight:700;color:#0F172A;margin-left:4px}
  .cal2-mb .st span.g{background:#ECFDF5;border-color:#BFE0CD;color:#047857}
  .cal2-mb .st span.g b{color:#047857}
  /* §calChip · ปุ่มตั้งความสดของชิป · อยู่มุมขวาของหัวปฏิทิน เปิดเป็นแผงเล็ก */
  .calx-cfgw{position:relative;display:inline-block}
  .calx-cfg{border:1px solid #E2E8F0;background:#fff;border-radius:999px;padding:4px 12px;font:700 10.5px inherit;
            color:#475569;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
  .calx-cfg:hover{background:#F8FAFC;color:#0F172A}
  .calx-cfg i{width:11px;height:11px;border-radius:999px;display:inline-block;
              background:linear-gradient(135deg,#F4543C 50%,#2C7BE5 50%)}
  .calx-pop{position:absolute;top:30px;right:0;z-index:40;background:#fff;border:1px solid #E2E8F0;border-radius:16px;
            box-shadow:0 16px 40px rgba(15,23,42,.16);padding:13px 14px;width:298px;display:none;text-align:left}
  .calx-pop.on{display:block}
  .calx-pop .ph{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#94A3B8;margin:0 0 6px}
  .calx-pop .ph:not(:first-child){margin-top:12px}
  .calx-pop .sg{display:flex;background:#F1F5F9;padding:3px;border-radius:11px;gap:3px;flex-wrap:wrap}
  .calx-pop .sg button{flex:1 1 auto;border:none;background:none;border-radius:8px;padding:5px 8px;
                       font:600 11px inherit;color:#64748B;cursor:pointer;white-space:nowrap}
  .calx-pop .sg button.on{background:#fff;color:#0F172A;font-weight:700;box-shadow:0 1px 2px rgba(15,23,42,.08)}
  .calx-pop .pf{font-size:10.5px;color:#94A3B8;line-height:1.6;margin-top:11px;border-top:1px solid #F1F5F9;padding-top:9px}
  .cal2-wd{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;flex:none}
  .cal2-wd div{text-align:center;font-size:10.5px;font-weight:800;letter-spacing:.13em;color:#94A3B8;padding:4px 0;background:none}
  /* §cal2b · แต่ละสัปดาห์สูงพอดีกับวันที่มีเที่ยวมากที่สุดของสัปดาห์นั้น (min-content)
     แล้วเอาพื้นที่ที่เหลือมาหารเท่า ๆ กัน (1fr) · สัปดาห์ที่โล่งจึงไม่ถูกดันให้สูงตาม
     เดือนที่แน่นจนเกินจอ ตารางเลื่อนได้ ดีกว่าตัดเที่ยวทิ้งแบบเดิม */
  .cal2-grid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));
             grid-auto-rows:minmax(min-content,1fr);gap:4px;background:rgba(241,245,249,.75);
             border:1px solid #F1F5F9;border-radius:16px;padding:4px}
  .cal2-cell{border:0;border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:4px;cursor:pointer;
             min-width:0;min-height:0;overflow:hidden;background:#fff;transition:box-shadow .14s}
  .cal2-cell:hover{box-shadow:0 2px 10px rgba(15,23,42,.09)}
  .cal2-cell.pad{background:#FCFCFD;opacity:.45;cursor:default}
  .cal2-cell.pad:hover{box-shadow:none}
  .cal2-cell.out{background:#FCFCFD;opacity:.55;cursor:default}
  .cal2-cell.out:hover{box-shadow:none}
  /* §cal2e · วันที่ผ่านมาแล้ว · ยังกดดูได้ แค่ไม่ดึงสายตา */
  .cal2-cell.past{background:#FCFCFD}
  .cal2-cell.past .cal2-rows{opacity:.52}
  .cal2-cell.past:hover .cal2-rows{opacity:1}
  .cal2-cell.today{box-shadow:inset 0 0 0 2px #67C1B9}
  .cal2-cell.sel{box-shadow:inset 0 0 0 2px #F98D68}
  .cal2-cell.today.sel{box-shadow:inset 0 0 0 2px #F98D68}
  .cal2-ch{display:flex;align-items:center;justify-content:space-between;gap:5px;flex:none;min-height:22px}
  .cal2-dn{font-size:12px;font-weight:800;color:#64748B;padding-left:3px;font-family:'DM Mono',monospace;background:none}
  .cal2-cell.sel .cal2-dn{display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;
    padding:0;border-radius:999px;background:#F98D68;color:#fff;font-size:11.5px;
    box-shadow:0 4px 12px rgba(249,141,104,.35)}
  .cal2-cell.out .cal2-dn{color:#B6BEC9;font-weight:600}
  .cal2-tb{font-size:8.5px;font-weight:800;letter-spacing:.1em;color:#0E9384;background:none;padding:0}
  .cal2-rows{display:flex;flex-direction:column;gap:3px;min-width:0}
  /* ชิปในช่องวัน · ชื่อเส้นทาง + วงกลมที่นั่งว่าง */
  .cal2-rw{display:flex;align-items:center;justify-content:space-between;gap:5px;border:1px solid;
           border-radius:9px;padding:2px 6px 2px 7px;flex:none;overflow:hidden;font-size:10.5px;font-weight:700;line-height:1.55}
  .cal2-b,.cal2-fill,.cal2-cap{display:none}
  .cal2-n{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.005em}
  .cal2-t{font-size:8.5px;opacity:.6;flex:none;font-weight:600;font-family:'DM Mono',monospace}
  .cal2-v{flex:0 0 auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:inline-flex;
          align-items:center;justify-content:center;font:800 10.5px 'DM Mono',monospace;color:#fff;
          letter-spacing:-.01em;background:#22C55E}
  .cal2-v.full{background:#EF4444}
  .cal2-v.wx{background:#EF4444;font-family:inherit;font-size:9px;padding:0 8px}
  .cal2-v.ch{background:#8B5CF6;font-family:inherit;font-size:9px;padding:0 8px}
  .cal2-shut{background:#F1F5F9;border-color:#E2E8F0;color:#94A3B8}
  .cal2-shut .cal2-n{color:#94A3B8;font-weight:600}
  /* แถบเส้นทาง · เป็นทั้งคำอธิบายสีและตัวกรอง */
  .cal2-routes{flex:none;display:flex;align-items:stretch;gap:6px;overflow-x:auto;padding-bottom:2px}
  .cal2-rc{display:flex;align-items:center;gap:8px;border:1px solid ${ink.line2};border-radius:10px;padding:5px 10px 5px 7px;cursor:pointer;white-space:nowrap;flex:none;background:#fff}
  .cal2-rc.off{opacity:.38}
  .cal2-rc.dead{background:#F3F1EC;border-color:${ink.line2}}
  .cal2-rc i{width:4px;height:22px;border-radius:2px;flex:none;display:block}
  /* แถบท่าที่ปิดทั้งเดือน */
  .cal2-sb{flex:none;display:flex;align-items:center;gap:8px;font-size:10.5px;color:#7d7d75;padding:0 3px;flex-wrap:wrap}
  .cal2-sb .p{display:inline-flex;align-items:center;gap:5px;background:#F3F1EC;border-radius:8px;padding:2px 9px}
  .cal2-sb .p i{width:3px;height:11px;border-radius:2px;background:#c9c5ba;display:inline-block}
  /* ลิ้นชักรายละเอียดวัน */
  /* z-index ต้องสูงกว่า #topbar (300) ไม่งั้นปุ่มปิดจะโดนปุ่ม ... ของแถบบนทับ กดไม่ได้ */
  .cal2-scrim{position:fixed;inset:0;background:rgba(30,30,26,.22);opacity:0;pointer-events:none;transition:opacity .18s;z-index:320}
  .cal2-scrim.on{opacity:1;pointer-events:auto}
  .cal2-dw{position:fixed;top:0;right:0;bottom:0;width:400px;max-width:92vw;background:#fff;border-left:1px solid ${ink.line2};box-shadow:-14px 0 40px rgba(0,0,0,.10);transform:translateX(101%);transition:transform .2s cubic-bezier(.3,.8,.4,1);display:flex;flex-direction:column;z-index:321}
  .cal2-dw.on{transform:none}
  .cal2-dwb{flex:1;overflow:auto;padding:14px 16px 24px}
  .cal2-x{position:absolute;top:13px;right:14px;width:27px;height:27px;border-radius:50%;border:1px solid ${ink.line};background:#fff;cursor:pointer;color:${ink[2]};font-size:15px;line-height:1;z-index:2}
  .cal2-lg{flex:none;display:flex;align-items:center;gap:13px;font-size:10px;color:${ink[2]};padding:0 2px;flex-wrap:wrap}
  </style>`;

  // ── State ──
  if(!window._calSel) window._calSel=TODAY_STR;
  if(!window._calAvgMode) window._calAvgMode='week';
  if(!window._calViewMode){
    window._calViewMode = localStorage.getItem('_cal_view_mode') || 'month'; // 'month' | 'matrix'
  }
  const viewMode = window._calViewMode;
  const viewMonth=`${calYear}-${String(calMonth+1).padStart(2,'0')}`;
  if(!window._calSel.startsWith(viewMonth)){
    window._calSel = TODAY_STR.startsWith(viewMonth) ? TODAY_STR : `${viewMonth}-01`;
  }
  const _sel=window._calSel;
  const avgMode=window._calAvgMode;
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const piers=calPier==='all'?CAL_PIERS.slice():[calPier];

  // ── Aggregate month-wide stats ──
  let monthTrips=0, monthFree=0;
  const routeStat={};  // rid -> {r, trips, free, days:Set}
  const dayStat={};    // ds -> {trips, free, closed{tublamu, panwa, ranong}}
  const routeDay={};   // rid -> { ds -> {free, cap, booked, hasTrip, routeClosed} }
  const closedDaysPier={tublamu:0, panwa:0, ranong:0};
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    dayStat[ds]={trips:0,free:0,closed:{tublamu:false,panwa:false,ranong:false}};
    CAL_PIERS.forEach(pier=>{
      if(_calPierClosed(pier,ds)){ closedDaysPier[pier]++; dayStat[ds].closed[pier]=true; }
    });
    piers.forEach(pier=>{
      if(dayStat[ds].closed[pier]) return;
      // Stats count only trips on OPEN route days (closed-route trips are off-season exceptions)
      _calTripsFor(ds, pier).forEach(({r,free,cap,booked,routeClosed})=>{
        // Build routeDay for matrix view (include closed-route trips for visibility, flagged)
        if(!routeDay[r.id]) routeDay[r.id]={};
        if(!routeDay[r.id][ds]) routeDay[r.id][ds]={free:0,cap:0,booked:0,hasTrip:false,routeClosed:false};
        routeDay[r.id][ds].free+=free;
        routeDay[r.id][ds].cap+=cap;
        routeDay[r.id][ds].booked+=(booked||0);
        routeDay[r.id][ds].hasTrip=true;
        if(routeClosed) routeDay[r.id][ds].routeClosed=true;
        // Always ensure routeStat exists for any route that has any trip (open OR off-season)
        if(!routeStat[r.id]) routeStat[r.id]={r,trips:0,free:0,days:new Set(),offTrips:0,offFree:0};
        if(routeClosed){
          // Off-season exception: track separately, don't pollute month totals
          routeStat[r.id].offTrips++;
          routeStat[r.id].offFree+=free;
          return;
        }
        monthTrips++; monthFree+=free;
        dayStat[ds].trips++; dayStat[ds].free+=free;
        routeStat[r.id].trips++; routeStat[r.id].free+=free; routeStat[r.id].days.add(ds);
      });
    });
  }
  const numWeeks=Math.ceil((firstDay+daysInMonth)/7);
  const weeklyAvg=numWeeks>0?Math.round(monthFree/numWeeks):0;

  // Boats per pier — separate ready (available TODAY) from total fleet at that pier
  const _pierBoatsAll = (pier)=>BOATS.filter(b=>!b.retired && (typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)===pier);
  const tlAll=_pierBoatsAll('tublamu'), vpAll=_pierBoatsAll('panwa'), rnAll=_pierBoatsAll('ranong');
  const tlReady=tlAll.filter(b=>getCurStatus(b,TODAY_STR).s==='available');
  const vpReady=vpAll.filter(b=>getCurStatus(b,TODAY_STR).s==='available');
  const rnReady=rnAll.filter(b=>getCurStatus(b,TODAY_STR).s==='available');
  const tlBoats=tlReady.length, vpBoats=vpReady.length, rnBoats=rnReady.length;
  const tlTotal=tlAll.length, vpTotal=vpAll.length, rnTotal=rnAll.length;
  // Build boat-name pills (full name, color-coded, wraps to multiple rows)
  const _boatPills=(boats)=>{
    if(!boats.length) return '<span style="font-size:10px;color:'+ink[3]+';font-style:italic">no ready boats</span>';
    const pills = boats.map(b=>{
      const col = (typeof getBoatColor==='function'?getBoatColor(b.id):{bg:'#eee',text:'#666'});
      return `<span style="display:inline-flex;align-items:center;height:18px;padding:0 8px;border-radius:9px;background:${col.bg};color:${col.text};font-size:9.5px;font-weight:700;letter-spacing:-.005em;white-space:nowrap">${b.name}</span>`;
    }).join('');
    return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${pills}</div>`;
  };
  const tStat=dayStat[TODAY_STR]||{trips:0,free:0};

  // ── HEADER BAR ──
  // §cal2 · ตัวเลือกช่วงวันที่จะแสดง · เฉพาะโหมดปฏิทิน
  const _rng=_calRange(daysInMonth, viewMonth);
  const _dv=(d)=>`${viewMonth}-${String(d).padStart(2,'0')}`;
  const _mn=`${viewMonth}-01`, _mx=`${viewMonth}-${String(daysInMonth).padStart(2,'0')}`;
  const _pbtn=(n,l)=>`<button onclick="calRangePreset(${n})" style="border:none;background:#F3F1EC;border-radius:11px;padding:4px 10px;font-size:10.5px;font-weight:600;color:#5c5c55;cursor:pointer">${l}</button>`;
  const rangeCtl=`<div style="display:flex;align-items:center;gap:5px;background:white;border:1px solid ${ink.line};border-radius:16px;padding:3px 6px 3px 11px">
    <span style="font-size:11px;color:${ink[3]};font-weight:500">Show</span>
    <input type="date" value="${_dv(_rng.f)}" min="${_mn}" max="${_mx}" onchange="calSetRange('f',this.value)" style="font-family:'DM Mono',monospace;font-size:11px;border:1px solid ${ink.line2};border-radius:9px;padding:3px 6px;color:${ink[1]};background:#FBFAF7">
    <span style="color:${ink[4]};font-size:11px">–</span>
    <input type="date" value="${_dv(_rng.t)}" min="${_mn}" max="${_mx}" onchange="calSetRange('t',this.value)" style="font-family:'DM Mono',monospace;font-size:11px;border:1px solid ${ink.line2};border-radius:9px;padding:3px 6px;color:${ink[1]};background:#FBFAF7">
    ${_pbtn(7,'7 days')}${_pbtn(14,'14 days')}${_pbtn(0,'Full month')}
  </div>`;
  const filterPills=[['all','All'],['tublamu','Tub Lamu'],['panwa','Visit Panwa'],['ranong','Ranong']].map(([v,l])=>{
    const on=calPier===v;
    return `<button onclick="setCalPier('${v}')" style="background:${on?FOREST:'transparent'};color:${on?LIME:ink[2]};border:none;border-radius:14px;padding:4px 12px;font-size:11px;font-weight:${on?600:500};cursor:pointer">${l}</button>`;
  }).join('');
  const headerBar=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0;gap:8px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <button onclick="changeMonth(-1)" style="background:white;border:1px solid ${ink.line};border-radius:50%;width:28px;height:28px;cursor:pointer;color:${ink[2]};display:flex;align-items:center;justify-content:center"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button onclick="changeMonth(1)" style="background:white;border:1px solid ${ink.line};border-radius:50%;width:28px;height:28px;cursor:pointer;color:${ink[2]};display:flex;align-items:center;justify-content:center"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
      <span style="font-size:15px;font-weight:600;color:${ink[1]};margin:0 8px">${MONTHS_EN[calMonth]} ${calYear}</span>
      <div style="display:flex;gap:4px;background:white;border:1px solid ${ink.line};border-radius:18px;padding:2px">${filterPills}</div>
      <div style="display:flex;gap:4px;background:white;border:1px solid ${ink.line};border-radius:18px;padding:2px;margin-left:6px">
        <button onclick="setCalViewMode('month')" style="background:${viewMode==='month'?FOREST:'transparent'};color:${viewMode==='month'?LIME:ink[2]};border:none;border-radius:14px;padding:4px 12px;font-size:11px;font-weight:${viewMode==='month'?600:500};cursor:pointer;display:inline-flex;align-items:center;gap:5px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Month
        </button>
        <button onclick="setCalViewMode('matrix')" style="background:${viewMode==='matrix'?FOREST:'transparent'};color:${viewMode==='matrix'?LIME:ink[2]};border:none;border-radius:14px;padding:4px 12px;font-size:11px;font-weight:${viewMode==='matrix'?600:500};cursor:pointer;display:inline-flex;align-items:center;gap:5px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Matrix
        </button>
      </div>
      ${viewMode==='month'?rangeCtl:''}
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid ${ink.line};border-radius:20px;padding:3px 12px 3px 3px"><div style="width:24px;height:24px;border-radius:50%;background:${PIER_COL.tublamu};color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">TL</div><span style="font-size:11px;font-weight:500">${tlBoats}</span></div>
      <div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid ${ink.line};border-radius:20px;padding:3px 12px 3px 3px"><div style="width:24px;height:24px;border-radius:50%;background:${PIER_COL.panwa};color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">VP</div><span style="font-size:11px;font-weight:500">${vpBoats}</span></div>
      ${rnTotal>0?`<div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid ${ink.line};border-radius:20px;padding:3px 12px 3px 3px"><div style="width:24px;height:24px;border-radius:50%;background:${PIER_COL.ranong};color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">RN</div><span style="font-size:11px;font-weight:500">${rnBoats}</span></div>`:''}
    </div>
  </div>`;

  // ── KPI STRIP ──
  const tlOpenD=daysInMonth-closedDaysPier.tublamu;
  const vpOpenD=daysInMonth-closedDaysPier.panwa;
  const kpiStrip=(viewMode==='month')?'':`<div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">
    <div class="cal-card" style="background:${FOREST};color:white;border-radius:14px;padding:11px 14px">
      <div style="font-size:10px;color:#9BB89B;text-transform:uppercase;letter-spacing:.04em">${MONTHS_EN[calMonth]} ${calYear}</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px"><span style="font-size:30px;font-weight:700;line-height:1;letter-spacing:-1px">${monthTrips}</span><span style="font-size:13px;color:#9BB89B">trips</span></div>
      <div style="margin-top:8px"><span style="background:${LIME};color:${FOREST};padding:2px 9px;border-radius:14px;font-size:10px;font-weight:600">${monthFree.toLocaleString()} seats free · avg ${weeklyAvg}/week</span></div>
    </div>
    <div class="cal-card" style="background:white;border-radius:14px;padding:11px 14px;border:1px solid ${ink.line2}">
      <div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:10px;color:${ink[3]}">Tub Lamu</div><div style="font-size:9px;color:${ink[3]};font-weight:500">ready today</div></div>
      <div style="display:flex;align-items:baseline;gap:5px;margin-top:2px">
        <span style="font-size:20px;font-weight:700;color:${PIER_COL.tublamu};font-family:'DM Mono',monospace;letter-spacing:-.02em">${tlBoats}</span>
        <span style="font-size:11px;color:${ink[3]};font-family:'DM Mono',monospace">/ ${tlTotal}</span>
        <span style="font-size:11px;color:${ink[3]}">boats</span>
      </div>
      ${_boatPills(tlReady)}
      <div style="margin-top:7px;font-size:10px;color:${closedDaysPier.tublamu>daysInMonth/2?'#A32D2D':ink[2]};font-weight:600">${closedDaysPier.tublamu?`Closed ${closedDaysPier.tublamu}/${daysInMonth}d`:'Open all month'}</div>
    </div>
    <div class="cal-card" style="background:${vpOpenD>=daysInMonth/2?LIME_SOFT:'white'};border-radius:14px;padding:11px 14px;border:1px solid ${vpOpenD>=daysInMonth/2?'#C8E29A':ink.line2}">
      <div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:10px;color:${vpOpenD>=daysInMonth/2?LIME_DARK:ink[3]}">Visit Panwa</div><div style="font-size:9px;color:${vpOpenD>=daysInMonth/2?LIME_DARK:ink[3]};font-weight:500">ready today</div></div>
      <div style="display:flex;align-items:baseline;gap:5px;margin-top:2px">
        <span style="font-size:20px;font-weight:700;color:${vpOpenD>=daysInMonth/2?FOREST:PIER_COL.panwa};font-family:'DM Mono',monospace;letter-spacing:-.02em">${vpBoats}</span>
        <span style="font-size:11px;color:${vpOpenD>=daysInMonth/2?LIME_DARK:ink[3]};font-family:'DM Mono',monospace">/ ${vpTotal}</span>
        <span style="font-size:11px;color:${vpOpenD>=daysInMonth/2?LIME_DARK:ink[3]}">boats</span>
      </div>
      ${_boatPills(vpReady)}
      <div style="margin-top:7px;font-size:10px;color:${vpOpenD>=daysInMonth/2?FOREST:ink[2]};font-weight:600">${closedDaysPier.panwa?`Closed ${closedDaysPier.panwa}/${daysInMonth}d`:`Open ${vpOpenD}/${daysInMonth}d`}</div>
    </div>
    <div class="cal-card" style="background:white;border-radius:14px;padding:11px 14px;border:1px solid ${ink.line2}">
      <div style="font-size:10px;color:${ink[3]}">Today</div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:2px"><span style="font-size:20px;font-weight:700">${tStat.free||0}</span><span style="font-size:11px;color:${ink[3]}">free</span></div>
      <div style="margin-top:7px;font-size:10px;color:${ink[2]};font-weight:600">${tStat.trips} trips today</div>
    </div>
  </div>`;

  // ── PER-ROUTE AVG STRIP ──
  // INVERTED (2026-07-08): many free seats = RED (aware, under-sold), few free = GREEN (selling well)
  // Each card tinted by tier so they look visually distinct
  const TIER = {
    high:    {bg:'#FBE9E9', border:'#F5C8C8', color:'#A32D2D',  subColor:'#791F1F', label:'Many free · aware'},
    mid:     {bg:'#FAEEDA', border:'#F5D89D', color:'#854F0B',  subColor:'#633806', label:'Medium'},
    low:     {bg:'#E8F5D8', border:'#C8E29A', color:FOREST,     subColor:LIME_DARK, label:'Almost full · selling'},
    closed:  {bg:'#F1EFE8', border:'#D8D5CC', color:'#888',     subColor:'#888',    label:'Closed / no trips'}
  };
  const routeCards=ROUTES.filter(rt=>calPier==='all' || rt.pier===calPier).map(rt=>{
    // Check all-closed-this-month
    let allClosed=true;
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const _s=getDayStatus(rt,ds);
      if(!_s || _s.type!=='closed'){ allClosed=false; break; }
    }
    const st=routeStat[rt.id];
    const hasOffOnly = st && st.trips===0 && st.offTrips>0;
    if(allClosed || !st || (st.trips===0 && !hasOffOnly)){
      const T=TIER.closed;
      return `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:${T.bg};border-radius:10px;border:1px solid ${T.border};opacity:.7">
        <div style="width:4px;height:28px;background:${rt.color};opacity:.45;border-radius:2px"></div>
        <div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:600;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_calShortName(rt.name)}</div><div style="font-size:9px;color:${T.subColor}">${PIER_LBL[rt.pier]} · ${allClosed?'Closed all month':'No trips'}</div></div>
        <div style="text-align:right"><div style="font-size:16px;font-weight:600;color:${T.color};line-height:1">—</div></div>
      </div>`;
    }
    if(hasOffOnly){
      // Off-season exception only · show warning-style card
      const T=TIER.closed;
      return `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:#FFF6E5;border-radius:10px;border:1px dashed #E5A847">
        <div style="width:4px;height:28px;background:${rt.color};opacity:.55;border-radius:2px"></div>
        <div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:600;color:#7A4B0E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_calShortName(rt.name)}</div><div style="font-size:9px;color:#A05A1A">${PIER_LBL[rt.pier]} · ${st.offTrips}⚠ off-season</div></div>
        <div style="text-align:right"><div style="font-size:16px;font-weight:700;color:#A05A1A;line-height:1;font-family:'DM Mono',monospace">${st.offFree}</div><div style="font-size:9px;color:#A05A1A">free total</div></div>
      </div>`;
    }
    // Calculate weeks where the route actually ran (Sun-anchored)
    const weeksWithTrip=new Set();
    st.days.forEach(ds=>{
      const dt=new Date(ds); const dow=dt.getDay();
      const sun=new Date(dt); sun.setDate(sun.getDate()-dow);
      weeksWithTrip.add(fmt(sun));
    });
    const weeksActive=weeksWithTrip.size || 1;
    let value, valLabel;
    if(avgMode==='week'){ value=Math.round(st.free/weeksActive); valLabel='/week'; }
    else if(avgMode==='day'){ value=Math.round(st.free/(st.days.size||1)); valLabel='/day'; }
    else { value=st.free; valLabel='total'; }
    // Pick tier — thresholds tuned for each mode
    let T;
    if(avgMode==='total'){ T = value>=80?TIER.high : value>=30?TIER.mid : TIER.low; }
    else if(avgMode==='day'){ T = value>=20?TIER.high : value>=10?TIER.mid : TIER.low; }
    else { T = value>=80?TIER.high : value>=20?TIER.mid : TIER.low; }
    const tripsPerWeek=(st.trips/numWeeks).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:${T.bg};border-radius:10px;border:1px solid ${T.border}">
      <div style="width:4px;height:28px;background:${rt.color};border-radius:2px"></div>
      <div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:600;color:${ink[1]};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_calShortName(rt.name)}</div><div style="font-size:9px;color:${T.subColor};font-weight:500">${PIER_LBL[rt.pier]} · ${tripsPerWeek} trips/week</div></div>
      <div style="text-align:right"><div style="font-size:18px;font-weight:700;color:${T.color};line-height:1">${value}</div><div style="font-size:9px;color:${T.subColor};font-weight:500">free ${valLabel}</div></div>
    </div>`;
  }).join('');
  const avgToggle=[['week','Weekly'],['day','Daily'],['total','Total']].map(([v,l])=>{
    const on=avgMode===v;
    return `<button onclick="setCalAvgMode('${v}')" style="background:${on?FOREST:'transparent'};color:${on?LIME:ink[2]};border:none;border-radius:10px;padding:2px 10px;font-size:10px;font-weight:${on?600:500};cursor:pointer">${l}</button>`;
  }).join('');
  const routeStrip=`<div class="cal-card" style="background:white;border-radius:14px;border:1px solid ${ink.line2};padding:10px 12px;margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;font-weight:600;color:${FOREST};text-transform:uppercase;letter-spacing:.05em">Avg seats free · per route</span><span style="font-size:10px;color:${ink[3]}">Counts only days/weeks the route actually ran</span></div>
      <div style="display:flex;gap:4px;background:#F4F2EE;border-radius:14px;padding:2px">${avgToggle}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">${routeCards}</div>
  </div>`;

  // ── §cal2 · แถบเส้นทาง · คำอธิบายสี + ตัวกรอง (คลิกซ่อน/แสดง) ──
  const _hidRt=_calGetHiddenRoutes();
  //   เส้นทางที่มีเที่ยวออกขึ้นก่อน เรียงตามเวลาเรือออก · ที่ไม่ออกเลยไปต่อท้าย
  //   (ไม่งั้นเส้นทางนอกฤดูดันเส้นทางที่ใช้จริงหลุดออกนอกจอ)
  const _rtSorted=ROUTES.filter(rt=>calPier==='all'||rt.pier===calPier).slice().sort((a,b)=>{
    const da=(routeStat[a.id]&&routeStat[a.id].days.size)?0:1;
    const db=(routeStat[b.id]&&routeStat[b.id].days.size)?0:1;
    if(da!==db) return da-db;
    const dm=_calDepMin(a)-_calDepMin(b); if(dm) return dm;
    return String(a.name||'').localeCompare(String(b.name||''));
  });
  const routeStrip2=`<div class="cal2-routes">`+_rtSorted.map(rt=>{
    const st=routeStat[rt.id];
    const dd=st?st.days.size:0;
    const dead=!dd;
    const per=dd?Math.round(st.free/dd):0;
    const col=dead?'#8a8a82':_calDk(rt.color,.45);
    const dep=((rt.times||[])[0]||'').trim();
    return `<div class="cal2-rc${dead?' dead':''}${_hidRt.has(rt.id)?' off':''}" title="${rt.name}"
      onclick="${_hidRt.has(rt.id)?`calUnhideRoute('${rt.id}')`:`calHideRoute('${rt.id}')`}"
      style="${dead?'':`background:${_calRgba(rt.color,.07)};border-color:${_calRgba(rt.color,.30)}`}">
      <i style="background:${rt.color};${dead?'opacity:.4':''}"></i>
      <div><div style="font-size:11.5px;font-weight:${dead?500:600};color:${dead?ink[3]:ink[1]};line-height:1.25">${_calName(rt)}
        <span onclick="event.stopPropagation();calEditRouteName('${rt.id}')" title="Rename for the calendar" style="opacity:.34;font-size:11px;cursor:pointer;padding:0 2px">&#9998;</span></div>
        <div style="font-size:9.5px;color:${ink[3]};line-height:1.25">${PIER_LBL[rt.pier]||'?'} &middot; ${dead?'no trips':dd+' day'+(dd>1?'s':'')+(dep?' · '+dep:'')}</div></div>
      <div style="margin-left:6px;text-align:right"><div style="font-size:15px;font-weight:700;line-height:1;color:${col};font-family:'DM Mono',monospace">${dead?'—':per}</div>
        <div style="font-size:9px;color:${ink[3]};margin-top:2px">${dead?'':'free/day'}</div></div>
    </div>`;
  }).join('')+`</div>`;

  // ── §cal2 · ท่าที่ปิดทั้งเดือน · บอกครั้งเดียว ไม่ต้องซ้ำในทุกช่องวัน ──
  const _shutAll=piers.filter(p=>closedDaysPier[p]>=daysInMonth);
  const _openP=piers.filter(p=>closedDaysPier[p]<daysInMonth);
  // §calHead/§bar · แถบนี้ถูกยุบไปแล้ว · "คลิกวันไหนก็ได้" ย้ายไปอยู่แถวคำอธิบายล่าง
  //   ส่วนท่าที่ไม่มีเที่ยว อ่านได้จากชิปเส้นทางเหนือปฏิทิน ซึ่งบอกละเอียดกว่า
  const shutBar='';

  // ── §cal2 · ปฏิทินเต็มหน้า ────────────────────────────────────────
  /* §calChip · ความสด/ขนาด/สีตัวเลข ที่ผู้ใช้ตั้งไว้ · ใช้ทั้งชิปในช่องวันและคำอธิบายล่าง */
  const _chip=calChipCfg();
  const _chSz=CAL_CHIP_SZ[_chip.sz], _chIk=CAL_CHIP_INK[_chip.ik];
  const _chVst=(full)=>`min-width:${_chSz.h}px;height:${_chSz.h}px;padding:0 ${_chSz.p}px;font-size:${_chSz.f}px;`
    +`background:${full?_chIk.bgf:_chIk.bg};color:${full?_chIk.fgf:_chIk.fg}`;
  const _chSkin=(col)=>{ const v=_calVivid(col);
    return (_chip.st==='D') ? {bg:v, bd:v, c:'#fff'}
                            : {bg:_calRgba(v,.30), bd:_calRgba(v,.65), c:_calDk(v,.34)}; };
  let cells2='';
  for(let i=0;i<firstDay;i++) cells2+='<div class="cal2-cell pad"></div>';
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const on=(d>=_rng.f && d<=_rng.t);
    const isToday=ds===TODAY_STR, isSel=ds===_sel;
    let rowsHtml='';
    if(on){
      // รวมทุกลำของเส้นทางเดียวกันเป็นแถวเดียว · เดิมแยกทีละลำ ชื่อซ้ำกันสองสามแถว
      const gmap={}; const shutToday=[];
      piers.forEach(pier=>{
        if(_calPierClosed(pier,ds)){ if(closedDaysPier[pier]<daysInMonth) shutToday.push(pier); return; }
        _calTripsFor(ds,pier).forEach(t=>{
          if(_hidRt.has(t.r.id)) return;
          const g=gmap[t.r.id]||(gmap[t.r.id]={r:t.r,free:0,cap:0,nb:0,wx:false,ch:false});
          g.free+=(t.weatherClosed?0:t.free); g.cap+=t.cap; g.nb++;
          if(t.weatherClosed) g.wx=true;
          if(t.isCharter) g.ch=true;
        });
      });
      // §เรียงตามเวลาเรือออก · เวลาเท่ากันเรียงตามชื่อ
      const list=Object.values(gmap).sort((a,b)=>{
        const dm=_calDepMin(a.r)-_calDepMin(b.r); if(dm) return dm;
        return String(a.r.name||'').localeCompare(String(b.r.name||''));
      });
      rowsHtml=list.map(g=>{
        const pct=g.cap>0?Math.round((g.cap-g.free)/g.cap*100):0;
        const full=(g.free<=0 && g.cap>0);
        /* §calSkin · ในช่องวันโชว์แค่ที่นั่งว่างตัวเดียว เป็นวงกลมเขียวสด · หมดแล้วเป็นแดง
           ความจุกับ % ที่ขายไปอ่านได้จาก tooltip และจากแผงซ้าย */
        let vCls='cal2-v', vTxt=String(g.free);
        if(g.wx){ vCls='cal2-v wx'; vTxt='WX'; }
        else if(g.ch && g.free<=0){ vCls='cal2-v ch'; vTxt='CH'; }
        else if(full){ vCls='cal2-v full'; }
        const tip=`${g.r.name} · ${g.free} of ${g.cap} seats free · ${pct}% sold`
          +(g.nb>1?` · ${g.nb} boats`:'')+(g.wx?' · weather cancelled':'')+(g.ch?' · charter':'');
        const sk=_chSkin(g.r.color);
        return `<div class="cal2-rw" title="${tip}" style="background:${sk.bg};border-color:${sk.bd};color:${sk.c}">
          <span class="cal2-n">${_calName(g.r)}</span>
          ${g.nb>1?`<span class="cal2-t">${g.nb}b</span>`:''}
          <span class="${vCls}" style="${_chVst(full)}">${vTxt}</span>
        </div>`;
      }).join('')
      // ท่าที่ปิดเฉพาะวันนี้ (ไม่ได้ปิดทั้งเดือน) ยังต้องบอก
      +shutToday.map(p=>`<div class="cal2-rw cal2-shut"><span class="cal2-n">Closed &middot; ${PIER_LBL[p]}</span></div>`).join('');
    }
    // §cal2e · อดีต = ก่อนวันนี้ · วันนี้ยังขายได้ ไม่นับ
    const isPast=(ds<TODAY_STR);
    const cls='cal2-cell'+(!on?' out':(isSel?' sel':(isToday?' today':(isPast?' past':''))));
    cells2+=`<div class="${cls}" ${on?`onclick="calSelDay('${ds}')"`:''}>
      <div class="cal2-ch"><span class="cal2-dn">${d}</span>${(on&&isToday&&!isSel)?'<span class="cal2-tb">TODAY</span>':''}</div>
      <div class="cal2-rows">${rowsHtml}</div>
    </div>`;
  }
  const _mo3=(MONTHS_EN[calMonth]||'').slice(0,3);
  const _rngLbl=(_rng.f===1 && _rng.t===daysInMonth)
    ? `Full month · ${daysInMonth} days`
    : `${_rng.f}–${_rng.t} ${_mo3} · ${_rng.t-_rng.f+1} days`;
  // §calHead · เส้นทางที่ "มีเที่ยวเดือนนี้ และไม่ได้ถูกซ่อน" · เหลือลำพังเส้นทางเดียวเมื่อไร หัวเดือนเปลี่ยนตาม
  const _visRt=_rtSorted.filter(rt=>{ const st=routeStat[rt.id]; return st && st.days.size && !_hidRt.has(rt.id); });
  const _mbOne=(_visRt.length===1)?_visRt[0]:null;
  /* §calSkin · หัวปฏิทิน · ชื่อเดือนซ้าย ป้ายสรุปขวา */
  /* §calChip · แผงตั้งค่าเล็ก ๆ · เปิดค้างไว้ได้ระหว่างลองกดหลายอัน */
  const _sgBtn=(key,cur,arr)=>`<div class="sg">`+arr.map(o=>
      `<button class="${o[0]===cur?'on':''}" onclick="calChipSet('${key}','${o[0]}')">${o[1]}</button>`).join('')+`</div>`;
  const _chipPop=`<div class="calx-cfgw">
      <button class="calx-cfg" onclick="calChipPop(event)" title="How route chips are coloured"><i></i>Chip style</button>
      <div class="calx-pop${window._calChipOpen?' on':''}" id="cal-chippop" onclick="event.stopPropagation()">
        <div class="ph">Chip style</div>
        ${_sgBtn('la_cal_chip',_chip.st,[['C','Tinted'],['D','Solid']])}
        <div class="ph">Seats number</div>
        ${_sgBtn('la_cal_chipsz',_chip.sz,[['M','M'],['L','L'],['XL','XL'],['XXL','XXL']])}
        <div class="ph">Number colour</div>
        ${_sgBtn('la_cal_chipink',_chip.ik,[['white','White'],['deep','Deep'],['ink','Ink'],['soft','Soft']])}
        <div class="pf">Route colours themselves are not changed here &mdash; only how strongly they are painted.
          Saved on this device.</div>
      </div>
    </div>`;
  const _stats=`<div class="st">`
    +`<span>Trips this month<b>${monthTrips}</b></span>`
    +`<span class="g">Seats free<b>${monthFree.toLocaleString()}</b></span>`
    +`<span>Avg / week<b>${weeklyAvg}</b></span>`
    +`<span>${_rngLbl}</span>`
    +_chipPop
   +`</div>`;
  const monthBar = _mbOne
    ? `<div class="cal2-mb"><div class="mo"><span class="bar" style="background:${_mbOne.color}"></span>${_calName(_mbOne)} &middot; ${MONTHS_EN[calMonth]} ${calYear}</div>${_stats}</div>`
    : `<div class="cal2-mb"><div class="mo">${MONTHS_EN[calMonth]} ${calYear}</div>${_stats}</div>`;

  /* §calSkin · แผงวันที่ทางซ้าย · ใช้ตัวจัดกลุ่มชุดเดียวกับช่องวัน จะได้ตรงกันเสมอ */
  const _selD=+String(_sel).slice(-2);
  const _selDT=new Date(_sel+'T12:00:00');
  const _DOWL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const _selGroups=(function(){
    const gmap={}, shut=[];
    piers.forEach(pier=>{
      if(_calPierClosed(pier,_sel)){ shut.push(pier); return; }
      _calTripsFor(_sel,pier).forEach(t=>{
        if(_hidRt.has(t.r.id)) return;
        const g=gmap[t.r.id]||(gmap[t.r.id]={r:t.r,free:0,cap:0,nb:0,wx:false,ch:false});
        g.free+=(t.weatherClosed?0:t.free); g.cap+=t.cap; g.nb++;
        if(t.weatherClosed) g.wx=true;
        if(t.isCharter) g.ch=true;
      });
    });
    return {list:Object.values(gmap).sort((a,b)=>{
      const dm=_calDepMin(a.r)-_calDepMin(b.r); if(dm) return dm;
      return String(a.r.name||'').localeCompare(String(b.r.name||''));
    }), shut:shut};
  })();
  const _selFree=_selGroups.list.reduce((a,g)=>a+g.free,0);
  const _sideCards=_selGroups.list.length
    ? _selGroups.list.map(g=>{
        const full=(g.free<=0 && g.cap>0);
        const dep=((g.r.times||[])[0]||'').trim();
        const pct=g.cap>0?Math.round((g.cap-g.free)/g.cap*100):0;
        /* §calChip2 · ใช้ความสดชุดเดียวกับชิปในช่องวัน · เลือก Solid แล้วต้องสดทั้งสองฝั่ง */
        const v=_calVivid(g.r.color), solid=(_chip.st==='D');
        const cBg = solid ? v : _calRgba(v,.16);
        const cBd = solid ? v : _calRgba(v,.42);
        const cTm = solid ? 'rgba(255,255,255,.22)' : _calRgba(v,.24);
        const cFg = solid ? '#fff' : _calDk(v,.34);
        const cNm = solid ? '#fff' : _calDk(v,.36);
        const cSv = full ? (solid?'#fff':'#B91C1C') : (solid?'#fff':_calDk(v,.28));
        return `<div class="calx-tc" onclick="calOpenDay('${_sel}')"
            title="${g.r.name} · ${g.free} of ${g.cap} seats free · ${pct}% sold"
            style="background:${cBg};border-color:${cBd}">
          <div class="r1">
            <span class="tm" style="background:${cTm};color:${cFg}">${dep||'--:--'}</span>
            <span class="pr" style="color:${cFg};opacity:.8">${PIER_NAME[g.r.pier]||g.r.pier||''}${g.nb>1?(' · '+g.nb+' boats'):''}</span>
          </div>
          <div class="r2"><span class="rn" style="color:${cNm}">${_calName(g.r)}</span>
            <span class="sv${full?' f':''}" style="color:${cSv}">${full?'FULL':g.free}</span></div>
        </div>`; }).join('')
    : `<div class="calx-empty">No trips scheduled on this day</div>`;
  const _sideShut=_selGroups.shut.length
    ? _selGroups.shut.map(p=>PIER_LBL[p]).join(' · ') : 'None';
  const calSide=`<div class="calx-side">
    <div class="calx-sh"><span class="t">Selected date</span>
      <button class="calx-now" onclick="calSelDay('${TODAY_STR}')">Today</button></div>
    <div class="calx-day">${_selD}</div>
    <div class="calx-dn2">${_DOWL[isNaN(_selDT)?0:_selDT.getDay()]}</div>
    <div class="calx-meta">${_selD} ${MONTHS_EN[calMonth]} ${calYear}<br>
      <b>${_selGroups.list.length} boat trip${_selGroups.list.length===1?'':'s'}</b> &middot; <b>${_selFree}</b> seats free</div>
    <hr class="calx-hr">
    <div class="calx-lhd"><span class="t">Boat schedules &amp; seats</span></div>
    <div class="calx-list">${_sideCards}</div>
    <div class="calx-foot">Closed piers today &middot; <b>${_sideShut}</b><br>
      Click a day in the calendar to change the date
      <button class="calx-more" onclick="calOpenDay('${_sel}')">Boat-level detail &rarr;</button></div>
  </div>`;

  const calLegend=`<div class="cal2-lg">
    <span>Chip colour = route</span>
    <span style="display:inline-flex;align-items:center;gap:6px">Seats free
      <span style="display:inline-flex;align-items:center;justify-content:center;border-radius:999px;
        font-family:'DM Mono',monospace;font-weight:800;${_chVst(false)}">13</span></span>
    <span style="display:inline-flex;align-items:center;gap:6px">Sold out
      <span style="display:inline-flex;align-items:center;justify-content:center;border-radius:999px;
        font-family:'DM Mono',monospace;font-weight:800;${_chVst(true)}">0</span></span>
    <span>Sorted by departure time</span>
    <span style="margin-left:auto;color:#a5a29a">Click a day to select it &middot; the pencil on a route chip renames it here</span>
  </div>`;

  const calGrid2=`<div class="cal2-box">
    ${calSide}
    <div class="calx-pane">
      ${monthBar}
      <div class="cal2-wd">${WDS.map(w=>`<div>${w}</div>`).join('')}</div>
      <div class="cal2-grid">${cells2}</div>
      ${calLegend}
    </div>
  </div>`;
  const legend2='';   /* §calSkin · ย้ายเข้าไปอยู่ท้ายการ์ดปฏิทินแล้ว */
  const _legend2Old=`<div class="cal2-lg">
    <span>Card colour = route colour</span>
    <span style="display:inline-flex;align-items:center;gap:6px">Left bar = seats sold
      <span style="display:inline-block;width:56px;height:11px;border-radius:3px;background:rgba(31,77,44,.11);position:relative">
        <span style="position:absolute;left:0;top:0;bottom:0;width:62%;border-radius:3px 0 0 3px;background:rgba(31,77,44,.26)"></span></span></span>
    <span style="display:inline-flex;align-items:center;gap:6px">Seats free
      <span style="background:#DFF3E9;color:#0B6B4F;border-radius:7px;padding:1px 7px;font-weight:700;font-size:10.5px;font-family:'DM Mono',monospace">13</span>
      &middot; sold out <span style="background:#FBE0DE;color:#A32D2D;border-radius:7px;padding:1px 7px;font-weight:700;font-size:10px">Full</span></span>
    <span>Sorted by departure time</span>
    <span style="display:inline-flex;align-items:center;gap:6px">Past days dimmed
      <span style="display:inline-block;width:22px;height:11px;border-radius:3px;background:#EDEBE4"></span></span>
    <span style="margin-left:auto;color:#a5a29a">Click any day for boat-level detail &middot; pencil on a route chip renames it here</span>
  </div>`;

  // ── CALENDAR GRID (โหมด Matrix ยังใช้ของเดิม) ──
  const PINK_SOFT='#FCE5EC';
  const wdHdr=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:10px;padding:8px 6px;border-radius:10px;background:${PINK_SOFT};font-size:10.5px;color:#9F1B4F;text-align:center;font-weight:700;letter-spacing:.08em">${WDS.map(w=>`<div>${w}</div>`).join('')}</div>`;
  let cells='';
  for(let i=0;i<firstDay;i++) cells+=`<div style="min-height:92px;background:#FAFAF8;border-radius:10px;border:1px dashed rgba(0,0,0,.04)"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=ds===TODAY_STR;
    const isSel=ds===_sel;
    let inner='';
    let shownCount=0;
    piers.forEach(pier=>{
      if(shownCount>=3) return;
      const trips=_calTripsFor(ds, pier);
      // If pier closed AND no trips assigned at all → show "ปิด" badge
      if(_calPierClosed(pier,ds) && trips.length===0){
        const lbl = piers.length>1?`Closed ${PIER_LBL[pier]}`:'Closed';
        inner+=`<div style="display:flex;align-items:center;gap:4px;padding:3px 6px;background:#F1EFE8;border-radius:5px;margin-top:3px"><span style="width:3px;height:10px;background:#aaa;border-radius:2px;flex-shrink:0"></span><span style="font-size:9.5px;color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${lbl}</span></div>`;
        shownCount++;
        return;
      }
      trips.slice(0, Math.max(1, 3-shownCount)).forEach(({r,free,cap,routeClosed})=>{
        if(routeClosed){
          // Trip assigned on Program-closed day → show as warning (gray + ⚠)
          inner+=`<div style="display:flex;align-items:center;gap:4px;padding:3px 6px;background:#F1EFE8;border-radius:5px;margin-top:3px;opacity:.85" title="${r.name} · Program closed · ${free} free (off-season)">
            <span style="width:3px;height:10px;background:#aaa;border-radius:2px;flex-shrink:0"></span>
            <span style="font-size:9.5px;color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">⚠ ${_calShortName(r.name)}</span>
            <span style="font-size:9.5px;font-weight:700;color:#888;font-family:'DM Mono',monospace">${free}</span>
          </div>`;
        } else {
          const pct=cap>0?Math.round((cap-free)/cap*100):0;
          const isFull=free<=0 && cap>0;
          const c=isFull?FOREST:colorFor(pct);
          const bg=isFull?'#BCE595':bgFor(pct);
          inner+=`<div style="display:flex;align-items:center;gap:4px;padding:3px 6px;background:${bg};border-radius:5px;margin-top:3px" title="${r.name} · ${isFull?'Full':free+' free'}">
            <span style="width:3px;height:10px;background:${r.color};border-radius:2px;flex-shrink:0"></span>
            <span style="font-size:9.5px;color:${c};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${_calShortName(r.name)}</span>
            <span style="font-size:9.5px;font-weight:700;color:${c};font-family:'DM Mono',monospace">${isFull?'✕':free}</span>
          </div>`;
        }
        shownCount++;
      });
    });
    // More chips indicator if there are more trips than shown
    const totalTrips = piers.reduce((s,p)=>s+_calTripsFor(ds,p).length,0);
    if(totalTrips > shownCount){
      inner+=`<div style="margin-top:3px;font-size:9px;color:${ink[3]};text-align:center;font-weight:500">+${totalTrips-shownCount} more</div>`;
    }
    let cellStyle=`background:white;border:1px solid ${ink.line2};border-radius:10px;padding:7px 6px;min-height:92px;cursor:pointer;transition:all .12s`;
    if(isSel) cellStyle=`background:#FFF8F4;border:1.5px solid #C75A33;border-radius:10px;padding:7px 6px;min-height:92px;cursor:pointer;box-shadow:0 0 0 3px rgba(199,90,51,.08)`;
    else if(isToday) cellStyle=`background:#FFFCFA;border:1.5px solid #E8B59B;border-radius:10px;padding:7px 6px;min-height:92px;cursor:pointer`;
    const numColor=(isSel||isToday)?'#C75A33':ink[1];
    const numWeight=(isSel||isToday)?700:600;
    cells+=`<div style="${cellStyle}" onclick="showCalDay('${ds}')" onmouseover="if(!this.dataset.sel)this.style.borderColor='rgba(0,0,0,.16)'" onmouseout="if(!this.dataset.sel)this.style.borderColor='${(isSel||isToday)?(isSel?'#C75A33':'#E8B59B'):'rgba(0,0,0,.07)'}'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:13px;color:${numColor};font-weight:${numWeight};font-family:'DM Mono',monospace;letter-spacing:-.02em">${d}</span>
        ${isToday?'<span style="font-size:8.5px;color:#C75A33;font-weight:700;background:#FFE6D9;padding:1px 5px;border-radius:5px;letter-spacing:.04em;text-transform:uppercase">Today</span>':''}
      </div>
      ${inner}
    </div>`;
  }
  const calGrid=`<div class="cal-card" style="background:white;border-radius:14px;padding:14px;border:1px solid ${ink.line2}">
    ${wdHdr}
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">${cells}</div>
    <div style="display:flex;gap:14px;font-size:10px;color:${ink[2]};margin-top:10px;align-items:center;flex-wrap:wrap;padding-top:8px;border-top:1px solid ${ink.line2}">
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:${FOREST}"></div>Full</div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#3B6D11"></div>Selling</div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#8A6A0B"></div>Medium</div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#B4600F"></div>Under-sold</div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#A32D2D"></div>Many free</div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#aaa"></div>Closed</div>
      <div style="display:flex;align-items:center;gap:6px;margin-left:auto;background:${LIME_SOFT};padding:4px 10px;border-radius:14px"><span style="color:${LIME_DARK};font-size:10px;font-weight:500">Month avg</span><span style="color:${FOREST};font-weight:700;font-size:11px">${weeklyAvg} free/week</span></div>
    </div>
  </div>`;

  // ── SIDE PANEL ──
  const selDateObj=new Date(_sel);
  const selFmtTitle=selDateObj.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'});
  const selIsToday=_sel===TODAY_STR;
  // Week stats (Sun–Sat of selected day)
  const selDow=selDateObj.getDay();
  const weekStartD=new Date(selDateObj); weekStartD.setDate(weekStartD.getDate()-selDow);
  const weekEndD=new Date(weekStartD); weekEndD.setDate(weekEndD.getDate()+6);
  let weekFree=0, weekTrips=0, weekDays=0;
  for(let i=0;i<7;i++){
    const wd=new Date(weekStartD); wd.setDate(wd.getDate()+i);
    const wds=fmt(wd);
    const inMonth=wds.startsWith(viewMonth);
    const st=inMonth?dayStat[wds]:null;
    if(st){ weekFree+=st.free; weekTrips+=st.trips; if(st.trips>0) weekDays++; }
    else {
      let hasTrip=false;
      piers.forEach(pier=>{
        if(_calPierClosed(pier,wds)) return;
        _calTripsFor(wds,pier).forEach(({free,routeClosed})=>{ if(routeClosed) return; weekFree+=free; weekTrips++; hasTrip=true; });
      });
      if(hasTrip) weekDays++;
    }
  }
  const weekAvgPerDay=weekDays>0?Math.round(weekFree/weekDays):0;
  const wsM=weekStartD.getDate(), wsMon=weekStartD.getMonth();
  const weM=weekEndD.getDate(), weMon=weekEndD.getMonth();
  const weekRange=wsMon===weMon?`${wsM}–${weM} ${MONTHS_TH_SHORT[wsMon]}`:`${wsM} ${MONTHS_TH_SHORT[wsMon]} – ${weM} ${MONTHS_TH_SHORT[weMon]}`;

  // Apply same hidden-routes filter as Matrix view → Selected day only shows visible routes
  const _hiddenRoutesPanel = _calGetHiddenRoutes();
  const panelSections=piers.map(pier=>{
    const isClosed=_calPierClosed(pier,_sel);
    const isPanwa=pier==='panwa';
    const tripsAll=_calTripsFor(_sel, pier);
    const trips=tripsAll.filter(t => !_hiddenRoutesPanel.has(t.r.id));
    const hiddenCnt = tripsAll.length - trips.length;
    const validTrips=trips.filter(t=>!t.routeClosed);
    const closedTrips=trips.filter(t=>t.routeClosed);
    const headerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;background:${isPanwa?FOREST:PIER_COL[pier]};color:${isPanwa?LIME:'white'};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700">${PIER_LBL[pier]}</div><span style="font-size:12px;font-weight:600;color:${isPanwa?FOREST:ink[1]}">${PIER_NAME[pier]} Pier</span>`;
    // Empty + closed pier → show "ปิดทั้งท่า" message
    if(isClosed && trips.length===0){
      return `<div style="margin-top:14px;padding-bottom:12px;border-bottom:1px solid ${ink.line2}">
        ${headerHTML}<span style="margin-left:auto;font-size:10px;color:${ink[2]}">Pier closed</span></div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#F1EFE8;border-radius:8px"><div style="width:4px;height:24px;background:#aaa;border-radius:2px"></div><span style="font-size:11px;color:${ink[2]}">Closed · Program</span></div>
      </div>`;
    }
    if(!trips.length){
      return `<div style="margin-top:14px;padding-bottom:12px;border-bottom:1px solid ${ink.line2}">
        ${headerHTML}<span style="margin-left:auto;font-size:10px;color:${ink[3]}">No trips</span></div>
        <div style="padding:8px 10px;font-size:11px;color:${ink[3]}">—</div>
      </div>`;
    }
    const totalFree=validTrips.reduce((s,t)=>s+(t.weatherClosed?0:t.free),0);
    const wxTripsCnt=validTrips.filter(t=>t.weatherClosed).length;
    // Group trips by route — same route's boats are combined into one card
    const _groupByRoute=(trips)=>{
      const map={};
      trips.forEach(t=>{
        if(!map[t.r.id]) map[t.r.id]={r:t.r, items:[]};
        map[t.r.id].items.push(t);
      });
      return Object.values(map);
    };
    const validGroups = _groupByRoute(validTrips);
    const closedGroups = _groupByRoute(closedTrips);

    const renderGroup=(g, isClosedGroup)=>{
      const r=g.r;
      const items=g.items;
      // Weather-cancelled route → show cancellation summary instead of free seats
      if(!isClosedGroup && items.some(t=>t.weatherClosed)){
        const wc=(typeof bkV2WeatherCountsFor==='function')?bkV2WeatherCountsFor(r.id,_sel):{cancelled:0,rescheduled:0,pending:0,total:0};
        const boatNames=items.map(t=>t.b.name).join(', ');
        return `<div style="padding:10px;border-radius:8px;border:1px solid #E89A92;background:#FDEEEC;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:4px;height:30px;background:#A32D2D;border-radius:2px"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12.5px;font-weight:700;color:#A32D2D;line-height:1.25">&#9928; ${r.name}</div>
              <div style="font-size:10px;color:#9a3b30;margin-top:1px">Cancelled (weather) · ${boatNames}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:20px;font-weight:700;color:#A32D2D;line-height:1;font-family:'DM Mono',monospace">${wc.total}</div>
              <div style="font-size:9px;color:#9a3b30">pax affected</div>
            </div>
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <span style="font-size:10px;font-weight:600;background:#fff;border:1px solid #E89A92;color:#185FA5;padding:3px 9px;border-radius:7px">&#8635; Rescheduled ${wc.rescheduled}</span>
            <span style="font-size:10px;font-weight:600;background:#fff;border:1px solid #E89A92;color:#A32D2D;padding:3px 9px;border-radius:7px">&#10005; Cancelled ${wc.cancelled}</span>
            ${wc.pending>0?`<span style="font-size:10px;font-weight:600;background:#fff;border:1px solid #E89A92;color:#7A4A00;padding:3px 9px;border-radius:7px">&#8230; Pending ${wc.pending}</span>`:''}
          </div>
        </div>`;
      }
      // Charter boats are excluded from the seat free/cap calc (whole boat taken · not sellable seats)
      const _seatItems=items.filter(t=>!t.isCharter);
      const totalFreeG=_seatItems.reduce((s,t)=>s+t.free,0);
      const totalCapG=_seatItems.reduce((s,t)=>s+t.cap,0);
      const totalBookedG=_seatItems.reduce((s,t)=>s+t.booked,0);
      const pct=totalCapG>0?Math.round(totalBookedG/totalCapG*100):0;
      const isFull=totalFreeG<=0 && totalCapG>0;
      const c=isClosedGroup?'#888':(isFull?'#A32D2D':colorFor(pct));
      const bg=isClosedGroup?'#F1EFE8':'';
      const border=isClosedGroup?'1px solid rgba(0,0,0,.04)':`1px solid ${ink.line2}`;
      const rs=routeStat[r.id];
      const routeAvg=rs && rs.days.size>0 ? Math.round(rs.free/rs.days.size) : 0;
      let diffLabel='', diffColor=ink[2];
      if(!isClosedGroup && routeAvg>0){
        const diff=Math.round((totalFreeG-routeAvg)/routeAvg*100);
        if(diff>=10){ diffLabel=`▴ +${diff}% vs avg`; diffColor=FOREST; }
        else if(diff<=-10){ diffLabel=`▾ ${diff}% vs avg`; diffColor='#A32D2D'; }
        else { diffLabel='~ at avg'; diffColor=ink[2]; }
      }
      // Boat sub-rows (always show when >= 1 boat — when 1 boat we can skip header detail but keep card)
      const boatRowsHtml = items.map(t=>{
        const bAvatar=(typeof getBoatColor==='function'?getBoatColor(t.b.id):{bg:'#eee',text:'#666'});
        let rightHtml;
        if(t.isCharter){
          // chartered whole boat → show a Charter badge + the charter pax (not free seats)
          rightHtml = `<span style="font-size:8px;font-weight:700;color:#5B289A;background:#EEEAFB;border:1px solid #D5C9F0;padding:1px 6px;border-radius:5px;letter-spacing:.02em">เหมาลำ</span><span style="font-size:12px;font-weight:700;color:#5B289A;font-family:'DM Mono',monospace;letter-spacing:-.01em">${t.booked}</span><span style="font-size:9px;color:${ink[4]}">/ ${t.cap}</span>`;
        } else {
          const bPct=t.cap>0?Math.round(t.booked/t.cap*100):0;
          const bColor=isClosedGroup?'#888':(t.free<=0&&t.cap>0?'#A32D2D':colorFor(bPct));
          rightHtml = `<span style="font-size:12px;font-weight:700;color:${bColor};font-family:'DM Mono',monospace;letter-spacing:-.01em">${t.free<=0?'✕':t.free}</span><span style="font-size:9px;color:${ink[4]}">/ ${t.cap}</span>`;
        }
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 4px 5px 0;border-bottom:1px solid ${ink.line2}">
          <span style="display:inline-flex;align-items:center;height:18px;padding:0 8px;border-radius:9px;background:${bAvatar.bg};color:${bAvatar.text};font-size:9.5px;font-weight:700;flex-shrink:0;white-space:nowrap">${t.b.name}</span>
          <span style="font-size:9.5px;color:${ink[3]};font-family:'DM Mono',monospace">${(r.times||[]).join(' / ')||'—'}</span>
          <span style="flex:1"></span>
          ${rightHtml}
        </div>`;
      }).join('');
      // Remove last border
      const boatRowsFinal = boatRowsHtml.replace(/border-bottom:1px solid [^"]+;"(?=[^"]*<\/div>(?:(?!<div ).)*$)/, '"');
      const showSubRows = items.length >= 1;  // always show — keeps consistent UI
      return `<div style="padding:10px;border-radius:8px;border:${border};margin-bottom:6px;${bg?`background:${bg};`:''}">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:4px;height:30px;background:${isClosedGroup?'#aaa':r.color};border-radius:2px"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:600;color:${isClosedGroup?'#666':ink[1]};line-height:1.25">${isClosedGroup?'⚠ ':''}${r.name}</div>
            <div style="font-size:10px;color:${ink[2]};margin-top:1px">${items.length} boat${items.length>1?'s':''} · ${(r.times||[]).join(' / ')||'—'}${isClosedGroup?' · Program closed (off-season)':''}</div>
            ${!isClosedGroup?`<div style="margin-top:5px;height:3px;background:#F1EFE8;border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${c}"></div></div>`:''}
          </div>
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:700;color:${c};line-height:1;font-family:'DM Mono',monospace;letter-spacing:-.02em">${isFull?'✕':totalFreeG}</div>
            <div style="font-size:9px;color:${ink[4]}">/ ${totalCapG} free</div>
          </div>
        </div>
        ${showSubRows ? `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed ${ink.line};display:flex;flex-direction:column">${boatRowsFinal}</div>` : ''}
        ${!isClosedGroup && routeAvg>0?`<div style="margin-top:8px;display:flex;align-items:center;gap:6px;padding:5px 8px;background:#F4F2EE;border-radius:6px">
          <span style="font-size:9px;color:${ink[3]}">Route avg</span>
          <span style="font-size:10px;color:${FOREST};font-weight:600">${routeAvg} free/day</span>
          <span style="margin-left:auto;font-size:9px;color:${diffColor};font-weight:600">${diffLabel}</span>
        </div>`:''}
      </div>`;
    };

    const validRows=validGroups.map(g=>renderGroup(g, false)).join('');
    const closedRows=closedGroups.length?`
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${ink.line};display:flex;align-items:center;gap:6px"><span style="font-size:9px;color:${ink[3]};text-transform:uppercase;letter-spacing:.05em;font-weight:600">⚠ Off-season · Program closed</span><span style="font-size:9px;color:${ink[3]}">(${closedTrips.length})</span></div>
      ${closedGroups.map(g=>renderGroup(g, true)).join('')}
    `:'';
    return `<div style="margin-top:14px">
      ${headerHTML}<span style="margin-left:auto;font-size:10px;background:${isPanwa?LIME_SOFT:'#F4F2EE'};color:${isPanwa?FOREST:ink[2]};padding:2px 8px;border-radius:10px;font-weight:600">${validTrips.length} trips · ${totalFree} free${wxTripsCnt>0?` · ${wxTripsCnt} &#9928; cancelled`:''}${closedTrips.length?` · +${closedTrips.length} ⚠`:''}</span>${hiddenCnt>0?`<span title="${hiddenCnt} trip(s) hidden via Matrix route hide" style="margin-left:5px;font-size:9px;background:#FFFAF5;color:#854F0B;padding:2px 7px;border-radius:9px;font-weight:600;border:1px solid #F0C8B0">+${hiddenCnt} hidden</span>`:''}</div>
      ${validRows}${closedRows}
    </div>`;
  }).join('');
  const panelInner=`
    <div>
      <div style="font-size:10px;color:${ink[4]};text-transform:uppercase;letter-spacing:.05em">Selected day</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap"><div style="font-size:22px;font-weight:700;color:${ink[1]};line-height:1.1">${selFmtTitle}</div>${selIsToday?`<span style="background:${LIME};color:${FOREST};font-size:10px;font-weight:600;padding:3px 10px;border-radius:14px">Today</span>`:''}</div>
    </div>
    <div style="margin-top:12px;background:${LIME_SOFT};border:1px solid #C8E29A;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px">
      <div style="flex:1"><div style="font-size:10px;color:${LIME_DARK};font-weight:500">This week (${weekRange})</div><div style="font-size:11px;color:${FOREST};margin-top:2px;font-weight:600">Avg ${weekAvgPerDay} free/day · ${weekTrips} trips</div></div>
      <div style="text-align:right"><div style="font-size:20px;font-weight:700;color:${FOREST};line-height:1">${weekFree}</div><div style="font-size:9px;color:${LIME_DARK}">Week total</div></div>
    </div>
    ${panelSections}`;
  const panel=`<div class="cal-card" style="background:white;border-radius:14px;padding:14px 16px;border:1px solid ${ink.line2}">${panelInner}</div>`;

  // ── ROUTE MATRIX VIEW ──
  // Rows = routes (filtered by pier + hidden); Cols = each day of month; Cells = free seats
  let matrixGrid = '';
  {
    const hiddenRoutes = _calGetHiddenRoutes();
    const matrixRoutesAll = ROUTES.filter(rt => calPier==='all' || rt.pier===calPier);
    const matrixRoutes = matrixRoutesAll.filter(rt => !hiddenRoutes.has(rt.id));
    const hiddenInScope = matrixRoutesAll.filter(rt => hiddenRoutes.has(rt.id));
    // Build day-of-week labels for header
    const _wd = ['S','M','T','W','T','F','S'];
    // Day column headers
    let dayHdrs = '';
    for(let d=1; d<=daysInMonth; d++){
      const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dt = new Date(calYear, calMonth, d);
      const wd = _wd[dt.getDay()];
      const isWknd = dt.getDay()===0 || dt.getDay()===6;
      const isToday = ds === TODAY_STR;
      const isSel = ds === _sel;
      // Soft selected: pill on number + very subtle column tint, no hard borders
      const headerBg = isSel ? '#FFF6F0' : (isToday ? '#FFFAF5' : (isWknd ? '#FCEBEB22' : 'transparent'));
      const wdCol = isSel ? '#C75A33' : (isToday ? '#C75A33' : (isWknd ? '#9F1B4F' : ink[2]));
      // Day number: selected -> pill (coral bg, white text); today -> coral text; default -> ink
      const dayNumHtml = isSel
        ? `<div style="display:inline-block;background:#C75A33;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:9px;font-family:'DM Mono',monospace;letter-spacing:-.01em">${d}</div>`
        : `<div style="font-size:11.5px;font-weight:${isToday?700:600};color:${isToday?'#C75A33':ink[1]};font-family:'DM Mono',monospace;letter-spacing:-.02em">${d}</div>`;
      dayHdrs += `<th style="padding:6px 2px;text-align:center;background:${headerBg};border-bottom:1.5px solid ${ink.line};min-width:32px;cursor:pointer;transition:background .12s" onclick="showCalDay('${ds}')">
        ${dayNumHtml}
        <div style="font-size:8px;color:${wdCol};opacity:.75;font-weight:600;margin-top:${isSel?3:1}px;letter-spacing:.04em">${wd}</div>
      </th>`;
    }
    // Body rows
    let matrixBody = '';
    matrixRoutes.forEach(rt => {
      const totals = routeStat[rt.id] || null;
      let totalsLbl = 'no trips this month';
      if(totals){
        if(totals.trips > 0 && totals.offTrips > 0){
          totalsLbl = `${totals.trips}t · ${totals.free} free · +${totals.offTrips}⚠ off-season`;
        } else if(totals.trips > 0){
          totalsLbl = `${totals.trips}t · ${totals.free} free`;
        } else if(totals.offTrips > 0){
          totalsLbl = `${totals.offTrips}⚠ off-season · ${totals.offFree} free`;
        }
      }
      let row = `<tr class="rt-matrix-row">
        <td style="padding:8px 10px;background:#fafaf8;border-right:1.5px solid ${ink.line};border-bottom:1px solid ${ink.line2};position:sticky;left:0;z-index:2;min-width:170px">
          <div style="display:flex;align-items:center;gap:6px;position:relative">
            <span style="width:3px;height:24px;background:${rt.color};border-radius:2px;flex-shrink:0"></span>
            <div style="min-width:0;flex:1">
              <div style="font-size:11.5px;font-weight:600;color:${ink[1]};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2">${rt.name}</div>
              <div style="font-size:9px;color:${ink[3]};margin-top:1px;font-family:'DM Mono',monospace">${rt.id} · ${PIER_LBL[rt.pier]||'?'} · ${totalsLbl}</div>
            </div>
            <button class="rt-matrix-hide-btn" onclick="event.stopPropagation();calHideRoute('${rt.id}')" title="Hide this route from matrix" style="background:transparent;border:none;color:${ink[3]};cursor:pointer;font-size:14px;padding:2px 6px;border-radius:5px;opacity:0;transition:opacity .12s;flex-shrink:0">×</button>
          </div>
        </td>`;
      for(let d=1; d<=daysInMonth; d++){
        const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dt = new Date(calYear, calMonth, d);
        const isWknd = dt.getDay()===0 || dt.getDay()===6;
        const isSel = ds === _sel;
        const isToday = ds === TODAY_STR;
        const rd = (routeDay[rt.id]||{})[ds];
        const pierClosedDay = dayStat[ds] && dayStat[ds].closed[rt.pier];
        const routeClosedByProgram = (() => {
          const _s = getDayStatus(rt, ds);
          return _s && _s.type==='closed';
        })();
        let cellHtml = '';
        // Soft selected: subtle bg tint on empty/closed cells; colored cells keep their tier color (don't over-tint)
        const selectedTint = isSel ? '#FFF6F0' : '';
        const wxClosedCell = (typeof bkV2IsWeatherClosed==='function' && bkV2IsWeatherClosed(rt.id, ds));
        if(wxClosedCell){
          // Weather-cancelled → red closed cell (overrides free-seat display)
          const bg = isSel ? '#FBE0DB' : '#FCEBEB';
          cellHtml = `<td title="Cancelled (weather) · ${rt.name} · ${ds}" onclick="showCalDay('${ds}')" style="text-align:center;background:${bg};color:#A32D2D;font-size:11px;font-weight:700;font-family:'DM Mono',monospace;border:0.5px solid #E89A92;cursor:pointer;padding:4px 2px">&#9928;</td>`;
        } else if(!rd && (pierClosedDay || routeClosedByProgram)){
          // Closed: gray with "x"
          const bg = isSel ? '#F1EFE899' : '#F1EFE8';
          cellHtml = `<td title="Closed · ${rt.name} · ${ds}" onclick="showCalDay('${ds}')" style="text-align:center;background:${bg};color:#aaa;font-size:11px;font-family:'DM Mono',monospace;border:0.5px solid ${ink.line2};cursor:pointer;padding:4px 2px">×</td>`;
        } else if(!rd){
          // No trip · still surface seat-locks held in advance
          const bg = isSel ? selectedTint : (isWknd ? '#FCEBEB11' : '#fff');
          const lkN = (typeof bkV2LockedTotal==='function') ? bkV2LockedTotal(rt.id, ds) : 0;
          const lkMark = lkN>0 ? `<span style="display:block;font-size:8px;color:#C0392B;font-weight:700;line-height:1;margin-top:1px">&#128274;${lkN}</span>` : '';
          cellHtml = `<td title="No trips · ${rt.name} · ${ds}${lkN>0?` · ${lkN} locked by sales`:''}" onclick="showCalDay('${ds}')" style="text-align:center;background:${bg};color:#ddd;font-size:11px;font-family:'DM Mono',monospace;border:0.5px solid ${ink.line2};cursor:pointer;padding:4px 2px">${lkN>0?'<span style="color:#ddd">—</span>':'—'}${lkMark}</td>`;
        } else {
          const free = rd.free;
          const cap = rd.cap;
          const pct = cap>0 ? Math.round((cap-free)/cap*100) : 0;
          const isFull = free<=0 && cap>0;
          // Off-season trip: amber warning style (not gray — gray was confusing with "closed")
          const c = rd.routeClosed ? '#A05A1A' : (isFull ? FOREST : colorFor(pct));
          const bg = rd.routeClosed ? '#FFF6E5' : (isFull ? '#BCE595' : bgFor(pct));
          const extraBorder = rd.routeClosed ? 'border:1px dashed #E5A847;' : `border:0.5px solid ${ink.line2};`;
          const display = isFull ? '✕' : free;
          const warn = rd.routeClosed ? '⚠' : '';
          const lk = (typeof bkV2LockedTotal==='function') ? bkV2LockedTotal(rt.id, ds) : 0;
          const lkMark = lk>0 ? `<span style="display:block;font-size:8px;color:#C0392B;font-weight:700;line-height:1;margin-top:1px">&#128274;${lk}</span>` : '';
          // For colored cells, selection is hinted only by a subtle inset shadow on top/bottom edges (column markers)
          const selHint = isSel ? 'box-shadow:inset 0 1.5px 0 #C75A33aa, inset 0 -1.5px 0 #C75A33aa;' : '';
          const todayHint = isToday && !isSel ? 'box-shadow:inset 0 0 0 1.5px #E8B59B;' : '';
          cellHtml = `<td title="${rt.name} · ${ds} · ${rd.routeClosed?'⚠ Off-season · ':''}${free}/${cap} free · ${pct}% full${lk>0?` · ${lk} locked by sales`:''}" onclick="showCalDay('${ds}')" style="text-align:center;background:${bg};color:${c};font-size:11px;font-weight:700;font-family:'DM Mono',monospace;${extraBorder}cursor:pointer;padding:4px 2px;${selHint}${todayHint}">${warn}${display}${lkMark}</td>`;
        }
        matrixBody += '';
        row += cellHtml;
      }
      row += '</tr>';
      matrixBody += row;
    });
    // Hidden routes manage panel (toggled by user)
    const showHidePanel = window._calShowHidePanel === true;
    const hidePanelHtml = (hiddenInScope.length > 0 || showHidePanel) ? `
      <div style="background:#FFFAF5;border:1px solid #F0C8B0;border-radius:8px;padding:8px 12px;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:10.5px;color:#854F0B;font-weight:600">${hiddenInScope.length} route${hiddenInScope.length!==1?'s':''} hidden</span>
        <button onclick="calToggleHidePanel()" style="background:transparent;border:1px solid #E8B59B;color:#854F0B;font-family:inherit;font-size:10px;font-weight:600;padding:3px 9px;border-radius:6px;cursor:pointer">${showHidePanel?'Hide panel':'Manage'}</button>
        ${hiddenInScope.length>0?`<button onclick="calShowAllRoutes()" style="background:#854F0B;border:none;color:#fff;font-family:inherit;font-size:10px;font-weight:600;padding:3px 10px;border-radius:6px;cursor:pointer">Show all</button>`:''}
        ${showHidePanel?`<div style="flex-basis:100%;display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;padding-top:8px;border-top:1px dashed #E8B59B">${
          matrixRoutesAll.map(rt=>{
            const isHidden = hiddenRoutes.has(rt.id);
            return `<button onclick="${isHidden?`calUnhideRoute('${rt.id}')`:`calHideRoute('${rt.id}')`}" style="background:${isHidden?'#fff':'#F4F2EE'};border:1px solid ${isHidden?'#E8B59B':'rgba(0,0,0,.1)'};color:${isHidden?'#854F0B':ink[2]};font-family:inherit;font-size:10px;font-weight:500;padding:3px 9px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;text-decoration:${isHidden?'line-through':'none'}">
              <span style="width:6px;height:6px;border-radius:50%;background:${rt.color}"></span>${rt.name}
            </button>`;
          }).join('')
        }</div>`:''}
      </div>` : '';

    matrixGrid = `<style>.rt-matrix-row:hover .rt-matrix-hide-btn{opacity:.7!important}.rt-matrix-row .rt-matrix-hide-btn:hover{opacity:1!important;background:#FBE9E9!important;color:#A32D2D!important}</style>
    <div class="cal-card" style="background:white;border-radius:14px;padding:12px;border:1px solid ${ink.line2}">
      ${hidePanelHtml}
      <div style="font-size:10.5px;color:${ink[2]};margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <span><strong style="color:${ink[1]}">${matrixRoutes.length}</strong>${hiddenInScope.length?`<span style="color:${ink[3]}"> / ${matrixRoutesAll.length}</span>`:''} routes × <strong style="color:${ink[1]}">${daysInMonth}</strong> days · numbers = free seats of that day · click cell to select day · hover row to hide</span>
        <div style="display:flex;align-items:center;gap:10px;font-size:10px">
          <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#CFE9AC;border:0.5px solid ${ink.line2};border-radius:2px"></span>Full</span>
          <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:${LIME_SOFT};border:0.5px solid ${ink.line2};border-radius:2px"></span>Selling</span>
          <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#FAF0C8;border:0.5px solid ${ink.line2};border-radius:2px"></span>Medium</span>
          <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#FBE1C6;border:0.5px solid ${ink.line2};border-radius:2px"></span>Under-sold</span>
          <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#FBE9E9;border:0.5px solid ${ink.line2};border-radius:2px"></span>Many free</span>
          <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#F1EFE8;border:0.5px solid ${ink.line2};border-radius:2px;color:#aaa;font-size:8px;text-align:center;font-family:'DM Mono'">×</span>Closed</span>
          <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#fff;border:0.5px solid ${ink.line2};border-radius:2px;color:#ddd;font-size:8px;text-align:center">—</span>No trips</span>
        </div>
      </div>
      ${matrixRoutes.length===0 ? `<div style="padding:30px;text-align:center;color:${ink[3]};font-size:12px;background:#fafaf8;border-radius:10px">All routes are hidden · <button onclick="calShowAllRoutes()" style="background:#0F6E56;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:5px 12px;border-radius:6px;cursor:pointer;margin-left:6px">Show all</button></div>` : `<div style="overflow-x:auto;border:1px solid ${ink.line2};border-radius:10px">
        <table style="border-collapse:collapse;width:100%;min-width:${170 + daysInMonth*34}px">
          <thead><tr><th style="padding:6px 10px;background:#fafaf8;border-bottom:1.5px solid ${ink.line};border-right:1.5px solid ${ink.line};text-align:left;font-size:9.5px;font-weight:700;color:${ink[2]};text-transform:uppercase;letter-spacing:.04em;position:sticky;left:0;z-index:3;min-width:170px">Route</th>${dayHdrs}</tr></thead>
          <tbody>${matrixBody}</tbody>
        </table>
      </div>`}
    </div>`;
  }

  // ── PROJECT RIBBON · active/scheduled projects with dates overlapping this month ──
  let projRibbon = '';
  if(typeof FL_PROJECTS!=='undefined' && FL_PROJECTS && FL_PROJECTS.length){
    const mStart = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
    const mEnd   = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
    const monthProj = FL_PROJECTS.filter(p=>{
      if(p.status==='completed'||p.status==='cancelled') return false;
      if(!p.planFrom) return false;
      const effEnd = p.planTo || '9999-12-31'; // Open-ended → treat as far-future
      return p.planFrom<=mEnd && effEnd>=mStart;
    });
    if(monthProj.length){
      const COL = {inprogress:'#F59E0B', on_hold:'#B45309', planned:'#3A6FF7'};
      const SOFT = {inprogress:'#FEF3CD', on_hold:'#FFFBEB', planned:'#EEF3FF'};
      const ICONNAME = {inprogress:'wrench', on_hold:'pause', planned:'calendar'};
      const chips = monthProj.sort((a,b)=>(a.planFrom||'').localeCompare(b.planFrom||'')).map(p=>{
        const boat = (typeof BOATS!=='undefined')?BOATS.find(b=>b.id===p.boatId):null;
        const c = COL[p.status]||COL.planned;
        const s = SOFT[p.status]||SOFT.planned;
        const icName = ICONNAME[p.status]||ICONNAME.planned;
        const ic = typeof flProjIcon==='function'?flProjIcon(icName,11,c,2):'';
        const fromD = p.planFrom.slice(8); const toD = p.planTo ? p.planTo.slice(8) : 'Open';
        return `<button onclick="_selProjId='${p.id}';nav(document.querySelector('[data-view=\\'fl-projects\\']'))" style="background:${s};color:${c};border:1px solid ${c}33;border-radius:14px;padding:4px 11px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:Manrope,sans-serif" title="${p.name}">${ic} ${p.no} · ${boat?boat.name:'?'} · ${fromD}–${toD}</button>`;
      }).join('');
      projRibbon = `<div style="background:white;border:1px solid ${ink.line2};border-radius:12px;padding:9px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:10px;color:${ink[3]};font-weight:700;letter-spacing:.06em;text-transform:uppercase">Active Projects this month · ${monthProj.length}</span>
        ${chips}
      </div>`;
    }
  }

  // ── COMPOSE ──
  if(viewMode==='month'){
    // §cal2 · ปฏิทินกินพื้นที่ที่เหลือทั้งหมด · รายละเอียดวันอยู่ในลิ้นชัก
    const _dwOn=!!window._calDrawer;
    wrap.innerHTML = CAL2CSS
      + `<div class="cal2-page">${headerBar}${routeStrip2}${shutBar}${calGrid2}${legend2}</div>`
      + `<div class="cal2-scrim${_dwOn?' on':''}" onclick="calCloseDay()"></div>`
      + `<div class="cal2-dw${_dwOn?' on':''}"><button class="cal2-x" onclick="calCloseDay()">&times;</button>`
      + `<div class="cal2-dwb">${panelInner}</div></div>`;
    _calFitPage();   // §fit · วาดเสร็จแล้วค่อยวัด · ก่อนหน้านี้ยังไม่มีอะไรให้วัด
  } else {
    window._calDrawer=false;
    wrap.innerHTML = headerBar + kpiStrip + routeStrip +
      `<div style="display:grid;grid-template-columns:1fr 340px;gap:10px">${matrixGrid}${panel}</div>`;
  }
}

// ══════════════════════════════════════
// DAILY AVAILABILITY
// ══════════════════════════════════════
let daDate=new Date(TODAY);
function changeDA(n){daDate=addDays(daDate,n);renderDA();}

// §Daily Availability message template · user แก้ข้อความเองได้ (เขียนสไตล์ตัวเอง) · token {date} {availability}
//   ถูกแทนด้วยข้อมูลจริงทุกวัน → ไม่ต้องพิมพ์ที่นั่งใหม่ · เก็บใน blob (da_template · sync app_meta)
const DA_DEFAULT_TEMPLATE = '🌊 LOVE ANDAMAN — Seats Available\n📅 {date}\n\n{availability}\n\n📩 Book now · LINE @loveandaman\n☎️ 088-765-4678';
let DA_TEMPLATE='';
(function(){ try{ const d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); if(typeof d.da_template==='string') DA_TEMPLATE=d.da_template; }catch(e){} })();
function daSaveTemplate(){
  const el=document.getElementById('da-tmpl-input'); if(!el) return;
  DA_TEMPLATE=el.value||'';
  try{ const d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); d.da_template=DA_TEMPLATE; localStorage.setItem('loveandaman_v2', JSON.stringify(d)); }catch(e){ console.warn('[daSaveTemplate] failed', e); }
  if(typeof renderDA==='function') renderDA();
  const btn=document.getElementById('da-tmpl-save'); if(btn){ const _t=btn.innerHTML; btn.innerHTML='&#10003; บันทึกแล้ว'; setTimeout(()=>{ const b=document.getElementById('da-tmpl-save'); if(b) b.innerHTML=_t; },1800); }
}
function daResetTemplate(){
  if(!confirm('คืนค่าข้อความเป็นแบบเริ่มต้น? (ข้อความที่แก้ไว้จะหาย)')) return;
  DA_TEMPLATE='';
  try{ const d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); d.da_template=''; localStorage.setItem('loveandaman_v2', JSON.stringify(d)); }catch(e){}
  const el=document.getElementById('da-tmpl-input'); if(el) el.value=DA_DEFAULT_TEMPLATE;
  if(typeof renderDA==='function') renderDA();
}
// §ชื่อย่อของเส้นทางสำหรับข้อความ (ย่อให้สั้น) · เก็บเป็น JSON string ใน blob (da_route_names · sync app_meta)
let DA_ROUTE_NAMES={};
(function(){ try{ const d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); const v=d.da_route_names; if(typeof v==='string'){ DA_ROUTE_NAMES=JSON.parse(v)||{}; } else if(v && typeof v==='object'){ DA_ROUTE_NAMES=v; } }catch(e){} })();
function _daRouteName(r){ return ((DA_ROUTE_NAMES[r.id]||'').trim()) || r.name; }
function daEditRouteName(rid){
  const r=(typeof getRoute==='function')?getRoute(rid):null; if(!r) return;
  const v=prompt('ชื่อย่อสำหรับข้อความ LINE\nเส้นทาง: '+r.name+'\n(เว้นว่าง = ใช้ชื่อเต็ม)', DA_ROUTE_NAMES[rid]||'');
  if(v===null) return;
  const nv=v.trim();
  if(nv) DA_ROUTE_NAMES[rid]=nv; else delete DA_ROUTE_NAMES[rid];
  try{ const d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); d.da_route_names=JSON.stringify(DA_ROUTE_NAMES); localStorage.setItem('loveandaman_v2', JSON.stringify(d)); }catch(e){}
  if(typeof renderDA==='function') renderDA();
}
// §daPlainNum (2026-08-07) · เลิกใช้กับข้อความที่นั่งแล้ว — Mathematical Bold ไม่ใช่ฟอนต์เดียวกับ
//   ข้อความรอบข้างบน LINE บางเครื่องขึ้นเป็นกล่องว่าง / เส้นฐานเพี้ยน · คงฟังก์ชันไว้เผื่อที่อื่นเรียก
// §เน้นตัวเลขในข้อความ LINE · แปลงเลข 0-9 → Mathematical Bold (𝟎-𝟗)
function _daBold(v){ return String(v).replace(/[0-9]/g, d=>String.fromCodePoint(0x1D7CE + (+d))); }
function buildDAGroups(ds){
  const dayOps=TRIPS[ds]||{};
  const groups={tublamu:{},panwa:{}};
  Object.entries(dayOps).forEach(([bid,op])=>{
    // defensive: skip if op is array (old format) or no route
    if(Array.isArray(op)||!op.route||op.type==='charter') return;
    const r=getRoute(op.route); if(!r) return;
    const b=getBoat(bid); if(!b) return;
    const key=`${op.route}__${op.type}`;
    const pier=r.pier;
    if(!groups[pier]) groups[pier]={};
    if(!groups[pier][key]) groups[pier][key]={r,type:op.type,allot:0,booked:0};
    groups[pier][key].allot+=b.cap;
    groups[pier][key].booked+=(op.booked||0);
  });
  // §fix (2026-07-23): op.booked จาก Boat-Op ไม่ sync กับ booking จริง (แสดง 0 → ว่างเกินจริง · เสี่ยง overbook)
  // → เอา "จอง/ว่าง" จาก getAllotment (นับ seatsConsumed จริงจาก SB_BOOKINGS) ให้ตรงกับทั้งระบบ
  Object.keys(groups).forEach(pier=>{ Object.keys(groups[pier]||{}).forEach(key=>{ const g=groups[pier][key];
    // §route ไม่ออกวันนั้น (ไม่อยู่ในโปรแกรม / ปิด override / weather) → เอาออกจากลิสต์ที่นั่งว่าง
    // แม้จะมีเรือค้างจัดไว้ใน TRIPS ก็ตาม (ให้ตรงกับเที่ยวอื่นที่ไม่ออก = ไม่โชว์)
    if(typeof bkV2IsRouteOpenOn==='function' && !bkV2IsRouteOpenOn(g.r.id, ds)){ delete groups[pier][key]; return; }
    if(typeof getAllotment==='function' && g.r){ const al=getAllotment(g.r.id, ds); if(al){
      // §lkAvail · ที่นั่งที่ล็อกไว้ให้เอเจ้นยังขายไม่ได้ · นับรวมกับที่ขายไปแล้ว
      //   ไม่งั้นข้อความที่ส่งเอเจ้นเจ้าอื่นจะบอกว่าว่าง ทั้งที่กันไว้ให้อีกเจ้าแล้ว
      g.locked = al.lockedSeats||0;
      g.booked = (al.seatsConsumed||0) + g.locked;
      if((al.availableCapacity||0)>0) g.allot = al.availableCapacity; } }
  }); });
  return groups;
}

// §daSortTime · เวลาออกของเส้นทาง (นาทีจากเที่ยงคืน) · ไม่มีเวลาให้ไปอยู่ท้ายสุด
function _daDepMin(g){
  const t=String(((g&&g.r&&g.r.times)||[])[0]||'').trim();
  const m=t.match(/^(\d{1,2}):(\d{2})/);
  return m ? (+m[1]*60 + +m[2]) : 9999;
}
function _daSortRows(rows){
  return (rows||[]).slice().sort((a,b)=>{
    const d=_daDepMin(a)-_daDepMin(b); if(d) return d;
    if(a.type!==b.type) return a.type==='early' ? -1 : 1;   // เวลาเท่ากัน · Early ขึ้นก่อน
    return String(_daRouteName(a.r)||'').localeCompare(String(_daRouteName(b.r)||''));
  });
}
function renderDA(){
  const ds=fmt(daDate);
  const groups=buildDAGroups(ds);
  document.getElementById('da-date-lbl').textContent=daDate.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  const typeLabel={early:'Early',normal:'Normal'};

  // left visual — same grouping as text preview
  let html='';
  // §ranongDA · ท่าที่เพิ่มมาทีหลัง (ระนอง · โปรแกรมพม่า) ต้องขึ้นในข้อความที่นั่งว่างด้วย
  //   เดิมวนแค่ 2 ท่า · เที่ยวระนองจึงไม่เคยถูกส่งให้เอเจ้น = ไม่มีใครรู้ว่าขายได้
  ['tublamu','panwa'].concat(Object.keys(groups.ranong||{}).length?['ranong']:[]).forEach(pier=>{
    const pm={tublamu:{label:'Tub Lamu Pier',dot:'var(--ocean-mid)'},panwa:{label:'Visit Panwa',dot:'var(--green)'},ranong:{label:'Ranong Pier',dot:'var(--amber)'}}[pier];
    const rows=_daSortRows(Object.values(groups[pier]||{}));
    if(!rows.length) return;
    html+=`<div class="da-pier-lbl"><div style="width:6px;height:6px;border-radius:50%;background:${pm.dot}"></div>${pm.label}</div>`;
    rows.forEach(({r,type,allot,booked,locked})=>{
      const free=Math.max(0,allot-booked);
      const pct=allot>0?Math.round(booked/allot*100):0;
      // §daFullSame · เกณฑ์เดียวกับข้อความที่ส่งเอเจ้น · เต็ม = ไม่เหลือที่จริง ๆ
      //   เดิมใช้ 95% การ์ดเลยขึ้นเต็มทั้งที่ยังเหลือที่ขายได้ · ขัดกับข้อความ
      const full=(free<=0)||pct>=100;
      const typeChip=`<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${type==='early'?'#fff7d6':'var(--ocean-50)'};color:${type==='early'?'#7a5500':'var(--ocean)'};font-weight:500;flex-shrink:0">${typeLabel[type]}</span>`;
      // §ไฮไลต์ตัวเลขในการ์ด · badge พื้นสีตามระดับ (เขียว=ว่างเยอะ · เหลือง=เหลือน้อย · แดง=เต็ม)
      const _tier = full ? 'full' : freeClass(pct);
      const _bg = _tier==='full'?'#FCEBEB':_tier==='warn'?'#FBF0DD':'#E1F5EE';
      const _fg = _tier==='full'?'#A32D2D':_tier==='warn'?'#854F0B':'#0F6E56';
      const numBadge = full
        ? `<span style="background:${_bg};color:${_fg};border-radius:9px;padding:4px 12px;font-size:12.5px;font-weight:700;flex-shrink:0">✕ เต็ม</span>`
        : `<span style="display:inline-flex;align-items:baseline;gap:4px;background:${_bg};border-radius:9px;padding:3px 11px;flex-shrink:0"><span style="font-size:18px;font-weight:800;color:${_fg};font-variant-numeric:tabular-nums;line-height:1">${free}</span><span style="font-size:10px;font-weight:600;color:${_fg};opacity:.65">/${allot}</span></span>`;
      // §lkAvail · บอกด้วยว่ามีที่นั่งกันไว้ให้เอเจ้นอยู่กี่ที่ · ที่หายไปจะได้ไม่งง
      const lockChip = (locked>0) ? `<span title="กันไว้ให้เอเจ้น ${locked} ที่ · ดูใน Seat Locks" style="font-size:10px;font-weight:700;color:#C0392B;background:#FBEAE6;border-radius:7px;padding:2px 7px;flex-shrink:0">&#128274; ${locked}</span>` : '';
      html+=`<div class="da-route-row">
        <div class="da-rr-dot" style="background:${r.color}"></div>
        <span class="da-rr-name" onclick="daEditRouteName('${r.id}')" title="คลิกเพื่อตั้งชื่อย่อในข้อความ · ชื่อเต็ม: ${r.name}" style="cursor:pointer">${_daRouteName(r)} <span style="opacity:.32;font-size:10px">&#9998;</span></span>
        ${lockChip}
        ${typeChip}
        ${numBadge}
      </div>`;
    });
  });
  document.getElementById('da-body').innerHTML=html||'<p style="color:var(--ink-soft);font-size:12px;padding:16px 0">ไม่มีเที่ยวออก</p>';

  // text preview · สร้าง "บล็อกที่นั่งว่าง" (pier + routes) แล้วแทนลง template ที่ user แก้เองได้ (token {date} {availability})
  const availLines=[];
  ['tublamu','panwa'].concat(Object.keys(groups.ranong||{}).length?['ranong']:[]).forEach(pier=>{
    const pm={tublamu:'Tub Lamu Pier',panwa:'Visit Panwa Pier',ranong:'Ranong Pier'}[pier];
    const rows=_daSortRows(Object.values(groups[pier]||{}));
    if(!rows.length) return;
    availLines.push('📍 '+pm);
    rows.forEach(({r,type,allot,booked})=>{
      const tname=_daRouteName(r)+(type==='early'?' · Early':'');
      const free=Math.max(0,allot-booked);
      const pct=allot>0?Math.round(booked/allot*100):0;
      // §daLineFmt · ชื่อเส้นทางบรรทัดหนึ่ง · ที่นั่งอีกบรรทัดย่อหน้าเข้าไป
      //   §daMarkTwo · เครื่องหมายมีสองแบบพอ: ✅ ยังจองได้ · ❌ เต็ม
      //   ไม่ใช้ขั้นกลาง ⚠️ แล้ว — ฝั่งเอเจ้นอ่านแล้วเข้าใจผิดว่าจองไม่ได้
      //   ทั้งที่ยังมีที่ว่าง · ตัวเลขที่นั่งบรรทัดเดียวกันบอกอยู่แล้วว่าเหลือเท่าไหร่
      const mark=pct>=100?'❌':'✅';
      availLines.push(`- ${tname}`);
      availLines.push(pct>=100 ? `   ${mark} FULL` : `   ${mark} ${free} Seats`);
      availLines.push('');
    });
  });
  const availBlock=availLines.join('\n').replace(/\n+$/,'');   // ตัดบรรทัดว่างท้าย
  const dateStr=daDate.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  const _tmpl=(DA_TEMPLATE && DA_TEMPLATE.trim()) ? DA_TEMPLATE : DA_DEFAULT_TEMPLATE;
  const _msg=_tmpl.replace(/\{date\}/g,dateStr).replace(/\{availability\}/g,availBlock).replace(/\{seats\}/g,availBlock);
  document.getElementById('da-preview').textContent=_msg;
  const _tEl=document.getElementById('da-tmpl-input'); if(_tEl && document.activeElement!==_tEl) _tEl.value=_tmpl;   // โหลดเทมเพลตที่บันทึกไว้ (ไม่ทับตอนกำลังพิมพ์)
  const btn=document.getElementById('da-copy-btn');
  btn.className='da-copy-btn';
  btn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy message`;
}

function copyDA(){
  navigator.clipboard.writeText(document.getElementById('da-preview').textContent).then(()=>{
    const btn=document.getElementById('da-copy-btn');
    btn.className='da-copy-btn done';
    btn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(()=>renderDA(),2500);
  });
}

// ══════════════════════════════════════
// BOAT STATUS
// ══════════════════════════════════════
let boatPier='all',boatSt='all',boatLocType='all',selBoatId=null,selDetailTab='tl',ganttOffset=-7,selSt='available',editingSlId=null;

function setBoatPier(v,el){boatPier=v;document.querySelectorAll('#boats-pier-filter .fp').forEach(b=>b.classList.remove('on'));if(el)el.classList.add('on');renderBoats();}
function setBoatSt(v,el){boatSt=v;document.querySelectorAll('#boats-st-filter .fp').forEach(b=>b.classList.remove('on'));if(el)el.classList.add('on');renderBoats();}
function setBoatLocType(v,el){boatLocType=v;renderBoats();}

function renderBoats(){
  let boats=BOATS;
  if(boatPier!=='all') boats=boats.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)===boatPier);
  if(boatSt!=='all') boats=boats.filter(b=>getCurStatus(b,TODAY_STR).s===boatSt);
  if(boatLocType!=='all') boats=boats.filter(b=>{
    const cs=getCurStatus(b,TODAY_STR);
    if(!cs.locType)return false;
    const allTypes=Object.values(LOCATION_TYPES).flat();
    const t=allTypes.find(x=>x.val===cs.locType);
    return t&&t.type===boatLocType;
  });

  const companyBoats=boats.filter(b=>b.ownership!=='charter'&&!b.retired);
  const charterBoats=boats.filter(b=>b.ownership==='charter');
  const allCompany=BOATS.filter(b=>b.ownership!=='charter'&&!b.retired);
  const allCharter=BOATS.filter(b=>b.ownership==='charter');

  // Counts (always from BOATS, ignore filter for KPI)
  const availCount=allCompany.filter(b=>getCurStatus(b,TODAY_STR).s==='available').length;
  const fixCount=allCompany.filter(b=>getCurStatus(b,TODAY_STR).s==='fixing').length;
  const unavCount=allCompany.filter(b=>getCurStatus(b,TODAY_STR).s==='unavailable').length;
  const tlCount=allCompany.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)==='tublamu').length;
  const vpCount=allCompany.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)==='panwa').length;
  const rnCount=allCompany.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)==='ranong').length;
  const shopCount=allCompany.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)==='shop').length;

  // In-shop count (boats with active MJ at shop · derived from getBoatCurrentPier)
  const inShop=shopCount;

  const SVG_PINK={accent:'#E03B7E',soft:'#FCE5EC',text:'#9F1B4F'};
  const dim={bg:'#F4F2EE',ink:'#1A1A1A',ink2:'#666',ink3:'#999',ink4:'#bbb',ink5:'#ccc',line:'rgba(0,0,0,.04)',line2:'#f0f0f0'};

  // Avatar color helper
  const boatAvatarColor=(b)=>{
    if(typeof getBoatColor==='function'){ const _gc=getBoatColor(b.id); if(_gc&&_gc.text&&_gc.text!=='#666') return _gc.text; }
    const palette=['#185FA5','#534AB7','#1D9E75','#BA7517','#A32D2D','#0F6E56','#7F77DD','#D85A30','#993556','#185FA5'];
    const i=allCompany.findIndex(x=>x.id===b.id);
    return palette[i%palette.length>=0?(i%palette.length):0];
  };
  const boatInitials=(name)=>{
    const w=name.split(/\s+/);
    if(w.length>=2)return (w[0][0]+w[1][0]).toUpperCase();
    if(name.length>=2&&/\d/.test(name))return (name.match(/[A-Z]/g)?.[0]||name[0])+name.slice(-1);
    return name.slice(0,2).toUpperCase();
  };

  const STATUS_STYLE={
    available:{bg:'#1D9E75',color:'white',label:'AVAILABLE'},
    fixing:{bg:'#FAEEDA',color:'#854F0B',label:'FIXING'},
    unavailable:{bg:'#FCEBEB',color:'#A32D2D',label:'UNAVAIL'}
  };
  const PIER_LBL={tublamu:'Tub Lamu',panwa:'Visit Panwa',ranong:'Ranong'};

  // Header bar
  const headerBar=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:6px">
      <button style="width:32px;height:32px;border-radius:50%;border:1px solid rgba(0,0,0,.08);background:white;font-size:16px;cursor:pointer;color:${dim.ink2}">+</button>
      <div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid ${dim.line};border-radius:20px;padding:3px 12px 3px 3px"><div style="width:24px;height:24px;border-radius:50%;background:#185FA5;color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">TL</div><span style="font-size:12px;font-weight:500">Tub Lamu · ${tlCount}</span></div>
      <div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid ${dim.line};border-radius:20px;padding:3px 12px 3px 3px"><div style="width:24px;height:24px;border-radius:50%;background:#0F6E56;color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">VP</div><span style="font-size:12px;font-weight:500">Visit Panwa · ${vpCount}</span></div>
      ${rnCount?`<div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid ${dim.line};border-radius:20px;padding:3px 12px 3px 3px"><div style="width:24px;height:24px;border-radius:50%;background:#BA7517;color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">RN</div><span style="font-size:12px;font-weight:500">Ranong · ${rnCount}</span></div>`:''}
      <div style="width:32px;height:32px;border-radius:50%;background:${dim.ink};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">B</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <button onclick="openCharterModal()" style="background:white;border:1px solid rgba(0,0,0,.08);border-radius:20px;padding:5px 14px;font-size:11px;font-weight:500;cursor:pointer">+ เรือเช่า</button>
    </div>
  </div>`;

  // KPI strip
  const kpiStrip=`<div style="display:grid;grid-template-columns:1.6fr 1fr 0.85fr 0.85fr 0.85fr;gap:8px;margin-bottom:14px;align-items:stretch">
    <div style="grid-column:1;align-self:end;padding-bottom:6px">
      <div style="font-size:13px;font-weight:500;color:${dim.ink4};margin-bottom:2px">Boat Status</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;flex-wrap:wrap">
        <span style="font-size:42px;font-weight:700;letter-spacing:-1.5px;line-height:1">${availCount}</span>
        <span style="font-size:18px;color:${dim.ink3};font-weight:500">boats</span>
        <span style="display:inline-flex;align-items:center;background:${SVG_PINK.accent};color:white;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600">▴ Available</span>
      </div>
      <div style="font-size:10px;color:${dim.ink3}">${allCompany.length} บริษัท · ${allCharter.length} charter${BOATS.filter(b=>b.retired).length?' · '+BOATS.filter(b=>b.retired).length+' retired':''}</div>
    </div>

    <div onclick="setBoatSt('available',null)" style="grid-column:2;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dim.line};cursor:pointer">
      <div style="font-size:10px;color:${dim.ink3}">Available</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2;color:#0F6E56">${availCount}</span><span style="font-size:11px;color:${dim.ink3};font-weight:500">/ ${allCompany.length}</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span style="font-size:11px;color:#0F6E56;font-weight:600">${allCompany.length?Math.round(availCount/allCompany.length*100):0}% fleet</span></div>
    </div>

    <div onclick="setBoatSt('fixing',null)" style="grid-column:3;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dim.line};cursor:pointer">
      <div style="font-size:10px;color:${dim.ink3}">Fixing</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2;color:#BA7517">${fixCount}</span><span style="font-size:11px;color:${dim.ink3};font-weight:500">boats</span></div>
      <div style="font-size:11px;color:#854F0B;margin-top:6px;font-weight:600">${inShop?inShop+' in shop':'on dock'}</div>
    </div>

    <div onclick="setBoatSt('unavailable',null)" style="grid-column:4;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dim.line};cursor:pointer">
      <div style="font-size:10px;color:${dim.ink3}">Unavailable</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2;color:#A32D2D">${unavCount}</span><span style="font-size:11px;color:${dim.ink3};font-weight:500">boats</span></div>
      <div style="font-size:11px;color:#A32D2D;margin-top:6px;font-weight:600">${unavCount?'major issue':'all clear'}</div>
    </div>

    <div style="grid-column:5;background:${dim.ink};color:white;border-radius:14px;padding:11px 13px">
      <div style="font-size:10px;color:#aaa">Charter active</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2">${allCharter.length}</span><span style="font-size:11px;color:#aaa;font-weight:500">boats</span></div>
      <div style="font-size:11px;color:#aaa;margin-top:6px">${new Set(allCharter.map(c=>c.charter_co||c.owner||'')).size||0} partners</div>
    </div>
  </div>`;

  // Filter bar
  const pierBtn=(val,label)=>`<button onclick="setBoatPier('${val}',null)" style="background:${boatPier===val?dim.ink:'transparent'};color:${boatPier===val?'white':dim.ink2};border:none;border-radius:14px;padding:5px 14px;font-size:11px;font-weight:${boatPier===val?600:500};cursor:pointer">${label}</button>`;
  const stBtn=(val,label,activeBg)=>`<button onclick="setBoatSt('${val}',null)" style="background:${boatSt===val?(activeBg||dim.ink):'transparent'};color:${boatSt===val?'white':dim.ink2};border:none;border-radius:14px;padding:5px 12px;font-size:11px;font-weight:${boatSt===val?600:500};cursor:pointer">${label}</button>`;
  const locBtn=(val,label,activeBg)=>`<button onclick="setBoatLocType('${val}',null)" style="background:${boatLocType===val?(activeBg||dim.ink):'transparent'};color:${boatLocType===val?'white':dim.ink2};border:none;border-radius:14px;padding:5px 12px;font-size:11px;font-weight:${boatLocType===val?600:500};cursor:pointer">${label}</button>`;

  const filterBar=`<div style="display:flex;gap:6px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
    <span style="font-size:11px;color:${dim.ink3};margin-right:6px;font-weight:500">filter</span>
    <div style="background:white;border:1px solid ${dim.line};border-radius:24px;padding:2px;display:flex">
      ${pierBtn('all','All')}${pierBtn('tublamu','Tub Lamu')}${pierBtn('panwa','Visit Panwa')}${rnCount?pierBtn('ranong','Ranong'):''}${shopCount?pierBtn('shop','🔧 In Shop'):''}
    </div>
    <div style="background:white;border:1px solid ${dim.line};border-radius:24px;padding:2px;display:flex;margin-left:6px">
      ${stBtn('all','All')}
      ${stBtn('available','Available','#1D9E75')}
      ${stBtn('fixing','Fixing','#BA7517')}
      ${stBtn('unavailable','Unavail','#A32D2D')}
    </div>
    <div style="background:white;border:1px solid ${dim.line};border-radius:24px;padding:2px;display:flex;margin-left:6px">
      ${locBtn('all','All loc')}
      ${locBtn('pier','At pier','#185FA5')}
      ${locBtn('shop','In shop','#854F0B')}
      ${locBtn('dock','On dock','#A32D2D')}
    </div>
  </div>`;

  // Boat list section grouped by pier
  const buildBoatRow=(b,isCharter)=>{
    const cur=getCurStatus(b,TODAY_STR);
    const isSel=b.id===selBoatId;
    const c=isCharter?'#534AB7':boatAvatarColor(b);
    const init=boatInitials(b.name);
    // Charter: check if today is covered by any log entry
    const hasLogToday=(b.log||[]).some(e=>e.from<=TODAY_STR&&(!e.to||e.to>=TODAY_STR));
    const isCharterInactive=isCharter&&!hasLogToday;
    const ss=isCharterInactive?{bg:'#F4F2EE',color:'#666',label:'INACTIVE'}:STATUS_STYLE[cur.s||'available']||STATUS_STYLE.available;
    const engs=FL_ENGINES.filter(e=>e.boatId===b.id);
    const isSuzuki=engs.some(e=>e.brand==='Suzuki');
    const metaLeft=`${b.type} · ${b.cap||'?'} PAX${engs.length?' · '+engs.length+' EN':''}${isSuzuki?' · Suzuki':''}`;
    // Location pill from structured fields
    const allLocTypes=Object.values(LOCATION_TYPES).flat();
    const lt=cur.locType?allLocTypes.find(t=>t.val===cur.locType):null;
    const LOC_PILL_STYLE={pier:{bg:'#E1F5EE',color:'#0F6E56'},shop:{bg:'#FAEEDA',color:'#854F0B'},dock:{bg:'#FCEBEB',color:'#A32D2D'}};
    const lps=lt?LOC_PILL_STYLE[lt.type]:null;
    const locLabel=cur.detail||(lt?lt.label:'')||cur.loc||'';
    // Hide location pill if charter is inactive (no charter today)
    const locPill=(!isCharterInactive&&locLabel&&lps)?`<span style="display:inline-flex;align-items:center;gap:3px;background:${lps.bg};color:${lps.color};padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600">${locLabel}${cur.province&&!locLabel.includes(cur.province)?' · '+cur.province:''}</span>`:((!isCharterInactive&&cur.loc)?`<span style="font-size:9px;color:${dim.ink3}">${cur.loc}</span>`:'');
    // Pier assignment badge (NEW)
    let asnBadge = '';
    if(typeof getActiveAssignment === 'function'){
      const active = getActiveAssignment(b);
      if(active){
        const toLbl = (typeof PIER_LABELS!=='undefined' ? PIER_LABELS[active.toPier] : active.toPier) || active.toPier;
        asnBadge = `<span style="display:inline-flex;align-items:center;gap:2px;background:#FDF2F8;color:#9F1B4F;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600;border:0.5px solid #F0C0D0" title="ย้ายไป ${toLbl} จนถึง ${active.endDate}">📍 ${toLbl.replace('Visit ','')}</span>`;
      }
    }
    // Project chip — active project for this boat (Phase 2)
    let projChip = '';
    if(typeof FL_PROJECTS !== 'undefined'){
      const activeProj = (FL_PROJECTS||[]).find(p=>p.boatId===b.id && p.status==='inprogress');
      if(activeProj){
        const from = new Date(activeProj.planFrom||activeProj.actualFrom||TODAY_STR);
        const today = new Date(TODAY_STR);
        const dayN  = Math.max(1, Math.ceil((today-from)/86400000)+1);
        const dayLbl = activeProj.planTo
          ? `day ${dayN}/${Math.max(1, Math.ceil((new Date(activeProj.planTo)-from)/86400000)+1)}`
          : `day ${dayN} · Open`;
        projChip = `<span onclick="event.stopPropagation();_selProjId='${activeProj.id}';nav(document.querySelector('[data-view=\\'fl-projects\\']'))" style="display:inline-flex;align-items:center;gap:4px;background:#EEF3FF;color:#3A6FF7;padding:2px 7px;border-radius:8px;font-size:9px;font-weight:600;border:0.5px solid rgba(58,111,247,.2);cursor:pointer" title="${activeProj.name} · click to open">${typeof flProjIcon==='function'?flProjIcon('wrench',9,'#3A6FF7',2):''} ${activeProj.no} · ${dayLbl}</span>`;
      }
    }
    // Subtle dim for unavailable/fixing boats · avatar grayscale + content opacity .65
    // (selected boat overrides this so user can see what they clicked)
    const isDimmed = !isSel && !isCharterInactive && (cur.s === 'unavailable' || cur.s === 'fixing');
    const avatarFilter = isDimmed ? 'filter:grayscale(1);' : '';
    const contentOpacity = isDimmed ? 'opacity:.65;' : '';
    return`<div data-bid="${b.id}" onclick="selectBoat('${b.id}')" style="display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:8px;cursor:pointer;${isSel?'background:'+SVG_PINK.soft+';border:1px solid #F0C0D0;':'border:1px solid transparent;border-top:0.5px solid '+dim.line+';margin-top:2px;'}${isCharterInactive?'opacity:.65;':''}">
      <div style="width:32px;height:32px;border-radius:50%;background:${c};color:white;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;${avatarFilter}">${init}</div>
      <div style="flex:1;min-width:0;${contentOpacity}">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:13px;font-weight:600;color:${dim.ink}">${b.name}</span><span style="background:${ss.bg};color:${ss.color};padding:1px 7px;border-radius:8px;font-size:9px;font-weight:600;letter-spacing:.04em">${ss.label}</span>${asnBadge}${projChip}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap;overflow:hidden">
          <span style="font-size:9px;color:${isSel?SVG_PINK.text:dim.ink3}">${metaLeft}</span>
          ${locPill?'<span style="color:'+dim.ink5+';font-size:9px">·</span>'+locPill:''}
        </div>
      </div>
      <span style="color:${isSel?SVG_PINK.text:(isDimmed?'#ddd':dim.ink5)};font-size:14px;flex-shrink:0">›</span>
    </div>`;
  };

  const sectionHd=(label,color,bg,count)=>`<div style="display:flex;align-items:center;gap:6px;margin:14px 0 8px;padding:0 4px 8px;border-bottom:1px solid rgba(0,0,0,.06)">
    <div style="width:18px;height:18px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${label.slice(0,2)}</div>
    <span style="font-size:11px;font-weight:600;color:${color}">${label}</span>
    <span style="background:${bg};color:${color};padding:1px 8px;border-radius:9px;font-size:10px;font-weight:600">${count}</span>
  </div>`;

  const tlList=companyBoats.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)==='tublamu');
  const vpList=companyBoats.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)==='panwa');
  const rnList=companyBoats.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)==='ranong');
  const shopList=companyBoats.filter(b=>(typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier)==='shop');

  let listHtml='';
  if(tlList.length){listHtml+=sectionHd('Tub Lamu','#0F6E56','#E1F5EE',tlList.length)+tlList.map(b=>buildBoatRow(b,false)).join('');}
  if(vpList.length){listHtml+=sectionHd('Visit Panwa','#185FA5','#E6F1FB',vpList.length)+vpList.map(b=>buildBoatRow(b,false)).join('');}
  if(rnList.length){listHtml+=sectionHd('Ranong','#BA7517','#FAEEDA',rnList.length)+rnList.map(b=>buildBoatRow(b,false)).join('');}
  if(shopList.length){listHtml+=sectionHd('🔧 In Shop','#854F0B','#FAEEDA',shopList.length)+shopList.map(b=>buildBoatRow(b,false)).join('');}

  // Charter section
  let charterHtml='';
  if(allCharter.length){
    charterHtml=`<div style="display:flex;align-items:center;gap:6px;margin:16px 0 8px;padding:8px 12px;background:linear-gradient(to right,#FFF5EC 0%,#FBEAF0 60%,#F5DDE6 100%);border-radius:10px">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9F1B4F">เรือเช่า</span>
      <span style="background:#E03B7E;color:white;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:600">${charterBoats.length}</span>
      <button onclick="openCharterModal()" style="margin-left:auto;background:#1A1A1A;color:white;border:none;border-radius:14px;padding:4px 11px;font-size:10px;font-weight:600;cursor:pointer">+ เพิ่ม</button>
    </div>`+(charterBoats.length?charterBoats.map(b=>buildBoatRow(b,true)).join(''):`<div style="font-size:11px;color:${dim.ink3};text-align:center;padding:12px">ไม่ตรงกับ filter</div>`);
  }

  if(!companyBoats.length&&!charterBoats.length){
    listHtml=`<div style="font-size:12px;color:${dim.ink3};text-align:center;padding:30px 0">ไม่พบเรือตามตัวกรอง</div>`;
  }

  const listPanel=`<div style="background:white;border-radius:14px;padding:13px 14px;border:1px solid ${dim.line};max-height:calc(100vh - 360px);overflow-y:auto">
    ${listHtml}
    ${charterHtml}
  </div>`;

  // Detail panel placeholder — actual content handled by selectBoat() in the original `bdp` element
  const detailPanel=`<div id="bs-detail-mount" style="background:white;border-radius:14px;padding:0;border:1px solid ${dim.line};min-height:400px;overflow:hidden"></div>`;

  // Detach bdp before resetting innerHTML to avoid losing it
  const bdp=document.getElementById('bdp');
  if(bdp&&bdp.parentNode){
    bdp.parentNode.removeChild(bdp);
  }

  // Wrap
  document.getElementById('bs-pink-wrap').innerHTML=`
    ${headerBar}
    ${kpiStrip}
    ${filterBar}
    <div style="display:grid;grid-template-columns:380px 1fr;gap:12px;align-items:start">
      ${listPanel}
      ${detailPanel}
    </div>`;

  // Hide original bdp (we render custom detail instead)
  if(bdp){
    bdp.style.display='none';
    document.body.appendChild(bdp); // keep in DOM for JS access
  }

  // Render custom detail
  renderBoatDetailPink();
}
function bsCalShift(n){
  if(typeof window.bsCalDate==='undefined'||!window.bsCalDate)window.bsCalDate=new Date(TODAY_STR);
  const d=new Date(window.bsCalDate);
  d.setDate(1);
  d.setMonth(d.getMonth()+n);
  window.bsCalDate=d;
  if(typeof renderBoatDetailPink==='function')renderBoatDetailPink();
}
function bsCalToday(){
  window.bsCalDate=new Date(TODAY_STR);
  if(typeof renderBoatDetailPink==='function')renderBoatDetailPink();
}
function bsCellClick(ds,logId){
  if(!selBoatId)return;
  // Always open ADD modal pre-filled with the clicked date.
  // This avoids the confusing UX where editing a long-running entry
  // changes the color across many days at once.
  if(typeof openAddStatusModal==='function'){
    openAddStatusModal();
    const fromInp=document.getElementById('fm-st-from');
    if(fromInp)fromInp.value=ds;
  }
}
function bsDebugLog(bid){
  const b=getBoat(bid);if(!b){alert('Boat not found');return;}
  const log=b.log||[];
  // Build readable summary
  const sorted=[...log].sort((a,z)=>(a.from||'').localeCompare(z.from||''));
  const lines=sorted.map((e,i)=>`${i+1}. ${e.s.padEnd(12)} ${e.from} → ${e.to||'(open)'}${e.loc?' @ '+e.loc:''}${e.note?' · '+e.note:''}`);
  // Test getCurStatus for next 30 days
  const today=new Date(TODAY_STR);
  const testLines=[];
  for(let i=0;i<30;i++){
    const d=new Date(today);
    d.setDate(today.getDate()+i);
    const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const cs=getCurStatus(b,ds);
    testLines.push(`${ds}: ${cs.s}${cs.loc&&cs.loc!=='-'?' @ '+cs.loc:''}`);
  }
  const summary=`Boat: ${b.name} (${bid})\n\nLog entries (${log.length}):\n${lines.join('\n')||'(empty)'}\n\nNext 30 days getCurStatus:\n${testLines.join('\n')}`;
  // Show in modal-like prompt or just alert
  const w=window.open('','_blank','width=600,height=700,scrollbars=yes');
  if(w){
    w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:20px;white-space:pre-wrap">${summary.replace(/</g,'&lt;')}</pre>`);
  } else {
    console.log(summary);
    alert('Log:\n\n'+summary.slice(0,2000)+(summary.length>2000?'\n...':''));
  }
}

// Cleanup overlapping/duplicate log entries
function bsCleanupLog(bid){
  const b=getBoat(bid);if(!b||!b.log)return;
  if(!confirm('ทำความสะอาด log ของ '+b.name+'?\n\n• ลบ entries ซ้ำ\n• Trim overlaps\n• คง fixing log ที่ผูกกับ MJ ที่ยังเปิดอยู่ (to:null)')) return;
  // Build set of MJ.no's that are still inprogress for this boat
  const activeMjNos = new Set();
  if(typeof FL_MAINT !== 'undefined'){
    FL_MAINT.forEach(mj=>{
      if(mj.status==='inprogress' && mj.boatId===bid && mj.no){
        activeMjNos.add(mj.no);
      }
    });
  }
  const isLinkedToActiveMj = (e) => {
    if(e.s !== 'fixing' || !e.note) return false;
    for(const no of activeMjNos){
      if(e.note.includes(no)) return true;
    }
    return false;
  };
  // Sort by from ASC
  const sorted=[...b.log].sort((a,z)=>(a.from||'').localeCompare(z.from||''));
  const dayBefore=(ds)=>{
    const p=ds.split('-').map(Number);
    const d=new Date(p[0],p[1]-1,p[2]);
    d.setDate(d.getDate()-1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  // Remove exact duplicates (same from + same to + same s)
  const seen=new Set();
  const dedup=[];
  sorted.forEach(e=>{
    const key=`${e.from}|${e.to||'open'}|${e.s}|${e.note||''}`;
    if(!seen.has(key)){seen.add(key);dedup.push(e);}
  });
  // Dedupe: ลบ fixing logs ซ้ำที่ link MJ เดียวกัน (เก็บ first)
  const seenMjFixing = new Set();
  dedup.forEach(e=>{
    if(e.s !== 'fixing' || !e.note) return;
    for(const no of activeMjNos){
      if(e.note.includes(no)){
        if(seenMjFixing.has(no)){
          e._remove = true;
        } else {
          seenMjFixing.add(no);
        }
        break;
      }
    }
  });
  // Trim each entry's `to` to be < next entry's `from`
  const filtered = dedup.filter(e=>!e._remove);
  for(let i=0;i<filtered.length-1;i++){
    const cur=filtered[i],nxt=filtered[i+1];
    if(!nxt.from)continue;
    if(!cur.to||cur.to>=nxt.from){
      // Don't trim if cur is fixing linked to active MJ AND nxt is available (anomaly)
      if(isLinkedToActiveMj(cur) && nxt.s==='available'){
        // Remove the conflicting available entry instead
        nxt._remove = true;
        continue;
      }
      cur.to=dayBefore(nxt.from);
      if(cur.to<cur.from){cur._remove=true;}
    }
  }
  // Last entry: if open (to=null) AND NOT linked to active MJ → close it
  // If linked to active MJ → keep open
  const final = filtered.filter(e=>!e._remove);
  if(final.length){
    const last=final[final.length-1];
    if(!last.to && !isLinkedToActiveMj(last)){
      last.to = last.from;
    }
  }
  // Force reopen any fixing log linked to active MJ
  final.forEach(e=>{
    if(isLinkedToActiveMj(e)){
      e.to = null;
    }
  });
  b.log = final;
  if(typeof save==='function')save();
  if(typeof renderBoats==='function')renderBoats();
  alert('เสร็จ! เหลือ '+b.log.length+' entries\n'+(activeMjNos.size?'(เก็บ '+activeMjNos.size+' fixing log ผูก MJ ที่เปิดอยู่)':''));
}

function renderBoatDetailPink(){
  const mount=document.getElementById('bs-detail-mount');
  if(!mount)return;
  const dim={bg:'#F4F2EE',ink:'#1A1A1A',ink2:'#666',ink3:'#999',ink4:'#bbb',ink5:'#ccc',line:'rgba(0,0,0,.04)',line2:'#f0f0f0'};
  const SVG_PINK={accent:'#E03B7E',soft:'#FCE5EC',text:'#9F1B4F'};

  if(!selBoatId){
    mount.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;padding:40px;color:${dim.ink3};gap:10px;text-align:center">
      <div style="font-size:36px;opacity:.25">⛵</div>
      <div style="font-size:13px;color:${dim.ink2};font-weight:500">เลือกเรือเพื่อดู Timeline</div>
      <div style="font-size:11px;color:${dim.ink3}">คลิกเรือทางซ้ายเพื่อดูข้อมูลและประวัติสถานะ</div>
    </div>`;
    return;
  }

  const b=getBoat(selBoatId);
  if(!b){mount.innerHTML='';return;}

  const allCompany=BOATS.filter(x=>x.ownership!=='charter'&&!x.retired);
  const palette=['#185FA5','#534AB7','#1D9E75','#BA7517','#A32D2D','#0F6E56','#7F77DD','#D85A30','#993556','#185FA5'];
  const idx=allCompany.findIndex(x=>x.id===b.id);
  const isCharter=b.ownership==='charter';
  const _idc=(typeof getBoatColor==='function')?getBoatColor(b.id):null;
  const ac=isCharter?'#534AB7':((_idc&&_idc.text&&_idc.text!=='#666')?_idc.text:palette[(idx<0?0:idx)%palette.length]);
  const initials=(()=>{
    const w=b.name.split(/\s+/);
    if(w.length>=2)return (w[0][0]+w[1][0]).toUpperCase();
    if(b.name.length>=2&&/\d/.test(b.name))return (b.name.match(/[A-Z]/g)?.[0]||b.name[0])+b.name.slice(-1);
    return b.name.slice(0,2).toUpperCase();
  })();

  const cur=getCurStatus(b,TODAY_STR);
  const PIER_LBL={tublamu:'Tub Lamu Pier',panwa:'Visit Panwa',ranong:'Ranong Pier'};
  const curPier=typeof getBoatCurrentPier==='function'?getBoatCurrentPier(b):b.pier;
  const pierDisplay=cur.loc||PIER_LBL[curPier]||curPier;

  const STATUS_STYLE={
    available:{bg:'#1D9E75',color:'white',label:'AVAILABLE'},
    fixing:{bg:'#FAEEDA',color:'#854F0B',label:'FIXING'},
    unavailable:{bg:'#FCEBEB',color:'#A32D2D',label:'UNAVAILABLE'}
  };
  // Charter: check if today is covered by log entry
  const hasLogToday=(b.log||[]).some(e=>e.from<=TODAY_STR&&(!e.to||e.to>=TODAY_STR));
  const isCharterInactive=isCharter&&!hasLogToday;
  const ss=isCharterInactive?{bg:'#F4F2EE',color:'#666',label:'INACTIVE'}:STATUS_STYLE[cur.s||'available']||STATUS_STYLE.available;

  // Engine stats
  const engs=FL_ENGINES.filter(e=>e.boatId===b.id);
  const engBrandModel=engs.length?(()=>{
    const brands={};
    engs.forEach(e=>{const k=`${e.brand} ${e.model}`;brands[k]=(brands[k]||0)+1;});
    const top=Object.entries(brands).sort((a,b)=>b[1]-a[1])[0];
    return top?top[0]:'';
  })():'';
  const avgHours=engs.length?Math.round(engs.reduce((s,e)=>s+(typeof flEngHours==='function'?flEngHours(e.id):(e.baseHours||0)),0)/engs.length):0;

  // Spares on board
  const spareGbs=FL_GEARBOXES.filter(g=>g.spareLocation==='boat:'+b.id);
  const spareProps=FL_PROPELLERS.filter(p=>p.spareLocation==='boat:'+b.id);
  const totalSpares=spareGbs.length+spareProps.length;
  const spareDetail=totalSpares?[spareGbs.length?spareGbs.length+' gearbox'+(spareGbs.length>1?'es':''):'',spareProps.length?spareProps.length+' prop'+(spareProps.length>1?'s':''):''].filter(x=>x).join(' · '):'no spares';

  // Last service hours ago — from FL_MAINT done jobs for this boat
  const doneJobs=FL_MAINT.filter(m=>m.boatId===b.id&&m.status==='done').sort((a,b)=>(b.endDate||b.startDate||'').localeCompare(a.endDate||a.startDate||''));
  const lastServiceLabel=doneJobs.length?(()=>{
    const j=doneJobs[0];
    const dt=j.endDate||j.startDate;
    if(!dt)return '';
    const d=new Date(dt);
    const diffDays=Math.floor((new Date(TODAY_STR)-d)/(86400000));
    return diffDays>=0?`${diffDays} days ago`:'';
  })():'no service';

  // Status timeline calendar (use bsCalDate state, default to today)
  if(typeof window.bsCalDate==='undefined'||!window.bsCalDate)window.bsCalDate=new Date(TODAY_STR);
  const calRef=window.bsCalDate;
  const today=new Date(TODAY_STR);
  const yr=calRef.getFullYear(), mo=calRef.getMonth();
  const firstDay=new Date(yr,mo,1);
  const lastDay=new Date(yr,mo+1,0);
  const startWd=(firstDay.getDay()+6)%7; // Mon=0
  const daysInMonth=lastDay.getDate();
  const totalCells=Math.ceil((startWd+daysInMonth)/7)*7;
  const MONTHS_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabel=`${MONTHS_EN[mo]} ${yr}`;

  const STATUS_CAL_COLOR={available:'#1D9E75',fixing:'#BA7517',unavailable:'#A32D2D'};

  // Get status for each day + capture log entry
  // Debug: log b.log state
  if(window.bsDebug)console.log('[BoatStatus]',b.name,'log:',JSON.parse(JSON.stringify(b.log||[])));
  const calCells=[];
  for(let i=0;i<totalCells;i++){
    if(i<startWd||i>=startWd+daysInMonth){
      calCells.push({empty:true});
      continue;
    }
    const dayN=i-startWd+1;
    const d=new Date(yr,mo,dayN);
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(dayN).padStart(2,'0')}`;
    const st=getCurStatus(b,ds);
    const isToday=ds===TODAY_STR;
    const isFuture=ds>TODAY_STR;
    // Find log entry covering this day (for edit on click)
    const logEntry=(b.log||[]).find(e=>e.from<=ds&&(!e.to||e.to>=ds));
    calCells.push({day:dayN,ds,status:st.s||'available',isToday,isFuture,logId:logEntry?logEntry.id:null});
  }

  const calRows=[];
  for(let r=0;r<calCells.length;r+=7){
    calRows.push(calCells.slice(r,r+7));
  }

  const calHtml=calRows.map(row=>row.map(c=>{
    if(c.empty)return`<div style="aspect-ratio:1"></div>`;
    // Charter boats: only render colored cells when there's a log entry covering that day
    // Otherwise render as empty white (charter is "off" by default)
    if(isCharter&&!c.logId){
      const todayBorder=c.isToday?`box-shadow:0 0 0 2px white,0 0 0 4px ${SVG_PINK.accent};`:'';
      return`<div onclick="bsCellClick('${c.ds}',null)" style="aspect-ratio:1;background:white;border:0.5px solid rgba(0,0,0,.06);border-radius:5px;display:flex;align-items:flex-end;padding:3px;color:${dim.ink5};font-size:9px;font-family:'DM Mono',monospace;cursor:pointer;${todayBorder}">${c.day}</div>`;
    }
    // Future days WITHOUT log entry → empty white cell
    if(c.isFuture&&!c.logId){
      return`<div onclick="bsCellClick('${c.ds}',null)" style="aspect-ratio:1;background:white;border:0.5px solid rgba(0,0,0,.06);border-radius:5px;display:flex;align-items:flex-end;padding:3px;color:${dim.ink5};font-size:9px;font-family:'DM Mono',monospace;cursor:pointer">${c.day}</div>`;
    }
    // Past or future WITH log entry → status color
    const bg=STATUS_CAL_COLOR[c.status]||'#1D9E75';
    const ringStyle=c.isToday?`box-shadow:0 0 0 2px white,0 0 0 4px ${SVG_PINK.accent};background:${SVG_PINK.accent};font-weight:700`:'';
    // Slightly fade future days with log to differentiate from past
    const futureOpacity=c.isFuture&&!c.isToday?'opacity:.85;':'';
    const handler=c.logId?`bsCellClick('${c.ds}','${c.logId}')`:`bsCellClick('${c.ds}',null)`;
    return`<div onclick="${handler}" style="aspect-ratio:1;background:${bg};border-radius:5px;display:flex;align-items:flex-end;padding:3px;color:white;font-size:9px;font-family:'DM Mono',monospace;cursor:pointer;${futureOpacity}${ringStyle}">${c.day}</div>`;
  }).join('')).join('');

  // Recent status changes — show ALL log entries (sorted by from desc)
  const events=[];
  if(b.log&&Array.isArray(b.log)){
    [...b.log].sort((a,b)=>(b.from||'').localeCompare(a.from||'')).forEach(st=>{
      events.push({
        date:st.from,
        endDate:st.to,
        status:st.s,
        title:st.note||(st.s==='fixing'?'อยู่ระหว่างซ่อม':st.s==='available'?'พร้อมใช้งาน':'ไม่พร้อมใช้'),
        province:st.province||'',
        locType:st.locType||'',
        detail:st.detail||'',
        legacyLoc:st.loc||'',
        logId:st.id,
        outcome:st.s==='available'?'พร้อม':(st.s==='fixing'?(st.to?'ซ่อมเสร็จ':'ซ่อมอยู่'):'หยุดใช้')
      });
    });
  }

  const fmtEvtDate=(start,end)=>{
    if(!start)return '';
    const s=new Date(start);
    const sYr=s.getFullYear();
    const sLabel=`${MONTHS_EN[s.getMonth()]} ${s.getDate()}`;
    if(!end||end===start)return sLabel;
    const e=new Date(end);
    const eYr=e.getFullYear();
    if(eYr!==sYr)return `${sLabel}, ${sYr} → ${MONTHS_EN[e.getMonth()]} ${e.getDate()}, ${eYr}`;
    if(e.getMonth()===s.getMonth())return `${sLabel}–${e.getDate()}`;
    return `${sLabel} → ${MONTHS_EN[e.getMonth()]} ${e.getDate()}`;
  };

  const fmtDuration=(start,end)=>{
    if(!start||!end)return '';
    const s=new Date(start),e=new Date(end);
    const days=Math.round((e-s)/86400000)+1;
    if(days<=0)return '';
    if(days===1)return '1 วัน';
    if(days<30)return `${days} วัน`;
    const months=Math.round(days/30);
    if(months<12)return `${months} เดือน`;
    const years=Math.floor(months/12);
    const remM=months%12;
    return remM?`${years}\u0e1b ${remM}\u0e14`:`${years} ปี`;
  };

  const allLocTypesH=Object.values(LOCATION_TYPES).flat();
  const LOC_PILL_STYLE_H={pier:{bg:'#E1F5EE',color:'#0F6E56'},shop:{bg:'#FAEEDA',color:'#854F0B'},dock:{bg:'#FCEBEB',color:'#A32D2D'}};

  const eventsHtml=events.length?events.map((ev,idx)=>{
    const evSt=STATUS_STYLE[ev.status]||STATUS_STYLE.available;
    const isLast=idx===events.length-1;
    const outcomeColor=ev.status==='available'?'#0F6E56':(ev.status==='fixing'?'#854F0B':'#A32D2D');
    const dur=fmtDuration(ev.date,ev.endDate);
    const clickHandler=ev.logId?`onclick="editStatus('${b.id}','${ev.logId}')"`:'';
    // Build location pill
    const lt=ev.locType?allLocTypesH.find(t=>t.val===ev.locType):null;
    const lps=lt?LOC_PILL_STYLE_H[lt.type]:null;
    const locLbl=ev.detail||(lt?lt.label:'');
    let locHtml='';
    if(locLbl&&lps){
      locHtml=`<div style="display:flex;align-items:center;gap:5px;margin-top:3px"><span style="background:${lps.bg};color:${lps.color};padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600">${locLbl}</span>${ev.province?'<span style="color:'+dim.ink5+';font-size:9px">·</span><span style="font-size:10px;color:'+dim.ink3+'">'+ev.province+'</span>':''}</div>`;
    } else if(ev.legacyLoc){
      locHtml=`<div style="font-size:10px;color:${dim.ink3};margin-top:2px">${ev.legacyLoc}</div>`;
    }
    return`<div ${clickHandler} style="display:grid;grid-template-columns:120px 1fr 70px 24px;gap:12px;padding:11px 14px;align-items:center;${isLast?'':'border-bottom:0.5px solid rgba(0,0,0,.06)'};cursor:${ev.logId?'pointer':'default'}">
      <div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:${dim.ink};font-weight:500">${fmtEvtDate(ev.date,ev.endDate)}</div>
        ${dur?`<div style="font-size:9px;color:${dim.ink3};margin-top:1px">${dur}</div>`:''}
      </div>
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="background:${evSt.bg};color:${evSt.color};padding:1px 8px;border-radius:9px;font-size:10px;font-weight:600">${evSt.label}</span><span style="font-size:11px;color:${dim.ink};font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ev.title}</span></div>
        ${locHtml}
      </div>
      <div style="font-size:10px;color:${outcomeColor};text-align:right;font-weight:500">${ev.outcome}</div>
      <span style="color:${dim.ink5};font-size:14px">${ev.logId?'›':''}</span>
    </div>`;
  }).join(''):`<div style="font-size:11px;color:${dim.ink3};text-align:center;padding:20px">ยังไม่มีประวัติสถานะ</div>`;

  // Render
  mount.innerHTML=`<div style="background:white;border-radius:14px;padding:16px 18px;border:1px solid ${dim.line}">
    <div style="display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid rgba(0,0,0,.06);margin-bottom:14px">
      <div style="width:44px;height:44px;border-radius:50%;background:${ac};color:white;font-size:14px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:18px;font-weight:700">${b.name}</span><button onclick="startEditName()" style="background:none;border:none;color:${dim.ink3};font-size:11px;cursor:pointer;padding:0">✎</button><label title="สีประจำเรือ — คลิกเพื่อเปลี่ยน" style="position:relative;display:inline-flex;align-items:center;cursor:pointer;line-height:0"><span style="width:15px;height:15px;border-radius:5px;background:${ac};border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.18)"></span><input type="color" value="${_idc&&_idc.text&&/^#[0-9a-fA-F]{6}$/.test(_idc.text)?_idc.text:'#185FA5'}" onchange="flSetBoatColor('${b.id}',this.value)" style="position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;cursor:pointer"></label><span style="background:${ss.bg};color:${ss.color};padding:2px 9px;border-radius:11px;font-size:10px;font-weight:600;letter-spacing:.04em">${ss.label}</span></div>
        <div style="font-size:11px;color:${dim.ink2};margin-top:2px">${b.type} · ${b.cap||'?'} PAX${engs.length?' · '+engs.length+' engines':''} · ${pierDisplay} · ID ${b.id}</div>
        ${(function(){
          if(typeof getActiveAssignment!=='function') return '';
          const active = getActiveAssignment(b);
          if(!active) return '';
          const fromLbl = PIER_LABELS[active.fromPier]||active.fromPier;
          const toLbl = PIER_LABELS[active.toPier]||active.toPier;
          return `<div style="display:inline-flex;align-items:center;gap:5px;margin-top:5px;background:#FDF2F8;color:#9F1B4F;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600;border:0.5px solid #F0C0D0">📍 ${fromLbl} → ${toLbl} <span style="opacity:.7;font-weight:400">· until ${active.endDate}</span></div>`;
        })()}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="qfOpen('${b.id}')" title="Quick Fix Log · พบ + ซ่อม + จบในขั้นตอนเดียว" style="background:#E1F5EE;color:#0F6E56;border:1px solid #9FE1CB;border-radius:20px;padding:7px 14px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Quick Fix
        </button>
        <button onclick="flOpenNewAssignment('${b.id}')" style="background:white;color:${dim.ink};border:1px solid rgba(0,0,0,.12);border-radius:20px;padding:7px 14px;font-size:11px;font-weight:600;cursor:pointer">+ Move</button>
        <button onclick="openAddStatusModal()" style="background:${dim.ink};color:white;border:none;border-radius:20px;padding:7px 16px;font-size:11px;font-weight:600;cursor:pointer">+ Status</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:${dim.bg};border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">Engines</div>
        <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;margin-top:2px">${engs.length}</div>
        <div style="font-size:10px;color:${dim.ink2}">${engBrandModel||'no engines'}</div>
      </div>
      <div style="background:${dim.bg};border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">Avg hours</div>
        <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;margin-top:2px">${avgHours.toLocaleString()}</div>
        <div style="font-size:10px;color:${dim.ink2}">${lastServiceLabel}</div>
      </div>
      <div style="background:${dim.bg};border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">Spares on board</div>
        <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;margin-top:2px;color:${totalSpares?SVG_PINK.text:dim.ink}">${totalSpares}</div>
        <div style="font-size:10px;color:${dim.ink2}">${spareDetail}</div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:13px;font-weight:600">Status Timeline</span>
      <div style="display:flex;align-items:center;gap:4px;background:${dim.bg};border-radius:14px;padding:2px">
        <button onclick="bsCalShift(-1)" style="background:none;border:none;color:${dim.ink2};font-size:13px;cursor:pointer;padding:2px 8px;border-radius:10px;font-weight:600">‹</button>
        <span style="font-size:11px;font-weight:600;color:${dim.ink};font-family:'DM Mono',monospace;min-width:74px;text-align:center">${monthLabel}</span>
        <button onclick="bsCalShift(1)" style="background:none;border:none;color:${dim.ink2};font-size:13px;cursor:pointer;padding:2px 8px;border-radius:10px;font-weight:600">›</button>
      </div>
      <button onclick="bsDebugLog('${b.id}')" style="background:${dim.bg};border:none;border-radius:14px;padding:4px 9px;font-size:10px;color:${dim.ink2};cursor:pointer;font-weight:500" title="Show raw log data">🔍</button>
      <button onclick="bsCleanupLog('${b.id}')" style="background:${dim.bg};border:none;border-radius:14px;padding:4px 9px;font-size:10px;color:${dim.ink2};cursor:pointer;font-weight:500" title="Cleanup overlapping log entries">🧹</button>
      <button onclick="bsCalToday()" style="margin-left:auto;background:${dim.bg};border:none;border-radius:14px;padding:4px 11px;font-size:10px;color:${dim.ink2};cursor:pointer;font-weight:500">Today</button>
    </div>

    <div style="background:#FBFAF7;border-radius:10px;padding:12px 14px;margin-bottom:14px;max-width:520px">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;font-size:9px;color:${dim.ink3};font-weight:600;text-align:center;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">
        <span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span><span>อา</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${calHtml}</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06);font-size:10px;color:${dim.ink2};flex-wrap:wrap">
        <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;background:#1D9E75;border-radius:3px"></span>Available</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;background:#BA7517;border-radius:3px"></span>Fixing</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;background:#A32D2D;border-radius:3px"></span>Unavailable</span>
        <span style="margin-left:auto;font-family:'DM Mono',monospace">Today: ${MONTHS_EN[today.getMonth()]} ${today.getDate()}</span>
      </div>
    </div>

    ${(function(){
      // Pier Assignments section (NEW)
      if(typeof getActiveAssignment!=='function') return '';
      const activeA = getActiveAssignment(b);
      const plannedA = typeof getPlannedAssignments==='function'?getPlannedAssignments(b):[];
      const pastA = typeof getPastAssignments==='function'?getPastAssignments(b):[];
      const total = (activeA?1:0) + plannedA.length + pastA.length;
      if(total === 0) return '';
      const renderAsnCard=(a,statusLabel,statusColor,statusBg)=>{
        const fromLbl=PIER_LABELS[a.fromPier]||a.fromPier;
        const toLbl=PIER_LABELS[a.toPier]||a.toPier;
        return `<div style="background:#FBFAF7;border-radius:10px;padding:9px 11px;border-left:3px solid ${statusColor};margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600">${fromLbl} → ${toLbl}</div>
              <div style="font-size:10px;color:${dim.ink2};margin-top:1px">${a.startDate} – ${a.endDate} · ${a.type==='permanent'?'Permanent':'Temporary'}</div>
              ${a.reason?`<div style="font-size:10px;color:${dim.ink3};margin-top:2px;font-style:italic">${a.reason}</div>`:''}
              ${a.cost?`<div style="font-size:10px;color:${dim.ink3};margin-top:1px;font-family:'DM Mono',monospace">฿${a.cost.toLocaleString()}</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;align-items:end;flex-shrink:0">
              <span style="background:${statusBg};color:${statusColor};padding:1px 7px;border-radius:8px;font-size:9px;font-weight:600">${statusLabel}</span>
              ${a.status!=='cancelled'&&a.status!=='completed'?`<button onclick="event.stopPropagation();flCancelAssignment('${b.id}','${a.id}')" style="background:none;border:none;color:${dim.ink3};font-size:9px;cursor:pointer;padding:0">Cancel</button>`:''}
            </div>
          </div>
        </div>`;
      };
      return `<div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:600">📍 Pier Assignments <span style="color:${dim.ink3};font-weight:400">${total}</span></span>
          <button onclick="flOpenNewAssignment('${b.id}')" style="background:none;border:none;color:#9F1B4F;font-size:11px;font-weight:600;cursor:pointer">+ New</button>
        </div>
        ${activeA?renderAsnCard(activeA,'Active','#0F6E56','#E0F5EC'):''}
        ${plannedA.slice(0,2).map(a=>renderAsnCard(a,'Planned','#854F0B','#FAEEDA')).join('')}
        ${pastA.slice(0,2).map(a=>renderAsnCard(a,'Completed','#999','#F0EEEA')).join('')}
      </div>`;
    })()}

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:13px;font-weight:600">Status history</span>
      <span style="font-size:10px;color:${dim.ink3}">${events.length} entries</span>
    </div>
    <div style="background:#FBFAF7;border-radius:10px;overflow:hidden;max-height:400px;overflow-y:auto">${eventsHtml}</div>
  </div>`;
}

function selectBoat(id){
  selBoatId=id; renderBoats();
  const b=getBoat(id);
  if(!b)return;
  // Safe-update bdp fields if accessible (for hidden legacy panel)
  const bdpEmpty=document.getElementById('bdp-empty');
  const bdpContent=document.getElementById('bdp-content');
  if(bdpEmpty)bdpEmpty.style.display='none';
  if(bdpContent)bdpContent.style.display='block';
  if(typeof cancelName==='function')cancelName();
  if(typeof cancelCap==='function')cancelCap();
  if(typeof cancelType==='function')cancelType();
  const nameText=document.getElementById('bdp-name-text');
  if(nameText)nameText.textContent=b.name;
  const st=getCurStatus(b,TODAY_STR);
  const curLoc=st.loc||'';
  const pl={tublamu:'Tub Lamu Pier',panwa:'Visit Panwa',ranong:'Ranong Pier'};
  const curPier=getBoatCurrentPier(b);
  const pierDisplay=curLoc?curLoc:(pl[b.pier]||b.pier);
  const mt=document.getElementById('bdp-meta-type');if(mt)mt.textContent=b.type;
  const mp=document.getElementById('bdp-meta-pier');if(mp)mp.textContent=pierDisplay;
  const cv=document.getElementById('bdp-cap-val');if(cv)cv.textContent=b.cap;
  // Render legacy timeline/gantt if visible
  if(bdpContent&&bdpContent.offsetParent!==null){
    if(selDetailTab==='tl'&&typeof renderTimeline==='function')renderTimeline(b);
    else if(typeof renderGantt==='function')renderGantt(b);
  }
  // Render pink detail panel
  if(typeof renderBoatDetailPink==='function')renderBoatDetailPink();
}

function startEditCap(){
  const b=getBoat(selBoatId);if(!b)return;
  document.getElementById('bdp-cap-display').style.display='none';
  document.getElementById('bdp-cap-edit').style.display='inline-flex';
  const inp=document.getElementById('bdp-cap-inp');
  inp.value=b.cap; inp.focus(); inp.select();
}
function confirmCap(){
  const b=getBoat(selBoatId);if(!b)return;
  const v=parseInt(document.getElementById('bdp-cap-inp').value);
  if(v>0){ b.cap=v; }
  document.getElementById('bdp-cap-val').textContent=b.cap;
  cancelCap(); save('config');
}
function cancelCap(){
  document.getElementById('bdp-cap-display').style.display='inline-flex';
  document.getElementById('bdp-cap-edit').style.display='none';
}
function onCapKey(e){if(e.key==='Enter')confirmCap();if(e.key==='Escape')cancelCap();}

function startEditType(){
  const b=getBoat(selBoatId);if(!b)return;
  document.getElementById('bdp-type-display').style.display='none';
  document.getElementById('bdp-type-edit').style.display='inline-flex';
  document.getElementById('bdp-type-sel').value=b.type;
}
function confirmType(){
  const b=getBoat(selBoatId);if(!b)return;
  b.type=document.getElementById('bdp-type-sel').value;
  document.getElementById('bdp-meta-type').textContent=b.type;
  cancelType(); save('config'); renderBoats();
}
function cancelType(){
  document.getElementById('bdp-type-display').style.display='inline-flex';
  document.getElementById('bdp-type-edit').style.display='none';
}

function startEditName(){
  const b=getBoat(selBoatId);if(!b)return;
  document.getElementById('bdp-name-display').style.display='none';
  document.getElementById('bdp-name-edit').style.display='flex';
  const inp=document.getElementById('bdp-name-inp');inp.value=b.name;inp.focus();inp.select();
}
function confirmName(){
  const b=getBoat(selBoatId);if(!b)return;
  const v=document.getElementById('bdp-name-inp').value.trim();
  if(v) b.name=v;
  document.getElementById('bdp-name-text').textContent=b.name;
  cancelName(); renderBoats(); save('config');
}
// §set the boat identity colour · flows to every getBoatColor consumer (Boat Asset, Boat Status, By-trip, n8n, job rows)
function flSetBoatColor(id,hex){
  const b=getBoat(id); if(!b) return;
  if(!/^#[0-9a-fA-F]{6}$/.test(String(hex||''))) return;
  b.color=hex; save('config');
  try{ if(typeof flRenderBoatList==='function') flRenderBoatList(); }catch(_){}
  try{ if(typeof flRenderBoatDetailPink==='function') flRenderBoatDetailPink(); }catch(_){}
  try{ if(typeof renderBoats==='function') renderBoats(); }catch(_){}
}
function cancelName(){
  document.getElementById('bdp-name-display').style.display='flex';
  document.getElementById('bdp-name-edit').style.display='none';
}
function onNameKey(e){if(e.key==='Enter')confirmName();if(e.key==='Escape')cancelName();}

function switchDetailTab(tab,el){
  selDetailTab=tab;
  document.querySelectorAll('.detail-tab').forEach(t=>t.classList.remove('on'));el.classList.add('on');
  document.getElementById('bdp-tl').style.display=tab==='tl'?'block':'none';
  document.getElementById('bdp-gantt').style.display=tab==='gantt'?'block':'none';
  document.getElementById('bdp-fleet').style.display=tab==='fleet'?'flex':'none';
  const b=getBoat(selBoatId);if(!b)return;
  if(tab==='tl') renderTimeline(b);
  else if(tab==='gantt') renderGantt(b);
  else if(tab==='fleet') renderFleetTab(b);
}

function renderFleetTab(b){
  if(typeof FL_ENGINES==='undefined') return;
  const el=document.getElementById('bdp-fleet');
  const engs=FL_ENGINES.filter(e=>e.boatId===b.id);
  const maints=FL_MAINT.filter(m=>m.boatId===b.id);
  const incs=FL_INCIDENTS.filter(i=>i.boatId===b.id);
  const fmtD=s=>{if(!s)return'—';const d=new Date(s);return`${d.getDate()} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][d.getMonth()]} ${d.getFullYear()+543}`;};

  const engsHtml=engs.length?engs.map(eng=>{
    const curH=flEngHours(eng.id);
    const next=eng.serviceInterval?Math.ceil(curH/eng.serviceInterval)*eng.serviceInterval:null;
    const left=next?+(next-curH).toFixed(1):null;
    const pct=next?(curH%eng.serviceInterval)/eng.serviceInterval*100:0;
    const gb=FL_GEARBOXES.find(g=>g.engineId===eng.id);
    const props=gb?FL_PROPELLERS.filter(p=>p.gearboxId===gb.id):[];
    return`<div style="background:var(--sand);border-radius:8px;padding:10px 12px;margin-bottom:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:var(--ocean);color:white;font-family:'DM Mono',monospace;letter-spacing:.02em">${eng.pos}</span>
          <span style="font-size:12px;font-weight:600;color:var(--ink)">${eng.brand} ${eng.model}</span>
        </div>
        <span class="pill ${eng.status==='ready'?'pill-green':eng.status==='fixing'?'pill-amber':'pill-red'}">${eng.status==='ready'?'Ready':eng.status==='fixing'?'Fixing':'Broken'}</span>
      </div>
      <div style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:var(--navy);margin-bottom:5px;letter-spacing:.02em">${eng.serial}</div>
      <div style="display:flex;align-items:baseline;gap:6px">
        <span style="font-size:18px;font-weight:600;font-family:'DM Mono',monospace">${curH.toLocaleString()}</span>
        <span style="font-size:11px;color:var(--ink-soft)">h</span>
        ${left!=null?`<span style="font-size:10px;color:${left<20?'var(--red)':left<50?'var(--amber)':'var(--green)'};margin-left:4px">อีก ${left} h ถึง service</span>`:''}
      </div>
      ${next?`<div class="h-bar"><div class="h-bar-inner" style="width:${Math.min(pct,100)}%;background:${pct>80?'var(--red)':pct>60?'var(--amber)':'var(--green)'}"></div></div>`:''}
      ${gb?`<div style="margin-top:6px;font-size:10px;color:var(--ink-mid)">🔩 ${gb.serial} ${gb.status!=='ready'?`<span style="color:var(--red)">(${gb.status})</span>`:''}
        ${props.length?'· '+props.map(p=>`<span style="padding:1px 5px;border-radius:3px;font-size:9px;${p.status==='active'?'background:var(--green-light);color:var(--green-dark)':'background:var(--sand);color:var(--ink-soft)'}">${p.size} ${p.status==='active'?'✓':p.status}</span>`).join(' '):''}
      </div>`:''}
    </div>`;
  }).join('')
  :'<div style="font-size:12px;color:var(--ink-soft)">ยังไม่มีเครื่องยนต์ — <button class="btn-xs" onclick="flOpenAddEngineModal()">+ เพิ่มเครื่องยนต์</button></div>';

  const maintsHtml=maints.length?maints.map(m=>{
    const c=m.status==='pending'?'var(--red)':m.status==='inprogress'?'var(--amber)':'var(--green)';
    const lbl={pending:'ค้าง',inprogress:'กำลังซ่อม',done:'เสร็จ'}[m.status];
    return`<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="width:3px;background:${c};border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1"><div style="font-size:12px;font-weight:500">${m.no} — ${m.title}</div>
      <div style="font-size:10px;color:var(--ink-soft)">${fmtD(m.startDate)} · ฿${(m.cost||0).toLocaleString()}</div></div>
      <span class="pill ${m.status==='done'?'pill-green':m.status==='inprogress'?'pill-amber':'pill-red'}">${lbl}</span>
    </div>`;
  }).join('')
  :'<div style="font-size:12px;color:var(--ink-soft)">ไม่มีประวัติ Maintenance</div>';

  const incsHtml=incs.length?incs.map(inc=>{
    return`<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--ocean);min-width:60px">${inc.no}</span>
      <div style="flex:1"><div style="font-size:12px;font-weight:500">${inc.title}</div>
      <div style="font-size:10px;color:var(--ink-soft)">${fmtD(inc.date)}</div></div>
      <span class="pill ${inc.severity==='minor'?'pill-amber':'pill-red'}">${inc.severity}</span>
    </div>`;
  }).join('')
  :'<div style="font-size:12px;color:var(--ink-soft)">ไม่มีประวัติ Job Assignment</div>';

  el.innerHTML=`
    <div>
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin-bottom:8px">เครื่องยนต์ (${engs.length} ลูก)</div>
      ${engsHtml}
    </div>
    <div>
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin-bottom:6px">Maintenance</div>
      ${maintsHtml}
    </div>
    <div>
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin-bottom:6px">Job Assignments</div>
      ${incsHtml}
    </div>`;
}

function renderTimeline(b){
  const log=[...b.log].sort((a,z)=>z.from.localeCompare(a.from));
  const sL={available:'Available',fixing:'Fixing',unavailable:'Unavailable'};
  const pc={available:'pill-green',fixing:'pill-amber',unavailable:'pill-red'};
  const dc={available:'g',fixing:'a',unavailable:'r'};
  const fmtD=s=>s?new Date(s).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'ไม่กำหนด';
  const isCur=e=>e.from<=TODAY_STR&&(!e.to||e.to>=TODAY_STR);
  const el=document.getElementById('bdp-tl');
  el.innerHTML=log.length===0
    ?'<p style="color:var(--ink-soft);font-size:12px">ยังไม่มีประวัติ</p>'
    :log.map(e=>{
      const cur=isCur(e);
      const dL=e.to?Math.ceil((new Date(e.to)-new Date(TODAY_STR))/86400000):null;
      return `<div class="tl-entry">
        <div class="tl-dot-col"><div class="tl-dot ${dc[e.s||'available']}"></div><div class="tl-line"></div></div>
        <div class="tl-body">
          <div class="tl-hd">
            <span class="pill ${pc[e.s||'available']}">${sL[e.s||'available']}</span>
            ${cur?'<span class="cur-tag">ปัจจุบัน</span>':''}
            ${dL!==null&&cur&&dL>=0?`<span style="font-size:10px;color:var(--ink-soft)">อีก ${dL} วัน</span>`:''}
          </div>
          <div class="tl-dates">${fmtD(e.from)} → ${fmtD(e.to)}</div>
          ${e.loc?`<div class="tl-loc"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${e.loc}</div>`:''}
          ${e.note?`<div class="tl-note">${e.note}</div>`:''}
          <div class="tl-acts">
            <button class="btn-xs tl-edit-btn" data-bid="${b.id}" data-slid="${e.id}">แก้ไข</button>
            <button class="btn-xs del tl-del-btn" data-bid="${b.id}" data-slid="${e.id}">ลบ</button>
          </div>
        </div>
      </div>`;
    }).join('');

  // event delegation — ไม่มีปัญหา id พิเศษ
  el.querySelectorAll('.tl-edit-btn').forEach(btn=>{
    btn.addEventListener('click',()=>editStatus(btn.dataset.bid, btn.dataset.slid));
  });
  el.querySelectorAll('.tl-del-btn').forEach(btn=>{
    btn.addEventListener('click',()=>delStatus(btn.dataset.bid, btn.dataset.slid));
  });
}

function shiftGantt(d){ganttOffset+=d;const b=getBoat(selBoatId);if(b)renderGantt(b);}
function renderGantt(selBoat){
  const DAYS=28,sd=addDays(TODAY,ganttOffset);
  const dates=[];for(let i=0;i<DAYS;i++) dates.push(fmt(addDays(sd,i)));
  const f=new Date(dates[0]),l=new Date(dates[dates.length-1]);
  document.getElementById('gantt-lbl').textContent=f.toLocaleDateString('th-TH',{day:'numeric',month:'short'})+' – '+l.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
  const getSt=(b,ds)=>(b.log||[]).find(e=>e.from<=ds&&(!e.to||e.to>=ds));
  const bc={available:'g',fixing:'a',unavailable:'r'};
  const boats2=boatPier==='all'?BOATS:BOATS.filter(b=>b.pier===boatPier);
  const hdr=`<tr><th class="gantt-th" style="min-width:80px;text-align:left;padding-bottom:6px">เรือ</th>${dates.map((d,i)=>{
    const it=d===TODAY_STR,day=new Date(d).getDate(),isF=day===1||i===0;
    return `<th class="gantt-th${it?' today-col':''}" title="${d}">
      ${isF?`<div style="font-size:8px;color:var(--ocean-mid);font-weight:600">${new Date(d).toLocaleDateString('th-TH',{month:'short'})}</div>`:''}
      <div style="font-size:9px">${day}</div>
    </th>`;
  }).join('')}</tr>`;
  const rows=boats2.map(b=>{
    const hl=b.id===selBoat.id;
    const cells=dates.map(d=>{
      const it=d===TODAY_STR,e=getSt(b,d);
      return `<td class="gantt-day-cell${it?' today-col':''}">${it?'<div class="gantt-today-line"></div>':''}${e?`<div class="gantt-bar ${bc[e.s]||'e'}" title="${e.s}${e.loc?' @'+e.loc:''}"></div>`:`<div class="gantt-bar e"></div>`}</td>`;
    }).join('');
    return `<tr class="${hl?'sel-hl':''}"><td class="gantt-boat-cell" style="${hl?'font-weight:500;color:var(--ocean)':''}">${b.name}</td>${cells}</tr>`;
  }).join('');
  document.getElementById('gantt-tbl').innerHTML=`<thead>${hdr}</thead><tbody>${rows}</tbody>`;
}

// status modal
// Location structure: each province has typed locations (pier/shop/dock)
const LOCATION_TYPES={
  'Phang Nga':[
    {val:'Tub Lamu Pier',type:'pier',label:'Tub Lamu Pier'},
    {val:'อู่ซ่อม Phang Nga',type:'shop',label:'อู่ซ่อม'},
    {val:'คานเรือ Phang Nga',type:'dock',label:'คานเรือ'}
  ],
  'Phuket':[
    {val:'Visit Panwa Pier',type:'pier',label:'Visit Panwa Pier'},
    {val:'อู่ซ่อม Phuket',type:'shop',label:'อู่ซ่อม'},
    {val:'คานเรือ Phuket',type:'dock',label:'คานเรือ'}
  ],
  'Ranong':[
    {val:'Grand Andaman Pier',type:'pier',label:'Grand Andaman Pier'},
    {val:'อู่ซ่อม Ranong',type:'shop',label:'อู่ซ่อม'},
    {val:'คานเรือ Ranong',type:'dock',label:'คานเรือ'}
  ]
};

function updateLocTypeOptions(){
  const prov=document.getElementById('fm-st-province').value;
  const sel=document.getElementById('fm-st-loctype');
  if(!prov){sel.innerHTML='<option value="">-- เลือกจังหวัดก่อน --</option>';return;}
  const opts=LOCATION_TYPES[prov]||[];
  sel.innerHTML='<option value="">-- เลือก --</option>'+opts.map(o=>`<option value="${o.val}" data-type="${o.type}">${o.label}</option>`).join('');
}

// Parse legacy free-text loc to structured fields
function parseLoc(loc){
  if(!loc)return{province:'',locType:'',detail:''};
  // Try matching known location values
  for(const[prov,types]of Object.entries(LOCATION_TYPES)){
    for(const t of types){
      if(loc.includes(t.val)||loc===t.label||loc===prov){
        return{province:prov,locType:t.val,detail:''};
      }
    }
  }
  // Heuristic: 'อู่' or 'shop' → shop type
  if(/อู่/.test(loc))return{province:'',locType:'',detail:loc};
  if(/คาน/.test(loc))return{province:'',locType:'',detail:loc};
  if(/Tub Lamu/i.test(loc))return{province:'Phang Nga',locType:'Tub Lamu Pier',detail:''};
  if(/Panwa/i.test(loc))return{province:'Phuket',locType:'Visit Panwa Pier',detail:''};
  if(/Ranong|Andaman/i.test(loc))return{province:'Ranong',locType:'Grand Andaman Pier',detail:''};
  return{province:'',locType:'',detail:loc};
}

// Format structured loc to display string
function fmtLoc(province,locType,detail){
  const parts=[];
  if(detail)parts.push(detail);
  if(locType&&!detail)parts.push(locType);
  else if(locType&&detail&&locType!==detail){
    // include type label only if shop/dock
    const lt=(LOCATION_TYPES[province]||[]).find(t=>t.val===locType);
    if(lt&&(lt.type==='shop'||lt.type==='dock'))parts[0]=`${detail} (${lt.label})`;
  }
  if(province&&!parts.some(p=>p.includes(province)))parts.push(province);
  return parts.join(' · ');
}

function openAddStatusModal(){
  editingSlId=null;selSt='available';
  document.getElementById('status-modal-title').textContent='เพิ่ม Status — '+(getBoat(selBoatId)?.name||'');
  document.getElementById('fm-st-from').value=TODAY_STR;
  document.getElementById('fm-st-to').value=TODAY_STR;
  document.getElementById('fm-st-province').value='';
  updateLocTypeOptions();
  document.getElementById('fm-st-locdetail').value='';
  document.getElementById('fm-st-note').value='';
  const reasonSel = document.getElementById('fm-st-reason');
  if(reasonSel) reasonSel.value = '';
  updateStPicker('available');
  openModal('status-modal');
  // Auto-sync from→to
  const fromInp=document.getElementById('fm-st-from');
  const toInp=document.getElementById('fm-st-to');
  fromInp.onchange=()=>{
    if(!toInp.value||toInp.value<fromInp.value){toInp.value=fromInp.value;}
  };
}
function editStatus(bid,slid){
  const b=getBoat(bid);const e=b?.log.find(x=>x.id===slid);if(!e)return;
  editingSlId=slid;selBoatId=bid;selSt=e.s;
  document.getElementById('status-modal-title').textContent='แก้ไข Status — '+(b?.name||'');
  document.getElementById('fm-st-from').value=e.from;
  document.getElementById('fm-st-to').value=e.to||e.from;
  // Location: prefer structured, fallback to parseLoc
  const province=e.province||'';
  const locType=e.locType||'';
  let detail=e.detail||'';
  if(!province&&!locType&&e.loc){
    const parsed=parseLoc(e.loc);
    document.getElementById('fm-st-province').value=parsed.province;
    updateLocTypeOptions();
    document.getElementById('fm-st-loctype').value=parsed.locType;
    detail=parsed.detail;
  } else {
    document.getElementById('fm-st-province').value=province;
    updateLocTypeOptions();
    document.getElementById('fm-st-loctype').value=locType;
  }
  document.getElementById('fm-st-locdetail').value=detail;
  document.getElementById('fm-st-note').value=e.note||'';
  const reasonSel = document.getElementById('fm-st-reason');
  if(reasonSel) reasonSel.value = e.reason || '';
  updateStPicker(e.s);
  openModal('status-modal');
}
function delStatus(bid,slid){
  if(!confirm('ลบ Status นี้?'))return;
  const b=getBoat(bid);if(!b)return;
  b.log=b.log.filter(e=>e.id!==slid);
  renderTimeline(b);renderBoats();save('config');
}
function pickSt(v){
  selSt=v;updateStPicker(v);
  // Show/hide reason dropdown based on status
  const reasonRow = document.getElementById('fm-st-reason-row');
  if(reasonRow) reasonRow.style.display = (v==='unavailable') ? '' : 'none';
}
function updateStPicker(v){
  ['available','fixing','unavailable'].forEach(s=>{
    const el=document.getElementById('sto-'+s);
    el.className='st-opt'+(s===v?' sel-'+s:'');
  });
  // Show/hide reason dropdown
  const reasonRow = document.getElementById('fm-st-reason-row');
  if(reasonRow) reasonRow.style.display = (v==='unavailable') ? '' : 'none';
}
function saveStatus(){
  const b=getBoat(selBoatId);if(!b)return;
  const from=document.getElementById('fm-st-from').value;
  const to=document.getElementById('fm-st-to').value;
  if(!from){alert('กรุณาระบุวันที่เริ่ม');return;}
  if(!to){alert('กรุณาระบุวันที่สิ้นสุด');return;}
  if(to<from){alert('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม');return;}
  const province=document.getElementById('fm-st-province').value;
  const locType=document.getElementById('fm-st-loctype').value;
  const detail=document.getElementById('fm-st-locdetail').value.trim();
  if(!province){alert('กรุณาเลือกจังหวัด');return;}
  if(!locType){alert('กรุณาเลือกประเภทสถานที่');return;}
  // Validate reason for Unavailable
  let reason = '';
  if(selSt === 'unavailable'){
    reason = document.getElementById('fm-st-reason')?.value || '';
    if(!reason){alert('กรุณาเลือกเหตุผลที่ไม่พร้อมใช้งาน');return;}
  }
  // Combined display string for backward compat with `loc` field
  const loc=fmtLoc(province,locType,detail);
  const note=document.getElementById('fm-st-note').value.trim();
  if(editingSlId){
    const e=b.log.find(x=>x.id===editingSlId);
    if(e) Object.assign(e,{s:selSt,from,to,loc,province,locType,detail,note,reason});
  } else {
    autoClosePrevLog(b,from,to);
    b.log.push({id:'sl'+Date.now(),s:selSt,from,to,loc,province,locType,detail,note,reason});
  }
  closeModal('status-modal');renderTimeline(b);renderBoats();save('config');
}

// auto-close previous open/overlapping log entries when adding a new one
function autoClosePrevLog(b,newFrom,newTo){
  if(!b.log||!b.log.length) return;
  // Helper: yyyy-mm-dd → date 1 day before
  const dayBefore=(ds)=>{
    const p=ds.split('-').map(Number);
    const d=new Date(p[0],p[1]-1,p[2]);
    d.setDate(d.getDate()-1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const dayAfter=(ds)=>{
    const p=ds.split('-').map(Number);
    const d=new Date(p[0],p[1]-1,p[2]);
    d.setDate(d.getDate()+1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const newEnd=newTo||null;
  // Iterate over a snapshot since we may push to b.log
  const toSplit=[];
  [...b.log].forEach(e=>{
    if(!e.from||e.from>=newFrom&&newEnd&&e.from>newEnd)return; // entry starts after new range — leave alone
    const eEnd=e.to||null;
    // Case A: entry starts before newFrom
    if(e.from<newFrom){
      // If open or extends into/past newFrom → close at newFrom-1
      if(!eEnd||eEnd>=newFrom){
        // If entry also extends past newEnd → split: keep e as before-part, push tail
        if(newEnd&&eEnd&&eEnd>newEnd){
          // Tail: from = newEnd+1, to = eEnd
          toSplit.push({...e,id:'sl'+Date.now()+'_t'+Math.random().toString(36).slice(2,5),from:dayAfter(newEnd),to:eEnd});
        }
        if(!eEnd&&newEnd){
          // Open entry entirely after newEnd should reopen as tail
          toSplit.push({...e,id:'sl'+Date.now()+'_t'+Math.random().toString(36).slice(2,5),from:dayAfter(newEnd),to:null});
        }
        e.to=dayBefore(newFrom);
      }
    }
    // Case B: entry starts on/after newFrom and within new range
    else if(e.from>=newFrom&&(!newEnd||e.from<=newEnd)){
      // If entry extends past newEnd → trim front
      if(newEnd&&(!eEnd||eEnd>newEnd)){
        e.from=dayAfter(newEnd);
        // if from > to now, mark for removal
        if(e.to&&e.from>e.to){e._remove=true;}
      } else {
        // entirely inside new range → remove
        e._remove=true;
      }
    }
  });
  // Push tails
  toSplit.forEach(t=>b.log.push(t));
  // Remove marked entries
  for(let i=b.log.length-1;i>=0;i--){
    if(b.log[i]._remove)b.log.splice(i,1);
  }
}

// boat modal
// Engine positions by count
function getEngPositions(n){
  if(n===1) return['Center'];
  if(n===2) return['Port','Std'];
  if(n===3) return['Port','Center','Std'];
  if(n===4) return['Port','C.Port','C.Std','Std'];
  return['Port','C.Port','Center','C.Std','Std'];
}

let fmBoatSt=0;
let fmBoatDocs=[];
function openBoatModal(){
  fmBoatSt=0; fmBoatDocs=[]; fmBoatOwn=0;
  const ids=['fm-boat-name','fm-boat-brand','fm-boat-model','fm-boat-reg','fm-boat-callsign',
    'fm-boat-imo','fm-boat-year','fm-boat-port','fm-boat-gt','fm-boat-nt','fm-boat-dwt',
    'fm-boat-loa','fm-boat-beam','fm-boat-depth','fm-boat-draft','fm-boat-lbp','fm-boat-bhp',
    'fm-boat-licensepax','fm-boat-crew','fm-boat-fishcrew','fm-boat-totalcap',
    'fm-boat-owner','fm-boat-homeport','fm-boat-owneraddr','fm-boat-note','fm-doc-name','fm-doc-exp'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('fm-boat-cap').value='40';
  document.getElementById('fm-boat-engcount').value='4';
  document.getElementById('fm-boat-pier').value='tublamu';
  document.querySelectorAll('#fm-boat-pier-pills .loc-pill').forEach((el,i)=>el.classList.toggle('on',i===0));
  fmRenderBoatSt(0);
  fmRenderBoatOwn(0);
  fmRenderDocs();
  document.getElementById('boat-modal-title').textContent='เพิ่มเรือใหม่';
  // auto-total listeners
  ['fm-boat-licensepax','fm-boat-crew','fm-boat-fishcrew'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.oninput=fmCalcTotal;
  });
  openModal('boat-modal');
}
function fmCalcTotal(){
  const pax=parseInt(document.getElementById('fm-boat-licensepax').value)||0;
  const crew=parseInt(document.getElementById('fm-boat-crew').value)||0;
  const fish=parseInt(document.getElementById('fm-boat-fishcrew').value)||0;
  const total=document.getElementById('fm-boat-totalcap');
  if(total) total.value=pax+crew+fish||'';
}
function fmSelPier(val,el){
  document.getElementById('fm-boat-pier').value=val;
  document.querySelectorAll('#fm-boat-pier-pills .loc-pill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
}
/* §boatOwn · 0 = เรือบริษัท · 1 = เรือเช่า/เรือร่วม (ownership==='charter')
   เกณฑ์เดียวกับที่ทั้งแอปใช้กรองอยู่แล้ว · ไม่ได้เพิ่มสถานะใหม่ แค่เปิดให้ตั้งค่าได้ */
let fmBoatOwn=0;
function fmPickBoatOwn(idx){ fmBoatOwn=idx; fmRenderBoatOwn(idx); }
function fmRenderBoatOwn(idx){
  const opts=document.querySelectorAll('#fm-boat-own-grid .fl-st-opt');
  const cfg=[{border:'#185FA5',bg:'#E6F1FB',txt:'#185FA5'},{border:'#C9922B',bg:'#FBF0E0',txt:'#9A5B00'}];
  opts.forEach((el,i)=>{
    if(i===idx){el.style.border=`1px solid ${cfg[i].border}`;el.style.background=cfg[i].bg;el.querySelector('div').style.color=cfg[i].txt;}
    else{el.style.border='1px solid var(--border)';el.style.background='var(--white)';el.querySelector('div').style.color='var(--ink-soft)';}
  });
  const h=document.getElementById('fm-boat-own-hint');
  if(h) h.textContent = idx===1
    ? 'เช่ามา / เรือร่วม · ไม่ขึ้นในทะเบียนเครื่องยนต์ เอกสารเรือ และต้นทุนกองเรือ เพราะไม่ใช่ทรัพย์สินของเรา'
    : 'เรือของบริษัท · นับเป็นทรัพย์สิน ติดเครื่องยนต์ เก็บเอกสาร และคิดต้นทุนกองเรือได้';
}
function fmPickBoatSt(idx){
  fmBoatSt=idx;fmRenderBoatSt(idx);
}
function fmRenderBoatSt(idx){
  const opts=document.querySelectorAll('#fm-boat-st-grid .fl-st-opt');
  const cfg=[
    {border:'var(--green)',bg:'var(--green-light)',txt:'var(--green-dark)'},
    {border:'var(--amber)',bg:'var(--amber-light)',txt:'#7a4a00'},
    {border:'var(--red)',bg:'var(--red-light)',txt:'var(--red)'}
  ];
  opts.forEach((el,i)=>{
    if(i===idx){el.style.border=`1px solid ${cfg[i].border}`;el.style.background=cfg[i].bg;el.querySelector('div').style.color=cfg[i].txt;}
    else{el.style.border='1px solid var(--border)';el.style.background='var(--white)';el.querySelector('div').style.color='var(--ink-soft)';}
  });
}
function fmAddDoc(){
  const name=document.getElementById('fm-doc-name').value.trim();
  const exp=document.getElementById('fm-doc-exp').value;
  if(!name)return;
  fmBoatDocs.push({name,exp});
  document.getElementById('fm-doc-name').value='';
  document.getElementById('fm-doc-exp').value='';
  fmRenderDocs();
}
function fmRemoveDoc(i){fmBoatDocs.splice(i,1);fmRenderDocs();}
function fmRenderDocs(){
  const MONTHS=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const fmtD=s=>{if(!s)return'ไม่กำหนด';const d=new Date(s);return`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()+543}`;};
  document.getElementById('fm-boat-docs').innerHTML=fmBoatDocs.map((doc,i)=>
    `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--sand);border-radius:5px">
      <span style="flex:1;font-size:12px">${doc.name}</span>
      <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--ink-soft)">${fmtD(doc.exp)}</span>
      <button class="btn-xs del" onclick="fmRemoveDoc(${i})">×</button>
    </div>`).join('');
}
function saveBoat(){
  const name=document.getElementById('fm-boat-name').value.trim();if(!name)return;
  const pier=document.getElementById('fm-boat-pier').value;
  const stMap=['available','fixing','unavailable'];
  const locMap={tublamu:'Tub Lamu Pier',panwa:'Visit Panwa',ranong:'Ranong Pier'};
  const g=id=>document.getElementById(id)?.value.trim()||'';
  const n=id=>{const v=parseFloat(document.getElementById(id)?.value);return isNaN(v)?null:v;};
  const fields={
    name, nameTh:g('fm-boat-nameth'), type:document.getElementById('fm-boat-type').value,
    engineCount:parseInt(document.getElementById('fm-boat-engcount').value)||4,
    use:document.getElementById('fm-boat-use').value,
    pier:pier,
    cap:parseInt(document.getElementById('fm-boat-cap').value)||40,
    licensePax:parseInt(document.getElementById('fm-boat-licensepax').value)||null,
    crew:parseInt(document.getElementById('fm-boat-crew').value)||null,
    fishcrew:parseInt(document.getElementById('fm-boat-fishcrew').value)||null,
    totalcap:parseInt(document.getElementById('fm-boat-totalcap').value)||null,
    brand:g('fm-boat-brand'), model:g('fm-boat-model'),
    reg:g('fm-boat-reg'), callsign:g('fm-boat-callsign'), imo:g('fm-boat-imo'),
    year:g('fm-boat-year'), material:document.getElementById('fm-boat-material').value,
    homeportCity:g('fm-boat-port'),
    gt:n('fm-boat-gt'), nt:n('fm-boat-nt'), dwt:n('fm-boat-dwt'),
    loa:n('fm-boat-loa'), beam:n('fm-boat-beam'), depth:n('fm-boat-depth'),
    draft:n('fm-boat-draft'), lbp:n('fm-boat-lbp'), bhp:n('fm-boat-bhp'),
    owner:g('fm-boat-owner'), homeport:g('fm-boat-homeport'), ownerAddr:g('fm-boat-owneraddr'),
    ownership:(fmBoatOwn===1?'charter':'own'),
    note:g('fm-boat-note'), docs:[...fmBoatDocs],
  };
  if(window._editBoatId){
    // EDIT MODE
    const bid=window._editBoatId; window._editBoatId=null;
    const b=getBoat(bid); if(!b)return;
    Object.assign(b,fields);
    const curSt=getCurStatus(b,TODAY_STR);
    const newSt=stMap[fmBoatSt];
    if(curSt.s!==newSt){
      if(!b.log)b.log=[];
      autoClosePrevLog(b,TODAY_STR);
      b.log.push({id:'sl'+Date.now(),s:newSt,from:TODAY_STR,to:null,loc:locMap[pier]||pier,note:''});
    }
    closeModal('boat-modal'); renderBoats(); save('config');
    if(typeof flRenderBoatList==='function'){flRenderBoatList();flSelBoat(bid);}
  } else {
    // ADD MODE
    fields.id=LA_UID('b');
    fields.log=[{id:'sl'+Date.now(),s:stMap[fmBoatSt],from:TODAY_STR,to:null,loc:locMap[pier]||pier,note:''}];
    BOATS.push(fields);
    closeModal('boat-modal'); renderBoats(); save('config');
    if(typeof flRenderBoatList==='function') flRenderBoatList();
  }
}

// ══════════════════════════════════════
// BOAT OPERATION (inline)
// ══════════════════════════════════════
let opWeekStart=addDays(TODAY,-TODAY.getDay()+1),opPier='all';

function setOpPier(v,el){opPier=v;document.querySelectorAll('#op-pier-filter .fp').forEach(b=>b.classList.remove('on'));el.classList.add('on');renderOp();}
function shiftOpWeek(n){opWeekStart=addDays(opWeekStart,n);renderOp();}

function getOp(ds,bid){
  if(!TRIPS[ds]) TRIPS[ds]={};
  if(!TRIPS[ds][bid]) TRIPS[ds][bid]={route:null,type:'normal',booked:0};
  return TRIPS[ds][bid];
}

// Auto-derived cell type · charterBookingId takes priority, else route name pattern
// "Early Tratato Similan" / "Early Tiger" / "Early OTA" → 'early'
// other routes → 'normal' · with active charter → 'charter'
function getCellType(op, route){
  if(op && op.charterBookingId) return 'charter';
  if(route && /\bEarly\b/i.test(route.name||'')) return 'early';
  return 'normal';
}

// map current loc → pier key
// §boatPierDate · ท่าของเรือขึ้นกับ "วันที่ถาม" ไม่ใช่วันนี้เสมอไป
//   ds ว่าง = ถามถึงวันนี้ (ผู้เรียกเดิมทุกจุดจึงได้ผลเท่าเดิม)
//   เคสที่เคยพัง: เรือเข้าอู่อยู่ตอนนี้ แต่ตั้งไว้ว่ากลับมาพร้อมใช้ 1 ต.ค.
//   เปิดปฏิทิน 15 ต.ค. → สถานะอ่านจากวันนั้นได้ available แต่ท่ายังอ่านจากวันนี้ได้ 'shop'
//   เรือเลยถูกกรองทิ้งทั้งจากรายการว่างและรายการไม่ว่าง = หายไปเฉย ๆ
function getBoatCurrentPier(b, ds){
  ds = ds || TODAY_STR;
  const _stD = getCurStatus(b, ds);
  // 1. ★ Active MJ at shop (boat physically away · not available) → 'shop'
  //    Conditions: status=inprogress · has location · boat is actually unavailable
  //    Exclude cases like engine-swap where boat stays running (setFixing:false / boatStatus:'available')
  //    §boatPierDate · เช็คข้อนี้เฉพาะตอนที่ "วันนั้น" เรือยังไม่พร้อมใช้
  //    ถ้าวันนั้นสถานะเป็น available แปลว่าออกจากอู่แล้ว ไม่ต้องนับเป็น shop อีก
  if(_stD.s !== 'available' && typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT)){
    const activeMj = FL_MAINT.find(m => {
      if(m.boatId !== b.id) return false;
      if(m.status !== 'inprogress') return false;
      if(!m.location || !String(m.location).trim()) return false;
      // Only count as 'shop' if MJ would put boat in non-available state
      const targetStatus = m.boatStatus || (m.setFixing === false ? 'available' : 'fixing');
      return targetStatus !== 'available';
    });
    if(activeMj) return 'shop';
  }
  // 2. Check active pier assignments (only if not at shop)
  //    §boatPierDate · ใบย้ายท่าที่ครอบคลุม "วันที่ถาม" ไม่ใช่วันนี้
  if(b.assignments && Array.isArray(b.assignments)){
    const active = b.assignments.find(a =>
      a.status !== 'cancelled' && a.startDate <= ds && a.endDate >= ds
    );
    if(active) return active.toPier;
  }
  // 3. Fall back to status location keyword
  const st=_stD;
  const loc=(st.loc||'').toLowerCase();
  if(loc.includes('panwa')) return 'panwa';
  if(loc.includes('ranong')||loc.includes('grand andaman')||loc.includes('se la va')) return 'ranong';   // §Ranong pier locations (Grand Andaman Pier) → group under Ranong, not the tublamu fallback
  if(loc.includes('tub')||loc.includes('tublamu')||loc.includes('tab lamu')) return 'tublamu';
  // 4. fallback to home pier
  return b.pier||'tublamu';
}

// Get the shop/location label for a boat at shop (helper for UI subtitle)
function getBoatShopLocation(b){
  if(typeof FL_MAINT === 'undefined' || !Array.isArray(FL_MAINT)) return '';
  const activeMj = FL_MAINT.find(m =>
    m.boatId === b.id &&
    m.status === 'inprogress' &&
    m.location && String(m.location).trim()
  );
  return activeMj ? String(activeMj.location).trim() : '';
}

// Get active assignment for a boat (if any)
function getActiveAssignment(b){
  if(!b.assignments || !Array.isArray(b.assignments)) return null;
  const today = TODAY_STR;
  return b.assignments.find(a => 
    a.status !== 'cancelled' && a.startDate <= today && a.endDate >= today
  );
}

// Get planned assignments (future)
function getPlannedAssignments(b){
  if(!b.assignments || !Array.isArray(b.assignments)) return [];
  const today = TODAY_STR;
  return b.assignments.filter(a => 
    a.status !== 'cancelled' && a.startDate > today
  ).sort((a,b)=>a.startDate.localeCompare(b.startDate));
}

// Get past completed assignments
function getPastAssignments(b){
  if(!b.assignments || !Array.isArray(b.assignments)) return [];
  const today = TODAY_STR;
  return b.assignments.filter(a => 
    a.status !== 'cancelled' && a.endDate < today
  ).sort((a,b)=>b.endDate.localeCompare(a.endDate));
}

// Pier display names
const PIER_LABELS = {
  'tublamu': 'Tub Lamu',
  'panwa': 'Visit Panwa',
  'ranong': 'Ranong'
};

// ═══════════════════════════════════════════════════════════════
// BOAT OPERATION v2 · heatmap + drill + fleet pool (Variant C)
// ═══════════════════════════════════════════════════════════════
let _bop2 = {
  viewMode: 'month',  // 'week' | 'month'
  anchor: null,       // anchor Date · week mode = Monday · month mode = any day in month
  selDate: null,      // 'YYYY-MM-DD'
  selRoute: null,     // route id
  pier: 'all'         // 'all' | 'tublamu' | 'panwa' | 'ranong'
};
function bop2Init(){
  if(!_bop2.anchor){
    const t = new Date(TODAY);
    if(_bop2.viewMode === 'week'){
      const dow = t.getDay();
      _bop2.anchor = addDays(t, dow === 0 ? -6 : 1 - dow);
    } else {
      _bop2.anchor = new Date(t.getFullYear(), t.getMonth(), 1);
    }
  }
  if(!_bop2.selDate) _bop2.selDate = TODAY_STR;
  if(!_bop2.selRoute){
    const firstOpen = ROUTES.find(r => r.active !== false && isRouteActiveToday(r));
    _bop2.selRoute = firstOpen?.id || ROUTES[0]?.id;
  }
}
function bop2GetDates(){
  if(_bop2.viewMode === 'week'){
    const out=[]; for(let i=0;i<7;i++) out.push(fmt(addDays(_bop2.anchor, i))); return out;
  }
  // Month mode · all days of anchor's month
  // Use noon (12:00) to avoid timezone drift when fmt() converts to UTC (Bangkok local midnight = UTC previous day)
  const y = _bop2.anchor.getFullYear(), m = _bop2.anchor.getMonth();
  const last = new Date(y, m+1, 0).getDate();
  const out = [];
  for(let d=1; d<=last; d++) out.push(fmt(new Date(y, m, d, 12, 0, 0)));
  return out;
}
function bop2SetViewMode(mode){
  _bop2.viewMode = mode;
  // Reset anchor based on mode
  const ref = _bop2.selDate ? new Date(_bop2.selDate) : new Date(TODAY);
  if(mode === 'week'){
    const dow = ref.getDay();
    _bop2.anchor = addDays(ref, dow === 0 ? -6 : 1 - dow);
  } else {
    _bop2.anchor = new Date(ref.getFullYear(), ref.getMonth(), 1);
  }
  renderOp();
}
function bop2ShiftWeek(delta){
  if(_bop2.viewMode === 'month'){
    const sign = delta > 0 ? 1 : -1;
    _bop2.anchor = new Date(_bop2.anchor.getFullYear(), _bop2.anchor.getMonth() + sign, 1);
  } else {
    _bop2.anchor = addDays(_bop2.anchor, delta);
  }
  renderOp();
}
function bop2GoToday(){
  const t = new Date(TODAY);
  if(_bop2.viewMode === 'week'){
    const dow = t.getDay();
    _bop2.anchor = addDays(t, dow === 0 ? -6 : 1 - dow);
  } else {
    _bop2.anchor = new Date(t.getFullYear(), t.getMonth(), 1);
  }
  _bop2.selDate = TODAY_STR;
  renderOp();
}
function bop2SetPier(p){ _bop2.pier = p; renderOp(); }
// Select a whole date by clicking the matrix day-header (no route popover · just updates the date + fleet panel)
function bop2SelectDate(date){
  if(!date) return;
  _bop2.selDate = date;
  renderOp();
}
function bop2SelectCell(routeId, date){
  _bop2.selRoute = routeId; _bop2.selDate = date;
  renderOp();
  // After re-render, find the new selected cell and open the picker popover next to it
  const sel = document.querySelector('.bop2-cell-day[data-route="'+routeId+'"][data-date="'+date+'"]');
  if(sel) bop2OpenCellPopover(routeId, date, sel);
}
function bop2OpenCellPopover(routeId, dateStr, anchorEl){
  bop2CloseCellPopover();
  if(!anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const route = ROUTES.find(r => r.id === routeId);
  const fleet = bop2FleetStatus(dateStr);
  // Boats can only operate a route from the SAME pier (a Visit Panwa boat can't run a Ranong trip).
  // fleet.available is filtered by the top pier filter (may be 'all'); additionally scope to the route's pier.
  const routePier = route && route.pier;
  // §boatPierDate · ท่าต้องอ่าน ณ วันที่ของช่องนี้ ไม่ใช่ของวันนี้
  const _pierOn = bt => getBoatCurrentPier(bt, dateStr);
  const _pierName = p => p === 'tublamu' ? 'ท่าทับละมุ'
                       : p === 'panwa'   ? 'ท่าวิสิษฐ์พันวา'
                       : p === 'ranong'  ? 'ท่าระนอง'
                       : p === 'shop'    ? 'อยู่ที่อู่'
                       : (p || '—');
  let availList = fleet.available, unavailList = fleet.unavailable;
  if(routePier){
    // เรือที่พร้อมใช้วันนั้น แต่ไม่ได้อยู่ท่าเดียวกับเส้นทาง · เดิมถูกตัดทิ้งเงียบ ๆ
    // ทั้งจาก availList และ unavailList จึงหายไปจากหน้าจอโดยไม่มีเหตุผลบอก
    // ย้ายมาโชว์ในกลุ่ม UNAVAILABLE พร้อมบอกว่าอยู่ท่าไหน จะได้รู้ว่าต้องย้ายท่าก่อน
    const _offPier = [];
    availList = fleet.available.filter(a => {
      const p = _pierOn(a.boat);
      if(p === routePier) return true;
      const shopAt = (p === 'shop' && typeof getBoatShopLocation === 'function') ? getBoatShopLocation(a.boat) : '';
      _offPier.push({ boat: a.boat, reason: _pierName(p) + (shopAt ? ' · ' + shopAt : '') });
      return false;
    });
    // เรือที่เสีย/เข้าอู่ ยังนับเป็นเรือของท่านี้อยู่ (บ้านมันคือท่านี้ แค่ไปนอนอู่)
    // ถ้ากรองด้วยท่าปัจจุบันอย่างเดียว 'shop' จะไม่ตรงกับท่าไหนเลย แล้วหายไปทั้งลำ
    // ผู้ใช้จะงงว่าเรือหายไปไหน · ให้ขึ้นในกลุ่ม UNAVAILABLE พร้อมเลขใบซ่อม
    unavailList = fleet.unavailable.filter(a => {
      const p = _pierOn(a.boat);
      return p === routePier || (p === 'shop' && (a.boat.pier || 'tublamu') === routePier);
    }).concat(_offPier);
  }
  // Off-season / closed program → no boat can be assigned on this date.
  const _dayStat = (typeof getDayStatus === 'function' && route) ? getDayStatus(route, dateStr) : null;
  const routeClosed = !!(_dayStat && _dayStat.type === 'closed');
  const _bopPast = bop2IsPast(dateStr);   // §bopPastLock · วันเก่า = เปิดดูได้ แต่แก้ไม่ได้
  const dt = new Date(dateStr);
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dateLbl = WD[dt.getDay()] + ' ' + MON[dt.getMonth()] + ' ' + dt.getDate();
  const al = getAllotment(routeId, dateStr);
  const assignedHere = (TRIPS[dateStr] ? Object.entries(TRIPS[dateStr]) : [])
    .filter(([bid, op]) => op.route === routeId)
    .map(([bid, op]) => ({ boat: BOATS.find(b => b.id === bid), op, isCharter: !!op.charterBookingId || op.type === 'charter' }))
    .filter(x => x.boat);

  let assignedHTML = '';
  if(assignedHere.length === 0){
    assignedHTML = '<div style="font-size:11px;color:var(--ink-soft);font-style:italic;padding:2px 0">No boat assigned yet</div>';
  } else {
    assignedHTML = assignedHere.map(x => {
      const c = x.isCharter ? '#6B289A' : bop2BoatColor(x.boat.id);
      const ic = x.isCharter ? '⚓ ' : '';
      // per-boat load = pax actually assigned to THIS boat (bk.ops.boatId) · 0 = user hasn't assigned the bookings yet
      const _boatLoad = (typeof baAssignedPax==='function') ? baAssignedPax(dateStr, x.boat.id) : 0;
      const _capD = (typeof boatCapFor==='function') ? boatCapFor(x.boat.id, dateStr) : x.boat.cap;
      const _capB = (typeof boatCapBadge==='function') ? boatCapBadge(x.boat.id, dateStr, 'sm') : '';
      const seats = (x.isCharter ? 'charter · ' + _capD : _boatLoad + '/' + _capD) + _capB
        + (_bopPast ? '' : '<button onclick="event.stopPropagation();boatCapModalOpen(\''+x.boat.id+'\',\''+dateStr+'\',function(){ if(typeof renderOp===\'function\') renderOp(); });bop2CloseCellPopover();" title="ปรับที่นั่งของลำนี้ เฉพาะวันนี้" style="margin-left:5px;border:1px solid #cfd8e3;background:#fff;color:#185FA5;border-radius:5px;padding:0 5px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">cap</button>');
      const removeBtn = _bopPast
        ? '<span style="font-size:10px;color:var(--ink-soft)">&#128274;</span>'
        : x.isCharter
        ? '<span style="font-size:10px;color:var(--ink-soft);font-style:italic">locked</span>'
        : '<button onclick="if(confirm(\'Unassign '+esc(x.boat.name)+'?\')){bop2UnassignBoat(\''+dateStr+'\',\''+x.boat.id+'\');bop2CloseCellPopover();}" title="Unassign" style="font-size:13px;color:#a32d2d;background:none;border:none;cursor:pointer;padding:0 4px;line-height:1">×</button>';
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:#f5f3ef;border-radius:4px;font-size:11px;margin-bottom:3px">'
        + '<span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:'+c+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="width:8px;height:8px;border-radius:50%;background:'+c+';flex-shrink:0"></span>'+ic+esc(x.boat.name)+'</span>'
        + '<span style="display:inline-flex;align-items:center;gap:8px;flex-shrink:0"><span style="font-family:Manrope,sans-serif;font-size:10px;color:var(--ink-soft)">'+seats+'</span>'+removeBtn+'</span>'
        + '</div>';
    }).join('');
  }

  let availHTML = '';
  if(_bopPast){
    // §bopPastLock · ไม่โชว์รายการเรือว่างของวันเก่า · กดไปก็โดนบล็อกอยู่ดี
    availHTML = '<div style="display:flex;align-items:flex-start;gap:7px;padding:8px 10px;background:#F4F2ED;border:1px solid #E0DCD2;border-radius:8px;font-size:11px;color:#6B6862;line-height:1.55">'
      + '<span>&#128274;</span><span><b style="color:#3A3833">วันที่ผ่านมาแล้ว</b> — แก้เรือที่ deploy ไม่ได้<br>'
      + '<span style="font-size:10px">วันนี้ถูกใช้ปิดวันและออกรายงานไปแล้ว · เปิดดูได้อย่างเดียว</span></span></div>';
  } else if(routeClosed){
    availHTML = '<div style="font-size:11px;color:#A32D2D;font-style:italic;padding:2px 0">โปรแกรมปิด/ยังไม่เปิดวันนี้ · assign เรือไม่ได้</div>';
  } else if(availList.length === 0){
    availHTML = '<div style="font-size:11px;color:var(--ink-soft);font-style:italic;padding:2px 0">No boats available on this date</div>';
  } else {
    availHTML = availList.map(a => {
      const c = bop2BoatColor(a.boat.id);
      const _bp = _pierOn(a.boat);   // §boatPierDate
      const pierLbl = _bp === 'tublamu' ? 'TL' : (_bp === 'panwa' ? 'VP' : (_bp === 'ranong' ? 'RN' : ''));
      return '<button onclick="bop2AssignBoat(\''+routeId+'\',\''+dateStr+'\',\''+a.boat.id+'\');bop2CloseCellPopover();" '
        + 'style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:#fff;border:1px solid #eee;border-radius:4px;font-size:11px;cursor:pointer;text-align:left;font-family:inherit;width:100%;margin-bottom:3px;color:var(--ink)" '
        + 'onmouseover="this.style.background=\'#E1F5EE\';this.style.borderColor=\'#9FE1CB\'" '
        + 'onmouseout="this.style.background=\'#fff\';this.style.borderColor=\'#eee\'">'
        + '<span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:'+c+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="width:8px;height:8px;border-radius:50%;background:'+c+';flex-shrink:0"></span>'+esc(a.boat.name)+'</span>'
        + '<span style="font-family:Manrope,sans-serif;font-size:10px;color:var(--ink-soft);flex-shrink:0">'+pierLbl+' · '+a.boat.cap+'</span>'
        + '</button>';
    }).join('');
  }

  let unavailHTML = '';
  if(!routeClosed && unavailList.length > 0){
    unavailHTML = '<div style="padding:7px 12px;border-top:1px solid var(--border)">'
      + '<div style="font-size:9px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;margin-bottom:4px">UNAVAILABLE · '+unavailList.length+'</div>'
      + unavailList.map(a => '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:10px;color:var(--ink-soft);opacity:.75"><span>'+esc(a.boat.name)+'</span><span>'+esc(a.reason)+'</span></div>').join('')
      + '</div>';
  }

  // Build popover
  const wrap = document.createElement('div');
  wrap.id = 'bop2-popover';
  wrap.innerHTML = ''
    + '<div style="padding:9px 12px;background:#fafafa;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
    +   '<div style="min-width:0;flex:1">'
    +     '<div style="font-size:9px;color:var(--bk-navy);font-weight:700;letter-spacing:.06em">'+esc(dateLbl)+'</div>'
    +     '<div style="font-size:13px;font-weight:700;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="display:inline-block;width:7px;height:7px;background:'+(route?.color||'#999')+';border-radius:50%;margin-right:6px;vertical-align:middle"></span>'+esc(route?.name||'?')+'</div>'
    +   '</div>'
    +   (al.hasAllotment ? '<span style="background:#E1F5EE;color:#0F6E56;font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;letter-spacing:.06em;flex-shrink:0">'+al.state.toUpperCase()+'</span>' : '')
    +   '<button onclick="bop2CloseCellPopover()" title="Close" style="font-size:16px;color:var(--ink-soft);background:none;border:none;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0">×</button>'
    + '</div>'
    + '<div style="padding:9px 12px">'
    +   '<div style="font-size:9px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;margin-bottom:5px">ASSIGNED · '+assignedHere.length+'</div>'
    +   assignedHTML
    + '</div>'
    + '<div style="padding:9px 12px;border-top:1px solid var(--border);background:#fafafa">'
    +   '<div style="font-size:9px;color:#0F6E56;font-weight:700;letter-spacing:.06em;margin-bottom:5px">+ ADD AVAILABLE · '+(routeClosed?0:availList.length)+'</div>'
    +   availHTML
    + '</div>'
    + unavailHTML
    + (_bopPast ? '' : '<div style="padding:9px 12px;border-top:1px solid var(--border)">'   /* §bopPastLock */
    + ((typeof bkV2IsWeatherClosed==='function' && bkV2IsWeatherClosed(routeId,dateStr))
        ? '<button onclick="bop2CloseCellPopover();bkV2WeatherMark(\'' + routeId + '\',\'' + dateStr + '\')" style="width:100%;background:#FBF0DD;color:#7A4A00;border:1px solid #EAD9B0;border-radius:6px;font-family:inherit;font-size:11.5px;font-weight:600;padding:8px;cursor:pointer">&#9928; ยกเลิกแล้ว · แก้หมายเหตุ</button>'
        : '<button onclick="bop2CloseCellPopover();bkV2WeatherMark(\'' + routeId + '\',\'' + dateStr + '\')" style="width:100%;background:#FCEBEB;color:#A32D2D;border:1px solid #F2C0C0;border-radius:6px;font-family:inherit;font-size:11.5px;font-weight:600;padding:8px;cursor:pointer">&#9928; Cancel trip (weather)</button>')
    + '</div>');

  // Compute position
  const popW = 290;
  const popMaxH = 460;
  let left = rect.left + window.scrollX;
  if(left + popW > window.scrollX + window.innerWidth - 12) left = Math.max(8, window.scrollX + window.innerWidth - popW - 12);
  let top = rect.bottom + window.scrollY + 4;
  if(top + popMaxH > window.scrollY + window.innerHeight - 12){
    // Try above
    const above = rect.top + window.scrollY - 4;
    if(above - popMaxH > window.scrollY + 12) top = above - popMaxH;
  }
  wrap.style.cssText = 'position:absolute;top:'+top+'px;left:'+left+'px;width:'+popW+'px;background:#fff;border:1px solid var(--border);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.18);z-index:1000;font-family:"DM Sans",sans-serif;max-height:'+popMaxH+'px;overflow:auto';

  document.body.appendChild(wrap);

  // Click-outside + ESC handlers (attach after current tick so the click that opened it doesn't immediately close)
  setTimeout(() => {
    document.addEventListener('mousedown', bop2PopoverOutsideClick);
    document.addEventListener('keydown', bop2PopoverKey);
  }, 0);
}
function bop2PopoverOutsideClick(e){
  const pop = document.getElementById('bop2-popover');
  if(!pop) { bop2CloseCellPopover(); return; }
  if(pop.contains(e.target)) return;
  // Don't close if user clicked a heatmap cell (cell handler will re-open with new data)
  if(e.target.closest && e.target.closest('.bop2-cell-day')) return;
  bop2CloseCellPopover();
}
function bop2PopoverKey(e){ if(e.key === 'Escape') bop2CloseCellPopover(); }
function bop2CloseCellPopover(){
  const p = document.getElementById('bop2-popover');
  if(p) p.remove();
  document.removeEventListener('mousedown', bop2PopoverOutsideClick);
  document.removeEventListener('keydown', bop2PopoverKey);
}
// §bopPastLock · วันก่อนวันนี้ = ปิดวันไปแล้ว · ห้ามแก้เรือ
function bop2IsPast(ds){ return !!ds && String(ds) < ((typeof TODAY_STR!=='undefined') ? TODAY_STR : ''); }
function bop2GuardPast(ds, silent){
  if(!bop2IsPast(ds)) return false;
  if(!silent) alert('วันที่ '+ds+' ผ่านมาแล้ว · แก้เรือที่ deploy ไม่ได้\n\nวันเก่าถูกใช้ปิดวันและออกรายงานไปแล้ว (Daily Report · Travel Summary · ต้นทุนต่อเที่ยว)\nถ้าต้องแก้จริง ๆ แจ้งแอดมินให้แก้ที่ต้นทางแทน');
  return true;
}
function bop2AssignBoat(routeId, date, boatId){
  if(bop2GuardPast(date)) return;
  if(!TRIPS[date]) TRIPS[date] = {};
  if(TRIPS[date][boatId]){
    if(TRIPS[date][boatId].charterBookingId){ alert('Boat is chartered · cannot reassign'); return; }
    // ⚠ changing the boat's route while seat-bookings are assigned to it → those bookings get pulled off this route
    const oldRoute = TRIPS[date][boatId].route;
    if(oldRoute && oldRoute !== routeId){
      const ab = (typeof baAssignedBookings==='function') ? baAssignedBookings(date, boatId) : {count:0,pax:0};
      if(ab.count>0){
        const bn=((BOATS||[]).find(x=>x.id===boatId)||{}).name||boatId;
        if(!confirm('เรือ '+bn+' มี '+ab.count+' booking ('+ab.pax+' pax) จัดอยู่บนเส้นทางเดิม\n\nเปลี่ยนเส้นทางของเรือ? — booking เหล่านั้นจะถูกติดธง ⚠ ให้จัดเรือใหม่ (หน้าจัดเรือ + Daily Fleet Log)')) return;
      }
    }
    TRIPS[date][boatId].route = routeId;
  } else {
    TRIPS[date][boatId] = { route: routeId, type: 'normal', booked: 0 };
  }
  save('operations');
  renderOp();
}
function bop2UnassignBoat(date, boatId){
  if(bop2GuardPast(date)) return;
  if(!TRIPS[date] || !TRIPS[date][boatId]) return;
  if(TRIPS[date][boatId].charterBookingId){
    alert('Cannot unassign · charter is active. Cancel the charter booking first.');
    return;
  }
  // ⚠ warn when seat-bookings are still assigned to this boat on this date (non-destructive · keeps the assignment but flags it)
  const ab = (typeof baAssignedBookings==='function') ? baAssignedBookings(date, boatId) : {count:0,pax:0};
  if(ab.count>0){
    const bn=((BOATS||[]).find(x=>x.id===boatId)||{}).name||boatId;
    if(!confirm('เรือ '+bn+' มี '+ab.count+' booking ('+ab.pax+' pax) จัดอยู่วันนี้\n\nถอดออกจาก Boat Operation? — booking จะถูกติดธง ⚠ "เรือถูกถอด · จัดใหม่" ในหน้าจัดเรือ + Daily Fleet Log')) return;
  }
  delete TRIPS[date][boatId];
  save('operations');
  renderOp();
}

// Compute total pax for a route on a date (across all assigned boats · for cell display)
function bop2RouteDayPax(routeId, dateStr){
  if(typeof getSeatsConsumed !== 'function') return 0;
  return getSeatsConsumed(routeId, dateStr);
}

// ═══════════════════════════════════════════════════════════════════════
// §fleetCal · ปฏิทินกองเรือ · อ่านอย่างเดียว · แก้เรือยังทำที่ Boat Operation
// ═══════════════════════════════════════════════════════════════════════
var _fc = { ym:null, pier:'all' };
function fcInit(){
  if(!_fc.ym) _fc.ym = (typeof TODAY_STR!=='undefined'?TODAY_STR:new Date().toISOString().slice(0,10)).slice(0,7);
}
function fcShiftMonth(delta){
  var y=+_fc.ym.slice(0,4), m=+_fc.ym.slice(5,7)-1;
  var d=new Date(y, m+delta, 1);
  _fc.ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderFleetCal();
}
function fcToday(){ _fc.ym=(typeof TODAY_STR!=='undefined'?TODAY_STR:new Date().toISOString().slice(0,10)).slice(0,7); renderFleetCal(); }
function fcSetPier(p){ _fc.pier=p; renderFleetCal(); }
/* คลิกวัน → ไปจัดเรือที่ Boat Operation ของวันนั้น · หน้านี้ไม่แก้อะไรเอง */
function fcOpenDay(ds){
  if(typeof _bop2!=='undefined'){
    _bop2.selDate=ds;
    _bop2.anchor=(_bop2.viewMode==='week')
      ? (function(){ var t=new Date(ds), dow=t.getDay(); return addDays(t, dow===0?-6:1-dow); })()
      : new Date(+ds.slice(0,4), +ds.slice(5,7)-1, 1);
  }
  var el=document.querySelector('[data-view="operation"]');
  if(el && typeof nav==='function') nav(el);
}
/* ท่าของลำนี้ ณ วันที่ ds · ลำที่เข้าอู่ (pier='shop') นับเป็นไม่พร้อม ไม่ผูกกับท่าไหน
   §boatPierDate · ต้องส่ง ds เข้าไป ไม่งั้นเรือที่กลับมาพร้อมใช้เดือนหน้าจะตกลงถัง 'shop'
   ซึ่ง FC_PIER ไม่มีช่องให้แสดง → นับใน nReady แต่ไม่โผล่ใต้ท่าไหนเลย */
function fcPierOf(b, ds){ return (typeof getBoatCurrentPier==='function') ? getBoatCurrentPier(b, ds) : (b.pier||''); }
var FC_PIER=[['tublamu','TL','Tub Lamu'],['panwa','VP','Visit Panwa'],['ranong','RN','Ranong']];
/* รวมทุกอย่างของหนึ่งวัน · ไม่คิดเลขซ้ำกับที่อื่น อ่านจาก TRIPS ตัวเดียวกับ Boat Operation */
function fcDay(ds){
  var out={ routes:[], charters:[], ready:{}, fixing:[], nReady:0, nOut:0, wx:[] };
  FC_PIER.forEach(function(p){ out.ready[p[0]]=[]; });
  var boats=(typeof BOATS!=='undefined'?BOATS:[]).filter(function(b){ return b && !b.retired; });
  if(_fc.pier!=='all') boats=boats.filter(function(b){ return fcPierOf(b, ds)===_fc.pier; });
  var byRoute={};
  boats.forEach(function(b){
    var st=(typeof getCurStatus==='function') ? getCurStatus(b, ds).s : 'available';
    var op=(typeof TRIPS!=='undefined' && TRIPS[ds]) ? TRIPS[ds][b.id] : null;
    if(st!=='available'){ out.fixing.push(b); return; }
    if(op && op.route){
      out.nOut++;
      if(op.charterBookingId || op.type==='charter'){ out.charters.push({b:b, op:op}); return; }
      (byRoute[op.route]=byRoute[op.route]||[]).push(b);
      return;
    }
    var pk=fcPierOf(b, ds);
    if(!out.ready[pk]) out.ready[pk]=[];
    out.ready[pk].push(b); out.nReady++;
  });
  var RTS=(typeof ROUTES!=='undefined'?ROUTES:[]);
  Object.keys(byRoute).forEach(function(rid){
    var r=RTS.find(function(x){ return x.id===rid; })||{id:rid,name:rid};
    out.routes.push({ r:r, boats:byRoute[rid], t:((r.times&&r.times[0])||'99:99') });
  });
  out.routes.sort(function(a,b){ return String(a.t).localeCompare(String(b.t)); });   // เรียงตามเวลาออกเรือ
  // เส้นทางที่ยกเลิกเพราะอากาศ · เรือของเส้นทางนั้นเด้งกลับเป็นลำพร้อมเอง (ไม่มีใน TRIPS แล้ว)
  if(typeof bkV2IsWeatherClosed==='function'){
    RTS.forEach(function(r){
      if(r.active===false) return;
      if(_fc.pier!=='all' && r.pier!==_fc.pier) return;
      try{ if(bkV2IsWeatherClosed(r.id, ds)) out.wx.push(r); }catch(_){}
    });
  }
  return out;
}
function fcBoatChip(b, mode){
  var c=(typeof getBoatColor==='function')?getBoatColor(b.id):{bg:'#F1F5F1',text:'#6B7785'};
  var e=(typeof escapeHTML==='function')?escapeHTML:function(x){return x;};
  return (mode==='out')
    ? '<span class="fc-b out" style="border-color:'+c.text+';color:'+c.text+'">'+e(b.name||b.id)+'</span>'
    : '<span class="fc-b'+(mode==='chr'?' chr':'')+'" style="background:'+c.bg+';color:'+c.text+'">'+e(b.name||b.id)+'</span>';
}
function renderFleetCal(){
  fcInit();
  var host=document.getElementById('fc-host'); if(!host) return;
  var e=(typeof escapeHTML==='function')?escapeHTML:function(x){return String(x||'');};
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var y=+_fc.ym.slice(0,4), m=+_fc.ym.slice(5,7)-1;
  var first=new Date(y,m,1), last=new Date(y,m+1,0).getDate();
  var lead=(first.getDay()+6)%7;   // ปฏิทินเริ่มวันจันทร์
  var TODAY=(typeof TODAY_STR!=='undefined')?TODAY_STR:new Date().toISOString().slice(0,10);
  var days=[]; for(var d=1;d<=last;d++) days.push(_fc.ym+'-'+String(d).padStart(2,'0'));

  var allBoats=(typeof BOATS!=='undefined'?BOATS:[]).filter(function(b){ return b && !b.retired; });
  var perPier=FC_PIER.map(function(p){ return p[1]+' '+allBoats.filter(function(b){ return fcPierOf(b)===p[0]; }).length; }).join(' · ');
  var tDay=fcDay(TODAY);
  var tRdy=FC_PIER.map(function(p){ return p[1]+' '+((tDay.ready[p[0]]||[]).length); }).join(' · ');
  var fullDays=days.filter(function(ds){ return ds>=TODAY && fcDay(ds).nReady===0; });
  var fixNow=tDay.fixing;

  var cells='';
  for(var i=0;i<lead;i++) cells+='<div class="fc-day out"></div>';
  days.forEach(function(ds){
    var D=fcDay(ds), dn=+ds.slice(8,10);
    var isToday=(ds===TODAY), isPast=(ds<TODAY);
    var cls='fc-day'+(isToday?' today':'')+(isPast?' past':'')+(D.wx.length?' closed':'');
    var rdyCls=isPast?'dim':(D.nReady===0?'zero':'');
    var h='<div class="'+cls+'" onclick="fcOpenDay(\''+ds+'\')" title="'+ds+' · ไปจัดเรือที่ Boat Operation">'
      +'<div class="fc-hd"><span class="fc-dn">'+dn+'</span><span class="fc-rdy '+rdyCls+'">พร้อม '+D.nReady+'</span></div>';
    D.wx.forEach(function(r){ h+='<div class="fc-wx">&#9928; ยกเลิก · '+e((typeof _calName==='function')?_calName(r):(r.name||r.id))+'</div>'; });
    D.routes.forEach(function(x){
      var _rn=(typeof _calName==='function')?_calName(x.r):((x.r.name)||x.r.id);   // §fcName · ชื่อย่อชุดเดียวกับหน้า Calendar
      h+='<div class="fc-rl"><i style="background:'+(x.r.color||'#94a3b8')+'"></i>'
        +'<span class="rn" title="'+e(x.r.name||x.r.id)+'">'+e(_rn)+'</span>'
        +'<span class="fc-bs">'+x.boats.map(function(b){ return fcBoatChip(b,'fill'); }).join('')+'</span></div>';
    });
    D.charters.forEach(function(x){
      var ag='';
      try{ var bk=(SB_BOOKINGS||[]).find(function(z){ return z.id===x.op.charterBookingId; });
           var a=bk&&bk.agentId&&typeof sbGetAgent==='function'?sbGetAgent(bk.agentId):null;
           ag=a?(a.code||a.name||''):((bk&&(bk.voucherRef||bk.code))||''); }catch(_){}
      h+='<div class="fc-rl chr"><i style="background:#6B289A"></i><span class="rn">&#9875; Charter</span>'
        +'<span class="fc-bs">'+fcBoatChip(x.b,'chr')+(ag?('<span class="fc-ag">'+e(ag)+'</span>'):'')+'</span></div>';
    });
    h+='<div class="fc-pier"><div class="fc-pt">Ready at pier</div>';
    FC_PIER.forEach(function(p){
      if(_fc.pier!=='all' && _fc.pier!==p[0]) return;
      var arr=D.ready[p[0]]||[];
      if(!arr.length && _fc.pier==='all' && !allBoats.some(function(b){ return fcPierOf(b)===p[0]; })) return;   // ท่าที่ไม่มีเรือเลย ไม่ต้องขึ้นบรรทัด
      h+='<div class="fc-fl'+(arr.length?'':' none')+'"><span class="pn">'+p[1]+'</span>'
        +(arr.length?('<span class="fc-bs">'+arr.map(function(b){ return fcBoatChip(b,'out'); }).join('')+'</span>')
                    :'<b>&mdash; ไม่เหลือ</b>')+'</div>';
    });
    if(D.fixing.length) h+='<div class="fc-fix"><span class="pn">&#128295;</span><span>'+D.fixing.map(function(b){ return e(b.name||b.id); }).join(' · ')+'</span></div>';
    h+='</div></div>';
    cells+=h;
  });

  host.innerHTML=''
  +'<style>'
  +'#view-fleetcal{padding:20px;background:#fff;font-family:\'DM Sans\',sans-serif;color:#1A2A33;min-height:100%}'
  +'#view-fleetcal .fc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;grid-auto-rows:auto}'
  +'#view-fleetcal .fc-wh{font-weight:600;font-size:10px;color:#6B7785;letter-spacing:.04em;text-align:center;padding:0 0 2px}'
  +'#view-fleetcal .fc-day{background:#FAFCFA;border:1px solid rgba(0,0,0,.055);border-radius:12px;padding:8px 9px 9px;display:flex;flex-direction:column;min-height:132px;cursor:pointer;transition:transform .12s,box-shadow .12s}'
  +'#view-fleetcal .fc-day:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(26,42,51,.08);z-index:1}'
  +'#view-fleetcal .fc-day.out{background:transparent;border-color:transparent;cursor:default;min-height:0}'
  +'#view-fleetcal .fc-day.out:hover{transform:none;box-shadow:none}'
  +'#view-fleetcal .fc-day.past{background:#FBFBF9;border-color:rgba(0,0,0,.04)}'
  +'#view-fleetcal .fc-day.past .fc-b{opacity:.55}'
  +'#view-fleetcal .fc-day.today{border-color:#0F6E56;box-shadow:0 0 0 1px #0F6E56}'
  +'#view-fleetcal .fc-day.closed{background:#FFF6F4;border-color:rgba(196,74,54,.25)}'
  +'#view-fleetcal .fc-hd{display:flex;align-items:center;gap:6px;margin-bottom:6px}'
  +'#view-fleetcal .fc-dn{font-family:\'Manrope\',\'DM Mono\',monospace;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em;color:#1A2A33;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%}'
  +'#view-fleetcal .fc-day.today .fc-dn{background:#0F6E56;color:#fff}'
  +'#view-fleetcal .fc-day.past .fc-dn{color:#AEB6B0}'
  +'#view-fleetcal .fc-rdy{margin-left:auto;display:inline-flex;align-items:center;gap:4px;background:#DDF0E5;color:#0F6E56;border-radius:11px;padding:2px 9px;font-size:10px;font-weight:700;white-space:nowrap;font-family:\'Manrope\',sans-serif}'
  +'#view-fleetcal .fc-rdy.zero{background:#FFE2DC;color:#C44A36}'
  +'#view-fleetcal .fc-rdy.dim{background:#F1F5F1;color:#9AA39C}'
  +'#view-fleetcal .fc-rl{display:flex;gap:6px;align-items:flex-start;margin-top:3px;font-size:10px;line-height:1.4}'
  +'#view-fleetcal .fc-rl i{width:6px;height:6px;border-radius:50%;flex:none;margin-top:4px;font-style:normal}'
  +'#view-fleetcal .fc-rl .rn{flex:none;width:78px;color:#6B7785;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +'#view-fleetcal .fc-rl.chr .rn{color:#6B289A}'
  +'#view-fleetcal .fc-bs{display:flex;flex-wrap:wrap;gap:3px;min-width:0}'
  +'#view-fleetcal .fc-b{display:inline-flex;align-items:center;border-radius:7px;padding:1px 6px;font-size:9.5px;font-weight:700;white-space:nowrap;border:1px solid transparent}'
  +'#view-fleetcal .fc-b.out{background:#fff;font-weight:600;border-color:currentColor;opacity:.9}'
  +'#view-fleetcal .fc-b.chr{box-shadow:inset 0 0 0 1.5px #6B289A}'
  +'#view-fleetcal .fc-ag{font-size:9px;color:#6B289A;font-weight:600;align-self:center}'
  +'#view-fleetcal .fc-wx{margin:2px 0 3px;font-size:9.5px;font-weight:600;color:#C44A36;background:#FFE2DC;border-radius:8px;padding:2px 8px;display:inline-block}'
  +'#view-fleetcal .fc-pier{margin-top:auto;padding-top:7px;border-top:1px solid #E5EDE7}'
  +'#view-fleetcal .fc-pt{font-size:9px;color:#6B7785;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}'
  +'#view-fleetcal .fc-fl{display:flex;gap:6px;align-items:flex-start;font-size:9.5px;line-height:1.45;margin-top:2px}'
  +'#view-fleetcal .fc-fl .pn{flex:none;width:20px;font-family:\'Manrope\',sans-serif;font-weight:700;color:#6B7785;letter-spacing:.04em;font-size:9px;padding-top:2px}'
  +'#view-fleetcal .fc-fl.none b{color:#BFC7C0;font-weight:500}'
  +'#view-fleetcal .fc-fix{display:flex;gap:6px;font-size:9.5px;margin-top:4px;color:#C44A36;line-height:1.45}'
  +'#view-fleetcal .fc-fix .pn{flex:none;width:20px;font-size:9px}'
  /* token ชุดเดียวกับ Boat Operation · คัดลอกมาให้ scope นี้ใช้ได้ตรง ๆ */
  +'#view-fleetcal .bop2-hd{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:14px;gap:12px;flex-wrap:wrap}'
  +'#view-fleetcal .bop2-hd h1{font-size:24px;font-weight:700;color:#1A2A33;margin:0 0 2px;letter-spacing:-.01em}'
  +'#view-fleetcal .bop2-hd p{font-size:12px;color:#6B7785;margin:0}'
  +'#view-fleetcal .bo-tile{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:14px 16px;min-height:88px;display:flex;flex-direction:column;justify-content:space-between}'
  +'#view-fleetcal .bo-tile-lbl{font-size:10px;color:#6B7785;font-weight:600;letter-spacing:.02em}'
  +'#view-fleetcal .bo-tile-num{font-family:\'Manrope\',\'DM Mono\',monospace;font-size:28px;font-weight:700;line-height:1;color:#1A2A33;letter-spacing:-.01em}'
  +'#view-fleetcal .bo-btn{padding:7px 14px;font-size:11px;font-weight:600;background:#fff;border:1px solid rgba(15,110,86,.18);border-radius:22px;cursor:pointer;font-family:inherit;color:#0F6E56;transition:all .15s}'
  +'#view-fleetcal .bo-btn:hover{background:#DDF0E5;border-color:#0F6E56}'
  +'#view-fleetcal .bo-btn.primary{background:#0F6E56;color:#fff;border-color:#0F6E56}'
  +'#view-fleetcal .bo-btn.icon{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:13px}'
  +'#view-fleetcal .bo-pier-pill{padding:6px 14px;font-size:11px;font-weight:600;background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:16px;cursor:pointer;color:#6B7785;font-family:inherit;transition:all .12s}'
  +'#view-fleetcal .bo-pier-pill:hover{border-color:#0F6E56;color:#0F6E56}'
  +'#view-fleetcal .bo-pier-pill.on{background:#0F6E56;color:#fff;border-color:#0F6E56}'
  +'#view-fleetcal .bo-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:14px 16px}'
  +'#view-fleetcal .bo-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:10px;color:#6B7785}'
  +'#view-fleetcal .bo-legend-chip{display:inline-flex;align-items:center;gap:5px;color:#1A2A33;font-weight:500}'
  +'#view-fleetcal .bo-legend-chip span.box{width:11px;height:11px;border-radius:3px}'
  +'</style>'
  +'<div class="bop2-hd"><div><h1>Fleet Calendar</h1>'
    +'<p>เรือลำไหนไปเส้นทางไหน · ท่าไหนยังเหลือลำพร้อม · คลิกวันเพื่อไปจัดเรือที่ Boat Operation</p></div>'
    +'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
      +'<button class="bo-btn icon" onclick="fcShiftMonth(-1)" title="เดือนก่อน">&lsaquo;</button>'
      +'<button class="bo-btn primary" onclick="fcToday()">Today</button>'
      +'<button class="bo-btn icon" onclick="fcShiftMonth(1)" title="เดือนถัดไป">&rsaquo;</button>'
      +'<span style="font-size:13px;font-weight:700;color:#1A2A33;margin:0 4px;min-width:130px;text-align:center;font-family:Manrope,sans-serif">'+MON[m]+' '+y+'</span>'
    +'</div></div>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1.4fr;gap:10px;margin-bottom:14px">'
    +'<div class="bo-tile"><div><div class="bo-tile-lbl">Fleet</div><div class="bo-tile-num" style="margin-top:6px">'+allBoats.length+'</div></div>'
      +'<div style="font-size:9px;color:#6B7785;font-weight:500">'+e(perPier)+' · ยังไม่ปลดระวาง</div></div>'
    +'<div class="bo-tile" style="background:#FFD93D"><div><div class="bo-tile-lbl" style="color:#6B5414">Boats Deployed</div>'
      +'<div class="bo-tile-num" style="color:#2F2410;margin-top:6px">'+tDay.nOut+'</div></div>'
      +'<div style="font-size:9px;color:#6B5414;font-weight:500">วันนี้ · '+(tDay.routes.length+tDay.charters.length)+' เส้นทาง</div></div>'
    +'<div class="bo-tile" style="background:#0F6E56;color:#fff"><div><div class="bo-tile-lbl" style="color:#B5DDCB">Ready at Pier</div>'
      +'<div class="bo-tile-num" style="color:#fff;margin-top:6px">'+tDay.nReady+'</div></div>'
      +'<div style="font-size:9px;color:#B5DDCB;font-weight:500">'+e(tRdy)+' — ขายเหมาได้</div></div>'
    +((fullDays.length||fixNow.length)
      ? ('<div class="bo-tile" style="background:linear-gradient(115deg,#FF7560 0%,#FF9276 100%);color:#fff;position:relative;overflow:hidden">'
        +'<div><div style="font-size:10px;color:rgba(255,255,255,.92);font-weight:700;letter-spacing:.02em">&#9888; NEEDS ATTENTION</div>'
        +'<div style="font-size:15px;font-weight:700;margin-top:5px;line-height:1.25;position:relative;z-index:1">'
        +(fullDays.length?(fullDays.length+' วันที่กองเรือเต็ม'):'')+(fullDays.length&&fixNow.length?' · ':'')
        +(fixNow.length?(fixNow.length+' ลำติดซ่อม'):'')+'</div></div>'
        +'<div style="font-size:10px;opacity:.95;position:relative;z-index:1">'
        +(fullDays.length?(e(fullDays.slice(0,3).map(function(x){return x.slice(8)+' '+MON[m];}).join(' · '))+' ไม่เหลือลำ'):'')
        +(fullDays.length&&fixNow.length?' · ':'')+(fixNow.length?e(fixNow.map(function(b){return b.name;}).join(' · ')):'')+'</div>'
        +'<div style="position:absolute;bottom:-14px;right:-14px;width:60px;height:60px;background:rgba(255,255,255,.16);border-radius:50%"></div></div>')
      : ('<div class="bo-tile" style="background:#DDF0E5"><div><div class="bo-tile-lbl" style="color:#0F6E56">&#10003; ALL CLEAR</div>'
        +'<div style="font-size:14px;font-weight:700;margin-top:5px;line-height:1.3;color:#0F6E56">มีลำว่างทุกวัน</div></div>'
        +'<div style="font-size:9px;color:#0F6E56;opacity:.75;font-weight:500">ทั้งเดือนนี้ยังรับเหมาเพิ่มได้</div></div>'))
  +'</div>'
  +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:12px">'
    +'<span class="bo-pier-pill '+(_fc.pier==='all'?'on':'')+'" onclick="fcSetPier(\'all\')">All piers</span>'
    +FC_PIER.map(function(p){ return '<span class="bo-pier-pill '+(_fc.pier===p[0]?'on':'')+'" onclick="fcSetPier(\''+p[0]+'\')">'+p[2]+'</span>'; }).join('')
    +'<span style="margin-left:auto;font-size:10px;color:#6B7785">อ่านอย่างเดียว · แก้เรือที่ <b style="color:#1A2A33">Boat Operation</b></span>'
  +'</div>'
  +'<div class="bo-card" style="padding:14px 14px 10px">'
    +'<div class="fc-grid" style="margin-bottom:10px">'
    +['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(w){ return '<div class="fc-wh">'+w+'</div>'; }).join('')
    +cells
    +'</div>'
    +'<div class="bo-legend" style="margin-top:12px;padding-top:10px;border-top:1px solid #E5EDE7">'
      +'<span class="bo-legend-chip"><span class="box" style="background:#185FA5;border-radius:50%;width:9px;height:9px"></span>จุดสี = เส้นทาง</span>'
      +'<span class="bo-legend-chip"><span class="fc-b" style="background:#E6F4ED;color:#0F6E56;font-size:9px">ชิปทึบ</span>เรือที่ออกงาน · สีประจำลำ</span>'
      +'<span class="bo-legend-chip"><span class="fc-b out" style="border-color:#0F6E56;color:#0F6E56;font-size:9px">ชิปโปร่ง</span>เรือที่พร้อมที่ท่า</span>'
      +'<span class="bo-legend-chip"><span class="box" style="background:#FFE2DC"></span>พร้อม 0 · กองเรือเต็ม</span>'
      +'<span class="bo-legend-chip"><span class="box" style="background:#F0E8FB"></span>&#9875; Charter</span>'
      +'<span class="bo-legend-chip">&#128295; ซ่อม · ไม่นับเป็นลำพร้อม</span>'
      +'<span style="margin-left:auto;font-size:10px;color:#6B7785;font-weight:600">'+allBoats.length+' boats in fleet</span>'
    +'</div>'
  +'</div>';
}

// Fleet status for a date · returns { assigned:[], available:[], unavailable:[] }
function bop2FleetStatus(dateStr){
  const out = { assigned: [], available: [], unavailable: [] };
  if(typeof BOATS === 'undefined') return out;
  BOATS.forEach(b => {
    if(b.retired) return;
    if(_bop2.pier !== 'all' && getBoatCurrentPier(b, dateStr) !== _bop2.pier) return;   // §boatPierDate
    const st = getCurStatus(b, dateStr).s;
    if(st !== 'available'){
      // Enrich reason with active project info if any
      let reason = st === 'fixing' ? 'Fixing' : st;
      if(typeof FL_PROJECTS!=='undefined' && FL_PROJECTS){
        const proj = FL_PROJECTS.find(p=>p.boatId===b.id && (p.status==='inprogress'||p.status==='on_hold'));
        if(proj){
          const tag = proj.status==='on_hold' ? '[HOLD]' : '[PROJ]';
          reason = `${tag} ${proj.no} · ${proj.type==='drydock'?'Drydock':proj.type==='overhaul'?'Overhaul':'Project'}${proj.planTo?` → ${proj.planTo}`:' · Open'}`;
        }
      }
      out.unavailable.push({ boat:b, reason });
      return;
    }
    const op = TRIPS[dateStr]?.[b.id];
    if(op && op.route){
      const route = ROUTES.find(r => r.id === op.route);
      const seats = getSeatsConsumed(op.route, dateStr);
      const isCharter = !!op.charterBookingId || op.type === 'charter';
      out.assigned.push({ boat:b, route, type: op.type, charterBookingId: op.charterBookingId, seats, capacity: b.cap, isCharter });
    } else {
      out.available.push({ boat:b });
    }
  });
  return out;
}

// ─── Boat color palette · stable per-boat color for dots + name pills ───
const BOP2_BOAT_PALETTE = [
  '#1B6BC9','#1D9E75','#7F77DD','#D77033','#0F6E56','#A05A1A',
  '#B05285','#6B289A','#3C7AB3','#168F6C','#5A8F1F','#C97A2D',
  '#4E5A9C','#1F8AB3','#7E1FA0','#386641','#9C4221','#0E7490'
];
function bop2BoatColor(boatId){
  if(!boatId) return '#999';
  let h = 0;
  for(let i=0; i<boatId.length; i++) h = (h * 31 + boatId.charCodeAt(i)) & 0x7fffffff;
  return BOP2_BOAT_PALETTE[h % BOP2_BOAT_PALETTE.length];
}

// ─── Scan route×date for slots that have pax but no boat assigned ───
function bop2RouteDaysNeedingBoats(routes, dates){
  const out = [];
  routes.forEach(r => {
    dates.forEach(d => {
      const ds = (typeof getDayStatus === 'function') ? getDayStatus(r, d) : null;
      if(ds && ds.type === 'closed') return;
      const al = getAllotment(r.id, d);
      const assigned = al.assignedBoats||[];
      // an assigned boat only counts if it's actually usable that day (a broken/unavailable boat after assignment doesn't)
      const usable = assigned.filter(a => {
        const b=a.boat; return b && (typeof getCurStatus!=='function' || getCurStatus(b,d).s==='available');
      });
      if(assigned.length > 0 && usable.length === 0){
        // boat WAS assigned but is now broken/unavailable → reassign (flag even with 0 pax · the schedule is invalid)
        const brokenNames = assigned.map(a=>a.boat&&a.boat.name).filter(Boolean);
        out.push({ routeId: r.id, routeName: r.name, color: r.color, dateStr: d, paxCount: al.seatsConsumed,
                   reason: 'boat_broken', boats: brokenNames });
      } else if(al.seatsConsumed > 0 && assigned.length === 0){
        // pax exist but no boat assigned at all
        out.push({ routeId: r.id, routeName: r.name, color: r.color, dateStr: d, paxCount: al.seatsConsumed,
                   reason: 'no_boat', boats: [] });
      }
    });
  });
  return out;
}

// ─── Boats assigned to a specific route+date (used by heatmap cells) ───
function bop2BoatsOnRouteDate(routeId, dateStr){
  if(!TRIPS[dateStr]) return [];
  const out = [];
  Object.entries(TRIPS[dateStr]).forEach(([bid, op]) => {
    if(op.route !== routeId) return;
    const b = (typeof BOATS !== 'undefined') ? BOATS.find(x => x.id === bid) : null;
    if(b) out.push({ boat: b, isCharter: !!op.charterBookingId || op.type === 'charter' });
  });
  return out;
}

// ─── BULK ACTIONS ───
function bop2CopyWeekToNext(){
  const dates = bop2GetDates();
  const offset = dates.length;
  const period = _bop2.viewMode === 'month' ? 'month' : 'week';
  if(!confirm('Copy ' + offset + ' days to next ' + period + '? Existing assignments at the target are kept (no overwrite). Charter slots are skipped.')) return;
  let copied = 0, skipped = 0;
  dates.forEach(d => {
    if(!TRIPS[d]) return;
    const tgt = fmt(addDays(new Date(d), offset));
    if(bop2GuardPast(tgt, true)) return;   // §bopPastLock · ปลายทางเป็นวันเก่า (ย้อนสัปดาห์อยู่) ข้ามไป
    if(!TRIPS[tgt]) TRIPS[tgt] = {};
    Object.entries(TRIPS[d]).forEach(([bid, op]) => {
      if(op.charterBookingId) { skipped++; return; }
      if(TRIPS[tgt][bid]) { skipped++; return; }
      TRIPS[tgt][bid] = { route: op.route, type: op.type || 'normal', booked: 0 };
      copied++;
    });
  });
  save('operations');
  alert('Copied ' + copied + ' assignments. Skipped ' + skipped + ' (existing/charter).');
  bop2ShiftWeek(offset);
}
function bop2CopyDayToWeek(){
  if(!_bop2.selDate){ alert('Select a day cell first by clicking on the heatmap.'); return; }
  const src = _bop2.selDate;
  if(!TRIPS[src] || Object.keys(TRIPS[src]).length === 0){ alert('Selected day has no boat assignments to copy.'); return; }
  const dates = bop2GetDates().filter(d => d !== src);
  if(!confirm('Copy ' + src + ' assignments to ' + dates.length + ' other day(s) in view? Existing target assignments are kept.')) return;
  let copied = 0, skipped = 0;
  dates.forEach(d => {
    if(bop2GuardPast(d, true)) { skipped++; return; }   // §bopPastLock
    if(!TRIPS[d]) TRIPS[d] = {};
    Object.entries(TRIPS[src]).forEach(([bid, op]) => {
      if(op.charterBookingId) { skipped++; return; }
      if(TRIPS[d][bid]) { skipped++; return; }
      TRIPS[d][bid] = { route: op.route, type: op.type || 'normal', booked: 0 };
      copied++;
    });
  });
  save('operations');
  alert('Copied to ' + copied + ' slot(s). Skipped ' + skipped + '.');
  renderOp();
}
// ═══════════════════════════════════════════════════════════════
// BULK MODAL INFRA (4 actions: Assign-range · Templates · Swap · Weekday pattern)
// ═══════════════════════════════════════════════════════════════
function bop2LoadTemplates(){
  try { const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); return Array.isArray(d.bop2_templates) ? d.bop2_templates : []; }
  catch(e){ return []; }
}
function bop2SaveTemplates(arr){
  try { const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); d.bop2_templates = arr; localStorage.setItem(LS_KEY, JSON.stringify(d)); }
  catch(e){ console.warn('template save failed', e); }
}
function bop2OpenModal(type){
  bop2CloseModal();
  const wrap = document.createElement('div');
  wrap.id = 'bop2-modal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",sans-serif';
  let body = '';
  if(type === 'assignRange') body = bop2AssignRangeForm();
  else if(type === 'saveTemplate') body = bop2SaveTemplateForm();
  else if(type === 'templates') body = bop2TemplatesForm();
  else if(type === 'swap') body = bop2SwapForm();
  else if(type === 'weekdayPattern') body = bop2WeekdayPatternForm();
  wrap.innerHTML = '<div style="background:#fff;border-radius:8px;max-width:560px;width:100%;max-height:88vh;overflow:auto">' + body + '</div>';
  wrap.addEventListener('click', e => { if(e.target === wrap) bop2CloseModal(); });
  document.body.appendChild(wrap);
}
function bop2CloseModal(){
  const m = document.getElementById('bop2-modal');
  if(m) m.remove();
}

// ─── #1 ASSIGN BOAT TO RANGE ────────────────────────────────────
// §bopBulkDate · ป้ายท่าแบบย่อ · เดิมเขียน TL/VP อย่างเดียว ระนองเลยขึ้น VP ผิด
function bop2PierAbbr(p){ return p==='tublamu'?'TL':p==='panwa'?'VP':p==='ranong'?'RN':p==='shop'?'อู่':(p||'?'); }
function bop2PierName(p){ return p==='tublamu'?'ท่าทับละมุ':p==='panwa'?'ท่าวิสิษฐ์พันวา':p==='ranong'?'ท่าระนอง':(p||'—'); }
// Build boat options filtered by pier · with status indicator
// §bopBulkDate · ทั้ง "ท่า" และ "สถานะ" ต้องอ่าน ณ วันที่ที่จะ assign ไม่ใช่วันนี้
//   ไม่ส่ง ds มา = ใช้วันที่ที่เลือกบนปฏิทิน แล้วค่อยตกไปที่วันนี้
//   เดิมอ่าน TODAY เสมอ · เรือที่ยังอยู่อู่วันนี้แต่กลับมาใช้เดือนหน้าจึงถูกกรองทิ้ง
//   ทั้งท่าเลยว่าง แล้วขึ้น "no boats at this pier" ทั้งที่แผงขวาบอกว่ามีเรือพร้อม
function bop2AssignBoatOptsFor(pier, ds){
  ds = ds || (typeof _bop2 !== 'undefined' && _bop2.selDate) || TODAY_STR;
  const boats = BOATS.filter(b => !b.retired && getBoatCurrentPier(b, ds) === pier);
  if(boats.length === 0){
    return '<option value="" disabled>— ไม่มีเรือที่' + bop2PierName(pier) + ' ในวันที่ ' + ds + ' —</option>';
  }
  return boats.map(b => {
    const st = getCurStatus(b, ds).s;
    let suffix = '';
    if(st === 'fixing') suffix = ' · 🔧 fixing';
    else if(st === 'unavailable') suffix = ' · N/A';
    return '<option value="'+b.id+'"'+(st !== 'available' ? ' style="color:#aaa"' : '')+'>'+b.name+' · '+b.cap+' pax · '+bop2PierAbbr(pier)+suffix+'</option>';
  }).join('');
}
function bop2UpdateAssignBoatOpts(){
  const routeSel = document.getElementById('bop2ar-route');
  const boatSel = document.getElementById('bop2ar-boat');
  if(!routeSel || !boatSel) return;
  const opt = routeSel.options[routeSel.selectedIndex];
  const pier = opt?.dataset.pier;
  if(!pier) return;
  // §bopBulkDate · โหลดรายชื่อเรือตามวันเริ่มของช่วงที่กรอกไว้
  const fromEl = document.getElementById('bop2ar-from');
  boatSel.innerHTML = bop2AssignBoatOptsFor(pier, (fromEl && fromEl.value) || undefined);
}
function bop2AssignRangeForm(){
  // §bopBulkDate · ตั้งต้นที่วันที่ซึ่งผู้ใช้เลือกไว้บนปฏิทิน ไม่ใช่วันนี้
  //   เปิดหน้าอยู่เดือน ต.ค. แต่กล่องเด้งมาเป็นวันนี้ ต้องแก้มือทุกครั้ง
  //   และรายชื่อเรือด้านล่างก็จะโหลดผิดวันตามไปด้วย
  const today = (typeof _bop2 !== 'undefined' && _bop2.selDate) || TODAY_STR;
  const activeRoutes = ROUTES.filter(r => r.active !== false);
  const initialRoute = activeRoutes[0];
  const initialPier = initialRoute?.pier || 'tublamu';
  const routeOpts = activeRoutes.map(r => '<option value="'+r.id+'" data-pier="'+r.pier+'">'+r.name+' · '+bop2PierAbbr(r.pier)+'</option>').join('');   // §bopBulkDate
  const boatOpts = bop2AssignBoatOptsFor(initialPier, today);
  return `
    <div style="padding:18px 20px;border-bottom:1px solid #eee">
      <div style="font-size:18px;font-weight:700;color:#0F6E56">🎯 Assign boat to date range</div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:3px">Quick-deploy one boat to one route across many days · boats are filtered by route's pier</div>
    </div>
    <div style="padding:18px 20px;display:grid;gap:12px">
      <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">ROUTE
        <select id="bop2ar-route" onchange="bop2UpdateAssignBoatOpts()" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">${routeOpts}</select>
      </label>
      <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">BOAT (at route's pier only)
        <select id="bop2ar-boat" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">${boatOpts}</select>
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label style="font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">FROM
          <input type="date" id="bop2ar-from" value="${today}" onchange="bop2UpdateAssignBoatOpts()" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">
        </label>
        <label style="font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">TO
          <input type="date" id="bop2ar-to" value="${today}" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">
        </label>
      </div>
      <label style="display:flex;align-items:center;gap:7px;font-size:12px"><input type="checkbox" id="bop2ar-overwrite"> Overwrite existing non-charter assignments</label>
      <div style="padding:8px 10px;background:#FFF6E5;border-radius:4px;font-size:10px;color:#A05A1A;line-height:1.4">⚠ Charter slots are always preserved (booking is tied to the boat).<br>⚠ Days where the boat is fixing / unavailable are auto-skipped.</div>
    </div>
    <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px">
      <button onclick="bop2CloseModal()" style="padding:8px 18px;border:1.5px solid #C44A36;background:#fff;color:#C44A36;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .12s" onmouseover="this.style.background='#FFE2DC'" onmouseout="this.style.background='#fff'">Cancel</button>
      <button onclick="bop2ApplyAssignRange()" style="padding:8px 18px;background:#0F6E56;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;box-shadow:0 2px 6px rgba(15,110,86,.22)">Apply</button>
    </div>
  `;
}
function bop2ApplyAssignRange(){
  const bid = document.getElementById('bop2ar-boat').value;
  const rid = document.getElementById('bop2ar-route').value;
  const from = document.getElementById('bop2ar-from').value;
  const to = document.getElementById('bop2ar-to').value;
  const overwrite = document.getElementById('bop2ar-overwrite').checked;
  if(!bid || !rid || !from || !to){ alert('Please fill all fields'); return; }
  if(from > to){ alert('From date must be on or before To date'); return; }
  const boat = BOATS.find(b => b.id === bid);
  if(!boat){ alert('Boat not found'); return; }
  let applied = 0, skipped = 0, chartered = 0, statusBlocked = 0, pastSkip = 0;
  const start = new Date(from), end = new Date(to);
  for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
    const ds = fmt(d);
    if(bop2GuardPast(ds, true)){ pastSkip++; continue; }   // §bopPastLock
    // Skip if boat is fixing / unavailable on this date
    const st = (typeof getCurStatus === 'function') ? getCurStatus(boat, ds).s : 'available';
    if(st !== 'available'){ statusBlocked++; continue; }
    if(!TRIPS[ds]) TRIPS[ds] = {};
    if(TRIPS[ds][bid] && TRIPS[ds][bid].charterBookingId){ chartered++; continue; }
    if(TRIPS[ds][bid] && !overwrite){ skipped++; continue; }
    TRIPS[ds][bid] = { route: rid, type: 'normal', booked: 0 };
    applied++;
  }
  save('operations');
  bop2CloseModal();
  const parts = ['Applied to ' + applied + ' day(s)'];
  if(skipped > 0) parts.push(skipped + ' kept existing');
  if(chartered > 0) parts.push(chartered + ' chartered (preserved)');
  if(statusBlocked > 0) parts.push(statusBlocked + ' skipped (boat not ready)');
  if(pastSkip > 0) parts.push(pastSkip + ' ข้าม (วันผ่านมาแล้ว)');   // §bopPastLock
  alert(parts.join(' · '));
  renderOp();
}

// ─── #2 SAVE WEEK AS TEMPLATE ───────────────────────────────────
function bop2SaveTemplateForm(){
  const dates = bop2GetDates();
  const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const pattern = {0:{},1:{},2:{},3:{},4:{},5:{},6:{}};
  dates.forEach(d => {
    if(!TRIPS[d]) return;
    const dow = new Date(d).getDay();
    Object.entries(TRIPS[d]).forEach(([bid, op]) => {
      if(op.charterBookingId) return;
      pattern[dow][bid] = { route: op.route, type: op.type || 'normal' };
    });
  });
  const totalSlots = Object.values(pattern).reduce((s,p) => s + Object.keys(p).length, 0);
  let previewHTML = '';
  for(let i = 1; i <= 7; i++){
    const dow = i % 7;
    const slots = Object.entries(pattern[dow]);
    if(slots.length === 0) continue;
    previewHTML += '<div style="font-weight:700;margin-top:6px;color:var(--bk-navy)">'+WD[dow]+':</div>';
    slots.forEach(([bid, op]) => {
      const b = BOATS.find(x => x.id === bid);
      const r = ROUTES.find(x => x.id === op.route);
      previewHTML += '<div style="padding-left:14px">'+(b?.name||bid)+' → '+(r?.name||op.route)+'</div>';
    });
  }
  if(!previewHTML) previewHTML = '<div style="font-style:italic;color:var(--ink-soft)">no assignments to capture in current view</div>';
  return `
    <div style="padding:18px 20px;border-bottom:1px solid #eee">
      <div style="font-size:18px;font-weight:700;color:#0F6E56">💾 Save current view as template</div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:3px">Capture this ${dates.length}-day pattern by weekday — reuse for any future period</div>
    </div>
    <div style="padding:18px 20px">
      <div style="padding:10px 12px;background:#f5f3ef;border-radius:4px;font-size:11px;color:var(--ink-soft);margin-bottom:14px">
        <b style="color:var(--bk-navy)">${totalSlots} slot(s)</b> across weekdays will be captured. Charter slots are skipped.
      </div>
      <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">TEMPLATE NAME
        <input type="text" id="bop2st-name" placeholder="e.g. High season weekly pattern" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit;box-sizing:border-box">
      </label>
      <details style="margin-top:14px" open><summary style="font-size:11px;font-weight:700;cursor:pointer;color:var(--ink-soft);letter-spacing:.06em">PATTERN PREVIEW</summary>
        <div style="margin-top:8px;font-size:11px;background:#fafafa;padding:10px;border-radius:4px;line-height:1.6;max-height:200px;overflow:auto">${previewHTML}</div>
      </details>
      <input type="hidden" id="bop2st-pattern" value='${JSON.stringify(pattern).replace(/'/g, "&apos;")}'>
    </div>
    <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
      <button onclick="bop2CloseModal();bop2OpenModal('templates')" style="font-size:11px;background:none;border:none;cursor:pointer;color:var(--bk-navy);text-decoration:underline;font-family:inherit">View saved →</button>
      <div style="display:flex;gap:8px">
        <button onclick="bop2CloseModal()" style="padding:8px 18px;border:1.5px solid #C44A36;background:#fff;color:#C44A36;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .12s" onmouseover="this.style.background='#FFE2DC'" onmouseout="this.style.background='#fff'">Cancel</button>
        <button onclick="bop2ApplySaveTemplate()" style="padding:8px 18px;background:#0F6E56;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;box-shadow:0 2px 6px rgba(15,110,86,.22)">Save</button>
      </div>
    </div>
  `;
}
function bop2ApplySaveTemplate(){
  const name = document.getElementById('bop2st-name').value.trim();
  const patternStr = document.getElementById('bop2st-pattern').value.replace(/&apos;/g, "'");
  if(!name){ alert('Please enter a template name'); return; }
  let pattern; try { pattern = JSON.parse(patternStr); } catch(e){ alert('Pattern parse error'); return; }
  const totalSlots = Object.values(pattern).reduce((s,p) => s + Object.keys(p).length, 0);
  if(totalSlots === 0){ alert('No assignments in current view to save'); return; }
  const templates = bop2LoadTemplates();
  templates.unshift({ id: 't_' + Date.now(), name: name, createdAt: new Date().toISOString(), pattern: pattern });
  bop2SaveTemplates(templates);
  bop2CloseModal();
  alert('Template "' + name + '" saved.');
}

// ─── #2b TEMPLATES LIST + APPLY ─────────────────────────────────
function bop2TemplatesForm(){
  const tpls = bop2LoadTemplates();
  const today = TODAY_STR;
  const next = fmt(addDays(new Date(today), 30));
  return `
    <div style="padding:18px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:baseline">
      <div>
        <div style="font-size:18px;font-weight:700;color:#0F6E56">📋 Apply template</div>
        <div style="font-size:11px;color:var(--ink-soft);margin-top:3px">Re-apply a saved weekday pattern to any date range</div>
      </div>
      <button onclick="bop2CloseModal();bop2OpenModal('saveTemplate')" style="font-size:11px;background:none;border:1px solid var(--border);padding:5px 10px;border-radius:4px;cursor:pointer;color:var(--bk-navy);font-weight:600;font-family:inherit">+ Save current</button>
    </div>
    <div style="padding:18px 20px">
      ${tpls.length === 0 ? '<div style="text-align:center;padding:30px;color:var(--ink-soft);font-style:italic">No saved templates yet.<br>Click "+ Save current" to capture the current view.</div>' : `
        <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">TEMPLATE
          <select id="bop2tpl-id" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">
            ${tpls.map(t => '<option value="'+t.id+'">'+t.name+' · saved '+(t.createdAt||'').slice(0,10)+'</option>').join('')}
          </select>
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          <label style="font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">FROM
            <input type="date" id="bop2tpl-from" value="${today}" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">
          </label>
          <label style="font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">TO
            <input type="date" id="bop2tpl-to" value="${next}" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">
          </label>
        </div>
        <label style="display:flex;align-items:center;gap:7px;font-size:12px;margin-top:10px"><input type="checkbox" id="bop2tpl-overwrite"> Overwrite existing non-charter assignments</label>
        <div style="margin-top:14px;padding:8px 10px;background:#FFF6E5;border-radius:4px;font-size:10px;color:#A05A1A">⚠ Charter slots are always preserved. Existing non-charter assignments are kept unless Overwrite is checked.</div>
      `}
    </div>
    ${tpls.length > 0 ? `
    <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
      <button onclick="bop2DeleteTemplate()" style="font-size:11px;background:none;border:none;cursor:pointer;color:#a32d2d;font-family:inherit">Delete selected</button>
      <div style="display:flex;gap:8px">
        <button onclick="bop2CloseModal()" style="padding:8px 18px;border:1.5px solid #C44A36;background:#fff;color:#C44A36;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .12s" onmouseover="this.style.background='#FFE2DC'" onmouseout="this.style.background='#fff'">Cancel</button>
        <button onclick="bop2ApplyTemplate()" style="padding:8px 18px;background:#0F6E56;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;box-shadow:0 2px 6px rgba(15,110,86,.22)">Apply</button>
      </div>
    </div>` : `
    <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #eee;text-align:right">
      <button onclick="bop2CloseModal()" style="padding:8px 18px;border:1.5px solid #C44A36;background:#fff;color:#C44A36;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit" onmouseover="this.style.background='#FFE2DC'" onmouseout="this.style.background='#fff'">Close</button>
    </div>`}
  `;
}
function bop2ApplyTemplate(){
  const tid = document.getElementById('bop2tpl-id').value;
  const from = document.getElementById('bop2tpl-from').value;
  const to = document.getElementById('bop2tpl-to').value;
  const overwrite = document.getElementById('bop2tpl-overwrite').checked;
  const tpl = bop2LoadTemplates().find(t => t.id === tid);
  if(!tpl){ alert('Template not found'); return; }
  if(!from || !to || from > to){ alert('Invalid date range'); return; }
  let applied = 0, skipped = 0, chartered = 0, pastSkip = 0;
  const start = new Date(from), end = new Date(to);
  for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
    const ds = fmt(d);
    if(bop2GuardPast(ds, true)){ pastSkip++; continue; }   // §bopPastLock
    const dow = d.getDay();
    const slots = tpl.pattern[dow] || {};
    Object.entries(slots).forEach(([bid, op]) => {
      if(!TRIPS[ds]) TRIPS[ds] = {};
      if(TRIPS[ds][bid] && TRIPS[ds][bid].charterBookingId){ chartered++; return; }
      if(TRIPS[ds][bid] && !overwrite){ skipped++; return; }
      TRIPS[ds][bid] = { route: op.route, type: op.type || 'normal', booked: 0 };
      applied++;
    });
  }
  save('operations');
  bop2CloseModal();
  alert('Applied ' + applied + ' slots from "' + tpl.name + '". Skipped ' + skipped + '. Chartered ' + chartered + '.'
    + (pastSkip>0 ? (' ข้าม ' + pastSkip + ' วัน (ผ่านมาแล้ว).') : ''));   // §bopPastLock
  renderOp();
}
function bop2DeleteTemplate(){
  const tid = document.getElementById('bop2tpl-id').value;
  const tpls = bop2LoadTemplates();
  const tpl = tpls.find(t => t.id === tid);
  if(!tpl) return;
  if(!confirm('Delete template "' + tpl.name + '"?')) return;
  bop2SaveTemplates(tpls.filter(t => t.id !== tid));
  bop2CloseModal();
  bop2OpenModal('templates');
}

// ─── #3 SWAP TWO BOATS ──────────────────────────────────────────
function bop2SwapForm(){
  const date = _bop2.selDate || TODAY_STR;
  const assigned = TRIPS[date] ? Object.entries(TRIPS[date]).map(([bid, op]) => {
    const b = BOATS.find(x => x.id === bid);
    const r = ROUTES.find(x => x.id === op.route);
    return { bid: bid, name: (b?.name || bid), routeName: (r?.name || op.route), isCharter: !!op.charterBookingId };
  }).filter(a => !a.isCharter) : [];
  const opts = assigned.map(a => '<option value="'+a.bid+'">'+a.name+' → '+a.routeName+'</option>').join('');
  return `
    <div style="padding:18px 20px;border-bottom:1px solid #eee">
      <div style="font-size:18px;font-weight:700;color:#0F6E56">🔄 Swap boats on a day</div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:3px">Exchange route assignments between two non-charter boats</div>
    </div>
    <div style="padding:18px 20px;display:grid;gap:12px">
      <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">DATE
        <input type="date" id="bop2sw-date" value="${date}" onchange="_bop2.selDate=this.value;bop2OpenModal('swap')" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">
      </label>
      ${assigned.length < 2 ? `<div style="padding:20px;background:#FDE7E7;border-radius:4px;color:#a32d2d;font-size:12px;text-align:center">Only ${assigned.length} non-charter boat(s) assigned this day. Need at least 2 to swap.</div>` : `
        <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">BOAT A
          <select id="bop2sw-a" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">${opts}</select>
        </label>
        <div style="text-align:center;font-size:22px;color:var(--bk-navy)">⇅</div>
        <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">BOAT B
          <select id="bop2sw-b" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">${opts}</select>
        </label>
        <div style="padding:8px 10px;background:#FFF6E5;border-radius:4px;font-size:10px;color:#A05A1A">⚓ Charter slots cannot be swapped — the booking is tied to that specific boat.</div>
      `}
    </div>
    <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px">
      <button onclick="bop2CloseModal()" style="padding:8px 18px;border:1.5px solid #C44A36;background:#fff;color:#C44A36;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .12s" onmouseover="this.style.background='#FFE2DC'" onmouseout="this.style.background='#fff'">Cancel</button>
      ${assigned.length >= 2 ? '<button onclick="bop2ApplySwap()" style="padding:8px 18px;background:#0F6E56;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;box-shadow:0 2px 6px rgba(15,110,86,.22)">Swap</button>' : ''}
    </div>
  `;
}
function bop2ApplySwap(){
  const date = document.getElementById('bop2sw-date').value;
  const a = document.getElementById('bop2sw-a').value;
  const b = document.getElementById('bop2sw-b').value;
  if(a === b){ alert('Select two different boats'); return; }
  if(bop2GuardPast(date)) return;   // §bopPastLock
  if(!TRIPS[date] || !TRIPS[date][a] || !TRIPS[date][b]){ alert('One or both boats are no longer assigned on this day'); return; }
  if(TRIPS[date][a].charterBookingId || TRIPS[date][b].charterBookingId){ alert('Cannot swap a charter slot'); return; }
  const tmpR = TRIPS[date][a].route, tmpT = TRIPS[date][a].type;
  TRIPS[date][a].route = TRIPS[date][b].route; TRIPS[date][a].type = TRIPS[date][b].type;
  TRIPS[date][b].route = tmpR; TRIPS[date][b].type = tmpT;
  save('operations');
  bop2CloseModal();
  alert('Swapped.');
  renderOp();
}

// ─── #4 APPLY PATTERN BY WEEKDAY ────────────────────────────────
function bop2UpdateWeekdayBoatOpts(){
  const routeSel = document.getElementById('bop2wp-route');
  const boatSel = document.getElementById('bop2wp-boat');
  if(!routeSel || !boatSel) return;
  const opt = routeSel.options[routeSel.selectedIndex];
  const pier = opt?.dataset.pier;
  if(!pier) return;
  const fromEl = document.getElementById('bop2wp-from');   // §bopBulkDate
  boatSel.innerHTML = bop2AssignBoatOptsFor(pier, (fromEl && fromEl.value) || undefined);
}
function bop2WeekdayPatternForm(){
  const today = (typeof _bop2 !== 'undefined' && _bop2.selDate) || TODAY_STR;   // §bopBulkDate
  const next = fmt(addDays(new Date(today), 30));
  const activeRoutes = ROUTES.filter(r => r.active !== false);
  const initialPier = activeRoutes[0]?.pier || 'tublamu';
  const boatOpts = bop2AssignBoatOptsFor(initialPier, today);
  const routeOpts = activeRoutes.map(r => '<option value="'+r.id+'" data-pier="'+r.pier+'">'+r.name+' · '+bop2PierAbbr(r.pier)+'</option>').join('');   // §bopBulkDate
  return `
    <div style="padding:18px 20px;border-bottom:1px solid #eee">
      <div style="font-size:18px;font-weight:700;color:#0F6E56">📅 Apply pattern by weekday</div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:3px">e.g. "every Mon &amp; Wed in June → Andaman Ryder on Similan"</div>
    </div>
    <div style="padding:18px 20px;display:grid;gap:12px">
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em;margin-bottom:5px">WEEKDAYS (click to select multiple)</div>
        <div id="bop2wp-dow-row" style="display:flex;gap:5px">
          ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((n,i) => {
            const val = (i+1) % 7;
            const sel = val === 1; // default Monday
            return '<button type="button" data-dow="'+val+'" onclick="this.classList.toggle(\'on\');this.style.background=this.classList.contains(\'on\')?\'var(--bk-navy)\':\'#fff\';this.style.color=this.classList.contains(\'on\')?\'#fff\':\'var(--ink)\'" class="'+(sel?'on':'')+'" style="flex:1;padding:9px 0;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit;background:'+(sel?'var(--bk-navy)':'#fff')+';color:'+(sel?'#fff':'var(--ink)')+'">'+n+'</button>';
          }).join('')}
        </div>
      </div>
      <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">ROUTE
        <select id="bop2wp-route" onchange="bop2UpdateWeekdayBoatOpts()" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">${routeOpts}</select>
      </label>
      <label style="display:block;font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">BOAT (at route's pier only)
        <select id="bop2wp-boat" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">${boatOpts}</select>
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label style="font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">FROM
          <input type="date" id="bop2wp-from" value="${today}" onchange="bop2UpdateWeekdayBoatOpts()" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">
        </label>
        <label style="font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">TO
          <input type="date" id="bop2wp-to" value="${next}" style="display:block;width:100%;padding:8px;font-size:13px;border:1px solid var(--border);border-radius:4px;margin-top:4px;font-family:inherit">
        </label>
      </div>
      <label style="display:flex;align-items:center;gap:7px;font-size:12px"><input type="checkbox" id="bop2wp-overwrite"> Overwrite existing non-charter assignments</label>
    </div>
    <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px">
      <button onclick="bop2CloseModal()" style="padding:8px 18px;border:1.5px solid #C44A36;background:#fff;color:#C44A36;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .12s" onmouseover="this.style.background='#FFE2DC'" onmouseout="this.style.background='#fff'">Cancel</button>
      <button onclick="bop2ApplyWeekdayPattern()" style="padding:8px 18px;background:#0F6E56;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;box-shadow:0 2px 6px rgba(15,110,86,.22)">Apply</button>
    </div>
  `;
}
function bop2ApplyWeekdayPattern(){
  const dowBtns = document.querySelectorAll('#bop2wp-dow-row button.on');
  const dows = Array.from(dowBtns).map(b => parseInt(b.dataset.dow));
  const bid = document.getElementById('bop2wp-boat').value;
  const rid = document.getElementById('bop2wp-route').value;
  const from = document.getElementById('bop2wp-from').value;
  const to = document.getElementById('bop2wp-to').value;
  const overwrite = document.getElementById('bop2wp-overwrite').checked;
  if(dows.length === 0){ alert('Select at least one weekday'); return; }
  if(!bid || !rid || !from || !to || from > to){ alert('Fill all fields with a valid range'); return; }
  const boat = BOATS.find(b => b.id === bid);
  if(!boat){ alert('Boat not found'); return; }
  let applied = 0, skipped = 0, chartered = 0, totalDays = 0, statusBlocked = 0, pastSkip = 0;
  const start = new Date(from), end = new Date(to);
  for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
    if(!dows.includes(d.getDay())) continue;
    totalDays++;
    const ds = fmt(d);
    if(bop2GuardPast(ds, true)){ pastSkip++; continue; }   // §bopPastLock
    const st = (typeof getCurStatus === 'function') ? getCurStatus(boat, ds).s : 'available';
    if(st !== 'available'){ statusBlocked++; continue; }
    if(!TRIPS[ds]) TRIPS[ds] = {};
    if(TRIPS[ds][bid] && TRIPS[ds][bid].charterBookingId){ chartered++; continue; }
    if(TRIPS[ds][bid] && !overwrite){ skipped++; continue; }
    TRIPS[ds][bid] = { route: rid, type: 'normal', booked: 0 };
    applied++;
  }
  save('operations');
  bop2CloseModal();
  const parts = ['Found ' + totalDays + ' matching day(s)', 'Applied ' + applied];
  if(skipped > 0) parts.push(skipped + ' kept existing');
  if(chartered > 0) parts.push(chartered + ' chartered');
  if(statusBlocked > 0) parts.push(statusBlocked + ' skipped (boat not ready)');
  if(pastSkip > 0) parts.push(pastSkip + ' ข้าม (วันผ่านมาแล้ว)');   // §bopPastLock
  alert(parts.join(' · '));
  renderOp();
}

function bop2ShowBulkMenu(ev){
  bop2CloseBulkMenu();
  const btn = ev.currentTarget;
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'bo-bulk-menu';
  menu.style.cssText = 'position:absolute;background:#fff;border:0;border-radius:18px;box-shadow:0 12px 32px rgba(15,110,86,.14),0 2px 6px rgba(0,0,0,.04);padding:8px;min-width:288px;z-index:9998;font-family:"DM Sans",sans-serif;top:'+(rect.bottom+window.scrollY+8)+'px;left:'+Math.max(8, rect.right+window.scrollX-288)+'px';
  const period = _bop2.viewMode === 'month' ? 'month' : 'week';
  const selDateLbl = _bop2.selDate || '—';
  // Build item helper · returns HTML for one row
  const item = (iconBg, iconSvg, title, subtitle, onclick, color) => {
    const txtColor = color || '#1A2A33';
    return '<button '
      + 'onclick="'+onclick+'" '
      + 'onmouseover="this.style.background=\'#F4F8F5\'" onmouseout="this.style.background=\'transparent\'" '
      + 'style="display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;background:transparent;border:0;border-radius:12px;cursor:pointer;text-align:left;font-family:inherit;transition:background .12s">'
      +   '<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;background:'+iconBg+';flex-shrink:0">'+iconSvg+'</span>'
      +   '<span style="flex:1;min-width:0">'
      +     '<div style="font-size:12px;font-weight:600;color:'+txtColor+';line-height:1.2">'+title+'</div>'
      +     '<div style="font-size:10px;color:#6B7785;font-weight:500;margin-top:1px;line-height:1.2">'+subtitle+'</div>'
      +   '</span>'
      +   '<span style="color:#A8B5AC;font-size:11px;flex-shrink:0">›</span>'
      + '</button>';
  };
  const sectionLbl = (txt) => '<div style="font-size:9px;font-weight:700;color:#A8B5AC;letter-spacing:.08em;text-transform:uppercase;padding:10px 13px 4px">'+txt+'</div>';
  // SVG icons · monoline 16px
  const iconTarget   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
  const iconCal      = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  const iconBookmark = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  const iconSwap     = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12"/></svg>';
  const iconCopy     = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A6914" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const iconRefresh  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A6914" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
  const iconTrash    = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C44A36" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
  menu.innerHTML = ''
    // Header
    + '<div style="padding:10px 13px 6px">'
    +   '<div style="font-size:14px;font-weight:700;color:#1A2A33;letter-spacing:-.01em">Bulk actions</div>'
    +   '<div style="font-size:10px;color:#6B7785;margin-top:2px">Selected: <b style="color:#0F6E56;font-family:Manrope,sans-serif">'+selDateLbl+'</b></div>'
    + '</div>'
    + sectionLbl('Schedule')
    + item('#DDF0E5', iconTarget,   'Assign boat to range',    'one boat × one route × many days', "bop2CloseBulkMenu();bop2OpenModal('assignRange')")
    + item('#DDF0E5', iconCal,      'Pattern by weekday',      'e.g. every Mon → Andaman Ryder', "bop2CloseBulkMenu();bop2OpenModal('weekdayPattern')")
    + item('#DDF0E5', iconBookmark, 'Templates',               'save / load weekly pattern',     "bop2CloseBulkMenu();bop2OpenModal('templates')")
    + item('#DDF0E5', iconSwap,     'Swap two boats',          'exchange routes on one day',     "bop2CloseBulkMenu();bop2OpenModal('swap')")
    + sectionLbl('Quick copy')
    + item('#FFF3C4', iconCopy,     'Copy view → next '+period, 'duplicate to following period',  "bop2CloseBulkMenu();bop2CopyWeekToNext()")
    + item('#FFF3C4', iconRefresh,  'Copy selected day → view', 'replicate one day to all',       "bop2CloseBulkMenu();bop2CopyDayToWeek()")
    + sectionLbl('Reset')
    + item('#FFE2DC', iconTrash,    'Clear '+period,            'remove all non-charter slots',   "bop2CloseBulkMenu();bop2ClearWeek()", '#C44A36');
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('mousedown', bop2BulkMenuOutside), 0);
}
function bop2BulkMenuOutside(e){
  const m = document.getElementById('bo-bulk-menu');
  if(!m || !m.contains(e.target)) bop2CloseBulkMenu();
}
function bop2CloseBulkMenu(){
  const m = document.getElementById('bo-bulk-menu');
  if(m) m.remove();
  document.removeEventListener('mousedown', bop2BulkMenuOutside);
}
function bop2ShowNeedsList(){
  const list = window._bop2NeedsBoats || [];
  if(list.length === 0){ alert('No unassigned route-days right now.'); return; }
  // Jump to first one and select it
  const first = list[0];
  _bop2.selDate = first.dateStr;
  _bop2.selRoute = first.routeId;
  const lines = list.slice(0,15).map(x => x.dateStr + '  ' + (x.routeName||x.routeId) + '  (' + x.paxCount + ' pax)' + (x.reason==='boat_broken' ? '  ⚠ เรือเสีย/ถอด: '+((x.boats||[]).join(', ')||'-')+' — จัดเรือใหม่' : '  · ยังไม่จัดเรือ'));
  alert('Route-days needing boats (' + list.length + '):\n\n' + lines.join('\n') + (list.length > 15 ? '\n... and ' + (list.length - 15) + ' more' : '') + '\n\nJumping to first one in drill panel.');
  renderOp();
}
function bop2ClearWeek(){
  const dates = bop2GetDates();
  if(!confirm('Clear all NON-CHARTER assignments from ' + dates.length + ' days in view? Charter bookings are preserved.')) return;
  let cleared = 0;
  dates.forEach(d => {
    if(!TRIPS[d]) return;
    Object.keys(TRIPS[d]).forEach(bid => {
      if(TRIPS[d][bid].charterBookingId) return;
      delete TRIPS[d][bid];
      cleared++;
    });
    if(Object.keys(TRIPS[d]).length === 0) delete TRIPS[d];
  });
  save('operations');
  alert('Cleared ' + cleared + ' assignment(s).');
  renderOp();
}

function renderOp(){
  bop2Init();
  const host = document.getElementById('bop2-host');
  if(!host) return;
  host.innerHTML = bop2RenderShell();
}

function bop2RenderShell(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const dates = bop2GetDates();
  const f = new Date(dates[0]), l = new Date(dates[dates.length-1]);
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WD = ['S','M','T','W','T','F','S']; // short for month mode
  const WDFull = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const periodLbl = _bop2.viewMode === 'week'
    ? `${f.getDate()} ${MON[f.getMonth()]} – ${l.getDate()} ${MON[l.getMonth()]} ${f.getFullYear()}`
    : `${MON[f.getMonth()]} ${f.getFullYear()}`;
  const isMonth = _bop2.viewMode === 'month';
  const labelCol = isMonth ? 170 : 200;
  const dayColMin = isMonth ? 26 : 50;
  // Routes filtered by pier
  const allRoutes = ROUTES.filter(r => r.active !== false);
  const routes = _bop2.pier === 'all' ? allRoutes : allRoutes.filter(r => r.pier === _bop2.pier);
  // Group by pier for display
  const tublamuRoutes = routes.filter(r => r.pier === 'tublamu');
  const panwaRoutes = routes.filter(r => r.pier === 'panwa');
  const ranongRoutes = routes.filter(r => r.pier === 'ranong');
  const hasRanongRoutes = allRoutes.some(r => r.pier === 'ranong');
  // KPI · totals
  let totalPax = 0, totalSlots = 0, deployedBoats = new Set();
  dates.forEach(d => {
    routes.forEach(r => {
      const al = getAllotment(r.id, d);
      totalPax += al.seatsConsumed;
      al.assignedBoats.forEach(a => deployedBoats.add(a.boatId));
      if(al.hasAllotment) totalSlots++;
    });
  });
  // ─── Unassigned scan · used by alert banner ───
  const needsBoats = bop2RouteDaysNeedingBoats(routes, dates);
  const needsToday = needsBoats.filter(x => x.dateStr === TODAY_STR).length;
  const needsBroken = needsBoats.filter(x => x.reason === 'boat_broken').length;
  window._bop2NeedsBoats = needsBoats; // cached for bop2ShowNeedsList()
  // ─── Fleet legend boats · only those deployed in current view ───
  const legendBoats = [];
  const seenBoatIds = new Set();
  dates.forEach(d => {
    if(!TRIPS[d]) return;
    Object.entries(TRIPS[d]).forEach(([bid, op]) => {
      if(seenBoatIds.has(bid)) return;
      const b = (typeof BOATS !== 'undefined') ? BOATS.find(x => x.id === bid) : null;
      if(b) { legendBoats.push({ boat: b, isCharter: !!op.charterBookingId || op.type === 'charter' }); seenBoatIds.add(bid); }
    });
  });
  // ─── Fleet status for selected date · used by BULK-row summary + AVAILABLE strip + popover ───
  const _selDate = _bop2.selDate || TODAY_STR;
  const _selDt = new Date(_selDate);
  const _MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const _WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const _selDateLbl = `${_WD[_selDt.getDay()]} ${_MON[_selDt.getMonth()]} ${_selDt.getDate()}`;
  const _fleet = bop2FleetStatus(_selDate);

  return `
    <style>
      /* ─── Mint dashboard palette ─────────────────────────────── */
      #view-operation{padding:20px;background:#fff;font-family:'DM Sans',sans-serif;color:#1A2A33;min-height:100%}
      #view-operation .bop2-hd{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:14px;gap:12px;flex-wrap:wrap}
      #view-operation .bop2-hd h1{font-size:24px;font-weight:700;color:#1A2A33;margin:0 0 2px;letter-spacing:-.01em}
      #view-operation .bop2-hd p{font-size:12px;color:#6B7785;margin:0}
      /* Stat tiles */
      #view-operation .bo-tile{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:14px 16px;min-height:88px;display:flex;flex-direction:column;justify-content:space-between}
      #view-operation .bo-tile-lbl{font-size:10px;color:#6B7785;font-weight:600;letter-spacing:.02em}
      #view-operation .bo-tile-num{font-family:'Manrope','DM Mono',monospace;font-size:28px;font-weight:700;line-height:1;color:#1A2A33;letter-spacing:-.01em}
      /* Buttons · pill style */
      #view-operation .bo-btn{padding:7px 14px;font-size:11px;font-weight:600;background:#fff;border:1px solid rgba(15,110,86,.18);border-radius:22px;cursor:pointer;font-family:inherit;color:#0F6E56;transition:all .15s}
      #view-operation .bo-btn:hover{background:#DDF0E5;border-color:#0F6E56}
      #view-operation .bo-btn.primary{background:#0F6E56;color:#fff;border-color:#0F6E56}
      #view-operation .bo-btn.primary:hover{background:#0B5946}
      #view-operation .bo-btn.icon{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:13px}
      /* Pill segmented toggle */
      #view-operation .bo-seg{display:inline-flex;background:#F1F5F1;border-radius:18px;padding:3px}
      #view-operation .bo-seg button{background:transparent;border:0;padding:5px 14px;border-radius:14px;font-size:11px;font-weight:600;color:#6B7785;cursor:pointer;font-family:inherit;transition:all .12s}
      #view-operation .bo-seg button.on{background:#0F6E56;color:#fff;box-shadow:0 1px 3px rgba(15,110,86,.18)}
      /* Pier filter pills */
      #view-operation .bo-pier-pill{padding:6px 14px;font-size:11px;font-weight:600;background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:16px;cursor:pointer;color:#6B7785;font-family:inherit;transition:all .12s}
      #view-operation .bo-pier-pill:hover{border-color:#0F6E56;color:#0F6E56}
      #view-operation .bo-pier-pill.on{background:#0F6E56;color:#fff;border-color:#0F6E56}
      /* Card · main container */
      #view-operation .bo-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:14px 16px}
      /* Heatmap · soft pastel rounded */
      #view-operation .bop2-grid{display:grid;gap:5px;background:transparent;border:0;border-radius:0;overflow:visible;margin:0}
      #view-operation .bop2-cell{background:transparent;padding:5px 6px;font-size:11px;line-height:1.3;min-height:36px;display:flex;align-items:center;justify-content:center;border-radius:0;border:0}
      #view-operation .bop2-cell-h{background:transparent;font-weight:600;font-size:10px;color:#6B7785;letter-spacing:.04em;min-height:0;padding:0}
      #view-operation .bop2-cell-route{justify-content:flex-start;font-weight:600;font-size:11px;cursor:default;background:transparent;padding:6px 8px;color:#1A2A33}
      #view-operation .bop2-cell-day{cursor:pointer;font-family:'Manrope','DM Mono',monospace;font-weight:700;font-size:13px;font-variant-numeric:tabular-nums;letter-spacing:-.01em;transition:transform .12s}
      #view-operation .bop2-cell-day:hover{transform:scale(1.04);z-index:1}
      #view-operation .bop2-cell-day.sel{box-shadow:0 0 0 2px #0F6E56;font-weight:700}
      #view-operation .bop2-cell-pier{background:transparent;font-size:9px;color:#6B7785;font-weight:700;letter-spacing:.08em;padding:10px 4px 4px}
      /* Day header circular pill */
      #view-operation .bo-day-h{display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 2px;cursor:default}
      #view-operation .bo-day-h .wd{font-size:9px;color:#6B7785;font-weight:500}
      #view-operation .bo-day-h .num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Manrope','DM Mono',monospace;font-size:11px;font-weight:600;color:#1A2A33;background:transparent;transition:all .12s}
      #view-operation .bo-day-h.today .wd{color:#0F6E56;font-weight:700}
      #view-operation .bo-day-h.today .num{background:#0F6E56;color:#fff;font-weight:700}
      #view-operation .bo-day-h.sel .wd{color:#8A6914;font-weight:700}
      #view-operation .bo-day-h.sel .num{background:#FFD93D;color:#2F2410;font-weight:700;box-shadow:0 2px 6px rgba(255,217,61,.4)}
      #view-operation .bo-day-h.alert .wd{color:#C44A36;font-weight:700}
      #view-operation .bo-day-h.alert .num{background:#FF7560;color:#fff;font-weight:700}
      /* Bulk dropdown */
      #view-operation #bo-bulk-menu{position:absolute;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:6px;min-width:240px;z-index:500;font-family:inherit}
      #view-operation #bo-bulk-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:8px 12px;background:transparent;border:0;border-radius:8px;font-size:11px;font-weight:600;color:#1A2A33;cursor:pointer;text-align:left;font-family:inherit}
      #view-operation #bo-bulk-menu button:hover{background:#F1F5F1}
      #view-operation #bo-bulk-menu .sep{height:1px;background:#E5EDE7;margin:4px 8px}
      /* Legend */
      #view-operation .bo-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:10px;color:#6B7785}
      #view-operation .bo-legend-chip{display:inline-flex;align-items:center;gap:5px;color:#1A2A33;font-weight:500}
      #view-operation .bo-legend-chip span.box{width:11px;height:11px;border-radius:3px}
      /* ─── §bopMob · จอแคบ ─────────────────────────────────────
         heatmap เดือนกว้าง ~1,000px เสมอ · บนมือถือมันคือการเลื่อนแนวนอน
         พอเลื่อนไปสองวันชื่อเส้นทางก็หลุดจอ เหลือแต่ตัวเลขที่ไม่รู้ว่าแถวของใคร
         → ตรึงคอลัมน์ชื่อไว้ซ้าย · บีบคอลัมน์วันให้เห็นได้มากขึ้นอีก 2 วัน */
      @media (max-width:820px){
        #view-operation{padding:12px 10px}
        /* !important จำเป็น · ค่าตั้งต้นเขียนไว้ใน inline style ซึ่งชนะ stylesheet เสมอถ้าไม่ประกาศ important */
        #view-operation .bop2-grid.is-month{--bop2-label:112px !important;--bop2-day:24px !important}
        #view-operation .bop2-grid.is-week{--bop2-label:132px !important;--bop2-day:44px !important}
        #view-operation .bop2-cell-route,
        #view-operation .bop2-cell-h:first-child{position:sticky;left:0;z-index:3;background:#fff}
        #view-operation .bop2-cell-pier{justify-content:flex-start;padding-left:0}
        #view-operation .bop2-cell-pier > span{position:sticky;left:0;background:#fff;padding:3px 8px 3px 2px;border-radius:6px}
      }
    </style>
    <div class="bop2-hd">
      <div>
        <h1>Boat Operation</h1>
        <p>Click a heatmap cell to assign boats · bulk actions for repeating patterns</p>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button class="bo-btn icon" onclick="bop2ShiftWeek(-7)" title="${isMonth?'Previous month':'Previous week'}">‹</button>
        <button class="bo-btn primary" onclick="bop2GoToday()">Today</button>
        <button class="bo-btn icon" onclick="bop2ShiftWeek(7)" title="${isMonth?'Next month':'Next week'}">›</button>
        <span style="font-size:13px;font-weight:700;color:#1A2A33;margin:0 4px;min-width:130px;text-align:center;font-family:Manrope,sans-serif">${escapeHTML(periodLbl)}</span>
        <div class="bo-seg">
          <button class="${!isMonth?'on':''}" onclick="bop2SetViewMode('week')">Week</button>
          <button class="${isMonth?'on':''}" onclick="bop2SetViewMode('month')">Month</button>
        </div>
        <button class="bo-btn primary" onclick="bop2ShowBulkMenu(event)" style="margin-left:4px">+ Bulk actions</button>
      </div>
    </div>

    <!-- Stat tiles · mosaic -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1.4fr;gap:10px;margin-bottom:14px">
      <div class="bo-tile">
        <div>
          <div class="bo-tile-lbl">${isMonth?'This month':'This week'}</div>
          <div class="bo-tile-num" style="margin-top:6px">${totalSlots}</div>
        </div>
        <div style="font-size:9px;color:#6B7785;font-weight:500">trips assigned</div>
      </div>
      <div class="bo-tile" style="background:#FFD93D">
        <div>
          <div class="bo-tile-lbl" style="color:#6B5414">Boats Deployed</div>
          <div class="bo-tile-num" style="color:#2F2410;margin-top:6px">${deployedBoats.size}</div>
        </div>
        <div style="font-size:9px;color:#6B5414;font-weight:500">of ${BOATS.filter(b=>!b.retired).length} fleet</div>
      </div>
      <div class="bo-tile" style="background:#0F6E56;color:#fff">
        <div>
          <div class="bo-tile-lbl" style="color:#B5DDCB">Pax Booked</div>
          <div class="bo-tile-num" style="color:#fff;margin-top:6px">${totalPax}</div>
        </div>
        <div style="font-size:9px;color:#B5DDCB;font-weight:500">across ${totalSlots} slot${totalSlots===1?'':'s'}</div>
      </div>
      ${needsBoats.length > 0 ? `
      <div class="bo-tile" style="background:linear-gradient(115deg,#FF7560 0%,#FF9276 100%);color:#fff;position:relative;overflow:hidden;cursor:pointer" onclick="bop2ShowNeedsList()">
        <div>
          <div style="font-size:10px;color:rgba(255,255,255,0.92);font-weight:700;letter-spacing:.02em">⚠ NEEDS ATTENTION</div>
          <div style="font-size:15px;font-weight:700;margin-top:5px;line-height:1.25;position:relative;z-index:1">${needsBoats.length} route-day${needsBoats.length===1?'':'s'} need boats</div>
        </div>
        <div style="font-size:10px;opacity:0.95;position:relative;z-index:1">${needsBroken>0?`⚠ ${needsBroken} เรือเสีย/ถอด · `:''}${needsToday>0?`${needsToday} today · `:''}tap to review</div>
        <div style="position:absolute;bottom:-14px;right:-14px;width:60px;height:60px;background:rgba(255,255,255,0.16);border-radius:50%"></div>
      </div>` : `
      <div class="bo-tile" style="background:#DDF0E5">
        <div>
          <div class="bo-tile-lbl" style="color:#0F6E56">✓ ALL CLEAR</div>
          <div style="font-size:14px;font-weight:700;margin-top:5px;line-height:1.3;color:#0F6E56">No alerts</div>
        </div>
        <div style="font-size:9px;color:#0F6E56;opacity:0.75;font-weight:500">every booking has a boat</div>
      </div>`}
    </div>

    <!-- Pier filter -->
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:12px">
      <span class="bo-pier-pill ${_bop2.pier==='all'?'on':''}" onclick="bop2SetPier('all')">All piers</span>
      <span class="bo-pier-pill ${_bop2.pier==='tublamu'?'on':''}" onclick="bop2SetPier('tublamu')">Tub Lamu</span>
      <span class="bo-pier-pill ${_bop2.pier==='panwa'?'on':''}" onclick="bop2SetPier('panwa')">Visit Panwa</span>
      ${hasRanongRoutes || _bop2.pier==='ranong' ? `<span class="bo-pier-pill ${_bop2.pier==='ranong'?'on':''}" onclick="bop2SetPier('ranong')">Ranong</span>` : ''}
      <span style="margin-left:auto;font-size:10px;color:#6B7785">Selected: <b style="color:#1A2A33;font-family:Manrope,sans-serif">${_bop2.selDate || '—'}</b></span>
    </div>

    <!-- Main 2-col layout -->
    <div style="display:grid;grid-template-columns:1fr 310px;gap:14px;align-items:start">

    <!-- Left: heatmap card -->
    <div class="bo-card" style="padding:14px 14px 10px">
      <div style="overflow-x:auto">
      <div class="bop2-grid ${isMonth?'is-month':'is-week'}" style="--bop2-label:${labelCol}px;--bop2-day:${dayColMin}px;grid-template-columns:var(--bop2-label) repeat(${dates.length}, minmax(var(--bop2-day), 1fr));min-width:calc(var(--bop2-label) + ${dates.length} * (var(--bop2-day) + 5px))">
        <div class="bop2-cell bop2-cell-h">Route</div>
        ${dates.map(d => {
          const dt = new Date(d);
          const isToday = d === TODAY_STR;
          const isSel = d === _bop2.selDate;
          const needs = needsBoats.some(x => x.dateStr === d);
          const wkLbl = isMonth ? WD[dt.getDay()] : WDFull[dt.getDay()];
          const cls = isToday ? 'today' : (isSel ? 'sel' : (needs ? 'alert' : ''));
          return `<div class="bo-day-h ${cls}" onclick="bop2SelectDate('${d}')" style="cursor:pointer" title="เลือกวันที่ ${d}"><div class="wd">${wkLbl}</div><div class="num">${dt.getDate()}</div></div>`;
        }).join('')}
        ${tublamuRoutes.length ? `<div class="bop2-cell bop2-cell-pier" style="grid-column:1/-1"><span>TUB LAMU · ${tublamuRoutes.length} route${tublamuRoutes.length===1?'':'s'}</span></div>` : ''}
        ${tublamuRoutes.map(r => bop2RenderHeatmapRow(r, dates)).join('')}
        ${panwaRoutes.length ? `<div class="bop2-cell bop2-cell-pier" style="grid-column:1/-1"><span>VISIT PANWA · ${panwaRoutes.length} route${panwaRoutes.length===1?'':'s'}</span></div>` : ''}
        ${panwaRoutes.map(r => bop2RenderHeatmapRow(r, dates)).join('')}
        ${ranongRoutes.length ? `<div class="bop2-cell bop2-cell-pier" style="grid-column:1/-1"><span>RANONG · ${ranongRoutes.length} route${ranongRoutes.length===1?'':'s'}</span></div>` : ''}
        ${ranongRoutes.map(r => bop2RenderHeatmapRow(r, dates)).join('')}
      </div>
      </div>

      <div class="bo-legend" style="margin-top:12px;padding-top:10px;border-top:1px solid #E5EDE7">
        <span class="bo-legend-chip"><span class="box" style="background:#DDF0E5"></span>Open</span>
        <span class="bo-legend-chip"><span class="box" style="background:#FFF3C4"></span>Tight</span>
        <span class="bo-legend-chip"><span class="box" style="background:#FFE2DC"></span>Full</span>
        <span class="bo-legend-chip"><span class="box" style="background:#F0E8FB"></span>⚓ Charter</span>
        <span class="bo-legend-chip"><span class="box" style="background:#FBE4E0;color:#C44A36;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:9px;line-height:1">—</span>Closed</span>
        <span class="bo-legend-chip"><span class="box" style="background:repeating-linear-gradient(45deg,#FFE2DC,#FFE2DC 3px,#fff 3px,#fff 6px);border:1px dashed #C44A36"></span>No boat ⚠</span>
        <span class="bo-legend-chip"><span class="box" style="background:repeating-linear-gradient(45deg,#FBE3BE,#FBE3BE 3px,#fff 3px,#fff 6px);border:1px dashed #BA7517"></span>&#128295; เปลี่ยนเรือ</span>
        ${legendBoats.length > 0 ? `<span style="margin-left:auto;font-size:10px;color:#6B7785;font-weight:600">${legendBoats.length} boat${legendBoats.length===1?'':'s'} in view</span>` : ''}
      </div>
    </div>

    <!-- Right: fleet calendar panel -->
    <div class="bo-card" style="padding:16px;align-self:start">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#0F6E56,#1D9E75);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;font-family:Manrope,sans-serif">${_bop2.pier==='tublamu'?'TL':_bop2.pier==='panwa'?'VP':_bop2.pier==='ranong'?'RN':'AL'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:#1A2A33">${_bop2.pier==='tublamu'?'Tub Lamu Fleet':_bop2.pier==='panwa'?'Visit Panwa Fleet':_bop2.pier==='ranong'?'Ranong Fleet':'All Piers Fleet'}</div>
          <div style="font-size:10px;color:#6B7785">${_fleet.assigned.length+_fleet.available.length+_fleet.unavailable.length} boats · ${_fleet.available.length} ready</div>
        </div>
      </div>

      <div style="font-size:18px;font-weight:700;color:#1A2A33;letter-spacing:-.01em">${escapeHTML(_selDateLbl)}</div>
      <div style="font-size:10px;color:#6B7785;margin-bottom:14px">fleet status</div>

      ${(() => {
        const sd = new Date(_selDate);
        const y = sd.getFullYear(), m = sd.getMonth();
        const firstDay = new Date(y, m, 1).getDay();
        const last = new Date(y, m+1, 0).getDate();
        let calHtml = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:8px;color:#6B7785;font-weight:600;margin-bottom:4px;letter-spacing:.04em">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;font-family:Manrope,DM Mono,monospace;font-size:10px">`;
        for(let i=0; i<firstDay; i++) calHtml += '<div></div>';
        for(let d=1; d<=last; d++){
          const ds = fmt(new Date(y, m, d, 12));
          const isToday = ds === TODAY_STR;
          const isSelD = ds === _selDate;
          const hasNeed = needsBoats.some(x => x.dateStr === ds);
          const hasTrip = !!(TRIPS[ds] && Object.keys(TRIPS[ds]).length > 0);
          let st = 'color:#1A2A33;font-weight:500';
          if(isSelD) st = 'background:#FFD93D;color:#2F2410;border-radius:50%;font-weight:700;box-shadow:0 2px 6px rgba(255,217,61,.4)';
          else if(isToday) st = 'background:#0F6E56;color:#fff;border-radius:50%;font-weight:700';
          else if(hasNeed) st = 'background:#FF7560;color:#fff;border-radius:50%;font-weight:700';
          else if(hasTrip) st = 'color:#1A2A33;font-weight:600;position:relative';
          const dotHTML = (!isSelD && !isToday && !hasNeed && hasTrip) ? '<span style="position:absolute;bottom:1px;left:50%;transform:translateX(-50%);width:3px;height:3px;background:#0F6E56;border-radius:50%"></span>' : '';
          calHtml += `<div style="padding:5px 0;cursor:pointer;${st}" onclick="_bop2.selDate='${ds}';renderOp()">${d}${dotHTML}</div>`;
        }
        calHtml += '</div>';
        return calHtml;
      })()}

      <div style="font-size:10px;color:#6B7785;font-weight:700;margin-top:14px;padding-bottom:6px;border-bottom:1px solid #E5EDE7;letter-spacing:.04em;text-transform:uppercase">Trips · ${escapeHTML(_selDateLbl)}</div>
      ${(() => {
        const tripsByRoute = {};
        _fleet.assigned.forEach(a => {
          const rid = a.route?.id; if(!rid) return;
          if(!tripsByRoute[rid]) tripsByRoute[rid] = { route: a.route, boats: [], isCharter: a.isCharter, seats: a.seats, capacity: 0 };
          tripsByRoute[rid].boats.push(a.boat);
          tripsByRoute[rid].capacity += (a.capacity || 0);
        });
        const entries = Object.values(tripsByRoute);
        if(entries.length === 0) return '<div style="padding:14px 0;font-size:11px;color:#6B7785;font-style:italic;text-align:center">no boats assigned this day</div>';
        entries.sort((a, b) => (a.route.times?.[0] || '99').localeCompare(b.route.times?.[0] || '99'));
        return '<div style="margin-top:10px">' + entries.map(e => {
          const time = e.route.times?.[0] || '—';
          const pct = e.capacity > 0 ? (e.seats / e.capacity) : 0;
          const tier = e.isCharter ? 'charter' : (pct >= 0.9 ? 'full' : (pct >= 0.7 ? 'tight' : 'open'));
          const palette = ({
            open:    { bg:'#DDF0E5', bd:'#0F6E56', text:'#0F6E56' },
            tight:   { bg:'#FFF3C4', bd:'#FFD93D', text:'#8A6914' },
            full:    { bg:'#FFE2DC', bd:'#FF7560', text:'#C44A36' },
            charter: { bg:'#F0E8FB', bd:'#7E4FA0', text:'#6B289A' }
          })[tier];
          const lbl = e.isCharter ? `⚓ ${e.route.name}` : e.route.name;
          return `<div style="display:grid;grid-template-columns:38px 1fr;gap:7px;margin-bottom:5px;cursor:pointer" onclick="_bop2.selRoute='${e.route.id}';renderOp()">
            <div style="font-size:9px;color:#6B7785;font-family:Manrope,sans-serif;padding-top:8px;text-align:right;font-weight:600">${time}</div>
            <div style="background:${palette.bg};border-left:3px solid ${palette.bd};border-radius:8px;padding:7px 9px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                <span style="font-size:11px;font-weight:700;color:${palette.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(lbl)}</span>
                <span style="font-size:9px;color:${palette.text};font-family:Manrope,sans-serif;font-weight:600;flex-shrink:0">${e.boats.length}b · ${e.seats}/${e.capacity}</span>
              </div>
            </div>
          </div>`;
        }).join('') + '</div>';
      })()}

      <div style="font-size:10px;color:#6B7785;font-weight:700;margin-top:14px;padding-bottom:6px;border-bottom:1px solid #E5EDE7;letter-spacing:.04em;text-transform:uppercase">Available · ${_fleet.available.length}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">
        ${_fleet.available.length === 0 ? '<span style="font-size:10px;color:#6B7785;font-style:italic">All boats deployed</span>' : _fleet.available.map(a => {
          const c = bop2BoatColor(a.boat.id);
          return `<span style="padding:3px 9px;background:#F1F5F1;border-radius:12px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:5px;color:${c}"><span style="width:7px;height:7px;border-radius:50%;background:${c}"></span>${escapeHTML(a.boat.name)} · ${a.boat.cap}</span>`;
        }).join('')}
      </div>
    </div>

    </div>
  `;
}

function bop2RenderHeatmapRow(route, dates){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const isMonth = _bop2.viewMode === 'month';
  // Pick white or dark text based on route color brightness
  const contrastText = (hex) => {
    const c = String(hex||'#777').replace('#','');
    if(c.length < 6) return '#1A2A33';
    const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
    const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
    return lum > 0.58 ? '#1A2A33' : '#fff';
  };
  // lighten a hex toward white by amt (0..1)
  const _bop2Lighten = (hex,amt) => { const c=String(hex||'#777').replace('#',''); if(c.length<6) return hex; const r=parseInt(c.substr(0,2),16),g=parseInt(c.substr(2,2),16),b=parseInt(c.substr(4,2),16); const mix=v=>Math.round(v+(255-v)*amt); return '#'+[mix(r),mix(g),mix(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); };
  const pillBg = _bop2Lighten(route.color, 0.5);   // softened 50%
  const txtColor = contrastText(pillBg);            // dark text on the pale pill
  // Route name as colored card · full name with wrap (max 2 lines)
  let row = `<div class="bop2-cell bop2-cell-route" title="${escapeHTML(route.name)}" style="padding:3px 2px;background:transparent">
    <div style="background:${pillBg};border-left:3px solid ${route.color};border-radius:10px;padding:7px 10px;width:100%;display:flex;align-items:center;min-height:38px;line-height:1.2;box-shadow:0 1px 2px rgba(0,0,0,.05)">
      <span style="font-size:${isMonth?'9.5':'10.5'}px;font-weight:700;color:${txtColor};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;word-break:break-word;letter-spacing:-.005em">${escapeHTML(route.name)}</span>
    </div>
  </div>`;
  dates.forEach(d => {
    const dt = new Date(d);
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    const dayStatus = getDayStatus(route, d);
    const isClosed = dayStatus && dayStatus.type === 'closed';
    const isToday = d === TODAY_STR;
    const isSel = _bop2.selRoute === route.id && _bop2.selDate === d;
    if(isClosed){
      row += `<div class="bop2-cell" style="background:#FBE4E0;color:#C44A36;font-size:13px;font-weight:700;padding:2px;border-radius:10px;min-height:32px" title="Program closed (off-season)">—</div>`;
      return;
    }
    const al = getAllotment(route.id, d);
    const boats = bop2BoatsOnRouteDate(route.id, d);
    const hasCharter = al.charterCapacity > 0;
    const pct = al.fillPct;
    const todayClass = isToday ? ' today' : '';
    const selClass = isSel ? ' sel' : '';

    // boats that can actually run that day (status available) — a boat broken/unavailable after being assigned doesn't count
    const usableBoats = boats.filter(bo => bo.boat && (typeof getCurStatus!=='function' || getCurStatus(bo.boat,d).s==='available'));

    // ─── ALERT STATE · boat WAS assigned but is now broken/unavailable → must reassign (flag even with 0 pax — the schedule is invalid) ───
    if(boats.length > 0 && usableBoats.length === 0){
      const stripes = 'repeating-linear-gradient(45deg,#FBE3BE,#FBE3BE 5px,#fff 5px,#fff 10px)';
      const brokenNm = boats.map(b=>b.boat.name).join(', ');
      const cellContent = isMonth
        ? `<div style="font-family:Manrope,sans-serif;font-size:11px;color:#A35A00;font-weight:700">${al.seatsConsumed}</div><div style="font-size:11px;line-height:1;margin-top:1px">&#128295;</div>`
        : `<div style="font-size:14px;line-height:1">&#128295;</div><div style="font-size:9px;color:#A35A00;font-weight:700;line-height:1.1;margin-top:2px;text-align:center">${al.seatsConsumed} pax</div><div style="font-size:9px;color:#A35A00;line-height:1.1;text-align:center">เปลี่ยนเรือ</div>`;
      const minH = isMonth ? '32px' : '52px';
      row += `<div class="bop2-cell bop2-cell-day${todayClass}${selClass}" data-route="${route.id}" data-date="${d}" style="background:${stripes};border:1px dashed #BA7517;border-radius:10px;min-height:${minH};padding:3px;flex-direction:column;justify-content:center" onclick="bop2SelectCell('${route.id}','${d}')" title="${escapeHTML(route.name)} · ${d} · ${al.seatsConsumed} pax · เรือเสีย/ไม่พร้อม: ${escapeHTML(brokenNm)} — ต้องเปลี่ยนเรือ">${cellContent}</div>`;
      return;
    }

    // ─── ALERT STATE · pax exist but no boat assigned ───
    if(al.seatsConsumed > 0 && boats.length === 0){
      const stripes = 'repeating-linear-gradient(45deg,#FFE2DC,#FFE2DC 5px,#fff 5px,#fff 10px)';
      const cellContent = isMonth
        ? `<div style="font-family:Manrope,sans-serif;font-size:11px;color:#C44A36;font-weight:700">${al.seatsConsumed}</div><div style="font-size:11px;color:#C44A36;line-height:1;margin-top:1px">⚠</div>`
        : `<div style="font-size:14px;color:#C44A36;line-height:1">⚠</div><div style="font-size:9px;color:#C44A36;font-weight:700;line-height:1.1;margin-top:2px;text-align:center">${al.seatsConsumed} pax</div><div style="font-size:9px;color:#C44A36;line-height:1.1;text-align:center">no boat</div>`;
    const minH = isMonth ? '32px' : '52px';
      row += `<div class="bop2-cell bop2-cell-day${todayClass}${selClass}" data-route="${route.id}" data-date="${d}" style="background:${stripes};border:1px dashed #C44A36;border-radius:10px;min-height:${minH};padding:3px;flex-direction:column;justify-content:center" onclick="bop2SelectCell('${route.id}','${d}')" title="${escapeHTML(route.name)} · ${d} · ${al.seatsConsumed} pax · NO BOAT ASSIGNED">${cellContent}</div>`;
      return;
    }

    // ─── NORMAL HEATMAP STATES · soft pastel mint dashboard palette ───
    let bg = isWeekend ? '#F5F8F6' : '#F1F5F1', color = '#A8B5AC';
    if(al.hasAllotment){
      if(hasCharter && al.availableCapacity === 0){ bg = '#F0E8FB'; color = '#6B289A'; }
      else if(pct >= 90 || al.isFull){ bg = '#FFE2DC'; color = '#C44A36'; }
      else if(pct >= 70){ bg = '#FFF3C4'; color = '#8A6914'; }
      else { bg = '#DDF0E5'; color = '#0F6E56'; }
    }

    let cellInner = '';
    if(!al.hasAllotment){
      // No boats, no pax · just a dot
      cellInner = `<div style="font-size:${isMonth?'10':'13'}px;color:#c0bdb3">·</div>`;
    } else if(isMonth){
      // Month: pax number + colored dots row
      const paxStr = (hasCharter && al.availableCapacity === 0) ? '⚓' : String(al.seatsConsumed);
      const dots = boats.map(b => `<span style="width:5px;height:5px;border-radius:50%;background:${b.isCharter?'#6B289A':bop2BoatColor(b.boat.id)};${b.isCharter?'box-shadow:inset 0 0 0 1px #fff':''}"></span>`).join('');
      cellInner = `<div style="font-family:Manrope,sans-serif;font-size:11px;color:${color};font-weight:700;line-height:1">${paxStr}</div>${dots ? `<div style="display:flex;gap:1px;margin-top:2px">${dots}</div>` : ''}`;
    } else {
      // Week: pax number + full boat names stacked
      const paxStr = (hasCharter && al.availableCapacity === 0) ? '⚓ Charter' : `${al.seatsConsumed}`;
      const names = boats.slice(0,3).map(b => {
        const c = b.isCharter ? '#6B289A' : bop2BoatColor(b.boat.id);
        const ic = b.isCharter ? '⚓ ' : '';
        return `<div style="font-size:9px;color:${c};font-weight:600;line-height:1.15;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ic}${escapeHTML(b.boat.name)}</div>`;
      }).join('');
      const more = boats.length > 3 ? `<div style="font-size:8px;color:${color};font-style:italic">+${boats.length-3}</div>` : '';
      cellInner = `<div style="font-family:Manrope,sans-serif;font-size:13px;color:${color};font-weight:700;line-height:1">${paxStr}</div><div style="margin-top:3px;width:100%">${names}${more}</div>`;
    }

    const _wxClosed=(typeof bkV2IsWeatherClosed==='function')&&bkV2IsWeatherClosed(route.id,d);
    if(_wxClosed){ cellInner = '<div style="font-size:13px;line-height:1">&#9928;</div><div style="font-size:7px;color:#A32D2D;font-weight:700;line-height:1;margin-top:1px">CANCEL</div>'; }
    const minH = isMonth ? '32px' : '52px';
    const padding = isMonth ? '3px' : '5px 4px';
    row += `<div class="bop2-cell bop2-cell-day${todayClass}${selClass}" data-route="${route.id}" data-date="${d}" style="background:${_wxClosed?'#FBE4E0':bg};${_wxClosed?'box-shadow:inset 0 0 0 1.5px #C44A36;':''}border-radius:10px;min-height:${minH};padding:${padding};flex-direction:column;justify-content:center" onclick="bop2SelectCell('${route.id}','${d}')" title="${escapeHTML(route.name)} · ${d}${al.hasAllotment ? ` · ${al.seatsConsumed}/${al.availableCapacity}${al.charterCapacity>0?` +${al.charterCapacity}⚓`:''} · ${boats.length} boat${boats.length===1?'':'s'}` : ' · no boat assigned'}">${cellInner}</div>`;
  });
  return row;
}

function bop2RenderDrill(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const route = ROUTES.find(r => r.id === _bop2.selRoute);
  if(!route || !_bop2.selDate){
    return `<div class="bop2-card"><div class="bop2-card-body" style="text-align:center;color:var(--ink-soft);padding:24px;font-style:italic">Click a heatmap cell to drill into a route + day</div></div>`;
  }
  const al = getAllotment(route.id, _bop2.selDate);
  const dt = new Date(_bop2.selDate);
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dateLbl = `${WD[dt.getDay()]} ${MON[dt.getMonth()]} ${dt.getDate()}`;

  let body = '';
  if(!al.hasAllotment){
    body = `<div style="padding:24px;text-align:center;color:var(--ink-soft);font-style:italic">No boat assigned to ${escapeHTML(route.name)} on this date.</div>`;
  } else {
    // Capacity bar (combined: charter + seat used)
    const seatPct = al.availableCapacity > 0 ? Math.round(al.seatsConsumed / al.availableCapacity * 100) : 0;
    const charterPct = al.totalCapacity > 0 ? Math.round(al.charterCapacity / al.totalCapacity * 100) : 0;
    const usePct = al.totalCapacity > 0 ? Math.round((al.charterCapacity + al.seatsConsumed) / al.totalCapacity * 100) : 0;
    body += `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:600">${al.assignedBoats.length} boat${al.assignedBoats.length===1?'':'s'} assigned</span>
          <span style="font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums;color:var(--ink-soft);font-size:11px">${al.seatsConsumed + al.charterCapacity}/${al.totalCapacity} total cap</span>
        </div>
        <div class="bop2-bar" style="height:6px">
          ${charterPct > 0 ? `<div class="bop2-bar-fill" style="width:${charterPct}%;background:#AFA9EC"></div>` : ''}
          <div class="bop2-bar-fill" style="width:${Math.max(0, usePct - charterPct)}%;background:${seatPct >= 90 ? '#a32d2d' : seatPct >= 70 ? '#EF9F27' : '#1D9E75'}"></div>
        </div>
      </div>
    `;
    body += al.assignedBoats.map(a => {
      const boat = a.boat;
      const isCharter = a.charterBookingId || a.type === 'charter';
      const seats = getSeatsConsumed(route.id, _bop2.selDate);
      const boatPct = boat.cap > 0 ? Math.round(seats / boat.cap * 100) : 0;
      const charterCard = `
        <div class="bop2-boat-card charter">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="font-size:12px;font-weight:700;color:#6B289A">⚓ ${escapeHTML(boat.name)}</span>
            <span style="font-family:Manrope,sans-serif;font-size:11px;color:#6B289A;font-variant-numeric:tabular-nums">${boat.cap}/${boat.cap} · charter</span>
          </div>
          <div style="font-size:10px;color:#6B289A;margin-top:4px">Booking: ${escapeHTML(a.charterBookingId || '—')}</div>
          <button class="bop2-add-btn" style="margin-top:6px;color:#a32d2d" onclick="if(confirm('Unassign chartered boat?')){bop2UnassignBoat('${_bop2.selDate}','${boat.id}')}">Unassign</button>
        </div>
      `;
      const seatCard = `
        <div class="bop2-boat-card">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="font-size:12px;font-weight:700">${escapeHTML(boat.name)}</span>
            <span style="font-family:Manrope,sans-serif;font-size:11px;color:${boatPct >= 90 ? '#a32d2d' : boatPct >= 70 ? '#A05A1A' : '#0F6E56'};font-variant-numeric:tabular-nums">${seats}/${boat.cap} · ${boatPct}%</span>
          </div>
          <div class="bop2-bar"><div class="bop2-bar-fill" style="width:${Math.min(100, boatPct)}%;background:${boatPct >= 90 ? '#a32d2d' : boatPct >= 70 ? '#EF9F27' : '#1D9E75'}"></div></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <span style="font-size:10px;color:var(--ink-soft)">${boat.cap - seats} seats remaining</span>
            <button class="bop2-add-btn" style="color:#a32d2d" onclick="if(confirm('Unassign ${escapeHTML(boat.name)}?')){bop2UnassignBoat('${_bop2.selDate}','${boat.id}')}">Unassign</button>
          </div>
        </div>
      `;
      return isCharter ? charterCard : seatCard;
    }).join('');
  }
  // Add boat buttons · available boats only
  const fleet = bop2FleetStatus(_bop2.selDate);
  const addBtns = fleet.available.map(a => `<button class="bop2-add-btn" onclick="bop2AssignBoat('${route.id}','${_bop2.selDate}','${a.boat.id}')">+ ${escapeHTML(a.boat.name)} · ${a.boat.cap}</button>`).join('');
  const addSection = addBtns ? `
    <div style="border-top:1px solid var(--border);padding:10px 14px;background:#fafafa;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:10px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;margin-right:4px">ADD BOAT:</span>
      ${addBtns}
    </div>
  ` : '';

  return `
    <div class="bop2-card">
      <div class="bop2-card-hd">
        <div>
          <div style="font-size:9px;color:var(--bk-navy);font-weight:700;letter-spacing:.08em">DRILL · ${escapeHTML(dateLbl)}</div>
          <div style="font-size:14px;font-weight:700;color:var(--ink);margin-top:2px"><span style="display:inline-block;width:8px;height:8px;background:${route.color};border-radius:50%;margin-right:6px;vertical-align:middle"></span>${escapeHTML(route.name)}</div>
        </div>
        ${al.hasAllotment ? `<span style="background:#E1F5EE;color:#0F6E56;font-size:10px;font-weight:700;padding:3px 9px;border-radius:3px;letter-spacing:.06em">${al.state.toUpperCase()}</span>` : ''}
      </div>
      <div class="bop2-card-body">${body}</div>
      ${addSection}
    </div>
  `;
}

function bop2RenderFleetPool(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  if(!_bop2.selDate) return '<div></div>';
  const fleet = bop2FleetStatus(_bop2.selDate);
  const dt = new Date(_bop2.selDate);
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dateLbl = `${WD[dt.getDay()]} ${MON[dt.getMonth()]} ${dt.getDate()}`;

  return `
    <div class="bop2-card">
      <div class="bop2-card-hd">
        <div>
          <div style="font-size:9px;color:var(--bk-navy);font-weight:700;letter-spacing:.08em">FLEET POOL · ${escapeHTML(dateLbl)}</div>
          <div style="font-size:13px;font-weight:700;color:var(--ink);margin-top:2px">${fleet.assigned.length} assigned · ${fleet.available.length} available · ${fleet.unavailable.length} N/A</div>
        </div>
      </div>
      <div>
        <div class="bop2-pool-section" style="background:#FFF6E5;color:#A05A1A">ASSIGNED · ${fleet.assigned.length}</div>
        ${fleet.assigned.length === 0 ? '<div style="padding:8px 12px;font-size:10px;color:var(--ink-soft);font-style:italic">no boats assigned</div>' : ''}
        ${fleet.assigned.map(a => {
          const isCharter = a.isCharter;
          const pct = a.capacity > 0 ? Math.round(a.seats / a.capacity * 100) : 0;
          return `
            <div class="bop2-pool-row" onclick="bop2SelectCell('${a.route?.id||''}','${_bop2.selDate}')" style="cursor:pointer">
              <div style="width:8px;height:8px;border-radius:50%;background:${isCharter?'#6B289A':pct>=70?'#EF9F27':'#1D9E75'};flex-shrink:0"></div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(a.boat.name)}</div>
                <div style="font-size:9px;color:${isCharter?'#6B289A':'var(--ink-soft)'};font-family:'Manrope',sans-serif;font-variant-numeric:tabular-nums">→ ${escapeHTML(a.route?.name||'?')} · ${isCharter?'⚓ charter':`${a.seats}/${a.capacity}`}</div>
              </div>
            </div>
          `;
        }).join('')}

        <div class="bop2-pool-section" style="background:#E1F5EE;color:#0F6E56">AVAILABLE · ${fleet.available.length}</div>
        ${fleet.available.length === 0 ? '<div style="padding:8px 12px;font-size:10px;color:var(--ink-soft);font-style:italic">no boats available</div>' : ''}
        ${fleet.available.map(a => `
          <div class="bop2-pool-row">
            <div style="width:8px;height:8px;border-radius:50%;background:#9FE1CB;border:1.5px solid #0F6E56;flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:11px">${escapeHTML(a.boat.name)}</div>
              <div style="font-size:9px;color:var(--ink-soft)">${escapeHTML((p=>p==='tublamu'?'Tub Lamu':p==='panwa'?'Visit Panwa':p==='ranong'?'Ranong':(p||'—'))(getBoatCurrentPier(a.boat)))} · ${a.boat.cap} cap · ready</div>
            </div>
            ${_bop2.selRoute ? `<button class="bop2-add-btn" onclick="bop2AssignBoat('${_bop2.selRoute}','${_bop2.selDate}','${a.boat.id}')" title="Assign to selected route">+</button>` : ''}
          </div>
        `).join('')}

        ${fleet.unavailable.length > 0 ? `
          <div class="bop2-pool-section" style="background:#FDE7E7;color:#a32d2d">UNAVAILABLE · ${fleet.unavailable.length}</div>
          ${fleet.unavailable.map(a => `
            <div class="bop2-pool-row" style="opacity:.7">
              <div style="width:8px;height:8px;border-radius:50%;background:#E24B4A;flex-shrink:0"></div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:11px">${escapeHTML(a.boat.name)}</div>
                <div style="font-size:9px;color:var(--ink-soft)">${escapeHTML(a.reason)}</div>
              </div>
            </div>
          `).join('')}
        ` : ''}
      </div>
    </div>
  `;
}

function parseOpKey(k){const i=k.indexOf('__');return{ds:k.slice(0,i),bid:k.slice(i+2)};}

// Portal dropdown state
let portalState={open:false,key:'',mode:''};
const portal=document.getElementById('dd-portal');

function closeAllDd(){
  portal.classList.remove('open');
  portal.innerHTML='';
  portalState={open:false,key:'',mode:''};
}

function openPortal(anchorEl,key,mode){
  const rect=anchorEl.getBoundingClientRect();
  const {ds,bid}=parseOpKey(key);
  const b=getBoat(bid);
  const op=getOp(ds,bid);
  let html='';
  if(mode==='route'){
    const pierRoutes=ROUTES.filter(rt=>rt.pier===getBoatCurrentPier(b, ds)).filter(rt=>{var _s=getDayStatus(rt,ds);return !_s||_s.type==='open';});   // §boatPierDate
    html=pierRoutes.map(rt=>`
      <div class="dd-item${op.route===rt.id?' on':''}" data-action="route" data-key="${key}" data-rid="${rt.id}">
        <div class="dd-dot" style="background:${rt.color}"></div>${rt.name}
      </div>`).join('');
    if(op.route) html+=`<div class="dd-divider"></div><div class="dd-item" data-action="route" data-key="${key}" data-rid="">— ล้าง</div>`;
  } else {
    html=`
      <div class="dd-item${op.type==='early'?' on':''}" data-action="type" data-key="${key}" data-type="early">Early</div>
      <div class="dd-item${op.type==='normal'?' on':''}" data-action="type" data-key="${key}" data-type="normal">Normal</div>
      <div class="dd-item${op.type==='charter'?' on':''}" data-action="type" data-key="${key}" data-type="charter">Charter</div>
      <div class="dd-divider"></div>
      <div class="dd-item" data-action="type" data-key="${key}" data-type="normal">— รีเซ็ต (Normal)</div>`;
  }
  portal.innerHTML=html;
  portal.style.top=(rect.bottom+window.scrollY+4)+'px';
  portal.style.left=(rect.left+window.scrollX)+'px';
  portal.classList.add('open');
  portalState={open:true,key,mode};
}

// ── Attach ALL global listeners ONCE ──
function initOpListeners(){
  // close on outside click
  document.addEventListener('click',function(e){
    if(portal.contains(e.target)) return;
    if(e.target.closest('[data-dd]')) return;
    closeAllDd();
  });

  // portal item clicks
  portal.addEventListener('click',function(e){
    const item=e.target.closest('[data-action]');
    if(!item) return;
    e.stopPropagation();
    const {ds,bid}=parseOpKey(item.dataset.key);
    if(item.dataset.action==='route'){
      getOp(ds,bid).route=item.dataset.rid||null;
    } else {
      getOp(ds,bid).type=item.dataset.type;
    }
    closeAllDd(); save(); renderOp();
  });

  // step buttons — delegated via document
  document.addEventListener('click',function(e){
    const btn=e.target.closest('#matrix-tbl [data-step]');
    if(!btn) return;
    const key=btn.dataset.key;
    const step=parseInt(btn.dataset.step);
    const {ds,bid}=parseOpKey(key);
    const b=getBoat(bid);if(!b)return;
    const op=getOp(ds,bid);
    const v=Math.min(Math.max((op.booked||0)+step,0),b.cap);
    op.booked=v;
    // update input display
    const inp=btn.closest('.stepper').querySelector('.op-inp');
    if(inp) inp.value=v;
    const pct=Math.round(v/b.cap*100);
    const free=b.cap-v;
    const badge=btn.closest('.cell-line').querySelector('.op-free');
    if(badge){badge.textContent=(pct>=95?'✕':free)+'v/'+b.cap;badge.className='op-free '+(pct>=95?'full':pct>=70?'warn':'ok');}
    save();
  });
  document.addEventListener('click',function(e){
    const trigger=e.target.closest('#matrix-tbl [data-dd]');
    if(!trigger) return;
    e.stopPropagation();
    const key=trigger.dataset.key;
    const mode=trigger.dataset.dd;
    if(portalState.open && portalState.key===key && portalState.mode===mode){
      closeAllDd(); return;
    }
    openPortal(trigger,key,mode);
  });
}

function attachOpHandlers(){
  const tbl=document.getElementById('matrix-tbl');
  if(!tbl) return;
  tbl.querySelectorAll('.op-inp').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const {ds,bid}=parseOpKey(inp.dataset.key);
      const b=getBoat(bid);if(!b)return;
      const v=Math.min(Math.max(parseInt(inp.value)||0,0),b.cap);
      getOp(ds,bid).booked=v;
      const pct=Math.round(v/b.cap*100);
      const free=b.cap-v;
      const badge=inp.closest('.cell-line').querySelector('.op-free');
      if(badge){badge.textContent=(pct>=95?'✕':free)+'v/'+b.cap;badge.className='op-free '+(pct>=95?'full':pct>=70?'warn':'ok');}
      save();
    });
  });
}

// ══════════════════════════════════════
// SETTINGS / ROUTES
// ══════════════════════════════════════
const ROUTE_COLORS=['#378ADD','#3B6D11','#E24B4A','#7F77DD','#BA7517','#0F6E56','#D4537E','#888780'];
let editRouteId=null,selLoc='tublamu',timeRows=[];

// ══════════════════════════════════════
// PROGRAMS (Settings) — Season system
// ══════════════════════════════════════
let selProgId=null;
let showSeasonForm=false;
let addSeasonType='open';
let progEditMode=false; // Modify mode toggle · read-only by default to prevent accidents

function getRouteStatusNow(r){
  if(!r.seasons||!r.seasons.length) return null;
  return r.seasons.find(s=>s.from<=TODAY_STR&&s.to>=TODAY_STR)||null;
}
function isRouteActiveToday(r){
  const s=getRouteStatusNow(r);
  return s&&s.type==='open';
}

// Status of a specific day — checks override first, then seasons
function getDayStatus(r,dateStr){
  if(r.overrides&&r.overrides[dateStr]) return {type:r.overrides[dateStr],source:'override'};
  if(!r.seasons||!r.seasons.length) return null;
  const s=r.seasons.find(s=>s.from<=dateStr&&s.to>=dateStr);
  if(s) return {type:s.type,source:'season',seasonId:s.id};
  // §Outside all defined seasons (2026-07-24): if the route declares any OPEN window, a date in none
  //   of them is off-season → closed. Previously returned null and callers assumed open, so an
  //   open-season-only route (e.g. Day Trip - Se La Va, open Dec-Apr) showed year-round in the
  //   Booking Calendar / Boat Op. Routes with only closed seasons keep null (open by default).
  if(r.seasons.some(x=>x.type==='open')) return {type:'closed',source:'outside-season'};
  return null;
}

// ═══════════════════════════════════════════════════════════════
// ALLOTMENT helpers · derived from TRIPS (boat ops) + SB_BOOKINGS
// ═══════════════════════════════════════════════════════════════
// Source of truth:
//   TRIPS[date][boatId] = { route, type, charterBookingId?, ... }
//     → which boats are assigned to which routes on which dates
//   SB_BOOKINGS = bookings array
//     → consumes seats from the assigned boats' total capacity

// Sum pax for a single booking trip (handles mixed FR + TH + legacy shape)
function getTripPaxTotal(trip){
  if(!trip || !trip.pax) return 0;
  const p = trip.pax;
  return (p.ad||0)+(p.ad_fr||0)+(p.ad_th||0)
       +(p.chd||0)+(p.chd_fr||0)+(p.chd_th||0)
       +(p.inf||0)+(p.inf_fr||0)+(p.inf_th||0)
       +(p.foc||0)+(p.foc_fr||0)+(p.foc_th||0);
}

/* ══ §Sales Board · pax ต่อเซลล์/ต่อเอเยนต์ รายเดือน ═══════════════════════════════════════════════
   เข้าเป้าด้วย "จำนวน pax ที่เดินทางในเดือนนั้น" — นับตามเดือนของ trip ไม่ใช่วันที่จอง
   (จองล่วงหน้าเดือน มิ.ย. แต่เดินทาง ก.ค. → นับเข้า ก.ค.) · ตัด booking ยกเลิกออก
   1 booking หลาย trip ข้ามเดือน (OVN) → แต่ละ trip นับเข้าเดือนของตัวเอง ไม่นับซ้ำ           */
const _SB_CXL = ['cancelled','rejected','cancelled_weather'];
function _ymOf(d){ return String(d||'').slice(0,7); }
/* FOC (free-of-charge) pax ต่อ trip · แยกออกมาโชว์ในตาราง — pax รวมยังนับ FOC เหมือนเดิม (ไม่เปลี่ยน metric) */
function getTripFoc(t){ const p=(t&&t.pax)||{}; return (+p.foc||0)+(+p.foc_fr||0)+(+p.foc_th||0); }
function salesPaxAgg(ym){
  const bySales = {}, byAgent = {}, focBySales = {}, focByAgent = {};
  (typeof SB_BOOKINGS!=='undefined' ? SB_BOOKINGS : []).forEach(b=>{
    if(_SB_CXL.includes(b.status)) return;
    const ag = (typeof sbGetAgent==='function') ? sbGetAgent(b.agentId) : null;
    const sid = ag ? ag.sales : null;
    (b.trips||[]).forEach(t=>{
      if(_ymOf(t.date)!==ym) return;
      const px = (typeof getTripPaxTotal==='function') ? getTripPaxTotal(t) : 0;
      if(!px) return;
      const foc = getTripFoc(t);
      if(b.agentId){ byAgent[b.agentId]=(byAgent[b.agentId]||0)+px; if(foc) focByAgent[b.agentId]=(focByAgent[b.agentId]||0)+foc; }
      if(sid){       bySales[sid]=(bySales[sid]||0)+px;             if(foc) focBySales[sid]=(focBySales[sid]||0)+foc; }
    });
  });
  return { bySales, byAgent, focBySales, focByAgent };
}
function salesTargetFor(salesId, ym){
  const s = (typeof sbGetSales==='function') ? sbGetSales(salesId) : null;
  const t = s && s.targets;
  return (t && +t[ym]) || 0;
}
/* แก้เป้า · เก็บลง SB_SALES แล้ว persist (read-modify-write) · admin เท่านั้น (คุมที่ปุ่มใน UI) */
function salesSetTarget(salesId, ym, pax){
  const s = (typeof sbGetSales==='function') ? sbGetSales(salesId) : null;
  if(!s) return;
  s.targets = s.targets || {};
  const n = Math.max(0, parseInt(pax)||0);
  if(n) s.targets[ym] = n; else delete s.targets[ym];
  if(typeof sbSalesPersist==='function') sbSalesPersist();
}
/* §ติดตามแล้ว · เซลล์ติ๊กว่าจัดการเอเยนต์รายนี้ในเดือนนี้แล้ว (โทรแล้ว/เสนอแล้ว)
   เก็บบน SB_SALES.followup = {"YYYY-MM::agentId": true} — sync ข้ามเครื่อง/วัน · ผจก.เห็นด้วย */
/* kind = '' (ติดตามเอเยนต์) หรือ 'foc' (ติดตาม feedback ของ FOC) — เก็บแยก namespace ในคีย์เดียวกัน */
function _fuKey(ym, agentId, kind){ return (kind?kind+':':'')+ym+'::'+agentId; }
function salesIsFollowed(salesId, ym, agentId, kind){
  const s=(typeof sbGetSales==='function')?sbGetSales(salesId):null;
  return !!(s && s.followup && s.followup[_fuKey(ym,agentId,kind)]);
}
function salesToggleFollow(salesId, ym, agentId, kind){
  const s=(typeof sbGetSales==='function')?sbGetSales(salesId):null; if(!s) return;
  s.followup = s.followup || {};
  const k=_fuKey(ym,agentId,kind);
  if(s.followup[k]) delete s.followup[k]; else s.followup[k]=true;
  if(typeof sbSalesPersist==='function') sbSalesPersist();
  if(typeof renderSalesBoard==='function'){ _sbSig=null; renderSalesBoard(); }
}
/* prev-month helper สำหรับ trend (โต/ตกลง) */
function _ymShift(ym, n){ const p=ym.split('-').map(Number); const d=new Date(p[0], p[1]-1+n, 1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }

/* §สตรีค · จำนวนเดือน "ถึงเป้า" ติดต่อกันนับถอยหลังจากเดือน ym (รวมเดือน ym ถ้าถึง)
   ถึงเป้า = pax เดือนนั้น ≥ เป้าเดือนนั้น · เดือนที่ไม่ตั้งเป้า = ตัดสตรีค (ไม่รู้ว่าถึงไหม)
   จำกัด 24 เดือนกันวนไกลเกิน */
function salesStreak(salesId, ym){
  let n=0, cur=ym;
  for(let i=0;i<24;i++){
    const tgt=salesTargetFor(salesId, cur); if(!tgt) break;
    const pax=(salesPaxAgg(cur).bySales[salesId])||0;
    if(pax>=tgt){ n++; cur=_ymShift(cur,-1); } else break;
  }
  return n;
}

/* §จัดหมวด + badge ของเอเยนต์ · เกณฑ์ที่เคาะ: โต ≥+25% · ตก ≥−20% · ฐานเดือนก่อนต้อง ≥5 คนถึงนับ %
   คืน {cat, pct, badge, note} · cat: 'up'|'down'|'new'|'gone'|'flat'
   ฐานต่ำ (<5) แต่โตเยอะ = ไม่ขึ้น 'up' (กัน +1671%) แต่ไปอยู่ flat/new ตามจริง — โชว์เป็นจำนวนไม่ใช่ % */
const SB_GROW_MIN=25, SB_DROP_MIN=-20, SB_BASE_MIN=5;
function agentTrend(p, pp){
  if(pp<=0 && p>0)  return { cat:'new',  pct:null, badge:'ใหม่',        note:'เพิ่งเริ่มเดือนนี้' };
  if(pp>0  && p<=0) return { cat:'gone', pct:null, badge:'-'+fmtNum(pp), note:'เดือนก่อน '+fmtNum(pp)+' คน → เดือนนี้ 0' };
  if(pp<SB_BASE_MIN){ /* ฐานน้อยเกินคิด % ไม่ได้ · โชว์ส่วนต่างเป็นจำนวน */
    const d=p-pp; return { cat:'flat', pct:null, badge:(d>0?'+':'')+fmtNum(d), note:'เดือนก่อน '+fmtNum(pp)+' คน' };
  }
  const pct=Math.round((p/pp-1)*100);
  if(pct>=SB_GROW_MIN) return { cat:'up',   pct, badge:'+'+pct+'%', note:'เดือนก่อน '+fmtNum(pp)+' คน' };
  if(pct<=SB_DROP_MIN) return { cat:'down', pct, badge:pct+'%',     note:'เดือนก่อน '+fmtNum(pp)+' คน' };
  return { cat:'flat', pct, badge:(pct>0?'+':'')+pct+'%', note:'เดือนก่อน '+fmtNum(pp)+' คน' };
}
function fmtNum(n){ return Math.round(n||0).toLocaleString(); }

// Sum seat-mode pax for a route on a date (across all bookings)
// Excludes: cancelled bookings, charter-mode trips
// §pendSeat · booking ที่รออนุมัติ · กันที่นั่งไว้หรือเปล่า ขึ้นกับว่าพักไว้เพราะอะไร
//   เกิน capacity = ที่นั่งไม่มีอยู่จริง → ไม่กัน (ไม่งั้นคงเหลือติดลบและบังที่ขายได้จริง)
//   เหตุผลอื่น (ส่วนลดรอยืนยัน · B2C sync · ขายวันที่ปิด) = ที่นั่งมีจริง → กันไว้
function bkPendHoldsSeat(bk){
  if(!bk || bk.status!=='pending_approval') return true;
  var ap=bk.approval||{};
  var overCap = (Array.isArray(ap.over) && ap.over.length>0) || (+ap.totOver>0);
  return !overCap;
}
function getSeatsConsumed(routeId, dateStr, excludeBkId){
  if(!routeId || !dateStr) return 0;
  if(typeof SB_BOOKINGS === 'undefined' || !Array.isArray(SB_BOOKINGS)) return 0;
  let total = 0;
  SB_BOOKINGS.forEach(bk => {
    if(excludeBkId && bk.id === excludeBkId) return;   // exclude the booking being edited (don't count its own seats against itself)
    if(bk.status === 'cancelled' || bk.status === 'rejected' || bk.status === 'cancelled_weather') return;
    if(!bkPendHoldsSeat(bk)) return;   // §pendSeat · รออนุมัติเพราะเกิน cap = ที่นั่งยังไม่มีอยู่จริง
    // v2 bookings with trips[]
    if(bk.schemaVer === 2 && Array.isArray(bk.trips)){
      bk.trips.forEach(t => {
        if(t.routeId !== routeId || t.date !== dateStr) return;
        if(t.bookingMode === 'charter') return;  // charter consumes whole boat, not seats
        // §check-in · คนที่ No-show / CXL หน้างานไม่ได้ใช้ที่นั่งจริง → หักออกจากที่นั่งที่ถูกใช้
        let _seat = getTripPaxTotal(t);
        if(typeof ckLostByType === 'function'){ const _L = ckLostByType(bk, dateStr); if(_L && _L.total > 0) _seat = Math.max(0, _seat - _L.total); }
        total += _seat;
      });
    } else if(bk.programId === routeId && bk.travelDate === dateStr){
      // legacy v1 booking · assume seat mode · convert pax shape
      const p = bk.pax || {};
      total += (p.adult||0) + (p.child||0) + (p.infant||0);
    }
  });
  return total;
}

// Booked pax + routes for a specific boat on a date, from sales bookings (Daily Fleet Log auto-PAX).
// Counts physical heads aboard (ad+chd+inf+foc) of non-cancelled v2 bookings assigned to that boat (bk.ops.boatId).
function flBoatBookingsFor(boatId, dateStr){
  const out = { pax:0, routes:{}, trips:0 };
  if(!boatId || !dateStr || typeof SB_BOOKINGS === 'undefined' || !Array.isArray(SB_BOOKINGS)) return out;
  SB_BOOKINGS.forEach(bk => {
    if(['cancelled','rejected','cancelled_weather'].includes(bk.status)) return;
    if(bkOpsRead(bk, dateStr).boatId !== boatId) return;                            // per-day boat
    if(bk.schemaVer === 2 && Array.isArray(bk.trips)){
      bk.trips.forEach(t => {
        if(t.date !== dateStr) return;
        const p = (typeof getTripPaxTotal === 'function') ? getTripPaxTotal(t) : 0;
        out.pax += p;
        if(t.routeId) out.routes[t.routeId] = (out.routes[t.routeId]||0) + p;
      });
    }
  });
  out.trips = Object.keys(out.routes).length;
  return out;
}

// Returns the assigned-boat entries (Boat Operation TRIPS) for route+date
// Each entry: { boatId, boat, route, type, charterBookingId, capacity }
function getAssignedBoatsForRouteDate(routeId, dateStr){
  if(!routeId || !dateStr) return [];
  if(typeof TRIPS === 'undefined') return [];
  const dayOps = TRIPS[dateStr] || {};
  const out = [];
  Object.keys(dayOps).forEach(bid => {
    const op = dayOps[bid];
    if(!op || op.route !== routeId) return;
    const boat = (typeof BOATS !== 'undefined') ? BOATS.find(b => b.id === bid) : null;
    if(!boat) return;
    // §boatSplit · เรือที่ถูกเหมาจริงอาจยังไม่ถูกธงใน Boat Operation (ลำที่ 2+ ของใบที่แยกลำ)
    //   ไม่เช็คตรงนี้ = getAllotment นับลำที่เหมาไปแล้วเป็นที่นั่งว่าง แล้วขายซ้ำ
    const _chMap=(typeof baCharterBoatMapMemo==='function')?baCharterBoatMapMemo(dateStr):new Map();
    const _chBk=_chMap.get(bid)||null;
    out.push({
      boatId: bid,
      boat,
      route: op.route,
      type: (op.type === 'charter' || _chBk) ? 'charter' : (op.type || 'normal'),
      charterBookingId: op.charterBookingId || _chBk,
      capacity: (typeof boatCapFor==='function') ? boatCapFor(bid, dateStr) : (boat.cap || 0)   // §cap override รายวัน
    });
  });
  return out;
}

// Check if a specific boat is chartered on a given date
function isBoatChartered(boatId, dateStr){
  if(typeof TRIPS === 'undefined') return false;
  const op = TRIPS?.[dateStr]?.[boatId];
  return !!(op && (op.type === 'charter' || op.charterBookingId));
}

// Compute allotment for a route+date
// Returns:
//   {
//     routeId, dateStr,
//     hasAllotment: bool      · true if at least 1 boat is assigned
//     assignedBoats: [...]    · all boats assigned to this route+date
//     charteredBoats: [...]   · subset that are chartered
//     totalCapacity:  Σ caps  · sum of all assigned boat capacities
//     charterCapacity: Σ caps · sum of chartered boat capacities (locked)
//     availableCapacity:      · total - chartered (seat pool)
//     seatsConsumed:          · pax in seat-mode bookings
//     seatsAvailable:         · seat pool minus consumed (final number)
//     fillPct: 0..100         · usage % of seat pool
//     isFull: bool            · seatsAvailable <= 0
//     state: 'open'|'tight'|'full'|'no-allotment'
//   }
function getAllotment(routeId, dateStr, excludeBkId){
  const result = {
    routeId, dateStr,
    hasAllotment: false,
    assignedBoats: [], charteredBoats: [],
    totalCapacity: 0, charterCapacity: 0, availableCapacity: 0,
    seatsConsumed: 0, seatsAvailable: 0,
    fillPct: 0, isFull: false, state: 'no-allotment'
  };
  if(!routeId || !dateStr) return result;
  const assigned = getAssignedBoatsForRouteDate(routeId, dateStr);
  result.assignedBoats = assigned;
  if(assigned.length === 0) return result;
  result.hasAllotment = true;
  result.licenseTotal = 0; result.charterLicense = 0;   // real registered seats (boat.licensePax) — physical max
  assigned.forEach(a => {
    result.totalCapacity += a.capacity;
    const lp = (a.boat && a.boat.licensePax) || a.capacity;   // fall back to cap if no license figure
    result.licenseTotal += lp;
    if(a.type === 'charter' || a.charterBookingId){
      result.charteredBoats.push(a);
      result.charterCapacity += a.capacity;
      result.charterLicense += lp;
    }
  });
  result.availableCapacity = result.totalCapacity - result.charterCapacity;   // company cap · seat pool
  result.licenseCapacity  = result.licenseTotal - result.charterLicense;      // real seats · seat pool
  result.seatsConsumed = getSeatsConsumed(routeId, dateStr, excludeBkId);
  // Seat locks reserve seats out of the sellable pool (hard) · drawing a lock moves it from locked→booked so no double-count
  result.lockedSeats = (typeof bkV2LockedTotal==='function') ? bkV2LockedTotal(routeId, dateStr) : 0;
  result.seatsAvailable = Math.max(0, result.availableCapacity - result.seatsConsumed - result.lockedSeats);
  result.licenseAvailable = Math.max(0, result.licenseCapacity - result.seatsConsumed);   // physical headroom (license − consumed)
  result.fillPct = result.availableCapacity > 0
    ? Math.round((result.seatsConsumed + result.lockedSeats) / result.availableCapacity * 100)
    : 0;
  result.isFull = result.seatsAvailable <= 0;
  if(result.availableCapacity <= 0 && result.charterCapacity > 0) result.state = 'all-chartered';
  else if(result.isFull) result.state = 'full';
  else if(result.fillPct >= 80) result.state = 'tight';
  else result.state = 'open';
  return result;
}

// Returns list of seat-mode bookings on a route+date · for displacement modal
function getBookingsForRouteDate(routeId, dateStr){
  if(!routeId || !dateStr) return [];
  if(typeof SB_BOOKINGS === 'undefined' || !Array.isArray(SB_BOOKINGS)) return [];
  const out = [];
  SB_BOOKINGS.forEach(bk => {
    if(bk.status === 'cancelled' || bk.status === 'rejected' || bk.status === 'cancelled_weather') return;
    if(bk.schemaVer === 2 && Array.isArray(bk.trips)){
      bk.trips.forEach(t => {
        if(t.routeId !== routeId || t.date !== dateStr) return;
        if(t.bookingMode === 'charter') return;
        const pax = getTripPaxTotal(t);
        if(pax > 0){
          out.push({
            bookingId: bk.id,
            customerName: bk.leadPax || '—',
            pax,
            voucherRef: bk.voucherRef || '',
            status: bk.status,
            agentName: bk.agentId ? (sbGetAgent(bk.agentId)?.name || bk.agentId) : '—'
          });
        }
      });
    } else if(bk.programId === routeId && bk.travelDate === dateStr){
      const p = bk.pax || {};
      const pax = (p.adult||0) + (p.child||0) + (p.infant||0);
      if(pax > 0){
        out.push({
          bookingId: bk.id,
          customerName: bk.customerName || '—',
          pax,
          voucherRef: '',
          status: bk.status || 'confirmed',
          agentName: '—'
        });
      }
    }
  });
  return out;
}

// Returns list of boats currently chartered on a date (across all routes)
// Useful for: "VIP-CN chartered 'Andaman Ryder' on Jun 15" display
function getChartersOnDate(dateStr){
  if(typeof TRIPS === 'undefined') return [];
  const dayOps = TRIPS[dateStr] || {};
  const out = [];
  Object.keys(dayOps).forEach(bid => {
    const op = dayOps[bid];
    if(!op || (op.type !== 'charter' && !op.charterBookingId)) return;
    const boat = (typeof BOATS !== 'undefined') ? BOATS.find(b => b.id === bid) : null;
    if(!boat) return;
    out.push({
      boatId: bid, boatName: boat.name, capacity: boat.cap,
      routeId: op.route || null,
      charterBookingId: op.charterBookingId || null
    });
  });
  return out;
}

// Toggle override for a day — cycles through: clear → opposite of season → clear
function toggleDayOverride(rid,dateStr){
  const r=ROUTES.find(x=>x.id===rid);if(!r)return;
  if(!r.overrides) r.overrides={};
  const status=getDayStatus(r,dateStr);
  if(r.overrides[dateStr]){
    delete r.overrides[dateStr]; // clear override
  } else if(status){
    r.overrides[dateStr]=status.type==='open'?'closed':'open';
  } else {
    r.overrides[dateStr]='open'; // no season, default to open
  }
  save('config');renderSettings();
}
// Guarded · checks booking impact when toggling a day to CLOSED
function toggleDayOverrideGuarded(rid, dateStr){
  if(!progEditMode) return; // must be in edit mode
  const r = ROUTES.find(x => x.id === rid); if(!r) return;
  // Determine what the new status would be
  const status = getDayStatus(r, dateStr);
  const willBeClosed = r.overrides && r.overrides[dateStr]
    ? false // clearing override · will revert · skip warning (revert can't surprise)
    : (status ? (status.type === 'open') : false); // toggling from open → closed
  if(!willBeClosed){
    toggleDayOverride(rid, dateStr);
    return;
  }
  // Check booking impact for this single day
  const impact = progCountBookingImpact(rid, dateStr, dateStr);
  if(impact.bookings.length === 0 && impact.trips.filter(t => !t.isCharter).length === 0){
    toggleDayOverride(rid, dateStr);
    return;
  }
  progShowImpactModalForDay(rid, dateStr, r.name, impact);
}
function progShowImpactModalForDay(rid, dateStr, routeName, impact){
  const existing = document.getElementById('prog-impact-modal');
  if(existing) existing.remove();
  const fmtD = s => s ? new Date(s).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'}) : '—';
  const charterTrips = impact.trips.filter(t => t.isCharter);
  const normalTrips  = impact.trips.filter(t => !t.isCharter);
  const overlay = document.createElement('div');
  overlay.id = 'prog-impact-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",sans-serif';
  const bookingsHTML = impact.bookings.length === 0 ? '' : `
    <div style="margin-top:14px">
      <div style="font-size:11px;font-weight:700;color:#C44A36;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px">⚠ Customer bookings affected · ${impact.bookings.length} · ${impact.totalPax} pax</div>
      <div style="max-height:140px;overflow-y:auto;border:1px solid #F0D5CE;border-radius:8px;background:#FFFAF8">
        ${impact.bookings.map(b => `<div style="display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #F5E5E0;font-size:11px"><span style="font-weight:600;color:#1A2A33">${b.ref}</span><span style="color:#6B7785">${b.leadName||'—'}</span><span style="color:#C44A36;font-weight:600;font-family:Manrope,sans-serif">${b.pax} pax</span></div>`).join('')}
      </div>
    </div>`;
  const tripsHTML = normalTrips.length === 0 ? '' : `
    <div style="margin-top:12px">
      <div style="font-size:11px;font-weight:700;color:#8A6914;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px">⚠ Boat assignments will be lost · ${normalTrips.length}</div>
      <div style="max-height:90px;overflow-y:auto;border:1px solid #F0D9A0;border-radius:8px;background:#FFF6E5">
        ${normalTrips.map(t => `<div style="padding:5px 10px;border-bottom:1px solid #F0E2C0;font-size:11px;color:#1A2A33">${t.boatName}</div>`).join('')}
      </div>
    </div>`;
  const charterHTML = charterTrips.length === 0 ? '' : `
    <div style="margin-top:12px;padding:8px 10px;background:#F0E8FB;border:1px solid #D7B5F0;border-radius:8px">
      <div style="font-size:11px;font-weight:700;color:#6B289A;margin-bottom:3px">⚓ ${charterTrips.length} charter slot(s) on this day</div>
      <div style="font-size:10px;color:#6B289A">Charter is tied to a booking · cancel/reschedule the booking first</div>
    </div>`;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:500px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 16px 40px rgba(0,0,0,.18)">
      <div style="padding:18px 20px;border-bottom:1px solid #F0EAE3">
        <div style="display:flex;align-items:center;gap:9px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#FFE2DC;color:#C44A36;font-size:20px">⚠</span>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#C44A36">Close this day · impact warning</div>
            <div style="font-size:11px;color:#6B7785;margin-top:2px">${routeName} · ${fmtD(dateStr)}</div>
          </div>
        </div>
      </div>
      <div style="padding:18px 20px">
        <div style="font-size:12px;color:#1A2A33;line-height:1.5">Closing this day will hide existing bookings &amp; boat assignments from the schedule. Data is preserved · only display is hidden.</div>
        ${bookingsHTML}
        ${tripsHTML}
        ${charterHTML}
        <div style="margin-top:14px;padding:10px 12px;background:#F4F8F5;border-radius:8px;font-size:11px;color:#1A2A33;line-height:1.5"><b style="color:#0F6E56">Recommended:</b> cancel/refund/reschedule affected bookings before closing.</div>
      </div>
      <div style="padding:14px 20px;background:#FAFBFA;border-top:1px solid #F0EAE3;display:flex;justify-content:flex-end;gap:8px">
        <button onclick="document.getElementById('prog-impact-modal').remove()" style="padding:8px 18px;border:1.5px solid #C44A36;background:#fff;color:#C44A36;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit" onmouseover="this.style.background='#FFE2DC'" onmouseout="this.style.background='#fff'">Cancel</button>
        <button onclick="document.getElementById('prog-impact-modal').remove();toggleDayOverride('${rid}','${dateStr}')" style="padding:8px 18px;background:#C44A36;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;box-shadow:0 2px 6px rgba(196,74,54,.22)">Close anyway</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Calendar month state for Programs detail panel
let calMonthStr=null; // 'YYYY-MM' — null means current month
function calNavMonth(delta){
  const base=calMonthStr?new Date(calMonthStr+'-01'):new Date();
  base.setMonth(base.getMonth()+delta);
  calMonthStr=`${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
  renderSettings();
}
function calNavYear(delta){
  const base=calMonthStr?new Date(calMonthStr+'-01'):new Date();
  base.setFullYear(base.getFullYear()+delta);
  calMonthStr=`${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
  renderSettings();
}
function calResetToday(){calMonthStr=null;renderSettings();}

// ══ Drag-to-reorder · shared by Programs (per pier) and Markets ══════════════
// Rows opt in with: draggable="true" data-sort-id="<id>" data-sortgroup="<group>"
// Reordering is CONSTRAINED to the same group (a Panwa route can never land in Tub Lamu).
const LA_GRIP = '<span class="la-grip" title="ลากเพื่อจัดลำดับ" style="flex:none;display:flex;align-items:center;justify-content:center;width:16px;align-self:stretch;cursor:grab;color:#c2ccc7;user-select:none"><svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2" cy="3" r="1.25"/><circle cx="8" cy="3" r="1.25"/><circle cx="2" cy="8" r="1.25"/><circle cx="8" cy="8" r="1.25"/><circle cx="2" cy="13" r="1.25"/><circle cx="8" cy="13" r="1.25"/></svg></span>';
let _laDragJustEnded = false;
function laMakeSortable(container, itemSel, onReorder){
  if(!container || container._laSortWired) return;
  container._laSortWired = true;
  let dragEl = null;
  container.addEventListener('dragstart', e=>{
    const it = e.target.closest(itemSel); if(!it) return;
    dragEl = it; it.style.opacity = '.45';
    try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', it.dataset.sortId||''); }catch(_){}
  });
  container.addEventListener('dragover', e=>{
    if(!dragEl) return;
    const it = e.target.closest(itemSel);
    if(!it || it===dragEl) return;
    if((it.dataset.sortgroup||'') !== (dragEl.dataset.sortgroup||'')) return;  // same pier / group only
    e.preventDefault();
    const r = it.getBoundingClientRect();
    it.parentNode.insertBefore(dragEl, ((e.clientY - r.top) > r.height/2) ? it.nextSibling : it);
  });
  container.addEventListener('drop', e=>{ e.preventDefault(); });
  container.addEventListener('dragend', ()=>{
    if(!dragEl) return;
    dragEl.style.opacity='';
    const grp = dragEl.dataset.sortgroup||'';
    dragEl = null;
    _laDragJustEnded = true; setTimeout(()=>{ _laDragJustEnded=false; }, 80);   // don't let the drop fire a row click
    const ids = [...container.querySelectorAll(itemSel)]
      .filter(x => (x.dataset.sortgroup||'') === grp)
      .map(x => x.dataset.sortId);
    if(typeof onReorder==='function') onReorder(ids, grp);
  });
}

// Stable order helper · a record with no `sort` yet keeps its current position (pre-migration data)
function laBySort(a,b){ const x=(a&&a.sort), y=(b&&b.sort); if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1; return x-y; }
function laApplySort(arr){ if(Array.isArray(arr) && arr.some(r=>r&&r.sort!=null)) arr.sort(laBySort); return arr; }

/* §laSortSync · ยืนยันลำดับก่อนวาดทุกครั้ง · ถ้ามีทางเข้าอื่นที่ยังไม่ได้เรียง จะได้ไม่หลุด
   เรียงเฉพาะตอนที่ลำดับเพี้ยนจริง ๆ จะได้ไม่ไปรบกวน reference ของ array โดยไม่จำเป็น */
function laEnsureSorted(arr){
  if(!Array.isArray(arr) || !arr.some(function(r){ return r && r.sort != null; })) return false;
  var ok = true;
  for(var i=1; i<arr.length; i++){ if(laBySort(arr[i-1], arr[i]) > 0){ ok = false; break; } }
  if(ok) return false;
  arr.sort(laBySort); return true;
}
// Programs: reorder ROUTES *within one pier* — routes of other piers keep their exact slots
function stApplyRouteOrder(ids, pier){
  if(!Array.isArray(ids) || !ids.length || !pier) return;
  const byId={}; ROUTES.forEach(r=>{ byId[r.id]=r; });
  const ordered = ids.map(id=>byId[id]).filter(r=>r && r.pier===pier);
  const inPier  = ROUTES.filter(r=>r.pier===pier);
  if(ordered.length !== inPier.length) return;   // safety: bail rather than lose a route
  let k=0;
  const next = ROUTES.map(r => r.pier===pier ? ordered[k++] : r);
  ROUTES.length=0; next.forEach(r=>ROUTES.push(r));
  ROUTES.forEach((r,i)=>{ r.sort = i; });        // explicit order → survives reload (scalar col · diffed as a normal field)
  save('config');                                        // → localStorage → auto-sync to server
  renderSettings();
  const pn = pier==='panwa'?'VISIT PANWA':pier==='tublamu'?'TUB LAMU':pier.toUpperCase();
  if(typeof laSaveToast==='function') laSaveToast({kind:'success', title:'บันทึกลำดับ Program แล้ว', status:pn, sub:ordered.length+' โปรแกรม', dur:2600});
}

// Markets: reorder SB_MARKETS (drives the Markets list + the Market dropdown on +Agent)
function tmApplyMarketOrder(ids){
  if(!Array.isArray(ids) || !ids.length) return;
  const byId={}; SB_MARKETS.forEach(m=>{ byId[m.id]=m; });
  const next = ids.map(id=>byId[id]).filter(Boolean);
  SB_MARKETS.forEach(m=>{ if(next.indexOf(m)<0) next.push(m); });   // keep any straggler
  if(next.length !== SB_MARKETS.length) return;                     // safety: bail rather than lose a market
  SB_MARKETS = next;
  SB_MARKETS.forEach((m,i)=>{ m.sort = i; });                       // explicit order → survives reload
  if(typeof sbMarketsPersist==='function') sbMarketsPersist();      // → localStorage → auto-sync to server
  renderTeamMkt();
  if(typeof laSaveToast==='function') laSaveToast({kind:'success', title:'บันทึกลำดับ Market แล้ว', status:SB_MARKETS.length+' MARKETS', dur:2600});
}

function renderSettings(){
  const wrap=document.getElementById('prog-pink-wrap');
  if(!wrap){
    // legacy path — fallback to old render if wrap not found
    return renderSettingsLegacy();
  }
  laEnsureSorted(ROUTES);   /* §laSortSync · ลำดับที่ลากไว้ต้องชนะลำดับแถวที่เซิร์ฟเวอร์ส่งมา */
  const dim={bg:'#F4F2EE',ink:'#1A1A1A',ink2:'#666',ink3:'#999',ink4:'#bbb',ink5:'#ccc',line:'rgba(0,0,0,.04)'};
  const SVG_PINK={accent:'#E03B7E',soft:'#FCE5EC',text:'#9F1B4F'};
  const fmtD=s=>s?new Date(s).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'2-digit'}):'—';

  // KPI counts
  const totalProg=ROUTES.length;
  const openToday=ROUTES.filter(r=>isRouteActiveToday(r)).length;
  const closedToday=ROUTES.filter(r=>{const s=getRouteStatusNow(r);return s&&s.type==='closed';}).length;
  const noData=totalProg-openToday-closedToday;

  // Pier groups (needed for kpiStrip + list)
  const groups={tublamu:[],panwa:[],ranong:[]};
  ROUTES.forEach(r=>{ if(groups[r.pier]) groups[r.pier].push(r); });
  const tlCount=(groups.tublamu||[]).length;
  const vpCount=(groups.panwa||[]).length;

  // Header bar
  const headerBar=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:6px">
      <div style="width:32px;height:32px;border-radius:50%;background:${dim.ink};color:white;display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
    </div>
    <button onclick="openRouteModal()" style="background:${dim.ink};color:white;border:none;border-radius:20px;padding:7px 16px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
      เพิ่มโปรแกรม
    </button>
  </div>`;

  // KPI strip
  const kpiStrip=`<div style="display:grid;grid-template-columns:1.6fr 0.85fr 0.85fr 0.85fr;gap:8px;margin-bottom:14px;align-items:stretch">
    <div style="grid-column:1;align-self:end;padding-bottom:6px">
      <div style="font-size:13px;font-weight:500;color:${dim.ink4};margin-bottom:2px">Programs</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:42px;font-weight:700;letter-spacing:-1.5px;line-height:1">${totalProg}</span>
        <span style="font-size:18px;color:${dim.ink3};font-weight:500">routes</span>
        <span style="display:inline-flex;align-items:center;background:${SVG_PINK.accent};color:white;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600">▴ ${openToday} เปิดวันนี้</span>
      </div>
      <div style="font-size:11px;color:${dim.ink3}">${tlCount} Tub Lamu · ${vpCount} Visit Panwa${(groups.ranong||[]).length?` · ${(groups.ranong||[]).length} Ranong`:''}</div>
    </div>
    <div style="grid-column:2;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dim.line}">
      <div style="font-size:10px;color:${dim.ink3}">Open Today</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2;color:#0F6E56">${openToday}</span><span style="font-size:11px;color:${dim.ink3};font-weight:500">/ ${totalProg}</span></div>
      <div style="font-size:11px;color:#0F6E56;font-weight:600;margin-top:6px">${totalProg?Math.round(openToday/totalProg*100):0}% running</div>
    </div>
    <div style="grid-column:3;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dim.line}">
      <div style="font-size:10px;color:${dim.ink3}">Closed Today</div>
      <div style="font-size:18px;font-weight:700;line-height:1.2;color:#A32D2D;margin-top:2px">${closedToday}</div>
      <div style="font-size:11px;color:${dim.ink3};margin-top:6px">routes</div>
    </div>
    <div style="grid-column:4;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dim.line}">
      <div style="font-size:10px;color:${dim.ink3}">No Data</div>
      <div style="font-size:18px;font-weight:700;line-height:1.2;color:${dim.ink3};margin-top:2px">${noData}</div>
      <div style="font-size:11px;color:${dim.ink3};margin-top:6px">no season set</div>
    </div>
  </div>`;

  const PIER_INFO={
    tublamu:{label:'Tub Lamu Pier',accent:'#0F6E56',bg:'#E1F5EE',color:'#0F6E56'},
    panwa:{label:'Visit Panwa',accent:'#185FA5',bg:'#E6F1FB',color:'#185FA5'},
    ranong:{label:'Ranong Pier',accent:'#BA7517',bg:'#FAEEDA',color:'#854F0B'}
  };

  // Build list panel · §แสดง Ranong ด้วยถ้ามี route (เดิม loop hardcode แค่ tublamu/panwa → route ระนองไม่โผล่)
  let listHtml='';
  ['tublamu','panwa'].concat((groups.ranong||[]).length?['ranong']:[]).forEach(pier=>{
    const rows=groups[pier]||[];
    const pi=PIER_INFO[pier];
    listHtml+=`<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-top:${listHtml?'10px':'0'}">
      <div style="width:28px;height:28px;border-radius:50%;background:${pi.bg};color:${pi.color};display:flex;align-items:center;justify-content:center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600">${pi.label}</div>
        <div style="font-size:10px;color:${dim.ink3}">${rows.length} programs</div>
      </div>
    </div>`;
    if(!rows.length){
      listHtml+=`<div style="padding:14px;font-size:11px;color:${dim.ink3};text-align:center;background:white;border-radius:14px;border:1px dashed ${dim.line};margin-bottom:6px">ยังไม่มีโปรแกรม</div>`;
      return;
    }
    rows.forEach(r=>{
      const cur=getRouteStatusNow(r);
      const isOpen=cur&&cur.type==='open';
      const isClosed=cur&&cur.type==='closed';
      const statusColor=isOpen?'#1D9E75':isClosed?'#A32D2D':dim.ink4;
      const statusLabel=isOpen?'OPEN':isClosed?'CLOSED':'—';
      const statusBg=isOpen?'#E1F5EE':isClosed?'#FCEBEB':'#F4F2EE';
      const statusText=isOpen?'#0F6E56':isClosed?'#A32D2D':dim.ink3;
      const isSel=selProgId===r.id;
      listHtml+=`<div class="route-row-item" data-rid="${r.id}" draggable="true" data-sort-id="${r.id}" data-sortgroup="${pier}" style="background:white;border-radius:12px;border:1px solid ${isSel?dim.ink:dim.line};padding:10px 12px;margin-bottom:6px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:10px;${isSel?'box-shadow:0 0 0 2px rgba(26,26,26,.04)':''}">
        ${LA_GRIP}
        <div style="width:6px;align-self:stretch;background:${r.color||statusColor};border-radius:3px;flex-shrink:0;${!isOpen?'opacity:.4':''}"></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:600;${!isOpen?'color:'+dim.ink2:''}">${r.name}</span>
            <span style="background:${statusBg};color:${statusText};padding:1px 7px;border-radius:9px;font-size:9px;font-weight:600;letter-spacing:.04em">${statusLabel}</span>
          </div>
          <div style="font-size:10px;color:${dim.ink3};margin-top:2px">${r.islands||'—'}</div>
          ${cur?`<div style="font-size:9px;color:${dim.ink3};margin-top:2px;font-family:'DM Mono',monospace">${fmtD(cur.from)} → ${fmtD(cur.to)}</div>`:''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="rri-edit" data-rid="${r.id}" style="background:${dim.bg};border:none;border-radius:8px;padding:5px 8px;cursor:pointer;color:${dim.ink2}" onmouseover="this.style.background='${dim.ink}';this.style.color='white'" onmouseout="this.style.background='${dim.bg}';this.style.color='${dim.ink2}'">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="rri-del" data-rid="${r.id}" style="background:${dim.bg};border:none;border-radius:8px;padding:5px 8px;cursor:pointer;color:${dim.ink2}" onmouseover="this.style.background='#A32D2D';this.style.color='white'" onmouseout="this.style.background='${dim.bg}';this.style.color='${dim.ink2}'">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>`;
    });
  });
  const listPanel=`<div style="background:transparent;border-radius:14px;overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:13px;font-weight:600">โปรแกรมทั้งหมด</span>
      <span style="font-size:10px;color:${dim.ink3}">${totalProg} routes</span>
    </div>
    ${listHtml}
  </div>`;

  // Detail panel placeholder
  const detailPanel=`<div id="prog-detail-mount" style="background:white;border-radius:14px;border:1px solid ${dim.line};overflow:hidden;min-height:400px;position:sticky;top:14px"></div>`;

  wrap.innerHTML=`${headerBar}${kpiStrip}<div style="display:grid;grid-template-columns:380px 1fr;gap:12px;align-items:start">${listPanel}${detailPanel}</div>`;

  // Drag-to-reorder programs (constrained to the same pier)
  laMakeSortable(wrap, '.route-row-item', stApplyRouteOrder);

  // Wire up click handlers
  wrap.querySelectorAll('.route-row-item').forEach(el=>{
    el.addEventListener('click',e=>{
      if(_laDragJustEnded) return;                       // a drag just finished — don't also select the row
      if(e.target.closest('.la-grip')) return;           // grip is for dragging only
      if(e.target.closest('.rri-edit')||e.target.closest('.rri-del')) return;
      selProgId=el.dataset.rid;
      showSeasonForm=false;
      renderSettings();
    });
  });
  wrap.querySelectorAll('.rri-edit').forEach(btn=>{
    btn.addEventListener('click',e=>{e.stopPropagation();openRouteModal(btn.dataset.rid);});
  });
  wrap.querySelectorAll('.rri-del').forEach(btn=>{
    btn.addEventListener('click',e=>{e.stopPropagation();delRoute(btn.dataset.rid);});
  });

  renderProgDetailPink();
}

function renderProgDetailPink(){
  const mount=document.getElementById('prog-detail-mount');
  if(!mount)return;
  const dim={bg:'#F4F2EE',ink:'#1A1A1A',ink2:'#666',ink3:'#999',ink4:'#bbb',ink5:'#ccc',line:'rgba(0,0,0,.04)'};
  const SVG_PINK={accent:'#E03B7E',soft:'#FCE5EC',text:'#9F1B4F'};
  const fmtD=s=>s?new Date(s).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'2-digit'}):'—';

  const r=ROUTES.find(x=>x.id===selProgId);
  if(!r){
    mount.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;color:${dim.ink3};gap:10px">
      <div style="width:48px;height:48px;border-radius:50%;background:${dim.bg};display:flex;align-items:center;justify-content:center;color:${dim.ink4}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      </div>
      <div style="font-size:12px;color:${dim.ink3}">เลือกโปรแกรมเพื่อจัดการ seasons</div>
    </div>`;
    return;
  }

  const cur=getRouteStatusNow(r);
  const isOpen=cur&&cur.type==='open';
  const isClosed=cur&&cur.type==='closed';
  const next=(r.seasons||[]).filter(s=>s.from>TODAY_STR).sort((a,b)=>a.from.localeCompare(b.from))[0];

  const statusColor=isOpen?'#1D9E75':isClosed?'#A32D2D':dim.ink4;
  const statusBg=isOpen?'#E1F5EE':isClosed?'#FCEBEB':'#F4F2EE';
  const statusText=isOpen?'#0F6E56':isClosed?'#A32D2D':dim.ink3;
  const statusLabel=isOpen?'OPEN':isClosed?'CLOSED':'NO DATA';

  // Header strip (pink gradient like other detail pages)
  const headerStrip=`<div style="padding:16px 20px;border-bottom:1px solid rgba(0,0,0,.06);background:linear-gradient(to right,#FFF5EC 0%,#FBEAF0 60%,#F5DDE6 100%)">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:50px;height:50px;border-radius:12px;background:${r.color||statusColor};color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:20px;font-weight:700">${r.name}</span>
          <span style="background:${statusBg};color:${statusText};padding:2px 9px;border-radius:11px;font-size:10px;font-weight:600;letter-spacing:.04em">${statusLabel}</span>
        </div>
        <div style="font-size:11px;color:${dim.ink2};margin-top:3px">${r.pier==='tublamu'?'Tub Lamu Pier':r.pier==='panwa'?'Visit Panwa':r.pier} · ${r.islands||'—'}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="openRouteModal('${r.id}')" style="background:${dim.ink};color:white;border:none;border-radius:20px;padding:7px 16px;font-size:11px;font-weight:600;cursor:pointer">Edit</button>
        ${progEditMode
          ? `<button onclick="toggleProgEdit(false)" style="background:#0F6E56;color:white;border:none;border-radius:20px;padding:7px 16px;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(15,110,86,.25)">✓ Done</button>`
          : `<button onclick="toggleProgEdit(true)" style="background:white;color:#6B7785;border:1px solid #DDE2DE;border-radius:20px;padding:7px 14px;font-size:11px;font-weight:600;cursor:pointer">✎ Modify</button>`
        }
      </div>
    </div>
    ${cur?`<div style="margin-top:10px;padding:8px 12px;background:rgba(255,255,255,.6);border-radius:8px;font-size:11px;color:${dim.ink2};border-left:3px solid ${statusColor}"><span style="font-weight:600;color:${dim.ink}">ปัจจุบัน: </span>${cur.type==='open'?'Open':'Closed'} · ${fmtD(cur.from)} → ${fmtD(cur.to)}${next?` · ถัดไป ${next.type==='open'?'Open':'Closed'} ${fmtD(next.from)}`:''}</div>`:''}
    ${progEditMode
      ? `<div style="margin-top:10px;padding:8px 12px;background:#FFF6E5;border:1px solid #F0D9A0;border-radius:8px;font-size:11px;color:#A05A1A;display:flex;align-items:center;gap:7px;font-weight:600">✎ Edit mode · changes affect bookings &amp; boat assignments</div>`
      : `<div style="margin-top:10px;padding:8px 12px;background:rgba(255,255,255,.7);border:1px solid #DDE2DE;border-radius:8px;font-size:11px;color:#6B7785;display:flex;align-items:center;gap:7px">🔒 Read-only · click <b style="color:#1A2A33">Modify</b> to enable edits</div>`
    }
  </div>`;

  // Seasons list
  const seasons=(r.seasons||[]).slice().sort((a,b)=>a.from.localeCompare(b.from));
  const pastSeasons=seasons.filter(s=>s.to<TODAY_STR);
  const currentSeasons=seasons.filter(s=>s.from<=TODAY_STR&&s.to>=TODAY_STR);
  const futureSeasons=seasons.filter(s=>s.from>TODAY_STR);

  const buildSeasonRow=(s)=>{
    const isCur=s.from<=TODAY_STR&&s.to>=TODAY_STR;
    const isPast=s.to<TODAY_STR;
    const isFuture=s.from>TODAY_STR;
    const dotColor=s.type==='open'?'#1D9E75':'#A32D2D';
    const labelBg=s.type==='open'?'#E1F5EE':'#FCEBEB';
    const labelColor=s.type==='open'?'#0F6E56':'#A32D2D';
    const op=isPast?0.5:1;
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:0.5px solid rgba(0,0,0,.04);background:${isCur?'#FBFAF7':'transparent'};opacity:${op}">
      <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0"></span>
      <span style="background:${labelBg};color:${labelColor};padding:1px 7px;border-radius:9px;font-size:9px;font-weight:600;letter-spacing:.04em;flex-shrink:0">${s.type==='open'?'OPEN':'CLOSED'}</span>
      <span style="font-size:11px;color:${dim.ink};font-family:'DM Mono',monospace;flex:1">${fmtD(s.from)} → ${fmtD(s.to)}</span>
      ${isCur?`<span style="background:#1A1A1A;color:white;padding:1px 7px;border-radius:9px;font-size:9px;font-weight:600;letter-spacing:.04em">CURRENT</span>`:isFuture?`<span style="background:#FCE5EC;color:#9F1B4F;padding:1px 7px;border-radius:9px;font-size:9px;font-weight:600;letter-spacing:.04em">UPCOMING</span>`:''}
      ${progEditMode ? `<button onclick="delSeason('${r.id}','${s.id}')" style="background:${dim.bg};border:none;border-radius:6px;padding:4px 6px;cursor:pointer;color:${dim.ink2};flex-shrink:0" onmouseover="this.style.background='#A32D2D';this.style.color='white'" onmouseout="this.style.background='${dim.bg}';this.style.color='${dim.ink2}'">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>` : ''}
    </div>`;
  };

  // Build sections
  let seasonsHtml='';
  if(currentSeasons.length){
    seasonsHtml+=`<div style="font-size:9px;font-weight:600;color:${dim.ink3};text-transform:uppercase;letter-spacing:.08em;padding:8px 14px 6px;background:#FBFAF7">ปัจจุบัน · CURRENT</div>${currentSeasons.map(buildSeasonRow).join('')}`;
  }
  if(futureSeasons.length){
    seasonsHtml+=`<div style="font-size:9px;font-weight:600;color:${dim.ink3};text-transform:uppercase;letter-spacing:.08em;padding:8px 14px 6px;background:#FBFAF7">กำลังจะมาถึง · UPCOMING (${futureSeasons.length})</div>${futureSeasons.map(buildSeasonRow).join('')}`;
  }
  if(pastSeasons.length){
    seasonsHtml+=`<div style="font-size:9px;font-weight:600;color:${dim.ink3};text-transform:uppercase;letter-spacing:.08em;padding:8px 14px 6px;background:#FBFAF7">ผ่านไปแล้ว · PAST (${pastSeasons.length})</div>${pastSeasons.map(buildSeasonRow).join('')}`;
  }
  if(!seasonsHtml){
    seasonsHtml=`<div style="padding:24px;text-align:center;color:${dim.ink3};font-size:11px">ยังไม่มี season — กดเพิ่มด้านล่าง</div>`;
  }

  // Add form
  const addFormHtml=showSeasonForm?`<div style="padding:14px 16px;background:#FBFAF7;border-top:1px solid rgba(0,0,0,.06)">
    <div style="font-size:11px;font-weight:600;margin-bottom:8px">เพิ่ม Season ใหม่</div>
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <div onclick="setSeasonType('open')" id="sst-open" style="flex:1;padding:8px 10px;text-align:center;border-radius:8px;cursor:pointer;border:1.5px solid #1D9E75;background:#E1F5EE">
        <div style="font-size:11px;font-weight:600;color:#0F6E56;display:flex;align-items:center;justify-content:center;gap:5px"><span style="width:6px;height:6px;border-radius:50%;background:#1D9E75"></span>Open</div>
      </div>
      <div onclick="setSeasonType('closed')" id="sst-closed" style="flex:1;padding:8px 10px;text-align:center;border-radius:8px;cursor:pointer;border:1.5px solid ${dim.line};background:white">
        <div style="font-size:11px;font-weight:600;color:${dim.ink3};display:flex;align-items:center;justify-content:center;gap:5px"><span style="width:6px;height:6px;border-radius:50%;background:${dim.ink4}"></span>Closed</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div><label style="font-size:9px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">วันที่เริ่ม</label><input type="date" id="new-season-from" style="width:100%;margin-top:2px;font-size:11px;padding:5px 7px;border:1px solid ${dim.line};border-radius:6px;font-family:'DM Mono',monospace"></div>
      <div><label style="font-size:9px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">วันที่สิ้นสุด</label><input type="date" id="new-season-to" style="width:100%;margin-top:2px;font-size:11px;padding:5px 7px;border:1px solid ${dim.line};border-radius:6px;font-family:'DM Mono',monospace"></div>
    </div>
    <div style="display:flex;gap:6px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="cancelSeasonForm()" style="font-size:11px;padding:5px 12px;border-radius:14px">ยกเลิก</button>
      <button onclick="saveNewSeasonGuarded('${r.id}')" style="background:${dim.ink};color:white;border:none;border-radius:14px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer">บันทึก Season</button>
    </div>
  </div>`:'';

  // Calendar timeline — full year view, 12 months grid
  const calBase=calMonthStr?new Date(calMonthStr+'-01'):new Date();
  const calYear=calBase.getFullYear();
  const overrideCount=Object.keys(r.overrides||{}).filter(d=>d.startsWith(`${calYear}-`)).length;

  const MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function buildMiniMonth(monthIdx){
    const firstDay=new Date(calYear,monthIdx,1).getDay();
    const daysInMonth=new Date(calYear,monthIdx+1,0).getDate();
    let cells='';
    for(let i=0;i<firstDay;i++) cells+=`<div></div>`;
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${calYear}-${String(monthIdx+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const st=getDayStatus(r,ds);
      const isToday=ds===TODAY_STR;
      const isOverride=r.overrides&&r.overrides[ds];
      let bg='transparent',fg=dim.ink4,brd='transparent';
      if(st){
        if(st.type==='open'){bg='#E1F5EE';fg='#0F6E56';}
        else {bg='#FCEBEB';fg='#A32D2D';}
      }
      if(isOverride) brd=st.type==='open'?'#1D9E75':'#A32D2D';
      if(isToday) brd=dim.ink;
      const dot=isOverride?`<span style="position:absolute;top:1px;right:1px;width:3px;height:3px;border-radius:50%;background:${st.type==='open'?'#1D9E75':'#A32D2D'}"></span>`:'';
      const dayClickHandler = progEditMode ? `onclick="toggleDayOverrideGuarded('${r.id}','${ds}')"` : '';
      const dayCursor = progEditMode ? 'pointer' : 'default';
      const dayHover = progEditMode ? "onmouseover=\"this.style.transform='scale(1.15)';this.style.zIndex='5'\" onmouseout=\"this.style.transform='';this.style.zIndex=''\"" : '';
      cells+=`<div ${dayClickHandler} title="${ds}${isOverride?' · override':''}${progEditMode?'':' · read-only · click Modify to edit'}" style="position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:${isToday?700:500};color:${fg};background:${bg};border:1px solid ${brd};border-radius:3px;cursor:${dayCursor};transition:transform .1s;font-family:'DM Mono',monospace" ${dayHover}>${dot}${d}</div>`;
    }
    const isCurrentMonth=(new Date().getFullYear()===calYear)&&(new Date().getMonth()===monthIdx);
    return `<div style="background:white;border-radius:9px;padding:8px;border:${isCurrentMonth?'1.5px solid '+dim.ink:'1px solid '+dim.line}">
      <div style="font-size:9.5px;font-weight:700;color:${isCurrentMonth?dim.ink:dim.ink2};text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;display:flex;align-items:center;justify-content:space-between">
        <span>${MONTH_NAMES[monthIdx]}</span>
        ${isCurrentMonth?`<span style="background:${dim.ink};color:white;padding:0 5px;border-radius:5px;font-size:7px;letter-spacing:.04em">NOW</span>`:''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;font-size:7px;color:${dim.ink4};text-align:center;margin-bottom:2px;font-weight:600">
        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1.5px">${cells}</div>
    </div>`;
  }

  let monthsHtml='';
  for(let m=0;m<12;m++) monthsHtml+=buildMiniMonth(m);

  const calendarHtml=`<div style="padding:14px 16px;background:white">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:600;color:${dim.ink2};text-transform:uppercase;letter-spacing:.05em">Calendar</span>
        ${overrideCount?`<span style="background:${SVG_PINK.soft};color:${SVG_PINK.text};padding:1px 7px;border-radius:8px;font-size:9px;font-weight:600">${overrideCount} override${overrideCount>1?'s':''}</span>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:5px">
        <button onclick="calNavYear(-1)" style="background:white;border:1px solid ${dim.line};border-radius:7px;padding:4px 6px;cursor:pointer;color:${dim.ink2};display:inline-flex" onmouseover="this.style.background='${dim.ink}';this.style.color='white'" onmouseout="this.style.background='white';this.style.color='${dim.ink2}'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
        <span style="font-size:13px;font-weight:700;min-width:60px;text-align:center;font-family:'DM Mono',monospace">${calYear}</span>
        <button onclick="calNavYear(1)" style="background:white;border:1px solid ${dim.line};border-radius:7px;padding:4px 6px;cursor:pointer;color:${dim.ink2};display:inline-flex" onmouseover="this.style.background='${dim.ink}';this.style.color='white'" onmouseout="this.style.background='white';this.style.color='${dim.ink2}'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
        ${calMonthStr&&new Date().getFullYear()!==calYear?`<button onclick="calResetToday()" style="background:white;border:1px solid ${dim.line};border-radius:7px;padding:4px 9px;cursor:pointer;color:${dim.ink2};font-size:10px;font-weight:600;margin-left:3px">This year</button>`:''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px">${monthsHtml}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:9px;border-top:0.5px solid rgba(0,0,0,.06);font-size:9.5px;color:${dim.ink3};flex-wrap:wrap">
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#E1F5EE"></span>Open</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#FCEBEB"></span>Closed</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#E1F5EE;border:1.5px solid #1D9E75;position:relative;box-sizing:border-box"><span style="position:absolute;top:-1px;right:-1px;width:4px;height:4px;border-radius:50%;background:#1D9E75"></span></span>Override</span>
      <span style="display:inline-flex;align-items:center;gap:4px;margin-left:auto"><span style="width:10px;height:10px;border-radius:3px;border:1.5px solid ${dim.ink};box-sizing:border-box"></span>Today</span>
    </div>
    <div style="margin-top:7px;font-size:9.5px;color:${dim.ink3};font-style:italic">${progEditMode?'คลิกที่วันใดวันหนึ่งเพื่อสลับสถานะ open/closed · ระบบจะเตือนถ้ามี booking ในวันนั้น':'🔒 อยู่ในโหมด Read-only · กดปุ่ม Modify ทางขวาบนเพื่อเริ่มแก้'}</div>
  </div>`;

  mount.innerHTML=`${headerStrip}
    ${calendarHtml}
    <div style="padding:14px 0 0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px 10px">
        <span style="font-size:11px;font-weight:600;color:${dim.ink2};text-transform:uppercase;letter-spacing:.05em">Seasons · ${seasons.length}</span>
        ${progEditMode && !showSeasonForm?`<button onclick="startSeasonForm()" style="background:${SVG_PINK.accent};color:white;border:none;border-radius:14px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>เพิ่ม Season
        </button>`:''}
      </div>
      <div>${seasonsHtml}</div>
      ${addFormHtml}
    </div>`;

  if(showSeasonForm) setSeasonType(addSeasonType);
}

// Legacy fallback (kept for backward compat)
function renderSettingsLegacy(){
  laEnsureSorted(ROUTES);   /* §laSortSync */
  ROUTES.forEach(r=>{ if(groups[r.pier]) groups[r.pier].push(r); });
  const pm={tublamu:{label:'Tub Lamu Pier',dot:'var(--ocean-mid)'},panwa:{label:'Visit Panwa',dot:'var(--green)'},ranong:{label:'Ranong Pier',dot:'var(--amber)'}};
  const fmtD=s=>s?new Date(s).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}):'—';
  let html='';
  ['tublamu','panwa'].forEach(pier=>{
    const rows=groups[pier]||[];
    html+=`<div class="pier-group-hd"><div class="pgd" style="background:${pm[pier].dot}"></div><span class="pgd-label">${pm[pier].label}</span><span class="pgd-count">${rows.length} โปรแกรม</span></div>`;
    if(!rows.length) html+=`<div style="padding:12px 18px;font-size:11px;color:var(--ink-soft)">ยังไม่มีโปรแกรม</div>`;
    rows.forEach(r=>{
      const cur=getRouteStatusNow(r);
      const isOpen=cur&&cur.type==='open';
      const isClosed=cur&&cur.type==='closed';
      const badgeHtml=cur
        ?(isOpen?`<span class="pill pill-green">Open</span>`:`<span class="pill pill-red">Closed</span>`)
        :`<span class="pill pill-gray">ไม่มีข้อมูล</span>`;
      const isSel=selProgId===r.id;
      html+=`<div class="route-row-item${isSel?' selected':''}" data-rid="${r.id}" style="${isSel?'background:var(--ocean-50)':''}">
        <div class="rri-dot" style="background:${r.color};opacity:${isOpen?1:.5}"></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px">
            <div class="rri-name" style="opacity:${isOpen?1:.65}">${r.name}</div>
            ${badgeHtml}
          </div>
          <div class="rri-sub">${r.islands}</div>
          ${cur?`<div style="font-size:10px;color:var(--ink-soft);margin-top:2px;font-family:'DM Mono',monospace">${fmtD(cur.from)} → ${fmtD(cur.to)}</div>`:''}
        </div>
        <div class="row-acts">
          <div class="act-btn rri-edit" data-rid="${r.id}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <div class="act-btn del rri-del" data-rid="${r.id}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></div>
        </div>
      </div>`;
    });
  });
  const listEl=document.getElementById('prog-list-main');
  listEl.innerHTML=html;
  listEl.querySelectorAll('.route-row-item').forEach(el=>{
    el.addEventListener('click',e=>{
      if(e.target.closest('.act-btn')) return;
      selProgId=el.dataset.rid;
      showSeasonForm=false;
      renderSettings();
      renderProgDetail();
    });
  });
  listEl.querySelectorAll('.rri-edit').forEach(btn=>{
    btn.addEventListener('click',e=>{e.stopPropagation();openRouteModal(btn.dataset.rid);});
  });
  listEl.querySelectorAll('.rri-del').forEach(btn=>{
    btn.addEventListener('click',e=>{e.stopPropagation();delRoute(btn.dataset.rid);});
  });
  renderProgDetail();
}

function renderProgDetail(){
  const r=ROUTES.find(x=>x.id===selProgId);
  document.getElementById('prog-detail-empty').style.display=r?'none':'flex';
  const content=document.getElementById('prog-detail-content');
  if(!r){content.style.display='none';return;}
  content.style.display='flex';

  const fmtD=s=>s?new Date(s).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'ไม่กำหนด';
  const cur=getRouteStatusNow(r);
  const next=(r.seasons||[]).filter(s=>s.from>TODAY_STR).sort((a,b)=>a.from.localeCompare(b.from))[0];

  const statusBadge=cur
    ?(cur.type==='open'?`<span class="pill pill-green" style="font-size:11px">🟢 Open วันนี้</span>`:`<span class="pill pill-red" style="font-size:11px">🔴 Closed วันนี้</span>`)
    :`<span class="pill pill-gray" style="font-size:11px">ไม่มีข้อมูลวันนี้</span>`;

  const seasonsHtml=(r.seasons||[]).map(s=>{
    const isCur=s.from<=TODAY_STR&&s.to>=TODAY_STR;
    const dotColor=s.type==='open'?'var(--green)':'var(--red)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid var(--border);background:${isCur?'rgba(45,138,94,.04)':''}">
      <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
      <span style="font-size:11px;font-weight:500;color:${s.type==='open'?'var(--green-dark)':'var(--red)'};width:50px;flex-shrink:0">${s.type==='open'?'Open':'Closed'}</span>
      <span style="font-size:11px;color:var(--ink);font-family:'DM Mono',monospace;flex:1">${fmtD(s.from)} → ${fmtD(s.to)}</span>
      ${isCur?`<span class="pill pill-blue" style="font-size:9px">วันนี้</span>`:''}
      ${progEditMode?`<button class="btn-xs del" onclick="delSeason('${r.id}','${s.id}')">ลบ</button>`:''}
    </div>`;
  }).join('');

  const addFormHtml=showSeasonForm?`
    <div style="padding:12px 16px;background:var(--sand);border-top:1px solid var(--border)">
      <div class="form-label" style="margin-bottom:8px">เพิ่ม Season ใหม่</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <div onclick="setSeasonType('open')" id="sst-open" style="flex:1;padding:6px;text-align:center;border-radius:var(--r-sm);cursor:pointer;border:1px solid var(--green);background:var(--green-light)">
          <div style="font-size:11px;font-weight:500;color:var(--green-dark)">Open</div>
        </div>
        <div onclick="setSeasonType('closed')" id="sst-closed" style="flex:1;padding:6px;text-align:center;border-radius:var(--r-sm);cursor:pointer;border:1px solid var(--border);background:var(--white)">
          <div style="font-size:11px;font-weight:500;color:var(--ink-soft)">Closed</div>
        </div>
      </div>
      <div class="form-2" style="margin-bottom:8px">
        <div><label class="form-label">วันที่เริ่ม</label><input type="date" id="new-season-from" style="width:100%"></div>
        <div><label class="form-label">วันที่สิ้นสุด</label><input type="date" id="new-season-to" style="width:100%"></div>
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="cancelSeasonForm()">ยกเลิก</button>
        <button class="btn btn-primary btn-sm" onclick="saveNewSeasonGuarded('${r.id}')">บันทึก</button>
      </div>
    </div>`:'';

  content.innerHTML=`
    <div style="padding:14px 16px 12px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--ink)">${r.name}</div>
          <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">${r.pier==='tublamu'?'Tub Lamu Pier':'Visit Panwa'}</div>
          <div style="margin-top:6px">${statusBadge}</div>
          ${next?`<div style="font-size:10px;color:var(--ink-soft);margin-top:4px">ถัดไป: ${next.type==='open'?'Open':'Closed'} ${fmtD(next.from)}</div>`:''}
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px 6px">
      <span style="font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft)">Seasons</span>
      <div style="display:flex;gap:6px;align-items:center">
        ${progEditMode
          ? `<button class="btn btn-primary btn-sm" onclick="startSeasonForm()" style="font-size:11px;padding:4px 10px">+ เพิ่ม Season</button>
             <button onclick="toggleProgEdit(false)" style="font-size:11px;padding:5px 12px;background:#0F6E56;color:#fff;border:0;border-radius:14px;cursor:pointer;font-weight:600;font-family:inherit">✓ Done</button>`
          : `<button onclick="toggleProgEdit(true)" style="font-size:11px;padding:5px 12px;background:#fff;color:#6B7785;border:1px solid #DDE2DE;border-radius:14px;cursor:pointer;font-weight:600;font-family:inherit;display:inline-flex;align-items:center;gap:5px">✎ Modify</button>`
        }
      </div>
    </div>
    ${!progEditMode ? `<div style="margin:0 16px 6px;padding:6px 10px;background:#F4F8F5;border:1px solid #DDE2DE;border-radius:8px;font-size:10px;color:#6B7785;display:flex;align-items:center;gap:6px">🔒 <span>Read-only · click <b>Modify</b> to enable edits</span></div>` : `<div style="margin:0 16px 6px;padding:6px 10px;background:#FFF6E5;border:1px solid #F0D9A0;border-radius:8px;font-size:10px;color:#A05A1A;display:flex;align-items:center;gap:6px">✎ <span>Edit mode · changes affect bookings & boat assignments</span></div>`}
    <div style="flex:1;overflow-y:auto">
      ${seasonsHtml||'<div style="padding:16px;font-size:12px;color:var(--ink-soft)">ยังไม่มี season</div>'}
    </div>
    ${addFormHtml}
  `;
  if(showSeasonForm) setSeasonType(addSeasonType);
}

function toggleProgEdit(on){
  progEditMode = !!on;
  showSeasonForm = false; // close any open form when toggling
  renderSettings();
}

function startSeasonForm(){showSeasonForm=true;renderSettings();}
function cancelSeasonForm(){showSeasonForm=false;renderSettings();}
function setSeasonType(t){
  addSeasonType=t;
  const o=document.getElementById('sst-open');
  const c=document.getElementById('sst-closed');
  if(!o||!c) return;
  const baseStyle='flex:1;padding:8px 10px;text-align:center;border-radius:8px;cursor:pointer;';
  if(t==='open'){
    o.style.cssText=baseStyle+'border:1.5px solid #1D9E75;background:#E1F5EE';
    o.querySelector('div').style.color='#0F6E56';
    c.style.cssText=baseStyle+'border:1.5px solid rgba(0,0,0,.04);background:white';
    c.querySelector('div').style.color='#999';
  } else {
    c.style.cssText=baseStyle+'border:1.5px solid #A32D2D;background:#FCEBEB';
    c.querySelector('div').style.color='#A32D2D';
    o.style.cssText=baseStyle+'border:1.5px solid rgba(0,0,0,.04);background:white';
    o.querySelector('div').style.color='#999';
  }
}
function saveNewSeason(rid){
  const from=document.getElementById('new-season-from').value;
  const to=document.getElementById('new-season-to').value;
  if(!from||!to){alert('กรุณาระบุวันที่');return;}
  const r=ROUTES.find(x=>x.id===rid);if(!r)return;
  if(!r.seasons) r.seasons=[];
  r.seasons.push({id:'s'+Date.now(),type:addSeasonType,from,to});
  r.seasons.sort((a,b)=>a.from.localeCompare(b.from));
  showSeasonForm=false;
  save('config');renderSettings();
}

// ─── Guarded save: warns if closing dates with existing bookings/assignments ───
function progCountBookingImpact(routeId, from, to){
  // Scan SB_BOOKINGS for trips in range × route
  const affectedBookings = [];
  let totalPax = 0;
  if(typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)){
    SB_BOOKINGS.forEach(bk => {
      if(bk.status === 'cancelled' || bk.status === 'rejected' || bk.status === 'cancelled_weather') return;
      if(bk.schemaVer !== 2 || !Array.isArray(bk.trips)) return;
      bk.trips.forEach(t => {
        if(t.routeId !== routeId) return;
        if(t.date < from || t.date > to) return;
        const pax = (typeof getTripPaxTotal === 'function') ? getTripPaxTotal(t) : ((t.ad||0) + (t.chd||0));
        affectedBookings.push({ bookingId: bk.id, ref: bk.ref || bk.id, date: t.date, pax, leadName: bk.leadPax || '—' });
        totalPax += pax;
      });
    });
  }
  // Scan TRIPS for boat assignments on this route in range
  const affectedTrips = [];
  Object.entries(TRIPS || {}).forEach(([ds, dayOps]) => {
    if(ds < from || ds > to) return;
    Object.entries(dayOps).forEach(([bid, op]) => {
      if(op.route !== routeId) return;
      const boat = (typeof BOATS !== 'undefined') ? BOATS.find(b => b.id === bid) : null;
      affectedTrips.push({ date: ds, boatId: bid, boatName: boat?.name || bid, isCharter: !!op.charterBookingId });
    });
  });
  return { bookings: affectedBookings, totalPax, trips: affectedTrips };
}

function saveNewSeasonGuarded(rid){
  const from=document.getElementById('new-season-from').value;
  const to=document.getElementById('new-season-to').value;
  if(!from||!to){alert('กรุณาระบุวันที่');return;}
  if(from>to){alert('วันที่เริ่มต้องมาก่อนวันที่สิ้นสุด');return;}
  // For OPEN seasons · no impact check needed (opening doesn't hide bookings)
  if(addSeasonType !== 'closed'){
    saveNewSeason(rid);
    return;
  }
  // For CLOSED seasons · check what gets hidden
  const impact = progCountBookingImpact(rid, from, to);
  const r = ROUTES.find(x => x.id === rid);
  const routeName = r?.name || rid;
  if(impact.bookings.length === 0 && impact.trips.filter(t => !t.isCharter).length === 0){
    // Safe · no bookings or non-charter assignments · proceed normally
    saveNewSeason(rid);
    return;
  }
  // Show warning modal
  progShowImpactModal(rid, from, to, routeName, impact);
}

function progShowImpactModal(rid, from, to, routeName, impact){
  // Remove any existing modal
  const existing = document.getElementById('prog-impact-modal');
  if(existing) existing.remove();
  const fmtD = s => s ? new Date(s).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'}) : '—';
  const charterTrips = impact.trips.filter(t => t.isCharter);
  const normalTrips  = impact.trips.filter(t => !t.isCharter);
  const overlay = document.createElement('div');
  overlay.id = 'prog-impact-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",sans-serif';
  const bookingsHTML = impact.bookings.length === 0 ? '' : `
    <div style="margin-top:14px">
      <div style="font-size:11px;font-weight:700;color:#C44A36;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px">⚠ Customer bookings affected · ${impact.bookings.length} · ${impact.totalPax} pax</div>
      <div style="max-height:140px;overflow-y:auto;border:1px solid #F0D5CE;border-radius:8px;background:#FFFAF8">
        ${impact.bookings.slice(0,10).map(b => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid #F5E5E0;font-size:11px">
            <span style="font-weight:600;color:#1A2A33">${b.ref}</span>
            <span style="color:#6B7785;font-family:Manrope,sans-serif">${b.date}</span>
            <span style="color:#C44A36;font-weight:600;font-family:Manrope,sans-serif">${b.pax} pax</span>
          </div>
        `).join('')}
        ${impact.bookings.length > 10 ? `<div style="padding:6px 10px;font-size:10px;color:#6B7785;font-style:italic;text-align:center">+ ${impact.bookings.length - 10} more</div>` : ''}
      </div>
    </div>`;
  const tripsHTML = normalTrips.length === 0 ? '' : `
    <div style="margin-top:12px">
      <div style="font-size:11px;font-weight:700;color:#8A6914;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px">⚠ Boat assignments will be silently lost · ${normalTrips.length}</div>
      <div style="max-height:100px;overflow-y:auto;border:1px solid #F0D9A0;border-radius:8px;background:#FFF6E5">
        ${normalTrips.slice(0,8).map(t => `
          <div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #F0E2C0;font-size:11px">
            <span style="color:#1A2A33">${t.boatName}</span>
            <span style="color:#8A6914;font-family:Manrope,sans-serif">${t.date}</span>
          </div>
        `).join('')}
        ${normalTrips.length > 8 ? `<div style="padding:5px 10px;font-size:10px;color:#6B7785;font-style:italic;text-align:center">+ ${normalTrips.length - 8} more</div>` : ''}
      </div>
    </div>`;
  const charterHTML = charterTrips.length === 0 ? '' : `
    <div style="margin-top:12px;padding:8px 10px;background:#F0E8FB;border:1px solid #D7B5F0;border-radius:8px">
      <div style="font-size:11px;font-weight:700;color:#6B289A;margin-bottom:3px">⚓ ${charterTrips.length} charter booking(s) in this range</div>
      <div style="font-size:10px;color:#6B289A">Charter slots tied to customer bookings · cannot be silently closed · please cancel/reschedule the booking first</div>
    </div>`;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 16px 40px rgba(0,0,0,.18)">
      <div style="padding:18px 20px;border-bottom:1px solid #F0EAE3">
        <div style="display:flex;align-items:center;gap:9px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#FFE2DC;color:#C44A36;font-size:20px">⚠</span>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#C44A36">Close period · impact warning</div>
            <div style="font-size:11px;color:#6B7785;margin-top:2px">${routeName} · ${fmtD(from)} → ${fmtD(to)}</div>
          </div>
        </div>
      </div>
      <div style="padding:18px 20px">
        <div style="font-size:12px;color:#1A2A33;line-height:1.5">Closing this date range will mark <b>${routeName}</b> as off-season. The system will <b>hide existing bookings &amp; boat assignments</b> from the schedule — but the underlying data still exists.</div>
        ${bookingsHTML}
        ${tripsHTML}
        ${charterHTML}
        <div style="margin-top:14px;padding:10px 12px;background:#F4F8F5;border-radius:8px;font-size:11px;color:#1A2A33;line-height:1.5">
          <b style="color:#0F6E56">Recommended:</b> handle the affected bookings <i>before</i> closing — cancel, refund, or reschedule them via Booking page.
        </div>
      </div>
      <div style="padding:14px 20px;background:#FAFBFA;border-top:1px solid #F0EAE3;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="font-size:10px;color:#6B7785">Data stays · only display hides</span>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('prog-impact-modal').remove()" style="padding:8px 18px;border:1.5px solid #C44A36;background:#fff;color:#C44A36;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit" onmouseover="this.style.background='#FFE2DC'" onmouseout="this.style.background='#fff'">Cancel</button>
          <button onclick="progConfirmCloseAnyway('${rid}')" style="padding:8px 18px;background:#C44A36;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;box-shadow:0 2px 6px rgba(196,74,54,.22)">Close anyway</button>
        </div>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function progConfirmCloseAnyway(rid){
  const modal = document.getElementById('prog-impact-modal');
  if(modal) modal.remove();
  saveNewSeason(rid);
}
function delSeason(rid,sid){
  const r=ROUTES.find(x=>x.id===rid);if(!r)return;
  const s=(r.seasons||[]).find(x=>x.id===sid);if(!s)return;
  const fmtD=d=>d?new Date(d).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'2-digit'}):'—';
  const typeLabel=s.type==='open'?'Open':'Closed';
  const msg=`ลบ Season นี้?\n\n${typeLabel} · ${fmtD(s.from)} → ${fmtD(s.to)}\nโปรแกรม: ${r.name}\n\nการลบนี้ไม่สามารถยกเลิกได้`;
  if(!confirm(msg))return;
  r.seasons=(r.seasons||[]).filter(x=>x.id!==sid);
  save('config');renderSettings();
}

let selProgramStatus='active';
function pickProgramStatus(v){selProgramStatus=v;}
function openRouteModal(id){
  editRouteId=id||null;
  const r=id?ROUTES.find(x=>x.id===id):null;
  document.getElementById('route-modal-title').textContent=r?'แก้ไขโปรแกรม':'เพิ่มโปรแกรม';
  document.getElementById('fm-route-name').value=r?r.name:'';
  document.getElementById('fm-route-islands').value=r?r.islands:'';
  timeRows=r?[...r.times]:['08:00'];
  pickLoc(r?r.pier:'tublamu');
  renderTimeRows();
  openModal('route-modal');
  setTimeout(()=>document.getElementById('fm-route-name').focus(),50);
}
function pickLoc(v){
  selLoc=v;
  document.getElementById('loc-tublamu').className='loc-opt'+(v==='tublamu'?' sel-tl':'');
  document.getElementById('loc-panwa').className='loc-opt'+(v==='panwa'?' sel-pn':'');
  document.getElementById('loc-ranong').className='loc-opt'+(v==='ranong'?' sel-rn':'');
}
function renderTimeRows(){
  document.getElementById('fm-times-wrap').innerHTML=timeRows.map((t,i)=>`
    <div class="time-row-inp">
      <input type="time" value="${t}" onchange="timeRows[${i}]=this.value" style="flex:1">
      ${timeRows.length>1?`<div class="rm-time" onclick="removeTime(${i})"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`:''}
    </div>`).join('');
}
function addTimeRow(){timeRows.push('08:00');renderTimeRows();}
function removeTime(i){timeRows.splice(i,1);renderTimeRows();}
function saveRoute(){
  const name=document.getElementById('fm-route-name').value.trim();if(!name)return;
  const islands=document.getElementById('fm-route-islands').value.trim();
  const times=timeRows.filter(t=>t);
  if(editRouteId){
    const r=ROUTES.find(x=>x.id===editRouteId);
    if(r){r.name=name;r.islands=islands;r.times=times;r.pier=selLoc;}
  } else {
    ROUTES.push({id:'r'+Date.now(),name,islands,times,color:ROUTE_COLORS[ROUTES.length%ROUTE_COLORS.length],pier:selLoc,seasons:[]});
  }
  closeModal('route-modal');renderSettings();save('config');
}
function delRoute(id){
  const r=ROUTES.find(x=>x.id===id);if(!r)return;
  const seasonCount=(r.seasons||[]).length;
  const msg=`ลบโปรแกรมนี้?\n\n${r.name}\n${r.islands||''}${seasonCount?`\n\n⚠️ มี ${seasonCount} season ที่จะถูกลบไปด้วย`:''}\n\nการลบนี้ไม่สามารถยกเลิกได้`;
  if(!confirm(msg))return;
  ROUTES=ROUTES.filter(r=>r.id!==id);
  if(selProgId===id) selProgId=null;
  renderSettings();save('config');
}

// ══════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});
});

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
function refreshData(){seed();save();renderDash();}

function exportHTML(){
  // ดึง HTML ของหน้าปัจจุบันจาก DOM (ไม่ใช้ fetch · ทำงานใน artifact preview ได้)
  try {
    // 1. ดึง HTML ทั้งหน้าจาก DOM
    let html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    
    // 2. ดึง LocalStorage ทั้งก้อน
    let dataSnapshot = {};
    try {
      const raw = localStorage.getItem(LS_KEY);
      if(raw) dataSnapshot = JSON.parse(raw);
    } catch(e){ console.error('Export: cannot read LocalStorage', e); }
    
    // 3. แทนที่ DEFAULT_ROUTES / DEFAULT_BOATS (backward compat)
    html=html.replace(
      /const DEFAULT_ROUTES = \[[\s\S]*?\];/,
      `const DEFAULT_ROUTES = ${JSON.stringify(ROUTES,null,2)};`
    );
    html=html.replace(
      /const DEFAULT_BOATS = \[[\s\S]*?\];/,
      `const DEFAULT_BOATS = ${JSON.stringify(BOATS,null,2)};`
    );
    
    // 4. bump DATA_VERSION
    const newVer='export_'+Date.now();
    html=html.replace(
      /const DATA_VERSION = '[^']*';/,
      `const DATA_VERSION = '${newVer}';`
    );
    
    // 5. ฝัง snapshot ของ LocalStorage ทั้งหมด · auto-restore เมื่อเปิดไฟล์
    const snapshotJson = JSON.stringify(dataSnapshot);
    const exportTime = new Date().toISOString();
    const restoreScript = `
<script>
// ════ AUTO-RESTORE FROM EXPORT ════
// ไฟล์นี้ export มาวันที่ ${exportTime}
(function(){
  try {
    var LS_KEY = 'loveandaman_v2';
    var EXPORT_VERSION = '${newVer}';
    var INITIAL_DATA = ${snapshotJson};
    var existing = localStorage.getItem(LS_KEY);
    var shouldRestore = false;
    if(!existing){
      shouldRestore = true;
    } else {
      try {
        var existingData = JSON.parse(existing);
        if(existingData._exportVersion !== EXPORT_VERSION){
          shouldRestore = true;
        }
      } catch(e){ shouldRestore = true; }
    }
    if(shouldRestore){
      INITIAL_DATA._exportVersion = EXPORT_VERSION;
      INITIAL_DATA._exportedAt = '${exportTime}';
      localStorage.setItem(LS_KEY, JSON.stringify(INITIAL_DATA));
      console.log('[Export Restore] โหลด data จาก exported file (' + EXPORT_VERSION + ')');
    }
  } catch(e){
    console.error('[Export Restore] failed:', e);
  }
})();
</` + `script>
`;
    if(html.includes('</head>')){
      html = html.replace('</head>', restoreScript + '</head>');
    } else if(html.includes('<body')){
      html = html.replace(/<body/, restoreScript + '<body');
    } else {
      html = restoreScript + html;
    }
    
    // 6. Download
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const now = new Date();
    const ts = now.toISOString().slice(0,10) + '_' + 
               String(now.getHours()).padStart(2,'0') + 
               String(now.getMinutes()).padStart(2,'0');
    a.download=`loveandaman_${ts}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    
    // 7. แจ้ง user
    const itemCount = Object.keys(dataSnapshot).reduce((sum,k)=> {
      const v = dataSnapshot[k];
      return sum + (Array.isArray(v) ? v.length : 0);
    }, 0);
    const datasetCount = Object.keys(dataSnapshot).filter(k => Array.isArray(dataSnapshot[k])).length;
    const sizeKB = (blob.size / 1024).toFixed(0);
    alert(`✓ Export สำเร็จ\n\nไฟล์: loveandaman_${ts}.html (${sizeKB} KB)\nรวม ${itemCount} รายการใน ${datasetCount} datasets\n\nเปิดไฟล์ที่เครื่องอื่นได้ → data จะ restore อัตโนมัติ`);
  } catch(err){
    console.error('Export failed:', err);
    alert('Export ล้มเหลว: ' + err.message);
  }
}

function resetAllData(){
  if(typeof laIsAdmin==='function' && !laIsAdmin()){ alert('ล้างข้อมูลได้เฉพาะ admin'); return; }   // §guard
  if(!confirm('ล้างข้อมูลทั้งหมดและกลับเป็น demo data ใช่ไหม?')) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

// One-click data backup -> downloads a timestamped JSON to the Downloads folder.
function flBackupData(){
  try{
    if(typeof save==='function') save();
    if(typeof flSave==='function') flSave();
    const raw=localStorage.getItem(LS_KEY)||'{}';
    const n=new Date();
    const ts=n.toISOString().slice(0,10)+'_'+String(n.getHours()).padStart(2,'0')+String(n.getMinutes()).padStart(2,'0');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
    a.download='backup_'+ts+'.json';
    a.click();
    URL.revokeObjectURL(a.href);
    const d=JSON.parse(raw);
    alert('Backup OK: backup_'+ts+'.json\n\nMemos: '+((d.fleet_memos||[]).length)+'   Inventory: '+((d.fleet_inventory||[]).length)+'\n\nNow move this file from Downloads into the data_exports folder.');
  }catch(e){
    alert('Backup failed: '+e.message);
  }
}
// Import a backup JSON (from flBackupData) → overwrites this browser's localStorage[LS_KEY] → reload.
// Lets you move data between origins/devices (e.g. localhost → the Railway URL). One-way snapshot.
function flImportData(){
  if(typeof laIsAdmin==='function' && !laIsAdmin()){ alert('นำเข้าข้อมูลได้เฉพาะ admin'); return; }   // §guard
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=()=>{
    const f=inp.files&&inp.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const txt=String(r.result||'');
        const obj=JSON.parse(txt);
        if(!obj||typeof obj!=='object'||Array.isArray(obj)){ alert('Import failed: ไฟล์นี้ไม่ใช่ข้อมูล backup ที่ถูกต้อง'); return; }
        const nBk=(obj.sb_bookings||[]).length, nAg=(obj.sb_agents||[]).length, nMj=(obj.fleet_maintenance||[]).length;
        if(!confirm('นำเข้าข้อมูลจาก "'+f.name+'"?\n\nBookings: '+nBk+'   Agents: '+nAg+'   Maintenance: '+nMj+'   Datasets: '+Object.keys(obj).length+'\n\n⚠ จะเขียนทับข้อมูลทั้งหมดในเบราว์เซอร์นี้')) return;
        localStorage.setItem(LS_KEY, txt);
        alert('Import OK ✓\n\nกำลังรีโหลดหน้าเพื่อแสดงข้อมูล');
        location.reload();
      }catch(e){ alert('Import failed: '+e.message+'\n\n(ไฟล์ต้องเป็น backup_xxx.json ที่ได้จากปุ่ม Backup)'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

updateDate();
seed();
save();
initOpListeners();
// Defer renderDash until DOMContentLoaded so FL_* arrays (declared in later script tags
// like FL_MAINT, FL_ENGINES) are populated. setTimeout(0) can fire between inline scripts
// in Chrome, causing ReferenceError. DOMContentLoaded is fired only after ALL inline scripts run.
function _safeRenderDash(){ try{ renderDash(); }catch(e){ console.error('renderDash failed:',e); } }
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _safeRenderDash);
else _safeRenderDash();
