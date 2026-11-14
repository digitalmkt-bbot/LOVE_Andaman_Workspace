-- 048_boats_capacity_history_views.sql  (2026-11-14) · §capHist ส่วน view · ดูคำอธิบายเต็มใน 047_boats_capacity_history_table.sql
--
-- v_boat_capacity_effective + เปลี่ยน view ที่อ้าง boat_capovr ให้อ่าน v_boat_capacity_effective (อ่านนิยามจริงจาก pg_views)

DO $$
DECLARE
  sch text;
  v record;
  d text;
  nd text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'boats__capacity_history') THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'boat_capovr')
       OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'trips') THEN
      CONTINUE;
    END IF;

    EXECUTE format($v$
      CREATE OR REPLACE VIEW %1$I.v_boat_capacity_effective AS
      SELECT o.id, o.key, o.cap, o.reason, o."by", o.at, 'day'::text AS src
        FROM %1$I.boat_capovr o
      UNION ALL
      SELECT h.row_pk AS id, h.k AS key, h.cap, h.reason, h."by", h.at, 'hist'::text AS src
        FROM (
          SELECT DISTINCT ON (tr.key, ch.boats_id)
                 (tr.key || '::' || ch.boats_id) AS k, ch.row_pk, ch.cap, ch.reason, ch."by", ch.at
            FROM %1$I.trips tr
            JOIN %1$I."boats__capacity_history" ch
              ON ch."from" IS NOT NULL AND ch."from" <> '' AND ch."from" <= tr.key
             AND (ch."to" IS NULL OR ch."to" = '' OR ch."to" >= tr.key)
             AND ch.cap IS NOT NULL AND ch.cap > 0
           ORDER BY tr.key, ch.boats_id,
                    (ch."to" IS NULL OR ch."to" = '') ASC,
                    ch."from" DESC, ch.at DESC NULLS LAST
        ) h
       WHERE NOT EXISTS (SELECT 1 FROM %1$I.boat_capovr o2 WHERE o2.key = h.k)
    $v$, sch);

    FOR v IN SELECT viewname, definition FROM pg_views
              WHERE schemaname = sch AND viewname <> 'v_boat_capacity_effective'
                AND definition ~ '\mboat_capovr\M' LOOP
      d := v.definition;
      nd := regexp_replace(d, '(\m[a-z_]+\.)?\mboat_capovr\M', quote_ident(sch) || '.v_boat_capacity_effective', 'g');
      IF nd <> d THEN
        EXECUTE format('CREATE OR REPLACE VIEW %I.%I AS %s', sch, v.viewname, rtrim(nd, '; ' || chr(10)));
        RAISE NOTICE '048 · %.% now reads v_boat_capacity_effective', sch, v.viewname;
      END IF;
    END LOOP;
  END LOOP;
END $$;
