<?php

namespace Framio\UploadExif\Formatter;

use Illuminate\Database\ConnectionInterface;
use s9e\TextFormatter\Renderer;

/**
 * Mesaj HTML'e çevrilirken medya etiketlerine görselin gerçek en/boyunu ekler
 * (w, h). Şablon bunları <img width height> olarak yazar; tarayıcı görsel inmeden
 * önce doğru oranda yer ayırır ve sayfa kaydırılırken içerik zıplamaz.
 */
class AddImageDimensions
{
    /** @var array<int, array{0:int,1:int}|null> İstek boyunca önbellek */
    protected static array $cache = [];

    public function __construct(protected ConnectionInterface $db)
    {
    }

    public function __invoke(Renderer $renderer, $context, string $xml): string
    {
        if (!preg_match_all('/<(FRAMIO-IMAGE|SPOTTER-IMAGE|ULASIMARSIV-IMAGE|UPL-IMAGE-PREVIEW)\b[^>]*\bid="(\d+)"/', $xml, $m)) {
            return $xml;
        }

        $ids = array_values(array_diff(array_unique(array_map('intval', $m[2])), array_keys(self::$cache)));
        if ($ids) {
            foreach ($ids as $id) {
                self::$cache[$id] = null;
            }
            try {
                $rows = $this->db->table('framio_media_images')->whereIn('id', $ids)
                    ->get(['id', 'width', 'height', 'thumb_width', 'thumb_height']);
                foreach ($rows as $r) {
                    $w = (int) ($r->thumb_width ?: $r->width);
                    $h = (int) ($r->thumb_height ?: $r->height);
                    if ($w > 0 && $h > 0) {
                        self::$cache[(int) $r->id] = [$w, $h];
                    }
                }
            } catch (\Throwable $e) {
                // Tablo/sütun yoksa boyutsuz devam et
            }
        }

        return preg_replace_callback(
            '/<(FRAMIO-IMAGE|SPOTTER-IMAGE|ULASIMARSIV-IMAGE|UPL-IMAGE-PREVIEW)\b([^>]*)>/',
            function ($tag) {
                if (str_contains($tag[2], ' w="') || !preg_match('/\bid="(\d+)"/', $tag[2], $id)) {
                    return $tag[0];
                }
                $dim = self::$cache[(int) $id[1]] ?? null;
                if (!$dim) {
                    return $tag[0];
                }
                $selfClosing = str_ends_with($tag[2], '/');
                $attrs = rtrim($selfClosing ? substr($tag[2], 0, -1) : $tag[2]);

                return '<' . $tag[1] . $attrs . ' w="' . $dim[0] . '" h="' . $dim[1] . '"' . ($selfClosing ? '/' : '') . '>';
            },
            $xml
        );
    }
}
