export default {
    routes: [
        {
            method: 'GET',
            path: '/qr-token',
            handler: 'api::encounter.encounter.generateToken',
            config: {
                auth: {
                    scope: ['api::encounter.encounter.generateToken']
                },
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'POST',
            path: '/encounters/validate',
            handler: 'api::encounter.encounter.validateToken',
            config: {
                auth: {
                    scope: ['api::encounter.encounter.validateToken']
                },
                policies: [],
                middlewares: [],
            },
        },
    ],
};
