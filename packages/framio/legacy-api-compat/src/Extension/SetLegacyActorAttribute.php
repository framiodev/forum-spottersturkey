<?php

namespace Framio\LegacyApiCompat;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Flarum 1.x extension code commonly read the current user via
 * $request->getAttribute('actor'). Flarum 2.0 stores the actor behind an
 * 'actorReference' attribute instead (see Flarum\Http\RequestUtil::getActor),
 * so that raw getAttribute('actor') call now silently returns null. This
 * middleware backfills the old 'actor' attribute for every API request so
 * extensions built against the 1.x pattern keep working unchanged.
 */
class SetLegacyActorAttribute implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $request = $request->withAttribute('actor', RequestUtil::getActor($request));

        return $handler->handle($request);
    }
}
