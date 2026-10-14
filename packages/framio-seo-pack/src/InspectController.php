<?php

namespace Framio\SeoPack;

use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Google\Client;
use Google\Service\SearchConsole;

class InspectController implements RequestHandlerInterface
{
    protected $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        \Flarum\Http\RequestUtil::getActor($request)->assertAdmin();

        $params = $request->getQueryParams();
        $urlToCheck = $params['url'] ?? '';

        try {
            $keyFile = storage_path('service_account.json');
            $client = new Client();
            $client->setAuthConfig($keyFile);
            $client->addScope('https://www.googleapis.com/auth/webmasters.readonly');
            $service = new SearchConsole($client);

            // GSC Mülk Adresiniz (URL Prefix ise tam adres)
            $siteUrl = resolve(\Framio\SeoPack\Support\SeoSettings::class)->gscProperty();

            $inspectRequest = new SearchConsole\InspectUrlIndexRequest();
            $inspectRequest->setInspectionUrl($urlToCheck);
            $inspectRequest->setSiteUrl($siteUrl);

            $response = $service->urlInspection_index->inspect($inspectRequest);
            $result = $response->getInspectionResult();
            $indexStatus = $result->getIndexStatusResult();
            $rich = $result->getRichResultsResult();

            return new JsonResponse([
                'status' => 'success',
                'indexed' => ($indexStatus->getVerdict() === 'PASS'),
                'message' => $indexStatus->getVerdict() === 'PASS' ? '🟢 İndekste' : '🔴 Yok',
                'details' => [
                    'coverageState' => $indexStatus->getCoverageState(),
                    'lastCrawlTime' => $indexStatus->getLastCrawlTime(),
                    'indexingState' => $indexStatus->getIndexingState(),
                    'crawlState' => $indexStatus->getPageFetchState(),
                    'googleCanonical' => $indexStatus->getGoogleCanonical(),
                    'userCanonical' => $indexStatus->getUserCanonical(),
                    'richVerdict' => $rich ? $rich->getVerdict() : null,
                    'richTypes' => $rich ? array_map(fn ($d) => $d->getRichResultType(), (array) $rich->getDetectedItems()) : [],
                ],
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['status' => 'error', 'message' => $e->getMessage()], 200);
        }
    }
}