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
    public const PROVIDERS = [
        'gemini' => ['name' => 'Google Gemini', 'model' => 'gemini-2.5-flash-lite'],
        'groq' => ['name' => 'Groq', 'model' => 'meta-llama/llama-4-scout-17b-16e-instruct'],
        'openai' => ['name' => 'OpenAI ChatGPT', 'model' => 'gpt-4o-mini'],
        'claude' => ['name' => 'Anthropic Claude', 'model' => 'claude-haiku-4-5'],
        'grok' => ['name' => 'xAI Grok', 'model' => 'grok-2-vision-1212'],
    ];

    // Eski sürümlerde varsayılan olarak kaydedilmiş, API'de bulunmayan model adları
    protected const INVALID_MODELS = ['default', 'custom', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro', 'claude-sonnet-4.6', 'claude-opus-4.6', 'gpt-oss-120b'];

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
    public function shrink(string $bytes, string $mime, int $max = 768): array
    {
        if (!function_exists('imagecreatefromstring') || strlen($bytes) < 150 * 1024) {
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
    public function analyze(array $candidates, string $bytes, string $mime, string $prompt): ?array
    {
        if (!$candidates) {
            return null;
        }
        $start = microtime(true);
        [$bytes, $mime] = $this->shrink($bytes, $mime);
        $b64 = base64_encode($bytes);

        $cacheKey = 'framio_vision_' . sha1($b64 . '|' . $prompt);
        if ($hit = $this->cache->get($cacheKey)) {
            return $hit + ['cached' => true, 'ms' => (int) ((microtime(true) - $start) * 1000)];
        }

        $timeout = max(3, min(30, (float) $this->setting('ai_timeout', 10)));
        $client = new Client(['timeout' => $timeout, 'connect_timeout' => 3]);

        $errors = [];
        $promises = [];
        foreach ($candidates as $i => $c) {
            $promises[$i] = $this->request($client, $c, $b64, $mime, $prompt)->then(
                function ($response) use ($c) {
                    $data = $this->parse($c['provider'], (string) $response->getBody());
                    if (!$data) {
                        throw new \RuntimeException(self::PROVIDERS[$c['provider']]['name'] . ': boş yanıt');
                    }

                    return ['data' => $data, 'provider' => $c['provider'], 'model' => $c['model'], 'source' => $c['source']];
                },
                function ($e) use ($c, &$errors) {
                    $errors[] = self::PROVIDERS[$c['provider']]['name'] . ': ' . $this->errorMessage($e);
                    throw $e instanceof \Throwable ? $e : new \RuntimeException((string) $e);
                }
            );
        }

        try {
            // İlk başarılı yanıt kazanır; diğerleri beklenmez
            $result = Utils::any($promises)->wait();
        } catch (\Throwable $e) {
            throw new \RuntimeException($errors ? implode(' · ', $errors) : $this->errorMessage($e));
        }

        $this->cache->put($cacheKey, $result, 7 * 86400);

        return $result + ['cached' => false, 'ms' => (int) ((microtime(true) - $start) * 1000)];
    }

    protected function request(Client $client, array $c, string $b64, string $mime, string $prompt): PromiseInterface
    {
        $dataUrl = "data:{$mime};base64,{$b64}";

        switch ($c['provider']) {
            case 'claude':
                return $client->postAsync('https://api.anthropic.com/v1/messages', [
                    'headers' => ['x-api-key' => $c['key'], 'anthropic-version' => '2023-06-01'],
                    'json' => [
                        'model' => $c['model'],
                        'max_tokens' => 400,
                        'temperature' => 0,
                        'messages' => [['role' => 'user', 'content' => [
                            ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mime, 'data' => $b64]],
                            ['type' => 'text', 'text' => $prompt],
                        ]]],
                    ],
                ]);

            case 'gemini':
                $config = ['temperature' => 0, 'maxOutputTokens' => 400, 'responseMimeType' => 'application/json'];
                // 2.5 ailesinde "düşünme" kapatılır: yanıt süresini belirgin kısaltır
                if (str_starts_with($c['model'], 'gemini-2.5-flash')) {
                    $config['thinkingConfig'] = ['thinkingBudget' => 0];
                }

                return $client->postAsync('https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($c['model']) . ':generateContent', [
                    'headers' => ['x-goog-api-key' => $c['key']],
                    'json' => [
                        'contents' => [['parts' => [['text' => $prompt], ['inline_data' => ['mime_type' => $mime, 'data' => $b64]]]]],
                        'generationConfig' => $config,
                    ],
                ]);

            default:
                // OpenAI uyumlu uç noktalar: OpenAI, Groq, xAI
                $url = [
                    'openai' => 'https://api.openai.com/v1/chat/completions',
                    'groq' => 'https://api.groq.com/openai/v1/chat/completions',
                    'grok' => 'https://api.x.ai/v1/chat/completions',
                ][$c['provider']];
                $body = [
                    'model' => $c['model'],
                    'temperature' => 0,
                    'max_tokens' => 400,
                    'messages' => [['role' => 'user', 'content' => [
                        ['type' => 'text', 'text' => $prompt],
                        ['type' => 'image_url', 'image_url' => ['url' => $dataUrl] + ($c['provider'] === 'openai' ? ['detail' => 'low'] : [])],
                    ]]],
                ];
                if ($c['provider'] !== 'grok') {
                    $body['response_format'] = ['type' => 'json_object'];
                }

                return $client->postAsync($url, ['headers' => ['Authorization' => 'Bearer ' . $c['key']], 'json' => $body]);
        }
    }

    protected function parse(string $provider, string $raw): array
    {
        $res = json_decode($raw, true) ?: [];
        $text = match ($provider) {
            'claude' => $res['content'][0]['text'] ?? '',
            'gemini' => $res['candidates'][0]['content']['parts'][0]['text'] ?? '',
            default => $res['choices'][0]['message']['content'] ?? '',
        };
        $text = trim((string) $text);
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
