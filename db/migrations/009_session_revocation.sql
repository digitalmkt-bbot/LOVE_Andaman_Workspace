-- 009_session_revocation.sql  (2026-08-14)
--
-- Why this exists
-- ---------------
-- verify() in server.js is stateless: it checks an HMAC signature and an `exp` field, nothing more.
-- There is no revocation list. That means the ONLY thing that ever ended a session was the browser
-- dropping the session cookie. iPhone Safari does not reliably drop it, so staff on iPhones could not
-- sign out at all — the button worked, the request returned 200, the cookie survived, and the reload
-- brought them straight back in. No amount of Set-Cookie tuning fixes a browser that ignores it.
--
-- `logout_after` is the server's own answer: the ms timestamp of the user's last sign-out. Any token
-- issued before it is rejected, whatever the browser kept. Sign-out stops depending on the client.
--
-- Tokens minted before this change carry no `iat`; those are treated as issued at 0, so the first
-- sign-out invalidates them. A sign-out therefore ends that user's other active sessions too, which
-- is the correct and expected reading of "sign me out".
--
-- Idempotent: safe to re-run. Guarded on table existence so it is a no-op on a blob-mode database.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'operation_schemas' AND table_name = 'users') THEN
    ALTER TABLE operation_schemas.users ADD COLUMN IF NOT EXISTS logout_after BIGINT;
    COMMENT ON COLUMN operation_schemas.users.logout_after IS
      'ms epoch of last sign-out; session tokens issued at or before this are rejected (see verify() in server.js)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS logout_after BIGINT;
  END IF;
END $$;

-- Verify:
--   SELECT table_schema, column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name = 'logout_after';
--   -- expect one row per existing users table, data_type = 'bigint'
