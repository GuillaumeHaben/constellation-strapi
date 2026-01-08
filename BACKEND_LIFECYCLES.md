# Strapi Backend Lifecycle Hooks & Cascade Effects

This document tracks the automated logic and side effects triggered by content updates.

## Current Triggers

### `Encounter`
- **Hook**: `afterCreate`
- **Effect**: 
  - Validates the encounter between two users.
  - **Proposed**: Trigger `AwardService.evaluate` for both users to check "Socialite" and "Connector" rewards.

### `Pin` (User relation)
- **Hook**: `afterUpdate` (in `User` collection or `Pin` collection)
- **Effect**:
  - **Proposed**: Trigger `AwardService.evaluate` for the user to check "Collector" and "Hoarder" rewards based on `user.pins.length`.

### `Club`
- **Hook**: `afterCreate`
- **Effect**:
  - **Proposed**: Trigger `AwardService.evaluate` for the creator ("The Visionary").

## Award Evaluation Logic (`AwardService`)

When an award evaluation is triggered, the system performs the following checks:

| Award Type | Calculation | Trigger |
| :--- | :--- | :--- |
| `pin_count` | `count(user.pins)` | Pin added/removed |
| `encounter_count` | `count(validated_encounters)` | New encounter |
| `site_count` | `count(unique(encountered_users.site))` | New encounter |
| `club_count` | `count(user.clubs)` | Club joined |

## Implementation Strategy

To keep it simple and maintainable:
1. Logic lives in `src/api/award/services/award.js`.
2. Content types call this service in their `lifecycles.js` file.
3. A specific `Award` controller provides a `/api/awards/sync/:userId` endpoint for frontend-forced refreshes.
