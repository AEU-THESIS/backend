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
 *                 minimum: 0
 *                 description: Amount handed over in the payment currency. May be 0 for a 100%-off order. For KHR it must be a whole number of 100៛ notes. The total and exchange rate are computed server-side and are NOT accepted from the client.
 *                 example: 5.00
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
 *                       example: ORD-1-20260805-0001
 *                     totalAmount:
 *                       type: number
 *                       example: 4.50
 *                     receivedAmount:
 *                       type: number
 *                       description: Amount received in the payment currency (riel for KHR, dollars for USD).
 *                       example: 5.00
 *                     receivedAmountUsd:
 *                       type: number
 *                       description: Received amount normalised to USD for currency-agnostic reporting.
 *                       example: 5.00
 *                     paymentCurrency:
 *                       type: string
 *                       example: USD
 *                     changeAmount:
 *                       type: number
 *                       description: Change returned in the payment currency (riel rounded down to the nearest 100៛).
 *                       example: 0.50
 *                     exchangeRateSnapshot:
 *                       type: number
 *                       description: Server-resolved shop exchange rate applied to this order.
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
 *   get:
 *     tags:
 *       - Order
 *     summary: Get all orders for the authenticated user's shop
 *     description: Retrieves a paginated list of orders matching filter parameters like fulfillment status, payment status, dates, or search term.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [preparing, ready, completed, canceled]
 *         description: Filter orders by fulfillment status
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [paid, unpaid, refunded, partially_refunded]
 *         description: Filter orders by payment status
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           enum: [today]
 *         description: Date preset filter (e.g. today)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Fuzzy search term matching orderNumber or customerName
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date range (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date range (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: Orders list retrieved successfully
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
 *                   example: Orders retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           orderNumber:
 *                             type: string
 *                             example: ORD-1-20260805-0001
 *                           totalAmount:
 *                             type: number
 *                             example: 12.50
 *                           fulfillmentStatus:
 *                             type: string
 *                             example: preparing
 *                           paymentStatus:
 *                             type: string
 *                             example: paid
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 15
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 50
 *                         totalPages:
 *                           type: integer
 *                           example: 1
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *
 * /api/orders/stream:
 *   get:
 *     tags:
 *       - Order
 *     summary: Subscribe to real-time order update events (SSE)
 *     description: Subscribes the client to a Server-Sent Events (SSE) stream to receive real-time notifications about order creation and status changes. Authenticates via JWT passed in the query string (`token`).
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT authentication token required to establish connection
 *     responses:
 *       200:
 *         description: Connection established successfully. Returns event stream.
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: text/event-stream
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-cache, no-transform
 *           Connection:
 *             schema:
 *               type: string
 *               example: keep-alive
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: "data: {\"status\":\"connected\",\"shopId\":1}\n\n"
 *       400:
 *         description: Shop ID required or validation failed
 *       401:
 *         description: Unauthorized
 *
 * /api/orders/{id}:
 *   get:
 *     tags:
 *       - Order
 *     summary: Get details of a single order
 *     description: Retrieves detailed order information including ordered items, quantities, and chosen option elements.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unique order ID
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
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
 *                   example: Order retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     orderNumber:
 *                       type: string
 *                       example: ORD-1-20260805-0001
 *                     totalAmount:
 *                       type: number
 *                       example: 12.50
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 5
 *                           productId:
 *                             type: integer
 *                             example: 10
 *                           quantity:
 *                             type: integer
 *                             example: 2
 *                           price:
 *                             type: number
 *                             example: 5.00
 *                           product:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: Espresso
 *       400:
 *         description: Invalid order ID format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *
 * /api/orders/{id}/status:
 *   put:
 *     tags:
 *       - Order
 *     summary: Update fulfillment status of an order
 *     description: Transitions order status and broadcasts the state update to all active shop devices through the SSE channel.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unique order ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [preparing, ready, completed, canceled]
 *                 example: ready
 *     responses:
 *       200:
 *         description: Order status updated successfully
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
 *                   example: Order status updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     orderNumber:
 *                       type: string
 *                       example: ORD-1-20260805-0001
 *                     fulfillmentStatus:
 *                       type: string
 *                       example: ready
 *       400:
 *         description: Invalid status value, missing payload, or bad order ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *
 * /api/orders/{id}/void:
 *   post:
 *     tags:
 *       - Order
 *     summary: Void a whole order and reverse the payment
 *     description: >-
 *       Cancels every remaining line, recalculates the order to zero, refunds the
 *       remaining amount via a reversing (negative) transaction, un-redeems any
 *       promotions, and marks the order refunded + canceled. Voided orders drop out
 *       of every sales report. Idempotent guard: an already-voided order returns 400.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Order ID to void
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 255
 *                 description: Optional free-text reason recorded on the void.
 *                 example: Customer changed their mind
 *     responses:
 *       200:
 *         description: Order voided; returns the updated order tree
 *       400:
 *         description: Invalid order ID or the order is already voided
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *
 * /api/orders/{id}/items/{itemId}/cancel:
 *   post:
 *     tags:
 *       - Order
 *     summary: Cancel a single line item and refund the difference
 *     description: >-
 *       Marks one order item cancelled (kept on the order, struck through),
 *       recalculates the order total over the surviving lines, re-runs the promotion
 *       engine (so an invalidated promotion is dropped, not just subtracted), and
 *       writes a reversing transaction for the refunded difference. If it was the last
 *       live line the order is fully voided (refunded + canceled).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Order ID
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Order item ID to cancel
 *     responses:
 *       200:
 *         description: Item cancelled; returns the recalculated order tree
 *       400:
 *         description: Invalid IDs, the item is already cancelled, or the order is already voided
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order or item not found
 */
