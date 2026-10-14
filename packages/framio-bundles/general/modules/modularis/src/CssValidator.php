<?php

namespace Stezkoy\FlarumModularis;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\Translator;

class CssValidator
{
    /**
     * Forbidden constructs. Keys are regex patterns, values are translation keys.
     *
     * Patterns are applied to a copy of the CSS with block comments already
     * stripped, so comment-based obfuscation (e.g. the string
     * "java" + block-comment + "script:" or "at" + block-comment + "import")
     * can't sneak past them.
     */
    private const FORBIDDEN_PATTERNS = [
        '~</\s*style~i'       => 'error_closing_tag',
        '~</\s*(?:script|iframe|object|embed)~i' => 'error_script',
        '~<\s*(?:script|iframe|object|embed|meta|link)~i' => 'error_script',
        '/@\s*import/i'       => 'error_import',
        '/@\s*charset/i'      => 'error_import',
        '~javascript\s*:~i'   => 'error_script',
        '~expression\s*\(~i'  => 'error_script',
        '~url\s*\(\s*(?:\'|")?\s*(?:data|vbscript|javascript)\s*:~i' => 'error_data_uri',
        '~[\\\]x?[0-9a-f]{1,6}\s*javascript~i' => 'error_script',
    ];

    public function __construct(
        private readonly Translator $translator,
    ) {
    }

    public function assertValid(?string $css): void
    {
        $css = (string) $css;

        // Reject raw `<` (XSS/HTML breakout backstop). Any angle bracket found
        // outside a quoted string or comment can break out of the <style> tag.
        if ($this->containsSymbolOutOfContext($css, '<')) {
            throw $this->error('error_closing_tag');
        }

        // Re-close quotes early since @import/@charset/url() only make sense
        // outside of strings, and use a comment-stripped copy for the checks.
        $plain = $this->stripComments($css);

        foreach (self::FORBIDDEN_PATTERNS as $pattern => $kind) {
            if (preg_match($pattern, $plain)) {
                throw $this->error($kind);
            }
        }

        if (!$this->isBalanced($css)) {
            throw $this->error('error_syntax');
        }
    }

    private function error(string $kind): ValidationException
    {
        return new ValidationException(['css' => $this->translator->trans('stezkoy-modularis.admin.' . $kind)]);
    }

    /**
     * Returns true if the given single character appears outside of single/double
     * quotes and block comments.
     */
    private function containsSymbolOutOfContext(string $css, string $symbol): bool
    {
        $len = strlen($css);
        $state = 'normal';

        for ($i = 0; $i < $len; $i++) {
            $char = $css[$i];

            if ($state === 'block-comment') {
                if ($char === '*' && $i + 1 < $len && $css[$i + 1] === '/') {
                    $state = 'normal';
                    $i++;
                }
                continue;
            }

            if ($state === 'single') {
                if ($char === '\\' && $i + 1 < $len) {
                    $i++;
                } elseif ($char === "'") {
                    $state = 'normal';
                }
                continue;
            }

            if ($state === 'double') {
                if ($char === '\\' && $i + 1 < $len) {
                    $i++;
                } elseif ($char === '"') {
                    $state = 'normal';
                }
                continue;
            }

            if ($char === $symbol) {
                return true;
            }

            switch ($char) {
                case "'":
                    $state = 'single';
                    break;
                case '"':
                    $state = 'double';
                    break;
                case '/':
                    if ($i + 1 < $len && $css[$i + 1] === '*') {
                        $state = 'block-comment';
                        $i++;
                    }
                    break;
            }
        }

        return false;
    }

    /**
     * Remove `/* ... *\/` comments from the CSS, so obfuscated payloads like
     * `java/**\/script:` become visible to the pattern checks.
     */
    private function stripComments(string $css): string
    {
        return preg_replace('~/\\*.*?\\*/~s', '', $css) ?? $css;
    }

    /**
     * Check that braces, parens and quotes are balanced, ignoring their
     * contents when they live inside quoted strings or comments.
     */
    private function isBalanced(string $css): bool
    {
        $len = strlen($css);
        $braces = 0;
        $parens = 0;
        $state = 'normal'; // normal | single | double | block-comment

        for ($i = 0; $i < $len; $i++) {
            $char = $css[$i];

            if ($state === 'block-comment') {
                if ($char === '*' && $i + 1 < $len && $css[$i + 1] === '/') {
                    $state = 'normal';
                    $i++;
                }
                continue;
            }

            if ($state === 'single') {
                if ($char === '\\' && $i + 1 < $len) {
                    $i++;
                    continue;
                }
                if ($char === "'") {
                    $state = 'normal';
                }
                continue;
            }

            if ($state === 'double') {
                if ($char === '\\' && $i + 1 < $len) {
                    $i++;
                    continue;
                }
                if ($char === '"') {
                    $state = 'normal';
                }
                continue;
            }

            switch ($char) {
                case '{':
                    $braces++;
                    break;
                case '}':
                    $braces--;
                    break;
                case '(':
                    $parens++;
                    break;
                case ')':
                    $parens--;
                    break;
                case "'":
                    $state = 'single';
                    break;
                case '"':
                    $state = 'double';
                    break;
                case '/':
                    if ($i + 1 < $len && $css[$i + 1] === '*') {
                        $state = 'block-comment';
                        $i++;
                    }
                    break;
            }

            if ($braces < 0 || $parens < 0) {
                return false;
            }
        }

        return $braces === 0 && $parens === 0 && $state === 'normal';
    }
}
