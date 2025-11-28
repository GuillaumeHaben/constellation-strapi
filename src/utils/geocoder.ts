import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

const API_KEY = process.env.GOOGLE_MAPS_API_KEY; // Store in .env

if (!API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY is not defined in environment variables");
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  try {
    const response = await client.geocode({
      params: {
        address,
        key: API_KEY,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      return null;
    }

    const location = response.data.results[0].geometry.location;

    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  } catch (err) {
    console.error("[Google Geocoding error]", err);
    return null;
  }
}
