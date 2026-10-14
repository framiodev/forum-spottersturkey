import app from 'flarum/forum/app';

// Admin "Genel & Metinler" ayarları; boşsa forum başlığı ve varsayılan metinler
export const siteLabel = () => app.forum.attribute('framioHomeSiteLabel') || app.forum.attribute('title') || '';
export const loadingText = () => app.forum.attribute('framioHomeLoadingText') || `${siteLabel()} ekibinden en güncel ve kaliteli içerikler yükleniyor...`;
export const emptyText = () => app.forum.attribute('framioHomeEmptyText') || 'Bu kategoride henüz yüklenmiş bir fotoğraf bulunmuyor.';
export const shareText = () => (app.forum.attribute('framioHomeShareText') || "{site}'daki bu harika fotoğrafa bak!").replace(/\{site\}/g, siteLabel());
export const photoFallbackTitle = () => `${siteLabel()} Fotoğrafı`;
