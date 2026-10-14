<?php

namespace Framio\Profiles\UserMap\Listeners;

use Flarum\User\Event\Saving;
use Illuminate\Support\Arr;

class SaveLocationToDatabase
{
    public function handle(Saving $event): void
    {
        $user = $event->user;
        $data = $event->data;
        $actor = $event->actor;

        $attributes = Arr::get($data, 'attributes', []);

        if (array_key_exists('location', $attributes)) {
            if ($actor->id !== $user->id) {
                $actor->assertCan('edit', $user);
            }

            $city = trim((string) $attributes['location']);
            $user->location = $city !== '' ? $city : null;

            if ($city !== '') {
                $coords = $this->geocode($city);
                if ($coords) {
                    $user->map_lat = $coords['lat'];
                    $user->map_lon = $coords['lon'];
                }
            } else {
                $user->map_lat = null;
                $user->map_lon = null;
            }
        }
    }

    private function geocode(string $city): ?array
    {
        $url = 'https://nominatim.openstreetmap.org/search?q=' . urlencode($city) . '&format=json&limit=1';
        $ctx = stream_context_create([
            'http' => [
                'header'  => "User-Agent: UlasimArsiv-Flarum/2.0\r\n",
                'timeout' => 5,
            ]
        ]);

        try {
            $response = @file_get_contents($url, false, $ctx);
            if ($response === false) {
                return null;
            }
            $data = json_decode($response, true);
            if (!empty($data[0]['lat']) && !empty($data[0]['lon'])) {
                return [
                    'lat' => (float) $data[0]['lat'],
                    'lon' => (float) $data[0]['lon']
                ];
            }
        } catch (\Throwable) {
            return null;
        }

        return null;
    }
}
