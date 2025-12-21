import h3 from 'h3-js';
const H3_RESOLUTION = 7;

async function geocodeAddress(address: string) {
    console.log(`[Geocoding] Attempting to geocode: ${address}`);
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Constellation/1.0 (https://github.com/guillaumehaben/constellation)'
            }
        });

        if (!response.ok) {
            console.error(`[Geocoding] Nominatim error: ${response.status}`);
            return null;
        }

        const data = await response.json() as any[];
        if (data && data.length > 0) {
            console.log(`[Geocoding] Success for ${address}: ${data[0].lat}, ${data[0].lon}`);
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon)
            };
        } else {
            console.warn(`[Geocoding] No results found for: ${address}`);
        }
    } catch (error) {
        console.error('[Geocoding] Fetch error:', error);
    }
    return null;
}

async function updateH3Index(data: any, previousData: any = null) {
    console.log(`[User Lifecycle] Processing location for user. New address: "${data.address}", Old address: "${previousData?.address}"`);

    // Handle address removal
    if (data.address === null || data.address === '') {
        if (previousData?.h3index) {
            console.log(`[User Lifecycle] Address removed. Decrementing old H3: ${previousData.h3index}`);
            await decrementHeatMap(previousData.h3index);
        }
        data.h3index = null;
        data.geocodedAt = new Date();
        return;
    }

    // Only geocode if address changed or h3index is missing
    if (data.address && (data.address !== previousData?.address || !previousData?.h3index)) {
        const geo = await geocodeAddress(data.address);
        if (geo) {
            const newH3Index = h3.latLngToCell(geo.latitude, geo.longitude, H3_RESOLUTION);
            console.log(`[User Lifecycle] New H3 Index: ${newH3Index}, Old H3 Index: ${previousData?.h3index}`);

            if (newH3Index !== previousData?.h3index) {
                if (previousData?.h3index) {
                    console.log(`[User Lifecycle] Changing location. Decrementing old H3: ${previousData.h3index}`);
                    await decrementHeatMap(previousData.h3index);
                }
                console.log(`[User Lifecycle] Incrementing new H3: ${newH3Index}`);
                await incrementHeatMap(newH3Index);
                data.h3index = newH3Index;
                data.geocodedAt = new Date();
                data.latitude = geo.latitude;
                data.longitude = geo.longitude;
            }
        } else {
            console.error(`[User Lifecycle] Geocoding failed for address: ${data.address}`);
        }
    } else {
        console.log(`[User Lifecycle] No address change or h3index already present. Skipping geocoding.`);
    }
}

async function incrementHeatMap(h3index: string) {
    try {
        console.log(`[HeatMap] Attempting to increment h3index: ${h3index}`);

        // @ts-ignore - Query for published documents only
        const entries = await strapi.documents('api::heat-map.heat-map').findMany({
            filters: { h3Index: h3index },
            status: 'published'
        });

        console.log(`[HeatMap] Found ${entries.length} existing entries for ${h3index}`);

        if (entries && entries.length > 0) {
            const existing = entries[0];
            const newCount = existing.count + 1;

            console.log(`[HeatMap] Current count: ${existing.count}, will update to: ${newCount}`);

            // @ts-ignore - Update the existing entry
            const updated = await strapi.documents('api::heat-map.heat-map').update({
                documentId: existing.documentId,
                data: { count: newCount }
            });

            // Ensure it's published
            // @ts-ignore
            await strapi.documents('api::heat-map.heat-map').publish({
                documentId: existing.documentId
            });

            console.log(`[HeatMap] Successfully incremented ${h3index} from ${existing.count} to ${newCount}`);
        } else {
            console.log(`[HeatMap] No existing entry found, creating new one for ${h3index}`);

            // @ts-ignore - Create and immediately publish
            const created = await strapi.documents('api::heat-map.heat-map').create({
                data: { h3Index: h3index, count: 1 }
            });

            // @ts-ignore
            await strapi.documents('api::heat-map.heat-map').publish({
                documentId: created.documentId
            });

            console.log(`[HeatMap] Created and published new entry for ${h3index} with count 1`);
        }
    } catch (error) {
        console.error(`[HeatMap] Error incrementing ${h3index}:`, error);
        if (error.details) {
            console.error(`[HeatMap] Error details:`, error.details);
        }
    }
}

async function decrementHeatMap(h3index: string) {
    try {
        console.log(`[HeatMap] Attempting to decrement h3index: ${h3index}`);

        // @ts-ignore - Query for published documents only
        const entries = await strapi.documents('api::heat-map.heat-map').findMany({
            filters: { h3Index: h3index },
            status: 'published'
        });

        if (entries && entries.length > 0) {
            const existing = entries[0];
            console.log(`[HeatMap] Current count for ${h3index}: ${existing.count}`);

            if (existing.count <= 1) {
                // @ts-ignore - Delete the entry if count would become 0
                await strapi.documents('api::heat-map.heat-map').delete({
                    documentId: existing.documentId,
                });
                console.log(`[HeatMap] Deleted entry for ${h3index} (count was ${existing.count})`);
            } else {
                const newCount = existing.count - 1;

                // @ts-ignore - Update the count
                await strapi.documents('api::heat-map.heat-map').update({
                    documentId: existing.documentId,
                    data: { count: newCount }
                });

                // Ensure it stays published
                // @ts-ignore
                await strapi.documents('api::heat-map.heat-map').publish({
                    documentId: existing.documentId
                });

                console.log(`[HeatMap] Successfully decremented ${h3index} from ${existing.count} to ${newCount}`);
            }
        } else {
            console.log(`[HeatMap] Warning: No entry found to decrement for ${h3index}`);
        }
    } catch (error) {
        console.error(`[HeatMap] Error decrementing ${h3index}:`, error);
        if (error.details) {
            console.error(`[HeatMap] Error details:`, error.details);
        }
    }
}

export default {
    async beforeCreate(event: any) {
        console.log('[User Lifecycle] beforeCreate triggered');
        const { data } = event.params;
        await updateH3Index(data);
    },

    async beforeUpdate(event: any) {
        console.log('[User Lifecycle] beforeUpdate triggered');
        const { data, where } = event.params;

        // Fetch existing data to compare and handle count updates
        try {
            // @ts-ignore
            const previousData = await strapi.query('plugin::users-permissions.user').findOne({ where });
            await updateH3Index(data, previousData);
        } catch (error) {
            console.error('[User Lifecycle] Error fetching previous data:', error);
        }
    },
};
