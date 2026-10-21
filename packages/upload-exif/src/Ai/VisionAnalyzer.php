<?php

namespace Framio\UploadExif\Ai;

use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use GuzzleHttp\Client;
use GuzzleHttp\Promise\PromiseInterface;
use GuzzleHttp\Promise\Utils;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Vision AI künye analizi.
 *
 * Hız için:
 *  - görsel en fazla 768 px'e küçültülür (tarayıcı zaten küçültüp gönderir; sunucu emniyet için tekrar bakar),
 *  - tanımlı sağlayıcıların hepsine AYNI ANDA istek atılır, ilk geçerli yanıt kazanır (yarış),
 *  - aynı görsel için sonuç önbellekten döner.
 *
 * Sağlayıcı sırası: kullanıcının kendi anahtarı (izin verilmişse) → sitenin sağlayıcı listesi.
 */
class VisionAnalyzer
{
    // Ekim 2026 itibarıyla her sağlayıcının hızlı ve güncel görsel modeli
    public const PROVIDERS = [
        'gemini' => ['name' => 'Google Gemini', 'model' => 'gemini-3.5-flash-lite'],
        'groq' => ['name' => 'Groq', 'model' => 'qwen/qwen3.8-27b'],
        'nvidia' => ['name' => 'NVIDIA NIM', 'model' => 'google/gemma-4-31b-it'],
        'openrouter' => ['name' => 'OpenRouter', 'model' => 'google/gemma-4-31b-it:free'],
        'openai' => ['name' => 'OpenAI ChatGPT', 'model' => 'gpt-6-luna'],
        'claude' => ['name' => 'Anthropic Claude', 'model' => 'claude-haiku-5-5'],
        'grok' => ['name' => 'xAI Grok', 'model' => 'grok-4.7'],
    ];

    // OpenAI uyumlu uç noktalar
    protected const CHAT_URLS = [
        'openai' => 'https://api.openai.com/v1/chat/completions',
        'groq' => 'https://api.groq.com/openai/v1/chat/completions',
        'grok' => 'https://api.x.ai/v1/chat/completions',
        'nvidia' => 'https://integrate.api.nvidia.com/v1/chat/completions',
        'openrouter' => 'https://openrouter.ai/api/v1/chat/completions',
    ];

    // Kaldırılmış, yeni hesaplara kapalı ya da yanlış yazılmış (eski sürümlerin kaydettiği) model adları:
    // bunlar kayıtlıysa sağlayıcının güncel varsayılanı kullanılır
    protected const INVALID_MODELS = ['default', 'custom',
        'gemini-3.7-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
        'claude-sonnet-4.6', 'claude-opus-4.6', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
        'gpt-oss-120b', 'gpt-4.5-preview', 'gpt-4-turbo',
        'grok-2-vision-1212', 'grok-2-vision', 'grok-vision-beta', 'grok-beta',
        'meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];

    public function __construct(protected SettingsRepositoryInterface $settings, protected Cache $cache)
    {
    }

    protected function setting(string $key, $default = null)
    {
        $v = $this->settings->get('framio-upload-exif.' . $key);

        return $v === null || $v === '' ? $default : $v;
    }

    public function enabled(): bool
    {
        return $this->setting('ai_enabled', '1') !== '0';
    }

    protected function entry(?string $provider, ?string $key, ?string $model, string $source): ?array
    {
        $provider = strtolower(trim((string) $provider));
        $key = trim((string) $key);
        if (!isset(self::PROVIDERS[$provider]) || $key === '') {
            return null;
        }
        $model = trim((string) $model);
        if ($model === '' || in_array($model, self::INVALID_MODELS, true)) {
            $model = self::PROVIDERS[$provider]['model'];
        }

        return ['provider' => $provider, 'key' => $key, 'model' => $model, 'source' => $source];
    }

    /** Doğruluk kipi (varsayılan): hız yerine en doğru sonuç — güçlü model düşünerek yanıtlar, tüm yanıtlar oylanır */
    /** Kullanıcının asistanda seçtiği model ("gemini|gemini-3.8-flash"): o sağlayıcı/model önce ve güçlü kipte */
    public ?string $pick = null;

    protected function applyPick(array $candidates): array
    {
        [$prov, $model] = array_pad(explode('|', (string) $this->pick, 2), 2, '');
        foreach ($candidates as $i => $c) {
            if ($c['provider'] === $prov) {
                $first = ['model' => $model !== '' ? $model : $c['model'], 'deep' => true] + $c;
                unset($candidates[$i]);

                return array_merge([$first], array_values($candidates));
            }
        }

        return $candidates;
    }

    /** Bu istek için en uzun bekleme (sn); künye penceresinde 6 */
    public ?float $cap = null;

    /** true: bu istek için hızlı kip (çok fotoğraf taranırken) */
    public bool $fast = false;

    public function accurate(): bool
    {
        if ($this->fast) return false;

        return $this->setting('ai_quality', 'accurate') !== 'fast';
    }

    /** Doğruluk kipinde listeye, Gemini anahtarıyla çalışan güçlü (düşünen) model eklenir */
    public function withDeep(array $candidates): array
    {
        if (!$this->accurate()) return $candidates;
        foreach ($candidates as $c) {
            if ($c['provider'] === 'gemini') {
                $model = trim((string) $this->setting('ai_accurate_model', '')) ?: 'gemini-3.8-flash';
                array_unshift($candidates, ['model' => $model, 'deep' => true] + $c);
                break;
            }
            if (in_array($c['provider'], ['claude', 'openai', 'grok'], true)) {
                array_unshift($candidates, ['deep' => true] + $c);
                break;
            }
        }

        return $candidates;
    }

    /** Alan bazında ağırlıklı oylama: güçlü model 3, diğerleri 1 oy */
    protected function vote(array $results): array
    {
        $out = [];
        $fields = [];
        foreach ($results as $r) $fields = array_merge($fields, array_keys($r['data']));
        foreach (array_unique($fields) as $f) {
            $tally = [];
            foreach ($results as $r) {
                $v = $r['data'][$f] ?? null;
                if (!is_scalar($v) || trim((string) $v) === '') continue;
                $k = preg_replace('/[^\p{L}\p{N}]/u', '', mb_strtolower((string) $v, 'UTF-8'));
                $tally[$k] ??= ['v' => $v, 'w' => 0];
                $tally[$k]['w'] += !empty($r['deep']) ? 3 : 1;
                if (!empty($r['deep'])) $tally[$k]['w'] += 0.5;
            }
            if ($tally) {
                usort($tally, fn ($a, $b) => $b['w'] <=> $a['w']);
                $out[$f] = $tally[0]['v'];
            } else {
                $out[$f] = '';
            }
        }

        return $out;
    }

    /** @return array<int,array{provider:string,key:string,model:string,source:string}> */
    public function candidates(?User $actor): array
    {
        $list = [];

        if ($actor && !$actor->isGuest() && $this->setting('allow_user_ai_keys', '1') !== '0') {
            $p = $actor->getPreference('framio_personal_ai_provider');
            if ($p && $p !== 'default') {
                $list[] = $this->entry($p, $actor->getPreference('framio_personal_ai_key'), $actor->getPreference('framio_personal_ai_model'), 'user');
            }
        }

        $site = json_decode((string) $this->setting('ai_providers', '[]'), true);
        if (is_array($site) && $site) {
            foreach ($site as $row) {
                if (is_array($row) && ($row['enabled'] ?? true)) {
                    $list[] = $this->entry($row['provider'] ?? '', $row['key'] ?? '', $row['model'] ?? '', 'site');
                }
            }
        } else {
            // Eski tek sağlayıcılı ayar
            $list[] = $this->entry($this->setting('ai_provider', 'gemini'), $this->setting('ai_api_key', ''), $this->setting('ai_model', ''), 'site');
        }

        $list = array_values(array_filter($list));
        // Aynı sağlayıcı + anahtar iki kez denenmesin
        $seen = [];

        return array_values(array_filter($list, function ($c) use (&$seen) {
            $k = $c['provider'] . '|' . $c['key'];
            if (isset($seen[$k])) return false;

            return $seen[$k] = true;
        }));
    }

    /** Görseli en fazla $max px'e küçültüp JPEG yapar (GD yoksa olduğu gibi döner) */
    public function shrink(string $bytes, string $mime, int $max = 768, bool $forceJpeg = false): array
    {
        if (!function_exists('imagecreatefromstring') || (!$forceJpeg && strlen($bytes) < 150 * 1024)) {
            return [$bytes, $mime];
        }
        $img = @imagecreatefromstring($bytes);
        if (!$img) {
            return [$bytes, $mime];
        }
        $w = imagesx($img);
        $h = imagesy($img);
        $scale = min(1, $max / max($w, $h));
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $out = imagecreatetruecolor($nw, $nh);
        imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
        ob_start();
        imagejpeg($out, null, 82);
        $jpeg = ob_get_clean();
        imagedestroy($img);
        imagedestroy($out);

        return [$jpeg ?: $bytes, $jpeg ? 'image/jpeg' : $mime];
    }

    /**
     * @return array{data:array, provider:string, model:string, source:string, cached:bool, ms:int}|null
     *
     * @throws \RuntimeException tüm sağlayıcılar başarısız olursa (ilk hata mesajıyla)
     */
    public function analyze(array $candidates, string $bytes, string $mime, string $prompt, ?callable $parallel = null): ?array
    {
        if (!$candidates) {
            return null;
        }
        $start = microtime(true);
        $original = $bytes;
        [$bytes, $mime] = $this->shrink($bytes, $mime);
        $b64 = base64_encode($bytes);

        $timeout = max(3, min(30, (float) $this->setting('ai_timeout', 10)));
        $accurate = $this->accurate();
        if ($this->pick && !$this->fast) {
            $candidates = $this->applyPick($candidates);
            $accurate = true;
            $timeout = max($timeout, 30);
        } elseif ($accurate) {
            $candidates = $this->withDeep($candidates);
            $timeout = max($timeout, 30);
        }
        if ($this->cap) $timeout = min($timeout, $this->cap);
        $client = new Client(['timeout' => $timeout, 'connect_timeout' => 3]);

        // Yan işler (görsel benzerlik, konum sorusu, ters adres) aynı istemcide, yapay zeka isteğiyle
        // eşzamanlı yürür. Tek söz (promise) ya da adlandırılmış söz dizisi olabilir.
        $side = $parallel ? $parallel($client, $original, $b64, $mime) : null;
        $sideValue = function () use ($side) {
            if (!$side) return null;
            $one = function ($p) {
                try {
                    return $p ? $p->wait() : null;
                } catch (\Throwable $e) {
                    return null;
                }
            };

            return is_array($side) ? array_map($one, $side) : $one($side);
        };

        $cacheKey = 'framio_vision_' . ($accurate ? 'acc_' : '') . sha1($b64 . '|' . $prompt);
        if ($hit = $this->cache->get($cacheKey)) {
            return $hit + ['cached' => true, 'side' => $sideValue(), 'ms' => (int) ((microtime(true) - $start) * 1000)];
        }

        $errors = [];
        $promises = [];
        foreach ($candidates as $i => $c) {
            $promises[$i] = $this->request($client, $c, $b64, $mime, $prompt)->then(
                function ($response) use ($c) {
                    $data = $this->parse($c['provider'], (string) $response->getBody());
                    if (!$data) {
                        throw new \RuntimeException(self::PROVIDERS[$c['provider']]['name'] . ': boş yanıt');
                    }

                    return ['data' => $data, 'provider' => $c['provider'], 'model' => $c['model'], 'source' => $c['source'], 'deep' => !empty($c['deep'])];
                },
                function ($e) use ($c, &$errors) {
                    $errors[] = self::PROVIDERS[$c['provider']]['name'] . ': ' . $this->errorMessage($e);
                    throw $e instanceof \Throwable ? $e : new \RuntimeException((string) $e);
                }
            );
        }

        try {
            if ($accurate) {
                // Doğruluk: tüm yanıtlar beklenir, alanlar oylanır (güçlü modelin oyu ağır basar)
                $ok = [];
                foreach (Utils::settle($promises)->wait() as $s) {
                    if (($s['state'] ?? '') === 'fulfilled') $ok[] = $s['value'];
                }
                if (!$ok) throw new \RuntimeException('yanıt yok');
                usort($ok, fn ($a, $b) => (int) $b['deep'] <=> (int) $a['deep']);
                $result = $ok[0];
                $result['data'] = count($ok) > 1 ? $this->vote($ok) : $ok[0]['data'];
                $result['votes'] = count($ok);
            } else {
                // İlk başarılı yanıt kazanır; diğerleri beklenmez
                $result = Utils::any($promises)->wait();
            }
        } catch (\Throwable $e) {
            $message = $errors ? implode(' · ', $errors) : $this->errorMessage($e);
            // Yapay zeka yanıt veremese de benzer fotoğraf bulunduysa o kullanılır
            if (($sv = $sideValue()) !== null) {
                return ['data' => [], 'provider' => '', 'model' => '', 'source' => '', 'cached' => false, 'side' => $sv, 'error' => $message, 'ms' => (int) ((microtime(true) - $start) * 1000)];
            }
            throw new \RuntimeException($message);
        }

        $this->cache->put($cacheKey, $result, 7 * 86400);

        return $result + ['cached' => false, 'side' => $sideValue(), 'ms' => (int) ((microtime(true) - $start) * 1000)];
    }

    protected function request(Client $client, array $c, string $b64, string $mime, string $prompt, array $options = []): PromiseInterface
    {
        // Model referans görselleri (varsa): "Örnek: <model>" etiketiyle, en sonda asıl fotoğraf
        $refs = $options['refs'] ?? [];
        unset($options['refs']);
        if ($refs) $prompt = "Önce karşılaştırma için bilinen modellerin ÖRNEK fotoğrafları geliyor; her örneğin adı üstünde yazıyor. EN SONDAKİ fotoğraf incelenecek fotoğraftır.\n" . $prompt;
        switch ($c['provider']) {
            case 'claude':
                $body = [
                    'model' => $c['model'],
                    'max_tokens' => empty($c['deep']) ? 500 : 6000,
                    // Hız için düşünme kapalı (güçlü çağrıda açık); model kabul etmezse ayarsız tekrar denenir
                    'thinking' => empty($c['deep']) ? ['type' => 'disabled'] : ['type' => 'enabled', 'budget_tokens' => 3000],
                    'messages' => [['role' => 'user', 'content' => array_merge(
                        $refs ? array_merge(...array_map(fn ($r) => [['type' => 'text', 'text' => 'Örnek: ' . $r['label']], ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $r['mime'], 'data' => $r['b64']]]], $refs)) : [],
                        $refs ? [['type' => 'text', 'text' => 'İncelenecek fotoğraf:']] : [],
                        [['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mime, 'data' => $b64]], ['type' => 'text', 'text' => $prompt]]
                    )]],
                ];

                return $this->send($client, 'https://api.anthropic.com/v1/messages', ['x-api-key' => $c['key'], 'anthropic-version' => '2023-06-01'], $body, ['thinking' => ['thinking']], $options);

            case 'gemini':
                $config = ['temperature' => 0, 'maxOutputTokens' => empty($c['deep']) ? 500 : 6000, 'responseMimeType' => 'application/json'];
                // Hızlı kipte düşünme en aza indirilir; güçlü (deep) çağrıda model düşünerek yanıtlar
                $config['thinkingConfig'] = str_starts_with($c['model'], 'gemini-2.5') ? ['thinkingBudget' => empty($c['deep']) ? 0 : 2048] : ['thinkingLevel' => empty($c['deep']) ? 'minimal' : 'high'];
                $body = [
                    'contents' => [['parts' => array_merge(
                        [['text' => $prompt]],
                        $refs ? array_merge(...array_map(fn ($r) => [['text' => 'Örnek: ' . $r['label']], ['inline_data' => ['mime_type' => $r['mime'], 'data' => $r['b64']]]], $refs)) : [],
                        $refs ? [['text' => 'İncelenecek fotoğraf:']] : [],
                        [['inline_data' => ['mime_type' => $mime, 'data' => $b64]]]
                    )]],
                    'generationConfig' => $config,
                ];

                return $this->send($client, 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($c['model']) . ':generateContent', ['x-goog-api-key' => $c['key']], $body, ['generationConfig.thinkingConfig' => ['thinking']], $options);

            default:
                $p = $c['provider'];
                $body = [
                    'model' => $c['model'],
                    'messages' => [['role' => 'user', 'content' => array_merge(
                        [['type' => 'text', 'text' => $prompt]],
                        $refs ? array_merge(...array_map(fn ($r) => [['type' => 'text', 'text' => 'Örnek: ' . $r['label']], ['type' => 'image_url', 'image_url' => ['url' => "data:{$r['mime']};base64,{$r['b64']}"] + ($p === 'openai' ? ['detail' => 'low'] : [])]], $refs)) : [],
                        $refs ? [['type' => 'text', 'text' => 'İncelenecek fotoğraf:']] : [],
                        [['type' => 'image_url', 'image_url' => ['url' => "data:{$mime};base64,{$b64}"] + ($p === 'openai' ? ['detail' => 'low'] : [])]]
                    )]],
                    'response_format' => ['type' => 'json_object'],
                ];
                if ($p === 'openai') {
                    // Yeni OpenAI modelleri max_tokens ve temperature kabul etmez
                    $body['max_completion_tokens'] = 500;
                    $body['reasoning_effort'] = 'minimal';
                } else {
                    $body['max_tokens'] = 500;
                    $body['temperature'] = 0;
                }
                if ($p === 'groq' || $p === 'nvidia' || $p === 'grok') {
                    $body['reasoning_effort'] = $p === 'grok' ? 'low' : 'none';
                }
                $headers = ['Authorization' => 'Bearer ' . $c['key']];
                if ($p === 'openrouter') {
                    $headers['X-Title'] = 'Framio AI';
                }

                return $this->send($client, self::CHAT_URLS[$p], $headers, $body, ['reasoning_effort' => ['reasoning'], 'response_format' => ['response_format', 'json_object', 'response format'], 'temperature' => ['temperature']], $options);
        }
    }

    /**
     * İsteği gönderir; sağlayıcı isteğe bağlı bir ayarı reddederse (400, hata metninde ayarın adı geçer)
     * o ayarı çıkarıp bir kez daha dener. Modeller değiştikçe kod kırılmasın diye.
     */
    protected function send(Client $client, string $url, array $headers, array $body, array $optional, array $options = []): PromiseInterface
    {
        return $client->postAsync($url, ['headers' => $headers, 'json' => $body] + $options)
            ->otherwise(function ($e) use ($client, $url, $headers, $body, $optional, $options) {
                if (!$e instanceof \GuzzleHttp\Exception\ClientException || $e->getResponse()->getStatusCode() !== 400) {
                    throw $e;
                }
                $msg = strtolower((string) $e->getResponse()->getBody());
                $stripped = false;
                foreach ($optional as $path => $words) {
                    foreach ($words as $w) {
                        if (str_contains($msg, $w)) {
                            $body = $this->forget($body, $path);
                            $stripped = true;
                            break;
                        }
                    }
                }
                if (!$stripped) {
                    throw $e;
                }

                return $client->postAsync($url, ['headers' => $headers, 'json' => $body] + $options);
            });
    }

    protected function forget(array $body, string $path): array
    {
        $keys = explode('.', $path);
        $last = array_pop($keys);
        $ref = &$body;
        foreach ($keys as $k) {
            if (!isset($ref[$k]) || !is_array($ref[$k])) return $body;
            $ref = &$ref[$k];
        }
        unset($ref[$last]);

        return $body;
    }

    /**
     * Admin: her sağlayıcıyı küçük bir görselle ayrı ayrı dener (anahtar ve model doğru mu, ne kadar sürüyor).
     *
     * @return array<int,array{provider:string, model:string, ok:bool, ms:int, message:string}>
     */
    public function test(array $candidates, string $bytes): array
    {
        [$bytes, $mime] = $this->shrink($bytes, 'image/jpeg', 512, true);
        $b64 = base64_encode($bytes);
        $client = new Client(['timeout' => 15, 'connect_timeout' => 5]);
        $prompt = 'Görseldeki aracın markasını JSON olarak döndür: {"brand": ""}';
        $promises = [];
        $started = [];
        foreach ($candidates as $i => $c) {
            $started[$i] = microtime(true);
            $promises[$i] = $this->request($client, $c, $b64, $mime, $prompt)->then(function ($res) use ($i, &$started) {
                return (int) ((microtime(true) - $started[$i]) * 1000);
            });
        }
        $out = [];
        foreach (Utils::settle($promises)->wait() as $i => $r) {
            $c = $candidates[$i];
            $ok = $r['state'] === 'fulfilled';
            $out[] = [
                'provider' => $c['provider'],
                'model' => $c['model'],
                'ok' => $ok,
                'ms' => $ok ? $r['value'] : (int) ((microtime(true) - $started[$i]) * 1000),
                'message' => $ok ? 'Çalışıyor' : $this->errorMessage($r['reason']),
            ];
        }

        return $out;
    }

    /**
     * Görselsiz metin sorusu (ör. asistan komutunu anlama). Sağlayıcılar yarışır; ilk geçerli JSON döner.
     * Ham JSON (iç içe alanlar korunur) döndürülür; hiçbiri yanıt veremezse null.
     */
    public function completeJson(array $candidates, string $prompt, float $timeout = 8): ?array
    {
        if (!$candidates) return null;
        $accurate = $this->accurate();
        if ($this->pick) {
            $candidates = $this->applyPick($candidates);
            $accurate = true;
            $timeout = max($timeout, 25);
        } elseif ($accurate) {
            $candidates = $this->withDeep($candidates);
            $timeout = max($timeout, 25);
        }
        $client = new Client(['timeout' => $timeout, 'connect_timeout' => 3]);
        $promises = [];
        foreach ($candidates as $i => $c) {
            $promises[$i] = $this->textRequest($client, $c, $prompt)->then(function ($res) use ($c) {
                $raw = json_decode((string) $res->getBody(), true) ?: [];
                $text = match ($c['provider']) {
                    'claude' => collect($raw['content'] ?? [])->firstWhere('type', 'text')['text'] ?? '',
                    'gemini' => $raw['candidates'][0]['content']['parts'][0]['text'] ?? '',
                    default => $raw['choices'][0]['message']['content'] ?? '',
                };
                $text = trim(preg_replace('#<think>.*?</think>#s', '', (string) $text));
                if (preg_match('/\{.*\}/s', $text, $m)) $text = $m[0];
                $data = json_decode($text, true);
                if (!is_array($data)) throw new \RuntimeException('JSON değil');

                return $data;
            });
        }
        try {
            if ($accurate && !empty($candidates[0]['deep'])) {
                // Güçlü model yanıt verir vermez o kullanılır (diğerleri beklenmez); vermezse ilk başarılı diğer yanıt
                try {
                    return $promises[0]->wait();
                } catch (\Throwable $e) {
                    $rest = array_slice($promises, 1);

                    return $rest ? Utils::any($rest)->wait() : null;
                }
            }

            return Utils::any($promises)->wait();
        } catch (\Throwable $e) {
            return null;
        }
    }

    protected function textRequest(Client $client, array $c, string $prompt): PromiseInterface
    {
        switch ($c['provider']) {
            case 'claude':
                return $this->send($client, 'https://api.anthropic.com/v1/messages', ['x-api-key' => $c['key'], 'anthropic-version' => '2023-06-01'],
                    ['model' => $c['model'], 'max_tokens' => 800, 'thinking' => ['type' => 'disabled'], 'messages' => [['role' => 'user', 'content' => $prompt]]],
                    ['thinking' => ['thinking']]);
            case 'gemini':
                return $this->send($client, 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($c['model']) . ':generateContent', ['x-goog-api-key' => $c['key']],
                    ['contents' => [['parts' => [['text' => $prompt]]]], 'generationConfig' => ['temperature' => empty($c['deep']) ? 0 : 0.4, 'maxOutputTokens' => empty($c['deep']) ? 800 : 6000, 'responseMimeType' => 'application/json', 'thinkingConfig' => str_starts_with($c['model'], 'gemini-2.5') ? ['thinkingBudget' => empty($c['deep']) ? 0 : 2048] : ['thinkingLevel' => empty($c['deep']) ? 'minimal' : 'medium']]],
                    ['generationConfig.thinkingConfig' => ['thinking']]);
            default:
                $p = $c['provider'];
                $body = ['model' => $c['model'], 'messages' => [['role' => 'user', 'content' => $prompt]], 'response_format' => ['type' => 'json_object']];
                if ($p === 'openai') {
                    $body['max_completion_tokens'] = 800;
                    $body['reasoning_effort'] = 'minimal';
                } else {
                    $body['max_tokens'] = 800;
                    $body['temperature'] = 0;
                    if (in_array($p, ['groq', 'nvidia', 'grok'], true)) $body['reasoning_effort'] = $p === 'grok' ? 'low' : 'none';
                }
                $headers = ['Authorization' => 'Bearer ' . $c['key']];

                return $this->send($client, self::CHAT_URLS[$p], $headers, $body, ['reasoning_effort' => ['reasoning'], 'response_format' => ['response_format', 'json_object', 'response format'], 'temperature' => ['temperature']]);
        }
    }

    /** Tek sağlayıcıya ayrı bir soru (ör. yalnızca konum); ayrıştırılmış JSON döner */
    public function askAsync(Client $client, array $c, string $b64, string $mime, string $prompt, float $timeout = 2.5, array $refs = []): PromiseInterface
    {
        // Yan soru ana yanıtı bekletmesin: kısa süre sınırı
        return $this->request($client, $c, $b64, $mime, $prompt, ['timeout' => $timeout, 'refs' => $refs])
            ->then(fn ($res) => $this->parse($c['provider'], (string) $res->getBody()));
    }

    protected function parse(string $provider, string $raw): array
    {
        $res = json_decode($raw, true) ?: [];
        $text = match ($provider) {
            // Claude yanıtında düşünme bloğu varsa metin bloğu sonradır
            'claude' => collect($res['content'] ?? [])->firstWhere('type', 'text')['text'] ?? '',
            'gemini' => $res['candidates'][0]['content']['parts'][0]['text'] ?? '',
            default => $res['choices'][0]['message']['content'] ?? '',
        };
        // Düşünme bloğu döndüyse at
        $text = trim(preg_replace('#<think>.*?</think>#s', '', (string) $text));
        // Yanıt kod bloğu ya da açıklamayla gelirse içindeki JSON nesnesini al
        if (preg_match('/\{.*\}/s', $text, $m)) {
            $text = $m[0];
        }
        $data = json_decode($text, true);
        if (!is_array($data)) {
            return [];
        }
        $data = array_filter(array_map(fn ($v) => is_scalar($v) ? trim((string) $v) : '', $data), fn ($v) => $v !== '' && !in_array(mb_strtolower($v), ['null', 'yok', 'bilinmiyor', 'unknown', 'n/a', '-'], true));

        return $data;
    }

    protected function errorMessage($e): string
    {
        if ($e instanceof \GuzzleHttp\Exception\RequestException && $e->hasResponse()) {
            $body = json_decode((string) $e->getResponse()->getBody(), true);
            $msg = $body['error']['message'] ?? $body['message'] ?? null;
            if ($msg) return mb_substr($msg, 0, 200);

            return 'HTTP ' . $e->getResponse()->getStatusCode();
        }
        if ($e instanceof \GuzzleHttp\Exception\ConnectException) {
            return 'zaman aşımı / bağlantı kurulamadı';
        }

        return $e instanceof \Throwable ? mb_substr($e->getMessage(), 0, 200) : 'bilinmeyen hata';
    }
}
