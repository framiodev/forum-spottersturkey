<?php

namespace Framio\Profiles\ProfileStories\Controller;

use Flarum\Api\Controller\AbstractCreateController;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Arr;
use Framio\Profiles\ProfileStories\Event\StoryCreated;
use Framio\Profiles\ProfileStories\Model\Story;
use Framio\Profiles\ProfileStories\Serializer\StorySerializer;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;

class CreateStoryController extends AbstractCreateController
{
    public $serializer = StorySerializer::class;
    protected $events;

    public function __construct(Dispatcher $events)
    {
        $this->events = $events;
    }

    protected function data(ServerRequestInterface $request, Document $document)
    {
        $actor = RequestUtil::getActor($request);
        $isAllowed = $actor->can('createStory');
        $data = $request->getParsedBody();

        if (!$isAllowed) {
            throw new PermissionDeniedException();
        }

        $story = new Story();
        $story->user_id = Arr::get($data, 'data.attributes.user_id');
        $story->title = Arr::get($data, 'data.attributes.title');
        $story->img_url = Arr::get($data, 'data.attributes.img_url');
        $story->cta = Arr::get($data, 'data.attributes.cta');
        $story->content_icon = Arr::get($data, 'data.attributes.content_icon');
        $story->content_text = Arr::get($data, 'data.attributes.content_text');
        $story->content_cta = Arr::get($data, 'data.attributes.content_cta');
        $story->content_link = Arr::get($data, 'data.attributes.content_link');
        $story->username = Arr::get($data, 'data.attributes.username');

        $story->save();
        $this->events->dispatch(new StoryCreated($story));

        return $story;
    }
}
