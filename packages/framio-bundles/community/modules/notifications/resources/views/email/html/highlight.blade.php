<x-mail::html.notification>
    <x-slot:body>
        {!! $formatter->convert(($blueprint->count > 1 ? $blueprint->count . ' yeni paylaşım var. İlki: ' : 'Yeni bir paylaşım var: ') . '**' . e($blueprint->label ?: $blueprint->post->discussion->title) . '**' . "\n\n" . '[Forumda görüntüle](' . $url->to('forum')->route('discussion', ['id' => $blueprint->post->discussion_id, 'near' => $blueprint->post->number]) . ')') !!}
    </x-slot:body>

    <x-slot:preview>
        {!! $blueprint->post->formatContent() !!}
    </x-slot:preview>
</x-mail::html.notification>
