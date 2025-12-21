import { Core } from '@strapi/strapi';
import userLifecycles from './extensions/users-permissions/content-types/user/lifecycles';

export default {
  register() { },

  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Subscribe to User lifecycles (User plugin needs manual subscription in bootstrap)
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      beforeCreate: userLifecycles.beforeCreate,
      beforeUpdate: userLifecycles.beforeUpdate,
    });
  },
};
