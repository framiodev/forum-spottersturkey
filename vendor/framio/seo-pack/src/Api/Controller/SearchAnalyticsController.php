<?php

namespace Framio\SeoPack\Api\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\SeoPack\Database\SeoSearch;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Illuminate\Support\Arr;
use Carbon\Carbon;

class SearchAnalyticsController implements RequestHandlerInterface
{
    protected SettingsRepositoryInterface $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $method = $request->getMethod();

        // 1. Forum İçi Arama Kaydetme (Kullanıcı arama yaptığında frontend/API tetikler)
        if ($method === 'POST') {
            $body = $request->getParsedBody();
            $queryStr = trim(Arr::get($body, 'query', ''));
            $resultsCount = (int)Arr::get($body, 'results_count', 0);
            $actor = RequestUtil::getActor($request);

            if (mb_strlen($queryStr) >= 2) {
                $search = SeoSearch::where('query', $queryStr)->first();
                if ($search) {
                    $search->count += 1;
                    $search->results_count = $resultsCount;
                    $search->last_searched_at = Carbon::now();
                    $search->save();
                } else {
                    SeoSearch::create([
                        'query' => $queryStr,
                        'source' => 'forum',
                        'count' => 1,
                        'results_count' => $resultsCount,
                        'user_id' => $actor->guest ? null : $actor->id,
                        'last_searched_at' => Carbon::now()
                    ]);
                }
            }

            return new JsonResponse(['success' => true]);
        }

        // 2. GET: Admin Panel Analitik Verilerini Getir
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        // A. Forum İçi En Çok Arananlar
        $topForumSearches = SeoSearch::where('source', 'forum')
            ->orderBy('count', 'desc')
            ->limit(15)
            ->get();

        // B. Forum Başlık ve İçeriklerinden Otomatik Çıkarılan Niş Terimler & Trendler
        // Son konuların başlıkları ve künye verilerinden en popüler kavramları çıkaralım
        $recentDiscussions = Discussion::where('is_private', false)
            ->whereNull('hidden_at')
            ->orderBy('id', 'desc')
            ->limit(50)
            ->get(['id', 'title', 'comment_count', 'participant_count']);

        // Kelime frekansı analizi
        $stopWords = ['ve', 'veya', 'ile', 'için', 'bir', 'bu', 'şu', 'o', 'de', 'da', 'mi', 'mı', 'mu', 'mü', 'ne', 'nasıl', 'neden', 'kim', 'forum', 'konusu', 'hakkında', 'merhaba', 'güncel', 'fotoğrafları', 'resimleri'];
        $wordCounts = [];

        foreach ($recentDiscussions as $d) {
            $cleanTitle = preg_replace('/[^\p{L}\p{N}\s]/u', '', mb_strtolower($d->title));
            $words = array_filter(explode(' ', $cleanTitle));
            foreach ($words as $w) {
                $w = trim($w);
                if (mb_strlen($w) > 2 && !in_array($w, $stopWords)) {
                    $wordCounts[$w] = ($wordCounts[$w] ?? 0) + 1;
                }
            }
        }
        arsort($wordCounts);

        $nicheKeywords = [];
        $i = 0;
        foreach ($wordCounts as $w => $c) {
            if ($i++ >= 12) break;
            $nicheKeywords[] = [
                'term' => mb_convert_case($w, MB_CASE_TITLE, "UTF-8"),
                'frequency' => $c,
                'relevance' => 'Yüksek Potansiyel'
            ];
        }

        // C. İçerik boşlukları: forumda sık aranan ama başlıklarda karşılığı
        // az olan terimler. Tamamen bu sitenin kendi verisinden hesaplanır.
        $suggestedNicheIdeas = [];
        foreach (SeoSearch::where('source', 'forum')->orderBy('count', 'desc')->limit(50)->get() as $search) {
            $term = trim($search->query);
            if (mb_strlen($term) < 3) {
                continue;
            }

            $matches = Discussion::where('is_private', false)
                ->whereNull('hidden_at')
                ->where('title', 'like', '%' . addcslashes($term, '%_\\') . '%')
                ->count();

            if ($matches <= 2) {
                $suggestedNicheIdeas[] = [
                    'topic' => mb_convert_case($term, MB_CASE_TITLE, 'UTF-8'),
                    'intent' => 'Forum içi arama',
                    'volume' => $search->count . ' arama',
                    'competition' => $matches === 0 ? 'Konu yok' : $matches . ' konu',
                ];
            }

            if (count($suggestedNicheIdeas) >= 10) {
                break;
            }
        }

        return new JsonResponse([
            'forum_searches' => $topForumSearches,
            'niche_keywords' => $nicheKeywords,
            'suggested_ideas' => $suggestedNicheIdeas,
            'total_searches_recorded' => SeoSearch::sum('count')
        ]);
    }
}
