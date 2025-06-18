const { getCache, setCache } = require('./cacheService');
const logger = require('../utils/logger');

// Mock Geocoding API responses
const MOCK_GEOCODE_RESPONSES = {
    "Manhattan, NYC": { lat: 40.7831, lon: -73.9712 },
    "Lower East Side, NYC": { lat: 40.7145, lon: -73.9882 },
    "Sendai, Japan": { lat: 38.2682, lon: 140.8694 },
    "Unknown Location": { lat: 0, lon: 0 } // Default for unmocked locations
};

/**
 * Mocks a mapping service API for geocoding (location name to lat/lon).
 * Caches the response.
 * @param {string} locationName - The location name to geocode.
 * @returns {Promise<{lat: number, lon: number} | null>} - Lat/lon coordinates or null.
 */
async function geocodeLocation(locationName) {
    const cacheKey = `geocode_${locationName.replace(/\s/g, '_')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    logger.info(`Calling mock Mapping Service for geocoding: ${locationName}`);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));

    let coords = MOCK_GEOCODE_RESPONSES[locationName] || MOCK_GEOCODE_RESPONSES["Unknown Location"];

    await setCache(cacheKey, coords);
    logger.info(`Mock Geocoding response: ${JSON.stringify(coords)}`);
    return coords;
}

module.exports = {
    geocodeLocation
};