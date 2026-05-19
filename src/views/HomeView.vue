<script setup lang="ts">
import { onMounted } from 'vue'
import { startMultipleWindow3dScene } from '@/multipleWindow3dScene/loadDemo'

onMounted(() => {
  startMultipleWindow3dScene()
})
</script>

<template>
  <div class="mw3d-root" aria-hidden="true" />
</template>
