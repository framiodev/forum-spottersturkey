<?php

namespace Framio\Profiles\ProfileStories\Controller;

use Flarum\Api\Controller\AbstractShowController;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Framio\Profiles\ProfileStories\Model\Story;
use Framio\Profiles\ProfileStories\Serializer\StorySerializer;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;

class UpdateStoryController extends AbstractShowController
{
    public $serializer = StorySerializer::class;

    protected function data(ServerRequestInterface $request, Document $document)
    {
        $actor = RequestUtil::getActor($request);
        $isAllowed = $actor->can('editStory');

        if (! $isAllowed) {
            throw new PermissionDeniedException();
        }

        $data = $request->getParsedBody();
        $storyId = Arr::get($request->getQueryParams(), 'id');
        $story = Story::query()
            ->findOrFail($storyId);

        $story->title = Arr::get($data, 'data.attributes.title', $story->title);
        $story->img_url = Arr::get($data, 'data.attributes.img_url', $story->img_url);
        $story->cta = Arr::get($data, 'data.attributes.cta', $story->cta);
        $story->content_icon = Arr::get($data, 'data.attributes.content_icon', $story->content_icon);
        $story->content_text = Arr::get($data, 'data.attributes.content_text', $story->content_text);
        $story->content_cta = Arr::get($data, 'data.attributes.content_cta', $story->content_cta);
        $story->content_link = Arr::get($data, 'data.attributes.content_link', $story->content_link);
        $story->username = Arr::get($data, 'data.attributes.username', $story->username);

        $story->update($data);

        return $story;
    }
}
