/**
 * heat-map controller
 */

import { factories } from '@strapi/strapi'
import { cellToLatLng } from 'h3-js';

export default factories.createCoreController('api::heat-map.heat-map', ({ strapi }) => ({
    async getGeoJson(ctx) {
        try {
            const entries = await strapi.documents('api::heat-map.heat-map').findMany({
                status: 'published'
            });

            const features = entries.map((entry: any) => {
                const [lat, lng] = cellToLatLng(entry.h3Index);

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat],
                    },
                    properties: {
                        count: entry.count,
                        h3Index: entry.h3Index,
                    },
                };
            });

            const featureCollection = {
                type: 'FeatureCollection',
                features,
            };

            ctx.send(featureCollection);
        } catch (err) {
            ctx.throw(500, err);
        }
    },
}));
