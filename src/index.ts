import { Core } from '@strapi/strapi';
import userLifecycles from './extensions/users-permissions/content-types/user/lifecycles';
import { DEFAULT_AWARDS } from './seed/awards';
import * as crypto from 'crypto';

// Fields that should only be visible to the owner
const PRIVATE_FIELDS = [
  'address',
  'phoneNumber',
  'latitude',
  'longitude',
  'h3index',
  'geocodedAt',
];

/**
 * Sanitizes user data by removing private fields if the requester is not the owner
 */
function sanitizeUserData(userData: any, requestingUserId: any): any {
  if (!userData) return userData;

  if (Array.isArray(userData)) {
    return userData.map((user) => sanitizeUserData(user, requestingUserId));
  }

  // Handle both ID types (id and documentId)
  const isOwner = requestingUserId && (
    userData.id === requestingUserId ||
    userData.documentId === requestingUserId ||
    String(userData.id) === String(requestingUserId) ||
    String(userData.documentId) === String(requestingUserId)
  );

  if (isOwner) {
    return userData;
  }

  const sanitized = { ...userData };
  for (const field of PRIVATE_FIELDS) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  return sanitized;
}

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.log.info('[Register] Extending users-permissions plugin controllers...');

    const plugin = strapi.plugin('users-permissions');

    if (plugin) {
      // 1. Override register controller (ESA Logic)
      plugin.controllers.auth.register = async (ctx: any, next: any) => {
        strapi.log.info('[Register] Custom register handler called!');

        const { email, password } = ctx.request.body;

        if (!email) {
          return ctx.badRequest('Email is required');
        }

        const allowedDomains = ['@esa.int', '@ext.esa.int'];
        const emailLower = email.toLowerCase();
        const isAllowed = allowedDomains.some((domain: string) => emailLower.endsWith(domain));

        if (!isAllowed) {
          return ctx.badRequest('Registration is restricted to @esa.int and @ext.esa.int domains.');
        }

        const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { email: emailLower }
        });

        if (existingUser) {
          return ctx.badRequest('Account already exists. An admin will confirm it shortly.');
        }

        // Parse Name from Email
        const localPart = emailLower.split('@')[0];
        const nameParts = localPart.split('.');

        if (nameParts.length < 2) {
          return ctx.badRequest('Email format must be firstname.lastname@domain');
        }

        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const firstName = capitalize(nameParts[0]);
        const lastName = nameParts.slice(1).map(capitalize).join(' ');
        const baseSlug = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        strapi.log.info(`[Register] Detected: ${firstName} ${lastName}, Slug: ${baseSlug}`);

        // Hash the password manually since we are using db.query
        const userService = strapi.plugin('users-permissions').service('user');
        const hashedPassword = (await userService.ensureHashedPasswords({ password })).password;

        // Fetch settings and default role
        const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
        const settings = await pluginStore.get({ key: 'advanced' }) as any;

        const defaultRole = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: settings.default_role },
        });

        if (!defaultRole) {
          strapi.log.error(`[Register] Default role "${settings.default_role}" not found`);
          return ctx.badRequest('Default role not found');
        }

        try {
          // In Strapi v5, it's often safer to use db.query for user creation to ensure all fields are handled
          const newUser = await strapi.db.query('plugin::users-permissions.user').create({
            data: {
              username: emailLower,
              email: emailLower,
              password: hashedPassword,
              firstName,
              lastName,
              slug: baseSlug,
              confirmed: false,
              blocked: false,
              role: defaultRole.id,
              provider: 'local',
              publishedAt: new Date(), // Standard for many models in v5
            }
          });

          strapi.log.info(`[Register] Successfully created user ID: ${(newUser as any).id}`);

          ctx.body = {
            message: "Account created. An Admin will approve you account creation shortly. Sit tight and relax.",
            user: {
              id: (newUser as any).id,
              email: (newUser as any).email,
              username: (newUser as any).username,
              firstName: (newUser as any).firstName,
              lastName: (newUser as any).lastName,
            }
          };
        } catch (err) {
          strapi.log.error('[Register] Registration Error:', err);
          return ctx.badRequest('Registration failed', { error: err.message });
        }
      };

      // 2. Override User controllers (Sanitization & Ownership)
      const originalFind = plugin.controllers.user.find;
      const originalFindOne = plugin.controllers.user.findOne;
      const originalUpdate = plugin.controllers.user.update;
      const originalDestroy = plugin.controllers.user.destroy;

      plugin.controllers.user.find = async (ctx: any, next: any) => {
        await originalFind(ctx, next);
        const requestingUserId = ctx.state?.user?.id || ctx.state?.user?.documentId;
        if (ctx.body) {
          ctx.body = sanitizeUserData(ctx.body, requestingUserId);
        }
      };

      plugin.controllers.user.findOne = async (ctx: any, next: any) => {
        await originalFindOne(ctx, next);
        const requestingUserId = ctx.state?.user?.id || ctx.state?.user?.documentId;
        if (ctx.body) {
          ctx.body = sanitizeUserData(ctx.body, requestingUserId);
        }
      };

      plugin.controllers.user.update = async (ctx: any, next: any) => {
        const requestingUser = ctx.state?.user;
        const targetUserId = ctx.params?.id;

        if (!requestingUser) {
          return ctx.unauthorized('You must be logged in to update user data');
        }

        const isOwner = requestingUser.documentId === targetUserId || String(requestingUser.id) === targetUserId;
        const isAdmin = requestingUser.role?.name === 'Admin' || requestingUser.role?.type === 'admin';

        if (!isOwner && !isAdmin) {
          return ctx.forbidden('You can only update your own user data');
        }

        return originalUpdate(ctx, next);
      };

      plugin.controllers.user.destroy = async (ctx: any, next: any) => {
        const requestingUser = ctx.state?.user;
        const targetUserId = ctx.params?.id;

        if (!requestingUser) {
          return ctx.unauthorized('You must be logged in to delete a user');
        }

        const isAdmin = requestingUser.role?.name === 'Admin' || requestingUser.role?.type === 'admin';
        if (!isAdmin) {
          return ctx.forbidden('Only administrators can delete users');
        }

        const userToDelete = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { $or: [{ documentId: targetUserId }, { id: targetUserId }] }
        });

        if (userToDelete) {
          const userId = userToDelete.id;
          strapi.log.info(`[Cleanup] Cascading delete for user ${userId}...`);
          await strapi.db.query('api::encounter.encounter').deleteMany({
            where: { $or: [{ userLow: userId }, { userHigh: userId }] }
          });

          const pinsToUpdate = await strapi.db.query('api::pin.pin').findMany({ where: { suggestedBy: userId } });
          if (pinsToUpdate.length > 0) {
            await strapi.db.query('api::pin.pin').updateMany({
              where: { suggestedBy: userId },
              data: { suggestedBy: null }
            });
          }
        }

        return originalDestroy(ctx, next);
      };

      strapi.log.info('[Register] users-permissions controllers overridden successfully.');
    } else {
      strapi.log.warn('[Register] users-permissions plugin not found!');
    }
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    strapi.log.info('[Bootstrap] Starting bootstrap process...');

    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      beforeCreate: userLifecycles.beforeCreate,
      beforeUpdate: userLifecycles.beforeUpdate,
    });

    // Award logic and settings seeding...
    try {
      const allAwards = await strapi.db.query('api::award.award').findMany();
      const seen = new Set();
      for (const award of allAwards) {
        if (seen.has((award as any).name)) {
          await strapi.db.query('api::award.award').delete({ where: { id: (award as any).id } });
        } else {
          seen.add((award as any).name);
        }
      }
    } catch (e) { }

    try {
      for (const awardData of DEFAULT_AWARDS) {
        const existing = await strapi.db.query('api::award.award').findOne({ where: { name: awardData.name } });
        if (!existing) {
          // @ts-ignore
          await strapi.documents('api::award.award').create({ data: { ...awardData }, status: 'published' } as any);
        } else {
          // @ts-ignore
          await strapi.documents('api::award.award').update({
            documentId: (existing as any).documentId,
            data: { ...awardData },
            status: 'published'
          } as any);
        }
      }
    } catch (e) { }

    try {
      const store = strapi.store({ type: 'plugin', name: 'users-permissions', key: 'advanced' });
      const settings = await store.get() as any;
      const redirectionUrl = process.env.EMAIL_CONFIRMATION_REDIRECT_URL || 'http://localhost:3000/login';
      if (!settings.email_confirmation || settings.email_confirmation_redirection_url !== redirectionUrl) {
        await store.set({ value: { ...settings, email_confirmation: true, email_confirmation_redirection_url: redirectionUrl } });
      }
    } catch (e) { }
  },
};
