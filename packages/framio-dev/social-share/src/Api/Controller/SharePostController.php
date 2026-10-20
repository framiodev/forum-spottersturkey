<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\SocialShare\Services\MetaService;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;

use Flarum\Settings\SettingsRepositoryInterface;

class SharePostController implements RequestHandlerInterface
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
        // 1. Güvenlik: Admin yetki kontrolü, Grup İzni veya Spesifik Kullanıcı
        $actor = RequestUtil::getActor($request);
        $allowedUsersStr = $this->settings->get('framio-social-share.allowed_share_users', '');
        $allowedUsers = array_filter(array_map(function($val) {
            return strtolower(trim($val));
        }, explode(',', $allowedUsersStr)));

        $currentUsername = strtolower($actor->username ?? '');
        $currentId = (string)$actor->id;

        $isSpecificUser = in_array($currentUsername, $allowedUsers, true) || in_array($currentId, $allowedUsers, true);

        if (!$actor->isAdmin() && !$actor->hasPermission('framio-social-share.share-posts') && !$isSpecificUser) {
            $actor->assertPermission('framio-social-share.share-posts');
        }

        // 2. Verileri Al
        $data = $request->getParsedBody();

        $messageFb = $data['messageFb'] ?? $data['message'] ?? '';
        $messageIg = $data['messageIg'] ?? $data['message'] ?? '';
        $messageThreads = $data['messageThreads'] ?? $data['message'] ?? '';
        $images = $data['images'] ?? [];
        $pageId = $data['pageId'] ?? null;
        $igId = $data['igId'] ?? null;
        $threadsId = $data['threadsId'] ?? null;
        // Jetonlar artık foruma gönderilmiyor; kimliklere göre sunucuda bulunur
        $account = \Framio\SocialShare\Services\AccountTokens::find($this->settings, $pageId, $igId, $threadsId);
        $token = $account['token'] ?? ($actor->isAdmin() ? ($data['token'] ?? null) : null);
        $threadsToken = ($account['threads_token'] ?? null) ?: ($account ? $token : ($actor->isAdmin() ? ($data['threadsToken'] ?? $token) : $token));
        $scheduleTime = $data['scheduleTime'] ?? null;

        // 3. Doğrulama
        if (!$token) {
            return new JsonResponse(['success' => false, 'errors' => ['Erişim Jetonu (Token) eksik.']]);
        }

        if (empty($images) && empty($messageThreads)) {
            return new JsonResponse(['success' => false, 'errors' => ['Paylaşılacak bir görsel veya Threads metni girmelisiniz.']]);
        }

        // 4. Servisi Çalıştır
        try {
            $results = $this->metaService->publish(
                $messageFb,
                $messageIg,
                $images,
                $pageId,
                $igId,
                $token,
                $scheduleTime,
                $actor->id,
                false,
                $messageThreads,
                $threadsId,
                $threadsToken
            );
            return new JsonResponse(['success' => true, 'data' => $results]);
        } catch (\Exception $e) {
            $this->logger->error('[Framio Social Share Error] ' . $e->getMessage());
            
            return new JsonResponse([
                'success' => false, 
                'errors' => [$e->getMessage()] 
            ]);
        }
    }
}