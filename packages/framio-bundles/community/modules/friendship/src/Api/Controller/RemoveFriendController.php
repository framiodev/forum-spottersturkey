<?php

declare(strict_types=1);

namespace forumaker\Friendship\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use forumaker\Friendship\Friendship;
use forumaker\Friendship\Support\FriendshipManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Removes the actor's own friendship with the given user. Used by the
 * profile dropdown's "remove friend" button, which only ever knows a
 * target User — not a `friendships` row id (unlike the friends list page,
 * where each row is an already-loaded Friendship model and just calls the
 * plain JSON:API delete endpoint on FriendshipResource instead).
 */
class RemoveFriendController implements RequestHandlerInterface
{
    public function __construct(
        protected FriendshipManager $manager,
        protected TranslatorInterface $translator,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $body = (array) $request->getParsedBody();
        $userId = (int) ($body['userId'] ?? 0);

        $other = User::find($userId);
        if (! $other) {
            return new JsonResponse(['error' => $this->translator->trans('forumaker-friendship.lib.errors.user_not_found')], 404);
        }

        $friendship = Friendship::where('user_id', $actor->id)->where('friend_id', $other->id)->first();
        if (! $friendship) {
            return new JsonResponse(['error' => $this->translator->trans('forumaker-friendship.lib.errors.not_friends')], 404);
        }

        $this->manager->removeFriend($actor, $friendship);

        return new JsonResponse(['success' => true]);
    }
}
