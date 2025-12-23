import { Core } from '@strapi/strapi';
import userLifecycles from './extensions/users-permissions/content-types/user/lifecycles';

export default {
  register({ strapi }: { strapi: Core.Strapi }) { },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Subscribe to User lifecycles (User plugin needs manual subscription in bootstrap)
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      beforeCreate: userLifecycles.beforeCreate,
      beforeUpdate: userLifecycles.beforeUpdate,
    });

    // Ensure email confirmation and redirection URL are set in Users-Permissions advanced settings
    try {
      const store = strapi.store({ type: 'plugin', name: 'users-permissions', key: 'advanced' });
      const settings = await store.get() as any;

      const envRedirectUrl = process.env.EMAIL_CONFIRMATION_REDIRECT_URL;
      const defaultRedirectUrl = 'http://localhost:3000/login';
      const redirectionUrl = envRedirectUrl || defaultRedirectUrl;

      console.log('[Bootstrap] Redirect Debug:', {
        envValue: envRedirectUrl,
        finalValue: redirectionUrl,
        currentInStore: settings.email_confirmation_redirection_url
      });

      const needsUpdate = !settings.email_confirmation || settings.email_confirmation_redirection_url !== redirectionUrl;

      if (needsUpdate) {
        console.log(`[Bootstrap] Updating users-permissions advanced settings to redirect to: ${redirectionUrl}`);
        await store.set({
          value: {
            ...settings,
            email_confirmation: true,
            email_confirmation_redirection_url: redirectionUrl
          }
        });

        // Final check
        const updatedSettings = await store.get() as any;
        console.log('[Bootstrap] Updated settings in store:', updatedSettings.email_confirmation_redirection_url);
      }
    } catch (error) {
      console.error('[Bootstrap] Failed to set users-permissions settings:', error);
    }
  },
};
