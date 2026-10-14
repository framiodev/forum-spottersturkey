export { default as extend } from './extend';
import app from 'flarum/admin/app';
import registerWidget from '../common/registerWidget';

app.initializers.add('fof/top-posters-widget', () => {
  registerWidget();
});
