<?php

use Flarum\Database\Migration;
use Flarum\Group\Group;

return Migration::addPermissions([
    'friendship.addFriends' => Group::MEMBER_ID,
    'friendship.viewOthers' => Group::MEMBER_ID,
    'friendship.moderate' => Group::MODERATOR_ID,
    'friendship.manage' => Group::ADMINISTRATOR_ID,
]);
