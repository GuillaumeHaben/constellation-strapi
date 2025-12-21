export default {
    routes: [
        {
            method: 'GET',
            path: '/heat-maps/geojson',
            handler: 'api::heat-map.heat-map.getGeoJson',
            config: {
                auth: false,
            },
        },
    ],
};
