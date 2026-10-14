<?php

namespace Framio\Profiles\ProfileStories\Controller;

use Flarum\Api\Controller\AbstractDeleteController;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Framio\Profiles\ProfileStories\Model\Story;
use Psr\Http\Message\ServerRequestInterface;

class DeleteStoryController extends AbstractDeleteController
{

    protected function delete(ServerRequestInterface $request)
    {
        $actor = RequestUtil::getActor($request);
        $isAllowed = $actor->can('deleteStory');
        $storyId = Arr::get($request->getQueryParams(), 'id');

        if (!$storyId) {
            throw new \InvalidArgumentException('The "id" parameter is required.');
        }

        if (! $isAllowed && $storyId) {
            throw new PermissionDeniedException();
        }


        return Story::query()->findOrFail($storyId)->delete();
    }
}
