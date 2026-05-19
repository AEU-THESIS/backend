/**
 * @openapi
 * tags:
 *   - name: Category
 *     description: Category management
 *   - name: Product
 *     description: Product management
 *
 * /api/categories:
 *   get:
 *     tags:
 *       - Category
 *     summary: Get all categories
 *     description: Retrieve all categories for the authenticated user's shop, ordered by sort order
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Operation successful
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Coffee
 *                       sortOrder:
 *                         type: integer
 *                         example: 1
 *                       _count:
 *                         type: object
 *                         properties:
 *                           products:
 *                             type: integer
 *                             example: 5
 *
 * /api/products:
 *   get:
 *     tags:
 *       - Product
 *     summary: Get all products
 *     description: Retrieve all products for the authenticated user's shop with category and modifiers included. Allows filtering by categoryId and searching by name.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         required: false
 *         description: Filter products by category ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Search products by name (case-insensitive contains)
 *     responses:
 *       200:
 *         description: List of products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Operation successful
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Iced Latte
 *                       price:
 *                         type: number
 *                         example: 4.00
 *                       imageUrl:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       category:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: Coffee
 *                       optionSets:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             isRequired:
 *                               type: boolean
 *                               example: false
 *                             optionSet:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                   example: 1
 *                                 name:
 *                                   type: string
 *                                   example: Size
 *                                 elements:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       id:
 *                                         type: integer
 *                                         example: 1
 *                                       label:
 *                                         type: string
 *                                         example: Medium
 *                                       priceModifier:
 *                                         type: number
 *                                         example: 0.50
 *                                       position:
 *                                         type: integer
 *                                         example: 1
 */
