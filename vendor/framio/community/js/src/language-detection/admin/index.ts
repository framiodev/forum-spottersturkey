import app from 'flarum/admin/app';
import LanguageDetectionPage from './components/LanguageDetectionPage';

app.initializers.add('huseyinfiliz-language-detection', () => {
  app.registry.for('huseyinfiliz-language-detection').registerPage(LanguageDetectionPage);
  app.registry.for('framio-community:language-detection').registerPage(LanguageDetectionPage);
});
