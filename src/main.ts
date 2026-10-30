import './ui/style.css';
import { mountApp } from './ui/app';

mountApp(document.getElementById('app')!);

// Offline use and "Zum Home-Bildschirm": only in the built app, the dev server changes too often.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Without a service worker the app still works, just not offline.
    });
  });
}
