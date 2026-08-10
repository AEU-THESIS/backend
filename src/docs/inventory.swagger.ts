/**
 * @openapi
 * tags:
 *   name: Inventory
 *   description: Ingredient stock, cost tracking, adjustments, valuation and history
 *
 * components:
 *   schemas:
 *     InventoryItem:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 7 }
 *         shopId: { type: integer, example: 1 }
 *         name: { type: string, example: Coffee Beans }
 *         unitOfMeasure: { type: string, example: kg }
 *         quantity: { type: number, example: 12.5 }
 *         minAlertThreshold: { type: number, example: 5 }
 *         unitCost: { type: number, description: Weighted-average cost per unit, example: 2.5 }
 *         lastUnitCost: { type: number, description: Most recent purchase price per unit, example: 3 }
 *         costCurrency: { type: string, example: "$" }
 *         totalValue: { type: number, description: quantity × unitCost, example: 31.25 }
 *         imageUrl: { type: string, nullable: true }
 *         status:
 *           type: string
 *           enum: [in_stock, low_stock, out_of_stock]
 *         updatedAt: { type: string, format: date-time }
 *
 * /api/inventories:
 *   get:
 *     tags: [Inventory]
 *     summary: List the shop's inventory items (Admin, Manager)
 *     description: Returns the authenticated shop's ingredients with unit cost and total value. Supports search, unit and status filters.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: unit
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [in_stock, low_stock, out_of_stock] }
 *     responses:
 *       200:
 *         description: List of inventory items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/InventoryItem' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (requires Admin or Manager) }
 *   post:
 *     tags: [Inventory]
 *     summary: Create an inventory item (Admin, Manager)
 *     description: Creates an ingredient. Accepts an optional cost price and an optional image (multipart/form-data).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               unit_of_measure: { type: string, example: kg }
 *               quantity: { type: number, example: 10 }
 *               min_alert_threshold: { type: number, example: 5 }
 *               unit_cost: { type: number, description: Cost price per unit, example: 2 }
 *               image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Item created
 *       400: { description: Validation failed }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (requires Admin or Manager) }
 *
 * /api/inventories/valuation:
 *   get:
 *     tags: [Inventory]
 *     summary: Total stock valuation for the shop (Admin, Manager)
 *     description: Sum of quantity × unit cost across every item the shop holds, independent of any list filters.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Shop-wide valuation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalItems: { type: integer, example: 12 }
 *                     totalValue: { type: number, example: 182.09 }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (requires Admin or Manager) }
 *
 * /api/inventories/{id}:
 *   put:
 *     tags: [Inventory]
 *     summary: Update an inventory item (Admin, Manager)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               unit_of_measure: { type: string }
 *               quantity: { type: number }
 *               min_alert_threshold: { type: number }
 *               unit_cost: { type: number }
 *               image: { type: string, format: binary }
 *     responses:
 *       200: { description: Item updated }
 *       400: { description: Validation failed }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (requires Admin or Manager) }
 *       404: { description: Item not found }
 *   delete:
 *     tags: [Inventory]
 *     summary: Delete an inventory item (Admin, Manager)
 *     description: Removes the item and its adjustment-log history.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Item deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (requires Admin or Manager) }
 *       404: { description: Item not found }
 *
 * /api/inventories/{id}/adjustments:
 *   post:
 *     tags: [Inventory]
 *     summary: Adjust stock — add or remove (Admin, Manager)
 *     description: >
 *       Adds or removes stock. When adding, an optional unit_cost rolls the item's
 *       cost forward as a weighted average; omitting it keeps the current cost.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [adjustment_type, change_amount]
 *             properties:
 *               adjustment_type: { type: string, enum: [add, remove] }
 *               change_amount: { type: number, example: 2.5 }
 *               unit_cost: { type: number, nullable: true, description: Purchase price per unit (stock-ins only) }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       200: { description: Adjusted item }
 *       400: { description: Validation failed or insufficient stock }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (requires Admin or Manager) }
 *       404: { description: Item not found }
 *
 * /api/inventories/{id}/history:
 *   get:
 *     tags: [Inventory]
 *     summary: Stock movement history for an item (Admin, Manager)
 *     description: Date-range filtered and paginated adjustment history, with per-range in/out totals.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: Inclusive range start (ISO 8601)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: Inclusive range end (ISO 8601)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated history for the range
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           type: { type: string, enum: [add, remove] }
 *                           quantityChanged: { type: number }
 *                           unitCost: { type: number, nullable: true }
 *                           notes: { type: string, nullable: true }
 *                           user: { type: string, nullable: true }
 *                           userRole: { type: string, nullable: true }
 *                           createdAt: { type: string, format: date-time }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         totalPages: { type: integer }
 *                     totals:
 *                       type: object
 *                       properties:
 *                         totalIn: { type: number }
 *                         totalOut: { type: number }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (requires Admin or Manager) }
 *       404: { description: Item not found }
 */
