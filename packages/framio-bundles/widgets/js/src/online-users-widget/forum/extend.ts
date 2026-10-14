import Extend from 'flarum/common/extenders';
import Forum from 'flarum/common/models/Forum';
import User from 'flarum/common/models/User';
import OnlineUsersPage from './components/OnlineUsersPage';

export default [
  // Çevrimiçi üyelerin tamamı ve ne yaptıkları
  new Extend.Routes().add('framio.online', '/cevrimici', OnlineUsersPage),

  new Extend.Model(Forum) //
    .attribute<number>('totalOnlineUsers')
    .hasMany<User>('onlineUsers'),

  // Profil kartında "şu an ne yapıyor" (yalnızca tek kullanıcı gösterilirken gelir)
  new Extend.Model(User).attribute<any>('framioActivity'),
];
