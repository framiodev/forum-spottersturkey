<?php

namespace Framio\UploadExif\Console;

use Flarum\Console\AbstractCommand;
use Illuminate\Database\ConnectionInterface;
use Symfony\Component\Console\Input\InputOption;

/**
 * Boyutu kayıtlı olmayan görsellerin genişlik/yüksekliğini görsel
 * sunucusundan okuyup doldurur (bir kerelik; yeni yüklemelerde otomatik).
 */
class FillDimensionsCommand extends AbstractCommand
{
    public function __construct(protected ConnectionInterface $db)
    {
        parent::__construct();
    }

    protected function configure()
    {
        $this->setName('media:fill-dimensions')
            ->setDescription('Boyutu bilinmeyen görsellerin genişlik ve yüksekliğini doldurur.')
            ->addOption('limit', null, InputOption::VALUE_REQUIRED, 'En fazla kaç görsel işlensin', 5000);
    }

    protected function fire(): int
    {
        $limit = (int) $this->input->getOption('limit');
        $rows = $this->db->table('framio_media_images')->whereNull('width')->orderBy('id')->limit($limit)->get(['id', 'path', 'thumb_path']);
        $this->info(count($rows) . ' görsel işlenecek...');

        $ok = 0;
        $fail = 0;
        $context = stream_context_create(['http' => ['timeout' => 15, 'user_agent' => 'Mozilla/5.0 (Flarum media dimensions)']]);

        foreach ($rows as $i => $row) {
            $main = $this->size($row->path, $context);
            $thumb = $row->thumb_path && $row->thumb_path !== $row->path ? $this->size($row->thumb_path, $context) : $main;

            if ($main) {
                $this->db->table('framio_media_images')->where('id', $row->id)->update([
                    'width' => $main[0],
                    'height' => $main[1],
                    'thumb_width' => $thumb[0] ?? null,
                    'thumb_height' => $thumb[1] ?? null,
                ]);
                $ok++;
            } else {
                $fail++;
            }

            if (($i + 1) % 50 === 0) {
                $this->info(($i + 1) . " işlendi ({$ok} başarılı, {$fail} okunamadı)");
            }
        }

        $this->info("Tamamlandı: {$ok} başarılı, {$fail} okunamadı.");

        return 0;
    }

    /**
     * Boyut bilgisi dosyanın başındadır: önce yalnızca ilk 64 KB istenir
     * (HTTP Range); okunamazsa dosyanın tamamı indirilir.
     *
     * @return array{0:int,1:int}|null
     */
    private function size(?string $url, $context): ?array
    {
        if (!$url) {
            return null;
        }
        // Eski kayıtlarda alan adı olmayan göreli yol: forumun kendi adresine göre çöz
        if (!preg_match('#^https?://#i', $url)) {
            $url = rtrim(resolve(\Flarum\Http\UrlGenerator::class)->to('forum')->base(), '/') . '/' . ltrim($url, '/');
        }
        // Dosya adlarında boşluk olabilir
        $url = str_replace(' ', '%20', $url);

        foreach ([65535, 524287, null] as $bytes) {
            $data = $this->fetch($url, $bytes);
            if ($data !== null && ($info = @getimagesizefromstring($data))) {
                return [(int) $info[0], (int) $info[1]];
            }
        }

        return null;
    }

    private function fetch(string $url, ?int $lastByte): ?string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Flarum media dimensions)',
        ]);
        if ($lastByte !== null) {
            curl_setopt($ch, CURLOPT_RANGE, '0-' . $lastByte);
        }
        $data = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return ($data !== false && in_array($status, [200, 206], true)) ? $data : null;
    }
}
