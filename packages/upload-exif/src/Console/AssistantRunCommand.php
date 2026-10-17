<?php

namespace Framio\UploadExif\Console;

use Carbon\Carbon;
use Flarum\Api\JsonApi;
use Flarum\Api\Resource\PostResource;
use Flarum\Console\AbstractCommand;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Framio Asistan planlı paylaşımları: zamanı gelen kayıtları kullanıcı adına (onun izinleriyle)
 * paylaşır ve kullanıcının asistan sohbetine haber bırakır. Flarum zamanlayıcısıyla (schedule:run)
 * dakikada bir ya da cron ile doğrudan çalışır.
 */
class AssistantRunCommand extends AbstractCommand
{
    public function __construct(protected ConnectionInterface $db, protected JsonApi $api)
    {
        parent::__construct();
    }

    protected function configure()
    {
        $this->setName('media:assistant-run')->setDescription('Framio Asistan planlı paylaşımlarını zamanı gelince yayımlar.');
    }

    protected function fire(): int
    {
        if (!$this->db->getSchemaBuilder()->hasTable('framio_assistant_schedule')) return 0;

        $due = $this->db->table('framio_assistant_schedule')->where('status', 'pending')->where('publish_at', '<=', Carbon::now())
            ->orderBy('publish_at')->limit(60)->get();
        if ($due->isEmpty()) return 0;

        $report = []; // user_id => [başlık => adet]
        foreach ($due as $row) {
            // Aynı kayıt iki kez yayımlanmasın: önce "çalışıyor" olarak işaretle
            $claimed = $this->db->table('framio_assistant_schedule')->where('id', $row->id)->where('status', 'pending')->update(['status' => 'running']);
            if (!$claimed) continue;

            $user = User::find($row->user_id);
            try {
                if (!$user) throw new \RuntimeException('Kullanıcı bulunamadı');
                $post = $this->api->forResource(PostResource::class)->forEndpoint('create')->process([
                    'data' => [
                        'type' => 'posts',
                        'attributes' => ['content' => $row->content],
                        'relationships' => ['discussion' => ['data' => ['type' => 'discussions', 'id' => (string) $row->discussion_id]]],
                    ],
                ], [], ['actor' => $user]);
                $this->db->table('framio_assistant_schedule')->where('id', $row->id)->update(['status' => 'done', 'post_id' => $post->id]);
                $title = (string) $this->db->table('discussions')->where('id', $row->discussion_id)->value('title');
                $report[$row->user_id][$title] = ($report[$row->user_id][$title] ?? 0) + 1;
            } catch (\Throwable $e) {
                $this->db->table('framio_assistant_schedule')->where('id', $row->id)->update(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 190)]);
                $this->error("#{$row->id}: " . $e->getMessage());
            }
        }

        // Kullanıcıya haber: asistan sohbetine okunmamış bir not
        foreach ($report as $userId => $titles) {
            $total = array_sum($titles);
            $parts = [];
            foreach ($titles as $t => $n) $parts[] = "$t ($n)";
            $left = $this->db->table('framio_assistant_schedule')->where('user_id', $userId)->where('status', 'pending')->count();
            $this->db->table('framio_assistant_messages')->insert([
                'user_id' => $userId,
                'role' => 'notice',
                'text' => "Planlı paylaşım: $total fotoğraf paylaşıldı — " . implode(', ', $parts) . '.' . ($left ? " Sırada $left paylaşım var." : ' Plan tamamlandı.'),
                'seen' => false,
                'created_at' => Carbon::now(),
            ]);
            $this->info("Kullanıcı #$userId: $total paylaşım.");
        }

        return 0;
    }
}
