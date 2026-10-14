<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\TextChannel;
use Framio\DirectMessenger\TextChannelMessage;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;

class TextChannelMessagesController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor || $actor->isGuest()) {
            return new JsonResponse(['error' => 'Giriş yapmalısınız.'], 401);
        }

        $method = $request->getMethod();
        $channelId = (int) Arr::get($request->getQueryParams(), 'id');
        if (!$channelId) {
            $channelId = (int) Arr::get($request->getQueryParams(), 'channel_id');
        }

        if (!$channelId) {
            $body = (array) $request->getParsedBody();
            $channelId = (int) Arr::get($body, 'channel_id', Arr::get($body, 'id'));
        }

        $channel = TextChannel::find($channelId);
        if (!$channel || !$channel->is_active) {
            return new JsonResponse(['error' => 'Kanal bulunamadı veya aktif değil.'], 404);
        }

        if ($method === 'GET') {
            $params = $request->getQueryParams();
            $afterId = (int) Arr::get($params, 'after_id', 0);
            $limit = min(50, max(10, (int) Arr::get($params, 'limit', 30)));

            $query = TextChannelMessage::with('user')
                ->where('channel_id', $channelId);

            if ($afterId > 0) {
                $messages = $query->where('id', '>', $afterId)
                    ->orderBy('id', 'asc')
                    ->limit(50)
                    ->get();
            } else {
                // Fetch recent messages
                $messages = $query->orderBy('id', 'desc')
                    ->limit($limit)
                    ->get()
                    ->reverse()
                    ->values();
            }

            $data = $messages->map(fn($msg) => ResponseFormatter::formatTextChannelMessage($msg, $actor))->values()->toArray();

            return new JsonResponse(['data' => $data]);
        }

        if ($method === 'POST') {
            $body = (array) $request->getParsedBody();
            $messageText = trim(Arr::get($body, 'message', ''));
            $msgType = Arr::get($body, 'type', 'text');

            // Handle file uploads (audio, video, image)
            $uploadedFiles = $request->getUploadedFiles();
            if (isset($uploadedFiles['media'])) {
                $file = $uploadedFiles['media'];
                $extension = pathinfo($file->getClientFilename(), PATHINFO_EXTENSION);
                if (!$extension && $msgType === 'audio') {
                    $extension = 'webm';
                } elseif (!$extension && $msgType === 'video') {
                    $extension = 'webm';
                } elseif (!$extension && $msgType === 'image') {
                    $extension = 'jpg';
                }

                $filename = \Illuminate\Support\Str::random(20) . '.' . $extension;
                $uploadDir = public_path('assets/messenger');
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }

                $file->moveTo($uploadDir . '/' . $filename);
                $messageText = '/assets/messenger/' . $filename;
            }

            if (empty($messageText)) {
                return new JsonResponse(['error' => 'Mesaj içeriği boş olamaz.'], 400);
            }

            if (mb_strlen($messageText) > 2000) {
                return new JsonResponse(['error' => 'Mesaj en fazla 2000 karakter olabilir.'], 400);
            }

            $message = TextChannelMessage::create([
                'channel_id' => $channelId,
                'user_id' => $actor->id,
                'message' => $messageText,
                'type' => $msgType,
                'created_at' => \Carbon\Carbon::now(),
            ]);

            $message->load('user');

            return new JsonResponse([
                'data' => ResponseFormatter::formatTextChannelMessage($message, $actor)
            ], 201);
        }

        return new JsonResponse(['error' => 'Geçersiz istek.'], 405);
    }
}
