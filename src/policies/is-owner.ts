/**
 * Global ownership policy for Strapi v5
 *
 * This policy enforces that a user can only access/modify resources they own.
 * It can be configured with different owner field names for different content-types.
 *
 * Usage in routes:
 * - For user content-type: checks if ctx.state.user.id === params.id
 * - For other content-types: fetches the resource and checks the owner field
 *
 * Configuration options:
 * - ownerField: The field name containing the owner reference (default: 'user')
 * - resourceUid: The content-type UID to fetch (required for non-user content-types)
 * - isUserContentType: Set to true when applying to the user content-type itself
 */

import type { Core } from '@strapi/strapi';

interface PolicyConfig {
    ownerField?: string;
    resourceUid?: string;
    isUserContentType?: boolean;
}

interface PolicyContext {
    state: {
        user?: {
            id: number;
            documentId?: string;
        };
    };
    params: {
        id?: string;
    };
}

export default async (
    policyContext: PolicyContext,
    config: PolicyConfig,
    { strapi }: { strapi: Core.Strapi }
): Promise<boolean> => {
    const { user } = policyContext.state;
    const { id: resourceId } = policyContext.params;

    // Must be authenticated
    if (!user) {
        strapi.log.warn('[is-owner] No authenticated user found');
        return false;
    }

    // Must have a resource ID
    if (!resourceId) {
        strapi.log.warn('[is-owner] No resource ID in params');
        return false;
    }

    const { isUserContentType = false, ownerField = 'user', resourceUid } = config;

    // For user content-type: the user ID in URL must match authenticated user
    if (isUserContentType) {
        // In Strapi v5, the id param is the documentId for users-permissions
        const isOwner = user.documentId === resourceId || String(user.id) === resourceId;

        if (!isOwner) {
            strapi.log.warn(
                `[is-owner] User ${user.id} (documentId: ${user.documentId}) attempted to access user ${resourceId}`
            );
        }

        return isOwner;
    }

    // For other content-types: fetch the resource and check owner field
    if (!resourceUid) {
        strapi.log.error('[is-owner] resourceUid is required for non-user content-types');
        return false;
    }

    try {
        // @ts-ignore - Strapi documents API with dynamic populate
        const resource = await strapi.documents(resourceUid).findOne({
            documentId: resourceId,
            populate: { [ownerField]: true },
        });

        if (!resource) {
            strapi.log.warn(`[is-owner] Resource ${resourceId} not found`);
            return false;
        }

        const owner = resource[ownerField];

        if (!owner) {
            strapi.log.warn(`[is-owner] Resource ${resourceId} has no ${ownerField}`);
            return false;
        }

        // The owner field could be a user object or just an ID
        const ownerId = typeof owner === 'object' ? owner.id : owner;
        const isOwner = user.id === ownerId;

        if (!isOwner) {
            strapi.log.warn(
                `[is-owner] User ${user.id} attempted to access resource ${resourceId} owned by ${ownerId}`
            );
        }

        return isOwner;
    } catch (error) {
        strapi.log.error(`[is-owner] Error checking ownership:`, error);
        return false;
    }
};
