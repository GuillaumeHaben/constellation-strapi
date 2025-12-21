import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::encounter.encounter', ({ strapi }) => ({
    async generateToken(ctx) {
        const user = ctx.state.user;

        if (!user) {
            return ctx.unauthorized('You must be logged in to generate a QR token');
        }

        // Use Strapi's built-in JWT service from users-permissions plugin
        const jwtService = strapi.service('plugin::users-permissions.jwt');
        const token = jwtService.issue({
            u: user.id,
            t: 'irl', // type: 'irl_meet' -> 'irl'
        }, {
            expiresIn: '15s',
        });

        return { token };
    },

    async validateToken(ctx) {
        const user = ctx.state.user;
        const { token } = ctx.request.body as { token?: string };

        if (!user) {
            return ctx.unauthorized('You must be logged in to validate an encounter');
        }

        if (!token) {
            return ctx.badRequest('Token is required');
        }

        try {
            const jwtService = strapi.service('plugin::users-permissions.jwt');
            const payload = await jwtService.verify(token) as { u: number, t: string, id?: number, type?: string };

            // Handle both old and new payload formats for backward compatibility during transition
            const type = payload.t || payload.type;
            const userAIdRaw = payload.u || payload.id;

            if (type !== 'irl' && type !== 'irl_meet') {
                return ctx.badRequest('Invalid token type');
            }

            const userAId = Number(userAIdRaw);
            const userBId = Number(user.id);

            if (isNaN(userAId) || isNaN(userBId)) {
                return ctx.badRequest('Invalid user IDs');
            }

            if (userAId === userBId) {
                return ctx.badRequest('You cannot meet yourself');
            }

            // Order IDs to ensure uniqueness
            const userLowId = Math.min(userAId, userBId);
            const userHighId = Math.max(userAId, userBId);

            // Check if encounter already exists
            const existingEncounter = await strapi.db.query('api::encounter.encounter').findOne({
                where: {
                    userLow: userLowId,
                    userHigh: userHighId,
                },
            });

            if (existingEncounter) {
                // Idempotent success: return existing encounter as success
                const otherUserId = userLowId === userBId ? userHighId : userLowId;
                return { success: true, encounter: existingEncounter, alreadyRecorded: true, otherUserId };
            }

            // Create encounter
            const encounter = await strapi.entityService.create('api::encounter.encounter', {
                data: {
                    userLow: userLowId,
                    userHigh: userHighId,
                    validatedAt: new Date(),
                    publishedAt: new Date(),
                },
            });

            const otherUserId = userLowId === userBId ? userHighId : userLowId;
            return { success: true, encounter, otherUserId };
        } catch (err) {
            return ctx.badRequest('Invalid or expired token');
        }
    },
}));
