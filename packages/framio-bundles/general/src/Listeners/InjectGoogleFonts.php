<?php

namespace Framio\General\Listeners;

use Flarum\Frontend\Document;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;

class InjectGoogleFonts
{
    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $bodyFont = trim((string) $this->settings->get('framio-general.google_fonts_body'));
        $headingFont = trim((string) $this->settings->get('framio-general.google_fonts_heading'));

        if (empty($bodyFont) && empty($headingFont)) {
            return;
        }

        $fontsToLoad = [];
        if (!empty($bodyFont)) {
            $fontsToLoad[] = 'family=' . str_replace(' ', '+', $bodyFont) . ':ital,wght@0,300;0,400;0,500;0,600;0,700;1,400';
        }
        if (!empty($headingFont) && $headingFont !== $bodyFont) {
            $fontsToLoad[] = 'family=' . str_replace(' ', '+', $headingFont) . ':wght@400;500;600;700;800';
        }

        if (empty($fontsToLoad)) {
            return;
        }

        $fontUrl = 'https://fonts.googleapis.com/css2?' . implode('&', $fontsToLoad) . '&display=swap';

        // Preconnect bağlantıları ekleme
        $document->head[] = '<link rel="preconnect" href="https://fonts.googleapis.com">';
        $document->head[] = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
        $document->head[] = '<link rel="stylesheet" href="' . htmlspecialchars($fontUrl, ENT_QUOTES, 'UTF-8') . '">';

        // CSS Kurallarını enjekte etme
        $cssRules = [];
        if (!empty($bodyFont)) {
            $cssRules[] = "body, .App, button, input, select, textarea { font-family: '{$bodyFont}', sans-serif !important; }";
        }
        if (!empty($headingFont)) {
            $cssRules[] = "h1, h2, h3, h4, h5, h6, .DiscussionListItem-title, .PostHero-title, .Hero-title { font-family: '{$headingFont}', sans-serif !important; }";
        }

        if (!empty($cssRules)) {
            $document->head[] = '<style id="framio-google-fonts">' . implode("\n", $cssRules) . '</style>';
        }
    }
}
