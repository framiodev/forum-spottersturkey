<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Support\Arr;
use GuzzleHttp\Client;

class SearchMusicController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $query = Arr::get($request->getQueryParams(), 'q', '');
        if (empty($query)) {
            $query = 'Populer';
        }

        $client = new Client(['timeout' => 5.0]);
        $results = [];

        try {
            // iTunes Arama API (Hızlı, anahtarsız, 30 sn yüksek kaliteli preview sunar)
            $response = $client->get('https://itunes.apple.com/search', [
                'query' => [
                    'term' => $query,
                    'media' => 'music',
                    'entity' => 'song',
                    'country' => 'TR',
                    'limit' => 20
                ]
            ]);

            $data = json_decode($response->getBody()->getContents(), true);
            if (!empty($data['results'])) {
                foreach ($data['results'] as $track) {
                    if (empty($track['previewUrl'])) continue;

                    $cover = $track['artworkUrl100'] ?? '';
                    // 100x100 yerine 300x300 görsel alalım
                    $coverHigh = str_replace('100x100bb', '300x300bb', $cover);

                    $results[] = [
                        'id' => (string) $track['trackId'],
                        'title' => $track['trackName'],
                        'artist' => $track['artistName'],
                        'album' => $track['collectionName'] ?? '',
                        'cover_url' => $coverHigh ?: $cover,
                        'preview_url' => $track['previewUrl'],
                        'duration' => 30, // Standart önizleme süresi
                    ];
                }
            }
        } catch (\Throwable $e) {
            // Hata durumunda boş döndür
        }

        return new JsonResponse(['data' => $results]);
    }
}
