<template>
  <Transition name="banner">
    <div v-if="store.saveError" class="save-error-banner" :class="errorClass">
      <span>⚠ {{ store.saveError.msg }}</span>
      <button v-if="store.saveError.type === 'conflict'" @click="reload" class="banner-btn conflict-btn">
        โหลดข้อมูลใหม่จากระบบ
      </button>
      <button v-else-if="store.saveError.type !== 'transient'" @click="store.clearSaveError()" class="banner-btn">
        ปิด
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../store/app'

const store = useAppStore()

const errorClass = computed(() => ({
  'is-conflict': store.saveError?.type === 'conflict',
  'is-auth': store.saveError?.type === 'auth',
  'is-transient': store.saveError?.type === 'transient'
}))

function reload() { location.reload() }
</script>

<style scoped>
.save-error-banner {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100001;
  color: #fff;
  border-radius: 22px;
  padding: 9px 18px;
  font: 13px/1.35 'DM Sans', sans-serif;
  box-shadow: 0 6px 20px rgba(0,0,0,.3);
  max-width: 82vw;
  text-align: center;
  display: flex;
  align-items: center;
  gap: 10px;
}
.is-conflict, .is-auth { background: #A32D2D; }
.is-transient { background: #7A4A00; }

.banner-btn {
  border: none;
  border-radius: 9px;
  padding: 6px 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
}
.conflict-btn { background: #fff; color: #A32D2D; }
.banner-btn:not(.conflict-btn) { background: rgba(255,255,255,.2); color: #fff; }

.banner-enter-active, .banner-leave-active { transition: all .25s; }
.banner-enter-from, .banner-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }
</style>
