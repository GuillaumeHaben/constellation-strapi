/**
 * Award service for Constellation.
 * Handles dynamic evaluation and assignment of user achievements.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::award.award', ({ strapi }) => ({
    /**
     * Evaluates and assigns dynamic awards for a specific user.
     * @param userId - The ID of the user to check.
     */
    async evaluateUserAwards(userId: any) {
        strapi.log.info(`[Awards] Evaluating awards for user ${userId}...`);

        // 1. Fetch all dynamic awards
        // @ts-ignore
        const { results: dynamicAwards } = await strapi.documents('api::award.award').findMany({
            filters: { isDynamic: true },
        });

        if (!dynamicAwards || dynamicAwards.length === 0) {
            strapi.log.info('[Awards] No dynamic awards found in DB.');
            return;
        }

        // 2. Fetch user data with necessary relations for evaluation
        // In Strapi 5, we use documentId or id. Let's try to be robust.
        // @ts-ignore
        const user = await strapi.documents('plugin::users-permissions.user').findOne({
            documentId: userId.toString(),
            populate: ['pins', 'awards']
        });

        if (!user) {
            strapi.log.error(`[Awards] User ${userId} not found.`);
            return;
        }

        // 3. Gather stats for evaluation
        const stats = {
            // @ts-ignore
            pin_count: user.pins?.length || 0,
            club_count: 0,
            encounter_count: 0,
            site_count: 0,
            country_count: 0,
            directorate_count: 0,
            has_legendary_pin: 0
        };

        // Check for legendary pin
        // @ts-ignore
        const pinning = user.pins || [];
        if (pinning.some((p: any) => p.rarity >= 0.95)) {
            stats.has_legendary_pin = 1;
        }

        strapi.log.info(`[Awards] User stats for ${user.username}:`, stats);

        // Fetch validated encounters (using raw DB query for speed/filters)
        const encounters = await strapi.db.query('api::encounter.encounter').findMany({
            where: {
                $or: [
                    { userLow: { id: user.id } },
                    { userHigh: { id: user.id } }
                ]
            },
            populate: ['userLow', 'userHigh']
        });

        stats.encounter_count = encounters?.length || 0;

        const sites = new Set();
        const countries = new Set();
        const directorates = new Set();

        encounters.forEach((enc: any) => {
            const otherUser = enc.userLow?.id === user.id ? enc.userHigh : enc.userLow;
            if (otherUser) {
                if (otherUser.esaSite) sites.add(otherUser.esaSite);
                if (otherUser.country) countries.add(otherUser.country);
                if (otherUser.directorate) directorates.add(otherUser.directorate);
            }
        });

        stats.site_count = sites.size;
        stats.country_count = countries.size;
        stats.directorate_count = directorates.size;

        strapi.log.info(`[Awards] Final stats for ${user.username}:`, stats);

        // 4. Check each award against stats
        for (const award of dynamicAwards) {
            // @ts-ignore
            const userAwards = user.awards || [];
            const hasAward = userAwards.some((a: any) => a.documentId === award.documentId);

            if (hasAward) {
                // strapi.log.info(`[Awards] User already has "${(award as any).name}".`);
                continue;
            }

            const type = (award as any).dynamicType as keyof typeof stats;
            const threshold = (award as any).threshold || 0;

            strapi.log.info(`[Awards] Checking "${(award as any).name}": ${stats[type]} / ${threshold}`);

            if (stats[type] >= threshold) {
                strapi.log.info(`[Awards] Condition met! Assigning "${(award as any).name}" to ${user.username}...`);
                // Assign award
                // @ts-ignore
                await strapi.documents('plugin::users-permissions.user').update({
                    documentId: user.documentId,
                    data: {
                        awards: {
                            connect: [award.documentId]
                        }
                    }
                });
                strapi.log.info(`[Awards] Award "${(award as any).name}" successfully assigned.`);
            }
        }
    }
}));
