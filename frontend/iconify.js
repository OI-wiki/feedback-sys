import { icons } from '@iconify-json/material-symbols';
import { getIconData, iconToSVG, iconToHTML, replaceIDs } from '@iconify/utils';

const PREFIX = '\0iconify:';

export default () => ({
    name: 'iconify',
    resolveId(id) {
        if (id.startsWith('iconify/')) {
            return PREFIX + id;
        }
    },
    load(id) {
        if (id.startsWith(PREFIX)) {
            const iconName = id.split('/')[1];
            const iconData = getIconData(icons, iconName);
            if (!iconData) {
                throw new Error(`Icon "${iconName}" is missing`);
            }
            const renderData = iconToSVG(iconData, {
                width: '1em',
                height: '1em',
            });
            const svg = iconToHTML(replaceIDs(renderData.body), {
                class: 'iconify-icon iconify-inline',
                ...renderData.attributes
            });
            return `export default ${JSON.stringify(svg)}`;
        }
    }
});