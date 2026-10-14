<?php

/*
 * framio/community — notifications/NotificationService
 *
 * Telegram Bot API ve WhatsApp Gateway'e HTTP istekleri gönderir.
 * Hata durumunda sessizce loglar — forumun çalışmasını engellemez.
 */

namespace Framio\Community\Notifications;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Container\Container;
use Psr\Log\LoggerInterface;

class NotificationService
{
    protected SettingsRepositoryInterface $settings;
    protected LoggerInterface $logger;

    public function __construct(SettingsRepositoryInterface $settings, LoggerInterface $logger)
    {
        $this->settings = $settings;
        $this->logger = $logger;
    }

    /**
     * Hem Telegram hem WhatsApp'a bildirim gönderir (ayarlara göre).
     */
    public function send(string $type, array $data): void
    {
        if ($this->isTelegramEnabled($type)) {
            $this->sendTelegram($type, $data);
        }

        if ($this->isWhatsAppEnabled($type)) {
            $this->sendWhatsApp($type, $data);
        }
    }

    // ----------------------------------------------------------------
    // TELEGRAM
    // ----------------------------------------------------------------

    protected function isTelegramEnabled(string $type): bool
    {
        if (!$this->settings->get('notifications.telegram_enabled')) {
            return false;
        }
        if ($type === 'discussion' && !$this->settings->get('notifications.telegram_new_discussion')) {
            return false;
        }
        if ($type === 'reply' && !$this->settings->get('notifications.telegram_new_reply')) {
            return false;
        }
        $token  = trim((string) $this->settings->get('notifications.telegram_bot_token'));
        $chatId = trim((string) $this->settings->get('notifications.telegram_chat_id'));
        return $token !== '' && $chatId !== '';
    }

    protected function sendTelegram(string $type, array $data): void
    {
        $token    = trim((string) $this->settings->get('notifications.telegram_bot_token'));
        $chatId   = trim((string) $this->settings->get('notifications.telegram_chat_id'));
        $threadId = trim((string) $this->settings->get('notifications.telegram_thread_id'));

        $templateKey = $type === 'discussion'
            ? 'notifications.telegram_discussion_template'
            : 'notifications.telegram_reply_template';

        $template = (string) $this->settings->get($templateKey);
        if ($template === '') {
            $template = $type === 'discussion'
                ? "🆕 <b>{title}</b>\n👤 {author}\n\n{excerpt}\n\n🔗 {url}"
                : "💬 <b>{title}</b> konusunda yeni yanıt\n👤 {author}\n\n{excerpt}\n\n🔗 {url}";
        }

        $text = $this->fillTemplate($template, $data);

        $payload = [
            'chat_id'    => $chatId,
            'text'       => $text,
            'parse_mode' => 'HTML',
        ];

        if ($threadId !== '') {
            $payload['message_thread_id'] = (int) $threadId;
        }

        $url = "https://api.telegram.org/bot{$token}/sendMessage";
        $this->httpPost($url, $payload, 'Telegram');
    }

    // ----------------------------------------------------------------
    // WHATSAPP
    // ----------------------------------------------------------------

    protected function isWhatsAppEnabled(string $type): bool
    {
        if (!$this->settings->get('notifications.whatsapp_enabled')) {
            return false;
        }
        if ($type === 'discussion' && !$this->settings->get('notifications.whatsapp_new_discussion')) {
            return false;
        }
        if ($type === 'reply' && !$this->settings->get('notifications.whatsapp_new_reply')) {
            return false;
        }
        $groupId    = trim((string) $this->settings->get('notifications.whatsapp_group_id'));
        $gatewayUrl = trim((string) $this->settings->get('notifications.whatsapp_gateway_url'));
        return $groupId !== '' && $gatewayUrl !== '';
    }

    protected function sendWhatsApp(string $type, array $data): void
    {
        $gatewayUrl = rtrim(trim((string) $this->settings->get('notifications.whatsapp_gateway_url')), '/');
        $groupId    = trim((string) $this->settings->get('notifications.whatsapp_group_id'));

        $templateKey = $type === 'discussion'
            ? 'notifications.whatsapp_discussion_template'
            : 'notifications.whatsapp_reply_template';

        $template = (string) $this->settings->get($templateKey);
        if ($template === '') {
            $template = $type === 'discussion'
                ? "🆕 Yeni konu: {title}\n👤 {author}\n\n{excerpt}\n\n🔗 {url}"
                : "💬 {title} konusunda yeni yanıt\n👤 {author}\n\n{excerpt}\n\n🔗 {url}";
        }

        $message = $this->fillTemplate($template, $data);

        $url = "{$gatewayUrl}/send";
        $this->httpPost($url, ['groupId' => $groupId, 'message' => $message], 'WhatsApp');
    }

    // ----------------------------------------------------------------
    // YARDIMCI METODLAR
    // ----------------------------------------------------------------

    /**
     * Şablondaki {placeholder} değerlerini doldurur.
     */
    protected function fillTemplate(string $template, array $data): string
    {
        return str_replace(
            ['{title}', '{author}', '{url}', '{excerpt}'],
            [
                $data['title']   ?? '',
                $data['author']  ?? '',
                $data['url']     ?? '',
                $data['excerpt'] ?? '',
            ],
            $template
        );
    }

    /**
     * JSON body ile HTTP POST isteği gönderir.
     */
    protected function httpPost(string $url, array $payload, string $channel): void
    {
        try {
            $json = json_encode($payload);

            $context = stream_context_create([
                'http' => [
                    'method'  => 'POST',
                    'header'  => "Content-Type: application/json\r\nContent-Length: " . strlen($json) . "\r\n",
                    'content' => $json,
                    'timeout' => 5,
                    'ignore_errors' => true,
                ],
                'ssl' => [
                    'verify_peer'      => true,
                    'verify_peer_name' => true,
                ],
            ]);

            $result = @file_get_contents($url, false, $context);

            if ($result === false) {
                $this->logger->warning("[Notifications/{$channel}] HTTP isteği başarısız. URL: {$url}");
            }
        } catch (\Throwable $e) {
            $this->logger->error("[Notifications/{$channel}] Hata: " . $e->getMessage());
        }
    }
}
