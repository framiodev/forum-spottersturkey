<?php

namespace Framio\SeoPack;

use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Framio\SeoPack\Support\AltTextFixer;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class FixAltTagsController implements RequestHandlerInterface
{
    public function __construct(protected AltTextFixer $fixer, protected SeoSettings $seo)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $body = (array) $request->getParsedBody();
        $overwrite = filter_var($body['overwrite'] ?? false, FILTER_VALIDATE_BOOLEAN);
        [$processed, $updated] = self::run($this->fixer, $this->seo, $overwrite);

        return new JsonResponse([
            'message' => "Başarılı! {$processed} mesaj tarandı, {$updated} mesajdaki görsellerin alt metni güncellendi.",
            'processed' => $processed,
            'updated' => $updated,
        ]);
    }

    /** @return array{0:int,1:int} [taranan, güncellenen] */
    public static function run(AltTextFixer $fixer, SeoSettings $seo, bool $overwrite, ?callable $progress = null): array
    {
        $tags = array_unique(array_merge(['framio-image', 'upl-image-preview'], $seo->recognizedTags()));
        $processed = 0;
        $updated = 0;

        CommentPost::query()
            ->with('discussion')
            ->where(function ($q) use ($tags) {
                foreach ($tags as $tag) {
                    $q->orWhere('content', 'like', '%<' . strtoupper($tag) . '%');
                }
            })
            ->orderBy('id')
            ->chunkById(200, function ($posts) use ($fixer, $overwrite, &$processed, &$updated, $progress) {
                foreach ($posts as $post) {
                    $processed++;
                    if ($fixer->fix($post, $overwrite)) {
                        $updated++;
                    }
                }
                if ($progress) {
                    $progress($processed, $updated);
                }
            });

        return [$processed, $updated];
    }
}
