<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\VoiceRoom;
use Framio\DirectMessenger\VoiceRoomUser;
use Framio\DirectMessenger\VoiceSignal;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;
use Carbon\Carbon;
use Throwable;

class SignalVoiceRoomController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        try {
            $actor = RequestUtil::getActor($request);
            $actor->assertRegistered();

            $roomId = Arr::get($request->getQueryParams(), 'id') ?: $request->getAttribute('id');
            $room = VoiceRoom::find($roomId);

            if (!$room) {
                return new JsonResponse(['error' => 'Room not found'], 404);
            }

            // Update sender's ping
            VoiceRoomUser::where('user_id', $actor->id)
                ->where('voice_room_id', $room->id)
                ->update(['last_ping_at' => Carbon::now()]);

            // Clean inactive users (> 20 sec)
            VoiceRoomUser::where('last_ping_at', '<', Carbon::now()->subSeconds(20))->delete();

            // Clean signals older than 60 seconds
            VoiceSignal::where('created_at', '<', Carbon::now()->subSeconds(60))->delete();

            $method = $request->getMethod();

            // If POST with body, insert outgoing signals
            if ($method === 'POST') {
                $parsedBody = (array) $request->getParsedBody();
                $signals = Arr::get($parsedBody, 'signals', []);

                if (!empty($signals) && is_array($signals)) {
                    foreach ($signals as $sig) {
                        $targetId = Arr::get($sig, 'target_id');
                        $type = Arr::get($sig, 'type');
                        $data = Arr::get($sig, 'data');

                        if ($targetId && $type && $data) {
                            VoiceSignal::create([
                                'room_id' => $room->id,
                                'sender_id' => $actor->id,
                                'target_id' => (int) $targetId,
                                'type' => (string) $type,
                                'data' => is_string($data) ? $data : json_encode($data),
                                'created_at' => Carbon::now(),
                            ]);
                        }
                    }
                }
            }

            // Fetch pending incoming signals for this actor in this room
            $incomingRows = VoiceSignal::where('room_id', $room->id)
                ->where('target_id', $actor->id)
                ->orderBy('id', 'asc')
                ->get();

            $incomingSignals = [];
            $idsToDelete = [];

            foreach ($incomingRows as $row) {
                $idsToDelete[] = $row->id;
                $incomingSignals[] = [
                    'id' => $row->id,
                    'sender_id' => (string) $row->sender_id,
                    'type' => $row->type,
                    'data' => json_decode($row->data, true) ?: $row->data,
                ];
            }

            // Delete processed signals so they aren't delivered twice
            if (!empty($idsToDelete)) {
                VoiceSignal::whereIn('id', $idsToDelete)->delete();
            }

            $room->load('users');

            return new JsonResponse([
                'room' => ResponseFormatter::formatVoiceRoom($room),
                'signals' => $incomingSignals,
            ]);
        } catch (Throwable $e) {
            return new JsonResponse([
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ], 500);
        }
    }
}
