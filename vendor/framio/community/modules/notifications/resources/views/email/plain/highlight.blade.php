<x-mail::plain.notification>
<x-slot:body>
{!! ($blueprint->count > 1 ? $blueprint->count . ' yeni paylaşım var. İlki: ' : 'Yeni bir paylaşım var: ') . ($blueprint->label ?: $blueprint->post->discussion->title) !!}

{!! $url->to('forum')->route('discussion', ['id' => $blueprint->post->discussion_id, 'near' => $blueprint->post->number]) !!}
</x-slot:body>
</x-mail::plain.notification>
