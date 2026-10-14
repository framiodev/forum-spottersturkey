<?php

use Ernestdefoe\Hashtags\Api\Resource\HashtagResource;
use Ernestdefoe\Hashtags\Console\ReindexCommand;
use Ernestdefoe\Hashtags\Formatter\ConfigureHashtags;
use Ernestdefoe\Hashtags\Listener\RecountHashtagsOnPostDelete;
use Ernestdefoe\Hashtags\Listener\SyncHashtagsOnPostSave;
use Ernestdefoe\Hashtags\Model\Hashtag;
use Ernestdefoe\Hashtags\Search\Filter\HashtagFilter;
use Ernestdefoe\Hashtags\Search\FulltextFilter;
use Ernestdefoe\Hashtags\Search\HashtagSearcher;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Post\Event\Deleted;
use Flarum\Post\Event\Hidden;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Restored;
use Flarum\Post\Event\Revised;
use Flarum\Search\Database\DatabaseSearchDriver;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__ . '/less/forum.less')
        ->route('/hashtag/{name}', 'hashtag')
        ->route('/hashtags', 'hashtags'),

    new Extend\Locales(__DIR__ . '/locale'),

    (new Extend\Formatter())
        ->configure(ConfigureHashtags::class),

    (new Extend\ApiResource(HashtagResource::class)),

    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, HashtagFilter::class)
        ->addSearcher(Hashtag::class, HashtagSearcher::class)
        ->setFulltext(HashtagSearcher::class, FulltextFilter::class),

    (new Extend\Console())
        ->command(ReindexCommand::class),

    (new Extend\Event())
        ->listen(Posted::class, SyncHashtagsOnPostSave::class)
        ->listen(Revised::class, SyncHashtagsOnPostSave::class)
        ->listen(Hidden::class, SyncHashtagsOnPostSave::class)
        ->listen(Restored::class, SyncHashtagsOnPostSave::class)
        ->listen(Deleted::class, RecountHashtagsOnPostDelete::class),
];
