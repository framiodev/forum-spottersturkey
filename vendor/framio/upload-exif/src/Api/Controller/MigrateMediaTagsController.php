<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Framio\UploadExif\Helpers\MediaTagParser;

class MigrateMediaTagsController implements RequestHandlerInterface
{
    protected ConnectionInterface $db;

    public function __construct(ConnectionInterface $db)
    {
        $this->db = $db;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $body = $request->getParsedBody();
        $action = Arr::get($body, 'action', 'count');
        $fromTag = trim(Arr::get($body, 'from_tag', ''));
        $toTag = trim(Arr::get($body, 'to_tag', 'framio-image'));

        if (empty($fromTag) || empty($toTag)) {
            return new JsonResponse(['error' => 'Kaynak ve hedef etiket adı boş bırakılamaz.'], 400);
        }

        if ($fromTag === $toTag) {
            return new JsonResponse(['error' => 'Kaynak ve hedef etiket aynı olamaz.'], 400);
        }

        // 1. Sayma / Önizleme Modu
        if ($action === 'count') {
            $count = $this->db->table('posts')
                ->where('type', 'comment')
                ->where('content', 'LIKE', '%[' . $fromTag . '%')
                ->count();

            return new JsonResponse([
                'status' => 'success',
                'count' => $count,
                'from_tag' => $fromTag,
                'to_tag' => $toTag
            ]);
        }

        // 2. Toplu Dönüştürme (Migrate) Modu
        if ($action === 'migrate') {
            $posts = $this->db->table('posts')
                ->where('type', 'comment')
                ->where('content', 'LIKE', '%[' . $fromTag . '%')
                ->get(['id', 'content']);

            $updatedCount = 0;

            foreach ($posts as $p) {
                $newContent = MediaTagParser::migrateTag($p->content, $fromTag, $toTag);
                if ($newContent !== $p->content) {
                    $this->db->table('posts')
                        ->where('id', $p->id)
                        ->update(['content' => $newContent]);
                    $updatedCount++;
                }
            }

            return new JsonResponse([
                'status' => 'success',
                'message' => "Toplam {$updatedCount} adet gönderideki [{$fromTag}] etiketleri başarıyla [{$toTag}] olarak güncellendi.",
                'updated_count' => $updatedCount
            ]);
        }

        return new JsonResponse(['error' => 'Geçersiz işlem.'], 400);
    }
}
