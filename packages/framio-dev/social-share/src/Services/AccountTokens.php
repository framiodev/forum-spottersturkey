<?php

namespace Framio\SocialShare\Services;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Meta hesap jetonlarını sunucuda tutar: foruma yalnızca ad/kimlik alanları gider,
 * paylaşım isteklerinde jeton kimliklere göre ayarlardan bulunur.
 */
class AccountTokens
{
    const SECRET_FIELDS = ['token', 'threads_token', 'access_token', 'app_secret'];

    public static function publicJson($value): string
    {
        $accounts = json_decode((string) $value, true);
        if (!is_array($accounts)) {
            return '[]';
        }

        $public = [];
        foreach ($accounts as $acc) {
            if (!is_array($acc)) {
                continue;
            }
            foreach (array_keys($acc) as $field) {
                if (in_array($field, self::SECRET_FIELDS, true) || preg_match('/token|secret|key/i', $field)) {
                    unset($acc[$field]);
                }
            }
            $public[] = $acc;
        }

        return json_encode($public, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * Verilen sayfa / Instagram / Threads kimliğiyle eşleşen hesabı döndürür.
     */
    public static function find(SettingsRepositoryInterface $settings, ?string $pageId, ?string $igId, ?string $threadsId = null): ?array
    {
        $accounts = json_decode((string) $settings->get('framio-social-share.accounts_json', '[]'), true);
        if (!is_array($accounts)) {
            return null;
        }

        foreach ($accounts as $acc) {
            if (!is_array($acc)) {
                continue;
            }
            if (($pageId && (string) ($acc['page_id'] ?? '') === (string) $pageId)
                || ($igId && (string) ($acc['ig_id'] ?? '') === (string) $igId)
                || ($threadsId && (string) ($acc['threads_id'] ?? '') === (string) $threadsId)) {
                return $acc;
            }
        }

        return null;
    }
}
