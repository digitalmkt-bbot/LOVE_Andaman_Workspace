-- 049_boats_capacity_history_repoint.sql  (2026-11-14) · §capHist ความปลอดภัยหลังเปลี่ยนชื่อ
--
-- 047/048 ถูกเปลี่ยนชื่อ (boats__caphist → boats__capacity_history · v_boat_capovr_eff → v_boat_capacity_effective)
-- หลัง push ไปแล้วไม่กี่นาที · ถ้ามี deploy รอบไหนรันชื่อเก่าไปก่อน view ที่นั่งว่าง (v_seat_availability ฯลฯ)
-- จะยังชี้ v_boat_capovr_eff → อ่านตารางเก่าที่ว่าง → ไม่เห็นช่วงที่นั่ง · และ 048 ชื่อใหม่ไม่ซ่อมให้ (regex หา boat_capovr ตรงตัว)
--
-- ไฟล์นี้: 1) ถ้ามีตารางชื่อเก่า คัดลอกแถวที่ยังไม่มีมาไว้ตารางใหม่ (ไม่ลบของเก่า)
--          2) view ไหนยังอ้าง v_boat_capovr_eff → ชี้ v_boat_capacity_effective
-- ไม่มีชื่อเก่าเลย = ไม่ทำอะไร · รันซ้ำได้

DO $$
DECLARE
  sch text;
  v record;
  nd text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'boats__capacity_history') THEN
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'boats__caphist'
               AND table_type = 'BASE TABLE') THEN
      EXECUTE format('INSERT INTO %1$I."boats__capacity_history"
                        (boats_id, idx, row_pk, id, "from", "to", cap, reason, note, "by", at)
                      SELECT o.boats_id, o.idx, o.row_pk, o.id, o."from", o."to", o.cap, o.reason, o.note, o."by", o.at
                        FROM %1$I."boats__caphist" o
                       WHERE NOT EXISTS (SELECT 1 FROM %1$I."boats__capacity_history" n WHERE n.row_pk = o.row_pk)
                         AND EXISTS (SELECT 1 FROM %1$I.boats b WHERE b.id = o.boats_id)', sch);
    END IF;
    IF to_regclass(quote_ident(sch) || '.v_boat_capacity_effective') IS NULL THEN
      CONTINUE;
    END IF;
    FOR v IN SELECT viewname, definition FROM pg_views
              WHERE schemaname = sch AND viewname NOT IN ('v_boat_capacity_effective','v_boat_capovr_eff')
                AND definition ~ 'v_boat_capovr_eff' LOOP
      nd := regexp_replace(v.definition, '(\m[a-z_]+\.)?v_boat_capovr_eff\M', quote_ident(sch) || '.v_boat_capacity_effective', 'g');
      EXECUTE format('CREATE OR REPLACE VIEW %I.%I AS %s', sch, v.viewname, rtrim(nd, '; ' || chr(10)));
      RAISE NOTICE '049 · %.% now reads v_boat_capacity_effective', sch, v.viewname;
    END LOOP;
  END LOOP;
END $$;
