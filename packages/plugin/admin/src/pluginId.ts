import pluginPkg from '../../package.json';

export const PLUGIN_ID = pluginPkg.strapi.name;
export type PluginId = typeof PLUGIN_ID;
