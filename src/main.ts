// import 'typelessform-widget'; // using local dev server on :5174 instead
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');
