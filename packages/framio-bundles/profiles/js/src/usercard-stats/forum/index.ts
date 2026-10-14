import app from 'flarum/forum/app';
import extendUserCard from './extend/extendUserCard';

app.initializers.add('fof-usercard-stats', () => {
  extendUserCard();
});
