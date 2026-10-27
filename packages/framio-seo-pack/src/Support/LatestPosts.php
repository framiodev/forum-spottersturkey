<?php

namespace Framio\SeoPack\Support;

use Flarum\Post\CommentPost;
use Flarum\User\Guest;
use Framio\SeoPack\Helpers\MediaTagParser;

/**
 * Son paylaşımlar (fotoğraflı / künyeli mesaj sayfaları): ana sayfanın botlara görünen bloğu ve Atom akışı
 * aynı listeyi kullanır. Yalnızca misafirin görebildiği, kendi sayfası olan mesajlar.
 */
class LatestPosts
{
    public function __construct(protected SeoSettings $seo, protected PostPages $pages)
    {
    }

    /** @return array<int, array{url:string, title:string, image:?string, date:?\Carbon\Carbon, author:string, discussion:string, lines:string[]}> */
    public function get(int $limit = 30): array
    {
        if (!$this->pages->enabled()) return [];
        $out = [];
        CommentPost::whereVisibleTo(new Guest())->where('type', 'comment')->where('number', '>', 1)->whereNull('hidden_at')
            ->with(['discussion', 'user'])->orderByDesc('created_at')->limit($limit * 3)->get()
            ->each(function ($post) use (&$out, $limit) {
                if (count($out) >= $limit || !$post->discussion || !$this->pages->qualifies($post)) return;
                $kunye = $this->pages->kunye($post);
                $img = $this->pages->images($post)[0]['url'] ?? null;
                $out[] = [
                    'url' => $this->pages->url($post),
                    'title' => trim(strip_tags((string) ($kunye['title'] ?? ''))) ?: (string) $post->discussion->title,
                    'image' => $img ? MediaTagParser::toProxyUrl($img, $this->seo->baseUrl(), 'page', $this->seo->imageProxyRules(), $this->seo->get('image_proxy_path')) : null,
                    'date' => $post->created_at,
                    'author' => (string) ($post->user->display_name ?? ''),
                    'discussion' => (string) $post->discussion->title,
                    'lines' => array_values(array_filter(array_map(fn ($l) => trim(strip_tags((string) $l)), $kunye['lines'] ?? []))),
                ];
            });

        return $out;
    }
}
