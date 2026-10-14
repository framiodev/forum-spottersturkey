<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\VoiceRoom;
use Framio\DirectMessenger\VoiceRoomUser;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;
use Carbon\Carbon;

class JoinVoiceRoomController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $roomId = Arr::get($request->getQueryParams(), 'id');
        $room = VoiceRoom::findOrFail($roomId);

        // Odadan kullanıcının önceki kayıtlarını temizle
        VoiceRoomUser::where('user_id', $actor->id)->delete();

        // Yeni odaya ekle
        VoiceRoomUser::create([
            'voice_room_id' => $room->id,
            'user_id' => $actor->id,
            'last_ping_at' => Carbon::now()
        ]);

        $room->load('users');

        return new JsonResponse([
            'data' => ResponseFormatter::formatVoiceRoom($room)
        ]);
    }
}

