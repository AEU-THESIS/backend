/**
 * @openapi
 * tags:
 *   name: Shop
 *   description: Shop management operations
 *
 * /api/shops:
 *   get:
 *     tags:
 *       - Shop
 *     summary: Get all shops
 *     description: Retrieve a list of all configured shops
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved shops
 *   post:
 *     tags:
 *       - Shop
 *     summary: Create a new shop (Admin Only)
 *     description: Create a new shop configuration instance
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *     responses:
 *       201:
 *         description: Shop created successfully
 *       403:
 *         description: Forbidden (Requires Admin Role)
 */
