<?php

$secretKey = 'spotters_seo_2026_auto';

if (php_sapi_name() !== 'cli') {
    if (!isset($_GET['key']) || $_GET['key'] !== $secretKey) {
        http_response_code(403);
        die('Yetkisiz erisim.');
    }
}

try {
    $site = require 'site.php';
    $app = $site->bootApp();
    $container = $app->getContainer();

    $settings = $container->make('Flarum\Settings\SettingsRepositoryInterface');
    $db = $container->make('Illuminate\Database\ConnectionInterface');

    $lastIndex = (int) $settings->get('spottersturkey-seo.cron_batch_index', 0);
    $batchSize = 50;

    $keyFile = __DIR__ . '/storage/service_account.json';
    if (!file_exists($keyFile)) {
        die('service_account.json bulunamadi.');
    }

    $client = new Google\Client();
    $client->setAuthConfig($keyFile);
    $client->addScope('https://www.googleapis.com/auth/indexing');
    $indexingService = new Google\Service\Indexing($client);

    $table = (new Flarum\Post\Post)->getTable();
    $baseUrl = rtrim($settings->get('url') ?: 'https://forum.spottersturkey.com', '/');

    $query = Flarum\Post\CommentPost::where('is_private', false)
        ->whereNull('hidden_at')
        ->where(function($q) {
            $q->where('content', 'like', '%SPOTTER-IMAGE%')
              ->orWhere('content', 'like', '%UPL-IMAGE-PREVIEW%')
              ->orWhere('content', 'like', '%IMG%');
        });

    $totalCount = $query->count();

    $posts = $query->skip($lastIndex)
        ->take($batchSize)
        ->with('discussion')
        ->get();

    if ($posts->isEmpty()) {
        $settings->set('spottersturkey-seo.cron_batch_index', 0);
        echo date('Y-m-d H:i:s') . " | Tum icerik taranmis, basa donuluyor.\n";
        exit;
    }

    $sent = 0;
    $errors = 0;

    foreach ($posts as $post) {
        if (!$post->discussion) continue;

        $url = $baseUrl . '/d/' . $post->discussion->id . '-' . $post->discussion->slug . '/' . $post->number;

        $notification = new Google\Service\Indexing\UrlNotification();
        $notification->setUrl($url);
        $notification->setType('URL_UPDATED');

        try {
            $indexingService->urlNotifications->publish($notification);
            $sent++;
        } catch (\Exception $e) {
            $errors++;
        }

        usleep(100000);
    }

    $newIndex = $lastIndex + $posts->count();
    $settings->set('spottersturkey-seo.cron_batch_index', $newIndex);

    $log = date('Y-m-d H:i:s') . " | Gonderilen: $sent | Hata: $errors | Siradaki offset: $newIndex / $totalCount\n";
    echo $log;
    file_put_contents(__DIR__ . '/storage/logs/seo-cron.log', $log, FILE_APPEND);

} catch (\Exception $e) {
    $err = date('Y-m-d H:i:s') . " | HATA: " . $e->getMessage() . "\n";
    echo $err;
    file_put_contents(__DIR__ . '/storage/logs/seo-cron.log', $err, FILE_APPEND);
}
