<?php

namespace Framio\SocialNewsletter\Api\Controller;

use Flarum\Api\Controller\AbstractShowController;
use Framio\SocialNewsletter\LeadSerializer;
use Framio\SocialNewsletter\Lead;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;
use Illuminate\Support\Arr;

class UpdateLeadController extends AbstractShowController
{
    public $serializer = LeadSerializer::class;

    protected function data(ServerRequestInterface $request, Document $document)
    {
        $request->getAttribute('actor')->assertAdmin();

        $id = Arr::get($request->getQueryParams(), 'id');
        $lead = Lead::findOrFail($id);

        $attributes = Arr::get($request->getParsedBody(), 'data.attributes', []);

        if (isset($attributes['is_contacted'])) {
            $lead->is_contacted = $attributes['is_contacted'];
        }

        if (isset($attributes['is_following'])) {
            $lead->is_following = $attributes['is_following'];
        }

        $lead->save();

        return $lead;
    }
}
