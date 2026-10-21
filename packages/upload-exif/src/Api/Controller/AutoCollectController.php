<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Framio\UploadExif\Ai\AutoCollect;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Admin: otomatik koleksiyonda geçmiş gönderiler
 *   POST /framio-media/auto-collect {rule, action: "scan", limit}   → sorulmamış 20 gönderiyi sorar (eklemez), sonuçları döndürür
 *   POST /framio-media/auto-collect {rule, action: "add", posts:[]} → seçilenleri hedef başlığa ekler
 */
class AutoCollectController implements RequestHandlerInterface
{
    public function __construct(protected AutoCollect $auto)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();
        @set_time_limit(600);
        if (!$this->auto->ready()) return new JsonResponse(['error' => 'Tablo yok: php flarum migrate çalıştırılmalı.'], 422);
        $b = (array) $request->getParsedBody();
        $rule = $this->auto->rule((string) Arr::get($b, 'rule', ''));
        if (!$rule) return new JsonResponse(['error' => 'Kural bulunamadı (önce ayarları kaydedin).'], 422);

        if (Arr::get($b, 'action') === 'add') {
            $added = 0;
            foreach (array_slice((array) Arr::get($b, 'posts', []), 0, 100) as $id) {
                $post = CommentPost::find((int) $id);
                if (!$post) continue;
                $j = ['answer' => true, 'confidence' => 'high', 'image' => null, 'error' => null]; // yönetici onayı
                if ($this->auto->decide($post, $rule, $j, true)) $added++;
            }

            return new JsonResponse(['added' => $added]);
        }

        $out = [];
        foreach ($this->auto->pending($rule, max(1, min(30, (int) Arr::get($b, 'limit', 20)))) as $post) {
            $j = $this->auto->judge($post, $rule);
            // Karar kaydedilir (bir sonraki taramada sıradaki gönderilere geçilir); "evet"ler yönetici "Ekle" deyince eklenir
            $this->auto->decide($post, $rule, $j, false);
            $out[] = ['post_id' => $post->id, 'discussion' => (string) optional($post->discussion)->title, 'number' => $post->number,
                'discussion_id' => $post->discussion_id, 'image' => $j['image'], 'answer' => $j['answer'], 'confidence' => $j['confidence'], 'error' => $j['error']];
        }

        return new JsonResponse(['items' => $out]);
    }
}
