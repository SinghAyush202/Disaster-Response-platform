const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const CACHE_TTL_SECONDS = 3600; // 1 hour

/**
 * Retrieves data from cache if available and not expired.
 * @param {string} key - The cache key.
 * @returns {Promise<any | null>} - The cached data or null if not found/expired.
 */
async function getCache(key) {
    try {
        const { data, error } = await supabase
            .from('cache')
            .select('value, expires_at')
            .eq('key', key)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
            logger.error(`Error fetching from cache for key ${key}:`, error);
            return null;
        }

        if (data && new Date(data.expires_at) > new Date()) {
            logger.info(`Cache hit for key: ${key}`);
            return data.value;
        } else if (data) {
            logger.info(`Cache expired for key: ${key}`);
            // Optionally delete expired cache
            await supabase.from('cache').delete().eq('key', key);
        } else {
            logger.info(`Cache miss for key: ${key}`);
        }
        return null;
    } catch (err) {
        logger.error(`Unexpected error in getCache for key ${key}:`, err);
        return null;
    }
}

/**
 * Stores data in the cache.
 * @param {string} key - The cache key.
 * @param {any} value - The data to store.
 * @param {number} ttlSeconds - Time to live in seconds.
 * @returns {Promise<void>}
 */
async function setCache(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
    try {
        const expiresAt = new Date(new Date().getTime() + ttlSeconds * 1000).toISOString();
        const { error } = await supabase
            .from('cache')
            .upsert({ key, value, expires_at: expiresAt }, { onConflict: 'key' });

        if (error) {
            logger.error(`Error setting cache for key ${key}:`, error);
        } else {
            logger.info(`Cache set for key: ${key}, expires at: ${expiresAt}`);
        }
    } catch (err) {
        logger.error(`Unexpected error in setCache for key ${key}:`, err);
    }
}

module.exports = {
    getCache,
    setCache,
};
