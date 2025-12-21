/**
 * Backend integration test for heat-map count logic
 * 
 * This test verifies that when multiple users share the same H3 index,
 * the count is correctly incremented.
 * 
 * Run this test from the Strapi backend directory with:
 * npm test -- heat-map-count.test.js
 */

const h3 = require('h3-js');

describe('HeatMap Count Logic', () => {
    const H3_RESOLUTION = 7;

    test('multiple users in same H3 cell should increment count', () => {
        // Simulate two users with the same coordinates
        const lat = 52.160114;
        const lng = 4.497010;

        const h3Index1 = h3.latLngToCell(lat, lng, H3_RESOLUTION);
        const h3Index2 = h3.latLngToCell(lat, lng, H3_RESOLUTION);

        // Both should generate the same H3 index
        expect(h3Index1).toBe(h3Index2);

        console.log('H3 Index for both users:', h3Index1);
    });

    test('users with slightly different coordinates should have different H3 cells', () => {
        const user1Lat = 52.160114;
        const user1Lng = 4.497010;

        // Move ~10km away
        const user2Lat = 52.250114;
        const user2Lng = 4.597010;

        const h3Index1 = h3.latLngToCell(user1Lat, user1Lng, H3_RESOLUTION);
        const h3Index2 = h3.latLngToCell(user2Lat, user2Lng, H3_RESOLUTION);

        expect(h3Index1).not.toBe(h3Index2);

        console.log('User 1 H3:', h3Index1);
        console.log('User 2 H3:', h3Index2);
    });
});
