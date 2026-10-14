<?php

namespace Framio\SocialNewsletter\Api\Controller;

use Flarum\Api\Controller\AbstractDeleteController;
use Framio\SocialNewsletter\Lead;
use Psr\Http\Message\ServerRequestInterface;
use Illuminate\Support\Arr;

class DeleteLeadController extends AbstractDeleteController
{
    protected function delete(ServerRequestInterface $request)
    {
        $request->getAttribute('actor')->assertAdmin();

        $id = Arr::get($request->getQueryParams(), 'id');
        $lead = Lead::findOrFail($id);
        
        $lead->delete();
    }
}
