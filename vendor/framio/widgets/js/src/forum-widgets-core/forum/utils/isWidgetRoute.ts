import app from 'flarum/forum/app';

/**
 * Widget bölümlerinin gösterileceği sayfalar: tartışma listesi sayfaları
 * (Tüm Tartışmalar ve kategori sayfaları; ikisi de aynı IndexPage bileşenidir).
 * FoF'ta yalnızca "index" rotasıydı; kategori sayfalarında widget çıkmıyordu.
 */
export default function isWidgetRoute(): boolean {
  const name = (app.current && (app.current.data as any) && (app.current.data as any).routeName) || '';
  return name === 'index' || name === 'tag';
}
