import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import IndexPage from 'flarum/forum/components/IndexPage';

app.initializers.add('justoverclock/flarum-ext-socialcards', () => {
  extend(IndexPage.prototype, 'view', function (vdom) {
    if (vdom.children && vdom.children.splice)
      if (app.forum.attribute('ShowFacebook') === true) {
        const insert = m('div', { class: 'sticky-icon' }, [
          m('a', { class: 'Facebook', href: app.forum.attribute('fblink'), target: '_blank' }, [
            m('i', { class: 'fab fa-facebook-f' }),
            ' Facebook ',
          ]),
        ]);
        vdom.children.splice(1, 0, insert);
      }
    if (app.forum.attribute('ShowYoutube') === true) {
      const insert = m('div', { class: 'sticky-iconyt' }, [
        m('a', { class: 'Youtube', href: app.forum.attribute('ytlink'), target: '_blank' }, [m('i', { class: 'fab fa-youtube' }), ' Youtube ']),
      ]);
      vdom.children.splice(2, 0, insert);
    }
    if (app.forum.attribute('ShowTwitter') === true) {
      const insert = m('div', { class: 'sticky-icontw' }, [
        m('a', { class: 'Twitter', href: app.forum.attribute('twlink'), target: '_blank' }, [m('i', { class: 'fab fa-twitter' }), ' Twitter ']),
      ]);
      vdom.children.splice(3, 0, insert);
    }
    if (app.forum.attribute('ShowGithub') === true) {
      const insert = m('div', { class: 'sticky-icongh' }, [
        m('a', { class: 'Github', href: app.forum.attribute('ghlink'), target: '_blank' }, [m('i', { class: 'fab fa-github-alt' }), ' GitHub ']),
      ]);
      vdom.children.splice(4, 0, insert);
    }
  });
});
