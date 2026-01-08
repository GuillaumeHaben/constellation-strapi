/**
 * Unit test for evaluateUserAwards logic in award service.
 */

const { factories } = require('@strapi/strapi');

// Mock Strapi global
global.strapi = {
    log: {
        info: jest.fn(),
        error: jest.fn(),
    },
    documents: jest.fn(),
    db: {
        query: jest.fn(),
    },
};

const awardServiceFactory = require('../services/award').default;

describe('Award Service - evaluateUserAwards', () => {
    let awardService;

    beforeEach(() => {
        jest.clearAllMocks();
        // Since it's a factory in Strapi 5
        const context = { strapi };
        awardService = awardServiceFactory({ strapi });
    });

    it('should assign Collector award if user has enough pins', async () => {
        const userId = 'user-123';

        // Mock dynamic awards in DB
        const mockDynamicAwards = [
            {
                documentId: 'award-collector',
                name: 'Collector',
                isDynamic: true,
                dynamicType: 'pin_count',
                threshold: 10
            }
        ];

        strapi.documents.mockReturnValue({
            findMany: jest.fn().mockResolvedValue({ results: mockDynamicAwards }),
            findOne: jest.fn().mockResolvedValue({
                documentId: userId,
                username: 'testuser',
                pins: new Array(12).fill({ id: 1 }), // 12 pins
                awards: []
            }),
            update: jest.fn().mockResolvedValue({})
        });

        strapi.db.query.mockReturnValue({
            findMany: jest.fn().mockResolvedValue([]) // No encounters needed for this test
        });

        await awardService.evaluateUserAwards(userId);

        // Verify update was called to connect the award
        expect(strapi.documents).toHaveBeenCalledWith('plugin::users-permissions.user');
        const userDocs = strapi.documents('plugin::users-permissions.user');
        expect(userDocs.update).toHaveBeenCalledWith(expect.objectContaining({
            data: {
                awards: {
                    connect: ['award-collector']
                }
            }
        }));
    });

    it('should assign Legendary award if user has a legendary pin (rarity >= 0.95)', async () => {
        const userId = 'user-legend';

        const mockDynamicAwards = [
            {
                documentId: 'award-legendary',
                name: 'Legendary',
                isDynamic: true,
                dynamicType: 'has_legendary_pin',
                threshold: 1
            }
        ];

        strapi.documents.mockReturnValue({
            findMany: jest.fn().mockResolvedValue({ results: mockDynamicAwards }),
            findOne: jest.fn().mockResolvedValue({
                documentId: userId,
                username: 'legendary_user',
                pins: [{ id: 1, rarity: 0.98 }], // One legendary pin
                awards: []
            }),
            update: jest.fn().mockResolvedValue({})
        });

        strapi.db.query.mockReturnValue({
            findMany: jest.fn().mockResolvedValue([])
        });

        await awardService.evaluateUserAwards(userId);

        expect(strapi.documents('plugin::users-permissions.user').update).toHaveBeenCalled();
    });

    it('should assign Globetrotter based on unique countries in encounters', async () => {
        const userId = 'user-globetrotter';

        const mockDynamicAwards = [
            {
                documentId: 'award-globetrotter',
                name: 'Globetrotter',
                isDynamic: true,
                dynamicType: 'country_count',
                threshold: 3
            }
        ];

        strapi.documents.mockReturnValue({
            findMany: jest.fn().mockResolvedValue({ results: mockDynamicAwards }),
            findOne: jest.fn().mockResolvedValue({
                id: 1,
                documentId: userId,
                username: 'traveler',
                awards: []
            }),
            update: jest.fn().mockResolvedValue({})
        });

        // Mock 3 encounters with different countries
        strapi.db.query.mockReturnValue({
            findMany: jest.fn().mockResolvedValue([
                { userLow: { id: 1 }, userHigh: { country: 'France' } },
                { userLow: { id: 1 }, userHigh: { country: 'Germany' } },
                { userLow: { country: 'Italy' }, userHigh: { id: 1 } }
            ])
        });

        await awardService.evaluateUserAwards(userId);

        expect(strapi.documents('plugin::users-permissions.user').update).toHaveBeenCalled();
    });

    it('should NOT assign award if user already has it', async () => {
        const userId = 'user-already-has';

        const mockDynamicAwards = [
            {
                documentId: 'award-collector',
                name: 'Collector',
                isDynamic: true,
                dynamicType: 'pin_count',
                threshold: 10
            }
        ];

        strapi.documents.mockReturnValue({
            findMany: jest.fn().mockResolvedValue({ results: mockDynamicAwards }),
            findOne: jest.fn().mockResolvedValue({
                documentId: userId,
                username: 'testuser',
                pins: new Array(15).fill({ id: 1 }),
                awards: [{ documentId: 'award-collector' }] // Already has it
            }),
            update: jest.fn()
        });

        strapi.db.query.mockReturnValue({
            findMany: jest.fn().mockResolvedValue([])
        });

        await awardService.evaluateUserAwards(userId);

        expect(strapi.documents('plugin::users-permissions.user').update).not.toBeCalled();
    });
});
