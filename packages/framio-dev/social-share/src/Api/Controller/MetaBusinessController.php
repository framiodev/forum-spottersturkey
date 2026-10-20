<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Framio\SocialShare\Services\MetaService;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;

class MetaBusinessController implements RequestHandlerInterface
{
    protected $metaService;
    protected $logger;
    protected $settings;

    public function __construct(MetaService $metaService, LoggerInterface $logger, SettingsRepositoryInterface $settings)
    {
        $this->metaService = $metaService;
        $this->logger = $logger;
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        $params = $request->getQueryParams();
        $body = $request->getParsedBody() ?? [];

        $action = $params['action'] ?? $body['action'] ?? 'insights';

        // Hikaye Yayınlama/Zamanlama için Yetki Kontrolü (Admin, Grup İzni veya Özel Kullanıcı)
        if (in_array($action, ['post_story', 'fb_post_story'], true)) {
            $allowedPublishStr = $this->settings->get('framio-social-share.allowed_story_publish_users', '') . ',' . $this->settings->get('framio-social-share.allowed_story_users', '');
            $allowedPublishUsers = array_filter(array_map(function($val) {
                return strtolower(trim($val));
            }, explode(',', $allowedPublishStr)));

            $currentUsername = strtolower($actor->username ?? '');
            $currentId = (string)$actor->id;

            $isSpecificAllowed = in_array($currentUsername, $allowedPublishUsers, true) || in_array($currentId, $allowedPublishUsers, true);

            if (!$actor->isAdmin() && !$actor->hasPermission('framio-social-share.publish-stories') && !$isSpecificAllowed) {
                $actor->assertPermission('framio-social-share.publish-stories');
            }
        } else {
            // Diğer tüm Business Suite aksiyonları için Admin zorunlu
            $actor->assertAdmin();
        }

        $igId = $params['ig_id'] ?? $body['ig_id'] ?? null;
        $pageId = $params['page_id'] ?? $body['page_id'] ?? null;
        $threadsId = $params['threads_id'] ?? $body['threads_id'] ?? null;
        $threadsToken = $params['threads_token'] ?? $body['threads_token'] ?? null;
        $token = $params['token'] ?? $body['token'] ?? null;

        // Forumdan gelen isteklerde jeton yok; kimliğe göre ayarlardan bulunur.
        // Admin dışı kullanıcıların gönderdiği jetonlar dikkate alınmaz.
        if (!$actor->isAdmin()) {
            $token = null;
            $threadsToken = null;
        }
        if (!$token || !$threadsToken) {
            $account = \Framio\SocialShare\Services\AccountTokens::find($this->settings, $pageId, $igId, $threadsId);
            if ($account) {
                $token = $token ?: ($account['token'] ?? null);
                $threadsToken = $threadsToken ?: ($account['threads_token'] ?? null);
            }
        }

        if (!$token && !$threadsToken) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Erişim Jetonu (Token) eksik.'
            ], 400);
        }

        try {
            switch ($action) {
                // 1. Profil ve Genel İstatistikler (Instagram)
                case 'profile':
                    if (!$igId) return new JsonResponse(['success' => false, 'error' => 'Instagram Hesap ID eksik.'], 400);
                    $profile = $this->metaService->getInstagramProfile($igId, $token);
                    return new JsonResponse(['success' => true, 'data' => $profile]);

                // 2. Grafikler & Metrikler (Instagram Insights)
                case 'insights':
                    if (!$igId) return new JsonResponse(['success' => false, 'error' => 'Instagram Hesap ID eksik.'], 400);
                    $period = $params['period'] ?? 'day';
                    $insights = $this->metaService->getInstagramInsights($igId, $token, $period);
                    $profile = $this->metaService->getInstagramProfile($igId, $token);
                    return new JsonResponse([
                        'success' => true,
                        'profile' => $profile,
                        'insights' => $insights
                    ]);

                // 3. Son Gönderiler (Instagram Media listesi)
                case 'media_list':
                    if (!$igId) return new JsonResponse(['success' => false, 'error' => 'Instagram Hesap ID eksik.'], 400);
                    $limit = isset($params['limit']) ? (int)$params['limit'] : 15;
                    $media = $this->metaService->getInstagramMediaList($igId, $token, $limit);
                    return new JsonResponse(['success' => true, 'data' => $media]);

                // 4. Gönderi Yorumları (Instagram)
                case 'comments':
                    $mediaId = $params['media_id'] ?? $body['media_id'] ?? null;
                    if (!$mediaId) {
                        return new JsonResponse(['success' => false, 'error' => 'Media ID eksik.'], 400);
                    }
                    $comments = $this->metaService->getMediaComments($mediaId, $token);
                    return new JsonResponse(['success' => true, 'data' => $comments]);

                // 5. Yoruma Yanıt Ver (Instagram)
                case 'reply_comment':
                    $commentId = $body['comment_id'] ?? null;
                    $message = $body['message'] ?? '';
                    if (!$commentId || empty($message)) {
                        return new JsonResponse(['success' => false, 'error' => 'Yorum ID veya yanıt metni boş olamaz.'], 400);
                    }
                    $res = $this->metaService->replyToComment($commentId, $message, $token);
                    return new JsonResponse(['success' => true, 'data' => $res]);

                // 6. Yorumu Sil veya Gizle (Instagram)
                case 'moderate_comment':
                    $commentId = $body['comment_id'] ?? null;
                    $hide = !empty($body['hide']);
                    if (!$commentId) {
                        return new JsonResponse(['success' => false, 'error' => 'Yorum ID eksik.'], 400);
                    }
                    $res = $this->metaService->deleteOrHideComment($commentId, $token, $hide);
                    return new JsonResponse(['success' => true, 'data' => $res]);

                // 7. Doğrudan Instagram Hikaye Yayınlama / Zamanlama
                case 'post_story':
                    if (!$igId) return new JsonResponse(['success' => false, 'error' => 'Instagram Hesap ID eksik.'], 400);
                    $imageUrl = $body['image_url'] ?? null;
                    if (!$imageUrl) {
                        return new JsonResponse(['success' => false, 'error' => 'Hikaye görsel URL\'i eksik.'], 400);
                    }

                    $scheduledAt = $body['scheduled_at'] ?? null;
                    if ($scheduledAt) {
                        $queueId = $this->metaService->queueStory($actor->id, $igId, $imageUrl, $token, $scheduledAt);
                        return new JsonResponse(['success' => true, 'scheduled' => true, 'queue_id' => $queueId]);
                    }

                    $res = $this->metaService->postStoryToInstagram($igId, $imageUrl, $token);
                    return new JsonResponse(['success' => true, 'data' => $res]);

                // 8. Gelen Mesajlar (Instagram DM / Conversations)
                case 'conversations':
                    if (!$igId) return new JsonResponse(['success' => false, 'error' => 'Instagram Hesap ID eksik.'], 400);
                    $limit = isset($params['limit']) ? (int)$params['limit'] : 20;
                    $convs = $this->metaService->getInstagramConversations($igId, $token, $limit);
                    return new JsonResponse(['success' => true, 'data' => $convs]);

                // 9. Sohbet Mesaj Detayları (Instagram)
                case 'conversation_messages':
                    $convId = $params['conversation_id'] ?? $body['conversation_id'] ?? null;
                    if (!$convId) {
                        return new JsonResponse(['success' => false, 'error' => 'Conversation ID eksik.'], 400);
                    }
                    $messages = $this->metaService->getConversationMessages($convId, $token);
                    return new JsonResponse(['success' => true, 'data' => $messages]);

                // --- FACEBOOK SAYFA YÖNETİMİ ---
                // 10. Facebook Sayfa Profili
                case 'fb_profile':
                    if (!$pageId) return new JsonResponse(['success' => false, 'error' => 'Facebook Sayfa ID eksik.'], 400);
                    $profile = $this->metaService->getFacebookPageProfile($pageId, $token);
                    return new JsonResponse(['success' => true, 'data' => $profile]);

                // 11. Facebook Sayfa Insights & Genel Durum
                case 'fb_insights':
                    if (!$pageId) return new JsonResponse(['success' => false, 'error' => 'Facebook Sayfa ID eksik.'], 400);
                    $period = $params['period'] ?? 'day';
                    $insights = $this->metaService->getFacebookPageInsights($pageId, $token, $period);
                    $profile = $this->metaService->getFacebookPageProfile($pageId, $token);
                    return new JsonResponse([
                        'success' => true,
                        'profile' => $profile,
                        'insights' => $insights
                    ]);

                // 12. Facebook Sayfa Gönderileri (Feed)
                case 'fb_feed':
                    if (!$pageId) return new JsonResponse(['success' => false, 'error' => 'Facebook Sayfa ID eksik.'], 400);
                    $limit = isset($params['limit']) ? (int)$params['limit'] : 15;
                    $feed = $this->metaService->getFacebookPageFeed($pageId, $token, $limit);
                    return new JsonResponse(['success' => true, 'data' => $feed]);

                // 13. Facebook Sayfa Mesajları (Messenger)
                case 'fb_conversations':
                    if (!$pageId) return new JsonResponse(['success' => false, 'error' => 'Facebook Sayfa ID eksik.'], 400);
                    $limit = isset($params['limit']) ? (int)$params['limit'] : 20;
                    $convs = $this->metaService->getFacebookPageConversations($pageId, $token, $limit);
                    return new JsonResponse(['success' => true, 'data' => $convs]);

                // 14. Facebook Messenger Sohbet Mesaj Detayları
                case 'fb_conversation_messages':
                    $convId = $params['conversation_id'] ?? $body['conversation_id'] ?? null;
                    if (!$convId) {
                        return new JsonResponse(['success' => false, 'error' => 'Conversation ID eksik.'], 400);
                    }
                    $messages = $this->metaService->getFacebookConversationMessages($convId, $token);
                    return new JsonResponse(['success' => true, 'data' => $messages]);

                // 15. Facebook Gönderi Yorumları
                case 'fb_comments':
                    $postId = $params['post_id'] ?? $body['post_id'] ?? null;
                    if (!$postId) {
                        return new JsonResponse(['success' => false, 'error' => 'Post ID eksik.'], 400);
                    }
                    $comments = $this->metaService->getFacebookPostComments($postId, $token);
                    return new JsonResponse(['success' => true, 'data' => $comments]);

                // 16. Facebook Gönderi Yorumuna Yanıt Ver
                case 'fb_reply_comment':
                    $commentId = $body['comment_id'] ?? null;
                    $message = $body['message'] ?? '';
                    if (!$commentId || empty($message)) {
                        return new JsonResponse(['success' => false, 'error' => 'Yorum ID veya yanıt metni boş olamaz.'], 400);
                    }
                    $res = $this->metaService->replyToFacebookComment($commentId, $message, $token);
                    return new JsonResponse(['success' => true, 'data' => $res]);

                // 17. Facebook Yorumunu Sil veya Gizle
                case 'fb_moderate_comment':
                    $commentId = $body['comment_id'] ?? null;
                    $hide = !empty($body['hide']);
                    if (!$commentId) {
                        return new JsonResponse(['success' => false, 'error' => 'Yorum ID eksik.'], 400);
                    }
                    $res = $this->metaService->deleteOrHideFacebookComment($commentId, $token, $hide);
                    return new JsonResponse(['success' => true, 'data' => $res]);

                // 18. Facebook Hikaye Yayınla & Zamanla
                case 'fb_post_story':
                    if (!$pageId) return new JsonResponse(['success' => false, 'error' => 'Facebook Sayfa ID eksik.'], 400);
                    $imageUrl = $body['image_url'] ?? null;
                    if (!$imageUrl) {
                        return new JsonResponse(['success' => false, 'error' => 'Hikaye görsel URL\'i eksik.'], 400);
                    }

                    $scheduledAt = $body['scheduled_at'] ?? null;
                    if ($scheduledAt) {
                        $queueId = $this->metaService->queueStory($actor->id, $pageId, $imageUrl, $token, $scheduledAt, 'facebook_story');
                        return new JsonResponse(['success' => true, 'scheduled' => true, 'queue_id' => $queueId]);
                    }

                    $res = $this->metaService->postStoryToFacebook($pageId, $imageUrl, $token);
                    return new JsonResponse(['success' => true, 'data' => $res]);

                // --- THREADS YÖNETİMİ ---
                // 19. Threads Hesap Profili
                case 'threads_profile':
                    if (!$threadsId) return new JsonResponse(['success' => false, 'error' => 'Threads Hesap ID eksik.'], 400);
                    $effectiveThreadsToken = $threadsToken ?: $token;
                    $profile = $this->metaService->getThreadsProfile($threadsId, $effectiveThreadsToken);
                    return new JsonResponse(['success' => true, 'profile' => $profile]);

                // 20. Threads Insights
                case 'threads_insights':
                    if (!$threadsId) return new JsonResponse(['success' => false, 'error' => 'Threads Hesap ID eksik.'], 400);
                    $effectiveThreadsToken = $threadsToken ?: $token;
                    $insights = $this->metaService->getThreadsInsights($threadsId, $effectiveThreadsToken);
                    return new JsonResponse(['success' => true, 'insights' => $insights]);

                // 21. Threads Gönderi Listesi
                case 'threads_media_list':
                    if (!$threadsId) return new JsonResponse(['success' => false, 'error' => 'Threads Hesap ID eksik.'], 400);
                    $effectiveThreadsToken = $threadsToken ?: $token;
                    $limit = isset($params['limit']) ? (int)$params['limit'] : 15;
                    $media = $this->metaService->getThreadsMediaList($threadsId, $effectiveThreadsToken, $limit);
                    return new JsonResponse(['success' => true, 'data' => $media]);

                default:
                    return new JsonResponse(['success' => false, 'error' => 'Geçersiz işlem.'], 400);
            }
        } catch (\Exception $e) {
            $this->logger->error('[Meta Business Error] ' . $e->getMessage());
            return new JsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}
