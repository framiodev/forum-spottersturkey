<?php

namespace Framio\NetworkCrosspost\Api\Controller;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Discussion\Event\Started;
use Flarum\Http\UrlGenerator;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Tags\Tag;
use Flarum\User\User;
use Framio\NetworkCrosspost\Services\WatermarkProcessor;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class InboundCrosspostController implements RequestHandlerInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected UrlGenerator $url,
        protected Dispatcher $events,
        protected ConnectionInterface $db
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        // 1. Secret Key Yetkilendirmesi
        $configuredSecret = trim((string) $this->settings->get('framio-network-crosspost.secret_key', ''));

        if (empty($configuredSecret)) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Bu sitede henüz bir Crosspost Güvenlik Anahtarı tanımlanmamış.'
            ], 500);
        }

        $headerSecret = $request->getHeaderLine('X-Crosspost-Secret');
        if (empty($headerSecret)) {
            $authHeader = $request->getHeaderLine('Authorization');
            if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
                $headerSecret = $matches[1];
            }
        }

        if (empty($headerSecret) || !hash_equals($configuredSecret, trim($headerSecret))) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Geçersiz veya eksik güvenlik anahtarı (Unauthorized).'
            ], 401);
        }

        // Görsel indirme, watermark ve Firebase yükleme işlemleri zaman alabileceğinden zaman aşımını genişlet
        @set_time_limit(600);
        // Gönderen taraf beklemeyi bıraksa bile işlem yarıda kalmasın
        @ignore_user_abort(true);

        $body = (array) $request->getParsedBody();

        // 2. Ping / Bağlantı Testi Kontrolü
        if (Arr::get($body, 'action') === 'ping') {
            $currentName = (string) $this->settings->get('framio-network-crosspost.current_platform_name', 'Flarum Forum');
            return new JsonResponse([
                'success' => true,
                'message' => 'Bağlantı başarılı! Uç nokta çalışıyor.',
                'platform' => $currentName
            ]);
        }

        // 3. Veri Doğrulama (Payload Validation)
        $source = Arr::get($body, 'source', []);
        $author = Arr::get($body, 'author', []);
        $content = Arr::get($body, 'content', []);

        $sourcePlatform = trim((string) Arr::get($source, 'platform', ''));
        $sourceUrl = trim((string) Arr::get($source, 'url', ''));
        $sourcePostUrl = trim((string) Arr::get($source, 'post_url', ''));
        $syncKey = trim((string) Arr::get($source, 'sync_key', ''));

        $authorName = trim((string) Arr::get($author, 'name', ''));
        $authorUsername = trim((string) Arr::get($author, 'username', ''));
        $authorAvatar = trim((string) Arr::get($author, 'avatar_url', ''));
        $authorProfileUrl = trim((string) Arr::get($author, 'profile_url', ''));

        $title = trim((string) Arr::get($content, 'title', ''));
        $bodyContent = trim((string) Arr::get($content, 'body', ''));
        $targetTagSlug = trim((string) Arr::get($body, 'target_tag_slug', ''));
        
        // Hedef tartışma belirleme (Mevcut konuya yanıt olarak mı yoksa yeni konu olarak mı?)
        $targetDiscussionId = (int) Arr::get($body, 'target_discussion_id', 0);
        $targetDiscussionUrlOrSlug = trim((string) Arr::get($body, 'target_discussion_url', ''));

        if (empty($bodyContent) || empty($sourcePlatform)) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Eksik veri: İçerik ve kaynak platform adı zorunludur.'
            ], 422);
        }

        // 4. Mükerrer Gönderi (Duplication) Kontrolü
        if (!empty($syncKey)) {
            $existingPost = CommentPost::where('crosspost_source_url', $sourcePostUrl ?: $sourceUrl)->first();
            if ($existingPost && $existingPost->discussion) {
                $postUrl = $this->url->to('forum')->route('discussion', [
                    'id' => $existingPost->discussion->slug ?: $existingPost->discussion->id,
                    'near' => $existingPost->number
                ]);
                return new JsonResponse([
                    'success' => true,
                    'duplicate' => true,
                    'message' => 'Bu mesaj daha önce bu foruma aktarılmış.',
                    'discussion_id' => $existingPost->discussion->id,
                    'post_id' => $existingPost->id,
                    'url' => $postUrl
                ], 200);
            }
        }

        // 5. Yazar Belirleme
        $targetUserId = (int) Arr::get($body, 'target_user_id', 0);
        $targetUsername = trim((string) Arr::get($body, 'target_username', ''));

        $user = null;
        if ($targetUserId > 0) {
            $user = User::find($targetUserId);
        }
        if (!$user && !empty($targetUsername)) {
            $user = User::where('username', $targetUsername)->first();
        }
        if (!$user && !empty($authorUsername)) {
            $user = User::where('username', $authorUsername)->first();
        }

        if (!$user) {
            $syncUserId = (int) $this->settings->get('framio-network-crosspost.sync_user_id', 1);
            $user = User::find($syncUserId) ?: User::first();
        }

        if (!$user) {
            return new JsonResponse([
                'success' => false,
                'error' => 'İçeriğin atanacağı geçerli bir forum kullanıcısı bulunamadı.'
            ], 500);
        }

        // 6. Görsel ve Medya URL Normalizasyonu
        if (!empty($sourceUrl)) {
            $cleanSourceUrl = rtrim($sourceUrl, '/');
            $bodyContent = preg_replace(
                '/\!\[(.*?)\]\(\/assets\/files\/(.*?)\)/i',
                '![$1](' . $cleanSourceUrl . '/assets/files/$2)',
                $bodyContent
            );
            $bodyContent = preg_replace(
                '/src=[\'"]\/assets\/files\/(.*?)[\'"]/i',
                'src="' . $cleanSourceUrl . '/assets/files/$1"',
                $bodyContent
            );
        }

        // 7. Gelişmiş Görsel & EXIF Eşleştirme / Senkronizasyonu & Filigran İşleme
        $attachments = (array) Arr::get($body, 'attachments', []);
        $watermarkConfig = (array) Arr::get($body, 'watermark', []);
        if (empty($watermarkConfig['username']) && $user) {
            $watermarkConfig['username'] = $user->username;
        }
        // Görsel tablosu: Upload & EXIF'in güncel tablosu (framio_media_images), yoksa eski spotter_images
        $imageTable = null;
        try {
            $schema = $this->db->getSchemaBuilder();
            foreach (['framio_media_images', 'spotter_images'] as $candidate) {
                if ($schema->hasTable($candidate)) {
                    $imageTable = $candidate;
                    break;
                }
            }
        } catch (\Throwable $e) {
        }
        $hasSpotterImagesTable = $imageTable !== null;

        // Yerel forumun BBCode etiketi: Upload & EXIF ayarı, yoksa eski eklenti sınıfından tahmin
        $localTagName = null;
        if ($hasSpotterImagesTable) {
            $localTagName = trim((string) $this->settings->get('framio-upload-exif.active_bbcode_tag', ''), " []");
            if ($localTagName === '') {
                $localTagName = class_exists(\UlasimArsiv\UploadExif\Database\SpotterImage::class) ? 'ulasimarsiv-image' : 'spotter-image';
            }
        }

        // Eğer alıcı sitede spotter_images tablosu varsa, gelen ekleri yerel DB'ye kaydet ve ID haritası oluştur
        $idMap = []; // [original_id => new_local_id]
        $urlMap = []; // [original_id => new_thumb_url]
        $wmProcessor = new WatermarkProcessor();

        if ($hasSpotterImagesTable && !empty($attachments)) {
            $tableColumns = [];
            try {
                $tableColumns = $this->db->getSchemaBuilder()->getColumnListing($imageTable);
            } catch (\Throwable $e) {
                $tableColumns = ['id', 'user_id', 'filename', 'path', 'thumb_path', 'exif_data', 'created_at', 'updated_at'];
            }

            foreach ($attachments as $att) {
                $origId = (int) Arr::get($att, 'original_id', 0);
                if ($origId <= 0) continue;

                // Seçilen imza moduna göre (hedef site imzası, imzasız, özel imza) görseli işle ve Firebase'e yükle
                $processedUrls = $wmProcessor->processAttachment($att, $watermarkConfig);

                $finalPath = $processedUrls ? $processedUrls['path'] : Arr::get($att, 'path', '');
                $finalThumbPath = $processedUrls ? $processedUrls['thumb_path'] : Arr::get($att, 'thumb_path', '');
                $finalOriginalPath = $processedUrls ? $processedUrls['original_path'] : Arr::get($att, 'original_path', null);

                if (!empty($finalThumbPath)) {
                    $urlMap[$origId] = $finalThumbPath;
                } elseif (!empty($finalPath)) {
                    $urlMap[$origId] = $finalPath;
                }

                $insertData = [];
                if (in_array('user_id', $tableColumns)) $insertData['user_id'] = $user->id;
                if (in_array('filename', $tableColumns)) $insertData['filename'] = Arr::get($att, 'filename', '');
                if (in_array('path', $tableColumns)) $insertData['path'] = $finalPath;
                if (in_array('thumb_path', $tableColumns)) $insertData['thumb_path'] = $finalThumbPath;
                if (in_array('original_path', $tableColumns)) $insertData['original_path'] = $finalOriginalPath;
                if (in_array('exif_data', $tableColumns)) $insertData['exif_data'] = Arr::get($att, 'exif_data', null);
                if (in_array('kunye', $tableColumns)) $insertData['kunye'] = Arr::get($att, 'kunye', null);
                if (in_array('music_data', $tableColumns)) $insertData['music_data'] = Arr::get($att, 'music_data', null);
                if (in_array('title', $tableColumns)) $insertData['title'] = Arr::get($att, 'title', null);
                if (in_array('description', $tableColumns)) $insertData['description'] = Arr::get($att, 'description', null);
                if (in_array('created_at', $tableColumns)) $insertData['created_at'] = Carbon::now();
                if (in_array('updated_at', $tableColumns)) $insertData['updated_at'] = Carbon::now();

                try {
                    $newId = $this->db->table($imageTable)->insertGetId($insertData);
                    $idMap[$origId] = $newId;
                } catch (\Throwable $e) {
                    // Kayıt oluşturulamazsa devam et
                }
            }
        }

        // Gönderen site görsel etiketlerini Markdown resmine (![alt](url)) çevirerek yollar:
        // adresi bir eke ait olanları yerel etikete / yeniden imzalanmış adrese çevir
        if (!empty($urlMap)) {
            $norm = fn ($u) => rawurldecode(trim((string) $u));
            $byUrl = [];
            foreach ($attachments as $att) {
                $origId = (int) Arr::get($att, 'original_id', 0);
                if ($origId <= 0 || !isset($urlMap[$origId])) continue;
                foreach (['path', 'thumb_path', 'original_path'] as $k) {
                    if ($u = Arr::get($att, $k)) $byUrl[$norm($u)] = $origId;
                }
            }

            $bodyContent = preg_replace_callback(
                '/!\[([^\]]*)\]\(([^)\s]+)\)/',
                function ($m) use ($byUrl, $norm, $idMap, $urlMap, $localTagName) {
                    $origId = $byUrl[$norm($m[2])] ?? null;
                    if (!$origId) return $m[0];

                    if ($localTagName && isset($idMap[$origId])) {
                        return '[' . $localTagName . ' id=' . $idMap[$origId] . ' url="' . $urlMap[$origId] . '" alt="' . str_replace('"', '&quot;', $m[1]) . '"]';
                    }

                    return '![' . $m[1] . '](' . str_replace([' ', '(', ')'], ['%20', '%28', '%29'], $urlMap[$origId]) . ')';
                },
                $bodyContent
            );
        }

        // İçerikteki [spotter-image] ve [ulasimarsiv-image] etiketlerini dönüştür
        $bodyContent = preg_replace_callback(
            '/\[(?:spotter-image|ulasimarsiv-image)[^\]]*\]/i',
            function ($matches) use ($hasSpotterImagesTable, $localTagName, $idMap, $urlMap) {
                $tag = $matches[0];
                $url = '';
                $alt = '';
                $id = 0;

                if (preg_match('/\bid=[\'"]?(\d+)[\'"]?/i', $tag, $m)) {
                    $id = (int) $m[1];
                }
                if (preg_match('/\burl=["\']([^"\']+)["\']/i', $tag, $m)) {
                    $url = $m[1];
                } elseif (preg_match('/\burl=([^\s\]]+)/i', $tag, $m)) {
                    $url = $m[1];
                }
                if (preg_match('/\balt="([^"]*)"/i', $tag, $m) || preg_match("/\\balt='([^']*)'/i", $tag, $m)) {
                    $alt = $m[1];
                }

                // Eğer yeniden filigranlandıysa yeni URL'yi kullan
                $targetUrl = isset($urlMap[$id]) ? $urlMap[$id] : $url;

                // Eğer hedef sitede EXIF tablosu varsa ve ID eşleştiyse yerel EXIF kartı etiketini üret
                if ($hasSpotterImagesTable && $localTagName && isset($idMap[$id])) {
                    $mappedId = $idMap[$id];
                    $safeAlt = str_replace('"', '&quot;', $alt);
                    return '[' . $localTagName . ' id=' . $mappedId . ' url="' . $targetUrl . '" alt="' . $safeAlt . '"]';
                }

                // Aksi takdirde (örneğin eklentisiz Flarum veya Ulaşım Info için) standart Markdown formatına çevir
                if (!empty($targetUrl)) {
                    $cleanUrl = str_replace([' ', '(', ')'], ['%20', '%28', '%29'], $targetUrl);
                    return '![' . $alt . '](' . $cleanUrl . ')';
                }

                return $tag;
            },
            $bodyContent
        );

        $bodyContent = preg_replace_callback(
            '/\[upl-image-preview[^\]]*\]/i',
            function ($matches) {
                $tag = $matches[0];
                $url = '';
                $alt = '';

                if (preg_match('/\burl=["\']([^"\']+)["\']/i', $tag, $m)) {
                    $url = $m[1];
                } elseif (preg_match('/\burl=([^\s\]]+)/i', $tag, $m)) {
                    $url = $m[1];
                }

                if (preg_match('/\balt=["\']([^"\']*)["\']/i', $tag, $m)) {
                    $alt = $m[1];
                }

                if (!empty($url)) {
                    $cleanUrl = str_replace([' ', '(', ')'], ['%20', '%28', '%29'], $url);
                    return '![' . $alt . '](' . $cleanUrl . ')';
                }

                return $tag;
            },
            $bodyContent
        );

        // 7. Mevcut Bir Konu Aranıyor mu?
        $discussion = null;
        if ($targetDiscussionId > 0) {
            $discussion = Discussion::find($targetDiscussionId);
        } elseif (!empty($targetDiscussionUrlOrSlug)) {
            // URL içinden slug veya ID çıkarma (örn: .../d/132-nostalji-otobusler veya sadece 132)
            if (preg_match('/\/d\/(\d+)(?:-([^\/\?#]+))?/i', $targetDiscussionUrlOrSlug, $matches)) {
                $discussion = Discussion::find((int) $matches[1]);
            } elseif (is_numeric($targetDiscussionUrlOrSlug)) {
                $discussion = Discussion::find((int) $targetDiscussionUrlOrSlug);
            } else {
                $discussion = Discussion::where('slug', $targetDiscussionUrlOrSlug)->first();
            }
        }

        $isNewDiscussion = false;

        if (!$discussion) {
            // Yeni Konu Başlat
            $isNewDiscussion = true;
            $finalTitle = !empty($title) ? $title : 'Aktarılan İçerik';

            $discussion = Discussion::start($finalTitle, $user);
            $discussion->comment_count = 1;
            $discussion->participant_count = 1;
            $discussion->last_posted_at = Carbon::now();
            $discussion->last_posted_user_id = $user->id;

            $discussion->crosspost_source_platform = $sourcePlatform;
            $discussion->crosspost_source_url = !empty($sourcePostUrl) ? $sourcePostUrl : $sourceUrl;
            $discussion->crosspost_source_author = !empty($authorName) ? $authorName : ($authorUsername ?: 'Misafir');
            $discussion->crosspost_source_author_url = $authorProfileUrl;
            $discussion->crosspost_source_author_avatar = $authorAvatar;
            $discussion->crosspost_sync_key = $syncKey;

            $discussion->save();

            // Etiket İlişkilendirmesi
            $tagToSync = null;
            if (!empty($targetTagSlug) && class_exists(Tag::class)) {
                $tagToSync = Tag::where('slug', $targetTagSlug)->first();
            }

            if (!$tagToSync && class_exists(Tag::class)) {
                $defaultTagId = (int) $this->settings->get('framio-network-crosspost.default_tag_id', 0);
                if ($defaultTagId > 0) {
                    $tagToSync = Tag::find($defaultTagId);
                }
            }

            if ($tagToSync) {
                $discussion->tags()->sync([$tagToSync->id]);
            }
        }

        // 8. Mesajı (Post) Oluşturma
        $lastPostNumber = (int) ($discussion->last_post_number ?: $discussion->posts()->max('number') ?: 0);
        $postNumber = $isNewDiscussion ? 1 : ($lastPostNumber + 1);

        $post = new CommentPost();
        $post->discussion_id = $discussion->id;
        $post->user_id = $user->id;
        $post->created_at = Carbon::now();
        $post->number = $postNumber;
        $post->setContentAttribute($bodyContent, $user);

        $post->crosspost_source_platform = $sourcePlatform;
        $post->crosspost_source_url = !empty($sourcePostUrl) ? $sourcePostUrl : $sourceUrl;
        $post->crosspost_source_author = !empty($authorName) ? $authorName : ($authorUsername ?: 'Misafir');

        $post->save();

        if ($isNewDiscussion) {
            $discussion->setFirstPost($post);
            $discussion->setLastPost($post);
            $discussion->last_post_number = 1;
            $discussion->save();
        } else {
            $discussion->setLastPost($post);
            $discussion->last_post_number = $postNumber;
            $discussion->comment_count = $discussion->posts()->where('type', 'comment')->count();
            $discussion->participant_count = $discussion->posts()->select('user_id')->distinct()->count('user_id');
            $discussion->last_posted_at = Carbon::now();
            $discussion->last_posted_user_id = $user->id;
            $discussion->save();
        }

        // 9. Flarum Olaylarını Tetikleme
        try {
            if ($isNewDiscussion) {
                $this->events->dispatch(new Started($discussion, $user));
            }
            $this->events->dispatch(new Posted($post, $user));
        } catch (\Throwable $e) {
            // Kuyruk veya bildirim hataları ana akışı kesmesin
        }

        $resultUrl = $this->url->to('forum')->route('discussion', [
            'id' => $discussion->slug ?: $discussion->id,
            'near' => $post->number
        ]);

        return new JsonResponse([
            'success' => true,
            'message' => $isNewDiscussion ? 'İçerik yeni bir konu olarak başarıyla açıldı.' : 'Mesaj mevcut konunun altına başarıyla eklendi.',
            'discussion_id' => $discussion->id,
            'post_id' => $post->id,
            'is_new_discussion' => $isNewDiscussion,
            'url' => $resultUrl
        ], 201);
    }
}
