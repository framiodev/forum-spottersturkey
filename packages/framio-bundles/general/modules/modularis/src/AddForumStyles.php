<?php

namespace Stezkoy\FlarumModularis;

use Flarum\Frontend\Document;
use Psr\Http\Message\ServerRequestInterface;

class AddForumStyles extends AddStyles
{
    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $this->render($document, 'forum');
    }
}
