import app from 'flarum/admin/app';
import framioGeneralPage from './FramioGroupPage';
import SpeedStatsTab from './components/SpeedStatsTab';
import SeamlessRefreshTab from './components/SeamlessRefreshTab';
import GoogleFontsTab from './components/GoogleFontsTab';
import LogoManagerTab from './components/LogoManagerTab';
import DarkModeTab from './components/DarkModeTab';

import Style from './modularis/model/Style';
import ModularisTab from './components/ModularisTab';
import BackupPanel from './backup/components/BackupPanel';
import DebugLogTab from './components/DebugLogTab';
import WebCronTab from './components/WebCronTab';
import debugCapture from '../common/debugCapture';
import runtimeDarkPatch from '../common/runtimeDarkPatch';

app.initializers.add('framio-general', () => {
  debugCapture(app, 'admin'); // ayar gönderim anında denetlenir (app.forum burada henüz yok)
  runtimeDarkPatch();

  app.store.models['modularis-styles'] = Style;

  const tabs = [
    { key: 'speed_cache', title: 'Hız & Önbellek' },
    { key: 'seamless_refresh', title: 'Kesintisiz Yenileme' },
    { key: 'google_fonts', title: 'Yazı Tipleri (Google Fonts)' },
    { key: 'logo_manager', title: 'Logo Yöneticisi' },
    { key: 'dark_mode', title: 'Karanlık Mod 🌙' },
    { key: 'modularis', title: 'Modüler CSS' },
    { key: 'backup', title: 'Yedekleme & Taşıma 📦' },
    { key: 'debug_log', title: 'Hata Günlüğü & Debug 🐞' },
    { key: 'web_cron', title: 'Zamanlanmış Görevler ⏱' },
  ];

  const renderTab = (key) => {
    switch (key) {
      case 'web_cron':
        return <WebCronTab />;
      case 'debug_log':
        return <DebugLogTab />;
      case 'backup':
        return (
          <div className="container" style={{ marginTop: '20px' }}>
            <BackupPanel />
          </div>
        );
      case 'modularis':
        return <ModularisTab />;
      case 'dark_mode':
        return <DarkModeTab />;
      case 'logo_manager':
        return <LogoManagerTab />;
      case 'google_fonts':
        return <GoogleFontsTab />;
      case 'seamless_refresh':
        return <SeamlessRefreshTab />;
      case 'speed_cache':
      default:
        return <SpeedStatsTab />;
    }
  };

  app.registry
    .for('framio-general')
    .registerPage(framioGeneralPage(tabs, renderTab))
    .registerPermission(
      {
        icon: 'fas fa-file-archive',
        label: app.translator.trans('ramon-backup.admin.permissions.manage_label'),
        permission: 'backup.manage',
      },
      'moderate'
    );
});

