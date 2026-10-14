import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component from 'flarum/common/Component';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LinkButton from 'flarum/common/components/LinkButton';
import Dropdown from 'flarum/common/components/Dropdown';
import extractText from 'flarum/common/utils/extractText';
import HeaderPrimary from 'flarum/forum/components/HeaderPrimary';
import Link from 'flarum/common/components/Link';
import { headerStyleVars } from '../common/headerStyle';

/**
 * Menü yöneticisi (admin → Custom Homepage → Menü Yöneticisi).
 *
 * Ana menü (IndexSidebar.navItems) iki yerde görünür:
 *   - yatay: ana sayfa gibi dikey düzenli sayfalarda üst satır (.Page--vertical)
 *   - dikey: diğer sayfalarda sol kenar menüsü
 *
 * nav_menu ayarı: [{ key, label, icon, top, side, hidden, custom, url, newTab }]  (dizi sırası = menü sırası)
 *   key "__categories": kategorilerin tamamı tek blok
 *     { mode: 'inline' | 'collapsible' | 'dropdown', hiddenTags: [id], label, icon }
 * nav_new_discussion ayarı: { hidden, label, icon, top, side }  ("Bir Tartışma Başlat")
 *
 * Bütün eklentiler menüye öğelerini ekledikten sonra çalışsın diye en düşük
 * öncelikli başlatıcıda kaydedilir.
 */

export const CATEGORY_KEY = '__categories';
const isTagKey = (k) => /^tag\d+$/.test(k) || k === 'separator' || k === 'moreTags';

function json(attr, fallback) {
  try {
    const v = JSON.parse(app.forum.attribute(attr) || '');
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function itemLabel(vnode) {
  try {
    return extractText(vnode && vnode.children).replace(/\s+/g, ' ').trim();
  } catch (e) {
    return '';
  }
}

// ───────────────────────── Keşif: yöneticinin ziyaretinde menü öğeleri kaydedilir

let reported = false;
function reportDiscovered(items) {
  const user = app.session.user;
  if (reported || !user || !user.isAdmin()) return;
  reported = true;

  const all = items.toObject();
  const list = Object.keys(all)
    .filter((k) => !isTagKey(k) && !k.startsWith('framio-custom-') && k !== CATEGORY_KEY)
    .sort((a, b) => (all[b].priority || 0) - (all[a].priority || 0))
    .map((k) => {
      const v = items.get(k);
      return { key: k, label: itemLabel(v), icon: (v && v.attrs && v.attrs.icon) || '' };
    })
    .filter((i) => i.label);
  if (Object.keys(all).some(isTagKey)) list.push({ key: CATEGORY_KEY, label: 'Kategoriler', icon: 'fas fa-tags' });

  const known = json('framioNavDiscovered', []);
  if (JSON.stringify(known) === JSON.stringify(list) || !list.length) return;

  app
    .request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/settings',
      body: { 'framio-custom-homepage.nav_discovered': JSON.stringify(list) },
    })
    .catch(() => {});
}

// ───────────────────────── Yatay / dikey görünürlük (öğenin li'si CSS ile gizlenir)

const visibility = {};
let styleEl = null;
function setVisibility(key, top, side) {
  visibility[key] = { top, side };
}
function flushVisibilityCss() {
  const esc = (k) => (window.CSS && CSS.escape ? CSS.escape(k) : k.replace(/[^a-zA-Z0-9_-]/g, '\\$&'));
  const rules = [];
  Object.keys(visibility).forEach((key) => {
    const { top, side } = visibility[key];
    const sel = `.sideNav .item-${esc(key)}`;
    if (top === false) rules.push(`.Page--vertical ${sel}{display:none!important}`);
    if (side === false) rules.push(`.Page:not(.Page--vertical) ${sel}{display:none!important}`);
  });
  const css = rules.join('\n');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'framio-nav-menu-visibility';
    document.head.appendChild(styleEl);
  }
  if (styleEl.textContent !== css) styleEl.textContent = css;
}

// ───────────────────────── Kategoriler: açılır / katlanır görünüm

function tagHelpers() {
  let TagLinkButton = null;
  let sortTags = null;
  try {
    const t = flarum.reg.get('flarum-tags', 'forum/components/TagLinkButton');
    TagLinkButton = t && (t.default || t);
    const s = flarum.reg.get('flarum-tags', 'common/utils/sortTags');
    sortTags = s && (s.default || s);
  } catch (e) {}
  return { TagLinkButton, sortTags };
}

const openParents = new Set();

class CategoryMenu extends Component {
  tagLink(tag, extraClass = '') {
    const { TagLinkButton } = tagHelpers();
    const current = app.currentTag && app.currentTag();
    const active = current === tag || (current && current.parent && current.parent() === tag);
    const params = app.search && app.search.state ? app.search.state.stickyParams() : {};
    return TagLinkButton ? (
      <TagLinkButton model={tag} params={params} active={active} className={extraClass}>
        {tag.name()}
      </TagLinkButton>
    ) : (
      <LinkButton href={app.route('tag', { tags: tag.slug() })} icon={tag.icon() || 'fas fa-tag'} className={extraClass}>
        {tag.name()}
      </LinkButton>
    );
  }

  tree() {
    const hidden = (this.attrs.hiddenTags || []).map(String);
    const { sortTags } = tagHelpers();
    let tags = app.store.all('tags').filter((t) => t.position() !== null && !hidden.includes(String(t.id())));
    if (sortTags) tags = sortTags(tags);
    const parentOf = (t) => (t.parent && t.parent() ? t.parent() : null);
    // Üst kategoriler; alt kategoriler yalnızca görünen üst kategorinin altında
    const tops = tags.filter((t) => !parentOf(t));
    return tops.map((t) => ({ tag: t, children: tags.filter((c) => parentOf(c) === t) }));
  }

  view() {
    const { mode, label, icon } = this.attrs;
    const tree = this.tree();
    const current = app.currentTag && app.currentTag();

    if (mode === 'dropdown') {
      const entries = [];
      tree.forEach(({ tag, children }) => {
        entries.push(this.tagLink(tag));
        children.forEach((c) => entries.push(this.tagLink(c, 'Framio-CatChild')));
      });
      return (
        <Dropdown className="Framio-CatDropdown" buttonClassName="Button Button--link hasIcon" label={label || 'Kategoriler'} icon={icon || 'fas fa-tags'} accessibleToggleLabel={label || 'Kategoriler'}>
          {entries}
        </Dropdown>
      );
    }

    // Açılır-kapanır: üst kategori + ok; alt kategoriler oka basınca görünür
    return (
      <ul className="Framio-CatTree">
        {tree.map(({ tag, children }) => {
          const hasActiveChild = current && children.includes(current);
          const open = openParents.has(tag.id()) || hasActiveChild || current === tag;
          return (
            <li className={'Framio-CatTree-Item' + (open ? ' is-open' : '')} key={tag.id()}>
              <div className="Framio-CatTree-Row">
                {this.tagLink(tag)}
                {children.length ? (
                  <button
                    className="Framio-CatTree-Toggle"
                    title={open ? 'Alt kategorileri gizle' : 'Alt kategorileri göster'}
                    onclick={(e) => {
                      e.preventDefault();
                      open ? openParents.delete(tag.id()) : openParents.add(tag.id());
                    }}
                  >
                    <i className={open ? 'fas fa-chevron-up' : 'fas fa-chevron-down'}></i>
                  </button>
                ) : null}
              </div>
              {children.length && open ? (
                <ul className="Framio-CatTree-Children">
                  {children.map((c) => <li key={c.id()}>{this.tagLink(c)}</li>)}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }
}

// ───────────────────────── Uygulama

function applyCategories(items, c, priority) {
  const tagKeys = Object.keys(items.toObject()).filter(isTagKey);
  const hidden = (c.hidden || (c.top === false && c.side === false));
  if (hidden) {
    tagKeys.forEach((k) => items.remove(k));
    return;
  }

  const mode = c.mode || 'inline';
  if (mode === 'inline') {
    // Forumun kendi sırası korunur, blok olarak konumlanır
    const all = items.toObject();
    const hiddenTags = (c.hiddenTags || []).map(String);
    tagKeys
      .sort((a, b) => (all[b].priority || 0) - (all[a].priority || 0))
      .forEach((k, i) => {
        const id = (k.match(/^tag(\d+)$/) || [])[1];
        if (id && hiddenTags.includes(id)) return items.remove(k);
        items.setPriority(k, priority - (i + 1) * 0.01);
        setVisibility(k, c.top, c.side);
      });
    return;
  }

  tagKeys.forEach((k) => items.remove(k));
  items.add(CATEGORY_KEY, <CategoryMenu mode={mode} label={c.label} icon={c.icon} hiddenTags={c.hiddenTags || []} />, priority);
  setVisibility(CATEGORY_KEY, c.top, c.side);
}

function applyNavMenu(items) {
  reportDiscovered(items);

  const cfg = json('framioNavMenu', []).filter((c) => c && c.key && !isTagKey(c.key));
  if (!cfg.length) return;

  cfg.forEach((c, i) => {
    const priority = 1000 - i * 10;

    // Kategoriler her zaman menü öğelerinin sonunda
    if (c.key === CATEGORY_KEY) return applyCategories(items, c, 1000 - (cfg.length + 1) * 10);

    // Özel bağlantı
    if (c.custom) {
      if (c.hidden || !c.url) return;
      const internal = c.url.startsWith('/');
      const href = internal ? app.forum.attribute('baseUrl').replace(/\/$/, '') + c.url : c.url;
      items.add(
        c.key,
        <LinkButton href={href} icon={c.icon || 'fas fa-link'} external={!internal || !!c.newTab} target={c.newTab ? '_blank' : undefined}>
          {c.label || c.url}
        </LinkButton>,
        priority
      );
      withChildren(items, c);
      setVisibility(c.key, c.top, c.side);
      return;
    }

    if (!items.has(c.key)) return;
    if (c.hidden) {
      items.remove(c.key);
      return;
    }

    const v = items.get(c.key);
    if (v && v.tag && (c.label || c.icon)) {
      const attrs = { ...(v.attrs || {}) };
      if (c.icon) attrs.icon = c.icon;
      items.setContent(c.key, m(v.tag, attrs, c.label ? c.label : v.children));
    }
    items.setPriority(c.key, priority);
    withChildren(items, c);
    setVisibility(c.key, c.top, c.side);
  });
}

/** "Bir Tartışma Başlat" düğmesi */
function applyNewDiscussion(items) {
  const c = json('framioNavNewDiscussion', {});
  if (!items.has('newDiscussion') || !c) return;
  if (c.hidden) {
    items.remove('newDiscussion');
    return;
  }
  const v = items.get('newDiscussion');
  if (v && v.tag && (c.label || c.icon)) {
    const attrs = { ...(v.attrs || {}) };
    if (c.icon) attrs.icon = c.icon;
    items.setContent('newDiscussion', m(v.tag, attrs, c.label ? c.label : v.children));
  }
  setVisibility('newDiscussion', c.top, c.side);
}

// ───────────────────────── Alt öğeler ve header menüsü
//
// Her menü öğesinin "children" alanı olabilir: [{ label, url, icon, newTab, hidden }]
//   sol (dikey) menü : üst öğenin altında girintili
//   yatay menü/header: üst öğenin üzerine gelince / tıklayınca açılan kutu
//   ☰ menü           : üst öğenin altında girintili
//
// nav_header ayarı:
//   { position: 'page' | 'header' | 'subheader' | 'hamburger',
//     align, icons, allPages, showLabel,
//     source: 'same' | 'custom',   same = Menü Öğeleri ("Yatay" işaretliler), custom = items
//     items: [ { key, label, icon, hidden, custom, url, newTab, children } ] }
// Header menüsü her sayfada ayardaki listeden kurulur; sayfanın kendi menüsüne bağlı değildir.

function basePath() {
  return (app.forum.attribute('basePath') || '').replace(/\/$/, '');
}

function linkFor(url) {
  const internal = url && url.startsWith('/');
  return { href: internal ? basePath() + url : url, external: !internal };
}

function isActive(href) {
  if (!href) return false;
  try {
    const u = new URL(href, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    return u.pathname === window.location.pathname && (u.search || '') === (window.location.search || '');
  } catch (e) {
    return false;
  }
}

function childEntries(c) {
  return (c.children || [])
    .filter((ch) => ch && !ch.hidden && ch.url)
    .map((ch) => ({ ...linkFor(ch.url), label: ch.label || ch.url, icon: ch.icon || '', newTab: !!ch.newTab }));
}

/** Menü öğesinin altındaki alt öğeler (sayfadaki menüde) */
class NavGroup extends Component {
  view() {
    const kids = this.attrs.entries;
    return (
      <div className="Framio-NavGroup">
        {this.attrs.main}
        <ul className="Framio-NavChildren">
          {kids.map((ch, i) => (
            <li key={i}>
              <LinkButton href={ch.href} icon={ch.icon || 'fas fa-angle-right'} external={ch.external || ch.newTab} target={ch.newTab ? '_blank' : undefined} active={isActive(ch.href)}>
                {ch.label}
              </LinkButton>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}

/** applyNavMenu içinde: alt öğesi olan girdiyi gruba çevir */
function withChildren(items, c) {
  const kids = childEntries(c);
  if (!kids.length || !items.has(c.key)) return;
  items.setContent(c.key, <NavGroup main={items.get(c.key)} entries={kids} />);
}

export function headerConfig() {
  const c = json('framioNavHeader', {}) || {};
  return { position: 'page', align: 'center', icons: true, allPages: true, showLabel: true, source: 'same', items: [], ...c };
}

function navList() {
  const fake = Object.create(IndexSidebar.prototype);
  fake.attrs = {};
  try {
    return IndexSidebar.prototype.navItems.call(fake);
  } catch (e) {
    return null;
  }
}

function categoryEntries(c) {
  const hidden = ((c && c.hiddenTags) || []).map(String);
  const { sortTags } = tagHelpers();
  let tags = app.store.all('tags').filter((t) => t.position() !== null && !hidden.includes(String(t.id())));
  if (sortTags) tags = sortTags(tags);
  const parentOf = (t) => (t.parent && t.parent() ? t.parent() : null);
  const out = [];
  tags.filter((t) => !parentOf(t)).forEach((t) => {
    out.push({ label: t.name(), icon: t.icon() || 'fas fa-tag', href: app.route('tag', { tags: t.slug() }) });
    tags.filter((k) => parentOf(k) === t).forEach((k) => out.push({ label: k.name(), icon: k.icon() || 'fas fa-tag', href: app.route('tag', { tags: k.slug() }), indent: true }));
  });
  return out;
}

/** Ayardaki bir girdiyi bağlantıya çevirir (sayfadan bağımsız) */
function resolveEntry(c, list) {
  if (!c || c.hidden || isTagKey(c.key)) return null;
  if (c.key === CATEGORY_KEY) {
    return { key: c.key, label: (c.mode === 'dropdown' && c.label) || c.label || 'Kategoriler', icon: c.icon || 'fas fa-tags', href: app.route('tags'), children: categoryEntries(c) };
  }
  if (c.custom) {
    if (!c.url) return null;
    return { key: c.key, label: c.label || c.url, icon: c.icon || 'fas fa-link', ...linkFor(c.url), newTab: !!c.newTab, children: childEntries(c) };
  }
  const v = list && list.has(c.key) ? list.get(c.key) : null;
  const main = v && v.attrs && v.attrs.main ? v.attrs.main : v; // alt öğeli grup
  if (!main || !main.attrs || !main.attrs.href) return null;
  return { key: c.key, label: c.label || itemLabel(main), icon: c.icon || main.attrs.icon || '', href: main.attrs.href, children: childEntries(c) };
}

function headerEntries() {
  const h = headerConfig();
  const list = navList();
  let source;
  if (h.source === 'custom') source = h.items || [];
  else {
    source = json('framioNavMenu', []).filter((c) => c && c.top !== false && !isTagKey(c.key));
    // Menü Yöneticisi kaydedilmemişse forumun kendi sırası
    if (!source.length && list) {
      const all = list.toObject();
      source = Object.keys(all)
        .filter((k) => !isTagKey(k))
        .sort((a, b) => (all[b].priority || 0) - (all[a].priority || 0))
        .map((k) => ({ key: k }));
    }
  }
  return source.map((c) => resolveEntry(c, list)).filter(Boolean);
}

function entryLink(e, cls, withIcon) {
  return (
    <Link href={e.href} external={e.external || e.newTab} target={e.newTab ? '_blank' : undefined} className={cls + (isActive(e.href) ? ' active' : '') + (e.indent ? ' is-indent' : '')}>
      {withIcon && e.icon ? <i className={'icon ' + e.icon}></i> : null}
      <span>{e.label}</span>
    </Link>
  );
}

// Header'daki menüler Flarum'un taşma listesinde (OverflowingList) durur; o liste
// öğeleri ilk çizimdeki hâliyle sakladığı için bileşen durumu değişince yeniden
// çizilmez. Bu yüzden açılır kutular her zaman çizilir, açma/kapama doğrudan
// CSS sınıfıyla yapılır.
function closeAllMenus(except) {
  document.querySelectorAll('.Framio-Burger.is-open, .Framio-HNav-item.is-open').forEach((el) => {
    if (!except || !el.contains(except)) el.classList.remove('is-open');
  });
  document.querySelectorAll('.Framio-Burger-toggle[aria-expanded="true"]').forEach((b) => {
    if (!except || !b.closest('.Framio-Burger').contains(except)) b.setAttribute('aria-expanded', 'false');
  });
}

let menuListeners = false;
function ensureMenuListeners() {
  if (menuListeners) return;
  menuListeners = true;
  document.addEventListener('click', (e) => {
    const inside = e.target.closest && e.target.closest('.Framio-Burger, .Framio-HNav');
    // Menüdeki bir bağlantıya tıklanınca da kapanır
    if (!inside || (e.target.closest && e.target.closest('.Framio-Burger-panel a, .Framio-HNav-drop a'))) closeAllMenus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllMenus();
  });
}

function toggleClass(el, cls) {
  if (!el) return false;
  const on = !el.classList.contains(cls);
  el.classList.toggle(cls, on);
  return on;
}

/** Header / şerit menüsü: yatay çubuk, alt öğeler açılır kutuda (üzerine gelince veya oka basınca) */
class HeaderBar extends Component {
  oncreate(vnode) {
    super.oncreate(vnode);
    ensureMenuListeners();
  }

  view() {
    const { entries, icons, variant, align } = this.attrs;
    return (
      <nav className={'Framio-HNav Framio-HNav--' + variant + ' Framio-HNav--' + (align || 'center')}>
        <ul className="Framio-HNav-list">
          {entries.map((e, i) => {
            const kids = e.children || [];
            return (
              <li key={e.key || i} className={'Framio-HNav-item' + (kids.length ? ' has-children' : '')}>
                <div className="Framio-HNav-row">
                  {entryLink(e, 'Framio-HNav-link', icons)}
                  {kids.length ? (
                    <button
                      className="Framio-HNav-caret"
                      aria-label="Alt menüyü aç"
                      onclick={(ev) => {
                        ev.preventDefault();
                        ev.redraw = false;
                        const li = ev.currentTarget.closest('.Framio-HNav-item');
                        closeAllMenus(li);
                        toggleClass(li, 'is-open');
                      }}
                    >
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  ) : null}
                </div>
                {kids.length ? <div className="Framio-HNav-drop">{kids.map((k) => entryLink(k, 'Framio-HNav-droplink', true))}</div> : null}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
}

/** Üç çizgi (☰) açılır menü */
class HamburgerMenu extends Component {
  oncreate(vnode) {
    super.oncreate(vnode);
    ensureMenuListeners();
  }

  view() {
    const { entries, icons, showLabel } = this.attrs;
    return (
      <div className="Framio-Burger">
        <button
          className="Button Button--flat Framio-Burger-toggle"
          aria-expanded="false"
          aria-label="Menü"
          onclick={(e) => {
            e.redraw = false;
            const root = e.currentTarget.closest('.Framio-Burger');
            closeAllMenus(root);
            const on = toggleClass(root, 'is-open');
            e.currentTarget.setAttribute('aria-expanded', on ? 'true' : 'false');
          }}
        >
          <span className="Framio-Burger-lines"><span></span><span></span><span></span></span>
          {showLabel ? <span className="Framio-Burger-text">Menü</span> : null}
        </button>
        <div className="Framio-Burger-panel">
          <ul>
            {entries.map((e, i) => {
              const kids = e.children || [];
              return (
                <li key={e.key || i} className={kids.length ? 'has-children' : ''}>
                  <div className="Framio-Burger-row">
                    {entryLink(e, 'Framio-Burger-link', icons)}
                    {kids.length ? (
                      <button
                        className="Framio-Burger-caret"
                        aria-label="Alt öğeler"
                        onclick={(ev) => {
                          ev.redraw = false;
                          toggleClass(ev.currentTarget.closest('li'), 'is-open');
                        }}
                      >
                        <i className="fas fa-chevron-down"></i>
                      </button>
                    ) : null}
                  </div>
                  {kids.length ? <div className="Framio-Burger-sub">{kids.map((k) => entryLink(k, 'Framio-Burger-sublink', true))}</div> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
}

function isVerticalPage() {
  return !!document.querySelector('.Page--vertical');
}

/**
 * Header menüsü görünümü (admin → Menü Yöneticisi → Header Görünümü).
 * nav_header.style değerleri CSS değişkenlerine ve body sınıflarına çevrilir;
 * admin önizlemesi aynı değişkenleri kullanır.
 */
let styleVarsEl = null;
function applyHeaderStyle(c) {
  const { vars, classes } = headerStyleVars(c.style);
  const css = ':root{' + Object.keys(vars).map((k) => k + ':' + String(vars[k]).replace(/[;{}<>]/g, '')).join(';') + '}';
  if (!styleVarsEl) {
    styleVarsEl = document.createElement('style');
    styleVarsEl.id = 'framio-header-nav-style';
    document.head.appendChild(styleVarsEl);
  }
  if (styleVarsEl.textContent !== css) styleVarsEl.textContent = css;
  document.body.className = document.body.className.replace(/\bfnav-[a-z]+-[a-z]+\b/g, '').trim();
  classes.forEach((k) => document.body.classList.add(k));
}
/** Ana sayfa öğesi: "tags" (Flarum etiketler = ana sayfa) ya da sitenin köküne giden bağlantı */
function isHomeEntry(e) {
  if (!e) return false;
  if (e.key === 'tags') return true;
  try {
    const u = new URL(e.href, window.location.origin);
    return u.origin === window.location.origin && u.pathname.replace(/\/$/, '') === basePath() && !u.search;
  } catch (err) {
    return false;
  }
}

/** Logonun solundaki ev ikonu (header düz HTML olduğu için DOM'a eklenir) */
function syncHomeIcon(entry) {
  let el = document.querySelector('.Framio-HomeIcon');
  if (!entry) {
    if (el) el.remove();
    return;
  }
  const title = document.querySelector('.Header-title');
  if (!title) return;
  if (!el) {
    el = document.createElement('a');
    el.className = 'Framio-HomeIcon';
    el.addEventListener('click', (ev) => {
      const href = el.getAttribute('href') || '';
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || /^https?:/.test(href.replace(window.location.origin, ''))) return;
      ev.preventDefault();
      m.route.set(href.replace(window.location.origin, '').replace(basePath(), '') || '/');
    });
    title.parentNode.insertBefore(el, title);
  }
  el.setAttribute('href', entry.href);
  el.setAttribute('title', entry.label);
  el.setAttribute('aria-label', entry.label);
  el.classList.toggle('active', isActive(entry.href));
  const icon = entry.icon || 'fas fa-home';
  if (el.dataset.icon !== icon) {
    el.dataset.icon = icon;
    el.innerHTML = '<i class="' + icon.replace(/[^a-z0-9 _-]/gi, '') + '" aria-hidden="true"></i>';
  }
}

/**
 * Header menülerinde "seçili" vurgusu: header öğeleri yeniden çizilmediği için
 * adres her değiştiğinde (sayfa geçişi, geri/ileri) sınıflar doğrudan güncellenir.
 */
function refreshActive() {
  document
    .querySelectorAll('.Framio-HNav-link, .Framio-HNav-droplink, .Framio-Burger-link, .Framio-Burger-sublink, .Framio-HomeIcon')
    .forEach((a) => a.classList.toggle('active', isActive(a.getAttribute('href'))));
}

let activeWatcher = false;
function watchActive() {
  if (activeWatcher) return;
  activeWatcher = true;
  // Sayfa çizildikten sonra (rAF arka plan sekmesinde çalışmadığı için setTimeout)
  const fire = () => {
    setTimeout(refreshActive, 0);
    setTimeout(refreshActive, 250);
  };
  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function (...args) {
      const r = orig.apply(this, args);
      fire();
      return r;
    };
  });
  window.addEventListener('popstate', fire);
}

function applyHeader(items) {
  const c = headerConfig();
  const pos = c.position;
  document.body.classList.toggle('Framio-NavInHeader', pos === 'header' || pos === 'hamburger');
  document.body.classList.toggle('Framio-NavSubheader', pos === 'subheader');
  document.body.classList.toggle('Framio-NavHeaderAll', !!c.allPages);
  if (pos === 'page' || (!c.allPages && !isVerticalPage())) {
    syncHomeIcon(null);
    return;
  }

  applyHeaderStyle(c);
  const st = headerStyleVars(c.style).style;

  // Ana Sayfa header'da menüde değil, logonun solunda yalnızca ikon olarak durur
  const all = headerEntries();
  const home = all.find(isHomeEntry);
  syncHomeIcon(st.homeIcon ? home : null);
  watchActive();
  setTimeout(refreshActive, 0);
  const entries = st.homeIcon ? all.filter((e) => e !== home) : all;
  if (!entries.length) return;

  if (pos === 'hamburger') {
    items.add('framio-burger', <HamburgerMenu entries={entries} icons={c.icons !== false} showLabel={c.showLabel !== false} />, 100);
  } else if (pos === 'header') {
    items.add('framio-hnav', <HeaderBar entries={entries} icons={c.icons !== false} variant="header" align="left" />, 50);
  } else {
    items.add('framio-subnav', <HeaderBar entries={entries} icons={c.icons !== false} variant="subheader" align={c.align} />, -1000);
  }
}

export default function registerNavMenu() {
  // En son çalışsın: diğer eklentilerin eklediği öğeler de yönetilsin
  app.initializers.add(
    'framio-custom-homepage-navmenu',
    () => {
      extend(IndexSidebar.prototype, 'navItems', function (items) {
        applyNavMenu(items);
        flushVisibilityCss();
      });
      extend(IndexSidebar.prototype, 'items', function (items) {
        applyNewDiscussion(items);
        flushVisibilityCss();
      });
      extend(HeaderPrimary.prototype, 'items', function (items) {
        applyHeader(items);
      });
    },
    -1000
  );
}
