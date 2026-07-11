<template>
  <Transition name="bar">
    <div v-if="loading" class="loading-bar">
      <div class="loading-bar-fill"></div>
    </div>
  </Transition>
</template>

<script setup>
import { useLoading } from '../composables/useLoading'
const { loading } = useLoading()
</script>

<style scoped>
.loading-bar {
  position: fixed;
  top: var(--topbar);
  left: 0;
  right: 0;
  height: 2px;
  z-index: 200;
  overflow: hidden;
}
.loading-bar-fill {
  height: 100%;
  background: var(--ocean-mid);
  animation: sweep 1.4s ease-in-out infinite;
}
@keyframes sweep {
  0%   { transform: translateX(-100%); width: 60%; }
  50%  { transform: translateX(66%);   width: 60%; }
  100% { transform: translateX(200%);  width: 60%; }
}
.bar-enter-active, .bar-leave-active { transition: opacity .15s; }
.bar-enter-from, .bar-leave-to { opacity: 0; }
</style>
