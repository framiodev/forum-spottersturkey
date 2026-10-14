<?php

declare(strict_types=1);

namespace forumaker\Friendship\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use forumaker\Friendship\FriendshipRequest;
use forumaker\Friendship\Support\FriendshipManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class AcceptFriendRequestController implements RequestHandlerInterface
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

        $id = (int) ($request->getAttribute('routeParameters')['id'] ?? 0);

        $friendshipRequest = FriendshipRequest::find($id);
        if (! $friendshipRequest) {
            return new JsonResponse(['error' => $this->translator->trans('forumaker-friendship.lib.errors.request_not_found')], 404);
        }

        if ($actor->id !== $friendshipRequest->recipient_id
            && ! $actor->hasPermission('friendship.moderate')
            && ! $actor->hasPermission('friendship.manage')
        ) {
            throw new PermissionDeniedException();
        }

        $this->manager->acceptRequest($actor, $friendshipRequest);

        return new JsonResponse(['success' => true]);
    }
}
