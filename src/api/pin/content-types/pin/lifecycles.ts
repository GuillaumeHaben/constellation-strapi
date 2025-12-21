
export default {
    async afterUpdate(event) {
        const { result, params } = event;

        // Trigger rarity calculation if the 'users' relation was part of the update
        // Strapi 5 sends many-to-many updates in params.data.users (connect/disconnect)
        if (params.data && params.data.users) {
            try {
                // @ts-ignore
                await strapi.service('api::pin.rarity').computeRarity(result.id);
            } catch (error) {
                console.error(`Error computing rarity for pin ${result.id}:`, error);
            }
        }
    },
};
