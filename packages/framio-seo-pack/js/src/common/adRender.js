/**
 * Reklam birimi çizimi — forum ve admin canlı önizlemesi aynı kodu kullanır.
 * opts: { client, label, preview, onImpression, onClick, onClose }
 */
const m = window.m;

const FORMAT_HINT = {
    auto: 'Duyarlı (otomatik boyut)',
    horizontal: 'Yatay şerit (728×90 / 320×100)',
    rectangle: 'Dikdörtgen (300×250 / 336×280)',
    vertical: 'Dikey (160×600 / 300×600)',
    fluid: 'Akışkan (yazı içi)',
};

function runScripts(el) {
    el.querySelectorAll('script').forEach(old => {
        const s = document.createElement('script');
        Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
        s.appendChild(document.createTextNode(old.innerHTML));
        old.parentNode.replaceChild(s, old);
    });
}

function adsenseUnit(ad, opts) {
    if (opts.preview || !opts.client || !ad.adsense_slot) {
        return m('div.FramioAd-placeholder', { className: 'is-' + (ad.adsense_format || 'auto') }, [
            m('i.fab.fa-google'),
            m('b', 'Google AdSense'),
            m('span', FORMAT_HINT[ad.adsense_format] || FORMAT_HINT.auto),
            !ad.adsense_slot ? m('em', 'Reklam birimi (slot) kimliği girilmedi') : m('em', 'Birim ' + ad.adsense_slot)
        ]);
    }

    return m('ins.adsbygoogle', {
        style: 'display:block',
        'data-ad-client': opts.client,
        'data-ad-slot': ad.adsense_slot,
        'data-ad-format': ad.adsense_format === 'fluid' ? 'fluid' : (ad.adsense_format || 'auto'),
        'data-full-width-responsive': 'true',
        oncreate: () => {
            try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
        }
    });
}

function body(ad, opts) {
    if (ad.type === 'image') {
        if (!ad.image_url) return opts.preview ? m('div.FramioAd-placeholder', [m('i.fas.fa-image'), m('b', 'Görsel banner'), m('em', 'Görsel adresi girilmedi')]) : null;
        const img = m('img.FramioAd-img', { src: ad.image_url, alt: ad.name || '', loading: 'lazy' });
        return ad.target_url
            ? m('a', { href: ad.target_url, target: '_blank', rel: 'nofollow noopener sponsored', onclick: opts.onClick }, img)
            : img;
    }

    if (ad.type === 'custom_code') {
        if (!ad.code) return opts.preview ? m('div.FramioAd-placeholder', [m('i.fas.fa-code'), m('b', 'Özel HTML / JS'), m('em', 'Kod girilmedi')]) : null;
        // Önizlemede betikler çalıştırılmaz (yönetim panelinin güvenliği)
        return m('div.FramioAd-code', {
            oncreate: v => { if (!opts.preview) runScripts(v.dom); },
            onclick: opts.onClick
        }, m.trust(ad.code));
    }

    return adsenseUnit(ad, opts);
}

export function renderAd(ad, opts = {}) {
    const content = body(ad, opts);
    if (!content) return null;
    const label = opts.label ? m('div.FramioAd-label', opts.label) : null;

    if (ad.format === 'sticky') {
        return m('div.FramioAd.FramioAd--sticky', { key: 'ad-' + ad.id, oncreate: opts.onImpression, className: opts.preview ? 'is-preview' : '' }, [
            m('button.FramioAd-close', { 'aria-label': 'Kapat', onclick: opts.onClose }, m('i.fas.fa-times')),
            label,
            content
        ]);
    }

    if (ad.format === 'popup') {
        return m('div.FramioAd.FramioAd--popup', { key: 'ad-' + ad.id, className: opts.preview ? 'is-preview' : '', onclick: e => { if (e.target === e.currentTarget && opts.onClose) opts.onClose(); } }, [
            m('div.FramioAd-dialog', { oncreate: opts.onImpression, role: 'dialog', 'aria-label': opts.label || 'Reklam' }, [
                m('button.FramioAd-close', { 'aria-label': 'Kapat', onclick: opts.onClose }, m('i.fas.fa-times')),
                label,
                content
            ])
        ]);
    }

    return m('div.FramioAd.FramioAd--inline', { key: 'ad-' + ad.id, 'data-ad-id': ad.id, oncreate: opts.onImpression, className: 'FramioAd--' + ad.location }, [label, content]);
}
