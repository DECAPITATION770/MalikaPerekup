import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './ru.json';
import uz from './uz.json';

i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, uz: { translation: uz } },
  lng: localStorage.getItem('tenant_lang') ?? 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

// Dev-only: i18next caches its dictionary on init, so Vite-hot-updating a
// JSON file alone won't refresh visible strings (you'd see raw keys until a
// hard reload). This wires JSON changes back into the live i18n instance.
if (import.meta.hot) {
  import.meta.hot.accept(['./ru.json', './uz.json'], async () => {
    const [nextRu, nextUz] = await Promise.all([
      import('./ru.json'),
      import('./uz.json'),
    ]);
    i18n.addResourceBundle('ru', 'translation', nextRu.default, true, true);
    i18n.addResourceBundle('uz', 'translation', nextUz.default, true, true);
    // Force a re-render in subscribers.
    i18n.changeLanguage(i18n.language);
  });
}

export default i18n;
