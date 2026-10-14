<?php

/*
 * Forum İstatistikleri: FoF ayar ve izin adlarından framio-stats adlarına geçiş.
 * Mevcut değerler ve grup izinleri korunur; yeni istatistiklerin izinleri
 * herkese (ziyaretçiler dahil) açık başlar.
 */

use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $db = $schema->getConnection();

        // Ayarlar
        $map = [
            'fof-forum-statistics-widget.ignore_private_discussions' => 'framio-stats.exclude_private',
            'fof-forum-statistics-widget.cache_duration' => 'framio-stats.cache_duration',
        ];
        foreach ($map as $old => $new) {
            $value = $db->table('settings')->where('key', $old)->value('value');
            if ($value !== null && !$db->table('settings')->where('key', $new)->exists()) {
                $db->table('settings')->insert(['key' => $new, 'value' => $value]);
            }
        }
        $db->table('settings')->whereIn('key', [
            'fof-forum-statistics-widget.ignore_private_discussions',
            'fof-forum-statistics-widget.cache_duration',
            'fof-forum-statistics-widget.flush_cache_on_new_registration',
            'fof-forum-statistics-widget.classic_look',
        ])->delete();

        // İzinler: eski adlar yenisine taşınır (grup atamaları korunur)
        $perms = [
            'fof-forum-statistics-widget.viewWidget.discussionsCount' => 'framio-stats.view.discussions',
            'fof-forum-statistics-widget.viewWidget.postsCount' => 'framio-stats.view.posts',
            'fof-forum-statistics-widget.viewWidget.usersCount' => 'framio-stats.view.users',
            'fof-forum-statistics-widget.viewWidget.latestMember' => 'framio-stats.view.latestMember',
        ];
        foreach ($perms as $old => $new) {
            foreach ($db->table('group_permission')->where('permission', $old)->pluck('group_id') as $groupId) {
                if (!$db->table('group_permission')->where(['group_id' => $groupId, 'permission' => $new])->exists()) {
                    $db->table('group_permission')->insert(['group_id' => $groupId, 'permission' => $new]);
                }
            }
            $db->table('group_permission')->where('permission', $old)->delete();
        }

        // Yeni istatistikler: ziyaretçiye (grup 2) açık
        foreach (['framio-stats.view.photos', 'framio-stats.view.online', 'framio-stats.view.topWeek'] as $new) {
            if (!$db->table('group_permission')->where('permission', $new)->exists()) {
                $db->table('group_permission')->insert(['group_id' => 2, 'permission' => $new]);
            }
        }
    },

    'down' => function (Builder $schema) {
        $db = $schema->getConnection();
        $perms = [
            'framio-stats.view.discussions' => 'fof-forum-statistics-widget.viewWidget.discussionsCount',
            'framio-stats.view.posts' => 'fof-forum-statistics-widget.viewWidget.postsCount',
            'framio-stats.view.users' => 'fof-forum-statistics-widget.viewWidget.usersCount',
            'framio-stats.view.latestMember' => 'fof-forum-statistics-widget.viewWidget.latestMember',
        ];
        foreach ($perms as $new => $old) {
            $db->table('group_permission')->where('permission', $new)->update(['permission' => $old]);
        }
        $db->table('group_permission')->whereIn('permission', ['framio-stats.view.photos', 'framio-stats.view.online', 'framio-stats.view.topWeek'])->delete();
    },
];
