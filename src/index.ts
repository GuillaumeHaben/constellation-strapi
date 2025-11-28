import { Core } from '@strapi/strapi';
import { geocode } from './utils/geocoder';
import h3 from 'h3-js';

const H3_RES = 7;

export default {
  register() {},

  bootstrap({ strapi }: { strapi: Core.Strapi }) {

    // BEFORE CREATE
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      beforeCreate: async (event) => {
        await handleUserLocation(event, strapi);
      },
      beforeUpdate: async (event) => {
        await handleUserLocation(event, strapi);
      },
    });
  },
};

async function handleUserLocation(event: any, strapi: Core.Strapi) {
  const data = event.params.data;

  if (!data.address) return;

  try {
    const geo = await geocode(data.address);
    if (!geo) return;

    data.latitude = geo.latitude;
    data.longitude = geo.longitude;
    data.h3Index = h3.latLngToCell(geo.latitude, geo.longitude, H3_RES);
    const newH3 = data.h3Index;

    await updateHeatMap(event, newH3, strapi);
  } catch (err) {
    console.error('[handleUserLocation error]', err);
  }
}

async function updateHeatMap(event: any, newH3: string, strapi: Core.Strapi) {
  const userId = event.params.where?.id;

  let oldH3 = null;

  if (userId) {
    const existingUser = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: userId }, select: ['h3Index'] });

    oldH3 = existingUser?.h3Index || null;
  }

  // No change → skip
  if (oldH3 === newH3) return;

  const repo = strapi.db.query('api::heat-map.heat-map');

  // Decrement old cell
  if (oldH3) {
    const oldCell = await repo.findOne({ where: { h3Index: oldH3 } });
    if (oldCell) {
      if (oldCell.count > 1) {
        await repo.update({ where: { id: oldCell.id }, data: { count: oldCell.count - 1 } });
      } else {
        await repo.delete({ where: { id: oldCell.id } });
      }
    }
  }

  // Increment new cell
  const existingCell = await repo.findOne({ where: { h3Index: newH3 } });
  if (existingCell) {
    await repo.update({ where: { id: existingCell.id }, data: { count: existingCell.count + 1 } });
  } else {
    await repo.create({ data: { h3Index: newH3, count: 1 } });
  }
}
