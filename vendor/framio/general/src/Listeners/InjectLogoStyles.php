<?php

namespace Framio\General\Listeners;

use Flarum\Frontend\Document;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;

class InjectLogoStyles
{
    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $desktopHeight = (int) ($this->settings->get('framio-general.logo_desktop_height') ?: 0);
        $mobileHeight = (int) ($this->settings->get('framio-general.logo_mobile_height') ?: 0);
        $alignment = (string) ($this->settings->get('framio-general.logo_alignment') ?: 'left');
        $seasonalHat = (bool) $this->settings->get('framio-general.logo_seasonal_hat');
        $darkModeLogo = trim((string) $this->settings->get('framio-general.logo_dark_mode_url'));

        $css = [];

        // Masaüstü logo yüksekliği ve Header dengeleme
        if ($desktopHeight > 0) {
            $css[] = "@media (min-width: 768px) {";
            $css[] = "  .Header-logo { max-height: {$desktopHeight}px !important; height: {$desktopHeight}px !important; width: auto !important; object-fit: contain; }";
            $minHeaderHeight = max(52, $desktopHeight + 16);
            $css[] = "  .App-header { min-height: {$minHeaderHeight}px; }";
            $css[] = "}";
        }

        // Mobil logo yüksekliği
        if ($mobileHeight > 0) {
            $css[] = "@media (max-width: 767px) {";
            $css[] = "  .Header-logo { max-height: {$mobileHeight}px !important; height: {$mobileHeight}px !important; width: auto !important; object-fit: contain; }";
            $minMobileHeader = max(46, $mobileHeight + 12);
            $css[] = "  .App-header { min-height: {$minMobileHeader}px; }";
            $css[] = "}";
        }

        // Hizalama
        if ($alignment === 'center') {
            $css[] = "@media (min-width: 768px) {";
            $css[] = "  .Header-title { display: flex; justify-content: center; align-items: center; width: 100%; text-align: center; }";
            $css[] = "}";
        }

        // Karanlık Mod (Dark Mode) için alternatif logo desteği
        if (!empty($darkModeLogo)) {
            $safeUrl = htmlspecialchars($darkModeLogo, ENT_QUOTES, 'UTF-8');
            $css[] = "body.theme-dark .Header-logo, [data-theme='dark'] .Header-logo, html.dark .Header-logo { content: url('{$safeUrl}') !important; }";
        }

        // Mevsimsel Süsleme (Yılbaşı Noel Şapkası efekti)
        if ($seasonalHat) {
            $css[] = ".Header-title { position: relative; }";
            $css[] = ".Header-title a { position: relative; display: inline-block; }";
            $css[] = ".Header-title a::before {";
            $css[] = "  content: '🎅';";
            $css[] = "  position: absolute;";
            $css[] = "  top: -12px;";
            $css[] = "  left: -8px;";
            $css[] = "  font-size: 22px;";
            $css[] = "  transform: rotate(-15deg);";
            $css[] = "  z-index: 10;";
            $css[] = "  pointer-events: none;";
            $css[] = "}";
        }

        if (!empty($css)) {
            $document->head[] = '<style id="framio-logo-manager">' . implode("\n", $css) . '</style>';
        }
    }
}
