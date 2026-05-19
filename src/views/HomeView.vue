<script setup lang="ts">
const features = [
  { title: 'Vue 3', desc: 'Composition API + TypeScript' },
  { title: '静态部署', desc: 'Vite 构建，输出纯静态资源' },
  { title: 'H5 适配', desc: '375 设计稿，px 自动转 vw' },
]
</script>

<template>
  <main class="page">
    <header class="hero">
      <h1 class="hero__title">Hisxee</h1>
      <p class="hero__subtitle">Vue 3 · TypeScript · 静态 H5</p>
    </header>

    <section class="cards">
      <article v-for="item in features" :key="item.title" class="card">
        <h2 class="card__title">{{ item.title }}</h2>
        <p class="card__desc">{{ item.desc }}</p>
      </article>
    </section>
  </main>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 24px 16px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #f0f4ff 0%, #fff 45%);
}

.hero {
  margin-bottom: 32px;
  text-align: center;

  &__title {
    margin: 0 0 8px;
    font-size: 32px;
    font-weight: 700;
    color: #1a1a2e;
  }

  &__subtitle {
    margin: 0;
    font-size: 14px;
    color: #666;
  }
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card {
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 6%);

  &__title {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  &__desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: #888;
  }
}
</style>
