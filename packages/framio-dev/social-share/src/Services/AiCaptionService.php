<?php

namespace Framio\SocialShare\Services;

use GuzzleHttp\Client;
use Psr\Log\LoggerInterface;
use Flarum\Settings\SettingsRepositoryInterface;

class AiCaptionService
{
    protected Client $client;
    protected LoggerInterface $logger;
    protected SettingsRepositoryInterface $settings;

    public function __construct(LoggerInterface $logger, SettingsRepositoryInterface $settings)
    {
        $this->client = new Client(['timeout' => 25]);
        $this->logger = $logger;
        $this->settings = $settings;
    }

    public function generate(array $params): array
    {
        $sirket = $params['sirket'] ?? '';
        $plaka = $params['plaka'] ?? '';
        $model = $params['model'] ?? '';
        $rawSehir = $params['sehir'] ?? '';
        $yazar = $params['yazar'] ?? '';
        $yil = $params['yil'] ?? date('y');
        $length = $params['length'] ?? 'medium'; // short, medium, long, web
        $trivia = $params['trivia'] ?? '';
        $customPrompt = $params['custom_prompt'] ?? '';

        // Şehir ve Yıl ayrıştırma: "Antalya / '26" -> Temiz Şehir: "Antalya", Temiz Yıl: "'26"
        $parsed = $this->parseCityAndYear($rawSehir, $yil);
        $cleanCity = $parsed['city'];
        $cleanYear = $parsed['year'];

        // 1. Görsel & Canlı Web Araştırması (Vision + Multi-hop Deep Transit Search)
        $images = $params['images'] ?? [];
        $webContext = '';
        if ($length === 'web' || $length === 'research' || !empty($plaka) || !empty($images)) {
            $webContext = $this->performDeepTransitInvestigation($sirket, $plaka, $model, $cleanCity, $images);
        }

        // 2. Sistem ve Kullanıcı Promptlarını Hazırla
        $prompts = $this->buildPrompts($sirket, $plaka, $model, $cleanCity, $yazar, $cleanYear, $length, $trivia, $customPrompt, $webContext);
        $systemPrompt = $prompts['system'];
        $userPrompt = $prompts['user'];

        // 3. Çoklu API Sağlayıcıları Havuzu (Sırayla dener, kota hatası alırsa bir sonrakine geçer)
        $geminiKeysRaw = $this->settings->get('framio-social-share.gemini_api_key', '');
        $groqApiKey = trim($this->settings->get('framio-social-share.groq_api_key', ''));
        $openRouterKey = trim($this->settings->get('framio-social-share.openrouter_api_key', ''));

        // Gemini API anahtarlarını ayıkla (virgülle veya yeni satırla ayrılmış olabilir)
        $geminiKeys = array_filter(array_map('trim', preg_split('/[\r\n,]+/', $geminiKeysRaw)));

        $errors = [];

        // 3.1. Gemini Anahtarlarını Sırayla Dene
        foreach ($geminiKeys as $key) {
            if (empty($key)) continue;
            try {
                $res = $this->callGemini($key, $systemPrompt, $userPrompt, $length === 'web');
                if ($res['success']) {
                    return $res;
                }
                $errors[] = "Gemini (" . substr($key, 0, 8) . "...): " . ($res['error'] ?? 'Başarısız');
            } catch (\Exception $e) {
                $this->logger->warning('[Gemini Key Failed] ' . $e->getMessage());
                $errors[] = "Gemini: " . $e->getMessage();
            }
        }

        // 3.2. Groq API (Llama 3.3 70B / DeepSeek R1) Dene
        if (!empty($groqApiKey)) {
            try {
                $res = $this->callGroq($groqApiKey, $systemPrompt, $userPrompt);
                if ($res['success']) {
                    return $res;
                }
                $errors[] = "Groq: " . ($res['error'] ?? 'Başarısız');
            } catch (\Exception $e) {
                $this->logger->warning('[Groq API Failed] ' . $e->getMessage());
                $errors[] = "Groq: " . $e->getMessage();
            }
        }

        // 3.3. OpenRouter API Dene
        if (!empty($openRouterKey)) {
            try {
                $res = $this->callOpenRouter($openRouterKey, $systemPrompt, $userPrompt);
                if ($res['success']) {
                    return $res;
                }
                $errors[] = "OpenRouter: " . ($res['error'] ?? 'Başarısız');
            } catch (\Exception $e) {
                $this->logger->warning('[OpenRouter API Failed] ' . $e->getMessage());
                $errors[] = "OpenRouter: " . $e->getMessage();
            }
        }

        // Eğer hiçbir API key girilmemişse veya tümü başarısız olduysa kural bazlı kurumsal şablon
        if (empty($geminiKeys) && empty($groqApiKey) && empty($openRouterKey)) {
            return $this->generateRuleBasedCaption($sirket, $plaka, $model, $cleanCity, $yazar, $cleanYear, $length, $trivia);
        }

        // Hata durumunu net aktar
        return [
            'success' => false,
            'error' => 'Yapay zeka servislerine erişilemedi. Detaylar: ' . implode(' | ', array_slice($errors, 0, 3)),
            'caption' => ''
        ];
    }

    /**
     * Görsel Analizi (Vision) ve Çok Aşamalı Çapraz Sektörel Araştırma Yapar
     */
    protected function performDeepTransitInvestigation(string $sirket, string $plaka, string $model, string $city, array $images = []): string
    {
        $visionInsights = '';
        $cleanPlaka = preg_replace('/\s+/', ' ', trim($plaka));

        // 1. Varsa İlk Görseli Gemini Vision ile Analiz Et (Renk, Kasa, Özel Seri / Filo İpuçları)
        if (!empty($images)) {
            $firstImage = reset($images);
            $visionInsights = $this->analyzeImageWithVision($firstImage);
        }

        // 2. Çapraz Arama Sorguları Matrisi Oluştur
        $queries = [];
        if (!empty($cleanPlaka)) {
            $queries[] = "\"{$cleanPlaka}\" otobüs filo geçmişi teslimat";
            $queries[] = "\"{$cleanPlaka}\" instagram " . Brand::get()['handle'] . " busarchive";
            if (!empty($sirket)) {
                $queries[] = "\"{$cleanPlaka}\" \"{$sirket}\" {$model}";
            }
        }

        if (!empty($sirket) && !empty($model)) {
            $queries[] = "\"{$sirket}\" \"{$model}\" teslimat satıldı devir filo yatırımı";
            $queries[] = "\"{$sirket}\" \"{$model}\" site:" . Brand::get()['site'] . " OR site:ulasimplatformu.com OR site:magazinulasim.com";
        }

        // Vision'dan özel renk veya detay çıktıysa (örn: şampanya, siyah, özel kaplama) sorgulara ekle
        if (!empty($visionInsights)) {
            if (!empty($sirket) && !empty($model)) {
                $queries[] = "\"{$sirket}\" {$visionInsights} {$model}";
            }
            if (!empty($model)) {
                $queries[] = "{$visionInsights} {$model} filo teslimat satıldı";
            }
        }

        // 3. Tavily AI Search (Varsa) veya Web Scraper ile Arama Yap
        $allSnippets = [];
        $tavilyKey = trim($this->settings->get('framio-social-share.tavily_api_key', ''));

        if (!empty($tavilyKey)) {
            foreach (array_slice($queries, 0, 4) as $tq) {
                $res = $this->searchTavily($tavilyKey, $tq);
                if (!empty($res)) {
                    $allSnippets[] = $res;
                }
            }
        }

        // Tavily yetersizse veya boşsa DuckDuckGo Scraper ile tamamla
        if (count($allSnippets) < 2) {
            foreach (array_slice($queries, 0, 4) as $q) {
                $scraped = $this->scrapeDuckDuckGo($q);
                if (!empty($scraped)) {
                    $allSnippets = array_merge($allSnippets, $scraped);
                }
                if (count($allSnippets) >= 6) break;
            }
        }

        $contextParts = [];
        if (!empty($visionInsights)) {
            $contextParts[] = "[Görsel Analiz Bulgusu]: " . $visionInsights;
        }
        if (!empty($allSnippets)) {
            $unique = array_unique($allSnippets);
            $contextParts[] = "[İnternet Arşiv & Filo Kayıtları]:\n- " . implode("\n- ", array_slice($unique, 0, 8));
        }

        return implode("\n\n", $contextParts);
    }

    /**
     * Gemini Vision kullanarak otobüs görselindeki renk, kaplama ve filo özelliklerini çözer
     */
    protected function analyzeImageWithVision(string $imageUrl): string
    {
        $geminiKeysRaw = $this->settings->get('framio-social-share.gemini_api_key', '');
        $geminiKeys = array_filter(array_map('trim', preg_split('/[\r\n,]+/', $geminiKeysRaw)));
        if (empty($geminiKeys)) return '';

        // Görsel yerel dosya yolu veya web URL'si olabilir
        $base64Image = '';
        $mimeType = 'image/jpeg';

        try {
            if (str_starts_with($imageUrl, 'http://') || str_starts_with($imageUrl, 'https://')) {
                $res = $this->client->get($imageUrl, ['timeout' => 8]);
                $base64Image = base64_encode($res->getBody()->getContents());
            } else {
                // Yerel dosya
                $localPath = public_path($imageUrl);
                if (file_exists($localPath)) {
                    $base64Image = base64_encode(file_get_contents($localPath));
                }
            }
        } catch (\Exception $e) {
            return '';
        }

        if (empty($base64Image)) return '';

        $visionPrompt = "Sen bir otobüs ve ticari araç spotter uzmanısın. Bu fotoğraftaki otobüsü dikkatle incele. Şu 3 bilgiyi 10-15 kelimede Türkçe olarak ver:\n1. Aracın tam gövde rengi (örn: Metalik Şampanya, Metalik Siyah, Mat Füme, Beyaz)\n2. Aracın modeli ve kasa tipi\n3. Varsa dikkat çeken özel kaplama, şerit, logo veya jant detayı.\nSadece bu bilgileri yaz.";

        foreach ($geminiKeys as $key) {
            try {
                $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" . urlencode($key);
                $payload = [
                    'contents' => [
                        [
                            'role' => 'user',
                            'parts' => [
                                ['text' => $visionPrompt],
                                [
                                    'inline_data' => [
                                        'mime_type' => $mimeType,
                                        'data' => $base64Image
                                    ]
                                ]
                            ]
                        ]
                    ],
                    'generationConfig' => ['temperature' => 0.2, 'maxOutputTokens' => 150]
                ];

                $response = $this->client->post($url, [
                    'json' => $payload,
                    'headers' => ['Content-Type' => 'application/json'],
                    'timeout' => 10
                ]);

                $data = json_decode($response->getBody()->getContents(), true);
                $resultText = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                if (!empty($resultText)) {
                    return trim($resultText);
                }
            } catch (\Exception $e) {
                // Sıradaki anahtarı dene
            }
        }

        return '';
    }

    /**
     * DuckDuckGo üzerinden arama snippet'larını toplar
     */
    protected function scrapeDuckDuckGo(string $query): array
    {
        $snippets = [];
        try {
            $response = $this->client->get('https://html.duckduckgo.com/html/', [
                'query' => ['q' => $query],
                'headers' => [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                ],
                'timeout' => 8
            ]);
            $html = $response->getBody()->getContents();
            if (preg_match_all('/<a class="result__snippet[^>]*>(.*?)<\/a>/is', $html, $matches)) {
                foreach ($matches[1] as $rawSnippet) {
                    $clean = strip_tags(html_entity_decode($rawSnippet, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                    $clean = trim(preg_replace('/\s+/', ' ', $clean));
                    if (strlen($clean) > 25) {
                        $snippets[] = $clean;
                    }
                }
            }
        } catch (\Exception $e) {}

        return $snippets;
    }

    /**
     * Tavily AI Search API üzerinden derin transit araması
     */
    protected function searchTavily(string $apiKey, string $query): string
    {
        try {
            $res = $this->client->post('https://api.tavily.com/search', [
                'json' => [
                    'api_key' => $apiKey,
                    'query' => $query,
                    'search_depth' => 'advanced',
                    'include_answer' => true,
                    'max_results' => 5
                ],
                'headers' => ['Content-Type' => 'application/json'],
                'timeout' => 12
            ]);
            $data = json_decode($res->getBody()->getContents(), true);
            $snippets = [];
            if (!empty($data['answer'])) {
                $snippets[] = $data['answer'];
            }
            if (!empty($data['results'])) {
                foreach ($data['results'] as $r) {
                    if (!empty($r['content'])) {
                        $snippets[] = $r['content'];
                    }
                }
            }
            return implode("\n- ", array_slice($snippets, 0, 4));
        } catch (\Exception $e) {
            $this->logger->warning('[Tavily Search Failed] ' . $e->getMessage());
            return '';
        }
    }

    /**
     * Prompt şablonlarını oluşturur.
     */
    protected function buildPrompts(
        string $sirket,
        string $plaka,
        string $model,
        string $cleanCity,
        string $yazar,
        string $cleanYear,
        string $length,
        string $trivia,
        string $customPrompt,
        string $webContext = ''
    ): array {
        $systemPrompt = "Sen Türkiye'nin en seçkin otobüs spotter ve arşiv topluluklarının (@" . Brand::get()['handle'] . ", @ulasiminfo, @spottersturkey, @spottersturkeycom, @busarchivetr, @busspotter_tr, @guncelulasim, @tr_truckspotter, @_tr.busarchive, @tr.busarchive, @tr.vehiclespotter) üslubuyla profesyonel gönderi metni yazan kıdemli bir arşiv editörüsün.\n\n"
            . "ARAŞTIRMA VE BİLGİ DOĞRULUĞU KURALLARI (ÇOK KRİTİK):\n"
            . "1. KESİNLİKLE BİLGİ UYDURMA (HALLUCINATION YASAKTIR): Yalnızca verilen bilgilerde veya 'İnternet ve Filo/Sektör/Hat Bilgileri' bölümünde geçen GERÇEK doğrulanmış bilgileri kullan.\n"
            . "2. Eğer bir aracın geçmişi (örneğin İtalya sipariş iptali veya önceki firma geçişleri) internet araştırmasında ÇIKMAMIŞSA, ASLA böyle bir geçmiş uydurma!\n"
            . "3. Geçmiş bilgisi yoksa, firmanın genel sefer bölgesine (örneğin Ege/Akdeniz/Marmara/Ankara hatları), model yılına ve sahadaki çekim anına odaklan.\n\n"
            . "YAZIM MANTIĞI VE CÜMLE KURGUSU:\n"
            . "Tek veya en fazla iki akıcı, bilgi dolu ve dinamik bir spotter cümlesi kuracaksın. Cümlenin içinde mutlaka şu unsurlar organik ve akıcı şekilde birleşecek:\n"
            . "1. FİRMA / HAT / MODEL BİLGİSİ (Örn: 'Ege ve İç Anadolu hatlarındaki seferleriyle tanınan Anadolu Ulaşım filosuna ait 64 AN 439 plakalı Mercedes-Benz Tourismo 16 RHD,')\n"
            . "2. SAHADAKİ CANLI ARŞİV HAREKETİ / PERON / ÇEKİM ANI (Örn: '...seferi öncesinde objektiflerimize yansıyor.' veya '...peronda görüntülendi.')\n\n"
            . "KESİNLİKLE UYULACAK DİĞER KURALLAR:\n"
            . "1. Reklam/broşür övgüleri (2+1 konfor, modern hizmet, güvenli seyahat vb.) KESİNLİKLE YASAKTIR.\n"
            . "2. 'Fotoğrafı ... çekti' gibi ibareler metin içine YAZILMAZ (zaten alttaki 📸 künyesinde vardır).\n"
            . "3. 'Firmamız / filomuz' gibi 1. şahıs dili değil, 3. şahıs bağımsız spotter dili kullanılır.\n"
            . "4. Basın ve arşiv dili: Tarafsız, belgesel niteliğinde, sektörel ve teknik.\n\n"
            . "ÇIKTI FORMATI TAM OLARAK ŞU ŞABLONDA OLMALIDIR (Boşluklara ve emojilere harfiyen uy):\n\n"
            . "{Şirket} & {Model}\n\n"
            . "{Yukarıdaki mantıkla oluşturduğun tek parçalı, zengin spotter haber cümlesi}\n\n"
            . "{Eğer Trivia bilgisi verilmişse aynen buraya koy, yoksa bu satırı atla}\n\n"
            . Brand::get()['more_info'] . "\n\n"
            . "> {Şirket} | {Plaka}\n"
            . "> {Model}\n"
            . "📌 " . ($cleanCity ?: 'Bilinmiyor') . " / {$cleanYear}\n\n"
            . "📸: {$yazar}\n\n"
            . "{Hashtagler}";

        $userPrompt = "Araç ve Fotoğraf Bilgileri:\n"
            . "- Şirket/Firma: " . ($sirket ?: 'Bilinmiyor') . "\n"
            . "- Plaka: " . ($plaka ?: 'Belirtilmemiş') . "\n"
            . "- Araç Modeli: " . ($model ?: 'Belirtilmemiş') . "\n"
            . "- Çekildiği Şehir/Konum: " . ($cleanCity ?: 'Belirtilmemiş') . "\n"
            . "- Yıl: " . $cleanYear . "\n";

        if (!empty($webContext)) {
            $userPrompt .= "- İnternet ve Filo/Sektör/Hat Bilgileri:\n" . $webContext . "\n";
        }
        if (!empty($trivia)) {
            $userPrompt .= "- T R I V I A:\n" . $trivia . "\n";
        }
        if (!empty($customPrompt)) {
            $userPrompt .= "- Kullanıcı Özel Notu: " . $customPrompt . "\n";
        }

        return ['system' => $systemPrompt, 'user' => $userPrompt];
    }

    /**
     * Google Gemini API Çağrısı (Google Search Grounding Destekli)
     */
    protected function callGemini(string $apiKey, string $systemPrompt, string $userPrompt, bool $enableSearch): array
    {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" . urlencode($apiKey);

        $payload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $systemPrompt . "\n\n" . $userPrompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.4,
                'maxOutputTokens' => 1000,
            ]
        ];

        if ($enableSearch) {
            $payload['tools'] = [['google_search' => new \stdClass()]];
        }

        $response = $this->client->post($url, [
            'json' => $payload,
            'headers' => ['Content-Type' => 'application/json']
        ]);

        $data = json_decode($response->getBody()->getContents(), true);
        $caption = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

        if (empty($caption)) {
            return ['success' => false, 'error' => 'Gemini boş yanıt döndürdü'];
        }

        return ['success' => true, 'caption' => trim($caption), 'source' => 'gemini'];
    }

    /**
     * Groq API Çağrısı (GPT-OSS-120B / Qwen 3.8 - Ücretsiz & Çok Yüksek Limit)
     */
    protected function callGroq(string $apiKey, string $systemPrompt, string $userPrompt): array
    {
        $url = "https://api.groq.com/openai/v1/chat/completions";
        $models = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'groq/compound', 'openai/gpt-oss-20b'];

        foreach ($models as $model) {
            try {
                $payload = [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt]
                    ],
                    'temperature' => 0.4,
                    'max_tokens' => 1000
                ];

                $response = $this->client->post($url, [
                    'json' => $payload,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Content-Type' => 'application/json'
                    ]
                ]);

                $data = json_decode($response->getBody()->getContents(), true);
                $caption = $data['choices'][0]['message']['content'] ?? '';

                // Eğer <think> tagleri içeriyorsa temizle
                $caption = preg_replace('/<think>.*?<\/think>/is', '', $caption);
                $caption = trim($caption);

                if (!empty($caption)) {
                    return ['success' => true, 'caption' => $caption, 'source' => 'groq'];
                }
            } catch (\Exception $e) {
                // Sıradaki modeli dene
            }
        }

        return ['success' => false, 'error' => 'Groq modellerinden yanıt alınamadı'];
    }

    /**
     * OpenRouter API Çağrısı
     */
    protected function callOpenRouter(string $apiKey, string $systemPrompt, string $userPrompt): array
    {
        $url = "https://openrouter.ai/api/v1/chat/completions";

        $payload = [
            'model' => 'meta-llama/llama-3.3-70b-instruct:free',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt]
            ],
            'temperature' => 0.4,
            'max_tokens' => 1000
        ];

        $response = $this->client->post($url, [
            'json' => $payload,
            'headers' => [
                'Authorization' => 'Bearer ' . $apiKey,
                'HTTP-Referer' => Brand::get()['url'],
                'X-Title' => Brand::get()['hashtag'] . ' Social Share',
                'Content-Type' => 'application/json'
            ]
        ]);

        $data = json_decode($response->getBody()->getContents(), true);
        $caption = $data['choices'][0]['message']['content'] ?? '';

        if (empty($caption)) {
            return ['success' => false, 'error' => 'OpenRouter boş yanıt döndürdü'];
        }

        return ['success' => true, 'caption' => trim($caption), 'source' => 'openrouter'];
    }

    /**
     * Şehir ve Yıl bilgisini ayrıştırıp temizler.
     */
    protected function parseCityAndYear(string $rawSehir, string $defaultYear): array
    {
        $cleanCity = trim($rawSehir);
        $cleanYear = trim($defaultYear);

        if (str_contains($cleanCity, '/')) {
            $parts = explode('/', $cleanCity);
            $cleanCity = trim($parts[0]);
            $yearPart = trim(end($parts));
            if (!empty($yearPart)) {
                $cleanYear = $yearPart;
            }
        }

        // Yılın başına tek tırnak ekleme ('26 gibi)
        if (preg_match('/^(\d{2})$/', $cleanYear, $m)) {
            $cleanYear = "'" . $m[1];
        } elseif (preg_match('/^\d{4}$/', $cleanYear)) {
            $cleanYear = "'" . substr($cleanYear, -2);
        }

        return [
            'city' => $cleanCity,
            'year' => $cleanYear
        ];
    }

    protected function generateRuleBasedCaption(
        string $sirket,
        string $plaka,
        string $model,
        string $cleanCity,
        string $yazar,
        string $cleanYear,
        string $length,
        string $trivia
    ): array {
        $tagSirket = preg_replace('/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/u', '', $sirket);
        $tagPlaka = preg_replace('/[^a-zA-Z0-9]/', '', $plaka);
        
        $tagModel = '';
        if (!empty($model)) {
            $tagModel = preg_replace('/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/u', '', $model);
        }

        // Hashtag listesi
        $tags = [];
        if ($tagSirket) $tags[] = "#{$tagSirket}";
        if ($tagPlaka) $tags[] = "#{$tagPlaka}";
        if (!empty($model)) {
            if (preg_match('/(Mercedes-Benz|MAN|Scania|Volvo|Ford|Neoplan|Setra|TEMSA|DAF|Otokar|Isuzu|Iveco)/i', $model, $bm)) {
                $brandClean = preg_replace('/[^a-zA-Z0-9]/', '', $bm[0]);
                $tags[] = "#{$brandClean}";
            }
        }
        if ($tagModel && !in_array("#{$tagModel}", $tags, true)) {
            $tags[] = "#{$tagModel}";
        }
        $tags[] = '#' . Brand::get()['hashtag'];
        $tagString = implode(' ', array_unique($tags));

        // Şehir ekini düzgün Türkçe ses uyumuna göre oluştur
        $konumEki = 'yollarda';
        if (!empty($cleanCity)) {
            $lastLetter = mb_strtolower(mb_substr($cleanCity, -1));
            // Son sesli harfe bak
            preg_match_all('/[aıoueiöü]/iu', $cleanCity, $matches);
            $lastVowel = !empty($matches[0]) ? mb_strtolower(end($matches[0])) : 'a';
            $suffix = in_array($lastVowel, ['a', 'ı', 'o', 'u']) ? "'da" : "'de";
            if (in_array($lastLetter, ['f', 's', 't', 'k', 'ç', 'ş', 'h', 'p'])) {
                $suffix = in_array($lastVowel, ['a', 'ı', 'o', 'u']) ? "'ta" : "'te";
            }
            $konumEki = "{$cleanCity}{$suffix}";
        }

        if ($length === 'short') {
            $aiText = "{$sirket} filosuna ait {$model}, {$konumEki} objektiflerimize yansıyor.";
        } elseif ($length === 'long' || $length === 'web') {
            $aiText = "{$sirket} filosunda hizmet veren {$model}, {$konumEki} gerçekleştirilen çekimle arşivimizdeki yerini alıyor.\n\nSektörün dinamiklerini ve karayolu yolcu taşımacılığının seçkin araçlarını belgelemeye devam ediyoruz.";
        } else {
            $aiText = "{$sirket} filosuna ait {$model}, {$konumEki} objektiflerimize yansıyor.";
        }

        $header = "{$sirket}" . ($model ? " & {$model}" : "");
        $moreInfo = Brand::get()['more_info'];
        
        $kunye = "> " . $sirket . ($plaka ? " | {$plaka}" : "") . "\n"
               . ($model ? "> {$model}\n" : "")
               . "📌 " . ($cleanCity ?: 'Bilinmiyor') . " / {$cleanYear}\n\n"
               . "📸: " . ($yazar ?: Brand::get()['name']) . "\n\n"
               . $tagString;

        $parts = [$header, $aiText];
        if (!empty($trivia)) {
            $parts[] = trim($trivia);
        }
        $parts[] = $moreInfo;
        $parts[] = $kunye;

        $finalCaption = implode("\n\n", $parts);

        return [
            'success' => true,
            'caption' => trim($finalCaption),
            'source' => 'rule_based'
        ];
    }
}
