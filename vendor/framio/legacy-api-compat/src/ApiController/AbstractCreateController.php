<?php

namespace Flarum\Api\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

abstract class AbstractCreateController extends AbstractShowController
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return parent::handle($request)->withStatus(201);
    }
}
