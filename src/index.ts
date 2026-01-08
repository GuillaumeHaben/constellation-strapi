import { Core } from '@strapi/strapi';
import userLifecycles from './extensions/users-permissions/content-types/user/lifecycles';
import { DEFAULT_AWARDS } from './seed/awards';

export default {
  register({ strapi }: { strapi: Core.Strapi }) { },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    strapi.log.info('[Bootstrap] Starting bootstrap process...');

    // Subscribe to User lifecycles
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      beforeCreate: userLifecycles.beforeCreate,
      beforeUpdate: userLifecycles.beforeUpdate,
    });

    // 1. Deduplicate existing awards (cleanup)
    try {
      const allAwards = await strapi.db.query('api::award.award').findMany();
      const seen = new Set();

      for (const award of allAwards) {
        if (seen.has((award as any).name)) {
          strapi.log.info(`[Cleanup] Deleting duplicate award: ${(award as any).name} (ID: ${(award as any).id})`);
          await strapi.db.query('api::award.award').delete({
            where: { id: (award as any).id }
          });
        } else {
          seen.add((award as any).name);
        }
      }
    } catch (error) {
      strapi.log.error('[Cleanup] Failed to deduplicate awards:', error);
    }

    // 2. Seed Awards if needed
    try {
      strapi.log.info(`[Seed] Checking for ${DEFAULT_AWARDS.length} default awards...`);
      for (const awardData of DEFAULT_AWARDS) {
        const existing = await strapi.db.query('api::award.award').findOne({
          where: { name: awardData.name }
        });

        if (!existing) {
          strapi.log.info(`[Seed] Creating award: ${awardData.name}`);
          // @ts-ignore
          await strapi.documents('api::award.award').create({
            data: { ...awardData },
            status: 'published'
          } as any);
        } else {
          // Sync existing award with new dynamic logic if changed
          strapi.log.info(`[Seed] Syncing award logic: ${awardData.name}`);
          // @ts-ignore
          await strapi.documents('api::award.award').update({
            documentId: (existing as any).documentId,
            data: {
              requirement: awardData.requirement,
              isDynamic: awardData.isDynamic,
              dynamicType: awardData.dynamicType,
              threshold: awardData.threshold,
              category: awardData.category,
              iconName: awardData.iconName
            },
            status: 'published'
          } as any);
        }
      }
    } catch (error) {
      strapi.log.error('[Seed] Failed to seed awards:', error);
    }

    strapi.log.info('[Bootstrap] Reminder: Ensure "find" permission is enabled for "Award" in Settings -> Roles.');

    // Ensure email confirmation and redirection URL are set in Users-Permissions advanced settings
    try {
      const store = strapi.store({ type: 'plugin', name: 'users-permissions', key: 'advanced' });
      const settings = await store.get() as any;

      const envRedirectUrl = process.env.EMAIL_CONFIRMATION_REDIRECT_URL;
      const defaultRedirectUrl = 'http://localhost:3000/login';
      const redirectionUrl = envRedirectUrl || defaultRedirectUrl;

      const needsUpdate = !settings.email_confirmation || settings.email_confirmation_redirection_url !== redirectionUrl;

      if (needsUpdate) {
        await store.set({
          value: {
            ...settings,
            email_confirmation: true,
            email_confirmation_redirection_url: redirectionUrl
          }
        });
      }
    } catch (error) {
      console.error('[Bootstrap] Failed to set users-permissions settings:', error);
    }
  },
};
