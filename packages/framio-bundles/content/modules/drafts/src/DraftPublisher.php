<?php

/*
 * This file is part of fof/drafts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Content\Drafts;

use Carbon\Carbon;
use Flarum\Api\JsonApi;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Foundation\ValidationException;
use Flarum\Settings\SettingsRepositoryInterface;
use Framio\Content\Drafts\Draft;
use Symfony\Contracts\Translation\TranslatorInterface;

class DraftPublisher
{
    public function __construct(protected JsonApi $api, protected SettingsRepositoryInterface $settings, protected TranslatorInterface $translator)
    {
    }

    /**
     * Publish all due scheduled drafts, or optionally for a specific user.
     *
     * @param int|null $userId
     * @return int
     */
    public function publishDueDrafts(?int $userId = null): int
    {
        if (!$this->settings->get('fof-drafts.enable_scheduled_drafts')) {
            return 0;
        }

        $query = Draft::where('scheduled_for', '<=', Carbon::now())->with('user');
        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        $publishedCount = 0;

        foreach ($query->get() as $draft) {
            try {
                $relationships = $draft->relationships;

                if (is_array($relationships) && isset($relationships['discussion']['data']['id'])) {
                    $discussionId = $relationships['discussion']['data']['id'];

                    // Create a post reply using JsonApi
                    $post = $this->api->forResource(PostResource::class)
                        ->forEndpoint('create')
                        ->process([
                            'data' => [
                                'type'       => 'posts',
                                'attributes' => [
                                    'content' => $draft->content,
                                ],
                                'relationships' => [
                                    'discussion' => [
                                        'data' => [
                                            'type' => 'discussions',
                                            'id'   => (string) $discussionId,
                                        ],
                                    ],
                                ],
                            ],
                        ], [], ['actor' => $draft->user]);

                    $post->created_at = $draft->scheduled_for;
                    $post->ip_address = $draft->ip_address;
                    $post->save();
                } else {
                    if (empty(trim((string) $draft->title))) {
                        $draft->scheduled_validation_error = $this->translator->trans('fof-drafts.console.no_title_error');
                        $draft->save();
                        continue;
                    }

                    // Create a new discussion using JsonApi
                    $attributes = [
                        'title'   => $draft->title,
                        'content' => $draft->content,
                    ];

                    // Merge any extra attributes (e.g., tags, etc.) stored in the draft
                    if (is_array($draft->extra) && !empty($draft->extra)) {
                        $attributes = array_merge($attributes, $draft->extra);
                    }

                    $discussion = $this->api->forResource(DiscussionResource::class)
                        ->forEndpoint('create')
                        ->process([
                            'data' => [
                                'type'          => 'discussions',
                                'attributes'    => $attributes,
                                'relationships' => $relationships,
                            ],
                        ], [], ['actor' => $draft->user]);

                    $discussion->created_at = $draft->scheduled_for;
                    $discussion->firstPost->created_at = $draft->scheduled_for;
                    $discussion->firstPost->ip_address = $draft->ip_address;
                    $discussion->save();
                    $discussion->firstPost->save();

                    // Discussion published
                }
                $draft->delete();
                $publishedCount++;
            } catch (ValidationException $e) {
                $draft->scheduled_validation_error = $e->getMessage();
                $draft->save();
            } catch (\Throwable $e) {
                error_log('Draft publish error: ' . $e->getMessage());
            }
        }

        return $publishedCount;
    }
}
