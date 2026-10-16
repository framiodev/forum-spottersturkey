<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\UploadExif\Ai\VisionAnalyzer;
use Framio\UploadExif\Ai\VisionSimilarity;
use GuzzleHttp\Client;
use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Admin: Framio AI sağlayıcılarını ayrı ayrı dener ve görsel benzerlik dizininin durumunu verir.
 * Anahtarlar yanıtta yer almaz.
 */
class AiTestController implements RequestHandlerInterface
{
    public function __construct(
        protected VisionAnalyzer $vision,
        protected VisionSimilarity $similarity,
        protected ConnectionInterface $db
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        // Yalnızca sitenin sağlayıcıları (kişisel anahtarlar hariç)
        $candidates = array_values(array_filter($this->vision->candidates(null), fn ($c) => $c['source'] === 'site'));

        // Örnek görsel: forumdaki son fotoğraf
        $bytes = null;
        $url = $this->db->table('framio_media_images')->whereNotNull('thumb_path')->orderByDesc('id')->value('thumb_path');
        if ($url) {
            try {
                $bytes = (string) (new Client(['timeout' => 8]))->get($url)->getBody();
            } catch (\Throwable $e) {
            }
        }
        if (!$bytes) {
            $img = imagecreatetruecolor(320, 200);
            ob_start();
            imagejpeg($img);
            $bytes = ob_get_clean();
        }

        $index = null;
        if ($this->db->getSchemaBuilder()->hasTable(VisionSimilarity::TABLE)) {
            $index = [
                'available' => $this->similarity->available(),
                'indexed' => $this->db->table(VisionSimilarity::TABLE)->whereNotNull('vec')->count(),
                'failed' => $this->db->table(VisionSimilarity::TABLE)->whereNull('vec')->count(),
                'last_error' => $this->db->table(VisionSimilarity::TABLE)->whereNotNull('error')->orderByDesc('id')->value('error'),
            ];
        }

        return new JsonResponse([
            'providers' => $candidates ? $this->vision->test($candidates, $bytes) : [],
            'similarity' => $index,
        ]);
    }
}
