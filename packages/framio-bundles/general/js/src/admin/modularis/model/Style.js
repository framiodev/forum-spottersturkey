import Model from 'flarum/common/Model';

export default class Style extends Model {
  name = Model.attribute('name');
  css = Model.attribute('css');
  scope = Model.attribute('scope');
  active = Model.attribute('active');
  sortOrder = Model.attribute('sortOrder');
}
