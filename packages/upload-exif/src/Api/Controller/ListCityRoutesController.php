<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\MediaCityRoute;
use Illuminate\Support\Arr;

class ListCityRoutesController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $queryParams = $request->getQueryParams();
        $city = Arr::get($queryParams, 'city');
        $allCities = !empty($queryParams['all_cities']);

        if ($allCities) {
            $dbCities = MediaCityRoute::select('city')->distinct()->pluck('city')->toArray();
            
            $defaultCities = [
                'Adana', 'Ankara', 'Antalya', 'Aydın', 'Balıkesir', 'Bursa', 
                'Çanakkale', 'Denizli', 'Diyarbakır', 'Erzurum', 'Eskişehir', 
                'Gaziantep', 'İstanbul', 'İzmir', 'Kayseri', 'Kocaeli', 
                'Konya', 'Malatya', 'Manisa', 'Mersin', 'Muğla', 'Sakarya', 
                'Samsun', 'Şanlıurfa', 'Tekirdağ', 'Trabzon'
            ];
            
            $merged = array_values(array_unique(array_merge($dbCities, $defaultCities)));
            sort($merged, SORT_LOCALE_STRING);

            $counts = MediaCityRoute::selectRaw('city, COUNT(*) as count')
                ->groupBy('city')
                ->pluck('count', 'city')
                ->toArray();

            $cityData = [];
            foreach ($merged as $c) {
                if (empty($c)) continue;
                $cityData[] = [
                    'name' => $c,
                    'count' => $counts[$c] ?? 0
                ];
            }

            return new JsonResponse(['cities' => $cityData]);
        }

        $query = MediaCityRoute::query();
        if ($city) {
            $query->where('city', $city);
        }

        $routes = $query->orderBy('route_code', 'asc')->get();

        return new JsonResponse([
            'city' => $city,
            'count' => $routes->count(),
            // Forum 'data', admin 'routes' okur
            'data' => $routes,
            'routes' => $routes,
        ]);
    }
}
