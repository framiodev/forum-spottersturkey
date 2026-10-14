import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';

function sortTags(tags: any[]) {
  return tags.slice().sort((a, b) => {
    const aPos = a.position !== undefined && a.position() !== null ? a.position() : 0;
    const bPos = b.position !== undefined && b.position() !== null ? b.position() : 0;
    return aPos - bPos;
  });
}

const getParentId = (tag: any): string | null => {
  if (!tag) return null;
  const p = tag.parent ? tag.parent() : null;
  if (p && p.id && p.id()) return String(p.id());
  const rawRelId = tag.data?.relationships?.parent?.data?.id;
  if (rawRelId) return String(rawRelId);
  const attrParentId = tag.attribute ? tag.attribute('parentId') : null;
  if (attrParentId) return String(attrParentId);
  return null;
};

export default function initForum() {
  const IndexSidebar = flarum.reg.get('core', 'forum/components/IndexSidebar');
  const TagHero = flarum.reg.get('flarum-tags', 'forum/components/TagHero');
  const TagLinkButton: any = flarum.reg.get('flarum-tags', 'forum/components/TagLinkButton');

  // 1. Sol Sidebar'da (IndexSidebar) hiyerarşik etiket gösterimi:
  // Mevcut aktif etiketin tüm soy ağacını (ancestors) ve çocuklarını göster
  if (IndexSidebar) {
    extend(IndexSidebar.prototype, 'navItems', function (items: any) {
      if (!items) return;
      if (app.current.get('noTagsList')) return;

      const currentTag: any = app.currentTag ? app.currentTag() : null;
      const allTags: any[] = app.store.all('tags') || [];
      const stickyParams = app.search.state.stickyParams();

      // Aktif etiketin soy ağacındaki tüm ID'leri topla
      const activeHierarchyIds = new Set<string>();
      if (currentTag) {
        let curr: any = currentTag;
        while (curr) {
          activeHierarchyIds.add(String(curr.id()));
          const pId = getParentId(curr);
          curr = pId ? app.store.getById('tags', pId) : null;
        }
      }

      // Sidebar'da gösterilecek etiketler:
      // - Ana etiketler (parent'ı olmayanlar)
      // - VEYA üst etiketi aktif hiyerarşide bulunanlar (çocuklar, torunlar vb.)
      const isVisibleInHierarchy = (tag: any): boolean => {
        const pId = getParentId(tag);
        if (!pId) return true; // Ana etiket her zaman görünür
        if (!currentTag) return false; // Hiçbir etiket seçili değilse sadece ana etiketler
        // Eğer bu etiketin parent'ı aktif hiyerarşide ise görünür
        return activeHierarchyIds.has(String(pId));
      };

      // flarum-tags'in eklediği tagX öğelerini temizleyip derinlik girintili (indented) olarak yeniden dizelim
      allTags.forEach((t: any) => {
        if (items.has('tag' + t.id())) {
          items.remove('tag' + t.id());
        }
      });

      // Etiketin derinlik seviyesini hesapla (0 = ana etiket, 1 = alt etiket, 2 = 3. seviye...)
      const getDepth = (tag: any): number => {
        let depth = 0;
        let pId = getParentId(tag);
        while (pId) {
          depth++;
          const pTag: any = app.store.getById('tags', pId);
          pId = pTag ? getParentId(pTag) : null;
        }
        return depth;
      };

      // Tüm birincil etiketleri hiyerarşik (pre-order DFS) sırada düzenle:
      // Her ebeveyn etiketin hemen ardına kendi alt dalları gelsin
      const buildHierarchicalList = (parentId: string | null): any[] => {
        const result: any[] = [];
        const directChildren = allTags.filter((t: any) => {
          if (t.position === undefined || t.position() === null) return false;
          const pId = getParentId(t);
          return (parentId === null && !pId) || (pId === parentId);
        });

        // Pozisyona göre sırala
        directChildren.sort((a: any, b: any) => {
          const aPos = a.position !== undefined && a.position() !== null ? a.position() : 0;
          const bPos = b.position !== undefined && b.position() !== null ? b.position() : 0;
          return aPos - bPos;
        });

        directChildren.forEach((child: any) => {
          result.push(child);
          // Alt çocukları hemen bu etiketin peşine ekle
          const subChildren = buildHierarchicalList(String(child.id()));
          subChildren.forEach((sub: any) => result.push(sub));
        });

        return result;
      };

      const orderedTags = buildHierarchicalList(null);

      let priority = -14;
      orderedTags.forEach((tag: any) => {
        if (!isVisibleInHierarchy(tag)) return;

        const isActive = currentTag && String(currentTag.id()) === String(tag.id());
        const depth = getDepth(tag);
        const depthClass = depth > 0 ? ` TagLinkButton--depth-${depth}` : '';

        if (TagLinkButton) {
          items.add(
            'tag' + tag.id(),
            <TagLinkButton
              model={tag}
              params={stickyParams}
              active={isActive}
              className={'TagLinkButton--deep' + depthClass}
            >
              {tag.name()}
            </TagLinkButton>,
            priority
          );
          // Sıralamanın bozulmaması için her elemana azalan öncelik ver
          priority -= 0.01;
        }
      });
    });
  }

  // 2. TagHero içinde kırıntı (Breadcrumb) navigasyonu gösterimi:
  // Karayolu > Otobüsler > Şehirlerarası Otobüsler
  if (TagHero) {
    extend(TagHero.prototype, 'contentItems', function (items: any) {
      const tag: any = this.attrs.model;
      if (!tag) return;

      // Soy ağacını kökten bu etikete doğru topla
      const trail: any[] = [];
      let pId = getParentId(tag);
      while (pId) {
        const p: any = app.store.getById('tags', pId);
        if (p) {
          trail.unshift(p);
          pId = getParentId(p);
        } else {
          break;
        }
      }

      items.add(
        'deep-tag-breadcrumbs',
        <nav className="DeepTags-breadcrumbs" aria-label="Kategori Yolu">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <a href={app.route('index')}>
                <i className="fas fa-home" /> Forum
              </a>
            </li>
            {trail.map((ancestor: any) => (
              <li className="breadcrumb-item" key={ancestor.id()}>
                <a href={app.route('tag', { tags: ancestor.slug() })}>
                  {ancestor.name()}
                </a>
              </li>
            ))}
            <li className="breadcrumb-item active" aria-current="page">
              {tag.name()}
            </li>
          </ol>
        </nav>,
        80 // Başlık (100) ve Açıklamanın (90) altına yerleştir
      );
    });
  }
}
