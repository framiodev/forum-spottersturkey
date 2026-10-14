import app from 'flarum/common/app';
import { BooleanGambit } from 'flarum/common/query/IGambit';

export default class TopPosterGambit extends BooleanGambit {
  key() {
    return app.translator.trans('fof-top-posters-widget.lib.gambits.top_poster.key', {}, true);
  }

  filterKey() {
    return 'top_poster';
  }
}
