import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');

// 阻止移动端双击缩放与长按菜单
document.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement)?.closest?.('.no-menu, canvas, .touch-layer')) e.preventDefault();
});
document.addEventListener('gesturestart', (e) => e.preventDefault());
