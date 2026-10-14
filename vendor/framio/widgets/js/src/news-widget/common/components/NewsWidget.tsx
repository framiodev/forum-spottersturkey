import type Mithril from 'mithril';
import app from 'flarum/common/app';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import Stream from 'flarum/common/utils/Stream';
import Widget, { type WidgetAttrs } from '../../../forum-widgets-core/common/components/Widget';

export default class NewsWidget<T extends WidgetAttrs> extends Widget<T> {
  private newslines!: string[];
  private line!: CallableFunction;
  private switching!: boolean;

  oninit(vnode: Mithril.Vnode<T, this>) {
    super.oninit(vnode);

    this.newslines = app.forum.attribute('fof-news-widget.lines');
    this.line = Stream({ index: 0, text: this.newslines[0] });
    this.switching = false;
  }

  className() {
    return 'FoF-NewsWidget';
  }

  icon() {
    return 'fas fa-bullhorn';
  }

  title() {
    return '';
  }

  content(): Mithril.Children {
    if (this.newslines.length > 1 && !this.switching) {
      this.switching = true;

      setTimeout(() => {
        const newLineIndex = (this.line().index + 1) % this.newslines.length;

        this.switching = false;
        this.line({ index: newLineIndex, text: this.newslines[newLineIndex] });
        m.redraw();
      }, 7000);
    }

    let prevLine: string;

    if (this.newslines.length > 1) {
      prevLine = this.newslines[(this.line().index - 1 + this.newslines.length) % this.newslines.length];
    }

    return (
      <div className="FoF-NewsWidget-content">
        <div className="FoF-NewsWidget-icon">
          <Icon name="fas fa-bullhorn" />
        </div>
        <div className="FoF-NewsWidget-line-container">
          {this.newslines.map((line, index) => (
            <div
              className={classList([
                'FoF-NewsWidget-line',
                this.line().index === index ? 'FoF-NewsWidget-line--current' : '',
                prevLine === line ? 'FoF-NewsWidget-line--previous' : '',
              ])}
              key={index}
            >
              {m.trust(line)}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
