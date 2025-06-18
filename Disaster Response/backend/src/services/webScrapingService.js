const { getCache, setCache } = require('./cacheService');
const logger = require('../utils/logger');

const MOCK_OFFICIAL_UPDATES = {
    "fema": [
        { id: 'fema1', title: 'FEMA Update: NYC Flood Declaration', content: 'President declares major disaster for New York. Federal aid available.', url: 'http://fema.gov/nyc-flood-update', published_at: new Date().toISOString() },
        { id: 'fema2', title: 'FEMA Guidance: Preparing for Earthquakes', content: 'Tips on how to secure your home and prepare for seismic activity.', url: 'http://fema.gov/earthquake-prep', published_at: new Date(Date.now() - 86400000).toISOString() }
    ],
    "redcross": [
        { id: 'rc1', title: 'Red Cross: Shelter Map for NYC', content: 'Find open shelters and aid stations in impacted areas of NYC.', url: 'http://redcross.org/nyc-shelters', published_at: new Date().toISOString() },
        { id: 'rc2', title: 'Red Cross: Donate for Japan Relief', content: 'Support victims of the recent earthquake in Japan.', url: 'http://redcross.org/japan-relief', published_at: new Date(Date.now() - 172800000).toISOString() }
    ]
};

/**
 * Mocks fetching official updates from designated websites.
 * Caches the response.
 * @param {string} source - The source to fetch updates from (e.g., 'fema', 'redcross').
 * @returns {Promise<object[]>} - Array of mock official updates.
 */
async function fetchOfficialUpdates(source) {
    const cacheKey = `official_updates_${source}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    logger.info(`Calling mock Web Scraping Service for official updates from: ${source}`);
    // Simulate web scraping delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    let updates = MOCK_OFFICIAL_UPDATES[source.toLowerCase()] || [];

    if (updates.length === 0) {
        logger.warn(`Mock Web Scraping Service: No updates found for source ${source}`);
    }

    await setCache(cacheKey, updates);
    logger.info(`Mock Official Updates response for ${source}: ${updates.length} updates`);
    return updates;
}

module.exports = {
    fetchOfficialUpdates
};
