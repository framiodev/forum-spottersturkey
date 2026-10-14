import app from 'flarum/common/app';
import type Mithril from 'mithril';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Widget, { type WidgetAttrs } from '../../../forum-widgets-core/common/components/Widget';
import type User from 'flarum/common/models/User';
import Link from 'flarum/common/components/Link';
import extractText from 'flarum/common/utils/extractText';
import type { ApiResponsePlural } from 'flarum/common/Store';

export default class TopPostersWidget extends Widget<WidgetAttrs> {
  private monthlyCounts!: Record<string, number>;
  protected loadWithInitialResponse!: boolean;

  oninit(vnode: Mithril.Vnode): void {
    super.oninit(vnode);

    this.monthlyCounts = app.forum.attribute('fof-top-posters-widget.topPosterCounts');
    this.loadWithInitialResponse = app.forum.attribute('fof-forum-widgets-core.preferDataWithInitialLoad');
    this.attrs.state.users ??= [];
    this.attrs.state.isLoading ??= true;
    this.attrs.state.hasLoaded ??= false;
  }

  oncreate(vnode: Mithril.Vnode): void {
    super.oncreate(vnode);

    if (!this.attrs.state.hasLoaded) {
      this.load();
    }
  }

  className(): string {
    return 'FoF-TopPostersWidget';
  }

  icon(): string {
    return 'fas fa-sort-numeric-down';
  }

  title(): string {
    return extractText(app.translator.trans('fof-top-posters-widget.forum.widget.title'));
  }

  description(): string {
    return '';
  }

  content(): Mithril.Children {
    if (this.attrs.state.isLoading) {
      return <LoadingIndicator />;
    }

    const users = (this.attrs.state.users as User[]).sort((a: User, b: User) => this.monthlyCounts[b.id()!] - this.monthlyCounts[a.id()!]);

    return (
      <div className="FoF-TopPostersWidget-users">
        {users.map((user: User) => (
          <Link href={app.route('user', { username: user.slug() })} className="FoF-TopPostersWidget-users-item">
            <div className="FoF-TopPostersWidget-users-item-avatar">
              <Avatar user={user} />
            </div>
            <div className="FoF-TopPostersWidget-users-item-content">
              <div className="FoF-TopPostersWidget-users-item-name">{user.displayName()}</div>
              <div className="FoF-TopPostersWidget-users-item-value">
                <Icon name="fas fa-comment-dots" /> {this.monthlyCounts[user.id()!]}
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  load(): void {
    if (this.loadWithInitialResponse) {
      this.setResults((app.forum as any).topPosters() as User[]);

      return;
    }

    this.attrs.state.isLoading = true;

    (app.store.find<User[]>('users', { filter: { top_poster: 'true' } }) as Promise<ApiResponsePlural<User>>).then((users) => {
      this.setResults(users);
    });
  }

  setResults(users: User[]): void {
    this.attrs.state.users = users;
    this.attrs.state.isLoading = false;
    this.attrs.state.hasLoaded = true;
    m.redraw();
  }
}
