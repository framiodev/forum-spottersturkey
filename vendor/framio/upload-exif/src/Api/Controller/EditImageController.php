<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\FramioImage;
use Illuminate\Support\Arr;

class EditImageController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $id = Arr::get($request->getQueryParams(), 'id');

        $image = FramioImage::findOrFail($id);

        if (!$actor->isAdmin() && (int)$actor->id !== (int)$image->user_id) {
            return new JsonResponse(['error' => 'Bu görseli düzenleme yetkiniz yok.'], 403);
        }

        $body = $request->getParsedBody();
        $filename = Arr::get($body, 'filename') ?? Arr::get($body, 'data.attributes.filename');
        $title = Arr::get($body, 'title') ?? Arr::get($body, 'data.attributes.title');
        $description = Arr::get($body, 'description') ?? Arr::get($body, 'data.attributes.description');

        if ($filename !== null) {
            $image->filename = trim($filename);
        }
        if ($title !== null) {
            $image->title = trim($title);
        }
        if ($description !== null) {
            $image->description = trim($description);
        }

        $image->save();

        return new JsonResponse([
            'success' => true,
            'image' => $image
        ]);
    }
}
