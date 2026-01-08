export default {
    async afterCreate(event) {
        const { result } = event;

        // result.userLow and result.userHigh are the IDs or objects depending on population
        // In afterCreate, they are usually the IDs if passed as data
        const userLowId = result.userLow?.id || result.userLow;
        const userHighId = result.userHigh?.id || result.userHigh;

        if (userLowId) {
            try {
                await strapi.service('api::award.award').evaluateUserAwards(userLowId);
            } catch (error) {
                console.error(`Error evaluating awards for user ${userLowId}:`, error);
            }
        }

        if (userHighId) {
            try {
                await strapi.service('api::award.award').evaluateUserAwards(userHighId);
            } catch (error) {
                console.error(`Error evaluating awards for user ${userHighId}:`, error);
            }
        }
    },
};
