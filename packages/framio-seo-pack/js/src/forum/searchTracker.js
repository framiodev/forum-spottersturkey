import { extend } from 'flarum/common/extend';
import Search from 'flarum/forum/components/Search';
import app from 'flarum/forum/app';

let lastTrackedQuery = '';
let debounceTimer = null;

function trackSearchQuery(query) {
    const q = (query || '').trim();
    if (!q || q.length < 2 || q === lastTrackedQuery) return;
    
    lastTrackedQuery = q;

    m.request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/seo/searches',
        headers: { 'X-CSRF-Token': app.session.csrfToken },
        body: {
            query: q
        }
    }).catch(() => {});
}

export default function () {
    // Intercept search input/submit in Flarum search component
    extend(Search.prototype, 'oncreate', function (vnode) {
        const input = vnode.dom.querySelector('input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(debounceTimer);
                    trackSearchQuery(input.value);
                }
            });

            input.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (input.value && input.value.trim().length >= 3) {
                        trackSearchQuery(input.value);
                    }
                }, 1500);
            });
        }
    });
}
