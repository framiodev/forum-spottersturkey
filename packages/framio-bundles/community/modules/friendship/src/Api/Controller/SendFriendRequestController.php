<?php

declare(strict_types=1);

namespace forumaker\Friendship\Api\Controller;

use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use forumaker\Friendship\Support\FriendshipManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class SendFriendRequestController implements RequestHandlerInterface
{
    public function __construct(
        protected FriendshipManager $manager,
        protected TranslatorInterface $translator,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertCan('friendship.addFriends');

        $body = (array) $request->getParsedBody();
        $recipientId = (int) ($body['recipientId'] ?? 0);

        $recipient = User::find($recipientId);
        if (! $recipient) {
            return new JsonResponse(['error' => $this->translator->trans('forumaker-friendship.lib.errors.user_not_found')], 404);
        }

        try {
            $result = $this->manager->sendRequest($actor, $recipient);
        } catch (ValidationException $e) {
            return new JsonResponse(['error' => array_values($e->getAttributes())[0] ?? 'error'], 422);
        }

        return new JsonResponse(['success' => true, 'status' => $result['status']]);
    }
}
