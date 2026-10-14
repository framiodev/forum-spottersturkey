<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        // Pending friend requests. One row per pending request; deleted on
        // cancel/accept/decline (see FriendshipEvent for the audit trail).
        $schema->create('friendship_requests', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('sender_id');
            $table->unsignedInteger('recipient_id');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('sender_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('recipient_id')->references('id')->on('users')->onDelete('cascade');

            $table->unique(['sender_id', 'recipient_id']);
            $table->index('recipient_id');
        });

        // Confirmed friendships, stored symmetrically (two rows per pair) so
        // "this user's friends" is a plain indexed where(user_id) lookup with
        // no OR-conditions, matching how fof_badge_user etc. are queried here.
        $schema->create('friendships', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('friend_id');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('friend_id')->references('id')->on('users')->onDelete('cascade');

            $table->unique(['user_id', 'friend_id']);
            $table->index('user_id');
        });

        // History (audit trail) of friendship actions. Symmetric like
        // `friendships` above: one row per user per event, so a user's
        // history is a plain where(user_id) lookup ordered by created_at.
        $schema->create('friendship_events', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('other_user_id');
            $table->unsignedInteger('actor_id');
            $table->string('action', 20);
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('other_user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('actor_id')->references('id')->on('users')->onDelete('cascade');

            $table->index(['user_id', 'created_at']);
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('friendship_events');
        $schema->dropIfExists('friendships');
        $schema->dropIfExists('friendship_requests');
    },
];
