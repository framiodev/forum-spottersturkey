<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\VoiceRoomUser;
use Framio\DirectMessenger\VoiceRoom;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Carbon\Carbon;
use Illuminate\Support\Arr;

class PingVoiceRoomController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $roomId = Arr::get($request->getQueryParams(), 'id');
        $room = VoiceRoom::findOrFail($roomId);

        $vrUser = VoiceRoomUser::where('user_id', $actor->id)
            ->where('voice_room_id', $room->id)
            ->first();

        if ($vrUser) {
            $vrUser->last_ping_at = Carbon::now();
            $vrUser->save();
        }

        // Temizleme: 20 saniyeden uzun süredir ping atmayanları odadan düşür
        VoiceRoomUser::where('last_ping_at', '<', Carbon::now()->subSeconds(20))->delete();

        $room->load('users');

        return new JsonResponse([
            'data' => ResponseFormatter::formatVoiceRoom($room)
        ]);
    }
}

