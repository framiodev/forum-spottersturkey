<?php

namespace Framio\SeoPack\Support;

use Flarum\Frontend\Document;
use Flarum\Frontend\Driver\TitleDriverInterface;
use Flarum\Locale\TranslatorInterface;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Çekirdek başlık sürücüsünün yerine geçer:
 *  - İç sayfalarda forum adı yerine admin'deki kısa "başlık soneki" kullanılabilir (Google ~60 karakterde keser).
 *  - SEO eklentisi bir sayfa için tam başlık belirlediyse (ör. bölüm başlığı geçersiz kılma) olduğu gibi kullanılır.
 * Ayar boşsa davranış çekirdekle birebir aynıdır.
 */
class SeoTitleDriver implements TitleDriverInterface
{
    /** Bu istek için tam (soneksiz değiştirilmez) başlık */
    public static ?string $fullTitle = null;

    public function __construct(protected TranslatorInterface $translator, protected SeoSettings $seo)
    {
    }

    public function makeTitle(Document $document, ServerRequestInterface $request, array $forumApiDocument): string
    {
        if (self::$fullTitle !== null) {
            $title = self::$fullTitle;
            self::$fullTitle = null;

            return $title;
        }

        $forumName = (string) Arr::get($forumApiDocument, 'data.attributes.title');
        $onHomePage = rtrim($request->getUri()->getPath(), '/') === '';
        $suffix = trim($this->seo->get('title_suffix'));

        $params = [
            'pageTitle' => $document->title ?? '',
            'forumName' => (!$onHomePage && $suffix !== '') ? $suffix : $forumName,
            'pageNumber' => $document->page ?? 1,
        ];

        return $onHomePage || !$document->title
            ? $this->translator->trans('core.lib.meta_titles.without_page_title', ['forumName' => $forumName] + $params)
            : $this->translator->trans('core.lib.meta_titles.with_page_title', $params);
    }
}
