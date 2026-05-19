<script setup lang="ts">
import { onMounted } from 'vue'
import { startMultipleWindow3dScene } from '@/multipleWindow3dScene/loadDemo'

onMounted(() => {
  startMultipleWindow3dScene()
})
</script>

<template>
  <!-- 与原版相同：Three.js 将 canvas 挂到 document.body -->
</template>
