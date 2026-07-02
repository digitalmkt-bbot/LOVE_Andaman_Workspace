'use strict';
const { Pool } = require('pg');
const cfg = require('./config');

let pool = null;
function getPool() {
  if (pool) return pool;
  if (!cfg.DATABASE_URL) throw new Error('DATABASE_URL is not set (env only)');
  pool = new Pool({ connectionString: cfg.DATABASE_URL, max: 10 });
  // resolve unqualified names to operation_schemas first, then public
  pool.on('connect', (c) => { c.query(`SET search_path TO ${cfg.DB_SCHEMA}, public`).catch(() => {}); });
  return pool;
}
module.exports = { getPool };
