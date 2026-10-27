@php
  $primary = $settings->get('theme_primary_color', '#b72a2a');
  $base = $url->to('forum')->base();
  $logo = $settings->get('logo_path') ? $base . '/assets/' . $settings->get('logo_path') : null;
  $title = $settings->get('forum_title');
@endphp
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex">
  <title>Sayfa bulunamadı - {{ $title }}</title>
  {{-- Sitenin tasarımıyla uyumlu 404 sayfası (çekirdeğin sade beyaz sayfası yerine) --}}
  <style>
    :root { --primary: {{ $primary }}; --bg: #f4f4f5; --card: #fff; --text: #1f2328; --muted: #6b7280; }
    @media (prefers-color-scheme: dark) { :root { --bg: #18181b; --card: #232326; --text: #ececee; --muted: #9ca3af; } }
    * { box-sizing: border-box; }
    html, body { margin: 0; overflow-x: hidden; }
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px;
      background: var(--bg); color: var(--text); font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .card { width: 100%; max-width: 420px; background: var(--card); border-radius: 20px; padding: 32px 24px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
    .logo { max-width: 180px; max-height: 56px; margin: 0 auto 20px; display: block; }
    .code { font-size: 64px; font-weight: 800; color: var(--primary); line-height: 1; margin: 0 0 8px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: var(--muted); margin: 0 0 24px; overflow-wrap: anywhere; }
    .actions { display: grid; gap: 10px; }
    a.btn { display: block; padding: 14px 16px; border-radius: 12px; text-decoration: none; font-weight: 600; min-height: 48px; }
    a.primary { background: var(--primary); color: #fff; }
    a.ghost { border: 1px solid rgba(127,127,127,.3); color: var(--text); }
  </style>
</head>
<body>
  <main class="card">
    @if ($logo)<img class="logo" src="{{ $logo }}" alt="{{ $title }}">@endif
    <div class="code">404</div>
    <h1>Aradığınız sayfa bulunamadı</h1>
    <p>Sayfa taşınmış ya da kaldırılmış olabilir.</p>
    <div class="actions">
      <a class="btn primary" href="{{ $base }}/">Ana sayfaya dön</a>
      <a class="btn ghost" href="{{ $base }}/kesfet">Fotoğrafları keşfet</a>
      <a class="btn ghost" href="{{ $base }}/all">Tüm tartışmalar</a>
    </div>
  </main>
</body>
</html>
