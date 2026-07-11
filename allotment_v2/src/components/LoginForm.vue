<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#1a6a8a"/>
          <path d="M8 22 L16 10 L24 22" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 18 L21 18" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div>
          <div class="login-brand">LOVE Andaman</div>
          <div class="login-sub">Operations</div>
        </div>
      </div>

      <form @submit.prevent="submit" class="login-form">
        <div class="login-field">
          <label>Username</label>
          <input v-model="username" type="text" autocomplete="username" required autofocus placeholder="username" />
        </div>
        <div class="login-field">
          <label>Password</label>
          <input v-model="password" type="password" autocomplete="current-password" required placeholder="••••••••" />
        </div>
        <div v-if="auth.error.value" class="login-error">{{ auth.error.value }}</div>
        <button type="submit" class="login-btn" :disabled="auth.loading.value">
          {{ auth.loading.value ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits(['login-success'])
const auth = useAuth()
const username = ref('')
const password = ref('')

async function submit() {
  const ok = await auth.login(username.value, password.value)
  if (ok) emit('login-success')
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sand);
}
.login-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 32px;
  width: 340px;
  box-shadow: var(--shadow);
}
.login-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}
.login-brand { font-size: 18px; font-weight: 700; color: var(--ink); }
.login-sub { font-size: 11px; color: var(--ink-soft); }
.login-form { display: flex; flex-direction: column; gap: 14px; }
.login-field { display: flex; flex-direction: column; gap: 5px; }
.login-field label { font-size: 11px; font-weight: 600; color: var(--ink-mid); text-transform: uppercase; letter-spacing: .04em; }
.login-field input {
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  font-size: 13px;
  font-family: inherit;
  color: var(--ink);
  background: var(--white);
  outline: none;
  transition: border-color .15s;
}
.login-field input:focus { border-color: var(--ocean-mid); }
.login-error { font-size: 12px; color: var(--red); background: var(--red-light); border-radius: var(--r-sm); padding: 8px 11px; }
.login-btn {
  padding: 10px;
  background: var(--ocean);
  color: #fff;
  border: none;
  border-radius: var(--r-sm);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background .15s;
  margin-top: 4px;
}
.login-btn:hover:not(:disabled) { background: var(--ocean-mid); }
.login-btn:disabled { opacity: .6; cursor: not-allowed; }
</style>
