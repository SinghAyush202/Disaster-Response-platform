const { getCache, setCache } = require('./cacheService');
const logger = require('../utils/logger');

const MOCK_SOCIAL_MEDIA_DATA = [
    { id: 'sm1', disaster_id: 'sample_nyc_flood', user: 'citizen1', content: '#NYCFlood Need food in Lower East Side. Urgent! #foodrelief', timestamp: new Date().toISOString() },
    { id: 'sm2', disaster_id: 'sample_nyc_flood', user: 'volunteer_grp', content: 'Our team is mobilizing supplies for #NYCFlood victims. Contact us for help!', timestamp: new Date(Date.now() - 60000).toISOString() },
    { id: 'sm3', disaster_id: 'sample_japan_quake', user: 'local_news', content: 'Updates on #JapanEarthquake: Rescue efforts underway in Sendai.', timestamp: new Date(Date.now() - 120000).toISOString() },
    { id: 'sm4', disaster_id: 'sample_nyc_flood', user: 'citizen2', content: 'Power is out in Manhattan. Any info on shelters? #floodalert', timestamp: new Date(Date.now() - 180000).toISOString() },
    { id: 'sm5', disaster_id: 'sample_nyc_flood', user: 'reliefAdmin', content: 'Shelter opening at 123 Main St, Manhattan. #NYCFlood #shelter', timestamp: new Date(Date.now() - 30000).toISOString() }
];

/**
 * Mocks fetching social media reports for a given disaster.
 * Caches the response.
 * @param {string} disasterId - The ID of the disaster.
 * @param {string} query - Optional query to filter social media posts.
 * @returns {Promise<object[]>} - Array of mock social media posts.
 */
async function fetchSocialMediaReports(disasterId, query = '') {
    const cacheKey = `social_media_${disasterId}_${query.replace(/\s/g, '_')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    logger.info(`Calling mock Social Media API for disaster: ${disasterId} with query: "${query}"`);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 700));

    let reports = MOCK_SOCIAL_MEDIA_DATA.filter(post =>
        post.disaster_id === disasterId && post.content.toLowerCase().includes(query.toLowerCase())
    );

    // Simulate rate limiting or no new reports occasionally
    if (Math.random() < 0.2) { // 20% chance of no new reports
        reports = [];
        logger.warn('Mock Social Media API: Simulating "no new reports" due to rate limit.');
    }

    await setCache(cacheKey, reports);
    logger.info(`Mock Social Media response: ${reports.length} reports for ${disasterId}`);
    return reports;
}

module.exports = {
    fetchSocialMediaReports
};