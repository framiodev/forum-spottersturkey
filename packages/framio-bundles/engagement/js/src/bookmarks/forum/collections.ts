import app from 'flarum/forum/app';

export interface BookmarkCollection {
  id: number;
  name: string;
  count: number;
  cover: string | null;
}

/** Kullanıcının yer imi kitaplıkları (sayfa boyunca tek kopya) */
const collections = {
  list: null as BookmarkCollection[] | null,
  loading: null as Promise<BookmarkCollection[]> | null,

  url(path = ''): string {
    return app.forum.attribute('apiUrl') + '/framio/bookmark-collections' + path;
  },

  load(force = false): Promise<BookmarkCollection[]> {
    if (this.list && !force) return Promise.resolve(this.list);
    if (this.loading && !force) return this.loading;
    this.loading = app.request<{ collections: BookmarkCollection[] }>({ method: 'GET', url: this.url() }).then((res) => this.set(res));

    return this.loading;
  },

  set(res: { collections: BookmarkCollection[] }): BookmarkCollection[] {
    this.list = res.collections || [];
    this.loading = null;
    m.redraw();

    return this.list;
  },

  create(name: string): Promise<number> {
    return app.request<any>({ method: 'POST', url: this.url(), body: { name } }).then((res) => {
      this.set(res);

      return res.id as number;
    });
  },

  rename(id: number, name: string): Promise<BookmarkCollection[]> {
    return app.request<any>({ method: 'PATCH', url: this.url('/' + id), body: { name } }).then((res) => this.set(res));
  },

  remove(id: number): Promise<BookmarkCollection[]> {
    return app.request<any>({ method: 'DELETE', url: this.url('/' + id) }).then((res) => this.set(res));
  },

  /** Mesajı kitaplığa kaydeder (yer imine de ekler); null: kitaplıktan çıkar, yer imi kalır */
  assign(post: any, collectionId: number | null): Promise<void> {
    return app.request<any>({ method: 'POST', url: this.url('/assign'), body: { post_id: post.id(), collection_id: collectionId } }).then((res) => {
      this.set(res);
      post.pushAttributes({ bookmarked: true, bookmarkCollectionId: collectionId });
    });
  },
};

export default collections;
