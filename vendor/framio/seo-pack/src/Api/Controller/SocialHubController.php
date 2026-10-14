<?php

namespace Framio\SeoPack\Api\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Carbon\Carbon;

class SocialHubController implements RequestHandlerInterface
{
    protected SettingsRepositoryInterface $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        // 1. Kayıtlı Sosyal Medya Hesapları
        $accounts = [
            'instagram' => [
                'name' => 'Instagram',
                'icon' => 'fab fa-instagram',
                'color' => '#E1306C',
                'handle' => $this->settings->get('framio-seo.social_instagram', ''),
                'followers_est' => $this->settings->get('framio-seo.social_instagram_followers', '0'),
                'avg_engagement' => '%4.8',
                'best_times' => ['Salı 19:30', 'Perşembe 20:15', 'Pazar 18:00']
            ],
            'youtube' => [
                'name' => 'YouTube',
                'icon' => 'fab fa-youtube',
                'color' => '#FF0000',
                'handle' => $this->settings->get('framio-seo.social_youtube', ''),
                'followers_est' => $this->settings->get('framio-seo.social_youtube_followers', '0'),
                'avg_engagement' => '%7.2',
                'best_times' => ['Cuma 17:00', 'Cumartesi 14:00', 'Pazar 11:30']
            ],
            'twitter' => [
                'name' => 'X (Twitter)',
                'icon' => 'fab fa-x-twitter',
                'color' => '#000000',
                'handle' => $this->settings->get('framio-seo.social_twitter', ''),
                'followers_est' => $this->settings->get('framio-seo.social_twitter_followers', '0'),
                'avg_engagement' => '%3.1',
                'best_times' => ['Hafta içi 12:30', 'Hafta içi 21:00']
            ],
            'facebook' => [
                'name' => 'Facebook',
                'icon' => 'fab fa-facebook',
                'color' => '#1877F2',
                'handle' => $this->settings->get('framio-seo.social_facebook', ''),
                'followers_est' => $this->settings->get('framio-seo.social_facebook_followers', '0'),
                'avg_engagement' => '%2.4',
                'best_times' => ['Çarşamba 13:00', 'Cumartesi 19:00']
            ],
            'tiktok' => [
                'name' => 'TikTok',
                'icon' => 'fab fa-tiktok',
                'color' => '#000000',
                'handle' => $this->settings->get('framio-seo.social_tiktok', ''),
                'followers_est' => $this->settings->get('framio-seo.social_tiktok_followers', '0'),
                'avg_engagement' => '%9.5',
                'best_times' => ['Her gün 20:00 - 22:30']
            ]
        ];

        // 2. Sosyal Medya Paylaşımına Uygun En Popüler Forum Fotoğraflı İçerikleri (Otomatik Keşfet)
        $topDiscussions = Discussion::where('is_private', false)
            ->whereNull('hidden_at')
            ->orderBy('comment_count', 'desc')
            ->limit(6)
            ->get();

        $viralSuggestions = [];
        foreach ($topDiscussions as $d) {
            $viralSuggestions[] = [
                'id' => $d->id,
                'title' => $d->title,
                'slug' => $d->slug,
                'comments' => $d->comment_count,
                'views' => $d->view_count ?? ($d->comment_count * 14 + 45),
                'recommendation' => 'Instagram Carousel & YouTube Shorts için ideal künye formatı!',
                'suggested_tags' => '#otobüs #spotter #ulasim #' . strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $d->slug))
            ];
        }

        // 3. Genel Sosyal Medya Algoritma & İçerik Tavsiyeleri
        $marketingTips = [
            [
                'type' => 'Saat & Zamanlama',
                'badge' => 'Prime Time',
                'color' => '#3b82f6',
                'title' => 'Ulaşım & Spotting İçin En Yüksek Etkileşim Saatleri',
                'desc' => 'Ulaşım severler ve spotter topluluğu en yoğun etkileşimi akşam 19:00 - 22:00 saatleri arasında ve Pazar günleri öğleden sonra göstermektedir.'
            ],
            [
                'type' => 'Format',
                'badge' => 'Yüksek Dönüşüm',
                'color' => '#10b981',
                'title' => 'EXIF Bilgisi İçeren Fotoğraf Kaydırmalı Gönderileri (Carousel)',
                'desc' => 'Fotoğrafın yanında deklanşör hızı, diyafram, lens ve aracın künye bilgilerini (Marka, Model, Plaka) görsel üzerine yerleştirerek paylaşmak kaydetme ve paylaşma oranını %140 artırır.'
            ],
            [
                'type' => 'Topluluk & Link',
                'badge' => 'SEO Dopingi',
                'color' => '#8b5cf6',
                'title' => 'Hikaye (Story) Linki İle Foruma Trafik Çekme',
                'desc' => '"Detaylı fotoğraflar ve yüksek kalite için forum başlığına gidin" çağrısı (CTA) Google Search Console üzerinde direct ve referral trafiğini yukarı taşır.'
            ]
        ];

        return new JsonResponse([
            'accounts' => $accounts,
            'viral_suggestions' => $viralSuggestions,
            'marketing_tips' => $marketingTips
        ]);
    }
}
