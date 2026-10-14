import app from 'flarum/admin/app';
import FramioMediaSettingsPage from './components/FramioMediaSettingsPage';

app.initializers.add('framio/upload-exif', () => {
  (app.registry || app.extensionData)
    .for('framio-upload-exif')
    .registerPage(FramioMediaSettingsPage);
});
