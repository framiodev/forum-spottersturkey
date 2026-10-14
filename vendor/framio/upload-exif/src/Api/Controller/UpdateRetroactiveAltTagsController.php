<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\FramioImage;

class UpdateRetroactiveAltTagsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $updatedCount = 0;

        Post::where('type', 'comment')
            ->where(function ($q) {
                $q->where('content', 'like', '%[framio-image%')
                  ->orWhere('content', 'like', '%[ulasimarsiv-image%')
                  ->orWhere('content', 'like', '%[spotter-image%');
            })
            ->chunkById(50, function ($posts) use (&$updatedCount) {
                foreach ($posts as $post) {
                    $content = $post->content;

                    $newContent = preg_replace_callback('/\[(framio-image|ulasimarsiv-image|spotter-image)\s+([^\]]+)\]/is', function ($matches) use ($post) {
                        $tagBody = $matches[2];
                        preg_match('/id=["\']?(\d+)["\']?/i', $tagBody, $idMatch);
                        $id = $idMatch[1] ?? null;

                        if (!$id) return $matches[0];

                        $image = FramioImage::find($id);
                        if (!$image) return $matches[0];

                        // Gönderi içeriğinden araç/künye bilgisi bulma
                        $cleanAlt = '';
                        preg_match_all('/^\s*[-*]\s*(?:\*\*)?(.+?)(?:\*\*)?\s*$/m', $post->content, $attrMatches);
                        if (!empty($attrMatches[1])) {
                            $first3 = array_slice(array_map('trim', $attrMatches[1]), 0, 3);
                            $cleanAlt = implode(' - ', $first3);
                        }

                        if (empty($cleanAlt)) {
                            $cleanAlt = pathinfo($image->filename, PATHINFO_FILENAME);
                        }

                        $cleanAlt = htmlspecialchars(str_replace(['"', "'", '[', ']'], '', $cleanAlt), ENT_QUOTES, 'UTF-8');

                        return "[framio-image id={$image->id} url=\"{$image->path}\" alt=\"{$cleanAlt}\"]";
                    }, $content);

                    if ($newContent !== $content) {
                        $post->content = $newContent;
                        $post->save();
                        $updatedCount++;
                    }
                }
            });

        return new JsonResponse([
            'success' => true,
            'updated_count' => $updatedCount
        ]);
    }
}
