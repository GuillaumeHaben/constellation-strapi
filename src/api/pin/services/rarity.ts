
export default ({ strapi }) => ({
    async computeRarity(pinId) {
        // 1. Fetch the pin with its users (owners)
        const pin = await strapi.db.query('api::pin.pin').findOne({
            where: { id: pinId },
            populate: ['users'],
        });

        if (!pin) {
            console.error(`Pin with ID ${pinId} not found for rarity calculation`);
            return null;
        }

        const ownersCount = pin.users?.length || 0;

        // 2. Count total users in the system
        const totalUsers = await strapi.db.query('plugin::users-permissions.user').count();

        // 3. Compute rarity: 1 - percentage of ownership
        // If no users exist, default to 1 (max rarity)
        const rarity = totalUsers > 0 ? 1 - (ownersCount / totalUsers) : 1;

        // 4. Update the pin rarity field
        await strapi.entityService.update('api::pin.pin', pin.id, {
            data: { rarity },
        });

        return rarity;
    },
});
