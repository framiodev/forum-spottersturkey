import app from 'flarum/admin/app';

app.initializers.add('framio-post-comments', () => {
  app.registry
    .for('framio-dev-post-comments')
    .registerSetting({
      setting: 'framio-post-comments.allow_guests',
      type: 'boolean',
      label: 'Ziyaretçiler yorum yapabilsin',
      help: 'Kapalıysa yalnızca giriş yapmış üyeler yorum yazabilir.',
    })
    .registerSetting({
      setting: 'framio-post-comments.show_preview',
      type: 'boolean',
      label: 'Mesaj altında son yorum önizlemesi',
      help: 'Mesajın altında en son yorumun kısa bir önizlemesi gösterilir.',
    })
    .registerSetting({ setting: 'framio-post-comments.max_length', type: 'number', min: 50, max: 5000, label: 'En fazla yorum uzunluğu (karakter)' })
    .registerSetting({ setting: 'framio-post-comments.user_interval', type: 'number', min: 0, label: 'Üyeler için iki yorum arası bekleme (saniye)', help: '0 = sınırsız' })
    .registerSetting({ setting: 'framio-post-comments.guest_interval', type: 'number', min: 0, label: 'Ziyaretçiler için iki yorum arası bekleme (saniye)' })
    .registerSetting({ setting: 'framio-post-comments.guest_hourly', type: 'number', min: 0, label: 'Ziyaretçi başına saatlik en fazla yorum', help: '0 = sınırsız' });
});
