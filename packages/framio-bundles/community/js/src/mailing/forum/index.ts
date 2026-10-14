import app from 'flarum/forum/app';
import addMailingLinks from './addMailingLinks';
import addUserDirectoryLink from './addUserDirectoryLink';

export { default as extend } from './extend';

app.initializers.add('framio-mailing', () => {
  addMailingLinks();
  addUserDirectoryLink();
});
