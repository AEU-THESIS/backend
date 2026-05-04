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
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved shops
 *   post:
 *     tags:
 *       - Shop
 *     summary: Create a new shop (Admin Only)
 *     description: Create a new shop configuration instance
 *     security:
 *       - BearerAuth: []
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
 *
 * /api/shops/settings:
 *   get:
 *     tags:
 *       - Shop
 *     summary: Get authenticated shop settings (Admin Only)
 *     description: Fetch the shop configuration associated with the authenticated user's JWT.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved shop settings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires Admin Role)
 *       404:
 *         description: Shop not found
 *   put:
 *     tags:
 *       - Shop
 *     summary: Update authenticated shop settings (Admin Only)
 *     description: Partially update allowed shop configuration fields without overwriting omitted data.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             additionalProperties: false
 *             properties:
 *               name:
 *                 type: string
 *               ownerName:
 *                 type: string
 *                 nullable: true
 *               owner_name:
 *                 type: string
 *                 nullable: true
 *               phone:
 *                 type: string
 *                 nullable: true
 *               address:
 *                 type: string
 *                 nullable: true
 *               bakongAccountId:
 *                 type: string
 *                 nullable: true
 *               bakong_account_id:
 *                 type: string
 *                 nullable: true
 *               currencySymbol:
 *                 type: string
 *               currency_symbol:
 *                 type: string
 *               exchangeRate:
 *                 oneOf:
 *                   - type: number
 *                     format: decimal
 *                     minimum: 0
 *                     exclusiveMinimum: true
 *                     maximum: 99999999.99
 *                     multipleOf: 0.01
 *                   - type: string
 *                     pattern: '^\\d+(\\.\\d{1,2})?$'
 *               exchange_rate:
 *                 oneOf:
 *                   - type: number
 *                     format: decimal
 *                     minimum: 0
 *                     exclusiveMinimum: true
 *                     maximum: 99999999.99
 *                     multipleOf: 0.01
 *                   - type: string
 *                     pattern: '^\\d+(\\.\\d{1,2})?$'
 *               receiptFooter:
 *                 type: string
 *                 nullable: true
 *               receipt_footer:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Successfully updated shop settings
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires Admin Role)
 *       404:
 *         description: Shop not found
 */
