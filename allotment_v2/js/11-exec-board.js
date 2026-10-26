(function(){ /* §ebCost · คำแปล EN ของการ์ดต้นทุน/กำไร ลงพจนานุกรมกลาง (ดู §ebEN) */
  var D={"ต้นทุนตรง": "Direct cost", "กำไรขั้นต้น": "Gross profit", "ของรายได้": "of revenue", "ต่อหัว": "per head", "เป้า": "target", "ขาดทุน": "Loss", "ต้นทุน · กำไร": "Cost · Profit", "ต้นทุนแยกหมวด": "Cost by category", "ที่มา: Trip P&L": "Source: Trip P&L", "ทริป": "trips", "ตัวเลขจริง": "actual", "ประมาณการ": "estimated", "ทริปที่ยังไม่ปิดยอดใช้สูตรจากแผนต้นทุนของเส้นทาง": "open trips use the route cost plan", "หมวด": "Category", "ไม่รวมเงินเดือนประจำ · ค่าเช่า · ประกัน · ซ่อมบำรุง Fleet": "excludes payroll · rent · insurance · fleet maintenance", "กำไรรายโปรแกรม": "Profit by programme", "เรียงจาก margin ต่ำสุด": "lowest margin first", "โปรแกรม": "Programme", "รายได้": "Revenue", "กำไร/หัว": "Profit / head", "เฝ้าระวัง": "Watch", "รวม": "Total", "สีแถบ: เขียว < 70% · ส้ม 70–85% · แดง ≥ 85% ของรายได้ (เกณฑ์เดียวกับ Trip P&L)": "bar: green < 70% · amber 70–85% · red ≥ 85% of revenue (same thresholds as Trip P&L)", "= ต้นทุน ≥ 80% ของรายได้ในช่วงนี้": "= cost ≥ 80% of revenue in this period", "รายได้ vs ต้นทุน · รายวัน": "Revenue vs cost · daily", "30 วันที่ผ่านมา + 14 วันข้างหน้า": "last 30 days + next 14", "ขีดแดง = ต้นทุนของวันนั้น": "red tick = that day's cost", "วันขาดทุน": "loss day", "วันธรรมดา": "weekday", "เสาร์–อาทิตย์": "Sat–Sun", "จองไว้แล้ว · ต้นทุนตามแผน": "booked so far · plan cost", "วันนี้": "Today", "ยังไม่มีทริปในช่วงนี้": "no trips in this period", "ต้นทุน": "Cost", "รายได้ Trip P&L": "Trip P&L revenue", "ตั้งเป้า margin ขั้นต้น (%) · ค่าเดียวทั้งบริษัท": "Gross margin target (%) · one value for the company", "กดเพื่อตั้งเป้า": "click to set target", "ไม่มีต้นทุน": "no cost", "ยังไม่มีข้อมูล": "no data yet", "จากรายได้ Trip P&L": "of Trip P&L revenue", "ต้นทุนรวม": "total cost", "คำนวณจาก Trip P&L รายทริป": "computed from trip-level Trip P&L"};
  try{ if(typeof LA_T_EN!=="object"||!LA_T_EN) window.LA_T_EN={}; Object.keys(D).forEach(function(k){ if(LA_T_EN[k]==null) LA_T_EN[k]=D[k]; }); }catch(e){}
})();
(function(){ /* §ebEN (2026-10-24) · owner "หน้านี้ขอมี Version English ด้วย" · คำแปลของ Executive Board ลงทะเบียนเข้าพจนานุกรมกลาง LA_T_EN (04-data-core.js) · สลับที่ปุ่ม TH/EN ในเมนูซ้าย ซึ่งวาดหน้าที่เปิดอยู่ใหม่ให้เอง */
  var D={
"อาทิตย์": "Sunday",
"จันทร์": "Monday",
"อังคาร": "Tuesday",
"พุธ": "Wednesday",
"พฤหัสบดี": "Thursday",
"ศุกร์": "Friday",
"เสาร์": "Saturday",
"เอเย่นต์": "Agent",
"ออนไลน์": "Online",
"เคาน์เตอร์": "Counter",
"ไม่ระบุ": "Unspecified",
"เดือนนี้": "This month",
"ไตรมาสนี้": "This quarter",
"ปีนี้": "This year",
"วันนี้": "Today",
"ไม่จำกัด": "Unlimited",
"ยังไม่มีใบจอง": "No bookings yet",
"รออนุมัติ": "Pending approval",
"พรุ่งนี้": "Tomorrow",
"เดินทาง": "Travelling",
"ใหม่วันนี้": "New today",
"ที่มา: Booking (By trip)": "Source: Booking (By trip)",
"ผู้โดยสาร": "Passengers",
"ที่": "seats",
"รายได้พรุ่งนี้": "Tomorrow's revenue",
"รอบ": "trips",
"จองเพิ่มวันนี้": "Booked today",
"ใบ": "bookings",
"ยังขายได้": "Still sellable",
"โปรแกรม · รอบ": "Programme · Trip",
"เวลา": "Time",
"ที่นั่ง": "Seats",
"ว่าง": "Open",
"รายได้": "Revenue",
"เต็ม": "Full",
"ยังไม่มีทริปพรุ่งนี้": "No trips tomorrow",
"จองไว้ก่อนวันนี้": "Booked before today",
"ใบจองล่าสุดของพรุ่งนี้": "Latest bookings for tomorrow",
"เรียงจากใหม่สุด": "newest first",
"วันนี้เข้ามาสำหรับพรุ่งนี้": "came in today for tomorrow",
"รายได้ของทริปวันนี้": "Today's trip revenue",
"ที่แล้ว": "ago",
"ปีก่อน": "last year",
"ผู้โดยสารวันนี้": "Passengers today",
"จอง": "Booked",
"เช็คอินหน้าท่าแล้ว": "Checked in at pier",
"ใบ · ขาด/ยกเลิกหน้างาน": "bookings · no-show/cancelled on site",
"ยอดขายที่เข้ามาวันนี้": "Sales received today",
"เฉลี่ย 7 วัน": "7-day avg",
"ยกเลิกวันนี้": "Cancelled today",
"สุทธิ": "Net",
"ยกเลิกหน้างาน": "Cancelled on site",
"มูลค่าประมาณ": "Est. value",
"ยังไม่มี": "None yet",
"เงินเข้าวันนี้": "Cash in today",
"โอน/ชำระ": "Transfer/paid",
"รายการ · เงินสดหน้าท่า": "items · pier cash",
"เช็คอินหน้าท่า": "Pier check-in",
"เดินทางจริง / จอง": "Travelled / booked",
"ขาด": "No-show",
"ไม่มีใบจอง": "No bookings",
"ครบ": "All in",
"ยังไม่เช็คอิน": "Not checked in",
"วันนี้ไม่มีทริป": "No trips today",
"เดินทางจริง": "Travelled",
"ขาด / ยกเลิกหน้างาน": "No-show / cancelled on site",
"อื่น ๆ": "Other",
"ทริปวันนี้ / ยอดขายที่เข้ามาวันนี้": "Today's trips / sales received today",
"ทริปวันนี้": "Today's trips",
"ที่มา: เช็คอินหน้าท่า": "Source: Pier check-in",
"ยอดขายวันนี้ ตามชั่วโมง": "Today's sales by hour",
"วันจอง": "booking date",
"ใบจองที่เข้ามาวันนี้": "Bookings received today",
"ทุกวันเดินทาง · ใหม่สุดก่อน": "all travel dates · newest first",
"ยอดขายวันนี้ตามวันเดินทาง: ถึงพรุ่งนี้": "Today's sales by travel date: by tomorrow",
"ภายใน 7 วัน": "within 7 days",
"ไกลกว่านั้น": "later",
"ยอดขายวันนี้มาจากไหน": "Where today's sales came from",
"เอเย่นต์ที่ส่งยอดวันนี้": "Agents who sent bookings today",
"ที่มา": "Source",
"ยอดขาย": "Sales",
"เซลส์": "Sales rep",
"วันนี้ยังไม่มีใบจองเข้า": "No bookings in yet today",
"เอเย่นต์ประจำที่ยังไม่ส่งยอดวันนี้": "Regular agents quiet today",
"ปกติวันละ": "usually per day",
"เอเย่นต์ประจำส่งยอดมาครบแล้ววันนี้": "All regular agents have sent bookings today",
"ช่องทาง · โปรแกรม": "Channel · Programme",
"ยอดขายวันนี้": "Today's sales",
"ช่องทางขาย": "Sales channel",
"วันเดินทาง)": "travel date)",
"คาดการณ์สิ้น": "Forecast end of",
"นี้": "",
"ได้แล้ว": "so far",
"จองไว้": "booked",
"ครบช่วงแล้ว)": "period complete)",
"ยอดขายที่เข้ามา (วันจอง)": "Sales received (booking date)",
"รายได้เฉลี่ยต่อหัว": "Avg revenue per head",
"จองล่วงหน้า 30 วัน": "Booked 30 days ahead",
"ช่วงเดียวกันปีก่อน": "same period last year",
"ยกเลิก": "Cancelled",
"วันที่ยกเลิก)": "cancel date)",
"สุทธิที่เข้ามา": "Net received",
"จองไว้แล้ว)": "already booked)",
"วันธรรมดา": "Weekdays",
"เสาร์–อาทิตย์": "Sat–Sun",
"จองไว้แล้ว (ยังเพิ่มได้)": "Booked so far (still growing)",
"แนวโน้มรายได้": "Revenue trend",
"รายได้รายวัน · 30 วันที่ผ่านมา + 14 วันข้างหน้า": "Daily revenue · last 30 days + next 14",
"ช่องทาง · ตลาด": "Channel · Market",
"สัดส่วนรายได้": "Revenue share",
"สัญชาติ (รายได้)": "Nationality (revenue)",
"รายได้ตามโปรแกรม · เอเย่นต์": "Revenue by programme · agent",
"โปรแกรม": "Programme",
"ที่มา: Booking · P&amp;L รายทริป": "Source: Booking · Trip P&amp;L",
"สัดส่วน": "Share",
"รายได้/หัว": "Rev/head",
"ยังไม่มีรายได้ในช่วงนี้": "No revenue in this period",
"เอเย่นต์ · Top 5 ตามรายได้": "Agents · Top 5 by revenue",
"ของรายได้": "of revenue",
"ยอดตกเกิน 20% vs ปีก่อน": "down >20% vs last year",
"ส่วนลด · รายได้ที่หลุดมือ": "Discounts · revenue lost",
"ส่วนลดที่ให้ไป": "Discounts given",
"ส่วนลด": "Discount",
"รวม": "Total",
"ของรายได้ทั้งช่วง": "of period revenue",
"รายได้ที่หลุดมือ": "Revenue lost",
"ที่มา: เช็คอิน": "Source: Check-in",
"ยกเลิกเพราะอากาศ": "Weather cancellations",
"มูลค่าประมาณจากราคาต่อหัวของใบนั้น · รายละเอียดค่าปรับดูที่": "Value estimated from that booking's per-head price · penalty details at",
"ไม่มีเซลส์ดูแล": "No sales rep assigned",
"ถึง": "to",
"วัน)": "days)",
"ถึงวันนี้": "to today",
"วัน": "days",
"ส่งยอดเดือนก่อน แต่เดือนนี้ยังเงียบ": "sent bookings last month but quiet this month",
"ส่งยอดใน 4 สัปดาห์ก่อน แต่สัปดาห์นี้เงียบ": "sent bookings in the last 4 weeks but quiet this week",
"ส่งยอดเดือนนี้แล้ว แต่สัปดาห์นี้เงียบ": "sent bookings this month but quiet this week",
"ที่ขายได้ (สุทธิ)": "sold (net)",
"หักยกเลิก": "less cancellations",
"ช่วงก่อน": "prev period",
"ยอดขาย (Value sold)": "Sales (value sold)",
"ใบจอง": "Bookings",
"ของ": "of",
"เอเยนต์ที่ส่งยอด": "Agents sending bookings",
"ใหม่": "new",
"เงียบไป": "gone quiet",
"ของใบที่จองไว้ก่อนช่วงนี้ แล้วยกเลิกในช่วงนี้ · หักออกจาก Pax / ยอดขายแล้ว": "of bookings made before this period and cancelled within it · already deducted from Pax / sales",
"เอเยนต์ส่ง": "Agents sent",
"เอเยนต์ทั้งหมด": "All agents",
"เอเยนต์": "Agents",
"เอเยนต์อันดับ 1": "#1 agent",
"รวมทั้งทีม": "Whole team",
"อันดับเซลส์": "Sales rep ranking",
"ยอดขายตามเซลส์": "Sales by rep",
"นับตามวันที่ใบเข้าระบบ · หักใบเก่าที่ยกเลิกในช่วงนี้ · ไม่นับ": "Counted by date the booking entered the system · old bookings cancelled in the period deducted · excludes",
"ยังไม่มีใบจองในช่วงนี้": "No bookings in this period",
"ต่อวันเทียบ": "per day vs",
"เดือนก่อน (จำนวนวันเท่ากัน)": "last month (same number of days)",
"สัปดาห์ก่อน": "last week",
"เอเยนต์ที่ส่งใบแรกในระบบภายในช่วงนี้ · เงียบไป": "agents whose first booking in the system was within this period · gone quiet",
"เดือน": "month",
"สัปดาห์": "week",
"ต่อวัน)": "per day)",
"ล่าสุด": "latest",
"ก่อนหน้า": "previous",
"ทั้งทีม": "whole team",
"แนวโน้ม 7": "7-day trend",
"ต่อวัน": "per day",
"ยอดขายต่อวัน": "Sales per day",
"เอเยนต์ที่เงียบไป": "Agents gone quiet",
"ราย": "agents",
"ไม่มีเอเยนต์ที่เงียบไป": "No agents gone quiet",
"เอเยนต์ที่ส่งยอดเข้ามา · แยกตามเซลส์": "Agents sending bookings · by sales rep",
"ยกเลิกใบเก่า": "Old bookings cancelled",
"อีก": "another",
"เดือนหน้า": "Next month",
"วันข้างหน้า": "days ahead",
"เดือนเดียวกันปีก่อน": "same month last year",
"วันล่าสุด": "latest days",
"กำหนดโดย": "set by",
"ผู้บริหาร": "management",
"ไม่ระบุตลาด": "Market unspecified",
"ยังมีข้อมูลไม่พอ": "Not enough data yet",
"ตลาด": "Market",
"มัธยฐาน": "median",
"ครึ่งกลาง": "middle half",
"ควรเตือนที่": "alert at",
"ทริป": "trips",
"ของ pax จองภายใน 7 วันก่อนออก · ควรเตือน": "of pax book within 7 days of departure · alert",
"เริ่มกังวลเมื่อเหลือวันน้อยกว่านี้ (1.5": "start worrying below this many days left (1.5",
"จุดที่ลูกค้า 25% แรกจองแล้ว)": "point where the first 25% of customers have booked)",
"อา": "Su",
"จ": "Mo",
"อ": "Tu",
"พ": "We",
"พฤ": "Th",
"ศ": "Fr",
"ส": "Sa",
"ยังไม่มอบหมาย": "Unassigned",
"เงียบ": "Quiet",
"เคยส่ง": "has sent before",
"ล็อก": "Locked",
"ที่ยังไม่ใช้": "unused",
"ถึงเป้าแล้ว": "Target reached",
"ตามแผน": "On plan",
"ใกล้เคียง": "Close",
"ไม่ทัน": "Behind",
"เที่ยว · จอง": "trips · booked",
"เป้า": "target",
"ควรจองแล้ว": "should be booked",
"คาดสุดท้าย": "forecast final",
"คุ้มทุน": "break-even",
"เข้ามาวันนี้": "in today",
"กดเพื่อเปิด": "click to open",
"ต้องหาอีก": "Need",
"จากเป้า": "of target",
"เรือที่วาง": "boats planned",
"เป้า) · จองแล้ว": "target) · booked",
"เฉลี่ย": "avg",
"ที่/วัน": "seats/day",
"ตลอด": "over",
"ควรถึง": "should be at",
"ณ วันนี้ตามเส้นโค้งปกติ": "today on the normal curve",
"ตามหลังเส้นโค้ง": "Behind curve by",
"ตามเส้นโค้งหรือนำหน้า": "On or ahead of curve",
"วันล่าสุดเข้าเฉลี่ย": "latest days averaging",
"ถ้าคงอัตรานี้จะได้": "at this rate you get",
"ถึงเป้า": "reaches target",
"ใกล้เคียงเป้า": "close to target",
"ไม่ถึงเป้า": "short of target",
"เที่ยวที่เสี่ยงไม่เต็ม": "Trips at risk of not filling",
"ตามหลังเส้นโค้งหรือต่ำกว่าคุ้มทุน": "behind curve or below break-even",
"ต่ำกว่าคุ้มทุน (7 วัน)": "Below break-even (7 days)",
"เที่ยว": "trips",
"ขาดรวม": "short by",
"ไม่มี": "none",
"ถ้าเต็มครบตามเป้า": "If filled to target",
"ช่องว่าง": "gap",
"รายได้/หัว ฿": "rev/head ฿",
"วันนี้ถึงเป้า": "daily target met",
"ยังไม่ถึงเป้าวัน": "daily target not met",
"เส้นทาง": "Route",
"ตัวเลข": "number",
"ที่ว่าง · สี": "open seats · colour",
"เทียบเส้นโค้งปกติ · มุมขวา": "vs normal curve · top-right",
"เข้ามาวันนี้ · กดช่องไป": "in today · click a cell for",
"เต็ม / ตามแผน": "Full / on plan",
"ตามทัน": "Catching up",
"ตามหลัง / ต่ำกว่าคุ้มทุน": "Behind / below break-even",
"ไม่มีเรือ": "No boat",
"รอบ/วัน": "trips/day",
"ว่าง · ขาย": "open · sold",
"ยังไม่ได้วางเรือในช่วงนี้": "No boats planned in this period",
"กดเพื่อดูรายเส้นทาง": "click for per-route view",
"รับ": "cap",
"ตามหลัง": "Behind",
"ไม่มีวันว่างในช่วงนี้": "No open days in this period",
"ยังไม่มีเป้าแยกเส้นทาง": "No per-route target yet",
"ต้องได้/วัน": "Need/day",
"วันที่ว่างเยอะ · กดไปขาย": "Days with most open seats · click to sell",
"เอเยนต์ที่ควรติดต่อ": "Agents to contact",
"ช่องว่างแบ่งให้เซลส์": "Gap split among sales reps",
"สัดส่วนที่ผู้บริหารกำหนด": "shares set by management",
"ตามสัดส่วนที่ขายได้ต่อเส้นทาง": "by each rep's share of sales per route",
"ยังไม่มีฐาน": "no base yet",
"กดชื่อดูรายเส้นทาง": "click a name for per-route view",
"แก้สัดส่วน": "Edit shares",
"กำหนดสัดส่วนเอง": "Set shares manually",
"จองแล้ว / เป้า": "Booked / target",
"ยังไม่มีเซลส์ที่ผูกกับใบจอง": "No sales rep linked to any booking yet",
"ขีดดำ": "black tick",
"ควรถึงแล้ว ณ วันนี้": "should have reached by today",
"ของเดือน) · \"วันนี้": "of month) · \"Today",
"ที่นั่งที่คนนั้นปิดได้วันนี้สำหรับเดือนนี้ เทียบกับที่ต้องได้/วัน · เฉลี่ย": "seats that rep closed today for this month vs need/day · avg",
"รอดู": "Wait",
"รวมกับ": "Merge with",
"อีกเที่ยวว่าง": "other trip has",
"ที่ รับได้ทั้ง": "open · can take all",
"คน": "pax",
"แจ้งเซลส์": "Tell sales",
"ตลาดนี้ยังจองช้าได้": "this market still books late",
"ของยอด": "of volume",
"โปร B2": "Promo B2",
"ตลาดหลักจองล่วงหน้าแล้ว เหลือขายหน้างาน": "main market already booked ahead; rest is walk-in",
"ตัดสินใจเที่ยวนี้": "Decide on this trip",
"ต่ำกว่าคุ้มทุนใน 7 วัน หรือเพซไม่ทันใน 3 วัน · เรียงตามวันออก": "below break-even within 7 days or pace behind within 3 · by departure",
"ลดเรือ": "Smaller boat",
"ขาดคุ้มทุน": "short of break-even by",
"ออกใน": "departs in",
"ตัวเลือกที่ไฮไลต์คือข้อเสนอของระบบจากเส้นโค้งและจุดคุ้มทุน · ปุ่มเป็นทางลัด ไม่มีอะไรเกิดขึ้นเอง": "Highlighted option is the system suggestion from curve and break-even · buttons are shortcuts, nothing happens automatically",
"ไม่มีเที่ยวที่ต้องตัดสินใจตอนนี้": "No trips need a decision right now",
"ใครจองล่วงหน้าแค่ไหน": "How far ahead each market books",
"มัธยฐาน · 90 วัน": "median · 90 days",
"ของที่นั่งเข้ามาภายใน 7 วันก่อนออก · วันที่ยังแดงจึงยังมีโอกาส แต่ 7 วันสุดท้ายคือตัวตัดสิน": "of seats arrive within 7 days of departure · red days still have a chance, but the last 7 days decide",
"ต้องมีสิทธิ์แก้ไขส่วน": "Needs edit permission for",
"กำหนดสัดส่วนช่องว่างให้เซลส์": "Set gap shares for sales reps",
"ช่องว่างของแต่ละเส้นทางจะถูกแบ่งเป็นเป้าของเซลส์ตามสัดส่วนนี้ · ไม่กระทบใบจองหรือราคา": "Each route's gap is split into rep targets by these shares · bookings and prices are not affected",
"ปิด": "Close",
"ที่มาของสัดส่วน": "Share source",
"คำนวณให้": "Auto",
"กำหนดเอง": "Manual",
"แก้แล้วบันทึก": "edit and save",
"ใช้ค่านี้ทั้งเดือน · กด \"คำนวณให้\" เมื่อไหร่ก็กลับมาเป็นอัตโนมัติ": "used for the whole month · press \"Auto\" any time to go back to automatic",
"บันทึกล่าสุด": "Last saved",
"ยังไม่เคยกำหนดเอง": "never set manually",
"ช่องว่างเดือนนี้": "Gap this month",
"ที่ · วาง": "seats · planned",
"เป้ารวมของคน": "total target for",
"ที่นั่ง)": "seats)",
"คำนวณ": "auto",
"ไม่มีเซลส์": "No sales reps",
"อัตโนมัติ": "automatic",
"ที่เหลือ": "remaining",
"รวมต่อเส้นทาง": "Total per route",
"ตัวเลขหลัง %": "number after %",
"เป้าที่นั่งของคนนั้นในเส้นทางนั้น (ช่องว่าง": "that rep's seat target on that route (gap",
"สัดส่วน) · ใส่ไม่ครบ 100 กด \"เกลี่ยให้ครบ\" ระบบเติมส่วนที่เหลือตามสัดส่วนเดิม · เกิน 100 บันทึกไม่ได้": "share) · under 100: press \"Fill to 100\" and the rest is spread by the old shares · over 100 cannot be saved",
"เกลี่ยให้ครบ 100%": "Fill to 100%",
"ใช้ค่าคำนวณ": "Use auto values",
"บันทึกสัดส่วน": "Save shares",
"เกิน": "over",
"ยังไม่ได้บันทึก": "not saved yet",
"เกลี่ยให้ครบ 100% แล้ว · ยังไม่ได้บันทึก": "Filled to 100% · not saved yet",
"กลับไปใช้ค่าคำนวณของ": "Back to auto values for",
"แล้ว": "done",
"แล้ว · กำลังส่งขึ้นระบบ": "saved · syncing",
"บันทึกไม่ได้ · ต้องมีสิทธิ์แก้ไขส่วน": "Cannot save · needs edit permission for",
"ทั้งทีมได้": "whole team got",
"ต้องได้": "need",
"ทัน": "on track",
"คน · ใกล้เคียง": "reps · close",
"เหลือ": "left",
"ของเป้าวัน": "of daily target",
"ถึงเป้าเดือนแล้ว": "Monthly target reached",
"เป้า/วัน": "target/day",
"ช่องว่างที่เหลือ": "remaining gap",
"วันที่เหลือ · ปรับทุกเช้า": "days left · updated every morning",
"ทีมทำได้ต่อวัน · 14 วันล่าสุด": "Team per day · last 14 days",
"แท่ง": "bars",
"ที่นั่งที่ปิดได้ (สำหรับ": "seats closed (for",
"เส้น": "line",
"ต้องได้/วัน · เขียว": "need/day · green",
"วันล่าสุด · ถึงเป้าวัน": "latest days · daily target met",
"ที่ · ต้องได้วันละ": "seats · need per day",
"วันละ": "per day",
"ติดต่อ": "Contact",
"ไม่มีวันว่าง": "No open days",
"คัดลอกสรุปส่งไลน์": "Copy summary for LINE",
"ยังไม่มีเป้าของคุณใน": "No target for you in",
"บัญชีนี้ยังไม่ได้ผูกกับเซลส์ (ตั้งใน": "This account is not linked to a sales rep (set in",
"บัญชีผู้ใช้)": "User accounts)",
"ยังไม่มีเซลส์ที่มีเป้าใน": "No sales rep has a target in",
"การ์ดเรียงจากคนที่ตามหลังมากสุด · กรอบแดง": "Cards sorted by who is furthest behind · red border",
"ไม่ทันเป้าวันติดกัน 3 วัน · ตัวเลขมาจากสัดส่วนที่ผู้บริหารกำหนดในหน้า": "missed daily target 3 days running · numbers come from the shares management set on",
"เซลส์กด \"เฉพาะฉัน\" เห็นการ์ดตัวเอง": "reps press \"Only me\" to see their own card",
"คัดลอกแล้ว · วางในไลน์ได้เลย": "Copied · paste into LINE",
"นาที": "min",
"ชม.": "h",
"เมื่อวาน": "yesterday",
"เต็มทุกลำ": "All boats full",
"ลำว่างรวม": "boats · open total",
"โปรแกรมต่ำกว่าคุ้มทุน": "programmes below break-even",
"ทุกลำผ่านจุดคุ้มทุน": "All boats past break-even",
"ยังไม่มีข้อมูลจุดคุ้มทุน": "No break-even data yet",
"ขายได้": "sold",
"ลำออก": "boats out",
"ท่า": "piers",
"วันก่อนหน้า": "Previous day",
"วันถัดไป": "Next day",
"ลำเต็ม": "boats full",
"เมื่อวานเวลาเดียวกัน": "yesterday same time",
"ยกเลิก / เลื่อนออก": "Cancelled / moved out",
"ใบ วันนี้": "bookings today",
"รายได้ยืนยันแล้ว": "Confirmed revenue",
"เส้นทาง · ออก · โซนรับ": "Route · dep · pickup zone",
"เรือ": "Boat",
"ที่นั่ง (ขีด": "seats (tick",
"จุดคุ้มทุน)": "break-even)",
"กำลังรับจอง": "Taking bookings",
"สถานะ": "Status",
"ไม่มีเรือออกวันนี้": "No boats out today",
"ที่ท่านี้": "at this pier",
"เขียว": "green",
"เต็ม · เหลือง": "full · yellow",
"ยังว่างแต่ผ่านคุ้มทุน · แดง": "open but past break-even · red",
"ยังไม่ถึงจุดคุ้มทุน · ลายวิ่ง": "not yet at break-even · stripes",
"ยังรับจองอยู่ · ขีดดำในแถบ": "still taking bookings · black tick in bar",
"จุดคุ้มทุนของโปรแกรม (จาก Trip P&amp;L · เฉพาะ 7 วันข้างหน้า)": "programme break-even (from Trip P&amp;L · next 7 days only)",
"ที่นั่งขายได้": "seats sold",
"ลำ · เต็ม": "boats · full",
"ยังไม่วางเรือ": "No boat planned",
"ขาดอีก": "need",
"ถึงจะคุ้มทุน": "to break even",
"ใบล่าสุด": "latest booking",
"คุ้มแล้ว": "Past break-even",
"ขายได้อีก": "can still sell",
"ทุกเส้นทาง": "All routes",
"ยังไม่มีลำไหนเต็ม · ว่างรวม": "No boat full yet · open total",
"ลำที่ต้องช่วย": "Boats needing help",
"ก่อนเรือออก": "before departure",
"ไม่มี · ทุกลำเต็มหรือผ่านคุ้มทุนแล้ว": "None · every boat is full or past break-even",
"คน · เหมาลำ": "pax · charter",
"ลำ": "boats",
"จุ": "cap",
"เหมา": "Charter",
"ไม่จำกัดที่นั่ง": "unlimited seats",
"เต็มแล้ว · ใบล่าสุด": "Full · latest booking",
"เต็มแล้ว": "Full",
"เงียบมา": "quiet for",
"เหมาลำ": "Charter",
"ต่ำกว่าคุ้มทุน": "Below break-even",
"ยังว่าง": "Open",
"ผ่านแล้ว": "Past break-even",
"มูฟเมนต์บุคกิ้ง": "Booking movement",
"เป้าเซลส์รายวัน": "Daily sales targets",
"ต้องหาอีกเท่าไหร่ถึงเต็มเรือ": "How many more seats to fill the boats",
"รายได้และยอดจอง": "Revenue and bookings",
"มูฟเมนต์": "Movement",
"ภาพรวมรายได้": "Revenue",
"เป้าเซลส์": "Sales targets",
"ทุกคน": "Everyone",
"เฉพาะฉัน": "Only me",
"ช่วงก่อนหน้า": "Previous period",
"ช่วงถัดไป": "Next period",
"ไตรมาส": "Quarter",
"อัปเดต": "updated",
"วาดใหม่ทุก 1 นาที": "refreshes every minute",
"กำลังคำนวณ": "Calculating",
"B2B เอเย่นต์": "B2B agents",
"B2C ออนไลน์": "B2C online",
"เคาน์เตอร์ / walk-in": "Counter / walk-in",
"มีใบเข้าใน 1 ชม.": "booking in the last hour",
"ยุบทั้งหมด": "Collapse all",
"กางทั้งหมด": "Expand all",
"ยุบ": "Collapse",
"กางดู variant": "Show variants",
"รวมทุกโปรแกรม": "All programmes",
"ผู้โดยสารแยก Variant": "Passengers by variant",
"ตามใบจอง · ": "by booking · ",
"ตามใบจอง": "by booking",
"ผู้โดยสารแยก": "Passengers by",
"มีใบจองเข้าภายใน 1 ชม. · ขีดดำในแถบ": "booking within the last hour · black tick in bar",
"มีใบจองเข้าภายใน 1 ชม. · ขีดดำในแถบ = ": "booking within the last hour · black tick in bar = "
};
  try{ if(typeof LA_T_EN!=="object"||!LA_T_EN) window.LA_T_EN={}; Object.keys(D).forEach(function(k){ if(LA_T_EN[k]==null) LA_T_EN[k]=D[k]; }); }catch(e){ try{ console.warn("[ebEN]", e); }catch(_){} }
})();
/* ═══════════════════════════════════════════════════════════════════════
   §execBoard (2026-10-17) · Executive Board  (เมนู Overview › Executive Board)

   owner: "งานใหม่ สร้างที่ Overview · เป็นเหมือน Board แบบ Executive สำหรับผู้บริหาร"
          → รอบสอง "เน้นเรื่องฝั่งรายได้ และมี Live booking ของวันถัดไปด้วย"
          → รอบสาม "ขอดูที่เป็นวันนี้" (มุมมองวันนี้ แยกจากมุมมองเดือน/ไตรมาส/ปี)

   หน้านี้ใช้ดูอย่างเดียว · ไม่เขียนอะไรลง store · ไม่มีช่องกรอก
   ตัวเลขทุกตัวใช้ของกลางที่หน้าอื่นใช้อยู่แล้ว ไม่คิดสูตรเองซ้ำ:
     รายได้ต่อทริป      tsTripAmount(b,t)        (Travel Summary · Trip P&L ใช้ตัวเดียวกัน)
     มูลค่าทั้งใบ        laBkMoney(b)             (ยอดขายตามวันจอง · ยอดยกเลิก)
     เวลาที่ใบเข้าระบบ   _dashBkTs / _dashBkDay   (createdAt เป็นแค่วันที่ ใช้หาชั่วโมงไม่ได้)
     คนที่เดินทางจริง    tsRows(date)             (ใบที่ยกเลิกถูกตัดออกในตัว)
     ขาด/ยกเลิกหน้างาน   ckLostByType(b,date)
     ที่นั่ง             getAllotment(rid,date)
     B2C / ตลาด         laIsB2C(b) · drMarket(b)
     เซลส์ผู้ดูแล         pfmSalesName(b)
   §execNoAR (2026-10-17) · owner "ตัดเรื่องยอดเงินค้างออกก่อน" · ลูกหนี้ / อายุหนี้ / ค้างชำระ / วงเงินเครดิต ไม่แสดงในหน้านี้ (ดูที่ Accounting)

   ⚠ ยังไม่มีในระบบ จึงไม่แสดง (ไม่เดาตัวเลขขึ้นมาเอง):
     เป้ารายได้เป็นเงิน (ที่มีคือเป้า pax ของเซลส์) · เวลาออกเรือจริง (มีแต่เวลาตามโปรแกรม)
   ⚠ "Live" = วาดใหม่ทุก 60 วินาทีจากข้อมูลในเครื่อง ซึ่งระบบ sync กับ server ให้อยู่แล้ว
     และวาดเฉพาะตอนหน้านี้เปิดอยู่ · ตำแหน่งเลื่อนหน้าไม่เด้ง
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var EB = window._eb = window._eb || { per:'today', pier:'', tab:'move', sp:'week', off:0, gp:'h' };   /* §execMove · แท็บแรก = มูฟเมนต์ */   /* §execSales · tab/sp/off · §execGap · gp */
  var CXL = ['cancelled','rejected','cancelled_weather'];
  var NOT_SALE = ['quote','draft'];

  function E(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function ymd(d){ return (typeof bkV2LocalYMD==='function') ? bkV2LocalYMD(d) : d.toISOString().slice(0,10); }
  function dt(ds){ return new Date(ds+'T12:00:00'); }
  function addDays(ds,n){ var d=dt(ds); d.setDate(d.getDate()+n); return ymd(d); }
  function addYears(ds,n){ var d=dt(ds); d.setFullYear(d.getFullYear()+n); return ymd(d); }
  function today(){ return ymd(new Date()); }
  function num(n){ return Math.round(+n||0).toLocaleString('en-US'); }
  function baht(n){ n=+n||0; var a=Math.abs(n), s=n<0?'−':'';
    if(a>=1e6) return s+'฿'+(a/1e6).toFixed(a>=1e7?1:2)+'M';
    if(a>=1e4) return s+'฿'+Math.round(a/1e3)+'K';
    return s+'฿'+num(a); }
  function pct(a,b){ return b>0 ? Math.round(a*100/b) : 0; }
  function chg(cur, base){
    if(!(base>0)) return '<span class="eb-mut">—</span>';
    var p=(cur-base)*100/base;
    if(Math.abs(p)<0.5) return '<span class="eb-mut">±0%</span>';
    return '<span class="'+(p>0?'eb-up':'eb-dn')+'">'+(p>0?'▲ ':'▼ ')+Math.abs(p).toFixed(Math.abs(p)<10?1:0)+'%</span>';
  }
  var TH_DOW=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];   /* §ebEN · แปลตอนเรียก (thDow) ไม่ใช่ตอนโหลด */
  function thD(ds){ var d=dt(ds), M=(typeof laMonAbbr==='function')?laMonAbbr():((typeof laMonAbbrTH==='function')?laMonAbbrTH():null); return d.getDate()+' '+(M?M[d.getMonth()]:(d.getMonth()+1)); }   /* §ebEN · ชื่อเดือนตามภาษาที่เลือก */   /* ชื่อเดือนไทยมีที่เดียวทั้งระบบ (§i18n ข้อ 14) */
  function thDow(ds){ return laT(TH_DOW[dt(ds).getDay()]); }
  function hhmm(ts){ var d=new Date(ts); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

  /* ── อ่านข้อมูล ─────────────────────────────────────────────────────── */
  function route(id){ try{ return (typeof getRoute==='function' && getRoute(id)) || null; }catch(_){ return null; } }
  function fam(rid){ try{ return (typeof bkV2RouteFamily==='function' && bkV2RouteFamily(rid)) || null; }catch(_){ return null; } }
  function famIdx(f){ try{ var i=(_BKV2_FAMILIES||[]).findIndex(function(x){ return x.id===(f&&f.id); }); return i<0?999:i; }catch(_){ return 999; } }
  /* §ebNoRanong (2026-10-23) · owner "ยอดของ Ranong ไม่ควรเอามารวม ควรแยกไป"
     "ทุกท่า" = ท่าที่วิ่งจริง (ทับละมุ + พันวา) · ระนองยังเป็นแผน ยอดว่าง/เป้าของมันทำให้ตัวเลขรวมเพี้ยน
     กดแท็บ Ranong เองถึงจะเห็น · ใช้กับทุกแท็บของบอร์ด (ตัวกรองเดียวกัน) */
  function pierOk(r){ var p=((r&&r.pier)||''); return EB.pier ? (p===EB.pier) : (p!=='ranong'); }
  function pax(t){ return (typeof bkV2PaxAllTot==='function') ? bkV2PaxAllTot((t&&t.pax)||{}) : 0; }
  function paxK(t,k){ return (typeof bkV2PaxTot==='function') ? bkV2PaxTot((t&&t.pax)||{},k) : 0; }
  function amt(b,t){ try{ return +tsTripAmount(b,t)||0; }catch(_){ return 0; } }
  function money(b){ try{ return +laBkMoney(b)||0; }catch(_){ return 0; } }
  function isSale(b){ return b && NOT_SALE.indexOf(b.status)<0 && !(typeof laIsInternalFree==='function' && laIsInternalFree(b)); }
  function isLive(b){ return isSale(b) && CXL.indexOf(b.status)<0; }
  function bkTs(b){ try{ return _dashBkTs(b); }catch(_){ return 0; } }
  function bkDay(b){ try{ return _dashBkDay(b); }catch(_){ return ''; } }
  function hasTime(b){ return (b.history||[]).some(function(h){ return h && h.tag==='Created' && h.at; }); }
  function cxlDay(b){ var a=(b.cancellation&&b.cancellation.at)||b.cancelledAt||''; return a ? ymd(new Date(a)) : ''; }
  function agentName(b){
    if(typeof laIsB2C==='function' && laIsB2C(b)){
      var ch=(typeof laB2CChannel==='function')?laB2CChannel(b):''; return 'Online direct (B2C)'+(ch?' · '+ch:''); }
    var a=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null; return (a&&a.name)||b.agentId||'—';
  }
  function agentKey(b){ return (typeof laIsB2C==='function' && laIsB2C(b)) ? '__b2c' : (b.agentId||'__none'); }
  function chan(b){
    if(typeof laIsB2C==='function' && laIsB2C(b)) return 'b2c';
    var m=(typeof drMarket==='function')?(drMarket(b)||{}):{};
    if(['hpk','hkl','cpk','ckl','walkin'].indexOf(m.id)>=0) return 'ctr';
    return 'b2b';
  }
  var CHAN_LBL_TH={b2b:'B2B เอเย่นต์', b2c:'B2C ออนไลน์', ctr:'เคาน์เตอร์ / walk-in'};   /* §ebEN · แปลตอนใช้ */
  var CHAN_LBL={ get b2b(){ return laT(CHAN_LBL_TH.b2b); }, get b2c(){ return laT(CHAN_LBL_TH.b2c); }, get ctr(){ return laT(CHAN_LBL_TH.ctr); } };
  function natOf(b){ var c=''; try{ c=(typeof mdBkCode==='function')?mdBkCode(b):''; }catch(_){} c=c||b.leadNationality||'';
    var l=''; try{ l=(c && typeof insNatLabel==='function')?insNatLabel(c):''; }catch(_){} return {code:c||'?', name:l||c||laT('ไม่ระบุ')}; }
  function paxTxt(t){ var o=[]; [['ad','A'],['chd','C'],['inf','I'],['foc','F']].forEach(function(k){ var n=paxK(t,k[0]); if(n) o.push(n+k[1]); }); return o.join(' ')||'0'; }
  function famColor(rid){ var f=fam(rid); var r=route(rid); return (f&&f.color)||(r&&r.color)||'#8b909c'; }

  /* ══ §execPerf (2026-10-17) · owner "เวลาคลิกแถบด้านบน ช้ามาก"
     ของเดิมทุกฟังก์ชันกวาด SB_BOOKINGS ทั้งก้อนเอง · หน้า Gap กวาดเป็นสิบ ๆ รอบ (routesOn ต่อวัน · salesShare · curve)
     แล้วยังเรียก getAllotment ซ้ำช่องเดิม และ pxDay (Trip P&L ทั้งวัน) ทุกวันในช่วง
     ตอนนี้: ดัชนีจากการกวาดครั้งเดียว (ใบต่อวันเดินทาง · ต่อวันที่เข้าระบบ · ต่อวันยกเลิก) · getAllotment จำผลไว้
     · pxDay เรียกเฉพาะเที่ยวใน 7 วันข้างหน้า · ทั้งหมดผูกกับตราประทับข้อมูล (บันทึกเมื่อไหร่ · จำนวนใบ · จำนวนวันที่วางเรือ) + 20 วิ
     · คลิกแถบแล้วขึ้นข้อความรอก่อน ค่อยคำนวณในเฟรมถัดไป ปุ่มจึงตอบทันที */
  var _ix=null;
  function stamp(){ var tk=0; try{ tk=Object.keys(TRIPS||{}).length; }catch(_){} return String(window.__savedAt||0)+'|'+((SB_BOOKINGS||[]).length)+'|'+tk+'|'+((typeof SB_SEAT_LOCKS!=='undefined'&&SB_SEAT_LOCKS)?SB_SEAT_LOCKS.length:0); }
  function idx(){
    var st=stamp(), now=Date.now();
    if(_ix && _ix.st===st && now-_ix.at<20000) return _ix;
    var I={st:st, at:now, byDate:{}, dates:[], made:{}, cxl:{}, al:{}, be:{}};
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b) return;
      var sale=isSale(b), live=sale && CXL.indexOf(b.status)<0;
      if(sale){ (b.trips||[]).forEach(function(t){ if(!t||!t.date) return; var L=I.byDate[t.date]; if(!L){ L=I.byDate[t.date]=[]; I.dates.push(t.date); } L.push({b:b, t:t, live:live}); }); }
      if(live){ var d=bkDay(b); if(d){ (I.made[d]=I.made[d]||[]).push(b); } }
      if(CXL.indexOf(b.status)>=0 && sale){ var c=cxlDay(b); if(c){ (I.cxl[c]=I.cxl[c]||[]).push(b); } }
    });
    I.dates.sort();
    _ix=I; return I;
  }
  function datesIn(I, from, to){ var out=[], D=I.dates; for(var i=0;i<D.length;i++){ if(D[i]<from) continue; if(D[i]>to) break; out.push(D[i]); } return out; }
  /* ทุกทริปของใบที่ยังไม่ยกเลิก ภายใต้ตัวกรองท่า · fn(b,t,r) */
  function eachTrip(from, to, fn, withCxl){
    var I=idx();
    datesIn(I, from, to).forEach(function(ds){
      I.byDate[ds].forEach(function(x){
        if(!withCxl && !x.live) return;
        var r=route(x.t.routeId); if(!pierOk(r)) return;
        fn(x.b, x.t, r);
      });
    });
  }
  function eachMade(from, to, fn){ var I=idx(); Object.keys(I.made).forEach(function(d){ if(d<from||d>to) return; I.made[d].forEach(fn); }); }
  function agg(from, to){
    var o={rev:0, pax:0, byFam:{}, byAg:{}, byChan:{b2b:0,b2c:0,ctr:0}, byNat:{}, byDay:{}};
    eachTrip(from, to, function(b,t,r){
      var a=amt(b,t), p=pax(t), f=fam(t.routeId)||{id:'_', name:(r&&r.name)||t.routeId, color:'#8b909c'};
      o.rev+=a; o.pax+=p;
      var F=o.byFam[f.id]=o.byFam[f.id]||{f:f, rev:0, pax:0}; F.rev+=a; F.pax+=p;
      var k=agentKey(b), A=o.byAg[k]=o.byAg[k]||{k:k, name:agentName(b), agentId:b.agentId, rev:0, pax:0, n:0};
      A.rev+=a; A.pax+=p; A.n++;
      o.byChan[chan(b)]+=a;
      var N=natOf(b), NN=o.byNat[N.code]=o.byNat[N.code]||{name:N.name, rev:0}; NN.rev+=a;
      o.byDay[t.date]=(o.byDay[t.date]||0)+a;
    });
    return o;
  }
  /* ยอดขายตามวันจอง (ใบที่เข้าระบบในช่วง) · มูลค่าทั้งใบ */
  function salesIn(from, to){
    var o={val:0, n:0, pax:0, list:[]};
    eachMade(from, to, function(b){
      var ts=(b.trips||[]).filter(function(t){ return t && pierOk(route(t.routeId)); }); if(!ts.length) return;
      o.val+=money(b); o.n++; ts.forEach(function(t){ o.pax+=pax(t); }); o.list.push(b);
    });
    return o;
  }
  function cxlIn(from, to){
    var o={val:0, n:0, pax:0}, I=idx();
    Object.keys(I.cxl).forEach(function(d){ if(d<from||d>to) return; I.cxl[d].forEach(function(b){
      var ts=(b.trips||[]).filter(function(t){ return t && pierOk(route(t.routeId)); }); if(!ts.length) return;
      o.val+=money(b); o.n++; ts.forEach(function(t){ o.pax+=pax(t); });
    }); });
    return o;
  }
  function paymentsOn(ds){
    var v=0, n=0, ag={};
    (typeof SB_PAYMENTS!=='undefined'?SB_PAYMENTS:[]).forEach(function(p){
      if(!p || String(p.date||'').slice(0,10)!==ds) return;
      var a=+p.amount||0; if(p.type==='refund') a=-Math.abs(a); v+=a; n++; if(p.agentId) ag[p.agentId]=1;
    });
    return {v:v, n:n, ag:Object.keys(ag).length};
  }
  function pierCashOn(ds){
    var v=0;
    (SB_BOOKINGS||[]).forEach(function(b){
      (b.pierPayments||[]).forEach(function(p){ if(p && String(p.date||'').slice(0,10)===ds) v+=(+p.amount||0); });
    });
    return v;
  }
  /* ขาด / ยกเลิกหน้างาน / อากาศ ในช่วง (เฉพาะวันที่ผ่านมาแล้ว) */
  function leakage(from, to){
    var o={ns:0, cx:0, nsV:0, cxV:0, wx:0, wxV:0, disc:0, foc:0};
    var end = to<today() ? to : today();
    eachTrip(from, end, function(b,t){
      var L=null; try{ L=ckLostByType(b,t.date); }catch(_){}
      if(!L) return; var bk=pax(t)||1, a=amt(b,t);
      if(L.ns){ o.ns+=L.ns; o.nsV+=a*L.ns/bk; }
      if(L.cxl){ o.cx+=L.cxl; o.cxV+=a*L.cxl/bk; }
    });
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b || b.status!=='cancelled_weather') return;
      (b.trips||[]).forEach(function(t){ if(t && t.date>=from && t.date<=to && pierOk(route(t.routeId))){ o.wx+=pax(t); o.wxV+=amt(b,t); } });
    });
    /* ส่วนลด · นับต่อใบครั้งเดียว ตามทริปแรกของใบ */
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!isLive(b)) return;
      var ds=(b.trips||[]).map(function(t){ return t&&t.date; }).filter(Boolean).sort();
      if(!ds.length || ds[0]<from || ds[0]>to) return;
      var t0=(b.trips||[]).find(function(t){ return t && t.date===ds[0]; }); if(!pierOk(route(t0&&t0.routeId))) return;
      var pb=b.priceBreakdown||{};
      o.foc+=Math.abs(+pb.focDiscount||0); o.disc+=Math.abs(+pb.discount||0);
    });
    return o;
  }
  /* ทริปที่วิ่งในวันหนึ่ง (มีเรือใน TRIPS หรือมีใบจอง) */
  function routesOn(ds){
    var ids={};
    try{ Object.keys((typeof TRIPS!=='undefined'&&TRIPS[ds])||{}).forEach(function(bid){ var op=TRIPS[ds][bid]; if(op&&op.route) ids[op.route]=1; }); }catch(_){}
    eachTrip(ds, ds, function(b,t){ if(t.routeId) ids[t.routeId]=1; });
    return Object.keys(ids).filter(function(rid){ var r=route(rid); return r && pierOk(r); })
      .sort(function(a,b){ var fa=famIdx(fam(a)), fb=famIdx(fam(b)); if(fa!==fb) return fa-fb;
        var ta=((route(a)||{}).times||[])[0]||'', tb=((route(b)||{}).times||[])[0]||''; return String(ta).localeCompare(String(tb)); });
  }
  function alOf(rid, ds){ var I=idx(), k=rid+'|'+ds; if(k in I.al) return I.al[k]; var v=null; try{ v=getAllotment(rid, ds)||null; }catch(_){} I.al[k]=v; return v; }
  function rName(rid){ var r=route(rid)||{}, f=fam(rid); var n=String(r.name||rid);
    if(f && f.name){ var v=n.indexOf(f.name)>=0 ? n.replace(f.name,'') : n; v=v.replace(/^\s*(by|\u00b7|-|\u2014|\/)\s*/i,'').replace(/\s*(by|\u00b7|-|\u2014|\/)\s*$/i,'').replace(/\s+/g,' ').trim(); return {f:f.name, v:v}; }
    return {f:n, v:''}; }

  /* ── ช่วงเวลา ──────────────────────────────────────────────────────── */
  function range(){
    var t=today(), y=+t.slice(0,4), m=+t.slice(5,7);
    if(EB.per==='month') return {from:t.slice(0,8)+'01', to:ymd(new Date(y,m,0)), lbl:laT('เดือนนี้')};
    if(EB.per==='quarter'){ var q=Math.floor((m-1)/3); return {from:ymd(new Date(y,q*3,1)), to:ymd(new Date(y,q*3+3,0)), lbl:laT('ไตรมาสนี้')}; }
    if(EB.per==='year') return {from:y+'-01-01', to:y+'-12-31', lbl:laT('ปีนี้')};
    return {from:t, to:t, lbl:laT('วันนี้')};
  }

  /* ── ชิ้นส่วนหน้าจอ ───────────────────────────────────────────────── */
  function kpi(l, v, d, cls, bar){
    return '<div class="eb-card eb-k'+(cls?' '+cls:'')+'"><div class="l">'+l+'</div><div class="v">'+v+'</div><div class="d">'+(d||'')+'</div>'
      +(bar!=null?'<div class="bar"><i style="width:'+Math.max(0,Math.min(100,bar))+'%"></i></div>':'')+'</div>';
  }
  function src(t){ return '<span class="eb-src">'+t+'</span>'; }
  function hbar(rows, fmt){
    var mx=Math.max.apply(null,[1].concat(rows.map(function(r){ return r.v; })));
    return '<div class="eb-rows">'+rows.map(function(r){
      return '<div class="rw" title="'+E(r.l+' · '+fmt(r.v))+'"><span class="lb">'+E(r.l)+'</span><span class="mini"><i style="width:'+Math.round(r.v*100/mx)+'%'+(r.c?';background:'+r.c:'')+'"></i></span><span class="vv">'+fmt(r.v)+(r.x||'')+'</span></div>';
    }).join('')+'</div>';
  }
  function chanCard(byChan, title){
    var tot=byChan.b2b+byChan.b2c+byChan.ctr;
    var seg=[['b2b','var(--eb-s5)'],['b2c','var(--eb-s3)'],['ctr','var(--eb-s1)']];
    return '<div style="font-size:11.5px;color:var(--eb-ink2);font-weight:600">'+title+'</div>'
      +'<div class="eb-hstack">'+(tot>0?seg.map(function(s){ var p=byChan[s[0]]*100/tot; return p>0?'<i title="'+E(CHAN_LBL[s[0]]+' '+baht(byChan[s[0]]))+'" style="width:'+p+'%;background:'+s[1]+'"></i>':''; }).join(''):'<i style="width:100%;background:#EDF0F4"></i>')+'</div>'
      +'<div class="eb-foot" style="margin:0 0 10px">'+seg.map(function(s){ return CHAN_LBL[s[0]]+' <b>'+pct(byChan[s[0]],tot)+'%</b>'; }).join(' · ')+'</div>';
  }
  function liveTag(){ return '<span class="eb-live"><i></i>LIVE · '+hhmm(Date.now())+'</span>'; }

  /* พรุ่งนี้ · ตารางรายรอบ + ใบล่าสุด */
  function tomorrowData(){
    var t0=today(), tm=addDays(t0,1), rows=[], tot={pax:0, cap:0, rev:0, add:0, addV:0, addN:0, pend:0, pendN:0, pendV:0, free:0}, feed=[];
    routesOn(tm).forEach(function(rid){
      var r={rid:rid, pax:0, rev:0, add:0, pend:0}, al=alOf(rid, tm);
      eachTrip(tm, tm, function(b,t){ if(t.routeId!==rid) return;
        var p=pax(t), a=amt(b,t); r.pax+=p; r.rev+=a;
        if(bkDay(b)===t0){ r.add+=p; tot.addV+=a; tot.addN++; }
        if(b.status==='pending_approval'){ r.pend+=p; tot.pendN++; tot.pendV+=a; }
        feed.push({b:b, t:t, ts:bkTs(b)});
      });
      r.cap = al && al.hasAllotment ? (+al.availableCapacity||0) : 0;
      r.free = al && al.hasAllotment ? Math.max(0, +al.seatsAvailable||0) : null;
      r.dep = ((route(rid)||{}).times||[])[0]||'';
      tot.pax+=r.pax; tot.cap+=r.cap; tot.rev+=r.rev; tot.add+=r.add; tot.pend+=r.pend; if(r.free) tot.free+=r.free;
      rows.push(r);
    });
    feed.sort(function(x,y){ return y.ts-x.ts; });
    return {ds:tm, rows:rows, tot:tot, feed:feed};
  }
  function capCell(p, cap, add){
    if(!(cap>0)) return '<span class="eb-mut">'+num(p)+' · '+laT('ไม่จำกัด')+'</span>';
    var a=Math.max(0,p-add);
    return '<div class="eb-cap"><span class="t"><i style="width:'+Math.min(100,a*100/cap)+'%;background:var(--eb-s4)"></i><i style="width:'+Math.max(0,Math.min(100-a*100/cap,add*100/cap))+'%;background:#16A34A"></i></span><span class="n">'+num(p)+'/'+num(cap)+'</span></div>';
  }
  function feedHtml(list, opt){
    opt=opt||{}; var t0=today();
    if(!list.length) return '<div class="eb-none">'+laT('ยังไม่มีใบจอง')+'</div>';
    return '<ul class="eb-feed">'+list.slice(0, opt.n||7).map(function(x){
      var b=x.b, t=x.t, r=rName(t.routeId), d=bkDay(b)===t0, pend=b.status==='pending_approval';
      var when = (d && hasTime(b)) ? hhmm(x.ts) : thD(bkDay(b)||t0);
      var tag = pend ? '<span style="color:var(--eb-warn)">'+laT('รออนุมัติ')+'</span>'
        : opt.trav ? (t.date===addDays(t0,1)?laT('พรุ่งนี้'):(t.date===t0?laT('วันนี้'):(laT('เดินทาง')+' '+thD(t.date))))
        : (d?'<span class="eb-up">'+laT('ใหม่วันนี้')+'</span>':'');
      return '<li class="'+(d?'new':'')+'"><span class="t">'+E(when)+'</span><span class="w"><b>'+E(agentName(b))+'</b><span>'
        +(opt.trav?E(thD(t.date))+' · ':'')+E(r.f+(r.v?' · '+r.v:''))+' · '+E(paxTxt(t))+'</span></span><span class="a">'+baht(amt(b,t))+'<span>'+tag+'</span></span></li>';
    }).join('')+'</ul>';
  }
  function tomorrowCard(full){
    var T=tomorrowData(), tt=T.tot, lf=pct(tt.pax, tt.cap);
    var head='<h2>'+laT('พรุ่งนี้')+' · '+E(thDow(T.ds))+' '+E(thD(T.ds))+' '+liveTag()+src(laT('ที่มา: Booking (By trip)'))+'</h2>';
    var tiles='<div class="eb-tm">'
      +'<div><div class="l">'+laT('ผู้โดยสาร')+'</div><div class="v">'+num(tt.pax)+(tt.cap?'<small>/ '+num(tt.cap)+' '+laT('ที่')+'</small>':'')+'</div><div class="d">'+(tt.cap?'Load factor '+lf+'%':'—')+'</div></div>'
      +'<div><div class="l">'+laT('รายได้พรุ่งนี้')+'</div><div class="v">'+baht(tt.rev)+'</div><div class="d">'+num(T.rows.length)+' '+laT('รอบ')+'</div></div>'
      +'<div><div class="l">'+laT('จองเพิ่มวันนี้')+'</div><div class="v" style="color:var(--eb-good)">+'+num(tt.add)+'<small>pax</small></div><div class="d">+'+baht(tt.addV)+' · '+num(tt.addN)+' '+laT('ใบ')+'</div></div>'
      +(full
        ? '<div><div class="l">'+laT('รออนุมัติ')+'</div><div class="v" style="color:'+(tt.pend?'var(--eb-warn)':'inherit')+'">'+num(tt.pend)+'<small>pax</small></div><div class="d">'+num(tt.pendN)+' '+laT('ใบ')+' · '+baht(tt.pendV)+'</div></div>'
        : '<div><div class="l">'+laT('ยังขายได้')+'</div><div class="v">'+(tt.cap?num(tt.free)+'<small>'+laT('ที่')+'</small>':'—')+'</div><div class="d">'+E(T.rows.filter(function(r){ return r.free>0; }).sort(function(a,b){ return b.free-a.free; }).slice(0,3).map(function(r){ return rName(r.rid).f+' '+r.free; }).join(' · ')||'—')+'</div></div>')
      +'</div>';
    if(!full) return '<div class="eb-card" id="eb-tmw">'+head+tiles+'</div>';
    var tbl='<table class="eb-tbl"><thead><tr><th>'+laT('โปรแกรม · รอบ')+'</th><th>'+laT('เวลา')+'</th><th>'+laT('ที่นั่ง')+'</th><th>'+laT('ว่าง')+'</th><th>'+laT('รายได้')+'</th><th>'+laT('วันนี้')+' +</th></tr></thead><tbody>'
      +(T.rows.length?T.rows.map(function(r){ var n=rName(r.rid);
        return '<tr><td><span class="eb-dot" style="background:'+E(famColor(r.rid))+'"></span><b>'+E(n.f)+'</b>'+(n.v?' · '+E(n.v):'')+'</td><td>'+E(r.dep)+'</td><td>'+capCell(r.pax,r.cap,r.add)+'</td>'
          +'<td>'+(r.free==null?'—':(r.free<=0?'<span class="eb-st b">● '+laT('เต็ม')+'</span>':num(r.free)))+'</td><td>'+baht(r.rev)+'</td><td>'+(r.add?'<span class="eb-up">+'+num(r.add)+'</span>':'<span class="eb-mut">0</span>')+'</td></tr>'; }).join('')
        :'<tr><td colspan="6" class="eb-none">'+laT('ยังไม่มีทริปพรุ่งนี้')+'</td></tr>')
      +'</tbody></table><div class="eb-lgd"><i style="background:var(--eb-s4)"></i>'+laT('จองไว้ก่อนวันนี้')+' <i style="background:#16A34A"></i>'+laT('จองเพิ่มวันนี้')+'</div>';
    return '<div class="eb-grid eb-r5" id="eb-tmw"><div class="eb-card">'+head+tiles+tbl+'</div>'
      +'<div class="eb-card"><h2>'+laT('ใบจองล่าสุดของพรุ่งนี้')+' <span class="eb-tag">'+laT('เรียงจากใหม่สุด')+'</span></h2>'+feedHtml(T.feed)
      +'<div class="eb-foot">'+laT('วันนี้เข้ามาสำหรับพรุ่งนี้')+' '+num(tt.addN)+' '+laT('ใบ')+' · +'+baht(tt.addV)+'</div></div></div>';
  }

  /* ── มุมมอง "วันนี้" ──────────────────────────────────────────────── */
  function viewToday(){
    var t0=today(), wk=addDays(t0,-7), ly=addDays(t0,-364);
    var A=agg(t0,t0), Aw=agg(wk,wk), Al=agg(ly,ly);
    var S=salesIn(t0,t0), C=cxlIn(t0,t0);
    var s7=salesIn(addDays(t0,-7), addDays(t0,-1));
    /* คนเดินทางจริงวันนี้ · ทริปรายรอบ */
    var rows=[]; try{ rows=tsRows(t0)||[]; }catch(_){ rows=[]; }
    rows=rows.filter(function(r){ return isSale(r.b) && pierOk(route(r.routeId)); });
    var booked=0, trav=0, ns=0, nsV=0, byR={};
    rows.forEach(function(r){
      booked+=r.booked; trav+=r.travelled; var lost=(+r.ns||0)+(+r.cxl||0); ns+=lost; if(r.booked>0) nsV+=(+r.amount||0)*lost/r.booked;
      var R=byR[r.routeId]=byR[r.routeId]||{rid:r.routeId, booked:0, trav:0, lost:0, rev:0, n:0, done:0};
      R.booked+=r.booked; R.trav+=r.travelled; R.lost+=lost; R.rev+=(+r.amount||0); R.n++; if(r.pierDone) R.done++;
    });
    var pay=paymentsOn(t0), cash=pierCashOn(t0);
    var ckN=rows.length, ckD=rows.filter(function(r){ return r.pierDone; }).length;
    var h='<div class="eb-grid eb-kpis">'
      + kpi(laT('รายได้ของทริปวันนี้'), baht(A.rev), chg(A.rev,Aw.rev)+' vs '+E(thDow(t0))+laT('ที่แล้ว')+' · '+chg(A.rev,Al.rev)+' vs '+laT('ปีก่อน'))
      + kpi(laT('ผู้โดยสารวันนี้'), num(trav)+'<small>/ '+num(booked)+' '+laT('จอง')+'</small>', laT('เช็คอินหน้าท่าแล้ว')+' '+num(ckD)+'/'+num(ckN)+' '+laT('ใบ · ขาด/ยกเลิกหน้างาน')+' '+num(ns), '', ckN?pct(ckD,ckN):null)
      + kpi(laT('ยอดขายที่เข้ามาวันนี้'), baht(S.val), num(S.n)+' '+laT('ใบ')+' · '+num(S.pax)+' pax · '+chg(S.val, s7.val/7)+' vs '+laT('เฉลี่ย 7 วัน'))
      + kpi(laT('ยกเลิกวันนี้'), C.val?('<span style="color:var(--eb-bad)">'+baht(-C.val)+'</span>'):baht(0), num(C.n)+' '+laT('ใบ')+' · '+num(C.pax)+' pax · '+laT('สุทธิ')+' <b>'+baht(S.val-C.val)+'</b>')
      + kpi('No-show / '+laT('ยกเลิกหน้างาน'), num(ns)+'<small>pax</small>', ns?(laT('มูลค่าประมาณ')+' '+baht(nsV)):laT('ยังไม่มี'), ns?'warn':'')
      + kpi(laT('เงินเข้าวันนี้'), baht(pay.v+cash), laT('โอน/ชำระ')+' '+num(pay.n)+' '+laT('รายการ · เงินสดหน้าท่า')+' '+baht(cash))
      + '</div>';

    /* ทริปวันนี้ */
    var rids=routesOn(t0); var trip='<table class="eb-tbl"><thead><tr><th>'+laT('โปรแกรม · รอบ')+'</th><th>'+laT('เวลา')+'</th><th>'+laT('เช็คอินหน้าท่า')+'</th><th>'+laT('เดินทางจริง / จอง')+'</th><th>'+laT('ขาด')+'</th><th>'+laT('รายได้')+'</th><th>Load factor</th></tr></thead><tbody>'
      + (rids.length?rids.map(function(rid){
          var R=byR[rid]||{booked:0,trav:0,lost:0,rev:0,n:0,done:0}, al=alOf(rid,t0), cap=al&&al.hasAllotment?(+al.availableCapacity||0):0, n=rName(rid);
          var st = !R.n ? '<span class="eb-sts">'+laT('ไม่มีใบจอง')+'</span>' : (R.done>=R.n ? '<span class="eb-sts dep">'+laT('ครบ')+' '+R.n+' '+laT('ใบ')+'</span>' : (R.done ? '<span class="eb-sts ck">'+R.done+'/'+R.n+' '+laT('ใบ')+'</span>' : '<span class="eb-sts wt">'+laT('ยังไม่เช็คอิน')+'</span>'));
          var lf=cap?pct(R.trav,cap):null;
          return '<tr><td><span class="eb-dot" style="background:'+E(famColor(rid))+'"></span><b>'+E(n.f)+'</b>'+(n.v?' · '+E(n.v):'')+'</td><td>'+E(((route(rid)||{}).times||[])[0]||'')+'</td><td>'+st+'</td>'
            +'<td><div class="eb-cap"><span class="t"><i style="width:'+(R.booked?R.trav*100/R.booked:0)+'%;background:var(--eb-s4)"></i><i style="width:'+(R.booked?R.lost*100/R.booked:0)+'%;background:#D9483B"></i></span><span class="n">'+num(R.trav)+'/'+num(R.booked)+'</span></div></td>'
            +'<td>'+(R.lost?num(R.lost):'<span class="eb-mut">0</span>')+'</td><td>'+baht(R.rev)+'</td><td>'+(lf==null?'<span class="eb-mut">—</span>':(lf<75?'<span class="eb-st w">▲ '+lf+'%</span>':lf+'%'))+'</td></tr>'; }).join('')
        : '<tr><td colspan="7" class="eb-none">'+laT('วันนี้ไม่มีทริป')+'</td></tr>')
      + '</tbody></table><div class="eb-lgd"><i style="background:var(--eb-s4)"></i>'+laT('เดินทางจริง')+' <i style="background:#D9483B"></i>'+laT('ขาด / ยกเลิกหน้างาน')+'</div>';

    /* ยอดขายตามชั่วโมง + ใบล่าสุด */
    var hrs={}, H0=7, H1=22; S.list.forEach(function(b){ if(!hasTime(b)) return; var hr=new Date(bkTs(b)).getHours(); hrs[hr]=(hrs[hr]||0)+money(b); });
    var hmx=Math.max.apply(null,[1].concat(Object.keys(hrs).map(function(k){ return hrs[k]; }))), nowH=new Date().getHours();
    var hb='<div class="eb-hb">'; for(var hh=H0; hh<=H1; hh++){ var v=hrs[hh]||0; hb+='<div title="'+String(hh).padStart(2,'0')+':00 · '+baht(v)+'"><i class="'+(hh===nowH?'now':'')+'" style="height:'+Math.round(v*100/hmx)+'%"></i></div>'; } hb+='</div><div class="eb-hax">';
    for(hh=H0; hh<=H1; hh++) hb+='<span>'+String(hh).padStart(2,'0')+'</span>'; hb+='</div>';
    var fd=[]; S.list.forEach(function(b){ (b.trips||[]).forEach(function(t){ if(t && pierOk(route(t.routeId))) fd.push({b:b,t:t,ts:bkTs(b)}); }); });
    fd.sort(function(x,y){ return y.ts-x.ts; });
    var tm=addDays(t0,1), wkE=addDays(t0,7), sTm=0, sWk=0, sFar=0;
    fd.forEach(function(x){ var a=amt(x.b,x.t); if(x.t.date<=tm) sTm+=a; else if(x.t.date<=wkE) sWk+=a; else sFar+=a; });

    /* เอเย่นต์วันนี้ */
    var ag={}; S.list.forEach(function(b){ var k=agentKey(b), A2=ag[k]=ag[k]||{name:agentName(b), sales:'', n:0, pax:0, val:0}; A2.n++; A2.val+=money(b);
      (b.trips||[]).forEach(function(t){ A2.pax+=pax(t); }); try{ var sn=pfmSalesName(b); if(sn && sn!=='—') A2.sales=sn; }catch(_){} });
    var ag7={}; s7.list.forEach(function(b){ var k=agentKey(b); ag7[k]=(ag7[k]||0)+money(b); });
    var agL=Object.keys(ag).map(function(k){ return Object.assign({k:k}, ag[k]); }).sort(function(a,b){ return b.val-a.val; }).slice(0,5);
    /* เอเย่นต์ประจำที่ยังไม่ส่งยอดวันนี้ · ส่งมาแล้ว ≥ 4 วันใน 14 วันก่อน */
    var s14=salesIn(addDays(t0,-14), addDays(t0,-1)), days={}, val14={}, nm14={};
    s14.list.forEach(function(b){ var k=agentKey(b); if(k==='__b2c') return; (days[k]=days[k]||{})[bkDay(b)]=1; val14[k]=(val14[k]||0)+money(b); nm14[k]=agentName(b); });
    var quiet=Object.keys(days).filter(function(k){ return Object.keys(days[k]).length>=4 && !ag[k]; })
      .sort(function(a,b){ return val14[b]-val14[a]; }).slice(0,3);
    /* ช่องทาง · โปรแกรม ของยอดขายวันนี้ */
    var ch={b2b:0,b2c:0,ctr:0}, pf={}; S.list.forEach(function(b){ ch[chan(b)]+=money(b); });
    fd.forEach(function(x){ var f=fam(x.t.routeId)||{id:'_',name:laT('อื่น ๆ')}; var P=pf[f.id]=pf[f.id]||{l:f.name, v:0, c:f.color}; P.v+=amt(x.b,x.t); });

    h+='<div class="eb-sec">Live · '+laT('ทริปวันนี้ / ยอดขายที่เข้ามาวันนี้')+'</div><div class="eb-grid eb-r5">'
      + '<div class="eb-card"><h2>'+laT('ทริปวันนี้')+' · '+E(thDow(t0))+' '+E(thD(t0))+' '+liveTag()+src(laT('ที่มา: เช็คอินหน้าท่า')+' · Travel Summary')+'</h2>'+trip+'</div>'
      + '<div class="eb-card"><h2>'+laT('ยอดขายวันนี้ ตามชั่วโมง')+' <span class="eb-tag">'+laT('วันจอง')+' = '+laT('วันนี้')+'</span></h2>'+hb
      + '<h2 style="margin-top:14px">'+laT('ใบจองที่เข้ามาวันนี้')+' <span class="eb-tag">'+laT('ทุกวันเดินทาง · ใหม่สุดก่อน')+'</span></h2>'+feedHtml(fd,{n:6,trav:true})
      + '<div class="eb-foot">'+laT('ยอดขายวันนี้ตามวันเดินทาง: ถึงพรุ่งนี้')+' '+baht(sTm)+' · '+laT('ภายใน 7 วัน')+' '+baht(sWk)+' · '+laT('ไกลกว่านั้น')+' '+baht(sFar)+'</div></div></div>';
    h+='<div class="eb-sec">'+laT('พรุ่งนี้')+'</div>'+tomorrowCard(false);
    h+='<div class="eb-sec">'+laT('ยอดขายวันนี้มาจากไหน')+'</div><div class="eb-grid eb-r3">'
      + '<div class="eb-card"><h2>'+laT('เอเย่นต์ที่ส่งยอดวันนี้')+' <span class="eb-tag">Top 5</span>'+src(laT('ที่มา')+': Booking · Sales')+'</h2>'
      + '<table class="eb-tbl"><thead><tr><th>'+laT('เอเย่นต์')+'</th><th>'+laT('ใบ')+'</th><th>Pax</th><th>'+laT('ยอดขาย')+'</th><th>vs '+laT('เฉลี่ย 7 วัน')+'</th><th>'+laT('เซลส์')+'</th></tr></thead><tbody>'
      + (agL.length?agL.map(function(a){ return '<tr><td><b>'+E(a.name)+'</b></td><td>'+num(a.n)+'</td><td>'+num(a.pax)+'</td><td><b>'+baht(a.val)+'</b></td><td>'+chg(a.val,(ag7[a.k]||0)/7)+'</td><td>'+E(a.sales||'—')+'</td></tr>'; }).join('')
        :'<tr><td colspan="6" class="eb-none">'+laT('วันนี้ยังไม่มีใบจองเข้า')+'</td></tr>')
      + '</tbody></table><div class="eb-foot">'+(quiet.length?(laT('เอเย่นต์ประจำที่ยังไม่ส่งยอดวันนี้')+': '+quiet.map(function(k){ return '<b>'+E(nm14[k])+'</b> ('+laT('ปกติวันละ')+' ~'+baht(val14[k]/Object.keys(days[k]).length)+')'; }).join(' · ')):laT('เอเย่นต์ประจำส่งยอดมาครบแล้ววันนี้'))+'</div></div>'
      + '<div class="eb-card"><h2>'+laT('ช่องทาง · โปรแกรม')+' <span class="eb-tag">'+laT('ยอดขายวันนี้')+'</span></h2>'+chanCard(ch,laT('ช่องทางขาย'))
      + hbar(Object.keys(pf).map(function(k){ return pf[k]; }).sort(function(a,b){ return b.v-a.v; }).slice(0,6), baht)+'</div></div>';
    return h;
  }

  /* ── มุมมอง เดือน / ไตรมาส / ปี ────────────────────────────────────── */

  /* ══ §ebCost (2026-10-25) · ต้นทุน · กำไร จาก Trip P&L (pxDay → pxTrip รายลำ) ══════════════════════
     owner "หน้านี้ เพิ่มส่วนของต้นทุนเข้าไปด้วยได้ไหม" · ม็อก EBC · "โอเคทั้ง …"
     · ต้นทุนและรายได้ของส่วนนี้มาจากเครื่องเดียวกับหน้า Trip P&L (รายได้สุทธิหลัง VAT · ต้นทุน 8 หมวด · ลำที่ปิดยอดแล้วใช้ตัวเลขจริง)
       จึงอาจต่างจาก "รายได้" ของการ์ดอื่นในแท็บนี้ (มูลค่าใบจอง) เล็กน้อย · ป้าย "ที่มา: Trip P&L" บอกไว้ทุกการ์ด
     · "ทุกท่า" = ทับละมุ + พันวา (§ebNoRanong) · ระนองดูได้เมื่อกดแท็บท่าเอง
     · วันข้างหน้า = pax ที่จองแล้ว × สูตร/แผน (forecast) · ลำที่ไม่ออก (noSail) ไม่นับ
     · แคช 60 วิ ต่อ ช่วง|ท่า|ตราประทับข้อมูล · เดือนละ ~180 ทริป · ปี ~2,000 ทริป (ครั้งแรกช้ากว่าปกติ แล้วจำไว้) */
  var _cx={};
  function cxStamp(){ return stamp()+'|'+String(window.__savedAt||0)+'|'+(EB.pier||''); }
  function cxPiers(){ return EB.pier ? [EB.pier] : ['tublamu','panwa']; }
  /* รวมของวันเดียว · {rev,cost,profit,pax,trips,real,est,g:{หมวด:฿},routes:{rid:{...}},loss} */
  function cxDay(ds){
    var st=cxStamp(), now=Date.now(), C=_cx[ds];
    if(C && C.st===st && now-C.at<60000) return C.v;
    var v={rev:0,cost:0,profit:0,pax:0,trips:0,real:0,est:0,g:{},routes:{},loss:0};
    if(typeof pxDay==='function'){
      cxPiers().forEach(function(p){
        var D=[]; try{ D=pxDay(ds,p)||[]; }catch(_){ D=[]; }
        D.forEach(function(t){
          if(!t || t.noSail) return;
          v.rev+=t.rev||0; v.cost+=t.cost||0; v.profit+=(t.profit!=null?t.profit:(t.rev||0)-(t.cost||0)); v.pax+=(t.px&&t.px.tot)||0; v.trips++;
          if(t.st==='done'||t.st==='part') v.real++; else v.est++;
          if((t.profit!=null?t.profit:(t.rev||0)-(t.cost||0))<0) v.loss++;
          (t.rows||[]).forEach(function(r){ var g=r.g||'อื่น ๆ'; v.g[g]=(v.g[g]||0)+(+r.use||0); });
          var rk=t.rid||((t.route&&t.route.name)||'—'), RR=v.routes[rk]||(v.routes[rk]={rid:rk, name:(t.route&&t.route.name)||rk, color:(t.route&&t.route.color)||'#8b909c', n:0, pax:0, rev:0, cost:0});
          RR.n++; RR.pax+=(t.px&&t.px.tot)||0; RR.rev+=t.rev||0; RR.cost+=t.cost||0;
        });
      });
    }
    /* §tcxPartner · ใบที่รอบยกเลิกแล้วส่งต่อ Partner · รายได้ยังเป็นของเรา (Invoice เอเยนต์เดิม) · ต้นทุน = ราคา Partner */
    try{ if(typeof window.tcxPtDay==='function') window.tcxPtDay(ds).forEach(function(x){
      v.rev+=x.rev; v.cost+=x.cost; v.profit+=x.rev-x.cost; v.pax+=x.pax;
      var g='Partner'; v.g[g]=(v.g[g]||0)+x.cost;
      var r=(typeof getRoute==='function')?getRoute(x.rid):null, RR=v.routes[x.rid]||(v.routes[x.rid]={rid:x.rid, name:(r&&r.name)||x.rid, color:(r&&r.color)||'#8b909c', n:0, pax:0, rev:0, cost:0});
      RR.pax+=x.pax; RR.rev+=x.rev; RR.cost+=x.cost; }); }catch(_){}
    _cx[ds]={st:st, at:now, v:v};
    return v;
  }
  function cxRange(from,to){
    var o={rev:0,cost:0,profit:0,pax:0,trips:0,real:0,est:0,g:{},routes:{},loss:0,days:0,byDay:{}};
    for(var ds=from; ds<=to; ds=addDays(ds,1)){
      var d=cxDay(ds); o.byDay[ds]=d; if(!d.trips && !d.rev) continue; o.days++;   /* §tcxPartner · วันที่มีแต่ใบส่ง Partner */
      o.rev+=d.rev; o.cost+=d.cost; o.profit+=d.profit; o.pax+=d.pax; o.trips+=d.trips; o.real+=d.real; o.est+=d.est; o.loss+=d.loss;
      Object.keys(d.g).forEach(function(g){ o.g[g]=(o.g[g]||0)+d.g[g]; });
      Object.keys(d.routes).forEach(function(k){ var R=d.routes[k], O=o.routes[k]||(o.routes[k]={rid:R.rid,name:R.name,color:R.color,n:0,pax:0,rev:0,cost:0}); O.n+=R.n; O.pax+=R.pax; O.rev+=R.rev; O.cost+=R.cost; });
    }
    return o;
  }
  function cxTarget(){ try{ var d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); var t=+d.eb_margin_target; return (t>0&&t<100)?t:30; }catch(_){ return 30; } }
  window.ebSetMarginTarget=function(){
    if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
    var v=prompt(laT('ตั้งเป้า margin ขั้นต้น (%) · ค่าเดียวทั้งบริษัท'), String(cxTarget())); if(v===null) return;
    var n=parseFloat(v); if(!(n>0&&n<100)){ alert('Please enter a number between 1 and 99.'); return; }
    /* คีย์ scalar บนสุดของ blob เป็นสตริง → เดินทางเป็น {op:'meta'} ลง app_meta เหมือน da_template */
    try{ var d=JSON.parse(localStorage.getItem('loveandaman_v2')||'{}'); d.eb_margin_target=String(n); localStorage.setItem('loveandaman_v2', JSON.stringify(d)); }catch(_){}
    _cx={}; render();
  };
  function cxCol(cr){ return cr>=85?'var(--eb-bad)':(cr>=70?'var(--eb-warn)':'var(--eb-good)'); }
  function cxGColor(g){ try{ return (typeof pxGColor==='function')?pxGColor(g):'#94A3B8'; }catch(_){ return '#94A3B8'; } }
  /* KPI 2 ใบ · ต่อท้ายแถว KPI ของแท็บ Revenue */
  function cxKpis(X, lbl){
    if(!X.trips) return kpi(laT('ต้นทุนตรง')+' '+lbl, '—', laT('ยังไม่มีทริปในช่วงนี้')+' · '+laT('ที่มา: Trip P&L'))
                     + kpi(laT('กำไรขั้นต้น'), '—', laT('ยังไม่มีข้อมูล'));
    var cr=pct(X.cost,X.rev), m=X.rev>0?Math.round((X.rev-X.cost)*100/X.rev):0, tg=cxTarget(), gp=X.rev-X.cost;
    return kpi(laT('ต้นทุนตรง')+' '+lbl+' <span class="eb-tag">Trip P&amp;L</span>', baht(X.cost),
               cr+'% '+laT('ของรายได้')+' · ฿'+num(X.pax?X.cost/X.pax:0)+' '+laT('ต่อหัว')+' · '+num(X.trips)+' '+laT('ทริป'), cr>=85?'warn':'')
         + kpi(laT('กำไรขั้นต้น')+' <span class="eb-tag">Trip P&amp;L</span>', '<span style="color:'+(gp>=0?'var(--eb-good)':'var(--eb-bad)')+'">'+(gp>=0?'+':'')+baht(gp)+'</span>',
               'margin <b>'+m+'%</b> · ฿'+num(X.pax?gp/X.pax:0)+' '+laT('ต่อหัว')+' · <span onclick="ebSetMarginTarget()" title="'+laT('กดเพื่อตั้งเป้า')+'" style="cursor:pointer;text-decoration:underline dotted">'+laT('เป้า')+' '+tg+'%</span>'+(X.loss?' · <span style="color:var(--eb-bad)">'+num(X.loss)+' '+laT('ทริป')+' '+laT('ขาดทุน')+'</span>':''),
               m<tg?'warn':'', Math.max(0,Math.min(100,tg>0?m*100/tg:0)));
  }
  /* ส่วน ต้นทุน · กำไร · 3 การ์ด */
  function cxSection(X, R, t0){
    var h='<div class="eb-sec">'+laT('ต้นทุน · กำไร')+' <span class="eb-tag">'+E(R.lbl)+'</span></div>';
    if(!X.trips) return h+'<div class="eb-card eb-none">'+laT('ยังไม่มีทริปในช่วงนี้')+' · '+laT('ที่มา: Trip P&L')+'</div>';
    /* 1 · ต้นทุนแยกหมวด */
    var gs=Object.keys(X.g).map(function(g){ return {g:g, v:X.g[g]}; }).filter(function(x){ return Math.round(x.v)!==0; }).sort(function(a,b){ return b.v-a.v; });
    var tot=gs.reduce(function(s,x){ return s+x.v; },0)||1;
    var realP=pct(X.real, X.real+X.est);
    var c1='<div class="eb-card"><h2>'+laT('ต้นทุนแยกหมวด')+' <span class="eb-tag">'+laT('ต้นทุนตรง')+' · '+E(R.lbl)+'</span>'+src(laT('ที่มา: Trip P&L'))+'</h2>'
      +'<div style="font-size:11.5px;color:var(--eb-ink2)">'+laT('รวม')+' <b style="color:var(--eb-ink)">'+baht(X.cost)+'</b> · '+num(X.trips)+' '+laT('ทริป')+' · <span class="eb-tag" style="background:#E4F3EC;color:#0F6E56">'+laT('ตัวเลขจริง')+' '+realP+'%</span> <span class="eb-tag" style="background:#FAEEDA;color:#854F0B">'+laT('ประมาณการ')+' '+(100-realP)+'%</span></div>'
      +'<div class="eb-hstack" style="margin:10px 0 8px">'+gs.map(function(x){ return '<i title="'+E(laT(x.g)+' '+baht(x.v))+'" style="width:'+(x.v*100/tot)+'%;background:'+cxGColor(x.g)+'"></i>'; }).join('')+'</div>'
      +'<table class="eb-tbl"><thead><tr><th>'+laT('หมวด')+'</th><th>฿</th><th>%</th><th>฿/'+laT('ต่อหัว').replace('per ','')+'</th></tr></thead><tbody>'
      +gs.map(function(x){ return '<tr><td><span class="eb-dot" style="background:'+cxGColor(x.g)+'"></span>'+E(laT(x.g))+'</td><td><b>'+baht(x.v)+'</b></td><td>'+pct(x.v,tot)+'%</td><td>'+(X.pax?'฿'+num(x.v/X.pax):'—')+'</td></tr>'; }).join('')
      +'</tbody></table><div class="eb-foot">'+laT('ไม่รวมเงินเดือนประจำ · ค่าเช่า · ประกัน · ซ่อมบำรุง Fleet')+' · '+laT('ทริปที่ยังไม่ปิดยอดใช้สูตรจากแผนต้นทุนของเส้นทาง')+'</div></div>';
    /* 2 · กำไรรายโปรแกรม */
    var rows=Object.keys(X.routes).map(function(k){ var r=X.routes[k]; r.cr=r.rev>0?Math.round(r.cost*100/r.rev):(r.cost>0?999:0); r.m=r.rev>0?100-r.cr:0; return r; })
      .sort(function(a,b){ return a.m-b.m; });
    var c2='<div class="eb-card"><h2>'+laT('กำไรรายโปรแกรม')+' <span class="eb-tag">'+laT('เรียงจาก margin ต่ำสุด')+'</span>'+src(laT('ที่มา: Trip P&L'))+'</h2>'
      +'<table class="eb-tbl"><thead><tr><th>'+laT('โปรแกรม')+'</th><th>'+laT('ทริป')+'</th><th>Pax</th><th>'+laT('รายได้')+'</th><th>'+laT('ต้นทุน')+'</th><th style="min-width:110px">cost ratio</th><th>margin</th><th>'+laT('กำไร/หัว')+'</th></tr></thead><tbody>'
      +rows.map(function(r){ var nm=rName(r.rid), watch=r.cr>=80, col=cxCol(r.cr);
          return '<tr'+(r.cost>r.rev?' style="background:#FFF5F4"':'')+'><td><span class="eb-dot" style="background:'+E(r.color)+'"></span><b>'+E(nm.f)+'</b>'+(nm.v?' <span class="eb-mut">'+E(nm.v)+'</span>':'')+(watch?' <span class="eb-tag" style="background:#FBE3E0;color:#A32D2D">'+laT('เฝ้าระวัง')+'</span>':'')+'</td>'
            +'<td>'+num(r.n)+'</td><td>'+num(r.pax)+'</td><td>'+baht(r.rev)+'</td><td style="color:var(--eb-bad)">'+baht(r.cost)+'</td>'
            +'<td><div class="eb-hstack" style="margin:0;height:7px"><i style="width:'+Math.min(100,r.cr)+'%;background:'+col+'"></i></div><div style="font-size:10px;color:'+col+';font-weight:700;margin-top:2px;text-align:left">cost '+(r.cr>=999?'∞':r.cr+'%')+'</div></td>'
            +'<td style="font-weight:700;color:'+col+'">'+(r.rev>0?r.m+'%':'—')+'</td><td>'+(r.pax?((r.rev-r.cost)>=0?'+':'')+'฿'+num((r.rev-r.cost)/r.pax):'—')+'</td></tr>'; }).join('')
      +'<tr style="font-weight:700;background:#F7F8FB"><td>'+laT('รวม')+'</td><td>'+num(X.trips)+'</td><td>'+num(X.pax)+'</td><td>'+baht(X.rev)+'</td><td style="color:var(--eb-bad)">'+baht(X.cost)+'</td><td style="text-align:left;font-size:10.5px">cost '+pct(X.cost,X.rev)+'%</td><td style="color:'+(X.rev>X.cost?'var(--eb-good)':'var(--eb-bad)')+'">'+(X.rev>0?Math.round((X.rev-X.cost)*100/X.rev):0)+'%</td><td>'+(X.pax?'฿'+num((X.rev-X.cost)/X.pax):'—')+'</td></tr>'
      +'</tbody></table><div class="eb-foot">'+laT('สีแถบ: เขียว < 70% · ส้ม 70–85% · แดง ≥ 85% ของรายได้ (เกณฑ์เดียวกับ Trip P&L)')+' · <b>'+laT('เฝ้าระวัง')+'</b> '+laT('= ต้นทุน ≥ 80% ของรายได้ในช่วงนี้')+'</div></div>';
    /* 3 · รายได้ vs ต้นทุน รายวัน · −29 … +14 */
    var days=[], mx=1, lossN=0;
    for(var i=-29;i<=14;i++){ var ds=addDays(t0,i), d=cxDay(ds); days.push({ds:ds,d:d}); if(d.rev>mx) mx=d.rev; if(d.cost>mx) mx=d.cost; if(ds<=t0 && d.trips && d.cost>d.rev) lossN++; }
    var bars='<div class="eb-bars" style="position:relative">'+days.map(function(x){ var we=[0,6].indexOf(dt(x.ds).getDay())>=0, fut=x.ds>t0, loss=!fut&&x.d.trips&&x.d.cost>x.d.rev;
        return '<span title="'+E(thDow(x.ds)+' '+thD(x.ds)+' · '+laT('รายได้')+' '+baht(x.d.rev)+' · '+laT('ต้นทุน')+' '+baht(x.d.cost)+(fut?' ('+laT('จองไว้แล้ว · ต้นทุนตามแผน')+')':''))+'" style="flex:1;min-width:3px;position:relative;height:100%;display:flex;align-items:flex-end">'
          +'<i class="'+(fut?'f':(x.ds===t0?'t':(we?'w':'')))+'" style="width:100%;height:'+Math.max(1,Math.round(x.d.rev*100/mx))+'%;'+(loss?'background:#F3B7B2;':'')+'"></i>'
          +(x.d.cost>0?'<b style="position:absolute;left:0;right:0;height:2px;background:#E0523E;bottom:'+Math.round(x.d.cost*100/mx)+'%"></b>':'')
          +'</span>'; }).join('')+'</div>'
      +'<div class="eb-axis"><span>'+E(thD(addDays(t0,-29)))+'</span><span>'+E(thD(addDays(t0,-15)))+'</span><span>'+laT('วันนี้')+'</span><span>'+E(thD(addDays(t0,14)))+'</span></div>'
      +'<div class="eb-lgd"><i style="background:var(--eb-s3)"></i>'+laT('วันธรรมดา')+' <i style="background:var(--eb-s4)"></i>'+laT('เสาร์–อาทิตย์')+' <i style="background:#E0523E;height:3px"></i>'+laT('ต้นทุน')+' <i class="hatch"></i>'+laT('จองไว้แล้ว · ต้นทุนตามแผน')+' <i style="background:#F3B7B2"></i>'+laT('วันขาดทุน')+' · '+num(lossN)+'</div>';
    var c3='<div class="eb-card"><h2>'+laT('รายได้ vs ต้นทุน · รายวัน')+' <span class="eb-tag">'+laT('30 วันที่ผ่านมา + 14 วันข้างหน้า')+'</span>'+src(laT('ที่มา: Trip P&L'))+'</h2>'+bars+'<div class="eb-foot">'+laT('ขีดแดง = ต้นทุนของวันนั้น')+' · '+laT('รายได้ Trip P&L')+' = '+laT('คำนวณจาก Trip P&L รายทริป')+'</div></div>';
    return h+'<div class="eb-grid eb-r2">'+c1+c2+'</div><div class="eb-grid" style="margin-top:12px">'+c3+'</div>';
  }
  function viewPeriod(){
    var t0=today(), R=range(), toD=R.to<t0?R.to:t0;
    var CX=cxRange(R.from, R.to);   /* §ebCost · ต้นทุนทั้งช่วง (รวมวันข้างหน้าเป็น forecast) */
    var A=agg(R.from, toD), Al=agg(addYears(R.from,-1), addYears(toD,-1));
    var Fut=agg(addDays(t0,1)>R.from?addDays(t0,1):R.from, R.to);
    var S=salesIn(R.from, toD), Sl=salesIn(addYears(R.from,-1), addYears(toD,-1));
    var B30=agg(addDays(t0,1), addDays(t0,30)), B30l=agg(addYears(addDays(t0,1),-1), addYears(addDays(t0,30),-1));
    var Lk=leakage(R.from, R.to), Cx=cxlIn(R.from, toD);
    var rpp=A.pax?A.rev/A.pax:0, rppL=Al.pax?Al.rev/Al.pax:0;
    var h='<div class="eb-grid eb-kpis eb-k8">'
      + kpi(laT('รายได้')+R.lbl+' ('+laT('วันเดินทาง)'), baht(A.rev), chg(A.rev,Al.rev)+' vs '+laT('ปีก่อน')+' · '+num(A.pax)+' pax')
      + kpi(laT('คาดการณ์สิ้น')+R.lbl.replace(laT('นี้'),''), baht(A.rev+Fut.rev), laT('ได้แล้ว')+' '+baht(A.rev)+' + '+laT('จองไว้')+' '+baht(Fut.rev)+(R.to>t0?'':' ('+laT('ครบช่วงแล้ว)')), '', (A.rev+Fut.rev)>0?pct(A.rev,A.rev+Fut.rev):null)
      + kpi(laT('ยอดขายที่เข้ามา (วันจอง)'), baht(S.val), num(S.n)+' '+laT('ใบ')+' · '+chg(S.val,Sl.val)+' vs '+laT('ปีก่อน'))
      + kpi(laT('รายได้เฉลี่ยต่อหัว'), '฿'+num(rpp), chg(rpp,rppL)+' vs '+laT('ปีก่อน'))
      + kpi(laT('จองล่วงหน้า 30 วัน'), baht(B30.rev), num(B30.pax)+' pax · '+chg(B30.rev,B30l.rev)+' vs '+laT('ช่วงเดียวกันปีก่อน'))
      + kpi(laT('ยกเลิก')+R.lbl+' ('+laT('วันที่ยกเลิก)'), Cx.val?('<span style="color:var(--eb-bad)">'+baht(-Cx.val)+'</span>'):baht(0), num(Cx.n)+' '+laT('ใบ')+' · '+num(Cx.pax)+' pax · '+laT('สุทธิที่เข้ามา')+' <b>'+baht(S.val-Cx.val)+'</b>', Cx.val>S.val*0.15?'warn':'')
      + cxKpis(CX, E(R.lbl))   /* §ebCost */
      + '</div>';
    h+='<div class="eb-sec">Live booking · '+laT('พรุ่งนี้')+'</div>'+tomorrowCard(true);

    /* แนวโน้ม · 30 วันก่อน + 14 วันข้างหน้า */
    var T=agg(addDays(t0,-29), addDays(t0,14)), days=[], mx=1;
    for(var i=-29;i<=14;i++){ var ds=addDays(t0,i), v=T.byDay[ds]||0; days.push({ds:ds,v:v}); if(v>mx) mx=v; }
    var bars='<div class="eb-bars">'+days.map(function(x){ var we=[0,6].indexOf(dt(x.ds).getDay())>=0;
      return '<i class="'+(x.ds>t0?'f':(x.ds===t0?'t':(we?'w':'')))+'" title="'+E(thDow(x.ds)+' '+thD(x.ds))+' · '+baht(x.v)+(x.ds>t0?' ('+laT('จองไว้แล้ว)'):'')+'" style="height:'+Math.max(1,Math.round(x.v*100/mx))+'%"></i>'; }).join('')+'</div>'
      + '<div class="eb-axis"><span>'+E(thD(addDays(t0,-29)))+'</span><span>'+E(thD(addDays(t0,-15)))+'</span><span>'+laT('วันนี้')+'</span><span>'+E(thD(addDays(t0,14)))+'</span></div>'
      + '<div class="eb-lgd"><i style="background:var(--eb-s3)"></i>'+laT('วันธรรมดา')+' <i style="background:var(--eb-s4)"></i>'+laT('เสาร์–อาทิตย์')+' <i class="hatch"></i>'+laT('จองไว้แล้ว (ยังเพิ่มได้)')+'</div>';
    var nat=Object.keys(A.byNat).map(function(k){ return {l:A.byNat[k].name, v:A.byNat[k].rev}; }).sort(function(a,b){ return b.v-a.v; }).slice(0,5);
    h+='<div class="eb-sec">'+laT('แนวโน้มรายได้')+'</div><div class="eb-grid eb-r2">'
      + '<div class="eb-card"><h2>'+laT('รายได้รายวัน · 30 วันที่ผ่านมา + 14 วันข้างหน้า')+src(laT('ที่มา')+': Booking')+'</h2>'+bars+'</div>'
      + '<div class="eb-card"><h2>'+laT('ช่องทาง · ตลาด')+' <span class="eb-tag">'+laT('สัดส่วนรายได้')+E(R.lbl)+'</span></h2>'+chanCard(A.byChan,laT('ช่องทางขาย'))
      + '<div style="font-size:11.5px;color:var(--eb-ink2);font-weight:600;margin-bottom:4px">'+laT('สัญชาติ (รายได้)')+'</div>'+(nat.length?hbar(nat,baht):'<div class="eb-none">—</div>')+'</div></div>';

    h+=cxSection(CX, R, t0);   /* §ebCost · ต้นทุน · กำไร */

    /* โปรแกรม · เอเย่นต์ */
    var fams=Object.keys(A.byFam).map(function(k){ var F=A.byFam[k], L=Al.byFam[k]; return {f:F.f, rev:F.rev, pax:F.pax, ly:L?L.rev:0}; })
      .sort(function(a,b){ return b.rev-a.rev; });
    var ags=Object.keys(A.byAg).map(function(k){ var a=A.byAg[k], L=Al.byAg[k]; return Object.assign({ly:L?L.rev:0}, a); }).sort(function(a,b){ return b.rev-a.rev; });
    var top5=ags.slice(0,5), top5v=top5.reduce(function(s,a){ return s+a.rev; },0);
    var drop=ags.filter(function(a){ return a.ly>0 && a.rev<a.ly*0.8 && a.k!=='__b2c'; }).slice(0,3);
    h+='<div class="eb-sec">'+laT('รายได้ตามโปรแกรม · เอเย่นต์')+'</div><div class="eb-grid eb-r3">'
      + '<div class="eb-card"><h2>'+laT('โปรแกรม')+' · '+E(R.lbl)+src(laT('ที่มา: Booking · P&amp;L รายทริป'))+'</h2><table class="eb-tbl"><thead><tr><th>'+laT('โปรแกรม')+'</th><th>'+laT('รายได้')+'</th><th>'+laT('สัดส่วน')+'</th><th>vs '+laT('ปีก่อน')+'</th><th>Pax</th><th>'+laT('รายได้/หัว')+'</th></tr></thead><tbody>'
      + (fams.length?fams.map(function(x){ return '<tr><td><span class="eb-dot" style="background:'+E(x.f.color||'#8b909c')+'"></span><b>'+E(x.f.name)+'</b></td><td><b>'+baht(x.rev)+'</b></td><td>'+pct(x.rev,A.rev)+'%</td><td>'+chg(x.rev,x.ly)+'</td><td>'+num(x.pax)+'</td><td>'+(x.pax?'฿'+num(x.rev/x.pax):'—')+'</td></tr>'; }).join('')
        :'<tr><td colspan="6" class="eb-none">'+laT('ยังไม่มีรายได้ในช่วงนี้')+'</td></tr>')
      + '</tbody></table></div>'
      + '<div class="eb-card"><h2>'+laT('เอเย่นต์ · Top 5 ตามรายได้')+src(laT('ที่มา')+': Booking')+'</h2><table class="eb-tbl"><thead><tr><th>'+laT('เอเย่นต์')+'</th><th>'+laT('รายได้')+'</th><th>vs '+laT('ปีก่อน')+'</th><th>'+laT('รายได้/หัว')+'</th><th>Pax</th></tr></thead><tbody>'
      + (top5.length?top5.map(function(a){
          return '<tr><td><b>'+E(a.name)+'</b></td><td><b>'+baht(a.rev)+'</b></td><td>'+chg(a.rev,a.ly)+'</td><td>'+(a.pax?'฿'+num(a.rev/a.pax):'—')+'</td><td>'+num(a.pax)+'</td></tr>'; }).join('')
        :'<tr><td colspan="5" class="eb-none">—</td></tr>')
      + '</tbody></table><div class="eb-foot">Top 5 = '+pct(top5v,A.rev)+'% '+laT('ของรายได้')+(drop.length?(' · '+laT('ยอดตกเกิน 20% vs ปีก่อน')+': '+drop.map(function(a){ return E(a.name); }).join(', ')):'')+'</div></div></div>';

    /* ส่วนลด · หลุดมือ */
    h+='<div class="eb-sec">'+laT('ส่วนลด · รายได้ที่หลุดมือ')+'</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>'+laT('ส่วนลดที่ให้ไป')+' <span class="eb-tag">'+E(R.lbl)+'</span>'+src(laT('ที่มา')+': Booking')+'</h2>'
      + hbar([{l:'FOC',v:Lk.foc},{l:laT('ส่วนลด'),v:Lk.disc}], baht)
      + '<div class="eb-foot">'+laT('รวม')+' '+baht(Lk.foc+Lk.disc)+' · '+(A.rev?((Lk.foc+Lk.disc)*100/(A.rev+Fut.rev||1)).toFixed(1):'0')+'% '+laT('ของรายได้ทั้งช่วง')+'</div></div>'
      + '<div class="eb-card"><h2>'+laT('รายได้ที่หลุดมือ')+' <span class="eb-tag">'+E(R.lbl)+'</span>'+src(laT('ที่มา: เช็คอิน')+' · Travel Summary')+'</h2><div class="eb-rows two">'
      + '<div class="rw"><span class="lb">No-show · '+num(Lk.ns)+' pax</span><span class="vv">'+baht(Lk.nsV)+'</span></div>'
      + '<div class="rw"><span class="lb">'+laT('ยกเลิกหน้างาน')+' · '+num(Lk.cx)+' pax</span><span class="vv">'+baht(Lk.cxV)+'</span></div>'
      + '<div class="rw"><span class="lb">'+laT('ยกเลิกเพราะอากาศ')+' · '+num(Lk.wx)+' pax</span><span class="vv">'+baht(Lk.wxV)+'</span></div>'
      + '</div><div class="eb-foot">'+laT('มูลค่าประมาณจากราคาต่อหัวของใบนั้น · รายละเอียดค่าปรับดูที่')+' Travel Summary</div></div>'
      + '</div>';
    return h;
  }

  /* ══ §execSales (2026-10-17) · แท็บ Sales Performance ═══════════════════
     owner ส่งไฟล์ "SALES PERFORMANCE 11-17 October 2026 · WEEKLY REPORT.xlsx" แล้วบอก "ดูอันนี้ แล้วเพิ่มอีกแท็บนึง"
     ไฟล์นั้นทำมือจากการเทียบยอดสะสมสองช่วง (จึงมีเลขติดลบ และเซลส์คนใหม่ "ยังไม่มีฐานให้หัก")
     แท็บนี้คิดจากใบจองตรง ๆ ตามวันที่ใบเข้าระบบ (_dashBkDay) · เปิดดูได้ทุกเมื่อ ไม่ต้องรอสิ้นสัปดาห์
     ชุดตัวเลขเดียวกับไฟล์: ตารางอันดับเซลส์ · แนวโน้ม 7 ช่วง (ต่อวัน) · MTD + Activation
       · เอเยนต์ที่ส่งยอดของแต่ละเซลส์ (★ใหม่) · Top 10 เอเยนต์ · เอเยนต์ที่เงียบไป
     นับ: ใบที่เข้าระบบในช่วงและยังไม่ยกเลิก (ไม่นับ quote / ใบภายในที่ไม่มีมูลค่า)
     เซลส์ = bk.soldBy ถ้ามี ไม่งั้นเซลส์ที่ดูแลเอเยนต์ (กติกาเดียวกับ Sales Board / Daily PFM)
     สัปดาห์ = อาทิตย์–เสาร์ (11–17 ต.ค. ในไฟล์ตรงกับแบบนี้) · ใช้ทั้งบริษัท ไม่กรองท่า */
  function sidOf(b){ return b.soldBy || (((typeof sbGetAgent==='function') && sbGetAgent(b.agentId))||{}).sales || ''; }
  function salesOf(sid){ var s=(sid && typeof sbGetSales==='function')?sbGetSales(sid):null;
    return {id:sid||'__none', name:s?(s.name||sid):laT('ไม่มีเซลส์ดูแล'), color:s?(s.color||'#185FA5'):'#B8B3C8', none:!s}; }
  function agKey(b){ return (typeof laIsB2C==='function' && laIsB2C(b)) ? '__b2c' : (b.agentId||'__none'); }
  function weekStart(ds){ var d=dt(ds); d.setDate(d.getDate()-d.getDay()); return ymd(d); }
  function monStart(ds){ return ds.slice(0,8)+'01'; }
  function monEnd(ds){ var d=dt(ds); return ymd(new Date(d.getFullYear(), d.getMonth()+1, 0)); }
  function addMon(ds,n){ var d=dt(monStart(ds)); return ymd(new Date(d.getFullYear(), d.getMonth()+n, 1)); }
  function nDays(a,b){ return Math.round((dt(b)-dt(a))/86400000)+1; }
  function spRange(kind, off){
    var t0=today(), s, e;
    if(kind==='month'){ s=addMon(t0,off); e=monEnd(s); }
    else { s=addDays(weekStart(t0),7*off); e=addDays(s,6); }
    var to=e<t0?e:t0;
    return {from:s, end:e, to:to, days:Math.max(1,nDays(s,to)), full:e<=t0};
  }
  function spLabel(r, kind){
    if(kind==='month'){ var d=dt(r.from), M=(typeof laMonAbbr==='function')?laMonAbbr():((typeof laMonAbbrTH==='function')?laMonAbbrTH():[]);   /* §ebEN */ return (M[d.getMonth()]||'')+' '+d.getFullYear()+(r.full?'':' · '+laT('ถึง')+' '+thD(r.to)+' ('+r.days+' '+laT('วัน)')); }
    return thD(r.from)+' – '+thD(r.end)+(r.full?'':' · '+laT('ถึงวันนี้')+' '+r.days+' '+laT('วัน'));
  }
  var _spFirst=null, _spFirstAt=0;
  function agentFirstDay(){
    if(_spFirst && Date.now()-_spFirstAt<30000) return _spFirst;
    var m={}; (SB_BOOKINGS||[]).forEach(function(b){ if(!isSale(b)) return; var k=agKey(b), d=bkDay(b); if(!d || k==='__b2c') return; if(!m[k] || d<m[k]) m[k]=d; });
    _spFirst=m; _spFirstAt=Date.now(); return m;
  }
  /* ใบที่เข้าระบบในช่วง · รวมต่อเซลส์ / ต่อเอเยนต์ */
  function spAgg(from, to){
    var S={}, tot={pax:0, val:0, n:0, foc:0, ag:{}};
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!isLive(b)) return; var d=bkDay(b); if(!d || d<from || d>to) return;
      var so=salesOf(sidOf(b)), k=agKey(b), p=0, f=0, v=money(b);
      (b.trips||[]).forEach(function(t){ if(!t) return; p+=pax(t); f+=paxK(t,'foc'); });
      var X=S[so.id]=S[so.id]||{s:so, pax:0, val:0, n:0, foc:0, cx:0, cxV:0, ag:{}};
      [X, tot].forEach(function(o){ o.pax+=p; o.val+=v; o.n++; o.foc+=f;
        var A=o.ag[k]=o.ag[k]||{k:k, name:agentName(b), sid:so.id, pax:0, val:0, n:0, cx:0}; A.pax+=p; A.val+=v; A.n++; });
    });
    /* §execSalesNet (2026-10-17) · owner ตอบ "โอเคทำ" ต่อข้อเสนอให้ตรงกับวิธีคิดในไฟล์ WEEKLY REPORT
       ใบที่จองไว้ก่อนช่วงนี้ แล้วถูกยกเลิกภายในช่วงนี้ → หักออกจากยอดของช่วงนี้ (ไฟล์ขึ้นเป็นเลขติดลบ เช่น ODEON −1)
       ใบที่จองและยกเลิกในช่วงเดียวกันไม่ได้ถูกนับตั้งแต่แรก จึงไม่หักซ้ำ · จำนวนใบไม่ลด (นับเฉพาะใบที่เข้ามา) */
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b || CXL.indexOf(b.status)<0) return;
      if(typeof laIsInternalFree==='function' && laIsInternalFree(b)) return;
      var c=cxlDay(b), d=bkDay(b); if(!c || c<from || c>to || !d || d>=from) return;
      var so=salesOf(sidOf(b)), k=agKey(b), p=0, f=0, v=money(b);
      (b.trips||[]).forEach(function(t){ if(!t) return; p+=pax(t); f+=paxK(t,'foc'); });
      var X=S[so.id]=S[so.id]||{s:so, pax:0, val:0, n:0, foc:0, cx:0, cxV:0, ag:{}};
      [X, tot].forEach(function(o){ o.pax-=p; o.val-=v; o.foc-=f; o.cx=(o.cx||0)+p; o.cxV=(o.cxV||0)+v;
        var A=o.ag[k]=o.ag[k]||{k:k, name:agentName(b), sid:so.id, pax:0, val:0, n:0, cx:0}; A.pax-=p; A.val-=v; A.cx+=p; });
    });
    return {S:S, tot:tot};
  }
  function spOrder(S){ return Object.keys(S).map(function(k){ return S[k]; }).sort(function(a,b){ return (a.s.none-b.s.none) || (b.val-a.val); }); }
  function viewSales(){
    var kind=EB.sp||'week', off=+EB.off||0, R=spRange(kind, off), P=spRange(kind, off-1);
    var A=spAgg(R.from, R.to), B=spAgg(P.from, (kind==='month'?addDays(P.from,R.days-1):P.to));
    var first=agentFirstDay(), T=A.tot, Tp=B.tot, perD=function(x){ return x/R.days; };
    /* เงียบไป · สัปดาห์: ส่งในเดือนนี้ก่อนสัปดาห์นี้ (ต้นเดือน = 4 สัปดาห์ก่อนหน้า) · เดือน: ส่งเดือนก่อนแต่เดือนนี้ยังไม่ส่ง */
    var qFrom, qTo=addDays(R.from,-1), qLbl;
    if(kind==='month'){ qFrom=addMon(R.from,-1); qLbl=laT('ส่งยอดเดือนก่อน แต่เดือนนี้ยังเงียบ'); }
    else { qFrom=monStart(R.to); if(qFrom>qTo){ qFrom=addDays(R.from,-28); qLbl=laT('ส่งยอดใน 4 สัปดาห์ก่อน แต่สัปดาห์นี้เงียบ'); } else qLbl=laT('ส่งยอดเดือนนี้แล้ว แต่สัปดาห์นี้เงียบ'); }
    var Q=qFrom<=qTo?spAgg(qFrom,qTo):{tot:{ag:{}}};
    var quiet=Object.keys(Q.tot.ag).filter(function(k){ return k!=='__b2c' && k!=='__none' && Q.tot.ag[k].n>0 && Q.tot.ag[k].pax>0 && !(T.ag[k] && T.ag[k].n>0); }).map(function(k){ return Q.tot.ag[k]; }).sort(function(a,b){ return b.pax-a.pax; });
    var rows=spOrder(A.S), isNew=function(k){ return k!=='__b2c' && first[k] && first[k]>=R.from && first[k]<=R.to; };
    var newN=Object.keys(T.ag).filter(isNew).length, sentN=Object.keys(T.ag).filter(function(k){ return k!=='__b2c' && k!=='__none' && T.ag[k].n>0; }).length;
    var h='<div class="eb-grid eb-kpis">'
      + kpi('Pax '+laT('ที่ขายได้ (สุทธิ)'), num(T.pax), (T.cx?laT('หักยกเลิก')+' '+num(T.cx)+' · ':'')+perD(T.pax).toFixed(1)+' / '+laT('วัน')+' · '+chg(perD(T.pax), Tp.pax/R.days)+' vs '+laT('ช่วงก่อน'))
      + kpi(laT('ยอดขาย (Value sold)'), baht(T.val), baht(perD(T.val))+' / '+laT('วัน')+' · '+chg(T.val, Tp.val))
      + kpi(laT('ใบจอง'), num(T.n), (T.n?(T.pax/T.n).toFixed(2):'0')+' pax / '+laT('ใบ')+' · '+chg(T.n, Tp.n))
      + kpi('FOC', num(T.foc)+'<small>pax</small>', (T.pax?(T.foc*100/T.pax).toFixed(1):'0')+'% '+laT('ของ')+' pax'+(Tp.pax?(' · '+laT('ช่วงก่อน')+' '+(Tp.foc*100/Tp.pax).toFixed(1)+'%'):''), (T.pax && T.foc/T.pax>0.1)?'warn':'')
      + kpi('THB / Pax', '฿'+num(T.pax?T.val/T.pax:0), chg(T.pax?T.val/T.pax:0, Tp.pax?Tp.val/Tp.pax:0)+' vs '+laT('ช่วงก่อน'))
      + kpi(laT('เอเยนต์ที่ส่งยอด'), num(sentN), '<span class="eb-up">★ '+laT('ใหม่')+' '+num(newN)+'</span> · '+laT('เงียบไป')+' '+num(quiet.length))
      + '</div>';

    /* ตารางอันดับเซลส์ */
    var M = kind==='month';
    var agAll=function(sid){ return (typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).filter(function(a){ return a && a.sales===sid && a.active!==false && a.status!=='inactive'; }).length; };
    var head='<tr><th>#</th><th>'+laT('เซลส์')+'</th><th>Pax</th><th>'+laT('ยอดขาย')+'</th><th>% '+laT('ยอดขาย')+'</th><th>'+laT('ใบ')+'</th><th title="Pax '+laT('ของใบที่จองไว้ก่อนช่วงนี้ แล้วยกเลิกในช่วงนี้ · หักออกจาก Pax / ยอดขายแล้ว')+'">'+laT('หักยกเลิก')+'</th><th>FOC</th><th>FOC %</th><th>THB / Pax</th><th>Pax / '+laT('วัน')+'</th><th>vs '+laT('ช่วงก่อน')+'</th><th>'+laT('เอเยนต์ส่ง')+'</th><th>★ '+laT('ใหม่')+'</th><th>'+laT('เงียบไป')+'</th>'
      +(M?'<th>'+laT('เอเยนต์ทั้งหมด')+'</th><th>Activation</th><th>Pax / '+laT('เอเยนต์')+'</th>':'<th>'+laT('เอเยนต์อันดับ 1')+'</th>')+'</tr>';
    var rank=0;
    var body=rows.map(function(x){
      var aks=Object.keys(x.ag).filter(function(k){ return k!=='__b2c' && k!=='__none' && x.ag[k].n>0; }), nNew=aks.filter(isNew).length;
      var nq=quiet.filter(function(q){ return q.sid===x.s.id; }).length;
      var topA=Object.keys(x.ag).map(function(k){ return x.ag[k]; }).sort(function(a,b){ return b.pax-a.pax; })[0];
      var pv=B.S[x.s.id], all=x.s.none?0:agAll(x.s.id);
      if(!x.s.none) rank++;
      return '<tr'+(x.s.none?' class="eb-dim"':'')+'><td>'+(x.s.none?'':rank)+'</td><td><span class="eb-dot" style="background:'+E(x.s.color)+'"></span><b>'+E(x.s.name)+'</b></td>'
        +'<td><b>'+num(x.pax)+'</b></td><td><b>'+baht(x.val)+'</b></td>'
        +'<td><div class="eb-pct"><span><i style="width:'+pct(x.val,T.val)+'%;background:'+E(x.s.color)+'"></i></span>'+pct(x.val,T.val)+'%</div></td>'
        +'<td>'+num(x.n)+'</td><td>'+(x.cx?'<span class="eb-dn">−'+num(x.cx)+'</span>':'<span class="eb-mut">0</span>')+'</td><td>'+num(x.foc)+'</td><td>'+(x.pax?(x.foc*100/x.pax>10?'<span class="eb-st w">'+(x.foc*100/x.pax).toFixed(1)+'%</span>':(x.foc*100/x.pax).toFixed(1)+'%'):'—')+'</td>'
        +'<td>฿'+num(x.pax?x.val/x.pax:0)+'</td><td>'+(x.pax/R.days).toFixed(1)+'</td><td>'+chg(x.pax/R.days, pv?pv.pax/R.days:0)+'</td>'
        +'<td>'+num(aks.length)+'</td><td>'+(nNew?'<span class="eb-up">'+nNew+'</span>':'<span class="eb-mut">0</span>')+'</td><td>'+(nq?num(nq):'<span class="eb-mut">0</span>')+'</td>'
        +(M ? '<td>'+(all||'—')+'</td><td>'+(all?pct(aks.length,all)+'%':'—')+'</td><td>'+(aks.length?(x.pax/aks.length).toFixed(1):'—')+'</td>'
            : '<td class="eb-l" title="'+E(topA?topA.name:'')+'">'+(topA?E(topA.name)+' <span class="eb-mut">'+pct(topA.pax,x.pax)+'%</span>':'—')+'</td>')
        +'</tr>';
    }).join('');
    var allTeam=M?(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).filter(function(a){ return a && a.sales && a.active!==false && a.status!=='inactive'; }).length:0;
    var foot='<tr class="eb-tot"><td></td><td><b>'+laT('รวมทั้งทีม')+'</b></td><td><b>'+num(T.pax)+'</b></td><td><b>'+baht(T.val)+'</b></td><td>100%</td><td>'+num(T.n)+'</td><td>'+(T.cx?'<span class="eb-dn">−'+num(T.cx)+'</span>':'0')+'</td><td>'+num(T.foc)+'</td><td>'+(T.pax?(T.foc*100/T.pax).toFixed(1)+'%':'—')+'</td>'
      +'<td>฿'+num(T.pax?T.val/T.pax:0)+'</td><td>'+(T.pax/R.days).toFixed(1)+'</td><td>'+chg(T.pax, Tp.pax)+'</td><td>'+num(sentN)+'</td><td>'+num(newN)+'</td><td>'+num(quiet.length)+'</td>'
      +(M?'<td>'+num(allTeam)+'</td><td>'+(allTeam?pct(sentN,allTeam)+'%':'—')+'</td><td>'+(sentN?(T.pax/sentN).toFixed(1):'—')+'</td>':'<td></td>')+'</tr>';
    h+='<div class="eb-sec">'+laT('อันดับเซลส์')+' · '+E(spLabel(R,kind))+'</div><div class="eb-card eb-scroll"><h2>'+laT('ยอดขายตามเซลส์')+' <span class="eb-tag">'+laT('นับตามวันที่ใบเข้าระบบ · หักใบเก่าที่ยกเลิกในช่วงนี้ · ไม่นับ')+' quote</span>'+src(laT('ที่มา')+': Booking · Sales')+'</h2>'
      +'<table class="eb-tbl eb-sp">'+'<thead>'+head+'</thead><tbody>'+(body||'<tr><td colspan="17" class="eb-none">'+laT('ยังไม่มีใบจองในช่วงนี้')+'</td></tr>')+foot+'</tbody></table>'
      +'<div class="eb-foot">vs '+laT('ช่วงก่อน')+' = Pax '+laT('ต่อวันเทียบ')+(kind==='month'?laT('เดือนก่อน (จำนวนวันเท่ากัน)'):laT('สัปดาห์ก่อน'))+' · ★ '+laT('ใหม่')+' = '+laT('เอเยนต์ที่ส่งใบแรกในระบบภายในช่วงนี้ · เงียบไป')+' = '+E(qLbl)+'</div></div>';

    /* แนวโน้ม 7 ช่วง · ต่อวัน */
    var per=[]; for(var i=6;i>=0;i--){ var r=spRange(kind, off-i); var a=spAgg(r.from, r.to); per.push({r:r, a:a}); }
    var sids=rows.filter(function(x){ return !x.s.none; }).map(function(x){ return x.s; });
    per.forEach(function(p){ Object.keys(p.a.S).forEach(function(k){ var so=p.a.S[k].s; if(!so.none && !sids.some(function(s){ return s.id===so.id; })) sids.push(so); }); });
    var trendTbl=function(key, fmt){
      var mx=1; per.forEach(function(p){ sids.forEach(function(s){ var v=(p.a.S[s.id]||{})[key]||0; v/=p.r.days; if(v>mx) mx=v; }); });
      var tmx=Math.max.apply(null,[1].concat(per.map(function(p){ return p.a.tot[key]/p.r.days; })));
      var line=function(name, color, vals, m){ var last=vals[vals.length-1], prev=vals[vals.length-2];
        return '<tr><td><span class="eb-dot" style="background:'+E(color)+'"></span><b>'+E(name)+'</b></td><td><div class="eb-spark">'
          + vals.map(function(v,j){ return '<i title="'+E(spLabel(per[j].r,kind))+' · '+fmt(v)+' / '+laT('วัน')+'" style="height:'+Math.max(2,Math.round(v*100/m))+'%;background:'+(j===vals.length-1?E(color):'var(--eb-s2)')+'"></i>'; }).join('')
          + '</div></td><td><b>'+fmt(last)+'</b></td><td>'+chg(last, prev)+'</td></tr>'; };
      return '<table class="eb-tbl eb-tr"><thead><tr><th>'+laT('เซลส์')+'</th><th>7 '+(kind==='month'?laT('เดือน'):laT('สัปดาห์'))+' ('+laT('ต่อวัน)')+'</th><th>'+laT('ล่าสุด')+'</th><th>vs '+laT('ก่อนหน้า')+'</th></tr></thead><tbody>'
        + sids.map(function(s){ return line(s.name, s.color, per.map(function(p){ return ((p.a.S[s.id]||{})[key]||0)/p.r.days; }), mx); }).join('')
        + line(laT('ทั้งทีม'), '#0F1B3D', per.map(function(p){ return p.a.tot[key]/p.r.days; }), tmx)
        + '</tbody></table>';
    };
    h+='<div class="eb-sec">'+laT('แนวโน้ม 7')+' '+(kind==='month'?laT('เดือน'):laT('สัปดาห์'))+' · '+E(spLabel(per[0].r,kind).split(' · ')[0])+' '+laT('ถึง')+' '+E(spLabel(R,kind).split(' · ')[0])+'</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>Pax '+laT('ต่อวัน')+'</h2>'+trendTbl('pax', function(v){ return v.toFixed(1); })+'</div>'
      + '<div class="eb-card"><h2>'+laT('ยอดขายต่อวัน')+'</h2>'+trendTbl('val', baht)+'</div></div>';

    /* Top 10 · เงียบไป */
    var top=Object.keys(T.ag).filter(function(k){ return k!=='__none' && T.ag[k].n>0; }).map(function(k){ return T.ag[k]; }).sort(function(a,b){ return b.pax-a.pax; }).slice(0,10);
    h+='<div class="eb-sec">'+laT('เอเยนต์')+'</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>Top 10 '+laT('เอเยนต์')+' <span class="eb-tag">'+E(spLabel(R,kind))+'</span></h2><table class="eb-tbl eb-l2"><thead><tr><th>#</th><th>'+laT('เอเยนต์')+'</th><th>'+laT('เซลส์')+'</th><th>Pax</th><th>'+laT('ยอดขาย')+'</th></tr></thead><tbody>'
      + (top.length?top.map(function(a,i){ var so=salesOf(a.sid==='__none'?'':a.sid);
          return '<tr><td>'+(i+1)+'</td><td class="eb-l"><b>'+E(a.name)+'</b>'+(isNew(a.k)?' <span class="eb-new">★ '+laT('ใหม่')+'</span>':'')+'</td><td><span class="eb-dot" style="background:'+E(so.color)+'"></span>'+E(so.name)+'</td><td><b>'+num(a.pax)+'</b></td><td>'+baht(a.val)+'</td></tr>'; }).join('')
        :'<tr><td colspan="5" class="eb-none">—</td></tr>')+'</tbody></table></div>'
      + '<div class="eb-card"><h2>'+laT('เอเยนต์ที่เงียบไป')+' <span class="eb-tag">'+E(qLbl)+' · '+num(quiet.length)+' '+laT('ราย')+'</span></h2>'
      + (quiet.length?'<div class="eb-qscroll"><table class="eb-tbl eb-l2"><thead><tr><th>#</th><th>'+laT('เอเยนต์')+'</th><th>'+laT('เซลส์')+'</th><th>Pax '+laT('ช่วงก่อน')+'</th></tr></thead><tbody>'
          + quiet.map(function(a,i){ var so=salesOf(a.sid==='__none'?'':a.sid); return '<tr><td>'+(i+1)+'</td><td class="eb-l">'+E(a.name)+'</td><td><span class="eb-dot" style="background:'+E(so.color)+'"></span>'+E(so.name)+'</td><td>'+num(a.pax)+'</td></tr>'; }).join('')
          + '</tbody></table></div>':'<div class="eb-none">'+laT('ไม่มีเอเยนต์ที่เงียบไป')+'</div>')+'</div></div>';

    /* เอเยนต์ที่ส่งยอด แยกตามเซลส์ */
    h+='<div class="eb-sec">'+laT('เอเยนต์ที่ส่งยอดเข้ามา · แยกตามเซลส์')+'</div><div class="eb-mv">'
      + rows.map(function(x, i){
          var L=Object.keys(x.ag).map(function(k){ return x.ag[k]; }).sort(function(a,b){ return b.pax-a.pax; });
          var nNew=L.filter(function(a){ return isNew(a.k); }).length, mx=Math.max.apply(null,[1].concat(L.map(function(a){ return a.pax; })));
          return '<div class="eb-card"><h2><span class="eb-dot" style="background:'+E(x.s.color)+'"></span>'+(x.s.none?'':'#'+(i+1)+' ')+E(x.s.name)+'</h2>'
            + '<div class="eb-foot" style="margin:-6px 0 8px">'+num(L.filter(function(a){ return a.n>0; }).length)+' '+laT('ราย')+' · ★ '+laT('ใหม่')+' '+num(nNew)+' · '+num(x.pax)+' pax · '+baht(x.val)+'</div>'
            + '<div class="eb-mvl">'+L.slice(0,12).map(function(a){ return '<div class="rw" title="'+E(a.name+' · '+a.pax+' pax · '+baht(a.val)+' · '+a.n+' '+laT('ใบ'))+'"><span class="lb">'+E(a.name)+(isNew(a.k)?' <span class="eb-new">★</span>':'')+'</span><span class="mini"><i style="width:'+Math.max(0,Math.round(a.pax*100/mx))+'%;background:'+E(x.s.color)+'"></i></span><span class="vv"'+(a.pax<0?' style="color:var(--eb-bad)" title="'+laT('ยกเลิกใบเก่า')+'"':'')+'>'+num(a.pax)+'</span></div>'; }).join('')
            + (L.length>12?'<div class="eb-foot">+ '+laT('อีก')+' '+(L.length-12)+' '+laT('ราย')+'</div>':'')+'</div></div>';
        }).join('')+'</div>';
    return h;
  }

  /* ══ §execGap (2026-10-17) · แท็บ Gap to Target ═════════════════════════
     owner: "เห็นภาพรวมแล้วก็จริง แต่ยังไม่สามารถแก้ pain point ยอดลูกค้าที่ไม่เต็มได้ · ต้องมีแผน Monthly Weekly Daily
             เพื่อให้ถึงเป้าที่วางเรือไว้" → ตกลงแนวแล้ว "ทำ" (แสดงอย่างเดียวก่อน · ยังไม่บันทึกการตัดสินใจ)
     หลัก: เป้า = ที่นั่งที่วางเรือ (getAllotment.availableCapacity) × LF เป้า · ดูข้างหน้า ไม่ใช่ย้อนหลัง · ช่องว่างมีเจ้าของ (เซลส์)
     เพซ: booking curve ต่อเส้นทาง วัดจากทริปที่ออกไปแล้วใน 90 วัน (สัดส่วนของ pax สุดท้ายที่จองแล้ว ณ L วันก่อนออก)
          ทริปไม่พอ (<5) ใช้ curve รวมทั้งบริษัท · ไม่มีเลย ใช้ค่าตั้งต้นจากที่วัดได้ (40% ของ pax จองภายใน 7 วัน)
     แบ่งเป้าให้เซลส์: สัดส่วน pax ของเซลส์ต่อกลุ่มเส้นทาง ในเดือนเดียวกันปีก่อน · ไม่มี → 90 วันล่าสุด
     จุดคุ้มทุนต่อเที่ยว: pxDay(date) (Trip P&L) · ผิดพลาด/ไม่มีแผนต้นทุน → ไม่แสดงกรอบแดง
     ⚠ LF เป้า 90% ทุกเส้นทาง (EB_LF_TARGET) · ยังไม่มีที่ตั้งค่าต่อเส้นทาง */
  var EB_LF_TARGET=0.90, EB_HORIZON=14;
  var CURVE_DEF=[[0,1],[1,.81],[2,.72],[3,.70],[5,.68],[7,.60],[14,.53],[21,.45],[30,.35],[60,.15],[90,.05],[120,0]];
  function curveAt(C, L){ if(L<=0) return 1; for(var i=1;i<C.length;i++){ if(L<=C[i][0]){ var a=C[i-1], b=C[i]; return a[1]+(b[1]-a[1])*(L-a[0])/(b[0]-a[0]); } } return 0; }
  var _gc=null, _gcAt=0;
  /* booking curve · {rid:{pts,n}, all:{pts,n}} */
  function curves(){
    if(_gc && Date.now()-_gcAt<60000) return _gc;
    var t0=today(), from=addDays(t0,-90), L=[0,1,2,3,5,7,14,21,30,60,90,120];
    var byR={}, all={fin:0, at:L.map(function(){ return 0; }), n:0};
    var trips={};
    var I=idx();
    datesIn(I, from, addDays(t0,-1)).forEach(function(ds){ I.byDate[ds].forEach(function(x){ if(!x.live) return; var d=bkDay(x.b); if(!d) return; var t=x.t;
        var k=t.routeId+'|'+t.date, T=trips[k]=trips[k]||{rid:t.routeId, fin:0, at:L.map(function(){ return 0; })};
        var p=pax(t), lead=nDays(d,t.date)-1; T.fin+=p; L.forEach(function(l,i){ if(lead>=l) T.at[i]+=p; }); }); });
    Object.keys(trips).forEach(function(k){ var T=trips[k]; if(T.fin<5) return;
      var R=byR[T.rid]=byR[T.rid]||{fin:0, at:L.map(function(){ return 0; }), n:0};
      R.fin+=T.fin; R.n++; all.fin+=T.fin; all.n++; L.forEach(function(l,i){ R.at[i]+=T.at[i]; all.at[i]+=T.at[i]; }); });
    var mk=function(R){ return R && R.n>=5 && R.fin>0 ? {pts:L.map(function(l,i){ return [l, R.at[i]/R.fin]; }), n:R.n} : null; };
    var out={byR:{}, all:mk(all)||{pts:CURVE_DEF, n:0}, def:!mk(all)};
    Object.keys(byR).forEach(function(r){ var c=mk(byR[r]); if(c) out.byR[r]=c; });
    _gc=out; _gcAt=Date.now(); return out;
  }
  function curveOf(rid){ var C=curves(); return C.byR[rid]||C.all; }
  /* เที่ยวหนึ่งในวันหนึ่ง */
  function tripState(rid, ds){
    var t0=today(), al=alOf(rid, ds); if(!al || !al.hasAllotment) return null;
    var cap=+al.availableCapacity||0, bk=+al.seatsConsumed||0, free=Math.max(0,+al.seatsAvailable||0), lk=+al.lockedSeats||0;
    var tgt=Math.round(cap*EB_LF_TARGET), lead=nDays(t0,ds)-1, c=curveAt(curveOf(rid).pts, lead);
    var exp=tgt*c, proj=bk+tgt*(1-c), behind=Math.max(0,Math.round(exp-bk));
    var st = (free<=3 || bk>=tgt) ? 'full' : (bk>=exp*0.9 ? 'g' : (proj>=tgt*0.8 ? 'y' : 'r'));
    return {rid:rid, ds:ds, cap:cap, bk:bk, free:free, lk:lk, tgt:tgt, lead:lead, c:c, exp:exp, proj:proj, behind:behind, st:st, gap:Math.max(0,tgt-bk)};
  }
  function beOf(rid, ds){
    if(nDays(today(),ds)-1>7) return 0;                    /* §execPerf · Trip P&L ทั้งวันแพง · คิดเฉพาะที่ต้องตัดสินใจใน 7 วัน */
    var I=idx(), k=ds+'|'+rid;
    if(!(k in I.be)){ var v=0; try{ var day=(typeof TRIPS!=='undefined'&&TRIPS[ds])||{};
      Object.keys(day).forEach(function(bid){ var op=day[bid]; if(!op||op.route!==rid) return; var x=pxTrip(ds,bid); if(x && x.be) v+=x.be; }); }catch(_){} I.be[k]=v; }
    return I.be[k];
  }
  function gapRange(){
    var t0=today();
    if(EB.gp==='month') return {from:t0, to:monEnd(t0), lbl:laT('เดือนนี้'), mFrom:monStart(t0), mTo:monEnd(t0)};
    if(EB.gp==='next'){ var s=addMon(t0,1); return {from:s, to:monEnd(s), lbl:laT('เดือนหน้า'), mFrom:s, mTo:monEnd(s)}; }
    return {from:t0, to:addDays(t0,EB_HORIZON-1), lbl:EB_HORIZON+' '+laT('วันข้างหน้า'), mFrom:monStart(t0), mTo:monEnd(t0)};
  }
  /* สัดส่วนเซลส์ต่อกลุ่มเส้นทาง · ปีก่อนเดือนเดียวกัน หรือ 90 วันล่าสุด */
  function salesShare(mFrom, mTo){
    var t0=today(), tries=[[addYears(mFrom,-1), addYears(mTo,-1)], [addDays(t0,-90), addDays(t0,-1)]], out={fam:{}, src:''};
    for(var i=0;i<tries.length;i++){
      var S={}, tot=0;
      eachTrip(tries[i][0], tries[i][1], function(b,t){ var f=(fam(t.routeId)||{}).id||t.routeId, sid=salesOf(sidOf(b)).id, p=pax(t);
        var F=S[f]=S[f]||{tot:0, by:{}}; F.tot+=p; F.by[sid]=(F.by[sid]||0)+p; tot+=p; });
      if(tot>=50){ out.fam=S; out.src=i===0?laT('เดือนเดียวกันปีก่อน'):'90 '+laT('วันล่าสุด'); return out; }
    }
    return out;
  }
  /* ══ §execAlloc (2026-10-17) · owner "ทำแบบที่คุณคำนวณให้ก่อนด้วย และผู้บริหารแก้ไขได้ · ถ้ากำหนดเป้าแล้วจะดู progress ยังไง"
     เก็บที่ blob key 'exec_alloc' เป็น JSON string → ไปอยู่ app_meta ของเซิร์ฟเวอร์เอง (แบบเดียวกับ cost_plans ของหน้าต้นทุน) ไม่ต้องแตะฐานข้อมูล
     รูป: { "2026-10": { by:{famId:{salesId:pct}}, lf:{famId:pct}, who, at } } · เดือนที่ไม่มีค่า = ใช้สัดส่วนที่คำนวณ
     แก้ได้เมื่อมีสิทธิ์แก้ส่วน sales (laCanEditArea) · เปอร์เซ็นต์ที่ไม่ครบ 100 ของเส้นทาง = "ยังไม่มอบหมาย" ไม่หายไปไหน */
  function allocAll(){ var v=null; try{ v=laBlob().exec_alloc; if(typeof v==='string') v=JSON.parse(v); }catch(_){ v=null; } return (v&&typeof v==='object')?v:{}; }
  function allocOf(ym){ var a=allocAll()[ym]; return (a&&typeof a==='object'&&a.by)?a:null; }
  function allocSave(ym, rec){
    if(typeof laGuardEdit==='function' && !laGuardEdit('sales')) return false;
    try{ var all=allocAll(); if(rec) all[ym]=rec; else delete all[ym]; var d=laBlob(); d.exec_alloc=JSON.stringify(all); laBlobSave(); return true; }catch(e){ console.warn('[execAlloc] save failed', e); return false; }
  }
  function lfOf(ym, famId){ var a=allocOf(ym); var v=a&&a.lf&&+a.lf[famId]; return (v>0&&v<=100)?v/100:EB_LF_TARGET; }
  /* สัดส่วนที่ใช้จริง · ของผู้บริหารก่อน ไม่มีค่อยคำนวณ · คืนรูปเดียวกับ salesShare */
  function shareUsed(R){
    var ym=R.mFrom.slice(0,7), A=allocOf(ym), SH=salesShare(R.mFrom, R.mTo);
    if(!A) return {fam:SH.fam, src:SH.src, calc:SH, manual:false, ym:ym};
    var fam2={}; Object.keys(A.by).forEach(function(f){ var by=A.by[f]||{}, tot=0, o={tot:100, by:{}};
      Object.keys(by).forEach(function(sid){ var v=Math.max(0,+by[sid]||0); if(v>0){ o.by[sid]=v; tot+=v; } });
      if(tot>100){ Object.keys(o.by).forEach(function(sid){ o.by[sid]=o.by[sid]*100/tot; }); tot=100; }
      if(tot<100) o.by.__none=(o.by.__none||0)+(100-tot);
      fam2[f]=o; });
    return {fam:fam2, src:laT('กำหนดโดย')+' '+(A.who||laT('ผู้บริหาร'))+' · '+(A.at?thD(String(A.at).slice(0,10)):''), calc:SH, manual:true, ym:ym, rec:A};
  }
  function canAlloc(){ try{ return (typeof laCanEditArea!=='function') || laCanEditArea('sales'); }catch(_){ return false; } }
  function toast(msg){ try{ var t=document.getElementById('eb-toast'); if(!t){ t=document.createElement('div'); t.id='eb-toast'; document.body.appendChild(t); } t.textContent=msg; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(function(){ t.style.display='none'; }, 2600); }catch(_){} }
  function leadTable(){
    var t0=today(), from=addDays(t0,-90), M={}, tot=0, within7=0, all=0;
    (SB_BOOKINGS||[]).forEach(function(b){ if(!isLive(b)) return; var d=bkDay(b); if(!d) return;
      (b.trips||[]).forEach(function(t){ if(!t||!t.date||t.date<from) return; var lead=Math.max(0,nDays(d,t.date)-1), p=pax(t)||1;
        var m=(typeof laIsB2C==='function'&&laIsB2C(b))?{id:'b2c',name:'B2C '+laT('ออนไลน์')}:((typeof drMarket==='function')?(drMarket(b)||{}):{}); var k=m.id||'?';
        var X=M[k]=M[k]||{name:m.name||laT('ไม่ระบุตลาด'), ls:[], pax:0}; X.ls.push(lead); X.pax+=p; tot+=p; all+=p; if(lead<=7) within7+=p; }); });
    var rows=Object.keys(M).map(function(k){ var ls=M[k].ls.sort(function(a,b){ return a-b; }), n=ls.length; return {name:M[k].name, pax:M[k].pax, n:n, med:ls[Math.floor(n/2)], p25:ls[Math.floor(n/4)], p75:ls[Math.floor(3*n/4)]}; })
      .filter(function(r){ return r.n>=5; }).sort(function(a,b){ return b.pax-a.pax; }).slice(0,8);
    if(!rows.length) return '<div class="eb-none">'+laT('ยังมีข้อมูลไม่พอ')+'</div>';
    var mx=Math.max.apply(null,rows.map(function(r){ return r.med; }).concat([1]));
    return '<table class="eb-tbl eb-l2"><thead><tr><th>#</th><th>'+laT('ตลาด')+'</th><th>'+laT('มัธยฐาน')+'</th><th>'+laT('ครึ่งกลาง')+'</th><th>'+laT('ควรเตือนที่')+'</th><th>'+laT('ทริป')+'</th></tr></thead><tbody>'
      + rows.map(function(r,i){ return '<tr><td>'+(i+1)+'</td><td class="eb-l"><b>'+E(r.name)+'</b></td><td><i class="eb-lb" style="width:'+Math.max(3,Math.round(r.med*80/mx))+'px"></i>'+r.med+' '+laT('วัน')+'</td><td>'+r.p25+'–'+r.p75+'</td><td><b>'+Math.max(2,Math.round(r.p25*1.5))+' '+laT('วัน')+'</b></td><td>'+num(r.n)+'</td></tr>'; }).join('')
      + '</tbody></table><div class="eb-foot">'+(all?pct(within7,all):0)+'% '+laT('ของ pax จองภายใน 7 วันก่อนออก · ควรเตือน')+' = '+laT('เริ่มกังวลเมื่อเหลือวันน้อยกว่านี้ (1.5')+' × '+laT('จุดที่ลูกค้า 25% แรกจองแล้ว)')+'</div>';
  }

  /* ══ §execGap2 (2026-10-19) · Gap to Target วาดใหม่ตามแคนวาส Claude Design (อาร์ตบอร์ด Gap / Alloc / SalesTarget) ═══════
     owner: "ปรับต่อในส่วนของ Gap to Target" → เลือก "วาดใหม่ใน Claude Design" → "เส้นทาง × วัน ไม่ต้องมี scroll"
            → "ขอดูหน้ากำหนดสัดส่วน" → "เซลส์จะรู้ได้ยังไงว่าต้องหาเส้นทางไหน" → "ทำแยกเป็นอีกอันต่อจาก Gap ผู้บริหารจะได้เห็นการเคลื่อนไหวรายวันด้วย" → "ทำทั้งหมดเลย"
     จาก 6 ส่วนที่แน่น เหลือ 4: (1) ประโยคเดียว "ต้องหาอีก N ที่นั่ง" + 4 ตัวเลข · (2) เส้นทาง × วัน แบบไม่เลื่อน (ช่อง = ที่ว่าง · สี = เทียบเส้นโค้ง · มุม = เข้ามาวันนี้ · กดไป By trip)
     · (3) ช่องว่างแบ่งให้เซลส์ บรรทัดเดียวต่อคน กดชื่อกางรายเส้นทาง + วันที่ว่างเยอะ + เอเยนต์ที่เงียบ · (4) ตัดสินใจเที่ยวนี้ (≤3 วัน) + lead time ย่อ
     หน้ากำหนดสัดส่วน (§execAlloc2) เป็นหน้าต่างซ้อน: เดือนนี้/เดือนหน้า · ที่มาของสัดส่วน · เป้า LF แยกเส้นทาง · % → ที่นั่ง · (คำนวณ n) · แถว B2C รับส่วนที่เหลือ · เกลี่ยให้ครบ 100%
     แท็บใหม่ "เป้าเซลส์" (§execSalesTgt): ทั้งทีมวันนี้ได้/ต้องได้ · แท่ง 14 วัน · การ์ดต่อเซลส์ (จุด 7 วัน · ชิปวันนี้ · เส้นทางที่ต้องหา + วันที่ว่างเยอะ · เอเยนต์เงียบ · คัดลอกสรุป) · ทุกคน/เฉพาะฉัน
     ตัวเลขทั้งหมดมาจากของเดิม: tripState/curves (เส้นโค้ง) · beOf (Trip P&L) · shareUsed/allocOf (สัดส่วน) · salesIn/eachMade (ใบที่เข้า) · ไม่มีสูตรใหม่ */
  function famNameOf(f){ var x=(typeof _BKV2_FAMILIES!=='undefined')?_BKV2_FAMILIES.filter(function(y){ return y.id===f; })[0]:null; return (x&&x.name)||(route(f)||{}).name||f; }
  function famColorOf(f){ var x=(typeof _BKV2_FAMILIES!=='undefined')?_BKV2_FAMILIES.filter(function(y){ return y.id===f; })[0]:null; return (x&&x.color)||famColor(f); }
  var DOW_S=['อา','จ','อ','พ','พฤ','ศ','ส'];
  function dShort(d){ return laT(DOW_S[dt(d).getDay()])+' '+dt(d).getDate(); }   /* §ebEN */
  window.ebGoTrip=function(ds, rid){ try{ var el=document.querySelector('.nav-item[data-view="booking"]'); if(el && typeof nav==='function') nav(el);
      if(typeof _bkV2!=='undefined' && _bkV2){ _bkV2.tab='bytrip'; _bkV2.filterDate=ds; if(rid) _bkV2.filterRoute=rid; } if(typeof bkV2Render==='function') bkV2Render(); }catch(_){} };
  /* ข้อมูลร่วมของ Gap / เป้าเซลส์ · R = {from,to,mFrom,mTo} · ช่วงที่ดู (from..to) กับเดือนของเป้า (mFrom..mTo) */
  function gapData(R){
    var t0=today(), SH=shareUsed(R), ymG=R.mFrom.slice(0,7), CV=curves();
    var days=[]; for(var ds=R.from; ds<=R.to; ds=addDays(ds,1)) days.push(ds);
    /* เป้าเดือน (ที่นั่งของเดือน × LF) · จองแล้ว */
    var mT=0, mB=0, fT={}, fB={}, capF={}, bkF={};
    for(ds=R.mFrom; ds<=R.mTo; ds=addDays(ds,1)){ routesOn(ds).forEach(function(rid){ var al=alOf(rid,ds); if(!al||!al.hasAllotment) return;
      var cap=+al.availableCapacity||0, bk=Math.min(+al.seatsConsumed||0,cap), f=(fam(rid)||{}).id||rid;
      mT+=cap*lfOf(ymG,f); mB+=bk; fT[f]=(fT[f]||0)+cap*lfOf(ymG,f); fB[f]=(fB[f]||0)+bk; capF[f]=(capF[f]||0)+cap; bkF[f]=(bkF[f]||0)+bk; }); }
    mT=Math.round(mT); var daysLeft=Math.max(1,nDays(t0,R.mTo)), mGap=Math.max(0,mT-mB), need=mGap/daysLeft;
    /* ช่วงที่ดู · เส้นทาง × วัน */
    var rids={}; days.forEach(function(d){ routesOn(d).forEach(function(r){ var al=alOf(r,d); if(al && al.hasAllotment) rids[r]=1; }); });
    var fams={}; Object.keys(rids).forEach(function(rid){ var f=fam(rid)||{id:rid, name:(route(rid)||{}).name||rid, color:'#8b909c'}; (fams[f.id]=fams[f.id]||{f:f, rids:[]}).rids.push(rid); });
    var famL=Object.keys(fams).map(function(k){ return fams[k]; }).sort(function(a,b){ return famIdx(a.f)-famIdx(b.f); });
    var cells={}, nRisk=0, nTrip=0, nBe=0, beShort=0, hT=0, hB=0, hExp=0, hGap=0, todayIn={}, hIn=0;
    eachMade(t0,t0,function(b){ (b.trips||[]).forEach(function(t){ if(t.date<R.from||t.date>R.to) return; var r=route(t.routeId); if(!pierOk(r)) return; var f=(fam(t.routeId)||{}).id||t.routeId; todayIn[f+'|'+t.date]=(todayIn[f+'|'+t.date]||0)+pax(t); hIn+=pax(t); }); });
    famL.forEach(function(F){ days.forEach(function(d){
      var agg=null; F.rids.forEach(function(rid){ var s=tripState(rid,d); if(!s) return; nTrip++;
        var be=(s.st==='full'||s.st==='g')?0:beOf(rid,d), belowBe=be>0 && s.proj<be;
        if(!agg) agg={cap:0,bk:0,free:0,tgt:0,exp:0,proj:0,behind:0,n:0,lead:s.lead,rids:[],worst:'full',belowBe:false,lk:0,ds:d,fid:F.f.id};
        agg.cap+=s.cap; agg.bk+=s.bk; agg.free+=s.free; agg.tgt+=s.tgt; agg.exp+=s.exp; agg.proj+=s.proj; agg.behind+=s.behind; agg.n++; agg.lk+=s.lk;
        agg.rids.push(Object.assign({be:be, belowBe:belowBe}, s));
        var ord={full:0,g:1,y:2,r:3}; if(ord[s.st]>ord[agg.worst]) agg.worst=s.st; if(belowBe) agg.belowBe=true;
        if(s.st==='r' || belowBe) nRisk++; if(belowBe && s.lead<=7){ nBe++; beShort+=Math.max(0,be-s.bk); }
        if(d>=t0){ hT+=s.tgt; hB+=s.bk; hExp+=s.exp; hGap+=s.gap; }
      });
      if(agg){ agg.in=todayIn[F.f.id+'|'+d]||0; cells[F.f.id+'|'+d]=agg; }
    }); });
    var s7=salesIn(addDays(t0,-7),addDays(t0,-1)), pace7=s7.pax/7, daysLeftH=Math.max(1,nDays(t0,R.to));
    var rpp=(function(){ var a=agg(addDays(t0,-30), addDays(t0,-1)); return a.pax?a.rev/a.pax:0; })();
    /* เซลส์ · เป้า/จองแล้ว ตามสัดส่วน · วันนี้ · 7 วัน · เอเยนต์ที่ควรโทร */
    var SL={}; var ensure=function(sid){ var so=salesOf(sid==='__none'?'':sid); if(sid==='__none' && SH.manual) so=Object.assign({}, so, {name:laT('ยังไม่มอบหมาย')});
      return SL[sid]=SL[sid]||{s:so, tgt:0, bk:0, own:0, pace:0, today:0, d7:[0,0,0,0,0,0,0], calls:[], byF:{}, paceF:{}, todayF:{}}; };
    Object.keys(fT).forEach(function(f){ var sh=SH.fam[f]; if(!sh||!sh.tot){ var o=ensure('__none'); o.tgt+=fT[f]; o.bk+=fB[f]||0; o.byF[f]={tgt:fT[f], bk:fB[f]||0, w:1, own:0}; return; }
      Object.keys(sh.by).forEach(function(sid){ var w=sh.by[sid]/sh.tot, o=ensure(sid); o.tgt+=fT[f]*w; o.bk+=(fB[f]||0)*w; o.byF[f]={tgt:fT[f]*w, bk:(fB[f]||0)*w, w:w, own:0}; }); });
    eachTrip(R.mFrom, R.mTo, function(b,t){ var sid=salesOf(sidOf(b)).id, f=(fam(t.routeId)||{}).id||t.routeId, o=SL[sid]; if(!o) return; o.own+=pax(t); if(o.byF[f]) o.byF[f].own+=pax(t); });
    s7.list.forEach(function(b){ var o=ensure(salesOf(sidOf(b)).id); (b.trips||[]).forEach(function(t){ var p=pax(t)/7, f=(fam(t.routeId)||{}).id||t.routeId; o.pace+=p; if(t.date>=R.mFrom && t.date<=R.mTo) o.paceF[f]=(o.paceF[f]||0)+p; }); });
    for(var k=6;k>=0;k--){ (function(k){ var d=addDays(t0,-k); eachMade(d,d,function(b){ var o=ensure(salesOf(sidOf(b)).id); (b.trips||[]).forEach(function(t){ if(t.date<R.mFrom||t.date>R.mTo) return; var r=route(t.routeId); if(!pierOk(r)) return; var p=pax(t), f=(fam(t.routeId)||{}).id||t.routeId; o.d7[6-k]+=p; if(k===0){ o.today+=p; o.todayF[f]=(o.todayF[f]||0)+p; } }); }); })(k); }
    /* เอเยนต์ที่เงียบ / ที่เคยส่งเส้นที่ว่าง */
    var s14=salesIn(addDays(t0,-14), addDays(t0,-1)), s60=salesIn(addDays(t0,-60), addDays(t0,-15)), last={}, agSid={}, agRoutes={}, nm={}, v60={};
    var mark=function(b, bucket){ var kk=agKey(b); if(kk==='__b2c'||kk==='__none') return; var d=bkDay(b); if(!last[kk]||d>last[kk]) last[kk]=d; agSid[kk]=salesOf(sidOf(b)).id; nm[kk]=agentName(b);
      (b.trips||[]).forEach(function(t){ var f=(fam(t.routeId)||{}).id||t.routeId; (agRoutes[kk]=agRoutes[kk]||{})[f]=((agRoutes[kk]||{})[f]||0)+pax(t); if(bucket==='60') v60[kk]=(v60[kk]||0)+pax(t); }); };
    s14.list.forEach(function(b){ mark(b,'14'); }); s60.list.forEach(function(b){ mark(b,'60'); });
    var shortFams={}; famL.forEach(function(F){ days.forEach(function(d){ var c=cells[F.f.id+'|'+d]; if(c && (c.worst==='y'||c.worst==='r') && c.lead<=7) (shortFams[F.f.id]=shortFams[F.f.id]||[]).push(d); }); });
    Object.keys(agSid).forEach(function(kk){ var o=SL[agSid[kk]]; if(!o) return; var gone=nDays(last[kk],t0)-1;
      var topF=Object.keys(agRoutes[kk]||{}).sort(function(a,b){ return agRoutes[kk][b]-agRoutes[kk][a]; })[0];
      if(gone>=7 && gone<=60 && (v60[kk]||0)>=3) o.calls.push({k:kk, name:nm[kk], why:laT('เงียบ')+' '+gone+' '+laT('วัน'), cls:'q', sub:laT('เคยส่ง')+' '+num(v60[kk])+' pax/60 '+laT('วัน')+(topF?' · '+famNameOf(topF):''), w:2+Math.min(3,(v60[kk]||0)/20), f:topF});
      else if(gone<7){ var rs=Object.keys(agRoutes[kk]||{}).filter(function(f){ return shortFams[f]; }).sort(function(a,b){ return agRoutes[kk][b]-agRoutes[kk][a]; })[0];
        if(rs){ var d=shortFams[rs][0]; o.calls.push({k:kk, name:nm[kk], why:laT('ว่าง')+' '+dShort(d), cls:'o', sub:laT('เคยส่ง')+' '+famNameOf(rs)+' · '+num(agRoutes[kk][rs])+' pax', w:1, f:rs}); } }
    });
    try{ (typeof SB_SEAT_LOCKS!=='undefined'?SB_SEAT_LOCKS:[]).forEach(function(l){ if(!l||l.status!=='active'||!l.agentId||bkV2LockSpansDays(l)) return; if(!l.date||l.date<t0||l.date>addDays(t0,7)) return;
      var rem=bkV2LockHeldRemaining(l,l.date); if(rem<=0) return; var a=sbGetAgent(l.agentId); if(!a) return; var o=SL[salesOf(a.sales).id]; if(!o) return;
      o.calls.push({k:l.agentId, name:a.name||l.agentId, why:laT('ล็อก')+' '+rem+' '+laT('ที่ยังไม่ใช้'), cls:'l', sub:rName(l.routeId).f+' · '+thD(l.date), w:3, f:(fam(l.routeId)||{}).id}); }); }catch(_){}
    Object.keys(SL).forEach(function(sid){ var o=SL[sid]; o.calls.sort(function(a,b){ return b.w-a.w; }); var seen={}; o.calls=o.calls.filter(function(c){ var kk=c.k+'|'+c.cls; if(seen[kk]) return false; seen[kk]=1; return true; }); });
    var sl=Object.keys(SL).map(function(kk){ return SL[kk]; }).filter(function(o){ return o.tgt>0||o.pace>0||o.calls.length; });
    /* วันที่ว่างเยอะของแต่ละกลุ่มเส้นทาง (ในช่วงที่ดู · ยังไม่เต็ม) */
    var openDays={}; famL.forEach(function(F){ var L=days.filter(function(d){ return d>=t0; }).map(function(d){ var c=cells[F.f.id+'|'+d]; return c&&c.worst!=='full'&&c.free>0?{ds:d, free:c.free, rid:c.rids[0].rid}:null; }).filter(Boolean).sort(function(a,b){ return b.free-a.free; }); openDays[F.f.id]=L; });
    /* ตัดสินใจ · เที่ยวที่เพซไม่ทันใน 3 วัน หรือต่ำกว่าคุ้มทุนใน 7 วัน */
    var dec=[]; famL.forEach(function(F){ days.forEach(function(d){ var c=cells[F.f.id+'|'+d]; if(!c||c.lead>7||d<t0) return; c.rids.forEach(function(s){ if(s.belowBe||(s.lead<=3&&(s.st==='r'||s.st==='y'))) dec.push(Object.assign({f:F.f}, s)); }); }); });
    dec.sort(function(a,b){ return a.ds===b.ds ? (b.behind-a.behind) : (a.ds<b.ds?-1:1); });
    var should=hT>0?Math.round(hExp*100/hT):0, elapsed=Math.max(1,nDays(R.mFrom,t0)), shouldPc=pct(elapsed-1, nDays(R.mFrom,R.mTo));
    return {R:R, SH:SH, ym:ymG, CV:CV, days:days, famL:famL, cells:cells, mT:mT, mB:mB, mGap:mGap, daysLeft:daysLeft, need:need, fT:fT, fB:fB, capF:capF, bkF:bkF,
      hT:Math.round(hT), hB:hB, hGap:Math.round(hGap), hExp:hExp, should:should, hIn:hIn, nRisk:nRisk, nTrip:nTrip, nBe:nBe, beShort:beShort, pace7:pace7, daysLeftH:daysLeftH, rpp:rpp,
      SL:SL, sl:sl, openDays:openDays, dec:dec, shouldPc:shouldPc, elapsed:elapsed, t0:t0};
  }
  function salesStatus(todayPax, needDay){ if(needDay<=0) return {c:'g', t:laT('ถึงเป้าแล้ว')}; if(todayPax>=needDay) return {c:'g', t:laT('ตามแผน')}; if(todayPax>=needDay*0.6) return {c:'w', t:laT('ใกล้เคียง')}; return {c:'b', t:laT('ไม่ทัน')}; }
  function stChip(st, txt){ return '<span class="eb-st '+st.c+'">'+txt+'</span>'; }
  function gapCellHtml(c, F, d){
    if(!c) return '<div class="eg-c off">—</div>';
    var cls=c.worst==='full'||c.worst==='g'?'g':(c.worst==='y'?'w':'b'); if(c.belowBe) cls='b';
    var tip=F.f.name+' · '+thDow(d)+' '+thD(d)+'\n'+c.n+' '+laT('เที่ยว · จอง')+' '+c.bk+'/'+c.cap+' · '+laT('ว่าง')+' '+c.free+(c.lk?' · '+laT('ล็อก')+' '+c.lk:'')+'\n'+laT('เป้า')+' '+c.tgt+' · '+laT('ควรจองแล้ว')+' '+Math.round(c.exp)+' · '+laT('คาดสุดท้าย')+' '+Math.round(c.proj)
      + c.rids.map(function(s){ return '\n  '+rName(s.rid).v+' '+s.bk+'/'+s.cap+(s.be?' · '+laT('คุ้มทุน')+' '+s.be:''); }).join('')+(c.in?'\n'+laT('เข้ามาวันนี้')+' +'+c.in:'')+'\n'+laT('กดเพื่อเปิด')+' By trip';
    return '<button class="eg-c '+cls+'" title="'+E(tip)+'" onclick="ebGoTrip(\''+E(d)+'\',\''+E(c.rids[0].rid)+'\')"><b>'+(c.worst==='full'?laT('เต็ม'):num(c.free))+'</b>'+(c.in?'<i>+'+num(c.in)+'</i>':'')+(c.behind&&c.worst!=='full'?'<small>−'+num(c.behind)+'</small>':'')+'</button>';
  }
  function viewGap(){
    var R=gapRange(), G=gapData(R), t0=G.t0, SH=G.SH;
    var proj=G.hB+G.pace7*G.daysLeftH, behindPc=Math.max(0,G.should-pct(G.hB,G.hT));
    var head='<div class="eb-card eg-head"><div class="eg-hl">'
      +'<div class="k">'+E(R.lbl.toUpperCase())+' · '+E(thD(R.from))+' – '+E(thD(R.to))+'</div>'
      +'<div class="big">'+laT('ต้องหาอีก')+' <span class="n '+(G.hGap>0?'bad':'good')+'">'+num(G.hGap)+'</span> '+laT('ที่นั่ง')+'</div>'
      +'<div class="s">'+laT('จากเป้า')+' '+num(G.hT)+' ('+laT('เรือที่วาง')+' × LF '+laT('เป้า) · จองแล้ว')+' '+num(G.hB)+' ('+pct(G.hB,G.hT)+'%) · '+laT('เฉลี่ย')+' <b>'+num(Math.ceil(G.hGap/G.daysLeftH))+' '+laT('ที่/วัน')+'</b> '+laT('ตลอด')+' '+G.daysLeftH+' '+laT('วัน')+'</div>'
      +'<div class="bar"><div class="t"><i style="width:'+Math.min(100,pct(G.hB,G.hT))+'%"></i><s style="left:'+Math.min(100,G.should)+'%"></s></div><span>'+laT('ควรถึง')+' '+G.should+'% '+laT('ณ วันนี้ตามเส้นโค้งปกติ')+'</span></div>'
      +'<div class="c '+(behindPc>10?'bad':(behindPc>0?'warn':'good'))+'">'+(behindPc>0?laT('ตามหลังเส้นโค้ง')+' '+behindPc+'%':laT('ตามเส้นโค้งหรือนำหน้า'))+' · 7 '+laT('วันล่าสุดเข้าเฉลี่ย')+' '+Math.round(G.pace7)+' '+laT('ที่/วัน')+(G.hGap>0?' · '+laT('ถ้าคงอัตรานี้จะได้')+' ~'+num(Math.round(proj))+' '+(proj>=G.hT?laT('ถึงเป้า'):(proj>=G.hT*0.9?laT('ใกล้เคียงเป้า'):laT('ไม่ถึงเป้า'))):'')+'</div></div>'
      +'<div class="eg-tiles">'
      +'<div><div class="l">'+laT('เที่ยวที่เสี่ยงไม่เต็ม')+'</div><div class="v '+(G.nRisk?'bad':'')+'">'+num(G.nRisk)+'<small> / '+num(G.nTrip)+'</small></div><div class="d">'+laT('ตามหลังเส้นโค้งหรือต่ำกว่าคุ้มทุน')+'</div></div>'
      +'<div><div class="l">'+laT('ต่ำกว่าคุ้มทุน (7 วัน)')+'</div><div class="v '+(G.nBe?'warn':'')+'">'+num(G.nBe)+'<small> '+laT('เที่ยว')+'</small></div><div class="d">'+(G.nBe?laT('ขาดรวม')+' '+num(G.beShort)+' '+laT('ที่'):laT('ไม่มี'))+'</div></div>'
      +'<div><div class="l">'+laT('ถ้าเต็มครบตามเป้า')+'</div><div class="v">+'+baht(G.hGap*G.rpp)+'</div><div class="d">'+laT('ช่องว่าง')+' × '+laT('รายได้/หัว ฿')+num(G.rpp)+'</div></div>'
      +'<div><div class="l">'+laT('เข้ามาวันนี้')+' ('+E(R.lbl)+')</div><div class="v good">+'+num(G.hIn)+'</div><div class="d">'+laT('เป้า')+' '+num(Math.ceil(G.hGap/G.daysLeftH))+'/'+laT('วัน')+' · '+(G.hIn>=G.hGap/G.daysLeftH?laT('วันนี้ถึงเป้า'):laT('ยังไม่ถึงเป้าวัน'))+'</div></div>'
      +'</div></div>';
    /* เส้นทาง × วัน · ไม่เลื่อน */
    var n=G.days.length, grid='<div class="eb-card"><h2>'+laT('เส้นทาง')+' × '+laT('วัน')+' <span class="eb-tag">'+laT('ตัวเลข')+' = '+laT('ที่ว่าง · สี')+' = '+laT('เทียบเส้นโค้งปกติ · มุมขวา')+' = '+laT('เข้ามาวันนี้ · กดช่องไป')+' By trip</span>'
      +'<span class="eg-lg"><span><i style="background:#D1FAE5"></i>'+laT('เต็ม / ตามแผน')+'</span><span><i style="background:#FEF3C7"></i>'+laT('ตามทัน')+'</span><span><i style="background:#FEE2E2"></i>'+laT('ตามหลัง / ต่ำกว่าคุ้มทุน')+'</span><span><i style="background:#F3F4F6"></i>'+laT('ไม่มีเรือ')+'</span></span></h2>'
      +'<div class="eg-grid'+(n>16?' dense':'')+'" style="grid-template-columns:minmax(120px,170px) repeat('+n+',minmax(0,1fr)) 86px">'
      +'<div></div>'+G.days.map(function(d){ var w=dt(d).getDay(); return '<div class="eg-dh'+(w===0||w===6?' we':'')+(d===t0?' td':'')+'">'+laT(DOW_S[w])+' '+dt(d).getDate()+'</div>'; }).join('')+'<div class="eg-dh r">'+laT('รวม')+'</div>'
      +(G.famL.length?G.famL.map(function(F){ var tF=0,tB=0,tFree=0;
          var cs=G.days.map(function(d){ var c=G.cells[F.f.id+'|'+d]; if(c){ tF+=c.tgt; tB+=c.bk; tFree+=c.free; } return gapCellHtml(c,F,d); }).join('');
          return '<div class="eg-rn"><b>'+E(F.f.name)+'</b><small>'+F.rids.length+' '+laT('รอบ/วัน')+'</small></div>'+cs+'<div class="eg-tot"><b>'+num(tFree)+'</b><small>'+laT('ว่าง · ขาย')+' '+pct(tB,tF>0?tF/EB_LF_TARGET:0)+'%</small></div>'; }).join('')
        :'<div class="eb-none" style="grid-column:1/-1">'+laT('ยังไม่ได้วางเรือในช่วงนี้')+'</div>')
      +'</div></div>';
    /* ช่องว่างแบ่งให้เซลส์ · บรรทัดเดียวต่อคน · กดชื่อกาง */
    var sl=G.sl.slice().sort(function(a,b){ return (a.s.none-b.s.none)||((b.tgt-b.bk)-(a.tgt-a.bk)); });
    var rows=sl.map(function(o){ var gap=Math.max(0,o.tgt-o.bk), nd=gap/G.daysLeft, pc=pct(o.bk,o.tgt), st=salesStatus(o.today, nd), open=EB.gx===o.s.id;
      var h='<div class="eg-sr'+(open?' open':'')+'" data-sid="'+E(o.s.id)+'"><button class="nm" onclick="ebSet(\'gx\',\''+E(open?'':o.s.id)+'\')" title="'+laT('กดเพื่อดูรายเส้นทาง')+'"><span class="eb-dot" style="background:'+E(o.s.color)+'"></span>'+E(o.s.name)+'<i>'+(open?'▾':'▸')+'</i></button>'
        +'<div class="pb"><i style="width:'+Math.min(100,pc)+'%;background:'+E(o.s.color)+'"></i><s style="left:'+G.shouldPc+'%"></s><b>'+num(o.bk)+' / '+num(o.tgt)+' · '+pc+'%</b></div>'
        +'<div class="gp '+(gap<=0?'good':(nd>Math.max(1,o.pace)*1.3?'bad':'warn'))+'">'+num(gap)+'</div>'
        +'<div class="nd">'+num(Math.ceil(nd))+'<small> ('+laT('เฉลี่ย')+' '+Math.round(o.pace)+')</small></div>'
        +'<div class="td">'+stChip(st, '+'+num(o.today)+' '+st.t)+'</div></div>';
      if(open){ var L=Object.keys(o.byF).map(function(f){ var x=o.byF[f]; return {f:f, gap:Math.max(0,x.tgt-x.bk), tgt:x.tgt, w:x.w, nd:Math.max(0,x.tgt-x.bk)/G.daysLeft, today:o.todayF[f]||0}; }).filter(function(x){ return x.tgt>0; }).sort(function(a,b){ return b.gap-a.gap; });
        h+='<div class="eg-sx">'+(L.length?L.map(function(x){ var od=(G.openDays[x.f]||[]).slice(0,3); var stF=salesStatus(x.today, x.nd);
            return '<div class="r'+(x.nd>Math.max(1,o.paceF[x.f]||0)*1.3&&x.gap>0?' lag':'')+'"><span class="f">'+E(famNameOf(x.f))+'<small>'+laT('รับ')+' '+Math.round(x.w*100)+'%'+(x.nd>Math.max(1,o.paceF[x.f]||0)*1.3&&x.gap>0?' · <b>'+laT('ตามหลัง')+'</b>':'')+'</small></span><span class="n">'+(x.gap?num(x.gap):'✓')+'</span><span class="n">'+(x.gap?num(Math.ceil(x.nd)):'—')+'</span><span class="n '+stF.c+'">+'+num(x.today)+'</span>'
              +'<span class="od">'+(od.length?od.map(function(d){ return '<button onclick="ebGoTrip(\''+E(d.ds)+'\',\''+E(d.rid)+'\')">'+dShort(d.ds)+' · '+laT('ว่าง')+' '+num(d.free)+'</button>'; }).join(''):'<small class="eb-mut">'+laT('ไม่มีวันว่างในช่วงนี้')+'</small>')+'</span></div>'; }).join('')
          :'<div class="eb-none">'+laT('ยังไม่มีเป้าแยกเส้นทาง')+'</div>')
          +'<div class="eg-sxh"><span>'+laT('เส้นทาง')+'</span><span>'+laT('ขาด')+'</span><span>'+laT('ต้องได้/วัน')+'</span><span>'+laT('วันนี้')+'</span><span>'+laT('วันที่ว่างเยอะ · กดไปขาย')+'</span></div>'
          +(o.calls.length?'<div class="eg-calls"><span class="eb-mut">'+laT('เอเยนต์ที่ควรติดต่อ')+':</span>'+o.calls.slice(0,5).map(function(c){ return '<span class="'+c.cls+'" title="'+E(c.sub)+'">'+E(c.name)+' · '+E(c.why)+'</span>'; }).join('')+'</div>':'')+'</div>'; }
      return h; }).join('');
    var sales='<div class="eb-card"><h2>'+laT('ช่องว่างแบ่งให้เซลส์')+' <span class="eb-tag">'+(SH.manual?laT('สัดส่วนที่ผู้บริหารกำหนด')+' · '+E(SH.src):laT('ตามสัดส่วนที่ขายได้ต่อเส้นทาง')+' ('+E(SH.src||laT('ยังไม่มีฐาน'))+')')+' · '+laT('กดชื่อดูรายเส้นทาง')+'</span>'
      +(canAlloc()?'<button class="eb-btn s" style="margin-left:auto" onclick="ebAllocEdit(true)">'+(SH.manual?laT('แก้สัดส่วน'):laT('กำหนดสัดส่วนเอง'))+'</button>':'')+'</h2>'
      +'<div class="eg-sh"><span>'+laT('เซลส์')+'</span><span>'+laT('จองแล้ว / เป้า')+' '+E(G.ym)+'</span><span>'+laT('ช่องว่าง')+'</span><span>'+laT('ต้องได้/วัน')+'</span><span>'+laT('วันนี้')+'</span></div>'
      +(rows||'<div class="eb-none">'+laT('ยังไม่มีเซลส์ที่ผูกกับใบจอง')+'</div>')
      +'<div class="eb-foot">'+laT('ขีดดำ')+' = '+laT('ควรถึงแล้ว ณ วันนี้')+' ('+G.shouldPc+'% '+laT('ของเดือน) · "วันนี้')+'" = '+laT('ที่นั่งที่คนนั้นปิดได้วันนี้สำหรับเดือนนี้ เทียบกับที่ต้องได้/วัน · เฉลี่ย')+' = 7 '+laT('วันล่าสุด')+'</div></div>';
    /* ตัดสินใจเที่ยวนี้ */
    var sug=function(s, sib){
      if(s.be && s.proj>=s.be) return [laT('รอดู'), laT('คาดสุดท้าย')+' '+Math.round(s.proj)+' ≥ '+laT('คุ้มทุน')+' '+s.be];
      if(sib) return [laT('รวมกับ')+' '+dShort(sib.ds), laT('อีกเที่ยวว่าง')+' '+sib.free+' '+laT('ที่ รับได้ทั้ง')+' '+s.bk+' '+laT('คน')];
      if(1-s.c>=0.35) return [laT('แจ้งเซลส์'), laT('ตลาดนี้ยังจองช้าได้')+' '+Math.round((1-s.c)*100)+'% '+laT('ของยอด')];
      return [laT('โปร B2')+'C', laT('ตลาดหลักจองล่วงหน้าแล้ว เหลือขายหน้างาน')];
    };
    var decH='<div class="eb-card"><h2>'+laT('ตัดสินใจเที่ยวนี้')+' <span class="eb-tag">'+laT('ต่ำกว่าคุ้มทุนใน 7 วัน หรือเพซไม่ทันใน 3 วัน · เรียงตามวันออก')+'</span></h2>'
      +(G.dec.length?G.dec.slice(0,6).map(function(s){ var nmR=rName(s.rid); var sib=null; [-1,1].forEach(function(k){ var d2=addDays(s.ds,k); if(d2<t0||sib) return; var o2=tripState(s.rid,d2); if(o2 && o2.free>=s.bk && o2.st!=='full') sib=o2; });
          var sg=sug(s,sib); var opts=[laT('แจ้งเซลส์'),laT('โปร B2')+'C',(sib?laT('รวมกับ')+' '+dShort(sib.ds):laT('ลดเรือ')),laT('รอดู')];
          return '<div class="eg-dec"><div><b>'+E(nmR.f+(nmR.v?' '+nmR.v:''))+' · '+E(dShort(s.ds))+'</b><small>'+laT('จอง')+' '+s.bk+'/'+s.cap+(s.be?' · '+laT('ขาดคุ้มทุน')+' '+Math.max(0,s.be-s.bk):' · '+laT('เป้า')+' '+s.tgt)+' · '+laT('ออกใน')+' '+s.lead+' '+laT('วัน')+' · '+E(sg[1])+'</small></div>'
            +'<span class="eg-opt">'+opts.map(function(x){ return '<b class="'+(x===sg[0]?'on':'')+'">'+E(x)+'</b>'; }).join('')+'<button onclick="ebGoTrip(\''+E(s.ds)+'\',\''+E(s.rid)+'\')">By trip →</button></span></div>'; }).join('')
          +'<div class="eb-foot">'+laT('ตัวเลือกที่ไฮไลต์คือข้อเสนอของระบบจากเส้นโค้งและจุดคุ้มทุน · ปุ่มเป็นทางลัด ไม่มีอะไรเกิดขึ้นเอง')+'</div>'
        :'<div class="eb-none">'+laT('ไม่มีเที่ยวที่ต้องตัดสินใจตอนนี้')+'</div>')+'</div>';
    var lead='<div class="eb-card"><h2>'+laT('ใครจองล่วงหน้าแค่ไหน')+' <span class="eb-tag">lead time '+laT('มัธยฐาน · 90 วัน')+'</span></h2>'+leadCompact()+'</div>';
    return head+grid+'<div class="eb-grid eb-r3" style="margin-top:12px">'+sales+'<div style="display:flex;flex-direction:column;gap:12px;min-width:0">'+decH+lead+'</div></div>';
  }
  function leadCompact(){
    var t0=today(), from=addDays(t0,-90), M={}, within7=0, all=0;
    (SB_BOOKINGS||[]).forEach(function(b){ if(!isLive(b)) return; var d=bkDay(b); if(!d) return;
      (b.trips||[]).forEach(function(t){ if(!t||!t.date||t.date<from) return; var ld=Math.max(0,nDays(d,t.date)-1), p=pax(t)||1;
        var m=(typeof laIsB2C==='function'&&laIsB2C(b))?{id:'b2c',name:'B2C '+laT('ออนไลน์')}:((typeof drMarket==='function')?(drMarket(b)||{}):{}); var k=m.id||'?';
        var X=M[k]=M[k]||{name:m.name||laT('ไม่ระบุตลาด'), ls:[], pax:0}; X.ls.push(ld); X.pax+=p; all+=p; if(ld<=7) within7+=p; }); });
    var rows=Object.keys(M).map(function(k){ var ls=M[k].ls.sort(function(a,b){ return a-b; }), n=ls.length; return {name:M[k].name, pax:M[k].pax, n:n, med:ls[Math.floor(n/2)]}; }).filter(function(r){ return r.n>=5; }).sort(function(a,b){ return b.med-a.med; }).slice(0,6);
    if(!rows.length) return '<div class="eb-none">'+laT('ยังมีข้อมูลไม่พอ')+'</div>';
    var mx=Math.max.apply(null,rows.map(function(r){ return r.med; }).concat([1]));
    return rows.map(function(r){ return '<div class="eg-ld"><span>'+E(r.name)+'</span><span class="b"><i style="width:'+Math.max(4,Math.round(r.med*100/mx))+'%"></i></span><span class="n">'+r.med+' '+laT('วัน')+'</span></div>'; }).join('')
      +'<div class="eb-foot">'+(all?pct(within7,all):0)+'% '+laT('ของที่นั่งเข้ามาภายใน 7 วันก่อนออก · วันที่ยังแดงจึงยังมีโอกาส แต่ 7 วันสุดท้ายคือตัวตัดสิน')+'</div>';
  }

  /* ══ §execAlloc2 · หน้าต่างกำหนดสัดส่วน ═══════════════════════════════════════════════════════ */
  function allocMonths(){ var t0=today(); return [monStart(t0).slice(0,7), addMon(t0,1).slice(0,7)]; }
  function allocData(ym){
    var mFrom=ym+'-01', mTo=monEnd(mFrom), t0=today(), R={from:(mFrom<t0?t0:mFrom), to:mTo, mFrom:mFrom, mTo:mTo, lbl:ym};
    var G=gapData(R), fams=Object.keys(G.fT).sort(function(a,b){ return G.fT[b]-G.fT[a]; });
    var sales=G.sl.map(function(o){ return o.s; }).filter(function(s){ return !s.none; });
    (typeof sbSalesActive==='function'?sbSalesActive():[]).forEach(function(x){ if(!sales.some(function(y){ return y.id===x.id; })) sales.push(salesOf(x.id)); });
    return {G:G, fams:fams, sales:sales, ym:ym, R:R};
  }
  window.ebAllocEdit=function(on, ym){
    if(!on){ EB.allocEdit=false; EB.draft=null; var ov=document.getElementById('eb-alloc-ov'); if(ov) ov.remove(); keepRender(true); return; }
    if(!canAlloc()){ toast(laT('ต้องมีสิทธิ์แก้ไขส่วน')+' Sales'); return; }
    EB.allocEdit=true; EB.allocYm=ym||EB.allocYm||gapRange().mFrom.slice(0,7); EB.draft=EB.draft||{}; allocModal();
  };
  window.ebAllocMonth=function(ym){ EB.allocYm=ym; EB.draft={}; allocModal(); };
  function allocModal(){
    var A=allocData(EB.allocYm), G=A.G, SH=G.SH, D=EB.draft||{}, ym=A.ym;
    var cur=function(f,sid){ if((f+'|'+sid) in D) return D[f+'|'+sid]; var sh=SH.fam[f]; if(!sh||!sh.tot) return ''; var v=Math.round((sh.by[sid]||0)*100/sh.tot); return v||''; };
    var calc=function(f,sid){ var sh=SH.calc.fam[f]; if(!sh||!sh.tot) return 0; return Math.round((sh.by[sid]||0)*100/sh.tot); };
    var curLf=function(f){ return ('lf|'+f) in D ? D['lf|'+f] : Math.round(lfOf(ym,f)*100); };
    var old=document.getElementById('eb-alloc-ov'); var sc=old?(old.querySelector('.ea-body')||{}).scrollTop||0:0; if(old) old.remove();
    var ov=document.createElement('div'); ov.id='eb-alloc-ov';
    var inp=function(f,sid){ return '<input type="number" min="0" max="100" step="1" data-f="'+E(f)+'" data-s="'+E(sid)+'" value="'+E(cur(f,sid))+'" placeholder="0" aria-label="'+E(sid+' '+famNameOf(f))+'" oninput="ebAllocTot(\''+E(f)+'\')">'; };
    var M=allocMonths();
    var h='<div class="ea" id="eb-alloc" role="dialog" aria-modal="true" aria-label="'+laT('กำหนดสัดส่วนช่องว่างให้เซลส์')+'">'
      +'<div class="ea-hd"><div><div class="t">'+laT('กำหนดสัดส่วนช่องว่างให้เซลส์')+'</div><div class="s">'+E(laMonFull(ym))+' · '+laT('ช่องว่างของแต่ละเส้นทางจะถูกแบ่งเป็นเป้าของเซลส์ตามสัดส่วนนี้ · ไม่กระทบใบจองหรือราคา')+'</div></div>'
      +'<span class="eb-seg">'+M.map(function(m){ return '<button class="'+(m===ym?'on':'')+'" onclick="ebAllocMonth(\''+m+'\')">'+E(laMonShort(m))+'</button>'; }).join('')+'</span>'
      +'<button class="x" aria-label="'+laT('ปิด')+'" onclick="ebAllocEdit(false)">✕</button></div>'
      +'<div class="ea-src"><span>'+laT('ที่มาของสัดส่วน')+'</span><span class="eb-seg"><button class="'+(SH.manual?'':'on')+'" onclick="ebAllocReset(\''+E(ym)+'\')">'+laT('คำนวณให้')+' ('+E(SH.calc.src||laT('ยังไม่มีฐาน'))+')</button><button class="on-m '+(SH.manual?'on':'')+'">'+laT('กำหนดเอง')+'</button></span>'
      +'<span class="eb-mut">'+laT('แก้แล้วบันทึก')+' = '+laT('ใช้ค่านี้ทั้งเดือน · กด "คำนวณให้" เมื่อไหร่ก็กลับมาเป็นอัตโนมัติ')+'</span><span class="eb-sp"></span><span class="eb-mut">'+(SH.manual?laT('บันทึกล่าสุด')+': '+E(SH.src):laT('ยังไม่เคยกำหนดเอง'))+'</span></div>'
      +'<div class="ea-body"><div class="ea-grid" style="grid-template-columns:150px repeat('+A.fams.length+',minmax(0,1fr)) 100px">'
      +'<div class="hh">'+laT('เซลส์')+'</div>'+A.fams.map(function(f){ var gap=Math.max(0,Math.round(G.capF[f]*(curLf(f)/100)-G.bkF[f])); return '<div class="hh f"><b>'+E(famNameOf(f))+'</b><small>'+laT('ช่องว่างเดือนนี้')+' <span class="eb-num" data-fgap="'+E(f)+'">'+num(gap)+'</span> '+laT('ที่ · วาง')+' '+num(G.capF[f])+' '+laT('จอง')+' '+num(G.bkF[f])+'</small><label>'+laT('เป้า')+' LF <input type="number" min="1" max="100" step="1" data-lf="'+E(f)+'" value="'+E(curLf(f))+'" oninput="ebAllocTot(\''+E(f)+'\')">%</label></div>'; }).join('')+'<div class="hh r">'+laT('เป้ารวมของคน')+'<br>('+laT('ที่นั่ง)')+'</div>'
      +A.sales.map(function(s){ return '<div class="sn"><span class="eb-dot" style="background:'+E(s.color)+'"></span>'+E(s.name)+'</div>'+A.fams.map(function(f){ return '<div class="cell">'+inp(f,s.id)+'<span>% · <b data-seat="'+E(f)+'|'+E(s.id)+'">0</b></span><small>('+laT('คำนวณ')+' '+calc(f,s.id)+')</small></div>'; }).join('')+'<div class="rt" data-rowtot="'+E(s.id)+'">0</div>'; }).join('')
      +'<div class="sn mut"><span class="eb-dot" style="background:#9CA3AF"></span>B2C / '+laT('ไม่มีเซลส์')+'<small>'+laT('อัตโนมัติ')+'</small></div>'+A.fams.map(function(f){ return '<div class="cell mut">'+laT('ที่เหลือ')+' · <b data-rest="'+E(f)+'">0</b>%</div>'; }).join('')+'<div class="rt mut" data-rowtot="__none">0</div>'
      +'<div class="tt">'+laT('รวมต่อเส้นทาง')+'</div>'+A.fams.map(function(f){ return '<div class="tt"><b class="eb-atot" data-tot="'+E(f)+'">0%</b><span class="eb-st" data-totst="'+E(f)+'"></span></div>'; }).join('')+'<div class="tt r" data-rowtot="__all">0</div>'
      +'</div><div class="eb-foot">'+laT('ตัวเลขหลัง %')+' = '+laT('เป้าที่นั่งของคนนั้นในเส้นทางนั้น (ช่องว่าง')+' × '+laT('สัดส่วน) · ใส่ไม่ครบ 100 กด "เกลี่ยให้ครบ" ระบบเติมส่วนที่เหลือตามสัดส่วนเดิม · เกิน 100 บันทึกไม่ได้')+'</div></div>'
      +'<div class="ea-ft"><button class="eb-btn" onclick="ebAllocFill()">'+laT('เกลี่ยให้ครบ 100%')+'</button><button class="eb-btn" onclick="ebAllocReset(\''+E(ym)+'\')">'+laT('ใช้ค่าคำนวณ')+'</button><span class="eb-mut" id="ea-dirty"></span><span class="eb-sp"></span><button class="eb-btn" onclick="ebAllocEdit(false)">'+laT('ยกเลิก')+'</button><button class="eb-btn p" onclick="ebAllocSave(\''+E(ym)+'\')">'+laT('บันทึกสัดส่วน')+' '+E(laMonShort(ym))+'</button></div></div>';
    ov.innerHTML=h; document.body.appendChild(ov);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) ebAllocEdit(false); });
    ov._A=A; A.fams.forEach(function(f){ ebAllocTot(f, true); }); try{ var bd=ov.querySelector('.ea-body'); if(bd) bd.scrollTop=sc; }catch(_){}
  }
  function laMonFull(ym){ var en=(typeof laLangGet==='function' && laLangGet()==='en'); var M=en?['January','February','March','April','May','June','July','August','September','October','November','December']:((typeof MONTHS_TH!=='undefined')?MONTHS_TH:null); var y=+ym.slice(0,4), m=+ym.slice(5,7); return (M?M[m-1]:ym.slice(5,7))+' '+(en?y:(y+543)); }   /* §ebEN */
  function laMonShort(ym){ var en=(typeof laLangGet==='function' && laLangGet()==='en'); var M=(typeof laMonAbbr==='function')?laMonAbbr():((typeof laMonAbbrTH==='function')?laMonAbbrTH():null); var y=+ym.slice(0,4), m=+ym.slice(5,7); return (M?M[m-1]:ym.slice(5,7))+' '+String(en?y:(y+543)).slice(2); }   /* §ebEN */
  window.ebAllocTot=function(f, quiet){
    var ov=document.getElementById('eb-alloc-ov'), box=document.getElementById('eb-alloc'); if(!box||!ov) return; var A=ov._A, G=A.G;
    EB.draft=EB.draft||{}; if(!quiet) box.querySelectorAll('input[data-f],input[data-lf]').forEach(function(i){ EB.draft[i.dataset.lf?('lf|'+i.dataset.lf):(i.dataset.f+'|'+i.dataset.s)]=i.value; });
    var lfI=box.querySelector('input[data-lf="'+f+'"]'), lf=Math.max(1,Math.min(100,+(lfI&&lfI.value)||Math.round(lfOf(A.ym,f)*100)))/100;
    var gap=Math.max(0,Math.round((G.capF[f]||0)*lf-(G.bkF[f]||0))); var ge=box.querySelector('[data-fgap="'+f+'"]'); if(ge) ge.textContent=num(gap);
    var t=0; box.querySelectorAll('input[data-f="'+f+'"]').forEach(function(i){ var v=Math.max(0,+i.value||0); t+=v; var se=box.querySelector('[data-seat="'+f+'|'+i.dataset.s+'"]'); if(se) se.textContent=num(Math.round(gap*v/100)); });
    var te=box.querySelector('[data-tot="'+f+'"]'); if(te){ te.textContent=Math.round(t*10)/10+'%'; te.className='eb-atot '+(t>100.5?'over':(t<99.5?'under':'ok')); }
    var ts=box.querySelector('[data-totst="'+f+'"]'); if(ts){ ts.textContent=t>100.5?laT('เกิน')+' '+Math.round((t-100)*10)/10:(t<99.5?laT('ขาด')+' '+Math.round((100-t)*10)/10:laT('ครบ')); ts.className='eb-st '+(t>100.5?'b':(t<99.5?'w':'g')); }
    var re=box.querySelector('[data-rest="'+f+'"]'); if(re) re.textContent=Math.max(0,Math.round((100-t)*10)/10);
    /* เป้ารวมต่อคน */
    var rows={}, all=0; A.fams.forEach(function(ff){ var lfI2=box.querySelector('input[data-lf="'+ff+'"]'), lf2=Math.max(1,Math.min(100,+(lfI2&&lfI2.value)||Math.round(lfOf(A.ym,ff)*100)))/100; var g2=Math.max(0,Math.round((G.capF[ff]||0)*lf2-(G.bkF[ff]||0))); var tt=0;
      box.querySelectorAll('input[data-f="'+ff+'"]').forEach(function(i){ var v=Math.max(0,+i.value||0); tt+=v; rows[i.dataset.s]=(rows[i.dataset.s]||0)+Math.round(g2*v/100); }); rows.__none=(rows.__none||0)+Math.round(g2*Math.max(0,100-tt)/100); all+=g2; });
    Object.keys(rows).forEach(function(sid){ var el=box.querySelector('[data-rowtot="'+sid+'"]'); if(el) el.textContent=num(rows[sid]); }); var ae=box.querySelector('[data-rowtot="__all"]'); if(ae) ae.textContent=num(all);
    var dd=document.getElementById('ea-dirty'); if(dd && !quiet) dd.textContent=laT('ยังไม่ได้บันทึก');
  };
  window.ebAllocFill=function(){
    var ov=document.getElementById('eb-alloc-ov'), box=document.getElementById('eb-alloc'); if(!box||!ov) return; var A=ov._A, SH=A.G.SH;
    A.fams.forEach(function(f){ var ins=[].slice.call(box.querySelectorAll('input[data-f="'+f+'"]')), t=0; ins.forEach(function(i){ t+=Math.max(0,+i.value||0); });
      if(t>=99.5 && t<=100.5) return;
      if(t>0){ var acc=0; ins.forEach(function(i,k){ var v=Math.max(0,+i.value||0); if(!v){ return; } var nv=(k===ins.length-1)?Math.max(0,100-acc):Math.round(v*100/t); acc+=nv; i.value=nv; });
        /* เศษจากการปัด · ใส่ให้ช่องสุดท้ายที่มีค่า */ var t2=0; ins.forEach(function(i){ t2+=(+i.value||0); }); if(t2!==100){ for(var k=ins.length-1;k>=0;k--){ if(+ins[k].value>0){ ins[k].value=Math.max(0,(+ins[k].value)+(100-t2)); break; } } } }
      else { var sh=SH.calc.fam[f]; if(sh&&sh.tot){ var acc2=0; ins.forEach(function(i){ var v=Math.round((sh.by[i.dataset.s]||0)*100/sh.tot); i.value=v||''; acc2+=v; }); } }
      ebAllocTot(f); });
    toast(laT('เกลี่ยให้ครบ 100% แล้ว · ยังไม่ได้บันทึก'));
  };
  window.ebAllocReset=function(ym){ if(!confirm('Use the computed shares for this month? The manual allocation will be removed.')) return;
    if(allocSave(ym, null)){ EB.draft={}; toast(laT('กลับไปใช้ค่าคำนวณของ')+' '+ym+' '+laT('แล้ว')); if(document.getElementById('eb-alloc-ov')) allocModal(); keepRender(true); } };
  window.ebAllocSave=function(ym){
    var box=document.getElementById('eb-alloc'); if(!box) return;
    var rec={by:{}, lf:{}, who:(typeof laBy==='function'?laBy():'')||'', at:new Date().toISOString()};
    box.querySelectorAll('input[data-f][data-s]').forEach(function(i){ var v=+i.value||0; if(v>0){ (rec.by[i.dataset.f]=rec.by[i.dataset.f]||{})[i.dataset.s]=Math.round(v*10)/10; } });
    box.querySelectorAll('input[data-lf]').forEach(function(i){ var v=+i.value||0; if(v>0&&v<=100) rec.lf[i.dataset.lf]=Math.round(v); });
    var over=false; Object.keys(rec.by).forEach(function(f){ var t=0; Object.keys(rec.by[f]).forEach(function(k){ t+=rec.by[f][k]; }); if(t>100.5) over=true; });
    if(over){ alert('Route total is over 100% - please fix before saving.'); return; }
    if(allocSave(ym, rec)){ EB.allocEdit=false; EB.draft=null; var ov=document.getElementById('eb-alloc-ov'); if(ov) ov.remove(); keepRender(true); toast(laT('บันทึกสัดส่วน')+' '+ym+' '+laT('แล้ว · กำลังส่งขึ้นระบบ')); }
    else toast(laT('บันทึกไม่ได้ · ต้องมีสิทธิ์แก้ไขส่วน')+' Sales');
  };

  /* ══ §execSalesTgt · แท็บ "เป้าเซลส์" ══════════════════════════════════════════════════════════ */
  function stRange(){ var t0=today(); if(EB.stm==='next'){ var s=addMon(t0,1); return {from:s, to:monEnd(s), mFrom:s, mTo:monEnd(s), lbl:laMonFull(s.slice(0,7))}; } return {from:t0, to:monEnd(t0), mFrom:monStart(t0), mTo:monEnd(t0), lbl:laMonFull(t0.slice(0,7))}; }
  function mySalesId(){ try{ var id=(typeof laMySalesId==='function')?laMySalesId():null; if(id) return id; var me=(window.LA_ME||{}), em=String(me.email||'').toLowerCase(), un=String(me.username||me.name||'').toLowerCase();
      var s=(typeof SB_SALES!=='undefined'?SB_SALES:[]).filter(function(x){ return x && ((em && String(x.email||'').toLowerCase()===em) || (un && (String(x.name||'').toLowerCase()===un || String(x.code||'').toLowerCase()===un))); })[0]; return s?s.id:null; }catch(_){ return null; } }
  function viewSalesTgt(){
    var R=stRange(), G=gapData(R), t0=G.t0, daysLeft=G.daysLeft;
    var me=mySalesId(), only=!!EB.me;
    var sl=G.sl.filter(function(o){ return !o.s.none && o.tgt>0; }).sort(function(a,b){ return ((b.tgt-b.bk)/Math.max(1,b.tgt))-((a.tgt-a.bk)/Math.max(1,a.tgt)); });
    if(only){ sl=sl.filter(function(o){ return o.s.id===me; }); }
    /* ทีมวันนี้ + 14 วัน */
    var teamToday=0, teamNeed=G.need; G.sl.forEach(function(o){ teamToday+=o.today; });
    var hit=0, near=0, miss=0; sl.forEach(function(o){ var nd=Math.max(0,o.tgt-o.bk)/daysLeft, st=salesStatus(o.today, nd); if(st.c==='g') hit++; else if(st.c==='w') near++; else miss++; });
    var d14=[]; for(var k=13;k>=0;k--){ (function(k){ var d=addDays(t0,-k), p=0; eachMade(d,d,function(b){ (b.trips||[]).forEach(function(t){ if(t.date<R.mFrom||t.date>R.mTo) return; var r=route(t.routeId); if(!pierOk(r)) return; p+=pax(t); }); }); d14.push({ds:d, p:p}); })(k); }
    var mx=Math.max.apply(null,[1,teamNeed].concat(d14.map(function(x){ return x.p; })));
    var head='<div class="eb-card eg-head st"><div class="eg-hl">'
      +'<div class="k"><span>'+laT('วันนี้')+' · '+E(thDow(t0))+' '+E(thD(t0))+'</span>'+liveTag()+'</div>'
      +'<div class="big">'+laT('ทั้งทีมได้')+' <span class="n '+(teamToday>=teamNeed?'good':'bad')+'">'+num(teamToday)+'</span> <span class="u">/ '+laT('ต้องได้')+' '+num(Math.ceil(teamNeed))+' '+laT('ที่')+'</span></div>'
      +'<div class="s">'+laT('ทัน')+' '+hit+' '+laT('คน · ใกล้เคียง')+' '+near+' · '+laT('ไม่ทัน')+' '+miss+' · '+laT('ช่องว่าง')+E(R.lbl)+laT('เหลือ')+' '+num(G.mGap)+' · '+laT('อีก')+' '+daysLeft+' '+laT('วัน')+'</div>'
      +'<div class="bar"><div class="t"><i style="width:'+Math.min(100,pct(teamToday,teamNeed))+'%;background:'+(teamToday>=teamNeed?'#15803D':'#F59E0B')+'"></i></div><span>'+(teamNeed>0?pct(teamToday,teamNeed)+'% '+laT('ของเป้าวัน'):laT('ถึงเป้าเดือนแล้ว'))+'</span></div>'
      +'<div class="c">'+laT('เป้า/วัน')+' = '+laT('ช่องว่างที่เหลือ')+' ÷ '+laT('วันที่เหลือ · ปรับทุกเช้า')+'</div></div>'
      +'<div class="st-chart"><div class="hh"><b>'+laT('ทีมทำได้ต่อวัน · 14 วันล่าสุด')+'</b><span class="eb-mut">'+laT('แท่ง')+' = '+laT('ที่นั่งที่ปิดได้ (สำหรับ')+E(R.lbl)+') · '+laT('เส้น')+' = '+laT('ต้องได้/วัน · เขียว')+' = '+laT('ถึง')+'</span></div>'
      +'<div class="bars"><s style="bottom:'+Math.round(teamNeed*100/mx)+'%"></s><em style="bottom:'+Math.round(teamNeed*100/mx)+'%">'+laT('ต้องได้')+' '+num(Math.ceil(teamNeed))+'</em>'
      +d14.map(function(x,i){ return '<div class="'+(i===13?'td':(x.p>=teamNeed?'ok':''))+'" style="height:'+Math.max(2,Math.round(x.p*100/mx))+'%" title="'+E(thD(x.ds))+' · '+num(x.p)+' '+laT('ที่')+'"><b>'+num(x.p)+'</b></div>'; }).join('')+'</div>'
      +'<div class="hx">'+d14.map(function(x,i){ return '<span'+(i===13?' class="td"':'')+'>'+(i===13?laT('วันนี้'):dt(x.ds).getDate())+'</span>'; }).join('')+'</div></div></div>';
    /* การ์ดต่อเซลส์ */
    var cards=sl.map(function(o){ var gap=Math.max(0,o.tgt-o.bk), nd=gap/daysLeft, st=salesStatus(o.today, nd);
      var missRun=0; for(var i=6;i>=0;i--){ if(o.d7[i]<nd*0.6 && nd>0) missRun++; else break; }
      var L=Object.keys(o.byF).map(function(f){ var x=o.byF[f]; return {f:f, gap:Math.max(0,x.tgt-x.bk), tgt:x.tgt, nd:Math.max(0,x.tgt-x.bk)/daysLeft, today:o.todayF[f]||0, lag:(Math.max(0,x.tgt-x.bk)/daysLeft)>Math.max(1,o.paceF[f]||0)*1.3 && (x.tgt-x.bk)>0}; }).filter(function(x){ return x.tgt>0; }).sort(function(a,b){ return b.gap-a.gap; });
      var dots='<span class="st-d7" title="7 '+laT('วันล่าสุด · ถึงเป้าวัน')+' '+o.d7.filter(function(v){ return v>=nd&&nd>0; }).length+' '+laT('วัน')+'">'+o.d7.map(function(v,i){ return '<i class="'+(i===6?(v>=nd?'td':'tdm'):(v>=nd&&nd>0?'ok':''))+'" title="'+E(thD(addDays(t0,i-6)))+' · '+num(v)+'"></i>'; }).join('')+'</span>';
      var summary=o.s.name+' · '+R.lbl+'\n'+laT('ขาด')+' '+num(gap)+' '+laT('ที่ · ต้องได้วันละ')+' '+num(Math.ceil(nd))+' · '+laT('วันนี้')+' +'+num(o.today)+'\n'+L.map(function(x){ var od=(G.openDays[x.f]||[]).slice(0,3); return '- '+famNameOf(x.f)+': '+laT('ขาด')+' '+num(x.gap)+' · '+laT('วันละ')+' '+num(Math.ceil(x.nd))+(od.length?' · '+laT('ว่าง')+' '+od.map(function(d){ return dShort(d.ds)+' ('+d.free+')'; }).join(', '):''); }).join('\n')+(o.calls.length?'\n'+laT('ติดต่อ')+': '+o.calls.slice(0,4).map(function(c){ return c.name+' ('+c.why+')'; }).join(', '):'');
      return '<div class="eb-card st-card'+(missRun>=3?' alert':'')+'" data-sid="'+E(o.s.id)+'"><div class="st-h"><span class="eb-dot" style="background:'+E(o.s.color)+'"></span><b>'+E(o.s.name)+'</b><span class="eb-mut">'+E(R.lbl)+' '+num(o.bk)+' / '+num(o.tgt)+' · '+laT('ขาด')+' '+num(gap)+'</span><span class="eb-sp"></span>'+dots+stChip(st,laT('วันนี้')+' +'+num(o.today)+' / '+num(Math.ceil(nd))+' · '+st.t)+'</div>'
        +'<div class="eg-sxh"><span>'+laT('เส้นทาง')+'</span><span>'+laT('ขาด')+'</span><span>'+laT('ต้องได้/วัน')+'</span><span>'+laT('วันนี้')+'</span><span>'+laT('วันที่ว่างเยอะ · กดไปขาย')+'</span></div>'
        +(L.length?L.map(function(x){ var od=(G.openDays[x.f]||[]).slice(0,3), stF=salesStatus(x.today,x.nd);
            return '<div class="eg-sx-r'+(x.lag?' lag':'')+'"><span class="f">'+E(famNameOf(x.f))+(x.lag?' <b>'+laT('ตามหลัง')+'</b>':'')+'</span><span class="n '+(x.lag?'bad':'')+'">'+(x.gap?num(x.gap):'✓')+'</span><span class="n">'+(x.gap?num(Math.ceil(x.nd)):'—')+'</span><span class="n '+stF.c+'">'+(x.today?'+'+num(x.today):'0')+'</span>'
              +'<span class="od">'+(od.length?od.map(function(d){ return '<button onclick="ebGoTrip(\''+E(d.ds)+'\',\''+E(d.rid)+'\')">'+dShort(d.ds)+' · '+laT('ว่าง')+' '+num(d.free)+'</button>'; }).join(''):'<small class="eb-mut">'+laT('ไม่มีวันว่าง')+'</small>')+'</span></div>'; }).join('')
          :'<div class="eb-none">'+laT('ยังไม่มีเป้าแยกเส้นทาง')+'</div>')
        +'<div class="st-ft"><span class="eb-mut">'+laT('เอเยนต์ที่ควรติดต่อ')+':</span>'+(o.calls.length?o.calls.slice(0,4).map(function(c){ return '<span class="eg-call '+c.cls+'" title="'+E(c.sub)+'">'+E(c.name)+' · '+E(c.why)+'</span>'; }).join(''):'<span class="eb-mut">'+laT('ไม่มี')+'</span>')
        +'<span class="eb-sp"></span><button class="eb-btn" data-copy="'+E(summary)+'" onclick="ebCopy(this)">'+laT('คัดลอกสรุปส่งไลน์')+'</button></div></div>'; }).join('');
    if(!cards) cards='<div class="eb-card eb-none">'+(only?(me?laT('ยังไม่มีเป้าของคุณใน')+E(R.lbl):laT('บัญชีนี้ยังไม่ได้ผูกกับเซลส์ (ตั้งใน')+' Sales › '+laT('บัญชีผู้ใช้)')):laT('ยังไม่มีเซลส์ที่มีเป้าใน')+E(R.lbl))+'</div>';
    return head+'<div class="st-cards">'+cards+'</div><div class="eb-foot">'+laT('การ์ดเรียงจากคนที่ตามหลังมากสุด · กรอบแดง')+' = '+laT('ไม่ทันเป้าวันติดกัน 3 วัน · ตัวเลขมาจากสัดส่วนที่ผู้บริหารกำหนดในหน้า')+' Gap to Target'+(only?'':' · '+laT('เซลส์กด "เฉพาะฉัน" เห็นการ์ดตัวเอง'))+'</div>';
  }
  window.ebCopy=function(btn){ var t=btn.getAttribute('data-copy')||''; var done=function(){ toast(laT('คัดลอกแล้ว · วางในไลน์ได้เลย')); }; try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done, function(){ ebCopyFallback(t); done(); }); } else { ebCopyFallback(t); done(); } }catch(_){ ebCopyFallback(t); done(); } };
  function ebCopyFallback(t){ try{ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }catch(_){} }
  /* ── วาด ───────────────────────────────────────────────────────────── */
  /* ══ §execMove (2026-10-18) · แท็บแรก "มูฟเมนต์" · บอร์ดเรือสำหรับผู้บริหารสาย productive ══════════════
     owner: "อยากเห็นมูฟเมนต์ของ Booking · หลักก่อน บุคกิ้งของพรุ่งนี้เต็มแล้วหรือยัง · มีบุคกิ้งอะไรเข้ามาแล้วบ้าง
             · ถ้าเรือออกครบ เต็มทุกลำ ผู้บริหารจะสบายใจ" → ดู mockup → วาดใหม่ใน Claude Design (แคนวาส Executive Board · Movement)
             · "Header พื้นหลังขาวแบบการ์ดอื่น" · "รายละเอียดเส้นทางแบบจอมอนิเตอร์ เห็นว่ากำลังมีบุคกิ้งเข้า เหมือน loading"
             · "ตัดอิโมจิออก" · "มูฟเมนต์วันนี้ใช้ภาษาอังกฤษ เพิ่มชื่อเซลส์" · "แยกภูเก็ต/เขาหลัก"
     หน้าเดียว 4 ส่วน · (1) การ์ดเรือของวันที่เลือก (ค่าตั้งต้น = พรุ่งนี้ · เลื่อนวันได้) หัวการ์ด = วันที่ · วงแหวน % ขายได้ · N/M ลำเต็ม
       · เข้ามาวันนี้ (แยกโซนรับ) · ยกเลิกวันนี้ · รายได้ยืนยันแล้ว + จุดคุ้มทุน · แล้วตารางทีละโปรแกรม: ที่นั่ง (ลายวิ่ง = ยังรับจอง) ·
       ใบล่าสุด (ชิปเขียวกะพริบถ้าเพิ่งเข้าใน 60 นาที · "เงียบมา n ชม." ถ้าว่างแต่ไม่มีใบเข้า) · สถานะ · คุ้มทุน
       (2) Booking Movement · Today = ใบที่เข้าระบบวันนี้ ทุกวันเดินทาง · แท่งรายชั่วโมงซ้อน Phuket/Khao Lak/own · รายการล่าสุดพร้อมชื่อเซลส์
       (3) 7 วันข้างหน้า % ขายได้ต่อวัน · (4) ลำที่ต้องช่วย (ต่ำกว่าคุ้มทุน · ยังว่างแต่คุ้มแล้ว · วันที่ยังไม่มีลำไหนเต็ม)
     ตัวเลขใช้ของกลางเดิมทั้งหมด (getAllotment · tsTripAmount · _dashBkTs · pxTrip be · bkV2EffZone) ผ่านดัชนี §execPerf
     "ลำเต็ม": โปรแกรมเรือลำเดียว = ตามที่นั่งของโปรแกรม · หลายลำ: ถ้าจัดลงเรือแล้วนับตามลำ ไม่งั้นนับตามโปรแกรม (ยังไม่รู้ว่าใครลงลำไหน)
     "เมื่อวานเวลาเดียวกัน": ที่นั่งของวันนั้นที่เข้าระบบก่อน 24 ชม.ที่แล้ว (จากเวลาที่ใบเข้าระบบ · ไม่มีภาพถ่ายย้อนหลังในระบบ)
     ⚠ ไม่มีในระบบจึงไม่แสดง: เวลาที่ใบถูกยกเลิกเป็นชั่วโมง (มีแค่วัน) · สภาพอากาศ */
  var ZG_LBL={PK:'Phuket', KL:'Khao Lak', RN:'Ranong', NT:'Own transport', O:'Other'};
  var ZG_COL={PK:'#1683C7', KL:'#2BB673', RN:'#7C3AED', NT:'#C9CFD9', O:'#9CA3AF'};
  function zgOf(b,t){ var z=''; try{ z=(typeof bkV2EffZone==='function')?(bkV2EffZone(b,t)||''):''; }catch(_){ z=''; } if(!z) z=(t&&t.zone)||(b&&b.pickupZone)||'';
    if(!z||z==='NoTransfer'||z==='NT') return 'NT'; if(z==='PK'||z==='KL'||z==='RN') return z; return 'O'; }
  function mvDate(){ var d=EB.mvd; if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(String(d))) d=addDays(today(),1); return d; }
  function boatsOn(ds, rid){ var out=[]; try{ (baDayBoats(ds)||[]).forEach(function(x){ if(x.routeId===rid) out.push({id:x.boatId, name:(x.boat&&x.boat.name)||x.boatId, cap:+(x.boat&&x.boat.cap)||0}); }); }catch(_){} return out; }
  function chBoatsOn(ds, rid){   /* §mvCharter · ลำเหมาของเส้นทางนี้ในวันนั้น */
    var out=[], seen={};
    eachTrip(ds, ds, function(b,t){ if(t.routeId!==rid || t.bookingMode!=='charter') return;
      var ids=[]; try{ ids=(typeof bkBoatIdsOn==='function')?(bkBoatIdsOn(b,ds)||[]):[]; }catch(_){ ids=[]; }
      if(!ids.length && t.charterBoatId) ids=[t.charterBoatId];
      ids.forEach(function(id){ if(!id || seen[id]) return; seen[id]=1;
        var bo=(typeof BOATS!=='undefined'?BOATS:[]).filter(function(x){ return x && x.id===id; })[0]||{};
        out.push({id:id, name:bo.name||id, cap:+bo.cap||0, ch:1}); });
    });
    return out;
  }
  function isBoatRoute(rid){ var p=((route(rid)||{}).pier)||''; return !!p && p!=='other'; }   /* §mvCharter · โปรแกรมบกไม่ขึ้นบอร์ดเรือ */
  function isFullRow(cap, bk, free){ return cap>0 && (free<=2 || bk>=cap*0.97); }
  function mvDay(ds){
    var t0=today(), now=Date.now(), ago24=now-86400000, I=idx(), rows=[];
    var tot={cap:0, bk:0, free:0, boats:0, full:0, below:0, rev:0, be:0, add:0, addN:0, addV:0, addZ:{PK:0,KL:0,RN:0,NT:0,O:0}, cxl:0, cxlN:0, bk24:0, cap24:0, open:0, freeOpen:0, px:{ad:0,chd:0,inf:0,foc:0}, addPx:{ad:0,chd:0,inf:0,foc:0}};   /* §execMvPax · แยก AD/CHD/INF/FOC */
    routesOn(ds).filter(isBoatRoute).forEach(function(rid){
      var r=route(rid)||{}, al=alOf(rid, ds), B=boatsOn(ds, rid), CH=chBoatsOn(ds, rid);
      var o={rid:rid, dep:((r.times||[])[0]||''), boats:B, cap:0, bk:0, free:null, zg:{PK:0,KL:0,RN:0,NT:0,O:0}, byBoat:{}, add:0, addAg:{}, last:null, lastAny:0, bk24:0, rev:0, be:beOf(rid, ds), n:0, px:{ad:0,chd:0,inf:0,foc:0}, addPx:{ad:0,chd:0,inf:0,foc:0}};
      if(al && al.hasAllotment){ o.cap=+al.availableCapacity||0; o.bk=+al.seatsConsumed||0; o.free=Math.max(0,+al.seatsAvailable||0); }
      eachTrip(ds, ds, function(b,t){ if(t.routeId!==rid) return;
        var p=pax(t), ts=bkTs(b); o.n++; o.rev+=amt(b,t); o.zg[zgOf(b,t)]+=p;
        var isNew=bkDay(b)===t0; ['ad','chd','inf','foc'].forEach(function(k){ var v=(typeof bkV2PaxTot==='function')?bkV2PaxTot(t.pax||{},k):0; tot.px[k]+=v; o.px[k]+=v; if(isNew){ tot.addPx[k]+=v; o.addPx[k]+=v; } });   /* §execMvPax · §execMvVar */
        var bid=''; try{ bid=(bkOpsRead(b,ds)||{}).boatId||''; }catch(_){} if(bid) o.byBoat[bid]=(o.byBoat[bid]||0)+p;
        if(ts>o.lastAny) o.lastAny=ts;
        if(ts && ts<=ago24) o.bk24+=p;
        if(bkDay(b)===t0){ o.add+=p; o.addAg[agentKey(b)]=1; tot.addN++; tot.addV+=amt(b,t); tot.addZ[zgOf(b,t)]+=p; if(!o.last || ts>o.last.ts) o.last={ts:ts, pax:p, name:agentName(b)}; }
      });
      if(!o.cap){ o.bk=o.bk||Object.keys(o.zg).reduce(function(s,k){ return s+o.zg[k]; },0); }
      o.full=isFullRow(o.cap,o.bk,o.free==null?0:o.free);
      o.st = !o.cap ? 'na' : (o.full ? 'full' : ((o.be>0 && o.bk<o.be) ? 'be' : 'open'));
      /* §mvCharter · ลำเหมาต่อท้ายรายชื่อเรือ · เส้นทางที่มีแต่ลำเหมา = เหมาลำทั้งโปรแกรม */
      o.nCh=CH.length; o.boats=o.boats.concat(CH);
      if(CH.length && !o.cap){ o.st='ch'; o.full=true; o.chCap=CH.reduce(function(s2,x){ return s2+(x.cap||0); },0); }
      /* ลำเต็มกี่ลำ */
      var nB=B.length||(CH.length?0:1), fB=0, assigned=Object.keys(o.byBoat).length>0;
      if(o.st==='ch'){ fB=0; }
      else if(B.length>1 && assigned){ B.forEach(function(x){ var p=o.byBoat[x.id]||0; if(x.cap>0 && p>=x.cap*0.97) fB++; }); }
      else fB = o.full ? nB : 0;
      nB+=CH.length; fB+=CH.length;   /* §mvCharter · ลำเหมา = ขายแล้วทั้งลำ */
      o.nB=nB; o.fB=fB;
      tot.cap+=o.cap; tot.bk+=o.bk; if(o.free!=null) tot.free+=o.free; tot.boats+=nB; tot.full+=fB; tot.rev+=o.rev; tot.be+=o.be; tot.add+=o.add;
      if(o.st==='be') tot.below++; if(o.st==='open'){ tot.open++; tot.freeOpen+=o.free||0; }
      if(o.cap){ tot.bk24+=o.bk24; tot.cap24+=o.cap; }
      rows.push(o);
    });
    (I.cxl[t0]||[]).forEach(function(b){ (b.trips||[]).forEach(function(t){ if(t.date!==ds) return; var r=route(t.routeId); if(!pierOk(r)) return; tot.cxl+=pax(t); tot.cxlN++; }); });
    /* เรียงตามลำดับโปรแกรม (รายการเส้นทางของระบบ · แบบเดียวกับหน้าอื่น) · owner 2026-10-19 "ขอปรับการเรียง อิงจากโปรแกรม" · ไม่ย้ายลำเต็มลงล่างแล้ว */
    var rix=function(rid){ var i=-1; try{ i=(typeof ROUTES!=='undefined'?ROUTES:[]).findIndex(function(r){ return r && r.id===rid; }); }catch(_){} return i<0?999:i; };
    rows.sort(function(a,b){ return (rix(a.rid)-rix(b.rid)) || String(a.dep).localeCompare(String(b.dep)); });
    return {ds:ds, rows:rows, tot:tot, pct:pct(tot.bk,tot.cap), pct24:pct(tot.bk24,tot.cap24)};
  }
  function mvMade(ds){
    var L=[]; eachMade(ds, ds, function(b){ var t=(b.trips||[]).filter(function(x){ return x&&x.date; })[0]; if(!t) return; var r=route(t.routeId); if(!pierOk(r)) return;
      var p=(b.trips||[]).reduce(function(s,x){ return s+pax(x); },0); L.push({b:b, t:t, ts:bkTs(b), pax:p, zg:zgOf(b,t), v:money(b)}); });
    return L;
  }
  function mvToday(){
    var t0=today(), L=mvMade(t0), I=idx();
    var o={n:L.length, pax:0, v:0, z:{PK:0,KL:0,RN:0,NT:0,O:0}, hrs:[], feed:[]};
    for(var h=0;h<24;h++) o.hrs.push({h:h, PK:0,KL:0,RN:0,NT:0,O:0, n:0});
    L.forEach(function(x){ o.pax+=x.pax; o.v+=x.v; o.z[x.zg]+=x.pax; if(x.ts){ var h=new Date(x.ts).getHours(); o.hrs[h][x.zg]+=x.pax; o.hrs[h].n++; } o.feed.push({kind:'in', b:x.b, t:x.t, ts:x.ts, pax:x.pax, zg:x.zg}); });
    (I.cxl[t0]||[]).forEach(function(b){ var t=(b.trips||[]).filter(function(x){ return x&&x.date; })[0]; if(!t) return; var r=route(t.routeId); if(!pierOk(r)) return;
      var p=(b.trips||[]).reduce(function(s,x){ return s+pax(x); },0); var at=(b.cancellation&&b.cancellation.at)||b.cancelledAt||''; var ts=at?new Date(at).getTime():0;
      o.feed.push({kind:'cxl', b:b, t:t, ts:ts, pax:p, zg:zgOf(b,t)}); });
    o.feed.sort(function(a,b){ return b.ts-a.ts; });
    /* สัดส่วนภูเก็ต เทียบ 7 วันก่อน */
    var W={PK:0, all:0}; mvMadeRange(addDays(t0,-7), addDays(t0,-1)).forEach(function(x){ W.all+=x.pax; if(x.zg==='PK') W.PK+=x.pax; });
    o.pkShare=pct(o.z.PK, o.pax); o.pkShareWk=pct(W.PK, W.all); o.wkHas=W.all>0;
    return o;
  }
  function mvMadeRange(from, to){ var L=[]; var d=from; while(d<=to){ L=L.concat(mvMade(d)); d=addDays(d,1); } return L; }
  function mv7(){
    var t0=today(), out=[];
    for(var i=1;i<=7;i++){ var d=addDays(t0,i), cap=0, bk=0, nB=0, fB=0, nR=0;
      routesOn(d).filter(isBoatRoute).forEach(function(rid){ var nc=chBoatsOn(d,rid).length; nB+=nc; fB+=nc; var al=alOf(rid,d); if(!al||!al.hasAllotment) return; nR++; var c=+al.availableCapacity||0, k=+al.seatsConsumed||0, f=Math.max(0,+al.seatsAvailable||0); cap+=c; bk+=k; var B=boatsOn(d,rid).length||1; nB+=B; if(isFullRow(c,k,f)) fB+=B; });
      out.push({ds:d, cap:cap, bk:bk, nB:nB, fB:fB, nR:nR, pct:pct(bk,cap)}); }
    return out;
  }
  function tsAgo(ts){ var m=Math.round((Date.now()-ts)/60000); if(m<60) return m+' '+laT('นาที'); var h=Math.round(m/60); if(h<24) return h+' '+laT('ชม.'); return Math.round(h/24)+' '+laT('วัน'); }
  function dateLbl(ds){ var t0=today(); return ds===t0?laT('วันนี้'):(ds===addDays(t0,1)?laT('พรุ่งนี้'):(ds===addDays(t0,-1)?laT('เมื่อวาน'):thD(ds))); }
  function dateLblEn(ds){ var t0=today(); if(ds===t0) return 'Today'; if(ds===addDays(t0,1)) return 'Tomorrow'; var d=dt(ds); return d.getDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]; }
  function enDate(ds){ var d=dt(ds); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+' '+d.getDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]+' '+d.getFullYear(); }
  function thFull(ds){ var en=(typeof laLangGet==='function' && laLangGet()==='en'); var d=dt(ds), M=(typeof laMonAbbr==='function')?laMonAbbr():((typeof laMonAbbrTH==='function')?laMonAbbrTH():null); return thDow(ds)+' '+d.getDate()+' '+(M?M[d.getMonth()]:(d.getMonth()+1))+' '+(en?d.getFullYear():(d.getFullYear()+543)); }   /* §ebEN */
  function zgChips(z, small){
    var ks=['PK','KL','RN','NT','O'].filter(function(k){ return z[k]>0; });
    if(!ks.length) return '';
    return ks.map(function(k){ return '<span style="color:'+(k==='NT'||k==='O'?'var(--eb-mut)':ZG_COL[k])+';font-weight:600">'+E(ZG_LBL[k])+' '+num(z[k])+'</span>'; }).join(' · ');
  }
  /* §execMvVar (2026-10-19) · owner "Card บน ขอเพิ่มจำนวนแยกตาม Variant แยก AD CHD INF FOC" → "เอาไปแทนตรงนี้ แยกตาม Variant ที่เราวางไว้" → "ให้ยุบได้"
     โครงเดียวกับหน้าเช็คอินท่าเรือ: โปรแกรม (family) → variant (route) · ชื่อ variant ตัดชื่อโปรแกรมออก (pckVarLbl) · เรียงตามเวลาออก
     ตัวเลขจากใบจองของวันนั้น (bkV2PaxTot) · +วันนี้ = ใบที่เข้าระบบวันนี้ · กดหัวโปรแกรม = ยุบ/กาง (จำไว้ต่อเครื่อง) */
  var MVC_KEY='eb_mv_fold';
  function mvFold(){ if(!EB.mvc){ var o={}; try{ o=JSON.parse(localStorage.getItem(MVC_KEY)||'{}')||{}; }catch(_){ o={}; } EB.mvc=o; } return EB.mvc; }
  function mvFoldSave(){ try{ localStorage.setItem(MVC_KEY, JSON.stringify(EB.mvc||{})); }catch(_){} }
  window.ebMvFold=function(fid){ var F=mvFold(); if(F[fid]) delete F[fid]; else F[fid]=1; mvFoldSave(); keepRender(true); };
  window.ebMvFoldAll=function(fold){ var F=mvFold(); Object.keys(F).forEach(function(k){ delete F[k]; }); if(fold) (EB._mvFams||[]).forEach(function(k){ F[k]=1; }); mvFoldSave(); keepRender(true); };
  function mvTint(hex, a){ var h=String(hex||'#8b909c').replace('#',''); if(h.length===3) h=h.replace(/(.)/g,'$1$1'); var n=parseInt(h,16); if(isNaN(n)) n=0x8b909c;
    var c=[n>>16&255, n>>8&255, n&255].map(function(x){ return Math.round(x+(255-x)*a); }); return 'rgb('+c.join(',')+')'; }
  function mvShade(hex, a){ var h=String(hex||'#8b909c').replace('#',''); if(h.length===3) h=h.replace(/(.)/g,'$1$1'); var n=parseInt(h,16); if(isNaN(n)) n=0x8b909c;
    var c=[n>>16&255, n>>8&255, n&255].map(function(x){ return Math.round(x*a); }); return 'rgb('+c.join(',')+')'; }
  function mvVarLbl(f, rid){ try{ if(typeof pckVarLbl==='function') return pckVarLbl(f, rid); }catch(_){} return rName(rid).f||rid; }
  function mvVarTable(D){
    var K=['ad','chd','inf','foc'], F={}, ord=[];
    D.rows.forEach(function(o){ var f=fam(o.rid)||{id:o.rid, name:(route(o.rid)||{}).name||o.rid, color:'#8b909c'};
      var A=F[f.id]; if(!A){ A=F[f.id]={f:f, v:[], px:{ad:0,chd:0,inf:0,foc:0}, add:0}; ord.push(f.id); }
      A.v.push(o); K.forEach(function(k){ A.px[k]+=o.px[k]; }); A.add+=K.reduce(function(s,k){ return s+o.addPx[k]; },0); });
    var L=ord.map(function(k){ return F[k]; }), sum=function(P){ return P.ad+P.chd+P.inf+P.foc; };
    if(!L.length) return '';
    L.sort(function(a,b){ return sum(b.px)-sum(a.px) || famIdx(a.f)-famIdx(b.f); });
    L.forEach(function(A){ A.v.sort(function(x,y){ return String(x.dep||'99:99').localeCompare(String(y.dep||'99:99')) || String(mvVarLbl(A.f,x.rid)).localeCompare(String(mvVarLbl(A.f,y.rid))); }); });
    var FD=mvFold(), multi=L.filter(function(A){ return A.v.length>1; }).map(function(A){ return A.f.id; }); EB._mvFams=multi;
    var anyOpen=multi.some(function(k){ return !FD[k]; });
    var cells=function(P, add){ return K.map(function(k){ return '<td class="'+(P[k]?'':'z')+'">'+num(P[k])+'</td>'; }).join('')
      +'<td class="sum">'+num(sum(P))+'</td><td class="add'+(add?'':' z')+'">'+(add?'+'+num(add):'0')+'</td>'; };
    var nV=0, T={ad:0,chd:0,inf:0,foc:0}, tAdd=0;
    var body=L.map(function(A){ var c=A.f.color||'#8b909c', one=A.v.length===1, fold=!one && !!FD[A.f.id]; nV+=A.v.length; K.forEach(function(k){ T[k]+=A.px[k]; }); tAdd+=A.add;
      var o0=A.v[0], sub=one ? (mvVarLbl(A.f,o0.rid)+(o0.dep?' · '+o0.dep:'')+(o0.st==='ch'?' · '+laT('เหมาลำ'):'')) : (A.v.length+' variant');
      if(one && mvVarLbl(A.f,o0.rid)===A.f.name) sub=(o0.dep||'')+(o0.st==='ch'?' · '+laT('เหมาลำ'):'');
      var h='<tr class="fam'+(one?'':' tg')+(fold?' fold':'')+'" data-fam="'+E(A.f.id)+'" style="background:'+mvTint(c,.9)+';color:'+mvShade(c,.62)+'"'
        +(one?'':' onclick="ebMvFold(\''+E(A.f.id)+'\')" title="'+(fold?'กางดู variant':laT('ยุบ'))+'"')+'>'
        +'<td>'+(one?'<span class="cv"></span>':'<span class="cv">'+(fold?'▸':'▾')+'</span>')+'<span class="sw" style="background:'+E(c)+'"></span>'+E(A.f.name)+(sub?'<span class="vn">'+E(sub)+'</span>':'')+'</td>'+cells(A.px, A.add)+'</tr>';
      if(!one && !fold) h+=A.v.map(function(o){ var ad=K.reduce(function(s,k){ return s+o.addPx[k]; },0);
        return '<tr class="var" data-rid="'+E(o.rid)+'"><td>'+E(mvVarLbl(A.f,o.rid))+(o.dep?'<span class="dep">'+E(o.dep)+'</span>':'')+(o.st==='ch'?'<span class="tag">'+laT('เหมาลำ')+'</span>':'')+'</td>'+cells(o.px, ad)+'</tr>'; }).join('');
      return h+'<tr class="gap"><td colspan="7"></td></tr>'; }).join('');
    return '<div class="ebm-vt"><div class="hh"><b>'+laT('ผู้โดยสารแยก')+' Variant</b><span>'+laT('ตามใบจอง')+' · '+num(L.length)+' '+laT('โปรแกรม')+' · '+num(nV)+' variant</span><i></i>'
      +(multi.length?'<button onclick="ebMvFoldAll('+(anyOpen?1:0)+')">'+(anyOpen?laT('ยุบทั้งหมด'):laT('กางทั้งหมด'))+'</button>':'')+'</div>'
      +'<table><thead><tr><th>'+laT('โปรแกรม')+' · variant</th><th>AD</th><th>CHD</th><th>INF</th><th>FOC</th><th class="sum">'+laT('รวม')+'</th><th class="add">+'+laT('วันนี้')+'</th></tr></thead><tbody>'+body
      +'<tr class="tot"><td>'+laT('รวมทุกโปรแกรม')+'</td>'+cells(T, tAdd)+'</tr></tbody></table></div>';
  }
  function viewMove(){
    var t0=today(), ds=mvDate(), D=mvDay(ds), T=D.tot, now=Date.now();
    var piersN={}; D.rows.forEach(function(o){ piersN[(route(o.rid)||{}).pier||'']=1; });
    var allBe = T.below===0 && D.rows.some(function(o){ return o.be>0; });
    var mood = !T.cap ? '' : (T.full===T.boats ? laT('เต็มทุกลำ') : (laT('อีก')+' '+num(T.boats-T.full)+' '+laT('ลำว่างรวม')+' '+num(T.free)+' '+laT('ที่')));
    var moodBe = !T.cap ? '' : (T.below>0 ? ('<span style="color:var(--eb-bad);font-weight:700">'+num(T.below)+' '+laT('โปรแกรมต่ำกว่าคุ้มทุน')+'</span>') : (allBe?laT('ทุกลำผ่านจุดคุ้มทุน'):laT('ยังไม่มีข้อมูลจุดคุ้มทุน')));
    var ring = '<div class="ebm-ring" style="background:conic-gradient(#16A34A 0 '+D.pct+'%, #E5E7EB '+D.pct+'% 100%)"><div><b>'+(T.cap?D.pct+'%':'—')+'</b><small>'+laT('ขายได้')+'</small></div></div>';
    var head='<div class="ebm-head">'
      +'<div class="ebm-date"><div class="k"><span>'+E(dateLbl(ds).toUpperCase())+'</span>'+liveTag()+'</div><div class="big">'+E(thFull(ds))+'</div><div class="sub">'+E(enDate(ds))+' · '+num(T.boats)+' '+laT('ลำออก')+' · '+num(Object.keys(piersN).length)+' '+laT('ท่า')+'</div>'
      +'<div class="nav"><button onclick="ebSet(\'mvd\',\'prev\')" aria-label="'+laT('วันก่อนหน้า')+'">‹</button><button onclick="ebSet(\'mvd\',\'next\')" aria-label="'+laT('วันถัดไป')+'">›</button>'
      +(ds!==addDays(t0,1)?'<button onclick="ebSet(\'mvd\',\'tm\')">'+laT('พรุ่งนี้')+'</button>':'')+(ds!==t0?'<button onclick="ebSet(\'mvd\',\'td\')">'+laT('วันนี้')+'</button>':'')+'</div></div>'
      +'<div class="ebm-mid"><div class="ebm-mood">'+ring+'<div><div class="n"><b>'+num(T.full)+'</b><span> / '+num(T.boats)+' '+laT('ลำเต็ม')+'</span></div><div class="s">'+E(mood)+(mood&&moodBe?' · ':'')+moodBe+'</div>'
      +(T.cap24>0 && T.bk24>0 ? '<div class="c '+(D.pct>=D.pct24?'up':'dn')+'">'+(D.pct>=D.pct24?'▲':'▼')+' '+laT('เมื่อวานเวลาเดียวกัน')+' '+D.pct24+'%</div>' : '')
      +'</div></div>'
      +'<div class="ebm-stats">'
        +'<div><div class="l">'+laT('เข้ามาวันนี้')+'</div><div class="v" style="color:#15803D">+'+num(T.add)+'</div><div class="d">'+num(T.addN)+' '+laT('ใบ')+' · '+baht(T.addV)+'</div><div class="d">'+(zgChips(T.addZ)||'<span class="eb-mut">'+laT('ยังไม่มี')+'</span>')+'</div></div>'
        +'<div><div class="l">'+laT('ยกเลิก / เลื่อนออก')+'</div><div class="v" style="color:'+(T.cxl?'var(--eb-bad)':'var(--eb-ink)')+'">'+(T.cxl?'−'+num(T.cxl):'0')+'</div><div class="d">'+num(T.cxlN)+' '+laT('ใบ วันนี้')+'</div></div>'
        +'<div><div class="l">'+laT('รายได้ยืนยันแล้ว')+'</div><div class="v">'+baht(T.rev)+'</div><div class="d">'+(T.addV?'<span style="color:#15803D;font-weight:600">▲ '+baht(T.addV)+'</span> '+laT('วันนี้'):'')+(T.be?' · '+laT('คุ้มทุน')+' '+baht(T.be):'')+'</div></div>'
      +'</div></div>'   /* §execMvVar · สามช่องเดิมย้ายมาเป็นบรรทัดเล็กใต้วงแหวน · ช่องขวาเป็นตาราง variant */
      +'<div class="ebm-side">'+(mvVarTable(D)||'<div class="eb-none">'+laT('ยังไม่มีใบจอง')+'</div>')+'</div></div>';
    /* ตารางโปรแกรม */
    var byPier={}, pierOrd=[]; D.rows.forEach(function(o){ var p=(route(o.rid)||{}).pier||'other'; if(!byPier[p]){ byPier[p]=[]; pierOrd.push(p); } byPier[p].push(o); });
    var pierNm=function(p){ try{ return (typeof laPierName==='function' && laPierName(p))||p; }catch(_){ return p; } };
    var cols='<div class="ebm-cols"><div>'+laT('เส้นทาง')+'</div><div>'+laT('เรือ')+'</div><div><span>'+laT('ที่นั่ง (ขีด')+' = '+laT('จุดคุ้มทุน)')+'</span><span class="ebm-livek"><i class="ebm-dot"></i>'+laT('มีใบเข้าใน 1 ชม.')+'</span></div><div>'+laT('ล่าสุด')+'</div><div>'+laT('สถานะ')+'</div><div>'+laT('คุ้มทุน')+'</div></div>';
    var body=pierOrd.map(function(p){ var L=byPier[p], f=L.reduce(function(s,o){ return s+o.fB; },0), n=L.reduce(function(s,o){ return s+o.nB; },0);
      return '<div class="ebm-pier"><span>'+E(String(pierNm(p)).toUpperCase())+'</span><span class="eb-st '+(f===n?'g':'w')+'">'+laT('เต็ม')+' '+num(f)+'/'+num(n)+'</span></div>'
        +L.map(function(o){ return mvRow(o, ds, now); }).join(''); }).join('');
    if(!D.rows.length) body='<div class="eb-none">'+laT('ไม่มีเรือออกวันนี้')+(EB.pier?' '+laT('ที่ท่านี้'):'')+'</div>';
    var legend='<div class="eb-foot" style="padding:8px 26px 14px">'+laT('เขียว')+' = '+laT('เต็ม · เหลือง')+' = '+laT('ยังว่างแต่ผ่านคุ้มทุน · แดง')+' = '+laT('ยังไม่ถึงจุดคุ้มทุน · ลายวิ่ง')+' = '+laT('มีใบจองเข้าภายใน 1 ชม. · ขีดดำในแถบ')+' = '+laT('จุดคุ้มทุนของโปรแกรม (จาก Trip P&amp;L · เฉพาะ 7 วันข้างหน้า)')+'</div>';
    var boat='<div class="eb-card ebm-card" id="ebm-boats">'+head+cols+body+legend+'</div>';
    /* Booking Movement · Today (EN) */
    var M=mvToday();
    var mx=Math.max.apply(null,[1].concat(M.hrs.map(function(h){ return h.PK+h.KL+h.RN+h.NT+h.O; })));
    var H=M.hrs.slice(6,23), nowH=new Date().getHours();
    var bars='<div class="ebm-hrs">'+H.map(function(h){ var tot=h.PK+h.KL+h.RN+h.NT+h.O; var seg=['PK','KL','RN','NT','O'].filter(function(k){ return h[k]>0; });
        return '<div class="'+(h.h===nowH?'on':'')+'" title="'+E(String(h.h).padStart(2,'0')+':00 · '+tot+' seats')+'">'+(tot?'<b>'+tot+'</b>':'')+seg.map(function(k){ return '<i style="height:'+Math.max(2,Math.round(h[k]*88/mx))+'px;background:'+ZG_COL[k]+'"></i>'; }).join('')+'</div>'; }).join('')+'</div>'
      +'<div class="ebm-hx">'+H.map(function(h){ return '<span>'+String(h.h).padStart(2,'0')+'</span>'; }).join('')+'</div>'
      +'<div class="ebm-lg">'+['PK','KL','NT'].map(function(k){ return '<span><i style="background:'+ZG_COL[k]+'"></i>'+ZG_LBL[k]+'</span>'; }).join('')+(M.z.RN?'<span><i style="background:'+ZG_COL.RN+'"></i>Ranong</span>':'')+'</div>';
    var feed=M.feed.length?'<div class="ebm-feed">'+M.feed.slice(0,8).map(function(x){ var b=x.b, r=rName(x.t.routeId), s=salesOf(sidOf(b)), b2c=(typeof laIsB2C==='function' && laIsB2C(b));
        return '<div class="r"><span class="t">'+(x.ts?hhmm(x.ts):'—')+'</span><span class="w"><b>'+E(agentName(b))+'</b><span> · '+E(r.f+(r.v?' '+r.v:''))+(x.kind==='cxl'?' · <span style="color:var(--eb-bad);font-weight:600">cancelled</span>':'')+' · <span style="color:'+(x.zg==='NT'||x.zg==='O'?'var(--eb-mut)':ZG_COL[x.zg])+';font-weight:600">'+E(ZG_LBL[x.zg])+'</span></span>'
          +'<span class="'+(b2c?'sl on':'sl')+'">'+(b2c?'Online':'Sales · '+E(s.none?'—':s.name))+'</span></span>'
          +'<span class="p" style="color:'+(x.kind==='cxl'?'var(--eb-bad)':'#15803D')+'">'+(x.kind==='cxl'?'−':'+')+num(x.pax)+'</span><span class="d">'+E(dateLblEn(x.t.date))+'</span></div>'; }).join('')+'</div>'
      : '<div class="eb-none">No bookings received today yet</div>';
    var move='<div class="eb-card" id="ebm-move"><h2>Booking Movement · Today <span class="eb-tag">bookings received today · all travel dates</span>'+src(num(M.n)+' bookings · '+num(M.pax)+' seats · '+baht(M.v))+'</h2>'
      +'<div class="ebm-zt"><span><b style="color:'+ZG_COL.PK+'">'+num(M.z.PK)+'</b> Phuket</span><span><b style="color:'+ZG_COL.KL+'">'+num(M.z.KL)+'</b> Khao Lak</span>'+(M.z.RN?'<span><b style="color:'+ZG_COL.RN+'">'+num(M.z.RN)+'</b> Ranong</span>':'')+'<span><b style="color:var(--eb-mut)">'+num(M.z.NT+M.z.O)+'</b> Own transport</span><span class="eb-sp"></span>'
      +(M.pax?'<span class="eb-mut">Phuket share '+M.pkShare+'%'+(M.wkHas?' · last week '+M.pkShareWk+'%':'')+'</span>':'')+'</div>'+bars+feed+'</div>';
    /* 7 วัน */
    var W=mv7();
    var days='<div class="eb-card" id="ebm-7"><h2>7 '+laT('วันข้างหน้า')+' <span class="eb-tag">'+laT('ที่นั่งขายได้')+'</span>'+src(laT('เป้า')+' '+Math.round(EB_LF_TARGET*100)+'%')+'</h2><div class="ebm-days">'
      +W.map(function(d){ var c=d.cap?(d.pct>=85?'g':(d.pct>=60?'w':'b')):'n';
        return '<button class="d '+c+(d.ds===ds?' cur':'')+'" onclick="ebSet(\'mvd\',\''+d.ds+'\')" title="'+E(thFull(d.ds))+'"><span class="dw">'+E(thDow(d.ds).replace(laT('วัน'),''))+'</span><span class="dd">'+dt(d.ds).getDate()+'</span><span class="pc">'+(d.cap?d.pct+'%':'—')+'</span><span class="br"><i style="width:'+(d.cap?d.pct:0)+'%"></i></span><span class="m">'+(d.nB?num(d.nB)+' '+laT('ลำ · เต็ม')+' '+num(d.fB):laT('ไม่มีเรือ'))+'</span></button>'; }).join('')+'</div></div>';
    /* ลำที่ต้องช่วย */
    var help=[];
    D.rows.filter(function(o){ return o.st==='be'; }).forEach(function(o){ var n=rName(o.rid); help.push({c:'b', t:n.f+(n.v?' '+n.v:'')+' · '+(o.boats.map(function(x){ return x.name; }).join(', ')||laT('ยังไม่วางเรือ'))+' · '+dateLbl(ds), s:num(o.bk)+'/'+num(o.cap)+' · '+laT('ขาดอีก')+' '+num(o.be-o.bk)+' '+laT('ถึงจะคุ้มทุน')+(o.lastAny?' · '+laT('ใบล่าสุด')+' '+tsAgo(o.lastAny)+laT('ที่แล้ว'):''), a:'gap'}); });
    D.rows.filter(function(o){ return o.st==='open' && o.free>0; }).sort(function(a,b){ return b.free-a.free; }).slice(0,3).forEach(function(o){ var n=rName(o.rid), ppx=o.bk>0?o.rev/o.bk:0;
      help.push({c:'w', t:n.f+(n.v?' '+n.v:'')+' · '+dateLbl(ds), s:num(o.bk)+'/'+num(o.cap)+(o.be?' · '+laT('คุ้มแล้ว'):'')+' · '+laT('ว่าง')+' '+num(o.free)+(ppx?' '+laT('ขายได้อีก')+' '+baht(o.free*ppx):''), a:'gap'}); });
    var weak=W.filter(function(d){ return d.cap && d.fB===0 && d.pct<60; });
    if(weak.length) help.push({c:'w', t:weak.map(function(d){ return thDow(d.ds).replace(laT('วัน'),'')+' '+dt(d.ds).getDate(); }).join(' · ')+' '+((typeof laMonAbbr==='function')?laMonAbbr()[dt(weak[0].ds).getMonth()]:'')+' '+laT('ทุกเส้นทาง'), s:laT('ยังไม่มีลำไหนเต็ม · ว่างรวม')+' '+num(weak.reduce(function(s,d){ return s+Math.max(0,d.cap-d.bk); },0))+' '+laT('ที่'), a:'gap'});
    var helpH='<div class="eb-card" id="ebm-help"><h2>'+laT('ลำที่ต้องช่วย')+' <span class="eb-tag">'+laT('ก่อนเรือออก')+'</span></h2>'
      +(help.length?help.map(function(h){ return '<div class="ebm-hr"><i class="'+h.c+'"></i><span><b>'+E(h.t)+'</b><small>'+E(h.s)+'</small></span><button onclick="ebSet(\'tab\',\'gap\')">Gap to Target →</button></div>'; }).join(''):'<div class="eb-none">'+laT('ไม่มี · ทุกลำเต็มหรือผ่านคุ้มทุนแล้ว')+'</div>')+'</div>';
    return boat+'<div class="eb-grid eb-r3">'+move+'<div style="display:flex;flex-direction:column;gap:12px;min-width:0">'+days+helpH+'</div></div>';
  }
  function mvRow(o, ds, now){
    var n=rName(o.rid), r=route(o.rid)||{};
    var fillPct = o.cap ? Math.min(100, o.bk*100/o.cap) : 0;
    var col = (o.st==='full'||o.st==='ch') ? '#047857' : (o.st==='be' ? '#DC2626' : (o.st==='open' ? '#F59E0B' : '#9CA3AF'));
    /* §execMvCompact (2026-10-19) · owner "ตัวที่เหมือนว่ากำลัง Loading ให้ขึ้นเฉพาะอันที่กำลังมีบุคกิ้งเข้าก็พอ อันไม่มีเข้าก็นิ่งๆ"
       ลายวิ่ง + แสงกวาด = มีใบเข้าภายใน 1 ชม. (เกณฑ์เดียวกับชิปเขียวในช่องล่าสุด) และยังรับจองอยู่ */
    var hot = !!(o.last && o.last.ts && (now-o.last.ts)<3600000);
    var liveCls = ((o.st==='open'||o.st==='be') && hot) ? ' ebm-live' : '';
    var bar = o.st==='ch' ? '<div class="ebm-fill"><i style="width:100%;background:#047857"></i><em style="color:#fff">'+num(o.bk)+' '+laT('คน · เหมาลำ')+' '+num(o.nCh)+' '+laT('ลำ')+'</em><b style="color:#fff">'+(o.chCap?(laT('จุ')+' '+num(o.chCap)):laT('เหมา'))+'</b></div>'
      : !o.cap ? '<div class="ebm-fill na"><em>'+num(o.bk)+' · '+laT('ไม่จำกัดที่นั่ง')+'</em></div>'
      : '<div class="ebm-fill"><i class="'+liveCls.trim()+'" style="width:'+fillPct+'%;background:'+col+'"></i>'+(liveCls?'<span class="ebm-scan"></span>':'')+(o.be>0&&o.cap?'<s style="left:'+Math.min(100,o.be*100/o.cap)+'%"></s>':'')
        +'<em style="color:'+(fillPct>=30?'#fff':'#334155')+'">'+num(o.bk)+' / '+num(o.cap)+'</em><b style="color:'+(fillPct>88?'#fff':'#334155')+'">'+(o.full?laT('เต็ม'):laT('ว่าง')+' '+num(o.free))+'</b></div>';
    var boats = o.boats.length ? o.boats.map(function(x){ var c=''; try{ c=(typeof bkV2BoatAvatarColor==='function')?bkV2BoatAvatarColor(x.id):''; }catch(_){} return '<span class="bt"><i style="background:'+(c||famColor(o.rid))+'"></i>'+E(x.name)+(x.ch?' <small>'+laT('เหมา')+'</small>':(o.boats.length>1&&o.byBoat[x.id]?' <small>'+num(o.byBoat[x.id])+'</small>':''))+'</span>'; }).join('') : '<span class="eb-mut">'+laT('ยังไม่วางเรือ')+'</span>';
    var last='';
    if(o.last && o.last.ts){ var fresh=(now-o.last.ts)<3600000;
      last='<span class="'+(fresh?'ebm-new':'ebm-old')+'" title="'+E(o.last.name)+'">'+(fresh?'<i class="ebm-dot"></i>':'')+'+'+num(o.last.pax)+' · '+hhmm(o.last.ts)+'</span><small>'+laT('วันนี้')+' +'+num(o.add)+' · '+num(Object.keys(o.addAg).length)+' '+laT('เอเยนต์')+'</small>'; }
    else if(o.st==='full'||o.st==='ch') last='<span class="ebm-old">—</span><small>'+(o.lastAny?laT('เต็มแล้ว · ใบล่าสุด')+' '+thD(ymd(new Date(o.lastAny))):laT('เต็มแล้ว'))+'</small>';
    else last='<span class="ebm-old">—</span><small style="color:'+((o.st==='be'||o.st==='open')&&o.lastAny&&(now-o.lastAny)>4*3600000?'var(--eb-bad)':'var(--eb-mut)')+'">'+(o.lastAny?laT('เงียบมา')+' '+tsAgo(o.lastAny):laT('ยังไม่มีใบจอง'))+'</small>';
    var st = o.st==='ch' ? '<span class="eb-st g">'+laT('เหมาลำ')+'</span>' : o.st==='full' ? '<span class="eb-st g">'+laT('เต็ม')+'</span>' : (o.st==='be' ? '<span class="eb-st b">'+laT('ต่ำกว่าคุ้มทุน')+'</span>' : (o.st==='open' ? '<span class="eb-st w">'+laT('ยังว่าง')+'</span>' : '<span class="eb-st">'+laT('ไม่จำกัด')+'</span>'));
    var be = o.be>0 ? ('<span class="eb-num">'+num(o.be)+'</span> · '+(o.bk>=o.be?laT('ผ่านแล้ว')+' ✓':laT('ขาดอีก')+' <b style="color:var(--eb-bad)">'+num(o.be-o.bk)+'</b>')) : '<span class="eb-mut">—</span>';
    return '<div class="ebm-row'+(o.st==='be'?' be':'')+'" data-rid="'+E(o.rid)+'" data-st="'+o.st+'">'
      +'<div class="rt" title="'+E((o.dep?o.dep+' · ':'')+String(zgChips(o.zg)).replace(/<[^>]+>/g,''))+'"><b>'+E(n.f+(n.v?' '+n.v:''))+'</b></div>'   /* §execMvSlim (2026-10-19) · owner "ดีเทล เวลา Phuket Khaolak own ตัดออก" · เหลือแต่ชื่อ (เวลา/โซนอยู่ใน tooltip · โซนรวมอยู่ในการ์ด Booking Movement) */
      +'<div class="bts">'+boats+'</div>'+bar+'<div class="lst">'+last+'</div><div>'+st+'</div><div class="bec">'+be+'</div></div>';
  }
  function seg(key, items){ return '<span class="eb-seg">'+items.map(function(it){ return '<button class="'+(EB[key]===it[0]?'on':'')+'" onclick="ebSet(\''+key+'\',\''+it[0]+'\')">'+it[1]+'</button>'; }).join('')+'</span>'; }
  function render(){
    var w=document.getElementById('eb-wrap'); if(!w) return;
    ensureCss();
    var body='';
    try{ body = EB.tab==='move' ? viewMove() : EB.tab==='tgt' ? viewSalesTgt() : EB.tab==='sales' ? viewSales() : (EB.tab==='gap' ? viewGap() : (EB.per==='today' ? viewToday() : viewPeriod())); }
    catch(e){ console.error('[execBoard] render', e); body='<div class="eb-card eb-none">Render error · '+E(e&&e.message)+'</div>'; }
    var t0=today();
    w.innerHTML='<div class="eb">'
      + '<div class="eb-top"><h1>Executive Board<small>'+(EB.tab==='move'?'OVERVIEW · '+laT('มูฟเมนต์บุคกิ้ง'):EB.tab==='tgt'?'OVERVIEW · '+laT('เป้าเซลส์รายวัน'):EB.tab==='gap'?'OVERVIEW · '+laT('ต้องหาอีกเท่าไหร่ถึงเต็มเรือ'):'OVERVIEW · '+laT('รายได้และยอดจอง'))+'</small></h1>'
      + seg('tab',[['move',laT('มูฟเมนต์')],['rev',laT('ภาพรวมรายได้')],['sales','Sales Performance'],['gap','Gap to Target'],['tgt',laT('เป้าเซลส์')]])
      + (EB.tab==='tgt'
          ? (seg('stm',[['this',laT('เดือนนี้')],['next',laT('เดือนหน้า')]]) + seg('me',[['',laT('ทุกคน')],['1',laT('เฉพาะฉัน')]]) + seg('pier',[['','TL + Panwa'],['tublamu','Tub Lamu'],['panwa','Panwa'],['ranong','Ranong']]))
          : EB.tab==='move'
          ? seg('pier',[['','TL + Panwa'],['tublamu','Tub Lamu'],['panwa','Panwa'],['ranong','Ranong']])
          : EB.tab==='sales'
          ? (seg('sp',[['week',laT('สัปดาห์')],['month',laT('เดือน')]])
             + '<span class="eb-nav"><button onclick="ebSet(\'off\','+((+EB.off||0)-1)+')" title="'+laT('ช่วงก่อนหน้า')+'">\u2039</button><b>'+E(spLabel(spRange(EB.sp||'week',+EB.off||0),EB.sp||'week'))+'</b>'
             + '<button onclick="ebSet(\'off\','+Math.min(0,(+EB.off||0)+1)+')"'+((+EB.off||0)>=0?' disabled':'')+' title="'+laT('ช่วงถัดไป')+'">\u203a</button></span>')
          : EB.tab==='gap'
          ? (seg('gp',[['h',EB_HORIZON+' '+laT('วันข้างหน้า')],['month',laT('เดือนนี้')],['next',laT('เดือนหน้า')]])
             + seg('pier',[['','TL + Panwa'],['tublamu','Tub Lamu'],['panwa','Panwa'],['ranong','Ranong']]))
          : (seg('per',[['today',laT('วันนี้')],['month',laT('เดือนนี้')],['quarter',laT('ไตรมาส')],['year',laT('ปีนี้')]])
             + seg('pier',[['','TL + Panwa'],['tublamu','Tub Lamu'],['panwa','Panwa'],['ranong','Ranong']])))
      + '<span class="eb-sp"></span><span class="eb-upd">'+E(thDow(t0))+' '+E(thD(t0))+' '+t0.slice(0,4)+' · '+laT('อัปเดต')+' '+hhmm(Date.now())+' · '+laT('วาดใหม่ทุก 1 นาที')+'</span></div>'
      + body + '</div>';
  }
  var _pending=false;
  function keepRender(sync){
    var m=document.querySelector('.main'), y=m?m.scrollTop:0, wy=window.scrollY;
    var go=function(){ _pending=false; render(); try{ if(m) m.scrollTop=y; window.scrollTo(window.scrollX||0, wy); }catch(_){} };
    if(sync){ go(); return; }
    if(_pending) return; _pending=true;
    /* §execPerf · บอกว่ากำลังคิดก่อน แล้วค่อยคำนวณในเฟรมถัดไป · ปุ่มจึงตอบทันทีแม้ข้อมูลใหญ่ */
    try{ var w=document.getElementById('eb-wrap'); if(w && !document.getElementById('eb-busy')){ var b=document.createElement('div'); b.id='eb-busy'; b.textContent=laT('กำลังคำนวณ')+'…'; w.appendChild(b); } }catch(_){}
    setTimeout(go, 20);
  }
  window.ebRender = render;
  function ebApply(k, v){ if(k==='off') v=Math.min(0,+v||0); if(k==='sp' || k==='tab') EB.off=0; if(k==='tab') EB.gx='';
    if(k==='mvd'){ var t0=today(); v = v==='prev' ? addDays(mvDate(),-1) : v==='next' ? addDays(mvDate(),1) : v==='tm' ? addDays(t0,1) : v==='td' ? t0 : v; }   /* §execMove */
    EB[k]=v; }
  window.ebSet = function(k, v){ ebApply(k, v); keepRender(); };
  window.ebSetNow = function(k, v){ ebApply(k, v); keepRender(true); };   /* ใช้ในเทส · วาดทันที */
  /* Live · วาดใหม่ทุก 60 วินาที เฉพาะตอนหน้านี้เปิดอยู่และแท็บไม่ได้ถูกซ่อน */
  if(!window.__ebTick){
    window.__ebTick = setInterval(function(){
      try{ var v=document.getElementById('view-execboard'); if(!v || !v.classList.contains('active') || document.hidden) return;
        /* §execAllocDraft · owner "แก้สัดส่วนแล้วมันไม่บันทึก" · ตัวจับเวลาวาดใหม่ทุกนาทีทับช่องที่กำลังพิมพ์อยู่ · ระหว่างแก้ไม่วาดใหม่ */
        if(EB.allocEdit) return; var ae=document.activeElement; if(ae && ae.closest && ae.closest('#eb-wrap') && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return;
        keepRender(true); }catch(_){}
    }, 60000);
  window.ebTick=function(){ try{ if(EB.allocEdit) return false; keepRender(true); return true; }catch(_){ return false; } };
  }

  function ensureCss(){
    if(document.getElementById('eb-style')) return;
    var s=document.createElement('style'); s.id='eb-style';
    s.textContent = [
      '#eb-wrap{--eb-ink:#0F1B3D;--eb-ink2:#4A5263;--eb-mut:#8A90A0;--eb-line:#E6E9EF;--eb-blue:#1683C7;--eb-blue-d:#0E5E93;',
      '--eb-good:#0F7B4F;--eb-good-l:#E6F4EC;--eb-warn:#A35F00;--eb-warn-l:#FDF1DC;--eb-bad:#B42318;--eb-bad-l:#FDE8E6;',
      '--eb-s1:#EAF3FB;--eb-s2:#C9E2F5;--eb-s3:#8FC3EA;--eb-s4:#4C9BD6;--eb-s5:#1A6FB0;',
      'background:#EEF2F7;margin:-22px;padding:18px 20px 30px;min-height:calc(100dvh - var(--topbar, 44px));color:var(--eb-ink);font-size:13px;line-height:1.45}',
      '.eb{max-width:1440px;margin:0 auto}',
      '.eb-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
      '.eb-top h1{margin:0;font-size:22px;letter-spacing:-.01em;color:var(--eb-ink)}',
      '.eb-top h1 small{display:block;font-size:11.5px;font-weight:600;color:var(--eb-mut);letter-spacing:.02em}',
      '.eb-seg{display:inline-flex;background:#fff;border:1px solid var(--eb-line);border-radius:9px;padding:2px}',
      '.eb-seg button{font:600 12px inherit;font-family:inherit;padding:5px 11px;border-radius:7px;border:0;background:transparent;color:var(--eb-ink2);cursor:pointer}',
      '.eb-seg button.on{background:var(--eb-ink);color:#fff}',
      '.eb-sp{flex:1}.eb-upd{font-size:11.5px;color:var(--eb-mut)}',
      '.eb-grid{display:grid;gap:12px}',
      '.eb-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}',
      '.eb-kpis.eb-k8{grid-template-columns:repeat(4,minmax(0,1fr))}',   /* §ebCost · 8 ใบ = 2 แถว × 4 */
      '@media(max-width:1180px){.eb-kpis.eb-k8{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '.eb-r5{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}',
      '.eb-r2{grid-template-columns:minmax(0,1fr) minmax(0,1.55fr)}',
      '.eb-r3{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr)}',
      '.eb-r4{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '@media(max-width:1180px){.eb-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.eb-r5,.eb-r2,.eb-r3,.eb-r4{grid-template-columns:minmax(0,1fr)}}',
      '@media(max-width:640px){.eb-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#eb-wrap{padding:12px}}',
      '.eb-card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 2px rgba(15,27,61,.05);min-width:0}',
      '.eb-k .l{font-size:11.5px;font-weight:600;color:var(--eb-ink2)}',
      '.eb-k .v{font-size:25px;font-weight:700;margin:3px 0 2px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}',
      '.eb-k .v small{font-size:12.5px;font-weight:600;color:var(--eb-mut);margin-left:4px}',
      '.eb-k .d{font-size:11.5px;color:var(--eb-mut)}',
      '.eb-k .bar{height:5px;background:#EDF0F4;border-radius:3px;margin-top:8px;overflow:hidden}',
      '.eb-k .bar i{display:block;height:100%;border-radius:3px;background:var(--eb-blue)}',
      '.eb-k.warn{box-shadow:inset 0 3px 0 #F0B44C,0 1px 2px rgba(15,27,61,.05)}',
      '.eb-k.bad{box-shadow:inset 0 3px 0 #E5534B,0 1px 2px rgba(15,27,61,.05)}',
      '.eb-up{color:var(--eb-good);font-weight:700}.eb-dn{color:var(--eb-bad);font-weight:700}.eb-mut{color:var(--eb-mut)}',
      '.eb-st{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;border-radius:6px;padding:1px 7px;white-space:nowrap}',
      '.eb-st.g{background:var(--eb-good-l);color:var(--eb-good)}.eb-st.w{background:var(--eb-warn-l);color:var(--eb-warn)}.eb-st.b{background:var(--eb-bad-l);color:var(--eb-bad)}',
      '#eb-wrap h2{font-size:13.5px;margin:0 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--eb-ink)}',
      '.eb-tag{font-size:10.5px;font-weight:600;color:var(--eb-mut)}',
      '.eb-src{margin-left:auto;font-size:10.5px;font-weight:600;color:var(--eb-blue);white-space:nowrap}',
      '.eb-sec{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--eb-mut);text-transform:uppercase;margin:18px 2px 8px}',
      '.eb-live{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;color:var(--eb-good);background:var(--eb-good-l);border-radius:7px;padding:2px 8px}',
      '.eb-live i{width:7px;height:7px;border-radius:50%;background:#16A34A;box-shadow:0 0 0 3px rgba(22,163,74,.18)}',
      '.eb-tbl{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}',
      '.eb-tbl th{font-size:10.5px;font-weight:700;color:var(--eb-mut);text-align:right;padding:0 6px 6px;white-space:nowrap}',
      '.eb-tbl th:first-child,.eb-tbl td:first-child{text-align:left;padding-left:0}',
      '.eb-tbl td{padding:6px;border-top:1px solid var(--eb-line);text-align:right;white-space:nowrap}',
      '.eb-tbl td:first-child{white-space:normal}',
      '.eb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}',
      '.eb-cap{display:flex;align-items:center;gap:8px;justify-content:flex-end}',
      '.eb-cap .t{width:90px;height:7px;background:#EDF0F4;border-radius:4px;overflow:hidden;display:flex}',
      '.eb-cap .t i{display:block;height:100%}',
      '.eb-cap .n{display:inline-block;min-width:58px;text-align:right}',
      '.eb-sts{font-size:11px;font-weight:700;border-radius:6px;padding:2px 8px;white-space:nowrap;background:#EEF0F4;color:var(--eb-ink2)}',
      '.eb-sts.dep{background:var(--eb-good-l);color:var(--eb-good)}.eb-sts.ck{background:#EAF3FB;color:var(--eb-blue-d)}.eb-sts.wt{background:var(--eb-warn-l);color:var(--eb-warn)}',
      '.eb-tm{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}',
      '.eb-tm>div{background:#F6F8FB;border-radius:10px;padding:9px 12px}',
      '.eb-tm .l{font-size:11px;font-weight:600;color:var(--eb-ink2)}',
      '.eb-tm .v{font-size:20px;font-weight:700}.eb-tm .v small{font-size:11px;color:var(--eb-mut);font-weight:600;margin-left:3px}',
      '.eb-tm .d{font-size:11px;color:var(--eb-mut)}',
      '.eb-feed{list-style:none;margin:0;padding:0}',
      '.eb-feed li{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--eb-line)}',
      '.eb-feed li:first-child{border-top:0}',
      '.eb-feed .t{font-size:11.5px;color:var(--eb-mut);font-variant-numeric:tabular-nums}',
      '.eb-feed .w b{font-weight:700}.eb-feed .w span{display:block;font-size:11.5px;color:var(--eb-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eb-feed .a{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.eb-feed .a span{display:block;font-size:11px;font-weight:600;color:var(--eb-mut)}',
      '.eb-feed li.new{background:linear-gradient(90deg,#EAF7EF,transparent 70%)}',
      '.eb-hb{display:flex;align-items:flex-end;gap:3px;height:90px;border-bottom:1px solid var(--eb-line)}',
      '.eb-hb>div{flex:1;height:100%;display:flex;align-items:flex-end}',
      '.eb-hb i{display:block;width:100%;background:var(--eb-s4);border-radius:3px 3px 0 0}.eb-hb i.now{background:var(--eb-blue-d)}',
      '.eb-hax{display:flex;gap:3px;font-size:9.5px;color:var(--eb-mut);margin-top:3px}.eb-hax span{flex:1;text-align:center}',
      '.eb-bars{display:flex;align-items:flex-end;gap:3px;height:120px;border-bottom:1px solid var(--eb-line)}',
      '.eb-bars i{flex:1;min-width:3px;background:var(--eb-s3);border-radius:3px 3px 0 0}',
      '.eb-bars i.w{background:var(--eb-s4)}.eb-bars i.t{background:var(--eb-blue-d)}',
      '.eb-bars i.f,.eb-lgd i.hatch{background:repeating-linear-gradient(135deg,var(--eb-s2) 0 4px,#fff 4px 7px);box-shadow:inset 0 0 0 1px var(--eb-s3)}',
      '.eb-axis{display:flex;justify-content:space-between;font-size:10.5px;color:var(--eb-mut);margin-top:4px}',
      '.eb-lgd{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:10.5px;color:var(--eb-mut);margin-top:8px}',
      '.eb-lgd i{width:16px;height:9px;border-radius:2px;display:inline-block}',
      '.eb-hstack{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin:6px 0 8px}.eb-hstack i{display:block;height:100%}',
      '.eb-rows .rw{display:grid;grid-template-columns:118px minmax(0,1fr) auto;gap:10px;align-items:center;padding:5px 0}',
      '.eb-rows.two .rw{grid-template-columns:minmax(0,1fr) auto}',
      '.eb-rows .lb{font-size:12px;color:var(--eb-ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eb-rows .vv{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}',
      '.eb-rows .mini{height:7px;background:#EDF0F4;border-radius:4px;overflow:hidden}.eb-rows .mini i{display:block;height:100%;border-radius:4px;background:var(--eb-blue)}',
      '.eb-foot{font-size:11px;color:var(--eb-mut);margin-top:8px}',
      '.eb-none{color:var(--eb-mut);text-align:center !important;padding:14px 0 !important}',
      '#eb-toast{position:fixed;bottom:56px;left:50%;transform:translateX(-50%);z-index:100000;background:#0F7B4F;color:#fff;font-size:12.5px;font-weight:600;padding:8px 16px;border-radius:9px;box-shadow:0 4px 14px rgba(15,27,61,.25);display:none}',
      '#eb-busy{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:50;background:var(--eb-ink);color:#fff;font-size:12px;font-weight:600;padding:6px 14px;border-radius:9px;box-shadow:0 4px 14px rgba(15,27,61,.25)}',
      /* §execSales */
      '.eb-nav{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--eb-line);border-radius:9px;padding:2px 4px}',
      '.eb-nav b{font-size:12px;font-weight:600;padding:0 4px;white-space:nowrap}',
      '.eb-nav button{border:0;background:transparent;font-size:17px;line-height:1;padding:2px 7px;border-radius:6px;cursor:pointer;color:var(--eb-ink)}',
      '.eb-nav button:disabled{opacity:.3;cursor:default}',
      '.eb-scroll{overflow-x:auto}',
      '.eb-tbl.eb-sp td,.eb-tbl.eb-sp th{padding-left:7px;padding-right:7px}',
      '.eb-tbl.eb-sp td:nth-child(2),.eb-tbl.eb-sp th:nth-child(2),.eb-tbl.eb-l2 td:nth-child(2),.eb-tbl.eb-l2 th:nth-child(2){text-align:left}',
      '.eb-tbl td.eb-l{text-align:left;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eb-tbl tr.eb-dim td{color:var(--eb-mut)}',
      '.eb-tbl tr.eb-tot td{border-top:2px solid var(--eb-ink);background:#F6F8FB}',
      '.eb-pct{display:flex;align-items:center;gap:6px;justify-content:flex-end}',
      '.eb-pct span{width:60px;height:6px;background:#EDF0F4;border-radius:3px;overflow:hidden}.eb-pct i{display:block;height:100%;border-radius:3px}',
      '.eb-r4h{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '@media(max-width:1180px){.eb-r4h{grid-template-columns:minmax(0,1fr)}}',
      '.eb-spark{display:flex;align-items:flex-end;gap:3px;height:26px;width:150px;margin-left:auto}',
      '.eb-spark i{flex:1;border-radius:2px 2px 0 0;min-height:2px}',
      '.eb-tbl.eb-tr td{padding-top:4px;padding-bottom:4px}',
      '.eb-new{font-size:10px;font-weight:700;color:#A35F00;background:#FDF1DC;border-radius:5px;padding:0 5px;margin-left:3px;white-space:nowrap}',
      '.eb-qscroll{max-height:330px;overflow:auto}',
      '.eb-mv{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}',
      '.eb-mvl .rw{display:grid;grid-template-columns:minmax(0,1fr) 60px 34px;gap:8px;align-items:center;padding:3px 0;font-size:12px}',
      '.eb-mvl .lb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--eb-ink2)}',
      '.eb-mvl .mini{height:6px;background:#EDF0F4;border-radius:3px;overflow:hidden}.eb-mvl .mini i{display:block;height:100%;border-radius:3px}',
      '.eb-mvl .vv{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}',
      /* §execGap */
      '.eb-gap{border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}',
      '.eb-gap th{text-align:center;padding:0 2px 5px;font-weight:600;font-size:10.5px;color:var(--eb-mut)}.eb-gap th.we{color:var(--eb-ink2)}.eb-gap th.r{text-align:right}',
      '.eb-gap td{padding:3px 2px;border:0}',
      '.eb-gap td.c{min-width:44px;height:32px;border-radius:6px;text-align:center;font-size:11px;font-weight:700;color:var(--eb-ink);padding:0 2px;cursor:default}',
      '.eb-gap td.c small{display:block;font-size:9px;font-weight:600;color:var(--eb-ink2);line-height:1.1}',
      '.eb-gap td.c.g{background:#E6F4EC}.eb-gap td.c.y{background:#FDF1DC}.eb-gap td.c.r{background:#FDE8E6;color:var(--eb-bad)}.eb-gap td.c.r small{color:var(--eb-bad)}',
      '.eb-gap td.c.full{background:#DCE9F5;color:var(--eb-ink2)}.eb-gap td.c.off{background:#F6F8FB;color:#C5CAD4}',
      '.eb-gap td.c.bk{box-shadow:inset 0 0 0 2px #B42318}',
      '.eb-gap .rn{padding-right:12px;font-weight:600;font-size:12px;white-space:nowrap;text-align:left}.eb-gap .rn small{display:block;font-size:10px;color:var(--eb-mut);font-weight:500}',
      '.eb-gap td.tot{text-align:right;padding-left:10px;font-weight:700;white-space:nowrap}.eb-gap td.tot small{display:block;font-weight:500;color:var(--eb-mut);font-size:10px}',
      '.eb-sl{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}',
      '.eb-q{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0 8px}',
      '.eb-q>div{background:#F6F8FB;border-radius:8px;padding:6px 9px}.eb-q .l{font-size:10.5px;color:var(--eb-ink2);font-weight:600}.eb-q .v{font-size:17px;font-weight:700}.eb-q .v small{font-size:10.5px;color:var(--eb-mut);font-weight:600}',
      '.eb-prog{height:7px;background:#EDF0F4;border-radius:4px;overflow:hidden;position:relative;margin:4px 0 2px}.eb-prog i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}.eb-prog s{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--eb-ink)}',
      '.eb-calls{list-style:none;margin:6px 0 0;padding:0}.eb-calls li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;padding:5px 0;border-top:1px solid var(--eb-line);font-size:11.5px;align-items:center}.eb-calls li:first-child{border-top:0}',
      '.eb-calls b{display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.eb-calls span{color:var(--eb-mut);font-size:10.5px}',
      '.eb-why{font-size:10px;font-weight:700;border-radius:5px;padding:1px 6px;white-space:nowrap;color:inherit}',
      '.eb-why.q{background:var(--eb-warn-l);color:var(--eb-warn)}.eb-why.r{background:var(--eb-bad-l);color:var(--eb-bad)}.eb-why.l{background:#EFEAFB;color:#5B289A}.eb-why.o{background:#EAF3FB;color:var(--eb-blue-d)}',
      '.eb-dec{list-style:none;margin:0;padding:0}.eb-dec li{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-top:1px solid var(--eb-line)}.eb-dec li:first-child{border-top:0;padding-top:2px}',
      '.eb-dec .d1 b{display:block;font-size:12.5px}.eb-dec .d1 span{font-size:11px;color:var(--eb-mut)}.eb-dec .d2{font-size:11.5px;color:var(--eb-ink2)}.eb-dec .d2 b{color:var(--eb-ink)}',
      '.eb-opt{display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.eb-opt b{font-size:11px;font-weight:700;border-radius:6px;padding:3px 8px;background:#F1F3F7;color:var(--eb-ink2);white-space:nowrap}.eb-opt b.on{background:var(--eb-ink);color:#fff}',
      '.eb-lb{display:inline-block;height:7px;background:var(--eb-s4);border-radius:3px;vertical-align:middle;margin-right:6px}',
      /* §execAlloc */
      '.eb-btn{font:600 12px inherit;font-family:inherit;padding:5px 12px;border-radius:8px;border:1px solid var(--eb-line);background:#fff;color:var(--eb-ink);cursor:pointer;margin-right:6px}',
      '.eb-btn.p{background:var(--eb-ink);color:#fff;border-color:var(--eb-ink)}.eb-btn.s{font-size:11px;padding:2px 9px;margin-left:8px;text-transform:none;letter-spacing:0;vertical-align:middle}',
      '.eb-btns{margin-top:10px}',
      '.eb-tbl.eb-al input{width:58px;font:600 12px inherit;font-family:inherit;padding:3px 5px;border:1px solid var(--eb-line);border-radius:6px;text-align:right}',
      '.eb-atot{font-weight:700}.eb-atot.over{color:var(--eb-bad)}.eb-atot.under{color:var(--eb-warn)}.eb-atot.ok{color:var(--eb-good)}',
      '.eb-rf{display:flex;flex-wrap:wrap;gap:4px 6px;margin:0 0 8px}',
      '.eb-rf span{font-size:11px;font-weight:700;background:#F1F3F7;border-radius:6px;padding:2px 7px;white-space:nowrap}.eb-rf span.ok{background:var(--eb-good-l);color:var(--eb-good)}',
      '.eb-rf span b{font-weight:600;color:var(--eb-ink2);margin-right:3px}.eb-rf span small{font-weight:600;color:var(--eb-mut);margin-left:3px}',
      '.eb-tbl.eb-pg tr.eb-sub td{padding-top:3px;padding-bottom:3px;font-size:11.5px;color:var(--eb-ink2);border-top:0}.eb-tbl.eb-pg tr.eb-sub td b{font-weight:600}',
      '.eb-spark.eb-wk{width:70px;height:20px;margin-left:auto}',
      /* §execMove · บอร์ดเรือ · จอมอนิเตอร์ */
      '.ebm-card{padding:0;overflow:hidden}',
      '.ebm-head{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1fr) minmax(0,1.75fr);gap:26px;align-items:start;padding:20px 26px;border-bottom:1px solid var(--eb-line)}',
      '@media(max-width:1180px){.ebm-head{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.ebm-side{grid-column:1/-1}}',
      '@media(max-width:700px){.ebm-head{grid-template-columns:minmax(0,1fr)}}',
      '.ebm-date .k{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.1em;color:var(--eb-mut)}',
      '.ebm-date .big{font-size:32px;font-weight:700;line-height:1.15;letter-spacing:-.01em;margin-top:2px}',
      '.ebm-date .sub{font-size:13px;color:var(--eb-mut)}',
      '.ebm-date .nav{display:flex;gap:8px;margin-top:8px}',
      '.ebm-date .nav button{min-width:32px;height:32px;border-radius:8px;border:1px solid #D6DBE3;background:#fff;color:var(--eb-ink);font:600 13px inherit;font-family:inherit;cursor:pointer;padding:0 10px}',
      '.ebm-mood{display:flex;align-items:center;gap:18px}',
      '.ebm-ring{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}',
      '.ebm-ring>div{width:72px;height:72px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}',
      '.ebm-ring b{font-size:21px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}.ebm-ring small{font-size:10px;color:var(--eb-mut)}',
      '.ebm-mood .n{font-size:30px;font-weight:700;line-height:1.1}.ebm-mood .n span{font-size:15px;font-weight:600;color:var(--eb-mut)}',
      '.ebm-mood .s{font-size:12.5px;color:var(--eb-ink2);margin-top:2px}.ebm-mood .c{font-size:12px;font-weight:600;margin-top:2px}.ebm-mood .c.up{color:#15803D}.ebm-mood .c.dn{color:var(--eb-bad)}',
      '.ebm-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--eb-line)}',
      '.ebm-stats>div{min-width:0}',
      '.ebm-stats .l{font-size:11px;color:var(--eb-mut);font-weight:600}.ebm-stats .v{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.25}.ebm-stats .d{font-size:10.5px;color:var(--eb-ink2);line-height:1.4}',
      '.ebm-vt .hh{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.ebm-vt .hh b{font-size:12.5px}.ebm-vt .hh span{font-size:11px;color:var(--eb-mut)}.ebm-vt .hh i{flex:1}',
      '.ebm-vt .hh button{font:inherit;font-size:11px;font-weight:600;color:var(--eb-ink2);background:#fff;border:1px solid var(--eb-line);border-radius:7px;padding:2px 9px;cursor:pointer}.ebm-vt .hh button:hover{background:#F6F8FA}',
      '.ebm-vt table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}',
      '.ebm-vt th{font-size:10px;font-weight:700;color:var(--eb-mut);letter-spacing:.06em;text-align:right;padding:0 8px 6px;white-space:nowrap}.ebm-vt th:first-child{text-align:left;padding-left:10px}.ebm-vt th.sum{color:var(--eb-ink)}.ebm-vt th.add{color:#15803D}',
      '.ebm-vt td{padding:4px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:12.5px;white-space:nowrap}.ebm-vt td:first-child{text-align:left;white-space:normal}',
      '.ebm-vt td.z{color:#C3C8D1}.ebm-vt td.sum{font-weight:700}.ebm-vt td.add{color:#15803D;font-weight:600}.ebm-vt td.add.z{color:#C3C8D1;font-weight:400}',
      '.ebm-vt tr.fam td{font-weight:700;padding-top:6px;padding-bottom:6px}.ebm-vt tr.fam td:first-child{border-radius:8px 0 0 8px;font-size:12.5px}.ebm-vt tr.fam td:last-child{border-radius:0 8px 8px 0}',
      '.ebm-vt tr.fam.tg{cursor:pointer}.ebm-vt tr.fam.tg:hover td{filter:brightness(.97)}',
      '.ebm-vt tr.fam .cv{display:inline-block;width:12px;font-size:10px;opacity:.8}.ebm-vt tr.fam .sw{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:7px;vertical-align:1px}.ebm-vt tr.fam .vn{font-size:10.5px;font-weight:600;opacity:.72;margin-left:6px}',
      '.ebm-vt tr.var td{border-bottom:1px solid #F1F3F6}.ebm-vt tr.var td:first-child{padding-left:29px;color:var(--eb-ink2);font-weight:500}',
      '.ebm-vt tr.var .dep{font-size:11px;color:#9CA3AF;margin-left:6px;font-variant-numeric:tabular-nums}.ebm-vt tr.var .tag{font-size:9.5px;font-weight:700;color:#047857;background:#DCFCE7;border-radius:5px;padding:0 5px;margin-left:5px}',
      '.ebm-vt tr.gap td{height:4px;padding:0;border:0}.ebm-vt tr.tot td{border-top:2px solid var(--eb-ink);font-weight:700;padding-top:7px;font-size:13px}.ebm-vt tr.tot td:first-child{padding-left:10px}',
      '.ebm-cols,.ebm-row{display:grid;grid-template-columns:minmax(220px,300px) 120px minmax(0,1fr) 150px 104px 140px;gap:12px;align-items:center;padding:6px 26px;min-height:40px}',
      '.ebm-cols{background:#F6F8FA;border-bottom:1px solid var(--eb-line);font-size:11px;font-weight:600;color:var(--eb-mut);letter-spacing:.04em;padding-top:7px;padding-bottom:7px}',
      '.ebm-cols>div{display:flex;align-items:center;gap:8px}',
      '.ebm-livek{display:inline-flex;align-items:center;gap:5px;color:#15803D;letter-spacing:.06em}',
      '@media(max-width:1000px){.ebm-cols{display:none}.ebm-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.ebm-row .rt{grid-column:1/-1}}',
      '.ebm-pier{display:flex;align-items:center;gap:10px;padding:8px 26px 3px;font-size:11.5px;font-weight:700;color:#334155;border-top:1px solid #EEF1F5}',
      '.ebm-row{border-top:1px solid #EEF1F5}.ebm-row.be{background:#FFF7F7}',
      '.ebm-row .rt{min-width:0;line-height:1.3}.ebm-row .rt b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ebm-row .rt small{display:block;font-size:11px;color:var(--eb-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ebm-row .bts{display:flex;flex-wrap:wrap;column-gap:10px;row-gap:1px;min-width:0;line-height:1.3}.ebm-row .bt{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:12px;white-space:nowrap}.ebm-row .bt i{width:10px;height:10px;border-radius:50%;flex:none}.ebm-row .bt small{font-weight:600;color:var(--eb-mut)}',
      '.ebm-fill{position:relative;height:22px;background:#EEF1F5;border-radius:6px;overflow:hidden}',
      '.ebm-fill>i{position:absolute;left:0;top:0;bottom:0;border-radius:6px}',
      '.ebm-fill>s{position:absolute;top:0;bottom:0;width:2px;background:var(--eb-ink);opacity:.6}',
      '.ebm-fill em{position:absolute;left:8px;top:0;line-height:22px;font-style:normal;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.ebm-fill b{position:absolute;right:8px;top:0;line-height:22px;font-size:11.5px;font-weight:600}',
      '.ebm-fill.na em{color:var(--eb-mut);font-weight:500}',
      '@keyframes ebm-stripe{from{background-position:0 0}to{background-position:28px 0}}',
      '@keyframes ebm-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}',
      '@keyframes ebm-scan{0%{left:-30%}100%{left:110%}}',
      '.ebm-live{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.22) 0 7px,transparent 7px 14px);background-size:28px 28px;animation:ebm-stripe 1.1s linear infinite}',
      '.ebm-scan{position:absolute;top:0;bottom:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:ebm-scan 2.4s ease-in-out infinite;pointer-events:none}',
      '.ebm-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#16A34A;animation:ebm-pulse 1.4s ease-in-out infinite}',
      '@media(prefers-reduced-motion:reduce){.ebm-live,.ebm-scan,.ebm-dot{animation:none}}',
      '.ebm-row .lst{display:flex;flex-direction:column;gap:0;min-width:0;line-height:1.3}.ebm-row .lst small{font-size:10.5px;color:var(--eb-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ebm-new{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#15803D;background:#DCFCE7;border-radius:6px;padding:1px 7px;width:fit-content;font-variant-numeric:tabular-nums}',
      '.ebm-old{font-size:12px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums}',
      '.ebm-row .bec{font-size:12px;color:var(--eb-mut)}.eb-num{font-weight:600;color:var(--eb-ink);font-variant-numeric:tabular-nums}',
      '.ebm-zt{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;font-size:12px;color:#334155;margin-bottom:4px}.ebm-zt b{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;margin-right:4px}',
      '.ebm-hrs{display:flex;align-items:flex-end;gap:5px;height:110px;padding-top:16px}',
      '.ebm-hrs>div{flex:1;display:flex;flex-direction:column-reverse;gap:1px;position:relative;min-width:0}.ebm-hrs>div i{display:block;border-radius:2px}',
      '.ebm-hrs>div b{position:absolute;top:-16px;left:0;right:0;text-align:center;font-size:10px;font-weight:600;color:var(--eb-mut)}.ebm-hrs>div.on b{color:var(--eb-ink)}',
      '.ebm-hx{display:flex;gap:5px;font-size:10px;color:var(--eb-mut);margin-top:3px}.ebm-hx span{flex:1;text-align:center}',
      '.ebm-lg{display:flex;gap:14px;font-size:11px;color:#334155;margin:6px 0 4px}.ebm-lg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
      '.ebm-feed{display:flex;flex-direction:column;border-top:1px solid #EEF1F5;margin-top:4px}',
      '.ebm-feed .r{display:grid;grid-template-columns:50px minmax(0,1fr) 46px 80px;gap:10px;align-items:center;padding:7px 0;border-top:1px solid #EEF1F5;font-size:12.5px}.ebm-feed .r:first-child{border-top:0}',
      '.ebm-feed .t{font-size:11.5px;color:var(--eb-mut);font-variant-numeric:tabular-nums}.ebm-feed .w{min-width:0}.ebm-feed .w b{font-weight:600}.ebm-feed .w>span{font-size:11.5px;color:var(--eb-mut)}',
      '.ebm-feed .sl{display:inline-block;margin-left:8px;font-size:10.5px;font-weight:600;color:#4338CA;background:#EEF2FF;border-radius:6px;padding:1px 7px;white-space:nowrap}.ebm-feed .sl.on{color:var(--eb-ink2);background:#F3F4F6}',
      '.ebm-feed .p{font-weight:700;text-align:right;font-variant-numeric:tabular-nums}.ebm-feed .d{font-size:11.5px;color:#334155;text-align:right;white-space:nowrap}',
      '.ebm-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}',
      '.ebm-days .d{border:1px solid var(--eb-line);border-radius:12px;padding:10px 4px;text-align:center;display:flex;flex-direction:column;gap:4px;background:#fff;font-family:inherit;cursor:pointer;min-width:0}',
      '.ebm-days .d.cur{border:2px solid var(--eb-ink);padding:9px 3px}',
      '.ebm-days .dw{font-size:11px;color:var(--eb-mut);font-weight:600}.ebm-days .dd{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}.ebm-days .pc{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.ebm-days .g .pc{color:#047857}.ebm-days .w .pc{color:#B45309}.ebm-days .b .pc{color:var(--eb-bad)}.ebm-days .n .pc{color:var(--eb-mut)}',
      '.ebm-days .br{display:block;height:6px;background:#EEF1F5;border-radius:3px;overflow:hidden}.ebm-days .br i{display:block;height:6px}',
      '.ebm-days .g .br i{background:#047857}.ebm-days .w .br i{background:#F59E0B}.ebm-days .b .br i{background:#DC2626}',
      '.ebm-days .m{font-size:10.5px;color:#334155}',
      '.ebm-hr{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-top:1px solid #EEF1F5}.ebm-hr:first-of-type{border-top:0}',
      '.ebm-hr>i{width:12px;height:12px;border-radius:50%;display:inline-block}.ebm-hr>i.b{background:#DC2626}.ebm-hr>i.w{background:#F59E0B}',
      '.ebm-hr b{display:block;font-weight:600}.ebm-hr small{display:block;font-size:11.5px;color:var(--eb-mut)}',
      '.ebm-hr button{font:600 12px inherit;font-family:inherit;border:0;background:transparent;color:var(--eb-blue-d);cursor:pointer;white-space:nowrap;min-height:36px}',
      /* §execGap2 · Gap to Target วาดใหม่ */
      '.eg-head{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,2fr);gap:0;padding:0;overflow:hidden}',
      '.eg-head.st{grid-template-columns:minmax(0,1.1fr) minmax(0,1.6fr)}',
      '@media(max-width:1000px){.eg-head,.eg-head.st{grid-template-columns:minmax(0,1fr)}}',
      '.eg-hl{padding:20px 26px;border-right:1px solid #EEF1F5;display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.eg-hl .k{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.1em;color:var(--eb-mut)}',
      '.eg-hl .big{font-size:28px;font-weight:700;line-height:1.15;letter-spacing:-.01em}.eg-hl .big .n{font-variant-numeric:tabular-nums}.eg-hl .big .n.bad{color:var(--eb-bad)}.eg-hl .big .n.good{color:#15803D}.eg-hl .big .u{font-size:15px;font-weight:600;color:var(--eb-mut)}',
      '.eg-hl .s{font-size:13px;color:var(--eb-ink2)}.eg-hl .c{font-size:12px;font-weight:600;color:var(--eb-ink2)}.eg-hl .c.bad{color:var(--eb-bad)}.eg-hl .c.warn{color:#B45309}.eg-hl .c.good{color:#15803D}',
      '.eg-hl .bar{display:flex;align-items:center;gap:10px;margin-top:4px}.eg-hl .bar .t{flex:1;height:10px;background:#EEF1F5;border-radius:5px;overflow:hidden;position:relative}.eg-hl .bar .t i{position:absolute;left:0;top:0;bottom:0;background:var(--eb-blue-d);border-radius:5px}.eg-hl .bar .t s{position:absolute;top:0;bottom:0;width:2px;background:var(--eb-ink);opacity:.5}.eg-hl .bar span{font-size:11.5px;color:var(--eb-mut);white-space:nowrap}',
      '.eg-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.eg-tiles>div{padding:20px 18px;border-right:1px solid #EEF1F5;display:flex;flex-direction:column;gap:2px;min-width:0}.eg-tiles>div:last-child{border-right:0}',
      '.eg-tiles .l{font-size:11px;color:var(--eb-mut);font-weight:600}.eg-tiles .v{font-size:25px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2}.eg-tiles .v small{font-size:13px;color:var(--eb-mut);font-weight:600}.eg-tiles .v.bad{color:var(--eb-bad)}.eg-tiles .v.warn{color:#B45309}.eg-tiles .v.good{color:#15803D}.eg-tiles .d{font-size:11px;color:var(--eb-ink2)}',
      '@media(max-width:1000px){.eg-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.eg-tiles>div{border-bottom:1px solid #EEF1F5}}',
      '.eg-lg{margin-left:auto;display:flex;gap:12px;font-size:11px;font-weight:500;color:#334155}.eg-lg i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:4px}',
      '.eg-grid{display:grid;gap:4px;align-items:stretch;margin-top:4px}',
      '.eg-dh{text-align:center;font-size:11px;color:var(--eb-mut);font-weight:600;padding-bottom:2px}.eg-dh.we{color:var(--eb-ink)}.eg-dh.td{color:var(--eb-blue-d);font-weight:800}.eg-dh.r{text-align:right}',
      '.eg-rn{display:flex;flex-direction:column;justify-content:center;min-width:0}.eg-rn b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eg-rn small{font-size:11px;color:var(--eb-mut)}',
      '.eg-c{border:0;border-radius:8px;padding:6px 2px;text-align:center;position:relative;font-family:inherit;cursor:pointer;min-height:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;background:#F3F4F6;color:#9CA3AF}',
      '.eg-c b{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.1}.eg-c i{position:absolute;top:3px;right:5px;font-size:9.5px;font-style:normal;font-weight:700;color:#15803D}.eg-c small{font-size:9.5px;font-weight:600;opacity:.8}',
      '.eg-c.g{background:#D1FAE5;color:#047857}.eg-c.w{background:#FEF3C7;color:#92400E}.eg-c.b{background:#FEE2E2;color:#B91C1C}.eg-c.off{cursor:default}',
      '.eg-grid.dense .eg-c b{font-size:12px}.eg-grid.dense .eg-c{min-height:34px;padding:4px 1px}.eg-grid.dense .eg-c small,.eg-grid.dense .eg-c i{display:none}.eg-grid.dense .eg-dh{font-size:10px}',
      '.eg-tot{text-align:right;display:flex;flex-direction:column;justify-content:center}.eg-tot b{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}.eg-tot small{font-size:10.5px;color:var(--eb-mut)}',
      '.eg-sh,.eg-sr{display:grid;grid-template-columns:160px minmax(0,1fr) 70px 110px 130px;gap:10px;align-items:center}',
      '.eg-sh{font-size:11px;font-weight:600;color:var(--eb-mut);letter-spacing:.04em;padding:4px 0 6px;border-bottom:1px solid var(--eb-line)}.eg-sh span:nth-child(n+3){text-align:right}',
      '.eg-sr{padding:8px 0;border-bottom:1px solid #EEF1F5}.eg-sr.open{border-bottom:0}',
      '.eg-sr .nm{display:flex;align-items:center;gap:8px;font:600 13px inherit;font-family:inherit;border:0;background:transparent;color:var(--eb-ink);cursor:pointer;padding:4px 0;text-align:left;min-height:32px}.eg-sr .nm i{font-style:normal;color:var(--eb-mut);font-size:11px}',
      '.eg-sr .pb{position:relative;height:18px;background:#EEF1F5;border-radius:5px;overflow:hidden}.eg-sr .pb i{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.eg-sr .pb s{position:absolute;top:0;bottom:0;width:2px;background:var(--eb-ink);opacity:.5}.eg-sr .pb b{position:absolute;right:7px;top:0;line-height:18px;font-size:11px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums}',
      '.eg-sr .gp{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.eg-sr .gp.bad{color:var(--eb-bad)}.eg-sr .gp.warn{color:#B45309}.eg-sr .gp.good{color:#15803D}',
      '.eg-sr .nd{text-align:right;font-variant-numeric:tabular-nums}.eg-sr .nd small{font-size:10.5px;color:var(--eb-mut)}.eg-sr .td{text-align:right}',
      '@media(max-width:900px){.eg-sh{display:none}.eg-sr{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.eg-sr .nm{grid-column:1/-1}}',
      '.eg-sx{background:#F6F8FA;border-radius:10px;padding:6px 12px 10px;margin:0 0 8px;display:flex;flex-direction:column}',
      '.eg-sxh{display:grid;grid-template-columns:minmax(0,1fr) 52px 64px 50px minmax(0,1.7fr);gap:8px;font-size:10.5px;font-weight:600;color:var(--eb-mut);letter-spacing:.04em;padding:6px 0 4px;border-bottom:1px solid var(--eb-line);order:-1}.eg-sxh span:nth-child(2),.eg-sxh span:nth-child(3),.eg-sxh span:nth-child(4){text-align:right}',
      '.eg-sx .r,.eg-sx-r{display:grid;grid-template-columns:minmax(0,1fr) 52px 64px 50px minmax(0,1.7fr);gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #EEF1F5;font-size:12.5px}.eg-sx .r.lag,.eg-sx-r.lag{background:#FFF7F7;margin:0 -8px;padding-left:8px;padding-right:8px;border-radius:6px}',
      '.eg-sx .f,.eg-sx-r .f{font-weight:600}.eg-sx .f small,.eg-sx-r .f small{display:block;font-size:10.5px;font-weight:500;color:var(--eb-mut)}.eg-sx .f b,.eg-sx-r .f b{color:var(--eb-bad);font-size:10.5px}',
      '.eg-sx .n,.eg-sx-r .n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}.eg-sx .n.bad,.eg-sx-r .n.bad{color:var(--eb-bad)}.eg-sx .n.g,.eg-sx-r .n.g{color:#15803D}.eg-sx .n.w,.eg-sx-r .n.w{color:#B45309}.eg-sx .n.b,.eg-sx-r .n.b{color:var(--eb-bad)}',
      '.eg-sx .od,.eg-sx-r .od{display:flex;gap:4px;flex-wrap:wrap}.eg-sx .od button,.eg-sx-r .od button{font:600 11px inherit;font-family:inherit;background:#EEF2FF;color:var(--eb-blue-d);border:0;border-radius:6px;padding:2px 7px;cursor:pointer;min-height:24px}',
      '.eg-calls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11.5px;padding-top:8px}.eg-calls span,.eg-call{background:#F3F4F6;border-radius:6px;padding:2px 8px;white-space:nowrap}.eg-calls span.q,.eg-call.q{background:#FEE2E2;color:#991B1B}.eg-calls span.l,.eg-call.l{background:#FEF3C7;color:#92400E}',
      '.eg-dec{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #EEF1F5}.eg-dec:first-of-type{border-top:0}.eg-dec b{display:block;font-weight:600}.eg-dec small{display:block;font-size:11.5px;color:var(--eb-mut)}',
      '.eg-opt{display:inline-flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.eg-opt b{font-size:11px;font-weight:600;border:1px solid var(--eb-line);border-radius:7px;padding:3px 8px;color:var(--eb-ink2);background:#fff}.eg-opt b.on{background:var(--eb-ink);color:#fff;border-color:var(--eb-ink)}.eg-opt button{font:600 11.5px inherit;font-family:inherit;border:0;background:transparent;color:var(--eb-blue-d);cursor:pointer;min-height:32px}',
      '.eg-ld{display:grid;grid-template-columns:130px minmax(0,1fr) 54px;gap:10px;align-items:center;font-size:12px;padding:3px 0}.eg-ld .b{height:8px;background:#EEF1F5;border-radius:4px;overflow:hidden}.eg-ld .b i{display:block;height:8px;background:var(--eb-blue)}.eg-ld .n{text-align:right;font-variant-numeric:tabular-nums}',
      /* §execAlloc2 · หน้าต่างกำหนดสัดส่วน */
      '#eb-alloc-ov{position:fixed;inset:0;z-index:9400;background:rgba(11,31,58,.42);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}',
      '#eb-alloc-ov .ea{width:min(1080px,100%);max-height:94vh;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(11,31,58,.28);display:flex;flex-direction:column;overflow:hidden;color:var(--eb-ink,#0F1B3D);font-size:13px}',
      '#eb-alloc-ov .ea-hd{display:flex;align-items:flex-start;gap:16px;padding:18px 24px 14px;border-bottom:1px solid #E1E5EB}#eb-alloc-ov .ea-hd>div{flex:1}#eb-alloc-ov .ea-hd .t{font-size:17px;font-weight:700}#eb-alloc-ov .ea-hd .s{font-size:12px;color:#6B7280;margin-top:2px}',
      '#eb-alloc-ov .ea-hd .x{width:36px;height:36px;border-radius:10px;border:1px solid #E1E5EB;background:#fff;color:#4B5563;font:inherit;font-size:15px;cursor:pointer}',
      '#eb-alloc-ov .ea-src{display:flex;align-items:center;gap:12px;padding:10px 24px;background:#F6F8FA;border-bottom:1px solid #E1E5EB;flex-wrap:wrap;font-size:12px}#eb-alloc-ov .ea-src>span:first-child{font-weight:600;color:#334155}',
      '#eb-alloc-ov .eb-seg{display:inline-flex;background:#fff;border:1px solid #E1E5EB;border-radius:9px;padding:2px}#eb-alloc-ov .eb-seg button{font:600 12px inherit;font-family:inherit;padding:5px 11px;border-radius:7px;border:0;background:transparent;color:#4B5563;cursor:pointer}#eb-alloc-ov .eb-seg button.on{background:#0B1F3A;color:#fff}',
      '#eb-alloc-ov .ea-body{overflow:auto;padding:14px 24px 6px}',
      '#eb-alloc-ov .ea-grid{display:grid;gap:8px 10px;align-items:center}',
      '#eb-alloc-ov .hh{font-size:11px;font-weight:600;color:#6B7280;letter-spacing:.04em;padding-bottom:8px;border-bottom:1px solid #E1E5EB;align-self:end}#eb-alloc-ov .hh.r{text-align:right}',
      '#eb-alloc-ov .hh.f b{display:block;font-size:13px;color:#0B1F3A;letter-spacing:0}#eb-alloc-ov .hh.f small{display:block;font-weight:500;letter-spacing:0}#eb-alloc-ov .hh.f label{display:flex;align-items:center;gap:5px;font-weight:500;letter-spacing:0;margin-top:3px}',
      '#eb-alloc-ov input[type=number]{width:52px;border:1px solid #D6DBE3;border-radius:8px;padding:6px 7px;font:600 13px inherit;font-family:inherit;text-align:right;font-variant-numeric:tabular-nums}#eb-alloc-ov .hh input{width:44px;padding:4px 6px;font-size:12px}#eb-alloc-ov input:focus{outline:0;border-color:#0B1F3A}',
      '#eb-alloc-ov .sn{display:flex;align-items:center;gap:8px;font-weight:600}#eb-alloc-ov .sn small{font-size:10.5px;font-weight:600;background:#F3F4F6;border-radius:6px;padding:1px 6px;color:#6B7280}#eb-alloc-ov .sn.mut{color:#6B7280}',
      '#eb-alloc-ov .cell{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:#6B7280}#eb-alloc-ov .cell b{color:#0B1F3A;font-variant-numeric:tabular-nums}#eb-alloc-ov .cell small{font-size:10.5px;color:#9CA3AF}#eb-alloc-ov .cell.mut{color:#6B7280}',
      '#eb-alloc-ov .rt{text-align:right;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}#eb-alloc-ov .rt.mut{color:#6B7280;font-weight:500}',
      '#eb-alloc-ov .tt{padding-top:8px;border-top:1px solid #E1E5EB;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px}#eb-alloc-ov .tt.r{justify-content:flex-end;font-size:15px}#eb-alloc-ov .tt .eb-atot{font-size:14px;font-variant-numeric:tabular-nums}',
      '#eb-alloc-ov .eb-atot.over{color:var(--eb-bad,#B42318)}#eb-alloc-ov .eb-atot.under{color:#B45309}#eb-alloc-ov .eb-atot.ok{color:#047857}',
      '#eb-alloc-ov .eb-st{display:inline-flex;align-items:center;font-size:11px;font-weight:700;border-radius:6px;padding:1px 7px}#eb-alloc-ov .eb-st.g{background:#D1FAE5;color:#047857}#eb-alloc-ov .eb-st.w{background:#FEF3C7;color:#92400E}#eb-alloc-ov .eb-st.b{background:#FEE2E2;color:#B91C1C}',
      '#eb-alloc-ov .ea-ft{display:flex;align-items:center;gap:10px;padding:12px 24px 16px;border-top:1px solid #E1E5EB;background:#FAFBFC;flex-wrap:wrap}',
      '#eb-alloc-ov .eb-btn{font:600 12.5px inherit;font-family:inherit;padding:8px 14px;border-radius:9px;border:1px solid #D6DBE3;background:#fff;color:#0B1F3A;cursor:pointer;min-height:38px}#eb-alloc-ov .eb-btn.p{background:#0B1F3A;color:#fff;border-color:#0B1F3A}',
      '#eb-alloc-ov .eb-foot{font-size:11.5px;color:#6B7280;padding:8px 0 6px}#eb-alloc-ov .eb-mut{color:#6B7280}#eb-alloc-ov .eb-sp{flex:1}#eb-alloc-ov .eb-num{font-weight:600;color:#0B1F3A}#eb-alloc-ov .eb-dot{width:10px;height:10px;border-radius:50%;display:inline-block}',
      /* §execSalesTgt */
      '.st-chart{padding:16px 24px;display:flex;flex-direction:column;gap:6px;min-width:0}.st-chart .hh{display:flex;align-items:baseline;gap:10px;font-size:12.5px;flex-wrap:wrap}',
      '.st-chart .bars{position:relative;display:flex;align-items:flex-end;gap:6px;height:110px;padding-top:16px;border-bottom:1px solid var(--eb-line)}.st-chart .bars>div{flex:1;background:#D1D5DB;border-radius:3px 3px 0 0;position:relative;min-width:0}.st-chart .bars>div.ok{background:#15803D}.st-chart .bars>div.td{background:var(--eb-blue-d)}',
      '.st-chart .bars>div b{position:absolute;top:-15px;left:0;right:0;text-align:center;font-size:10px;font-weight:600;color:var(--eb-mut)}.st-chart .bars>div.td b{color:var(--eb-ink)}',
      '.st-chart .bars>s{position:absolute;left:0;right:0;border-top:2px dashed var(--eb-ink);opacity:.4;pointer-events:none}.st-chart .bars>em{position:absolute;right:0;margin-bottom:3px;font-size:10.5px;font-style:normal;color:var(--eb-ink2);background:#fff;padding:0 4px}',
      '.st-chart .hx{display:flex;gap:6px;font-size:10px;color:var(--eb-mut)}.st-chart .hx span{flex:1;text-align:center}.st-chart .hx span.td{font-weight:700;color:var(--eb-ink)}',
      '.st-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}@media(max-width:1100px){.st-cards{grid-template-columns:minmax(0,1fr)}}',
      '.st-card{display:flex;flex-direction:column;gap:8px}.st-card.alert{box-shadow:0 0 0 1.5px #FCA5A5,0 1px 2px rgba(15,27,61,.05)}',
      '.st-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.st-h b{font-size:15px;font-weight:700}',
      '.st-d7{display:inline-flex;gap:3px}.st-d7 i{width:10px;height:10px;border-radius:2px;background:#D1D5DB;display:inline-block}.st-d7 i.ok{background:#15803D}.st-d7 i.td{background:var(--eb-blue-d)}.st-d7 i.tdm{background:#DC2626}',
      '.st-card .eg-sxh{order:0}.st-ft{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11.5px;padding-top:6px}',
      '@media(max-width:900px){.eb-dec li{grid-template-columns:minmax(0,1fr)}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
