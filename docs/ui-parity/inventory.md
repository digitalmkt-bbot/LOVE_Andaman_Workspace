# Legacy UI inventory (lk-inbox `allotment_v2`)

Built by `test/uiparity/inventory.mjs` from the UI parity run in `full2-2026-11-23`. Pages come from legacy's sidebar;
the controls on each are the ones visible when the page opens (an admin login, Bangkok time, 1440×900).
A key is `label|function` with digits as `#`, which is how run.mjs finds the same control in the new frontend.

**76 pages** · 498 toggles · 25 selects · 45 checkboxes · 180 dialog openers.

## Sidebar

| section | page (data-view) | label | in new sidebar |
|---|---|---|---|
| Overview | `dashboard` | Dashboard | yes |
| Overview | `calendar` | Calendar | yes |
| Overview | `daily` | Daily Availability | yes |
| Overview | `execboard` | Executive Board | yes |
| Overview | `actionboard` | Action Board | yes |
| Overview | `guestins` | Guest Insights | yes |
| Operations | `booking` | Booking | yes |
| Operations | `booking#citytour` | Booking – Transfer / City Tour | yes |
| Operations | `reconfirm` | Re-confirm | yes |
| Operations | `bookingflow` | Booking Flow | yes |
| Operations | `doccheck` | ตรวจเอกสาร | yes |
| Operations | `operation` | Boat Operation | yes |
| Operations | `fleetcal` | Fleet Calendar | yes |
| Operations | `insurance` | Insurance | yes |
| Operations | `vehicles` | Transfer Fleet | yes |
| Operations | `vanjobs` | ใบงานรถ (Van Jobs) | yes |
| Operations | `vancheckin` | เช็คอินรถ | yes |
| Operations | `piercheckin` | เช็คอินหน้าท่า | yes |
| Operations | `travelsum` | Travel Summary | yes |
| Operations | `dailyreport` | Daily Report | yes |
| Operations | `pickup-setup` | Pickup time setup | yes |
| Pier Office | `poj-panwa` | ใบงานเรือ | yes |
| Pier Office | `po-panwa` | เบิก-คืนอุปกรณ์ | yes |
| Pier Office | `poa-panwa` | ตารางการทำงาน | yes |
| Pier Office | `pop-panwa` | เงินสดย่อย | yes |
| Pier Office | `pok-panwa` | ตั๋วอุทยาน | yes |
| Pier Office | `pos-panwa` | ยอดขายร้านค้า | **no** |
| Pier Office | `poj-tublamu` | ใบงานเรือ | yes |
| Pier Office | `po-tublamu` | เบิก-คืนอุปกรณ์ | yes |
| Pier Office | `poa-tublamu` | ตารางการทำงาน | yes |
| Pier Office | `pop-tublamu` | เงินสดย่อย | yes |
| Pier Office | `pok-tublamu` | ตั๋วอุทยาน | yes |
| Pier Office | `pos-tublamu` | ยอดขายร้านค้า | **no** |
| Pier Office | `poj-ranong` | ใบงานเรือ | yes |
| Pier Office | `po-ranong` | เบิก-คืนอุปกรณ์ | yes |
| Pier Office | `poa-ranong` | ตารางการทำงาน | yes |
| Pier Office | `pop-ranong` | เงินสดย่อย | yes |
| Pier Office | `pok-ranong` | ตั๋วอุทยาน | yes |
| Pier Office | `pot-ranong` | เอกสาร ตม. | yes |
| Sales | `sales-board` | Sales Board | yes |
| Sales | `b2b-dash` | B2B Dashboard | yes |
| Sales | `agents` | Agent List 813 | yes |
| Sales | `rate-types` | Rate Types | yes |
| Sales | `rate-admin` | Rate Expiry | yes |
| Sales | `contract-tmpl` | Contract Templates | yes |
| Sales | `b2c` | B2C Channels | yes |
| Sales | `staff` | Staff & Welfare | yes |
| Sales | `marketdata` | Demand | yes |
| Sales | `focdetail` | FOC Detail | yes |
| Sales | `pickupmap` | แผนที่จุดรับ | yes |
| Accounting & Finance | `accounting` | Accounting | yes |
| Accounting & Finance | `costing` | ต้นทุน & จุดคุ้มทุน | yes |
| Accounting & Finance | `trippl` | P&L รายทริป | yes |
| Accounting & Finance | `dailypfm` | Daily PFM | yes |
| Accounting & Finance | `vanbill` | วางบิลรถร่วม | yes |
| Accounting & Finance | `prpo` | PR/PO Dashboard | yes |
| Admin | `devlog` | System Log | yes |
| Fleet Management | `fl-projects` | Projects | yes |
| Fleet Management | `fl-maintenance` | Maintenance | yes |
| Fleet Management | `fl-incident` | Job Assignment | yes |
| Fleet Management | `fl-work` | Fleet Work | yes |
| Fleet Management | `fl-dashboard` | FL Dashboard | yes |
| Fleet Management | `fl-deployment` | Fleet Deployment | yes |
| Fleet Management | `fl-boatstatus` | Boat Status | yes |
| Fleet Management | `fl-dailyreport` | Daily Fleet Log | yes |
| Fleet Management | `fl-consumables` | เบิกของใช้ / น้ำมัน | yes |
| Fleet Management | `fl-inventory` | Stock | yes |
| Fleet Management | `fl-fuel` | Fuel · น้ำมัน | yes |
| Fleet Management | `fl-insights` | Fleet Insights | yes |
| Fleet Management | `fl-cost` | Analytics | yes |
| Fleet Management | `fl-asset` | Company Asset | yes |
| Report | `rep-ops` | Operations Report | yes |
| Report | `rep-fleet` | Fleet Report | yes |
| Config | `settings` | Programs | yes |
| Config | `teammkt` | Team & Markets | yes |
| Config | `addonsvc` | Add-on Services | yes |

## Topbar

–

## Toggles, filters and dialogs per page

### Dashboard · `dashboard`

- toggles (19): `⚠ ต้องจัดการ # ›\|dashTodoToggle`, `📅 ปฏิทิน\|dashCalSetView`, `☰ โปรแกรมรายวัน\|dashCalSetView`, `All\|dashCalSetFam`, `Similan Islands\|dashCalSetFam`, `Day Trip - Se La Va\|dashCalSetFam`, `Day Trip - Nyaung Oo Phee Island\|dashCalSetFam`, `Krabi + Phang Nga\|dashCalSetFam`, `Phi Phi Bamboo\|dashCalSetFam`, `Whale Shark Phi Phi Maiton\|dashCalSetFam`, `Transfer\|dashCalSetFam`, `City Tour\|dashCalSetFam`, `Activities\|dashCalSetFam`, `Surin Islands\|dashCalSetFam`, `วัน\|dashBkSetMode`, `เดือน\|dashBkSetMode`, `ปี\|dashBkSetMode`, `# วัน\|dashBkDaySetRange`, `# วัน\|dashBkDaySetRange`
- selects (0): –
- checkboxes (0): –
- dialog openers (2): `รายละเอียดทั้งวัน ›\|dashOpenDayDetail`, `รายละเอียดทั้งวัน ›\|dashOpenDayDetail`

### Calendar · `calendar`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (1): `Boat-level detail →\|calOpenDay`

### Daily Availability · `daily`

- toggles (15): `‹\|changeDA`, `›\|changeDA`, `พรุ่งนี้\|daSetDate`, `วันนี้\|daSetDate`, `ทุกท่า\|daSetPier`, `Tub Lamu\|daSetPier`, `Panwa\|daSetPier`, `Ranong\|daSetPier`, `จ #\|daSetDate`, `อ #\|daSetDate`, `พ #\|daSetDate`, `พฤ #\|daSetDate`, `ศ #\|daSetDate`, `ส #\|daSetDate`, `อา #\|daSetDate`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Executive Board · `execboard`

- toggles (9): `มูฟเมนต์\|ebSet`, `ภาพรวมรายได้\|ebSet`, `Sales Performance\|ebSet`, `Gap to Target\|ebSet`, `เป้าเซลส์\|ebSet`, `TL + Panwa\|ebSet`, `Tub Lamu\|ebSet`, `Panwa\|ebSet`, `Ranong\|ebSet`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –
- only in the new frontend: `ทุกท่า\|ebSet`

### Action Board · `actionboard`

- toggles (17): `All sales\|abSetSales`, `IRIS\|abSetSales`, `P'MAM\|abSetSales`, `NYM\|abSetSales`, `NA NA\|abSetSales`, `MISHA\|abSetSales`, `Ranong\|abSetSales`, `SILAN\|abSetSales`, `LOVE OTA\|abSetSales`, `# days\|abSetDays`, `# days\|abSetDays`, `By sales\|abSetBy`, `By agent\|abSetBy`, `All piers\|abSetPier`, `Tub Lamu#\|abSetPier`, `Visit Panwa#\|abSetPier`, `Ranong#\|abSetPier`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Guest Insights · `guestins`

- toggles (0): –
- selects (1): `giSet [11 options]`
- checkboxes (0): –
- dialog openers (0): –

### Booking · `booking`

- toggles (19): `Calendar\|bkV2SwitchTab`, `By trip · date\|bkV2SwitchTab`, `All bookings\|bkV2SwitchTab`, `Seat Locks\|bkV2SwitchTab`, `รออนุมัติ\|bkV2SwitchTab`, `Cancellations #\|bkV2SwitchTab`, `▦\|bkV2SwitchView`, `▤\|bkV2SwitchView`, `Weekly\|bkV2SetAvgMode`, `Daily\|bkV2SetAvgMode`, `Total\|bkV2SetAvgMode`, `All\|bkV2CalAllFamilies`, `Similan Islands\|bkV2CalToggleFamily`, `Surin Islands\|bkV2CalToggleFamily`, `Phi Phi Bamboo\|bkV2CalToggleFamily`, `Krabi + Phang Nga\|bkV2CalToggleFamily`, `Whale Shark Phi Phi Maiton\|bkV2CalToggleFamily`, `Day Trip - Se La Va\|bkV2CalToggleFamily`, `Day Trip - Nyaung Oo Phee Island\|bkV2CalToggleFamily`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –
- only in the new frontend: `Calendar\|bookingV2SwitchTab`, `By trip · date\|bookingV2SwitchTab`, `All bookings\|bookingV2SwitchTab`, `Seat Locks\|bookingV2SwitchTab`, `รออนุมัติ\|bookingV2SwitchTab`, `Cancellations\|bookingV2SwitchTab`, `▦\|bookingV2SwitchView`, `▤\|bookingV2SwitchView`, `All\|bookingV2CalAllFamilies`, `Similan Islands\|bookingV2CalToggleFamily`, `Surin Islands\|bookingV2CalToggleFamily`, `Phi Phi Bamboo\|bookingV2CalToggleFamily`, `Krabi + Phang Nga\|bookingV2CalToggleFamily`, `Whale Shark Phi Phi Maiton\|bookingV2CalToggleFamily`, `Day Trip - Se La Va\|bookingV2CalToggleFamily`, `Day Trip - Nyaung Oo Phee Island\|bookingV2CalToggleFamily`

### Booking – Transfer / City Tour · `booking#citytour`

- toggles (6): `Calendar\|bkV2SwitchTab`, `By trip · date\|bkV2SwitchTab`, `All bookings\|bkV2SwitchTab`, `Seat Locks\|bkV2SwitchTab`, `รออนุมัติ\|bkV2SwitchTab`, `Cancellations #\|bkV2SwitchTab`
- selects (0): –
- checkboxes (0): –
- dialog openers (1): `ระบุเหตุผล\|cxwOpen`
- only in the new frontend: `Calendar\|bookingV2SwitchTab`, `By trip · date\|bookingV2SwitchTab`, `All bookings\|bookingV2SwitchTab`, `Seat Locks\|bookingV2SwitchTab`, `รออนุมัติ\|bookingV2SwitchTab`, `Cancellations #\|bookingV2SwitchTab`, `▦\|bookingV2SwitchView`, `▤\|bookingV2SwitchView`, `Weekly\|bookingV2SetAvgMode`, `Daily\|bookingV2SetAvgMode`, `Total\|bookingV2SetAvgMode`, `All\|bookingV2CalAllFamilies`, `Transfer\|bookingV2CalToggleFamily`, `City Tour\|bookingV2CalToggleFamily`, `Activities\|bookingV2CalToggleFamily`

### Re-confirm · `reconfirm`

- toggles (4): `▲ ซ่อน\|rcLegendToggle`, `🎨 สีสถานะ\|rcColorPanel`, `By agent\|rcSetView`, `By trip\|rcSetView`
- selects (0): –
- checkboxes (15): `rcPickAll`, `rcPick`, `rcPickAll`, `rcPick`, `rcPick`, `rcPick`, `rcPick`, `rcPick`, `rcPick`, `rcPick`, `rcPickAll`, `rcPick`, `rcPick`, `rcPick`, `rcPick`
- dialog openers (40): `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`, `Sheet\|rcSheet`

### Booking Flow · `bookingflow`

- toggles (3): `Day\|bfSetMode`, `Week\|bfSetMode`, `Month\|bfSetMode`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### ตรวจเอกสาร · `doccheck`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Boat Operation · `operation`

- toggles (80): `All piers\|bop2SetPier`, `Tub Lamu\|bop2SetPier`, `Visit Panwa\|bop2SetPier`, `Ranong\|bop2SetPier`, `Week\|bop2SetViewMode`, `Month\|bop2SetViewMode`, `ลากจัดเรือ\|bopDToggle`, `ที่นั่งไม่พอ · ดูเฉพาะ #\|bop2OvfToggle`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `·\|bop2SelectCell`, `#\|bop2SelectCell`, `·\|bop2SelectCell`, `·\|bop2SelectCell`, `·\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell`, `#\|bop2SelectCell` … +40
- selects (0): –
- checkboxes (0): –
- dialog openers (2): `ประวัติ · ทะเลแบบไหนออกได้\|wxOpenHist`, `ดูรายชั่วโมงทุกเส้นทาง\|wxOpenPop`
- only in the new frontend: `+ Bulk actions\|bop2ShowBulkMenu`, `Cancelled trips\|tcxHistOpen`

### Fleet Calendar · `fleetcal`

- toggles (8): `# days\|fcSetMode`, `# days\|fcSetMode`, `Month\|fcSetMode`, `All piers\|fcSetPier`, `Tub Lamu\|fcSetPier`, `Visit Panwa\|fcSetPier`, `Ranong\|fcSetPier`, `In Shop\|fcSetPier`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Insurance · `insurance`

- toggles (0): –
- selects (1): `select [2 options]`
- checkboxes (0): –
- dialog openers (0): –

### Transfer Fleet · `vehicles`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### ใบงานรถ (Van Jobs) · `vanjobs`

- toggles (0): –
- selects (1): `vanJobsSetRoute [9 options]`
- checkboxes (15): `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`, `event.stopPropagation`
- dialog openers (0): –

### เช็คอินรถ · `vancheckin`

- toggles (3): `ทุกท่า#\|vckSetPier`, `ทับละมุ#\|vckSetPier`, `พันวา#\|vckSetPier`
- selects (8): `event.stopPropagation [5 options]`, `event.stopPropagation [5 options]`, `event.stopPropagation [5 options]`, `event.stopPropagation [5 options]`, `event.stopPropagation [5 options]`, `event.stopPropagation [5 options]`, `event.stopPropagation [5 options]`, `event.stopPropagation [5 options]`
- checkboxes (0): –
- dialog openers (0): –

### เช็คอินหน้าท่า · `piercheckin`

- toggles (49): `ทุกท่า#\|pckSetPier`, `ทับละมุ#\|pckSetPier`, `พันวา#\|pckSetPier`, `เรือ\|pckSetGrp`, `รถ\|pckSetGrp`, `ตาราง\|pckSetView`, `การ์ด\|pckSetView`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation`, `✎ โน้ต\|event.stopPropagation`, `+ อาหารพิเศษ\|event.stopPropagation` … +9
- selects (1): `pck-van [58 options]`
- checkboxes (0): –
- dialog openers (0): –

### Travel Summary · `travelsum`

- toggles (17): `ทั้งหมด#\|tsPickVat`, `มี VAT#\|tsPickVat`, `ไม่มี VAT#\|tsPickVat`, `ตรวจแล้ว #\|tsGoDoc`, `ตรวจแล้ว #\|tsGoDoc`, `ตรวจแล้ว #\|tsGoDoc`, `ตรวจแล้ว #\|tsGoDoc`, `ตรวจแล้ว #\|tsGoDoc`, `ยังไม่แนบ\|tsGoDoc`, `ทั้งหมด#\|tsManPick`, `มีเงินเก็บหน้าท่า#\|tsManPick`, `มี Add-on / อาหาร#\|tsManPick`, `คำขอพิเศษ#\|tsManPick`, `ยังไม่ตัดสินหักบิล#\|tsManPick`, `ยกเลิก / เลื่อนวัน#\|tsManPick`, `📎 บัตรเครดิต ฿#\|event.stopPropagation`, `📎 โอนเงิน ฿#,#\|event.stopPropagation`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Daily Report · `dailyreport`

- toggles (7): `ภาพรวม\|drTab`, `ผู้โดยสาร\|drTab`, `เรือ\|drTab`, `รถรับส่ง\|drTab`, `การเงิน\|drTab`, `วันเดินทาง\|drTrendMode`, `วันที่ลงบุคกิ้ง\|drTrendMode`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Pickup time setup · `pickup-setup`

- toggles (4): `📅 Schedule Profiles\|psuSetTab`, `📍 Pickup Areas\|psuSetTab`, `⏱ Time Matrix\|psuSetTab`, `🏨 ชื่อโรงแรมซ้ำ\|psuSetTab`
- selects (0): –
- checkboxes (0): –
- dialog openers (4): `+ New blank profile\|psuOpenNewProfile`, `+ Clone latest as next season\|psuOpenNewProfile`, `Editing\|psuOpenProfileMatrix`, `Clone\|psuOpenCloneProfile`

### ใบงานเรือ · `poj-panwa`

- toggles (3): `#\|pjWide`, `# ลำ\|pjWide`, `#\|pjWide`
- selects (1): `pjWcSet [8 options]`
- checkboxes (0): –
- dialog openers (0): –

### เบิก-คืนอุปกรณ์ · `po-panwa`

- toggles (8): `ทั้งหมด (#)\|poCatSet`, `ตีนกบ (#)\|poCatSet`, `ผ้าเช็ดตัว (#)\|poCatSet`, `เสื้อชูชีพ (#)\|poCatSet`, `หน้ากาก (#)\|poCatSet`, `ท่อดำน้ำ (#)\|poCatSet`, `แพยาง (#)\|poCatSet`, `อะไหล่ซ่อมหน้ากาก (#)\|poCatSet`
- selects (1): `po-who [10 options]`
- checkboxes (0): –
- dialog openers (0): –

### ตารางการทำงาน · `poa-panwa`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### เงินสดย่อย · `pop-panwa`

- toggles (0): –
- selects (0): –
- checkboxes (1): `pc-selall`
- dialog openers (0): –

### ตั๋วอุทยาน · `pok-panwa`

- toggles (2): `รายวัน\|pkSetView`, `ภาพรวมเดือน\|pkSetView`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### ยอดขายร้านค้า · `pos-panwa`

- toggles (5): `Tub Lamu\|pslGoPier`, `Phuket · Visit Panwa\|pslGoPier`, `บันทึกรายวัน\|pslTab`, `วิเคราะห์\|pslTab`, `ทะเบียนสินค้า\|pslTab`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –
- only in the new frontend: `📅 Schedule Profiles\|psuSetTab`, `📍 Pickup Areas\|psuSetTab`, `⏱ Time Matrix\|psuSetTab`, `🏨 ชื่อโรงแรมซ้ำ\|psuSetTab`

### ใบงานเรือ · `poj-tublamu`

- toggles (3): `#\|pjWide`, `# ลำ\|pjWide`, `#\|pjWide`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### เบิก-คืนอุปกรณ์ · `po-tublamu`

- toggles (8): `ทั้งหมด (#)\|poCatSet`, `ตีนกบ (#)\|poCatSet`, `ผ้าเช็ดตัว (#)\|poCatSet`, `เสื้อชูชีพ (#)\|poCatSet`, `หน้ากาก (#)\|poCatSet`, `ท่อดำน้ำ (#)\|poCatSet`, `อะไหล่ซ่อมหน้ากาก (#)\|poCatSet`, `ตีนกบเด็ก (#)\|poCatSet`
- selects (1): `po-who [64 options]`
- checkboxes (0): –
- dialog openers (0): –

### ตารางการทำงาน · `poa-tublamu`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### เงินสดย่อย · `pop-tublamu`

- toggles (1): `เรือหางยาว\|pcTab`
- selects (0): –
- checkboxes (1): `pc-selall`
- dialog openers (0): –

### ตั๋วอุทยาน · `pok-tublamu`

- toggles (2): `รายวัน\|pkSetView`, `ภาพรวมเดือน\|pkSetView`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### ยอดขายร้านค้า · `pos-tublamu`

- toggles (14): `Tub Lamu\|pslGoPier`, `Phuket · Visit Panwa\|pslGoPier`, `บันทึกรายวัน\|pslTab`, `วิเคราะห์\|pslTab`, `ทะเบียนสินค้า\|pslTab`, `ทั้งหมด #\|pslRegSet`, `Rashguard #\|pslRegSet`, `Hat #\|pslRegSet`, `Beach Shoe #\|pslRegSet`, `Swim #\|pslRegSet`, `Waterproof Bag #\|pslRegSet`, `T-shirt #\|pslRegSet`, `Dry Bag #\|pslRegSet`, `Tote Bag #\|pslRegSet`
- selects (1): `pslRegSet [76 options]`
- checkboxes (0): –
- dialog openers (0): –
- only in the new frontend: `ตั๋วอุทยาน\|pkSetView`, `เบิก-คืนอุปกรณ์\|poGoView`, `เงินสดย่อย\|poGoView`, `รายวัน\|pkSetView`, `ภาพรวมเดือน\|pkSetView`, `ยุบเป็นวัน\|pkOvSetBoats`, `แยกตามลำ\|pkOvSetBoats`

### ใบงานเรือ · `poj-ranong`

- toggles (3): `#\|pjWide`, `# ลำ\|pjWide`, `#\|pjWide`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### เบิก-คืนอุปกรณ์ · `po-ranong`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –
- only in the new frontend: `ทั้งหมด (#)\|poCatSet`, `ตีนกบ (#)\|poCatSet`, `ผ้าเช็ดตัว (#)\|poCatSet`, `หน้ากาก (#)\|poCatSet`

### ตารางการทำงาน · `poa-ranong`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### เงินสดย่อย · `pop-ranong`

- toggles (1): `เรือหางยาว\|pcTab`
- selects (0): –
- checkboxes (1): `pc-selall`
- dialog openers (0): –

### ตั๋วอุทยาน · `pok-ranong`

- toggles (7): `ตั๋วอุทยาน\|pkSetView`, `เบิก-คืนอุปกรณ์\|poGoView`, `เงินสดย่อย\|poGoView`, `รายวัน\|pkSetView`, `ภาพรวมเดือน\|pkSetView`, `ยุบเป็นวัน\|pkOvSetBoats`, `แยกตามลำ\|pkOvSetBoats`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### เอกสาร ตม. · `pot-ranong`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Sales Board · `sales-board`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### B2B Dashboard · `b2b-dash`

- toggles (0): –
- selects (1): `b2dSet [5 options]`
- checkboxes (0): –
- dialog openers (0): –

### Agent List 813 · `agents`

- toggles (4): `⚠ Needs action # ›\|agHdPopToggle`, `Card\|agSetView`, `Table\|agSetView`, `∅\|agToggleFilterPop`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Rate Types · `rate-types`

- toggles (0): –
- selects (1): `rtSetOwner [9 options]`
- checkboxes (0): –
- dialog openers (1): `New Rate Type\|rtOpenNew`

### Rate Expiry · `rate-admin`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Contract Templates · `contract-tmpl`

- toggles (0): –
- selects (0): –
- checkboxes (12): `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`, `cttSetSection`
- dialog openers (0): –

### B2C Channels · `b2c`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Staff & Welfare · `staff`

- toggles (4): `ทะเบียน\|staffSetTab`, `ทริปพนักงาน #\|staffSetTab`, `ของบริษัท\|staffSetTab`, `+ เพิ่มพนักงาน\|staffAdd`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Demand · `marketdata`

- toggles (7): `Overview\|mdSetTab`, `① Forecast\|mdSetTab`, `② Market Gap\|mdSetTab`, `③ Season & Pricing\|mdSetTab`, `④ Ops & Guides\|mdSetTab`, `⑤ Sales & Agents\|mdSetTab`, `⑥ Agents\|mdSetTab`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### FOC Detail · `focdetail`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### แผนที่จุดรับ · `pickupmap`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Accounting · `accounting`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (40): `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`

### ต้นทุน & จุดคุ้มทุน · `costing`

- toggles (9): `สูตรกลาง\|ctSetTab`, `ราคาจริง\|ctSetTab`, `เรือเช่า\|ctSetTab`, `ปรับ / ปิด รายแผน\|ctSetTab`, `ทุกท่า\|ctPierSet`, `Visit Panwa\|ctPierSet`, `Tub Lamu\|ctPierSet`, `Ranong\|ctPierSet`, `เพิ่มเส้นทาง / แผนคำนวณ\|ctAddPlan`
- selects (3): `ctPlanSet [62 options]`, `ctPlanSet [2 options]`, `ctPlanSet [33 options]`
- checkboxes (0): –
- dialog openers (0): –

### P&L รายทริป · `trippl`

- toggles (19): `Daily\|pxTab`, `Monthly\|pxTab`, `Analysis\|pxTab`, `Forecast\|pxTab`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `ไม่ได้ออก · กดถ้าออกจริง\|pxRan`, `ไม่ได้ออก · กดถ้าออกจริง\|pxRan`, `ไม่ได้ออก · กดถ้าออกจริง\|pxRan`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`, `Actuals on #\|pxClose`
- selects (1): `pxPier [4 options]`
- checkboxes (0): –
- dialog openers (0): –

### Daily PFM · `dailypfm`

- toggles (0): –
- selects (1): `pfm-filter [7 options]`
- checkboxes (0): –
- dialog openers (40): `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`, `View\|acctOpenDoc`

### วางบิลรถร่วม · `vanbill`

- toggles (5): `ภาพรวม\|vbMode`, `รายเจ้า\|vbMode`, `#–#\|vbPick`, `#–#\|vbPick`, `#–#\|vbPick`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### PR/PO Dashboard · `prpo`

- toggles (8): `วันนี้\|ppQuick`, `‹\|ppSlide`, `›\|ppSlide`, `# วัน\|ppQuick`, `# วัน\|ppQuick`, `เดือนนี้\|ppMonth`, `เดือนหน้า\|ppMonth`, `🖨 พิมพ์ / PDF\|ppPrint`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### System Log · `devlog`

- toggles (0): –
- selects (1): `devlog-tag [3 options]`
- checkboxes (0): –
- dialog openers (0): –

### Projects · `fl-projects`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Maintenance · `fl-maintenance`

- toggles (5): `Overview\|flNavGo`, `Job Assignment\|flNavGo`, `Maintenance\|flNavGo`, `Projects\|flNavGo`, `Filter ▾\|maintToggleFilterPanel`
- selects (0): –
- checkboxes (0): –
- dialog openers (1): `+ Create job\|flOpenCreateJobModal`

### Job Assignment · `fl-incident`

- toggles (5): `Overview\|flNavGo`, `Job Assignment\|flNavGo`, `Maintenance\|flNavGo`, `Projects\|flNavGo`, `Boat ▾\|incToggleFilterPanel`
- selects (0): –
- checkboxes (0): –
- dialog openers (2): `+ Log incident\|flOpenAddIncidentModal`, `+ Create job\|flOpenCreateJobModal`

### Fleet Work · `fl-work`

- toggles (7): `ภาพรวม\|flNavGo`, `แจ้งซ่อม / สั่งงาน\|flNavGo`, `งานซ่อมบำรุง\|flNavGo`, `โปรเจกต์\|flNavGo`, `มีงาน #\|flwBF`, `จอดซ่อม #\|flwBF`, `ทั้งหมด\|flwBF`
- selects (0): –
- checkboxes (0): –
- dialog openers (3): `+ เพิ่มงาน\|flnOpen`, `+ เพิ่มงาน\|flnOpen`, `📄 สรุปงาน\|flwsOpen`

### FL Dashboard · `fl-dashboard`

- toggles (2): `กรุ๊ปตามเรือ\|flBoardSetGroup`, `เรียงใบเดี่ยว\|flBoardSetGroup`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Fleet Deployment · `fl-deployment`

- toggles (80): `# · Pier Placement\|fdTab`, `# · Monthly Deployment\|fdTab`, `# · Repair Runway\|fdTab`, `# · Round Factsheet\|fdTab`, `ทั้งฤดู\|fdSetScope`, `รายเดือน\|fdSetScope`, `รายสัปดาห์\|fdSetScope`, `กำหนดเอง\|fdSetScope`, `ทั้งหมด #\|fdSetOwn`, `เรือบริษัท #\|fdSetOwn`, `เรือเช่า #\|fdSetOwn`, `Aluminous# · Jan # · Tub Lamu\|fdWinPick`, `Aluminous# · Feb # · Tub Lamu\|fdWinPick`, `Aluminous# · Mar # · Tub Lamu\|fdWinPick`, `Aluminous# · Apr # · Tub Lamu\|fdWinPick`, `Aluminous# · May # · Tub Lamu\|fdWinPick`, `Aluminous# · Jun # · Tub Lamu\|fdWinPick`, `Aluminous# · Jul # · Tub Lamu\|fdWinPick`, `Aluminous# · Aug # · Tub Lamu\|fdWinPick`, `Aluminous# · Sep # · Tub Lamu\|fdWinPick`, `Aluminous# · Oct # · Tub Lamu\|fdWinPick`, `Aluminous# · Nov # · Tub Lamu\|fdWinPick`, `Aluminous# · Dec # · Tub Lamu\|fdWinPick`, `Aluminous# · Jan # · Tub Lamu\|fdWinPick`, `Aluminous# · Feb # · Tub Lamu\|fdWinPick`, `Aluminous# · Mar # · Tub Lamu\|fdWinPick`, `Aluminous# · Apr # · Tub Lamu\|fdWinPick`, `Aluminous# · May # · Tub Lamu\|fdWinPick`, `Aluminous# · Jun # · Visit Panwa\|fdWinPick`, `Aluminous# · Jul # · Visit Panwa\|fdWinPick`, `Aluminous# · Aug # · Visit Panwa\|fdWinPick`, `Aluminous# · Sep # · Visit Panwa\|fdWinPick`, `Aluminous# · Oct # · Visit Panwa\|fdWinPick`, `Aluminous# · Nov # · Visit Panwa\|fdWinPick`, `Aluminous# · Dec # · Visit Panwa\|fdWinPick`, `LKC# · Jan # · Visit Panwa\|fdWinPick`, `LKC# · Feb # · Visit Panwa\|fdWinPick`, `LKC# · Mar # · Visit Panwa\|fdWinPick`, `LKC# · Apr # · Visit Panwa\|fdWinPick`, `LKC# · May # · Visit Panwa\|fdWinPick` … +40
- selects (1): `fdWinPick [12 options]`
- checkboxes (0): –
- dialog openers (0): –

### Boat Status · `fl-boatstatus`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (2): `เรือเช่า\|openCharterModal`, `+ เพิ่ม\|openCharterModal`

### Daily Fleet Log · `fl-dailyreport`

- toggles (6): `+ Report\|nav`, `ทุกท่า · # ลำ\|flDRSetPier`, `Tub Lamu · # ออก\|flDRSetPier`, `Visit Panwa · # ออก\|flDRSetPier`, `Ranong · # ออก\|flDRSetPier`, `วันนี้\|document.getElementById`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### เบิกของใช้ / น้ำมัน · `fl-consumables`

- toggles (2): `Inventory / Memo\|flNavGo`, `Supplies / Fuel\|flNavGo`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Stock · `fl-inventory`

- toggles (2): `Inventory / Memo\|flNavGo`, `Supplies / Fuel\|flNavGo`
- selects (0): –
- checkboxes (0): –
- dialog openers (40): `+ Receive\|flOpenReceiveStock`, `+ Add item\|flOpenAddStockModal`, `+ Create Memo\|flOpenMemoFromInventory`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`, `+ Receive\|flOpenReceiveOne`

### Fuel · น้ำมัน · `fl-fuel`

- toggles (3): `Cost\|flNavGo`, `Insights\|flNavGo`, `Fuel\|flNavGo`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Fleet Insights · `fl-insights`

- toggles (3): `Cost\|flNavGo`, `Insights\|flNavGo`, `Fuel\|flNavGo`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Analytics · `fl-cost`

- toggles (3): `Cost\|flNavGo`, `Insights\|flNavGo`, `Fuel\|flNavGo`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Company Asset · `fl-asset`

- toggles (7): `Overview\|faGo`, `Boats\|faGo`, `Engines\|faGo`, `Gearboxes\|faGo`, `Propellers\|faGo`, `Batteries\|faGo`, `Safety\|faGo`
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Operations Report · `rep-ops`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Fleet Report · `rep-fleet`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Programs · `settings`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (1): `เพิ่มโปรแกรม\|openRouteModal`

### Team & Markets · `teammkt`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

### Add-on Services · `addonsvc`

- toggles (0): –
- selects (0): –
- checkboxes (0): –
- dialog openers (0): –

## Dialogs declared in allotment_v2.html

60 ids. Dialogs that JS builds at runtime are not here; see the per-page dialog openers above.

`ag-edit-modal`, `agp-addon-modal`, `aos-modal`, `aos-modal-body`, `aos-modal-ttl`, `boat-modal`, `boat-modal-title`, `charter-modal`, `ct-doc-modal`, `ct-wiz-modal`, `fl-eng-modal-title`, `fl-equip-modal-body`, `fl-gb-modal-title`, `fl-insp-modal-sub`, `fl-insp-modal-title`, `fl-modal-add-inv`, `fl-modal-add-spare`, `fl-modal-approve`, `fl-modal-assign-eng`, `fl-modal-assignment`, `fl-modal-create-job`, `fl-modal-edit-boat-status`, `fl-modal-eng-choice`, `fl-modal-engine`, `fl-modal-equip`, `fl-modal-gearbox`, `fl-modal-incident`, `fl-modal-insp`, `fl-modal-inv-edit`, `fl-modal-job-choice`, `fl-modal-maint-close`, `fl-modal-memo`, `fl-modal-memoview`, `fl-modal-move`, `fl-modal-proj-yoy`, `fl-modal-project`, `fl-modal-prop-cascade`, `fl-modal-propeller`, `fl-modal-receive`, `fl-modal-safety`, `fl-modal-start-gear`, `fl-modal-stash`, `fl-modal-swap`, `fl-modal-transfer`, `fl-proj-modal-sub`, `fl-proj-modal-title`, `fl-prop-modal-title`, `fl-safety-modal-title`, `memo-modal-title`, `route-modal`, `route-modal-title`, `rt-modal`, `rt-modal-body`, `status-modal`, `status-modal-title`, `swap-modal`, `tm-modal`, `tm-modal-body`, `tm-modal-ttl`, `vanstop-modal`

