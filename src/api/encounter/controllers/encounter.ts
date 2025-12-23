import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::encounter.encounter', ({ strapi }) => ({
    async find(ctx) {
        // Enforce privacy:
        // 1. Fetch data (count is public)
        // 2. Filter list: User can only see encounters they are a participant of

        // Validate and sanitize the query (standard Strapi controller logic)
        await this.validateQuery(ctx);
        const sanitizedQuery = await this.sanitizeQuery(ctx);

        // Fetch results via the service
        // console.log('[DEBUG] Query:', JSON.stringify(sanitizedQuery, null, 2));
        const totalCount = await strapi.db.query('api::encounter.encounter').count();
        console.log(`[DEBUG] Total encounters in DB: ${totalCount}`);

        const { results, pagination } = await strapi.service('api::encounter.encounter').find(sanitizedQuery);

        // Sanitize the results (applies schema privacy) and transform to API response format
        const sanitizedResults = await this.sanitizeOutput(results, ctx);
        const { data, meta } = await this.transformResponse(sanitizedResults, { pagination }) as { data: any[], meta: any };

        const requestingUser = ctx.state.user;
        console.log('[DEBUG] find encounter - requestingUser:', requestingUser?.id);

        if (!requestingUser) {
            // Public view: Can see count (meta), but no details (data)
            return { data: [], meta };
        }

        console.log('[DEBUG] find encounter - total data length:', data?.length || 0);

        // Filter data: Keep only encounters where the requesting user is one of the participants
        const filteredData = (data || []).filter((encounter) => {
            // Handle both flattened and nested (attributes) structures just in case
            const attrs = encounter.attributes || encounter;

            // access relation fields. Strapi response might have them as objects or IDs.
            // We need to check IDs.
            const userLowId = attrs.userLow?.data?.id ?? attrs.userLow?.id ?? attrs.userLow;
            const userHighId = attrs.userHigh?.data?.id ?? attrs.userHigh?.id ?? attrs.userHigh;

            return (
                Number(userLowId) === Number(requestingUser.id) ||
                Number(userHighId) === Number(requestingUser.id)
            );
        });

        console.log('[DEBUG] find encounter - total data length:', filteredData?.length || 0);

        return { data: filteredData, meta };
    },

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
