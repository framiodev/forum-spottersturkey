<?php

use Illuminate\Database\Schema\Builder;

/**
 * Eklentinin önceki sürümlerindeki marka/model eşleştirmelerini ve şehir içi hat
 * listesini yeni tablolara (framio_media_taxonomies, framio_media_city_routes) aktarır.
 *
 * Eski kurulumlarda tablo adı siteye göre değişebiliyor (vehicle_taxonomy,
 * arsv_vehicle_taxonomy, city_routes, arsv_city_routes…); aday tablolardan en çok
 * kayıt içereni kaynak alınır. Hedef tablo boş değilse dokunulmaz, eski tablolar silinmez.
 */
return [
    'up' => function (Builder $schema) {
        $db = $schema->getConnection();

        $pick = function (array $candidates) use ($schema, $db): ?string {
            $best = null;
            $bestCount = 0;
            foreach ($candidates as $table) {
                if (!$schema->hasTable($table)) {
                    continue;
                }
                $count = $db->table($table)->count();
                if ($count > $bestCount) {
                    $best = $table;
                    $bestCount = $count;
                }
            }

            return $best;
        };

        $copy = function (string $from, string $to, callable $map) use ($db) {
            $db->table($from)->orderBy('id')->chunk(500, function ($rows) use ($db, $to, $map) {
                $insert = [];
                foreach ($rows as $row) {
                    $data = $map($row);
                    if ($data) {
                        $insert[] = $data;
                    }
                }
                if ($insert) {
                    $db->table($to)->insert($insert);
                }
            });
        };

        // Marka / model eşleştirmeleri (eski "type" alanı yeni "category" alanıdır)
        if ($schema->hasTable('framio_media_taxonomies') && $db->table('framio_media_taxonomies')->count() === 0) {
            $legacy = $pick(['vehicle_taxonomy', 'arsv_vehicle_taxonomy', 'arsvarsv_vehicle_taxonomy', 'spotter_vehicle_taxonomy', 'vehicle_taxonomies']);
            if ($legacy) {
                $copy($legacy, 'framio_media_taxonomies', function ($row) {
                    if (empty($row->brand) || empty($row->model)) {
                        return null;
                    }

                    return [
                        'brand' => $row->brand,
                        'model' => $row->model,
                        'category' => ($row->category ?? null) ?: (($row->type ?? null) ?: 'bus'),
                        'tag_slug' => $row->tag_slug ?? null,
                        'discussion_id' => $row->discussion_id ?? null,
                        'city' => $row->city ?? null,
                        'sort_order' => (int) ($row->sort_order ?? 0),
                        'created_at' => $row->created_at ?? null,
                        'updated_at' => $row->updated_at ?? null,
                    ];
                });
            }
        }

        // Şehir içi hat listesi
        if ($schema->hasTable('framio_media_city_routes') && $db->table('framio_media_city_routes')->count() === 0) {
            $legacy = $pick(['city_routes', 'arsv_city_routes', 'arsvarsv_city_routes', 'spotter_city_routes']);
            if ($legacy) {
                $copy($legacy, 'framio_media_city_routes', function ($row) {
                    if (empty($row->city) || ($row->route_code ?? '') === '') {
                        return null;
                    }

                    return [
                        'city' => $row->city,
                        'route_code' => $row->route_code,
                        'route_name' => (string) ($row->route_name ?? ''),
                        'created_at' => $row->created_at ?? null,
                        'updated_at' => $row->updated_at ?? null,
                    ];
                });
            }
        }
    },

    'down' => function (Builder $schema) {
        // Veri aktarımı; eski tablolar korunduğu için geri alınacak bir şey yok.
    },
];
