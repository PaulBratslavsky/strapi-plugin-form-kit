import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import { PLUGIN_ID } from './pluginId';
import { getTranslation } from './utils/getTranslation';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Forms',
      },
      Component: async () => {
        const { App } = await import('./pages/App');
        return App;
      },
    });

    // Register a section under Strapi's global Settings (cog icon).
    // Lives at /admin/settings/forms/ai-builder.
    app.createSettingSection(
      {
        id: PLUGIN_ID,
        intlLabel: {
          id: `${PLUGIN_ID}.settings.section.label`,
          defaultMessage: 'Forms',
        },
      },
      [
        {
          id: 'ai-builder',
          intlLabel: {
            id: `${PLUGIN_ID}.settings.ai-builder.label`,
            defaultMessage: 'AI builder',
          },
          to: `${PLUGIN_ID}/ai-builder`,
          Component: async () => {
            const { AiSettingsPage } = await import('./pages/AiSettingsPage');
            return AiSettingsPage;
          },
        },
      ]
    );

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  bootstrap() {},

  async registerTrads(app: any) {
    const { locales } = app;

    const importedTrads = await Promise.all(
      (locales as string[]).map((locale) => {
        return import(`./translations/${locale}.json`)
          .then(({ default: data }) => ({
            data: getTranslation(data),
            locale,
          }))
          .catch(() => ({ data: {}, locale }));
      })
    );

    return importedTrads;
  },
};
