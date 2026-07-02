'use strict';
require('dotenv').config();

const DB_SCHEMA = process.env.DB_SCHEMA || 'operation_schemas';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(DB_SCHEMA)) throw new Error('Invalid DB_SCHEMA: ' + DB_SCHEMA);

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',        // set in env only — never hardcode
  DB_SCHEMA,
  DATA_BACKEND: (process.env.DATA_BACKEND || 'blob').toLowerCase(),   // 'blob' (default) | 'relational'
};
