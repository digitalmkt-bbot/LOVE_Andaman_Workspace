'use strict';
const app = require('./app');
const cfg = require('./config');
app.listen(cfg.PORT, () => {
  console.log(`os-backend listening on :${cfg.PORT}  ·  DATA_BACKEND=${cfg.DATA_BACKEND}  ·  schema=${cfg.DB_SCHEMA}`);
});
