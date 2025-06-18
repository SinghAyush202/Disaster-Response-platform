const { getCache, setCache } = require('./cacheService');
const logger = require('../utils/logger');

// Mock Gemini API responses
const MOCK_GEMINI_RESPONSES = {
    "extract_location_nyc_flood": "Manhattan, NYC",
    "extract_location_japan_earthquake": "Sendai, Japan",
    "verify_image_authentic": { status: "verified", message: "Image appears authentic and relevant to disaster context." },
    "verify_image_manipulated": { status: "unverified", message: "Image shows signs of manipulation or is irrelevant." }
};

/**
 * Mocks Google Gemini API for location extraction from text.
 * Caches the response.
 * @param {string} description - The text description to extract location from.
 * @returns {Promise<string | null>} - Extracted location name or null.
 */
async function extractLocationFromDescription(description) {
    const cacheKey = `gemini_location_${description.replace(/\s/g, '_')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    logger.info(`Calling mock Gemini API for location extraction: "${description.substring(0, 50)}..."`);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    let extractedLocation = null;
    if (description.includes("NYC Flood")) {
        extractedLocation = MOCK_GEMINI_RESPONSES.extract_location_nyc_flood;
    } else if (description.includes("Japan earthquake")) {
        extractedLocation = MOCK_GEMINI_RESPONSES.extract_location_japan_earthquake;
    } else {
        extractedLocation = "Unknown Location"; // Default for unmocked descriptions
    }

    await setCache(cacheKey, extractedLocation);
    logger.info(`Mock Gemini API response (location): ${extractedLocation}`);
    return extractedLocation;
}

/**
 * Mocks Google Gemini API for image verification.
 * Caches the response.
 * @param {string} imageUrl - The URL of the image to verify.
 * @returns {Promise<object>} - Verification status and message.
 */
async function verifyImage(imageUrl) {
    const cacheKey = `gemini_image_verify_${imageUrl}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    logger.info(`Calling mock Gemini API for image verification: ${imageUrl}`);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    let verificationResult;
    if (imageUrl.includes("authentic")) {
        verificationResult = MOCK_GEMINI_RESPONSES.verify_image_authentic;
    } else if (imageUrl.includes("manipulated")) {
        verificationResult = MOCK_GEMINI_RESPONSES.verify_image_manipulated;
    } else {
        // Default for unmocked image URLs
        verificationResult = { status: "pending", message: "Image verification in progress (mock)." };
    }

    await setCache(cacheKey, verificationResult);
    logger.info(`Mock Gemini API response (image verification): ${JSON.stringify(verificationResult)}`);
    return verificationResult;
}

module.exports = {
    extractLocationFromDescription,
    verifyImage
};