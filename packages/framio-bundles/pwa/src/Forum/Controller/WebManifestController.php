<?php

/*
 * This file is part of fof/pwa
 *
 * Copyright (c) 2021 Alexander Skvortsov.
 * Copyright (c) 2025 FriendsOfFlarum
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace Framio\PWA\Forum\Controller;

use Framio\PWA\PWATrait;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class WebManifestController implements RequestHandlerInterface
{
    use PWATrait;

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return (new JsonResponse($this->buildManifest()))
            ->withHeader('Content-Type', 'application/manifest+json');
    }
}
