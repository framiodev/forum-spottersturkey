<?php

/*
 * This file is part of fof/move-posts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\MovePosts\Command;

use Flarum\Discussion\Discussion;
use Flarum\Discussion\DiscussionRepository;
use Flarum\Lock\Event\DiscussionWasLocked;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Guest;
use Flarum\User\User;
use FoF\MovePosts\Event\CreatedTargetDiscussion;
use FoF\MovePosts\Event\PostsMoved;
use FoF\MovePosts\Exception\MoveOldPostToNewerDiscussionException;
use FoF\MovePosts\Exception\MovePostsFromDifferentDiscussionsException;
use FoF\MovePosts\Exception\MovePostsToSameDiscussionException;
use FoF\MovePosts\MovedDiscussionFirstPostFactory;
use FoF\MovePosts\MovePostsValidator;
use FoF\MovePosts\PostMovedPost;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionResolverInterface;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

class MovePostsHandler
{
    const SIMPLE_MOVE = 'simple_move';
    const COMPLEX_MOVE = 'complex_move';
    const OLD_TO_NEW_MOVE = 'old_to_new_move';

    public function __construct(
        protected ConnectionResolverInterface $db,
        protected DiscussionRepository $discussions,
        protected MovePostsValidator $validator,
        protected MovedDiscussionFirstPostFactory $movedDiscussionFirstPostFactory,
        protected Dispatcher $events,
        protected SettingsRepositoryInterface $settings
    ) {
    }

    /**
     * Runs the process in a transaction.
     * Exceptions will always result in no changes.
     *
     * @throws \Flarum\User\Exception\PermissionDeniedException
     * @throws \Illuminate\Validation\ValidationException
     * @throws MoveOldPostToNewerDiscussionException
     */
    public function handle(MovePosts $command): string|array|null
    {
        try {
            $this->db->connection()->beginTransaction();
            $result = $this->process($command);
            $this->db->connection()->commit();
        } catch (\Exception $e) {
            $this->db->connection()->rollBack();
            throw $e;
        }

        return $result;
    }

    /**
     * @throws \Flarum\User\Exception\PermissionDeniedException
     * @throws \Illuminate\Validation\ValidationException
     * @throws MoveOldPostToNewerDiscussionException
     */
    protected function process(MovePosts $command): string|array|null
    {
        $actor = $command->actor;
        $data = $command->data;
        $emulate = $command->emulate;

        $actor->assertCan('movePosts');

        $this->validator->validateMissingKeys()->assertValid($data);

        $newDiscussion = Arr::get($data, 'newDiscussion', false);

        $sourceDiscussion = $this->discussions->findOrFail(Arr::get($data, 'sourceDiscussionId'));

        /** @var EloquentCollection<int, CommentPost> $posts */
        $posts = CommentPost::query()
            ->whereVisibleTo($actor)
            ->whereIn('id', Arr::get($data, 'postIds'))
            ->orderBy('created_at')
            ->get();

        if ($posts->where('discussion_id', '!=', $sourceDiscussion->id)->first()) {
            throw new MovePostsFromDifferentDiscussionsException();
        }

        $targetDiscussion = $newDiscussion
            ? $this->createTargetDiscussion($sourceDiscussion, $posts->first(), Arr::get($data, 'newDiscussionTitle'), $emulate, $actor)
            : $this->discussions->findOrFail(Arr::get($data, 'targetDiscussionId'));

        if ($sourceDiscussion->id === $targetDiscussion->id){
            throw new MovePostsToSameDiscussionException();
        }

        if (! $newDiscussion && $posts->first()->created_at < $targetDiscussion->firstPost->created_at) {
            if ($emulate) {
                return self::OLD_TO_NEW_MOVE;
            }

            throw new MoveOldPostToNewerDiscussionException();
        }

        $movingFirstPost = $posts->first()->id === $sourceDiscussion->first_post_id;
        $settingSecondAsFirst = false;

        if ($movingFirstPost && ($secondPost = $sourceDiscussion->comments()->where('id', '!=', $sourceDiscussion->first_post_id)->oldest()->first())) {
            $sourceDiscussion->setFirstPost($secondPost);
            $settingSecondAsFirst = true;
        }

        if ($newDiscussion) {
            $targetDiscussion->setFirstPost($posts->first());
        }

        /** @var EloquentCollection<int, CommentPost> $oldPosts */
        $oldPosts = $posts->map(function (CommentPost $post) {
            return clone $post;
        });

        if ($newDiscussion || $posts->first()->created_at >= $targetDiscussion->lastPost->created_at) {
            $status = self::SIMPLE_MOVE;

            if ($emulate) {
                return $status;
            }

            $posts = $this->simpleMove($posts, $targetDiscussion);
        } else {
            $status = self::COMPLEX_MOVE;

            if ($emulate) {
                return $status;
            }

            $posts = $this->complexMove($posts, $targetDiscussion);
        }

        $movingFirstPostOnly = $movingFirstPost && ! $settingSecondAsFirst;

        if (! $movingFirstPostOnly) {
            $eventPosts = $this->createEventPosts($oldPosts, $posts, $sourceDiscussion, $targetDiscussion, $actor);
        } else {
            $newFirstPost = $this->movedDiscussionFirstPostFactory->create($sourceDiscussion, $targetDiscussion, $oldPosts->first(), $posts->first());
            $sourceDiscussion->setFirstPost($newFirstPost);
            $sourceDiscussion->is_first_moved = true;
        }

        $sourceDiscussion->refreshCommentCount();
        $sourceDiscussion->refreshParticipantCount();
        $sourceDiscussion->refreshLastPost();

        if (isset($sourceDiscussion->is_locked) && $movingFirstPostOnly) {
            $sourceDiscussion->is_locked = true;

            if (class_exists(DiscussionWasLocked::class)) {
                $this->events->dispatch(
                    new DiscussionWasLocked($sourceDiscussion, $actor)
                );
            }
        }

        $sourceDiscussion->save();

        $this->events->dispatch(
            new PostsMoved($posts, $targetDiscussion, $sourceDiscussion, $actor, (bool) $newDiscussion)
        );

        return [
            'status' => $status,
            'postCount' => $posts->count(),
            'firstMovedPostNumber' => $posts->min('number'),
            'sourceDiscussion' => $sourceDiscussion->fresh(),
            'targetDiscussion' => $targetDiscussion->fresh(),
        ];
    }

    /**
     * Creates a target discussion when specified.
     */
    protected function createTargetDiscussion(Discussion $sourceDiscussion, CommentPost $firstPost, string $title, bool $emulate, User $actor): Discussion
    {
        $discussion = Discussion::start($title, $firstPost->user ?? new Guest);

        if (!$emulate) {
            $saved = $discussion->save();

            if ($saved) {
                $this->events->dispatch(
                    new CreatedTargetDiscussion($discussion, $sourceDiscussion, $actor)
                );
            }
        }

        return $discussion;
    }

    /**
     * Replaces old posts positions with new event posts to point to the new ones.
     *
     * @param EloquentCollection<int, CommentPost> $oldPosts
     * @param EloquentCollection<int, CommentPost> $posts
     */
    protected function createEventPosts(EloquentCollection $oldPosts, EloquentCollection $posts, Discussion $sourceDiscussion, Discussion $targetDiscussion, User $actor): Collection
    {
        $eventPosts = new Collection();

        $grouped = $this->groupSequentialPosts($posts);

        foreach ($grouped as $group) {
            $post = $group->first();
            $oldPost = $oldPosts->firstWhere('id', $group->last()->id);

            $eventPost = PostMovedPost::reply(
                $sourceDiscussion->id,
                $actor->id,
                $targetDiscussion,
                $post,
                $oldPost,
                $group->count(),
            );

            $eventPosts->push($eventPost);

            $eventPost->saveQuietly();
        }

        return $eventPosts;
    }

    /**
     * Pushes the moved posts at the end of the target discussion.
     * Cleanest case scenario.
     *
     * @param EloquentCollection<int, CommentPost> $posts
     * @return EloquentCollection<int, CommentPost>
     */
    protected function simpleMove(EloquentCollection $posts, Discussion $discussion): EloquentCollection
    {
        $numberDifference = $discussion->posts()->max('number') - $posts->first()->number + 1;
        $posts->toQuery()->update([
            'discussion_id' => $discussion->id,
            'number' => $this->db->connection()->raw("number + $numberDifference"),
        ]);

        $discussion->refreshCommentCount();
        $discussion->refreshParticipantCount();
        $discussion->refreshLastPost();

        $discussion->save();

        return $posts->fresh();
    }

    /**
     * Pushes moved posts in between target discussion posts, depending on creation date & time.
     * Results in breaking old URLs to the target discussion posts.
     *
     * @param EloquentCollection<int, CommentPost> $posts
     * @return EloquentCollection<int, CommentPost>
     */
    protected function complexMove(EloquentCollection $posts, Discussion $discussion): EloquentCollection
    {
        /** @var Connection $db */
        $db = $this->db->connection();

        // Create number gaps in discussion
        $selectCreatedAt = $db->query()
            ->select('created_at')
            ->from('posts')
            ->whereIn('id', $posts->pluck('id'));

        $selectCount = $db->query()
            ->mergeBindings($selectCreatedAt)
            ->selectRaw('COUNT(created_at) as count')
            ->from($db->raw("({$selectCreatedAt->toSql()}) as sp"))
            // Compare with the derived-table alias `sp` as the first column so it can be
            // passed as a raw expression (avoiding the table prefix being applied to the
            // alias), while `posts.created_at` is wrapped normally. The operator is flipped
            // accordingly: `posts.created_at >= sp.created_at` === `sp.created_at <= posts.created_at`.
            ->whereColumn($db->raw('sp.created_at'), '<=', 'posts.created_at');

        // Create number gaps in discussion.
        match ($db->getDriverName()) {
            'sqlite', 'pgsql' => $this->createNumberGapsOneByOne($discussion, $selectCount),
            default => $this->createNumberGaps($discussion, $selectCount),
        };

        // To fill the gaps with the new posts,
        // we query the posts that will be ordered right before the new ones,
        // so that we can calculate the numbers of the new posts.
        $max = $db->query()
            ->select('number')
            ->from('posts')
            ->where('discussion_id', $discussion->id)
            ->whereColumn($db->raw('r.created_at'), '>', 'posts.created_at')
            ->orderBy('number', 'desc')
            ->limit(1);

        $numbers = $db->query()
            ->mergeBindings($max)
            ->mergeBindings($selectCreatedAt)
            ->selectRaw("DISTINCT ({$max->toSql()}) as number")
            ->from($db->raw("({$selectCreatedAt->toSql()}) as r"))
            ->get();

        // Now we get the checkpoints and use them to calculate new post numbers
        $checkpointPosts = Post::query()
            ->where('discussion_id', $discussion->id)
            ->whereIn('number', $numbers->pluck('number')->toArray())
            ->get();

        $merged = $checkpointPosts->merge($posts)->sortBy('created_at')->values();

        $merged->map(function (Post $post, int $key) use ($merged, $checkpointPosts, $discussion) {
            $prev = $merged[$key-1] ?? null;

            if ($prev && ! $checkpointPosts->firstWhere('id', $post->id)) {
                $post->number = $prev->number + 1;
                $post->discussion_id = $discussion->id;

                $post->save();
            }

            return $post;
        });

        $discussion->refreshCommentCount();
        $discussion->refreshParticipantCount();
        $discussion->refreshLastPost();

        $discussion->save();

        return $posts->fresh();
    }

    /**
     * Groups sequential event posts into one.
     *
     * @param EloquentCollection<int, CommentPost> $posts
     */
    protected function groupSequentialPosts(EloquentCollection $posts): Collection
    {
        $posts = $posts->sortBy('number')->values();

        if (!$this->settings->get('fof-move-posts.group_sequential_event_posts')) {
            return $posts->map(function ($post) {
                return new Collection([$post]);
            });
        }

        $grouped = new Collection();
        $currentGroup = new Collection();

        foreach ($posts as $post) {
            if ($currentGroup->isEmpty() || $post->number === $currentGroup->last()->number + 1) {
                $currentGroup->push($post);
                continue;
            }

            $grouped->push($currentGroup);
            $currentGroup = new Collection([$post]);
        }

        if (!$currentGroup->isEmpty()) {
            $grouped->push($currentGroup);
        }

        return $grouped;
    }

    private function createNumberGaps(Discussion $discussion, QueryBuilder $selectCount): void
    {
        /** @var Connection $db */
        $db = $this->db->connection();

        $db->table('posts')
           ->mergeBindings($selectCount)
           ->where('discussion_id', $discussion->id)
           ->orderBy('number', 'desc')
           ->update(['number' => $db->raw("number + ({$selectCount->toSql()})")]);
    }

    /**
     * SQLite/PgSQL doesn't support update order by.
     * So it'll have to be slower...
     */
    private function createNumberGapsOneByOne(Discussion $discussion, QueryBuilder $selectCount): void
    {
        /** @var Connection $db */
        $db = $this->db->connection();

        $db->table('posts')
            ->select('id', 'number')
            ->selectSub($selectCount, 'count')
            ->where('discussion_id', $discussion->id)
            ->orderBy('number', 'desc')
            ->each(function ($post) use ($db) {
                $db->table('posts')
                    ->where('id', $post->id)
                    ->update(['number' => $db->raw("number + $post->count")]);
            });
    }
}
