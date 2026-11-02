# สร้าง blob ทดสอบหน้าเช็คอินรถจาก subset_ct.json · subset_ct ไม่มี sb_vehicles และไม่มี ops.vanId
# ใส่รถ 12 คัน · จัดรถให้ใบของ 2026-10-15 แบบวน · ติ๊กขึ้นรถ 2 ใน 3 ใบ
#   python3 test/ui/_mk_subset_vck.py  →  allotment_v2/data_exports/subset_vck.json
#   LAD=allotment_v2/data_exports/subset_vck.json node test/ui/t_vckhead.mjs
import json, os
root = os.path.join(os.path.dirname(__file__), '..', '..', 'allotment_v2', 'data_exports')
d = json.load(open(os.path.join(root, 'subset_ct.json')))
names = ['Love1','Love2','Love3','VAN1','VAN2','VAN3','GM1','GM2','Fluke','บังรอม1','สตอ1','V7']
d['sb_vehicles'] = [{'id': 'veh%02d' % i, 'name': n, 'plate': '31-%04d' % (6000 + i), 'driver': 'คนขับ%d' % i,
                     'phone': '08%08d' % i, 'type': 'van', 'active': True} for i, n in enumerate(names)]
k = 0
for b in d['sb_bookings']:
    if b.get('status') in ('cancelled', 'rejected', 'cancelled_weather'): continue
    ts = [t for t in b.get('trips', []) if t.get('date') == '2026-10-15']
    if not ts or b.get('pickupSelf'): continue
    first = (b.get('trips') or [{}])[0].get('date') == '2026-10-15'
    ops = b.setdefault('ops', {}) if first else ts[0].setdefault('ops', {})
    ops['vanId'] = 'veh%02d' % (k % len(names)); k += 1
    if k % 3 != 0: ops['vanCheckin'] = {'at': '2026-10-15T04:30:00+07:00', 'by': 'tester'}
json.dump(d, open(os.path.join(root, 'subset_vck.json'), 'w'), ensure_ascii=False)
print('assigned', k)
