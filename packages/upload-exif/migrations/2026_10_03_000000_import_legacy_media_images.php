<?php

use Illuminate\Database\Schema\Builder;

/**
 * Eklentinin önceki sürümlerinin kullandığı görsel tablosundaki kayıtları
 * aynı kimlik numaralarıyla framio_media_images tablosuna aktarır.
 * Mesajlardaki medya etiketleri görsele id ile bağlandığı için id'ler korunur.
 * Yalnızca yeni tabloda bulunmayan kayıtlar eklenir; eski tablo silinmez.
 */
return [
    'up' => function (Builder $schema) {
        $db = $schema->getConnection();
        $target = 'framio_media_images';

        if (!$schema->hasTable($target)) {
            return;
        }

        foreach (['spotter_images'] as $legacy) {
            if (!$schema->hasTable($legacy)) {
                continue;
            }

            $columns = array_values(array_intersect(
                $schema->getColumnListing($legacy),
                $schema->getColumnListing($target)
            ));

            $db->table($legacy)->orderBy('id')->chunk(500, function ($rows) use ($db, $target, $columns) {
                $existing = $db->table($target)->whereIn('id', $rows->pluck('id'))->pluck('id')->all();
                $userIds = $db->table('users')->whereIn('id', $rows->pluck('user_id')->filter())->pluck('id')->all();

                $insert = [];
                foreach ($rows as $row) {
                    if (in_array($row->id, $existing)) {
                        continue;
                    }
                    $data = [];
                    foreach ($columns as $col) {
                        $data[$col] = $row->$col;
                    }
                    // Silinmiş kullanıcıya bağlı kayıt yabancı anahtarı bozmasın
                    if (!empty($data['user_id']) && !in_array($data['user_id'], $userIds)) {
                        $data['user_id'] = null;
                    }
                    if (empty($data['filename'])) {
                        $data['filename'] = basename((string) parse_url((string) ($row->path ?? ''), PHP_URL_PATH)) ?: ('image-' . $row->id);
                    }
                    $insert[] = $data;
                }

                if ($insert) {
                    $db->table($target)->insert($insert);
                }
            });
        }
    },

    'down' => function (Builder $schema) {
        // Veri aktarımı; eski tablo korunduğu için geri alınacak bir şey yok.
    },
];
