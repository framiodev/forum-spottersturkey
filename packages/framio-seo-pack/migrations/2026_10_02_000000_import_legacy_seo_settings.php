<?php

use Illuminate\Database\Schema\Builder;

/**
 * Eklentinin önceki, siteye özel önekli sürümlerinden kalan ayarları
 * ("<herhangi>-seo.<anahtar>") ortak "framio-seo." önekine taşır.
 * Yalnızca framio-seo tarafında boş olan anahtarları doldurur; mevcut
 * değerlerin üzerine yazmaz ve eski kayıtları silmez.
 */
return [
    'up' => function (Builder $schema) {
        $db = $schema->getConnection();
        $table = 'settings';

        // Eski sürümlerde farklı adla tutulan anahtarlar
        $aliases = [
            'title_formula' => 'title_format',
            'recognized_tags' => 'recognized_bbcode_tags',
            'social_x' => 'social_twitter',
        ];

        $existing = $db->table($table)
            ->where('key', 'like', 'framio-seo.%')
            ->pluck('value', 'key')
            ->filter(fn ($v) => $v !== null && $v !== '')
            ->all();

        $legacy = $db->table($table)
            ->where('key', 'like', '%-seo.%')
            ->where('key', 'not like', 'framio-seo.%')
            ->get(['key', 'value']);

        foreach ($legacy as $row) {
            if ($row->value === null || $row->value === '') {
                continue;
            }

            $suffix = substr($row->key, strpos($row->key, '-seo.') + 5);
            $suffix = $aliases[$suffix] ?? $suffix;
            $target = 'framio-seo.' . $suffix;

            if (isset($existing[$target])) {
                continue;
            }

            $db->table($table)->updateOrInsert(['key' => $target], ['value' => $row->value]);
            $existing[$target] = $row->value;
        }

        // Marka/model kuralları eski Upload & EXIF önekinde kalmış olabilir
        $brandTarget = 'framio-upload-exif.brand_models';
        if (!$db->table($table)->where('key', $brandTarget)->whereNotNull('value')->where('value', '!=', '')->exists()) {
            $old = $db->table($table)
                ->where('key', 'like', '%-upload-exif.brand_models')
                ->whereNotNull('value')->where('value', '!=', '')
                ->value('value');
            if ($old) {
                $db->table($table)->updateOrInsert(['key' => $brandTarget], ['value' => $old]);
            }
        }

        // Eski sürüm spotter_images tablosunu kullanıyorsa ve yeni tablo boşsa, onu seç
        if (!isset($existing['framio-seo.media_table'])) {
            $newHasRows = $schema->hasTable('framio_media_images') && $db->table('framio_media_images')->exists();
            if (!$newHasRows && $schema->hasTable('spotter_images')) {
                $db->table($table)->updateOrInsert(['key' => 'framio-seo.media_table'], ['value' => 'spotter_images']);
            }
        }
    },

    'down' => function (Builder $schema) {
        // Veri taşıma; geri alınacak bir şema değişikliği yok.
    },
];
