const config = require('C:/xampp/htdocs/forum.spottersturkey.com_2.0.0.rc/packages/framio-dev/custom-homepage/js/node_modules/flarum-webpack-config');
const path = require('path');

const webConfig = config();

webConfig.entry = {
    forum: path.resolve(__dirname, 'src/forum/index.js'),
    admin: path.resolve(__dirname, 'src/admin/index.js')
};

webConfig.resolveLoader = {
    modules: [
        'node_modules',
        path.resolve('C:/xampp/htdocs/forum.spottersturkey.com_2.0.0.rc/packages/framio-dev/custom-homepage/js/node_modules')
    ]
};
webConfig.resolve = webConfig.resolve || {};
webConfig.resolve.modules = [
    'node_modules',
    path.resolve('C:/xampp/htdocs/forum.spottersturkey.com_2.0.0.rc/packages/framio-dev/custom-homepage/js/node_modules')
];

module.exports = webConfig;
