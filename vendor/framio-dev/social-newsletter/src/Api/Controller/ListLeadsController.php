<?php

namespace Framio\SocialNewsletter\Api\Controller;

use Flarum\Api\Controller\AbstractListController;
use Framio\SocialNewsletter\LeadSerializer;
use Framio\SocialNewsletter\Lead;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;

class ListLeadsController extends AbstractListController
{
    public $serializer = LeadSerializer::class;

    protected function data(ServerRequestInterface $request, Document $document)
    {
        $request->getAttribute('actor')->assertAdmin();

        return Lead::orderBy('created_at', 'desc')->get();
    }
}
