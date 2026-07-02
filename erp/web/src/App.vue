<script setup>
import { ref, onMounted } from 'vue';

const health = ref('…');
const bookings = ref(null);
const lockId = ref('lk002');
const qty = ref(1);
const drawMsg = ref('');

async function load() {
  try {
    health.value = (await (await fetch('/api/health')).json()).ok ? 'ok' : 'down';
    bookings.value = (await (await fetch('/api/bookings')).json()).count;
  } catch (e) { health.value = 'unreachable'; }
}

async function draw() {
  const r = await fetch(`/api/seat-locks/${lockId.value}/draw`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qty: Number(qty.value) }),
  });
  const j = await r.json();
  drawMsg.value = r.ok ? `✓ drawn · ${j.used}/${j.qty} used` : `✗ ${r.status} · ${j.error}`;
}

onMounted(load);
</script>

<template>
  <main style="font-family:system-ui;max-width:520px;margin:48px auto;line-height:1.6">
    <h1>ERP dev · Vue + Express</h1>
    <p>API health: <b>{{ health }}</b> · bookings in DB: <b>{{ bookings }}</b></p>
    <fieldset style="margin-top:24px">
      <legend>Draw seat lock (concurrency-safe RPC)</legend>
      lock <input v-model="lockId" size="8" />
      qty <input v-model="qty" type="number" min="1" style="width:56px" />
      <button @click="draw">draw</button>
      <p style="min-height:1.4em">{{ drawMsg }}</p>
    </fieldset>
  </main>
</template>
