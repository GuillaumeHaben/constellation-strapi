/**
 * Users-Permissions plugin extension
 *
 * This extends the default users-permissions plugin to:
 * 1. Apply ownership policy to user update/delete routes
 * 2. Sanitize private fields when viewing other users
 *
 * Private fields (hidden from other users):
 * - address, phoneNumber, latitude, longitude, h3index, birthday, geocodedAt
 *
 * @see https://docs.strapi.io/dev-docs/plugins-extension
 */

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
function sanitizeUserData(userData: any, requestingUserId: number | undefined): any {
    if (!userData) return userData;

    // If it's an array, sanitize each item
    if (Array.isArray(userData)) {
        return userData.map((user) => sanitizeUserData(user, requestingUserId));
    }

    // If the requesting user is the owner, return all data
    if (requestingUserId && userData.id === requestingUserId) {
        return userData;
    }

    // Remove private fields for non-owners
    const sanitized = { ...userData };
    for (const field of PRIVATE_FIELDS) {
        delete sanitized[field];
    }

    return sanitized;
}

import userLifecycles from './content-types/user/lifecycles';

export default (plugin: any) => {
    // Register lifecycles explicitly to ensure they run
    if (plugin.contentTypes.user) {
        plugin.contentTypes.user.lifecycles = userLifecycles;
    }

    // Store original controller methods
    const originalFind = plugin.controllers.user.find;
    const originalFindOne = plugin.controllers.user.findOne;
    const originalMe = plugin.controllers.user.me;
    const originalUpdate = plugin.controllers.user.update;
    const originalDestroy = plugin.controllers.user.destroy;

    // Override find to sanitize private fields
    plugin.controllers.user.find = async (ctx: any) => {
        try {
            await originalFind(ctx);
            const requestingUserId = ctx.state?.user?.id;

            // Strapi sets ctx.body, not return value
            if (ctx.body) {
                ctx.body = sanitizeUserData(ctx.body, requestingUserId);
            }
        } catch (error) {
            throw error;
        }
    };

    // Override findOne to sanitize private fields
    plugin.controllers.user.findOne = async (ctx: any) => {
        try {
            await originalFindOne(ctx);
            const requestingUserId = ctx.state?.user?.id;

            // Strapi sets ctx.body, not return value
            if (ctx.body) {
                ctx.body = sanitizeUserData(ctx.body, requestingUserId);
            }
        } catch (error) {
            throw error;
        }
    };

    // Override me - owner always sees all their own data (no sanitization needed)
    plugin.controllers.user.me = async (ctx: any) => {
        try {
            // User fetching their own data - return everything
            await originalMe(ctx);
        } catch (error) {
            throw error;
        }
    };

    // Override update with ownership check
    plugin.controllers.user.update = async (ctx: any) => {
        try {
            const requestingUser = ctx.state?.user;
            const targetUserId = ctx.params?.id;

            if (!requestingUser) {
                console.log('[DEBUG] Update request rejected: No user');
                return ctx.unauthorized('You must be logged in to update user data');
            }

            console.log(`[DEBUG] Update request for user ${targetUserId} by ${requestingUser.id}`);

            // Check ownership: user can only update their own data, OR be an Admin
            // In Strapi v5, params.id is the documentId
            const isOwner =
                requestingUser.documentId === targetUserId ||
                String(requestingUser.id) === targetUserId;

            // Check if user is Admin (role name 'Admin' is standard, but check case sensitivity if needed)
            // ctx.state.user usually has role populated
            const isAdmin = requestingUser.role?.name === 'Admin' || requestingUser.role?.type === 'admin';

            if (!isOwner && !isAdmin) {
                return ctx.forbidden('You can only update your own user data');
            }

            return originalUpdate(ctx);
        } catch (error) {
            throw error;
        }
    };

    // Override destroy with ownership check
    plugin.controllers.user.destroy = async (ctx: any) => {
        try {
            const requestingUser = ctx.state?.user;
            const targetUserId = ctx.params?.id;

            if (!requestingUser) {
                return ctx.unauthorized('You must be logged in to delete a user');
            }

            // ONLY Admins can delete users
            const isAdmin = requestingUser.role?.name === 'Admin' || requestingUser.role?.type === 'admin';

            if (!isAdmin) {
                return ctx.forbidden('Only administrators can delete users');
            }

            // Cascading delete: Remove associated data
            // 1. Resolve User ID (if targetUserId is a documentId)
            const userToDelete = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: {
                    $or: [
                        { documentId: targetUserId },
                        { id: targetUserId }
                    ]
                }
            });

            if (userToDelete) {
                const userId = userToDelete.id;
                console.log(`[DEBUG] Deleting user ${userId} and cascading to encounters...`);

                // 2. Delete all encounters involving this user
                await strapi.db.query('api::encounter.encounter').deleteMany({
                    where: {
                        $or: [
                            { userLow: userId },
                            { userHigh: userId }
                        ]
                    }
                });

                // 3. Nullify suggestedBy in Pins (optional but good practice)
                const pinsToUpdate = await strapi.db.query('api::pin.pin').findMany({
                    where: { suggestedBy: userId }
                });

                if (pinsToUpdate.length > 0) {
                    await strapi.db.query('api::pin.pin').updateMany({
                        where: {
                            suggestedBy: userId
                        },
                        data: {
                            suggestedBy: null
                        }
                    });
                }
            }

            return originalDestroy(ctx);
        } catch (error) {
            throw error;
        }
    };

    return plugin;
};

