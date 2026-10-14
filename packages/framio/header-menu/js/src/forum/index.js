import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HeaderPrimary from 'flarum/forum/components/HeaderPrimary';

app.initializers.add('spottersturkey-header-menu', () => {
    extend(HeaderPrimary.prototype, 'items', function(items) {
        let links = [];
        try {
            const settings = app.forum.attribute('spottersturkey-header-menu.links');
            if (settings) {
                links = JSON.parse(settings);
            }
        } catch (e) {
            links = [];
        }

        if (links && links.length > 0) {
            const menuHtml = (
                <div className="CustomHeaderMenu">
                    {links.map((link, i) => {
                        const hasSublinks = link.sublinks && link.sublinks.length > 0;
                        const mainContent = [
                            link.icon ? <i className={link.icon}></i> : null,
                            <span>{link.label}</span>,
                            hasSublinks ? <i className="fas fa-chevron-down CustomHeaderMenu-caret"></i> : null
                        ];

                        if (hasSublinks) {
                            return (
                                <div className="CustomHeaderMenu-dropdown">
                                    <a className="CustomHeaderMenu-item" href={link.url || 'javascript:void(0)'}>
                                        {mainContent}
                                    </a>
                                    <div className="CustomHeaderMenu-dropdownMenu">
                                        {link.sublinks.map(sublink => (
                                            <a 
                                                className="CustomHeaderMenu-dropdownItem" 
                                                href={sublink.url} 
                                                target={sublink.target || '_self'}
                                            >
                                                {sublink.icon ? <i className={sublink.icon}></i> : null}
                                                {sublink.label}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <a 
                                className="CustomHeaderMenu-item" 
                                href={link.url} 
                                target={link.target || '_self'} 
                                title={link.label}
                            >
                                {mainContent}
                            </a>
                        );
                    })}
                </div>
            );

            // Add as the first item in HeaderPrimary (which puts it right after the logo, before the search box)
            items.add('customHeaderMenu', menuHtml, 100);
        }
    });
});
