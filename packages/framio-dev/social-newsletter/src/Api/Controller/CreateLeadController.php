<?php

namespace Framio\SocialNewsletter\Api\Controller;

use Flarum\Api\Controller\AbstractCreateController;
use Framio\SocialNewsletter\LeadSerializer;
use Framio\SocialNewsletter\Lead;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;
use Illuminate\Support\Arr;
use Carbon\Carbon;

class CreateLeadController extends AbstractCreateController
{
    public $serializer = LeadSerializer::class;

    protected function data(ServerRequestInterface $request, Document $document)
    {
        $attributes = Arr::get($request->getParsedBody(), 'data.attributes', []);

        $name = Arr::get($attributes, 'name');
        $contactType = Arr::get($attributes, 'contact_type');
        $contactValue = Arr::get($attributes, 'contact_value');

        $lead = new Lead();
        $lead->name = $name;
        $lead->contact_type = $contactType;
        $lead->contact_value = $contactValue;
        
        $lead->push_endpoint = Arr::get($attributes, 'push_endpoint');
        $lead->push_p256dh = Arr::get($attributes, 'push_p256dh');
        $lead->push_auth = Arr::get($attributes, 'push_auth');
        
        $lead->created_at = Carbon::now();
        $lead->save();

        return $lead;
    }
}
