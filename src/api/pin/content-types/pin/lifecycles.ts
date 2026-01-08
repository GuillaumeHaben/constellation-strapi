
export default {
    async afterUpdate(event) {
        const { result, params } = event;

        // Trigger rarity calculation if the 'users' relation was part of the update
        // Strapi 5 sends many-to-many updates in params.data.users (connect/disconnect)
        if (params.data && params.data.users) {
            try {
                // @ts-ignore
                await strapi.service('api::pin.rarity').computeRarity(result.id);

                // Trigger award evaluation for connected users
                if (params.data.users.connect) {
                    for (const userId of params.data.users.connect) {
                        const id = typeof userId === 'object' ? userId.id : userId;
                        await strapi.service('api::award.award').evaluateUserAwards(id);
                    }
                }
            } catch (error) {
                console.error(`Error processing updates for pin ${result.id}:`, error);
            }
        }
    },
};
