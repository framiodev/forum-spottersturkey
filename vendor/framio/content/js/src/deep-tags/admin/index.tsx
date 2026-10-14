import app from 'flarum/admin/app';
import { extend, override } from 'flarum/common/extend';
import Stream from 'flarum/common/utils/Stream';
import Select from 'flarum/common/components/Select';
import Button from 'flarum/common/components/Button';

function sortTags(tags: any[]) {
  return (tags || []).slice().sort((a, b) => {
    const aPos = a.position !== undefined && a.position() !== null ? a.position() : 0;
    const bPos = b.position !== undefined && b.position() !== null ? b.position() : 0;
    return aPos - bPos;
  });
}

// Her türlü veri yapısından (model ilişkisi, attribute veya raw jsonapi data) parentId'yi güvenle çöz
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

// tagIcon helper'ı flarum-tags modülünden güvenle çöz
const tagIcon = (tag: any) => {
  const helper: any = flarum.reg.get('flarum-tags', 'common/helpers/tagIcon');
  return helper ? helper(tag) : null;
};

function patchEditTagModal(EditTagModal: any) {
  if (!EditTagModal || EditTagModal._deepTagsPatched) return;
  EditTagModal._deepTagsPatched = true;

  // 1. EditTagModal başlatılırken parentId state'i ekle (varsa attrs.parentId öncelikli)
  extend(EditTagModal.prototype, 'oninit', function (this: any) {
    const pId = this.attrs.parentId || getParentId(this.tag);
    this.parentId = Stream(pId ? String(pId) : '');
  });

  // 2. EditTagModal fields() listesine "Üst Kategori / Etiket" seçim dropdown'ı ekle
  extend(EditTagModal.prototype, 'fields', function (this: any, items: any) {
    if (!items || typeof items.add !== 'function') return;

    if (!this.parentId) {
      const pId = this.attrs.parentId || getParentId(this.tag);
      this.parentId = Stream(pId ? String(pId) : '');
    }

    const allTags: any[] = app.store.all('tags') || [];

    // Döngüsel bağımlılığı önlemek için etiketin kendisini ve alt soyunu hariç tut
    const excludeIds = new Set<string>();
    if (this.tag && this.tag.exists) {
      excludeIds.add(String(this.tag.id()));
      const collectDescendants = (parentId: string) => {
        allTags.forEach((t: any) => {
          const pId = getParentId(t);
          if (pId === parentId) {
            excludeIds.add(String(t.id()));
            collectDescendants(String(t.id()));
          }
        });
      };
      collectDescendants(String(this.tag.id()));
    }

    // Hiyerarşik ağaç şeklinde seçenekleri oluştur
    const noParentTrans = app.translator.trans('framio-content.admin.deep_tags.no_parent');
    const noParentStr = (Array.isArray(noParentTrans) ? noParentTrans.join('') : String(noParentTrans)) || '(Yok - Ana Kategori)';

    const options: Record<string, string> = {
      '': noParentStr,
    };

    const addTagOptions = (parentId: string | null, depth: number) => {
      const children = allTags.filter((t: any) => {
        if (excludeIds.has(String(t.id()))) return false;
        const pId = getParentId(t);
        return (parentId === null && !pId) || (pId === parentId);
      });

      // Konuma göre sırala
      children.sort((a: any, b: any) => {
        const aPos = a.position !== undefined && a.position() !== null ? a.position() : 0;
        const bPos = b.position !== undefined && b.position() !== null ? b.position() : 0;
        return aPos - bPos;
      });

      children.forEach((child: any) => {
        const prefix = depth > 0 ? '— '.repeat(depth) : '';
        options[String(child.id())] = prefix + child.name();
        addTagOptions(String(child.id()), depth + 1);
      });
    };

    addTagOptions(null, 0);

    const labelTrans = app.translator.trans('framio-content.admin.deep_tags.parent_tag_label');
    const labelStr = (Array.isArray(labelTrans) ? labelTrans.join('') : String(labelTrans)) || 'Üst Kategori / Etiket';

    const helpTrans = app.translator.trans('framio-content.admin.deep_tags.parent_help');
    const helpStr = (Array.isArray(helpTrans) ? helpTrans.join('') : String(helpTrans)) || 'Bu etiketi istediğiniz herhangi bir ana veya alt kategorinin altına bağlayabilirsiniz.';

    items.add(
      'parentTag',
      <div className="Form-group DeepTags-parentGroup">
        <label>{labelStr}</label>
        <div className="helpText">{helpStr}</div>
        <Select
          value={this.parentId ? this.parentId() : ''}
          options={options}
          onchange={(val: string) => {
            if (this.parentId) this.parentId(val);
            if (val && this.isPrimary) {
              this.isPrimary(true);
            }
          }}
        />
      </div>,
      35
    );
  });

  // 3. submitData içine relationships ekle (Flarum 2 JSON:API şemasında parentId attribute değil, parent relationship'tir)
  extend(EditTagModal.prototype, 'submitData', function (this: any, data: any) {
    const selectedParentId = this.parentId ? this.parentId() : null;
    data.relationships = data.relationships || {};
    if (selectedParentId) {
      const parentModel = app.store.getById('tags', selectedParentId);
      data.relationships.parent = parentModel || { data: { type: 'tags', id: selectedParentId } };
      data.isPrimary = true;
    } else {
      data.relationships.parent = null;
    }
    // NOT: data.parentId koymuyoruz çünkü tobyz/json-api-server TagResource şemasında "Unknown field [parentId]" hatası verir.
    return data;
  });
}

function patchTagsPage(TagsPage: any, EditTagModal: any) {
  if (!TagsPage || TagsPage._deepTagsPatched) return;
  TagsPage._deepTagsPatched = true;

  // TagsPage başlatılırken etiketlerin tüm ilişkilerini yükle
  extend(TagsPage.prototype, 'oninit', function (this: any) {
    this.collapsedTags = this.collapsedTags || new Set<string>();
    if (app.tagList && typeof app.tagList.load === 'function') {
      app.tagList.load(['parent', 'children']).then(() => {
        m.redraw();
      });
    }
  });

  const getEditModal = () => flarum.reg.get('flarum-tags', 'admin/components/EditTagModal') || EditTagModal;

  // tagItem'ın iç içe sınırsız seviye ve basamak sistemiyle çalışabilmesi için özel render fonksiyonu
  const renderTagItem = function (this: any, tag: any, depth: number = 0): any {
    if (!tag) return null;
    const tagId = String(tag.id());
    const allTags = app.store.all('tags') || [];
    const children = sortTags(allTags).filter((child: any) => {
      const pId = getParentId(child);
      return pId === tagId;
    });

    this.collapsedTags = this.collapsedTags || new Set<string>();
    const isCollapsed = this.collapsedTags.has(tagId);

    return (
      <li
        data-id={tag.id()}
        key={tag.id()}
        className={`TagListItem-node DeepTags-node DeepTags-node--depth-${depth} ${children.length > 0 ? 'has-children' : 'no-children'}`}
      >
        <div
          className="TagListItem-info DeepTags-row"
          onclick={() => {
            const modal = getEditModal();
            if (modal) app.modal.show(modal, { model: tag });
          }}
        >
          {/* 1. Sürükleme Tutamacı (Drag Handle) */}
          <span className="DeepTags-dragHandle" title="Taşımak veya sıralamak için sürükleyin" onclick={(e: any) => e.stopPropagation()}>
            <i className="fas fa-grip-vertical" />
          </span>

          {/* 2. Daralt / Genişlet oku */}
          {children.length > 0 ? (
            <button
              type="button"
              className="DeepTags-toggleBtn"
              onclick={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.collapsedTags.has(tagId)) {
                  this.collapsedTags.delete(tagId);
                } else {
                  this.collapsedTags.add(tagId);
                }
                m.redraw();
              }}
              title={isCollapsed ? 'Alt kategorileri göster' : 'Alt kategorileri gizle'}
            >
              <i className={`fas fa-caret-${isCollapsed ? 'right' : 'down'}`} />
            </button>
          ) : (
            <span className="DeepTags-toggleSpace" />
          )}

          {/* 3. Etiket Simgesi ve Adı */}
          <div className="DeepTags-tagMain">
            {depth > 0 && (
              <span className="DeepTags-branchArrow" title="Alt Kategori">
                <i className="fas fa-level-up-alt fa-rotate-90" />
              </span>
            )}
            {tagIcon(tag)}
            <span className="TagListItem-name DeepTags-tagName" style={{ color: tag.color() || 'inherit' }}>
              {tag.name()}
            </span>
          </div>

          {/* 4. Alt Dal Sayısı Rozeti */}
          {children.length > 0 && (
            <span className="DeepTags-subBadge" title={`${children.length} alt kategori`}>
              {children.length} alt dal
            </span>
          )}

          {/* 5. İşlem Butonları: Hızlı Alt Kategori Ekle, Düzenle ve Seviye Yükselt */}
          <div className="DeepTags-actions" onclick={(e: any) => e.stopPropagation()}>
            {depth > 0 && (
              <button
                type="button"
                className="DeepTags-actionBtn DeepTags-promoteBtn"
                title="Bir üst seviyeye taşı"
                aria-label="Seviye Yükselt"
                onclick={(e: any) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const parent = tag.parent ? tag.parent() : null;
                  const grandparent = parent && typeof parent.parent === 'function' ? parent.parent() : null;
                  app.request({
                    method: 'PATCH',
                    url: `${app.forum.attribute('apiUrl')}/tags/${tag.id()}`,
                    body: {
                      data: {
                        type: 'tags',
                        id: String(tag.id()),
                        relationships: {
                          parent: grandparent
                            ? { data: { type: 'tags', id: String(grandparent.id()) } }
                            : { data: null },
                        },
                      },
                    },
                  }).then(() => {
                    if (app.tagList && typeof app.tagList.load === 'function') {
                      app.tagList.load(['parent', 'children']).then(() => {
                        this.forcedRefreshKey++;
                        m.redraw();
                      });
                    } else {
                      this.forcedRefreshKey++;
                      m.redraw();
                    }
                  });
                }}
              >
                <i className="fas fa-outdent" />
              </button>
            )}
            <button
              type="button"
              className="DeepTags-actionBtn DeepTags-addBtn"
              title="Bu kategorinin altına yeni alt kategori ekle"
              aria-label="Alt Kategori Ekle"
              onclick={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                const modal = getEditModal();
                if (modal) {
                  app.modal.show(modal, { primary: true, parentId: tagId });
                }
              }}
            >
              <i className="fas fa-plus" />
            </button>
            <button
              type="button"
              className="DeepTags-actionBtn DeepTags-editBtn"
              title={app.translator.trans('flarum-tags.admin.tags.edit_tag_label', { tag: tag.name() })}
              aria-label={app.translator.trans('flarum-tags.admin.tags.edit_tag_label', { tag: tag.name() })}
              onclick={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                const modal = getEditModal();
                if (modal) {
                  app.modal.show(modal, { model: tag });
                }
              }}
            >
              <i className="fas fa-pencil-alt" />
            </button>
          </div>
        </div>

        {/* 6. Alt Dallar (Basamak Çizgili Ağaç ve Sürükle-Bırak Hedefi) */}
        {!isCollapsed && (
          <ol className={`TagListItem-children TagList DeepTags-treeList ${children.length === 0 ? 'DeepTags-treeList--empty' : ''}`}>
            {children.map((child: any) => renderTagItem.call(this, child, depth + 1))}
          </ol>
        )}
      </li>
    );
  };

  // TagsPage.content override edilerek birincil etiketler ağacı sınırsız derinlikte render edilir
  override(TagsPage.prototype, 'content', function (this: any, original: any) {
    if (this.loading) {
      return original();
    }

    const primaryLabel = app.translator.trans('flarum-tags.admin.tag_settings.required_primary_heading');
    const secondaryLabel = app.translator.trans('flarum-tags.admin.tag_settings.required_secondary_heading');

    const minPrimaryTags = this.setting('flarum-tags.min_primary_tags', 0, primaryLabel);
    const maxPrimaryTags = this.setting('flarum-tags.max_primary_tags', 0, primaryLabel);

    const minSecondaryTags = this.setting('flarum-tags.min_secondary_tags', 0, secondaryLabel);
    const maxSecondaryTags = this.setting('flarum-tags.max_secondary_tags', 0, secondaryLabel);

    // Kök seviyesindeki ana etiketler (parent'ı olmayanlar)
    const allTags: any[] = app.store.all('tags') || [];
    const rootPrimaryTags = sortTags(
      allTags.filter((tag: any) => {
        const pId = getParentId(tag);
        return !pId && tag.position() !== null;
      })
    );

    const secondaryTags = allTags
      .filter((tag: any) => {
        const pId = getParentId(tag);
        return !pId && tag.position() === null;
      })
      .sort((a: any, b: any) => a.name().localeCompare(b.name()));

    const FormSectionGroup = flarum.reg.get('core', 'admin/components/FormSectionGroup');
    const FormSection = flarum.reg.get('core', 'admin/components/FormSection');
    const Form = flarum.reg.get('core', 'common/components/Form');
    const withAttr = flarum.reg.get('core', 'common/utils/withAttr');

    return (
      <div className="TagsContent DeepTags-adminPage">
        <div className="TagsContent-list">
          <div className="container" key={this.forcedRefreshKey} oncreate={this.onListOnCreate.bind(this)}>
            <FormSectionGroup>
              <FormSection
                className="TagGroup DeepTags-primarySection"
                label={app.translator.trans('flarum-tags.admin.tags.primary_heading')}
                help="Forum ana kategorileri ve basamaklı alt kategori hiyerarşisi."
              >
                <ol className="TagList TagList--primary DeepTags-rootTree">
                  {rootPrimaryTags.length > 0 ? (
                    rootPrimaryTags.map((tag: any) => renderTagItem.call(this, tag, 0))
                  ) : (
                    <div className="DeepTags-emptyNotice">
                      <i className="fas fa-sitemap" />
                      <p>Henüz birincil kategori eklenmemiş. Aşağıdaki butondan ilk ana kategorinizi oluşturabilirsiniz.</p>
                    </div>
                  )}
                </ol>
                <Button className="Button TagList-button DeepTags-createBtn" icon="fas fa-plus" onclick={() => {
                  const modal = getEditModal();
                  if (modal) app.modal.show(modal, { primary: true });
                }}>
                  {app.translator.trans('flarum-tags.admin.tags.create_primary_tag_button')}
                </Button>
              </FormSection>

              <FormSection
                className="TagGroup TagGroup--secondary DeepTags-secondarySection"
                label={app.translator.trans('flarum-tags.admin.tags.secondary_heading')}
                help="Genel konu etiketleri (alt kategori içermeyen serbest etiketler)."
              >
                <ul className="TagList DeepTags-secondaryList">
                  {secondaryTags.map((tag: any) => renderTagItem.call(this, tag, 0))}
                </ul>
                <Button className="Button TagList-button" icon="fas fa-plus" onclick={() => {
                  const modal = getEditModal();
                  if (modal) app.modal.show(modal, { primary: false });
                }}>
                  {app.translator.trans('flarum-tags.admin.tags.create_secondary_tag_button')}
                </Button>
              </FormSection>

              <FormSection label={app.translator.trans('flarum-tags.admin.tags.settings_heading')}>
                <Form>
                  <div className="Form-group">
                    <label>{app.translator.trans('flarum-tags.admin.tag_settings.required_primary_heading')}</label>
                    <div className="helpText">{app.translator.trans('flarum-tags.admin.tag_settings.required_primary_text')}</div>
                    <div className="TagSettings-rangeInput">
                      <input
                        className="FormControl"
                        type="number"
                        min="0"
                        value={minPrimaryTags()}
                        oninput={withAttr('value', this.setMinTags.bind(this, minPrimaryTags, maxPrimaryTags))}
                      />
                      {app.translator.trans('flarum-tags.admin.tag_settings.range_separator_text')}
                      <input className="FormControl" type="number" min={minPrimaryTags()} bidi={maxPrimaryTags} />
                    </div>
                  </div>
                  <div className="Form-group">
                    <label>{app.translator.trans('flarum-tags.admin.tag_settings.required_secondary_heading')}</label>
                    <div className="helpText">{app.translator.trans('flarum-tags.admin.tag_settings.required_secondary_text')}</div>
                    <div className="TagSettings-rangeInput">
                      <input
                        className="FormControl"
                        type="number"
                        min="0"
                        value={minSecondaryTags()}
                        oninput={withAttr('value', this.setMinTags.bind(this, minSecondaryTags, maxSecondaryTags))}
                      />
                      {app.translator.trans('flarum-tags.admin.tag_settings.range_separator_text')}
                      <input className="FormControl" type="number" min={minSecondaryTags()} bidi={maxSecondaryTags} />
                    </div>
                  </div>
                  <div className="Form-group Form-controls">
                    {this.submitButton()}
                    {this.resetButton()}
                  </div>
                </Form>
              </FormSection>
            </FormSectionGroup>
            <div className="TagsContent-footer">
              <p>{app.translator.trans('flarum-tags.admin.tags.about_tags_text')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  });

  override(TagsPage.prototype, 'onSortUpdate', function (this: any, original: any, e: any) {
    if (e.from instanceof HTMLOListElement && e.to instanceof HTMLUListElement) {
      const movedTag = app.store.getById('tags', e.item.getAttribute('data-id'));
      if (movedTag) {
        movedTag.pushData({
          attributes: { position: null, isChild: false },
          relationships: { parent: null },
        });
      }
    }

    const getTree = ($container: any): any[] => {
      const result: any[] = [];
      $container.children('li').each(function (this: any) {
        const $li = $(this);
        const id = $li.data('id');
        if (id) {
          const $childList = $li.children('ol.TagListItem-children');
          const children = $childList.length ? getTree($childList) : [];
          result.push({
            id: id,
            children: children,
          });
        }
      });
      return result;
    };

    const primaryTree = getTree(this.$('.TagList--primary'));

    const updateStoreRecursively = (items: any[], parentModel: any | null) => {
      items.forEach((item, index) => {
        const tagModel: any = app.store.getById('tags', item.id);
        if (tagModel) {
          tagModel.pushData({
            attributes: {
              position: index,
              isChild: !!parentModel,
            },
            relationships: {
              parent: parentModel ? { data: { type: 'tags', id: parentModel.id() } } : null,
            },
          });

          if (item.children && item.children.length) {
            updateStoreRecursively(item.children, tagModel);
          }
        }
      });
    };

    updateStoreRecursively(primaryTree, null);

    app.request({
      url: app.forum.attribute('apiUrl') + '/tags/order',
      method: 'POST',
      body: { order: primaryTree },
    });

    this.forcedRefreshKey++;
    m.redraw();
  });

  override(TagsPage.prototype, 'onListOnCreate', function (this: any) {
    if (!this.sortable) return;
    this.$('.TagList').each((_: any, el: HTMLElement) => {
      this.sortable.create(el, {
        group: {
          name: 'tags',
          pull: true,
          put: true,
        },
        handle: '.DeepTags-dragHandle',
        delay: 50,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        animation: 180,
        fallbackOnBody: true,
        invertSwap: true,
        swapThreshold: 0.5,
        emptyInsertThreshold: 30,
        dragClass: 'sortable-dragging',
        ghostClass: 'sortable-placeholder',
        onStart: () => {
          document.body.classList.add('DeepTags-isDragging');
        },
        onEnd: () => {
          document.body.classList.remove('DeepTags-isDragging');
        },
        onSort: (evt: any) => this.onSortUpdate(evt),
      });
    });
  });
}

export default function initAdmin() {
  const tryPatch = () => {
    const EditTagModal: any = flarum.reg.get('flarum-tags', 'admin/components/EditTagModal');
    const TagsPage: any = flarum.reg.get('flarum-tags', 'admin/components/TagsPage');
    if (EditTagModal) patchEditTagModal(EditTagModal);
    if (TagsPage) patchTagsPage(TagsPage, EditTagModal);
  };

  // 1. flarum.reg.onLoad ile flarum-tags modülleri hazır olduğunda otomatik bağla
  flarum.reg.onLoad('flarum-tags', 'admin/components/EditTagModal', (EditTagModal: any) => {
    patchEditTagModal(EditTagModal);
  });
  flarum.reg.onLoad('flarum-tags', 'admin/components/TagsPage', (TagsPage: any) => {
    const EditTagModal: any = flarum.reg.get('flarum-tags', 'admin/components/EditTagModal');
    patchTagsPage(TagsPage, EditTagModal);
  });

  // 2. Modüller zaten yüklüyse hemen bağla
  tryPatch();

  // 3. Flarum app initializer aşamasında da tekrar garanti et
  app.initializers.add('framio-deep-tags-admin', () => {
    tryPatch();
  });
}
