<?php

namespace Framio\Profiles\CustomProfilePage\Api\Controller;

use Flarum\Api\Controller\AbstractShowController;
use Flarum\Http\RequestUtil;
use Framio\Profiles\CustomProfilePage\Api\Serializer\CustomProfilePageSerializer;
use Framio\Profiles\CustomProfilePage\CustomProfilePage;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;

class ShowCustomPageController extends AbstractShowController
{
    public $serializer = CustomProfilePageSerializer::class;

    protected function data(ServerRequestInterface $request, Document $document)
    {
        $userId = Arr::get($request->getQueryParams(), 'id');
        $actor = RequestUtil::getActor($request);
        
        // ✅ Sayfayı bul
        $page = CustomProfilePage::where('user_id', $userId)->first();
        
        // Sayfa yoksa null dön
        if (!$page) {
            return null;
        }
        
        // ✅ Permission kontrolü - Policy kullan
        $actor->assertCan('view', $page);
        
        return $page;
    }
}