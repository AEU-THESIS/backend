/**
 * @openapi
 * tags:
 *   - name: Order
 *     description: POS checkout order operations
 *
 * /api/orders:
 *   post:
 *     tags:
 *       - Order
 *     summary: Place a new POS checkout order
 *     description: Creates an order, recalculates and validates pricing server-side, processes dual-currency payment (USD/KHR), calculates change, and stores order details in a transactional block.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderType
 *               - paymentMethod
 *               - paymentCurrency
 *               - receivedAmount
 *               - exchangeRateSnapshot
 *               - totalAmount
 *               - items
 *             properties:
 *               orderType:
 *                 type: string
 *                 enum: [dine_in, takeaway]
 *                 example: dine_in
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash]
 *                 example: cash
 *               paymentCurrency:
 *                 type: string
 *                 enum: [USD, KHR]
 *                 example: USD
 *               receivedAmount:
 *                 type: number
 *                 example: 5.00
 *               exchangeRateSnapshot:
 *                 type: number
 *                 example: 4100
 *               totalAmount:
 *                 type: number
 *                 example: 4.00
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: integer
 *                       example: 1
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       example: 1
 *                     selectedOptions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - optionSetId
 *                           - elementId
 *                           - groupName
 *                           - optionName
 *                           - extraPrice
 *                         properties:
 *                           optionSetId:
 *                             type: integer
 *                             example: 1
 *                           elementId:
 *                             type: integer
 *                             example: 2
 *                           groupName:
 *                             type: string
 *                             example: Size
 *                           optionName:
 *                             type: string
 *                             example: Medium
 *                           extraPrice:
 *                             type: number
 *                             example: 0.50
 *     responses:
 *       201:
 *         description: Order created successfully
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
 *                   example: Order placed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 42
 *                     orderNumber:
 *                       type: string
 *                       example: ORD-7902463
 *                     totalAmount:
 *                       type: number
 *                       example: 4.50
 *                     receivedAmount:
 *                       type: number
 *                       example: 5.00
 *                     paymentCurrency:
 *                       type: string
 *                       example: USD
 *                     changeAmount:
 *                       type: number
 *                       example: 0.50
 *                     exchangeRateSnapshot:
 *                       type: number
 *                       example: 4100
 *                     paymentStatus:
 *                       type: string
 *                       example: paid
 *                     fulfillmentStatus:
 *                       type: string
 *                       example: preparing
 *       400:
 *         description: Bad request (validation failed, insufficient payment, or invalid/unavailable products)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Received amount is insufficient for the total
 */
