<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\TextChannel;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;

class ManageTextChannelsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor || !$actor->isAdmin()) {
            return new JsonResponse(['error' => 'Yetkisiz işlem.'], 403);
        }

        $method = $request->getMethod();
        $body = (array) $request->getParsedBody();

        if ($method === 'POST') {
            // Check maximum 10 global channels limit
            $count = TextChannel::whereNull('discussion_id')->count();
            if ($count >= 10) {
                return new JsonResponse(['error' => 'En fazla 10 adet metin kanalı oluşturabilirsiniz.'], 400);
            }

            $name = trim(Arr::get($body, 'name', ''));
            if (empty($name)) {
                return new JsonResponse(['error' => 'Kanal adı boş bırakılamaz.'], 400);
            }

            $channel = TextChannel::create([
                'name' => $name,
                'description' => Arr::get($body, 'description', ''),
                'icon' => Arr::get($body, 'icon', 'fas fa-comments'),
                'sort_order' => (int) Arr::get($body, 'sort_order', 0),
                'is_active' => (bool) Arr::get($body, 'is_active', true),
            ]);

            return new JsonResponse(['data' => ResponseFormatter::formatTextChannel($channel)], 201);
        }

        if ($method === 'PATCH' || $method === 'PUT') {
            $id = Arr::get($request->getQueryParams(), 'id', Arr::get($body, 'id'));
            $channel = TextChannel::find($id);

            if (!$channel) {
                return new JsonResponse(['error' => 'Kanal bulunamadı.'], 404);
            }

            if (isset($body['name'])) {
                $name = trim($body['name']);
                if (!empty($name)) {
                    $channel->name = $name;
                }
            }

            if (isset($body['description'])) {
                $channel->description = $body['description'];
            }

            if (isset($body['icon'])) {
                $channel->icon = $body['icon'];
            }

            if (isset($body['sort_order'])) {
                $channel->sort_order = (int) $body['sort_order'];
            }

            if (isset($body['is_active'])) {
                $channel->is_active = (bool) $body['is_active'];
            }

            $channel->save();

            return new JsonResponse(['data' => ResponseFormatter::formatTextChannel($channel)]);
        }

        if ($method === 'DELETE') {
            $id = Arr::get($request->getQueryParams(), 'id');
            $channel = TextChannel::find($id);

            if (!$channel) {
                return new JsonResponse(['error' => 'Kanal bulunamadı.'], 404);
            }

            // Delete channel messages and channel
            $channel->messages()->delete();
            $channel->delete();

            return new EmptyResponse(204);
        }

        return new JsonResponse(['error' => 'Geçersiz istek.'], 405);
    }
}
