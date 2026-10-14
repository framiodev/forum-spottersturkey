<?php

namespace Framio\SocialNewsletter\Listener;

use Flarum\Post\Event\Posted;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Foundation\Config;
use Illuminate\Contracts\Events\Dispatcher;
use Framio\SocialNewsletter\Lead;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class SendPushOnNewContent
{
    protected $settings;
    protected $config;

    public function __construct(SettingsRepositoryInterface $settings, Config $config)
    {
        $this->settings = $settings;
        $this->config = $config;
    }

    public function subscribe(Dispatcher $events)
    {
        $events->listen(Posted::class, [$this, 'handleNewPost']);
    }

    public function handleNewPost(Posted $event)
    {
        // Yalnızca ilk mesaj (yeni tartışma) sayılacaksa:
        // if ($event->post->number !== 1) return;

        $count = (int) $this->settings->get('framio-social-newsletter.content_counter', 0);
        $count++;

        if ($count >= 10) {
            $this->settings->set('framio-social-newsletter.content_counter', 0);
            $this->sendPushNotifications();
        } else {
            $this->settings->set('framio-social-newsletter.content_counter', $count);
        }
    }

    protected function sendPushNotifications()
    {
        $publicKey = $this->settings->get('framio-social-newsletter.vapid_public');
        $privateKey = $this->settings->get('framio-social-newsletter.vapid_private');

        if (!$publicKey || !$privateKey) return;

        $auth = [
            'VAPID' => [
                'subject' => $this->config->url(),
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ]
        ];

        $webPush = new WebPush($auth);
        
        $leads = Lead::whereNotNull('push_endpoint')->get();

        $payload = json_encode([
            'title' => 'Spotters Turkey Forum',
            'body' => 'Forumda 10 yeni içerik var! Hemen katılın.',
            'url' => $this->config->url(),
        ]);

        foreach ($leads as $lead) {
            $subscription = Subscription::create([
                'endpoint' => $lead->push_endpoint,
                'publicKey' => $lead->push_p256dh,
                'authToken' => $lead->push_auth,
            ]);

            $webPush->queueNotification($subscription, $payload);
        }

        foreach ($webPush->flush() as $report) {
            $endpoint = $report->getRequest()->getUri()->__toString();
            if (!$report->isSuccess()) {
                if ($report->isSubscriptionExpired()) {
                    Lead::where('push_endpoint', $endpoint)->update([
                        'push_endpoint' => null,
                        'push_p256dh' => null,
                        'push_auth' => null
                    ]);
                }
            }
        }
    }
}
