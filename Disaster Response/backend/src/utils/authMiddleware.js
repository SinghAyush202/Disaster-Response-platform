const logger = require('./logger');

// Mock user data
const mockUsers = [
    { id: 'netrunnerX', username: 'netrunnerX', roles: ['admin', 'contributor'] },
    { id: 'reliefAdmin', username: 'reliefAdmin', roles: ['admin'] },
    { id: 'citizen1', username: 'citizen1', roles: ['citizen'] },
    { id: 'volunteerA', username: 'volunteerA', roles: ['contributor'] }
];

/**
 * Middleware for mock authentication.
 * Attaches a 'user' object to the request based on the 'x-user-id' header.
 * In a real app, this would involve token verification.
 */
const authenticate = (req, res, next) => {
    const userId = req.headers['x-user-id']; // Expect user ID in header for mock auth

    if (!userId) {
        logger.warn('Authentication failed: No x-user-id header provided.');
        return res.status(401).json({ message: 'Authentication required. Please provide x-user-id header.' });
    }

    const user = mockUsers.find(u => u.id === userId);

    if (!user) {
        logger.warn(`Authentication failed: User ID ${userId} not found.`);
        return res.status(403).json({ message: 'Invalid user ID.' });
    }

    req.user = user; // Attach user object to the request
    logger.info(`User authenticated: ${user.username} (${user.id})`);
    next();
};

/**
 * Middleware for role-based authorization.
 * @param {string[]} allowedRoles - An array of roles that are allowed to access the route.
 */
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            // This should ideally not happen if 'authenticate' middleware runs first
            logger.error('Authorization failed: User not authenticated before authorization check.');
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        const userRoles = req.user.roles;
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));

        if (!hasPermission) {
            logger.warn(`Authorization failed for user ${req.user.id}. Required roles: [${allowedRoles.join(', ')}], User roles: [${userRoles.join(', ')}]`);
            return res.status(403).json({ message: 'Forbidden: You do not have the necessary permissions.' });
        }

        logger.info(`User ${req.user.id} authorized for route.`);
        next();
    };
};

module.exports = {
    authenticate,
    authorize
};