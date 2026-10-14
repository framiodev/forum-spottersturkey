<?php

namespace Stezkoy\FlarumModularis;

use Flarum\Database\AbstractModel;

/**
 * @property int         $id
 * @property string      $name
 * @property string      $css
 * @property bool        $active
 * @property string      $scope      'forum' | 'admin'
 * @property int         $sort_order
 */
class Style extends AbstractModel
{
    /**
     * Cache keys, one per scope. Each holds the array of pre-rendered
     * active styles for that scope.
     */
    public const CACHE_KEY_PREFIX = 'modularis_styles';

    public const VALID_SCOPES = ['forum', 'admin'];

    protected $table = 'modularis_styles';

    public $timestamps = true;

    protected $fillable = [
        'name',
        'css',
        'active',
        'scope',
        'sort_order',
    ];

    protected $casts = [
        'active'     => 'boolean',
        'sort_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function cacheKey(string $scope): string
    {
        return self::CACHE_KEY_PREFIX . '.' . $scope;
    }

    public static function cacheKeys(): array
    {
        return array_map([self::class, 'cacheKey'], self::VALID_SCOPES);
    }
}
