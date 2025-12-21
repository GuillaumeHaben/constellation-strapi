/**
 * heat-map controller
 */

import { factories } from '@strapi/strapi'
import { cellToBoundary } from 'h3-js';

export default factories.createCoreController('api::heat-map.heat-map', ({ strapi }) => ({
    async getGeoJson(ctx) {
        try {
            const entries = await strapi.documents('api::heat-map.heat-map').findMany({
                status: 'published'
            });

            const features = entries.map((entry: any) => {
                const boundary = cellToBoundary(entry.h3Index);
                // Convert boundary (lat, lng pairs) to GeoJSON format (lng, lat pairs and closing the polygon)
                const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
                coordinates.push(coordinates[0]); // Close the polygon

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [coordinates],
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
