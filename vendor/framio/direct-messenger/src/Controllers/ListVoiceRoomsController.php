<?php

namespace Framio\DirectMessenger\Controllers;

use Framio\DirectMessenger\VoiceRoom;
use Framio\DirectMessenger\VoiceRoomUser;
use Framio\DirectMessenger\TextChannel;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Carbon\Carbon;

class ListVoiceRoomsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        // Temizleme: 20 saniyeden uzun süredir ping atmayanları odadan düşür
        VoiceRoomUser::where('last_ping_at', '<', Carbon::now()->subSeconds(20))->delete();

        // Aktif metin kanalları için sesli oda oluştur / senkronize et
        $textChannels = TextChannel::where('is_active', true)->get();
        foreach ($textChannels as $tc) {
            VoiceRoom::firstOrCreate(
                ['channel_id' => $tc->id],
                [
                    'name' => $tc->name,
                    'icon' => $tc->icon ?: 'fas fa-hashtag',
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now()
                ]
            );
        }

        // Ana kategoriler / ana etiketler için sesli odaları senkronize et (parent_id is null)
        $tagId = \Illuminate\Support\Arr::get($request->getQueryParams(), 'tag_id');
        $tagSlug = \Illuminate\Support\Arr::get($request->getQueryParams(), 'tag_slug');

        // Flarum Tags modeli üzerinden ana etiketleri çek
        if (class_exists('Flarum\Tags\Tag')) {
            $mainTags = \Flarum\Tags\Tag::whereNull('parent_id')->get();
            foreach ($mainTags as $mt) {
                VoiceRoom::firstOrCreate(
                    ['tag_id' => $mt->id],
                    [
                        'name' => $mt->name,
                        'icon' => $mt->icon ?: 'fas fa-folder',
                        'created_at' => Carbon::now(),
                        'updated_at' => Carbon::now()
                    ]
                );
            }

            if (!$tagId && $tagSlug) {
                $targetTag = \Flarum\Tags\Tag::where('slug', $tagSlug)->first();
                if ($targetTag) {
                    $tagId = $targetTag->parent_id ? $targetTag->parent_id : $targetTag->id;
                }
            }
        }

        $query = VoiceRoom::with('users');

        if ($tagId) {
            // Eğer bir ana kategori / etiket sayfasındaysak:
            // Genel odaları, metin kanalı odalarını ve özellikle BU ana kategorinin odasını getir
            $query->where(function ($q) use ($tagId) {
                $q->whereNull('tag_id')
                  ->orWhere('tag_id', $tagId);
            });
        } else {
            // Ana listede: Genel odalar, metin kanalı odaları ve tüm ana kategori odaları veya aktif kullanıcı olanlar
            // Ana kategori odaları ana konuları temsil ettiği için minimal biçimde listede görünür
            $query->where(function ($q) {
                $q->whereNull('discussion_id');
            });
        }

        $rooms = $query->orderByRaw('channel_id IS NOT NULL, tag_id IS NOT NULL, id ASC')->get();

        $data = $rooms->map(fn($room) => ResponseFormatter::formatVoiceRoom($room))->values()->toArray();

        return new JsonResponse(['data' => $data]);
    }
}

