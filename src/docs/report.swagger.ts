/**
 * @openapi
 * tags:
 *   name: Reports
 *   description: Analytical reports, category performance, product sales performance, and inventory insights.
 *
 * /api/reports/sales-overview:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Retrieve total sales overview KPIs
 *     description: Returns key sales metrics (total sales, completed order count, and average order value) in USD and KHR for a shop during the selected period.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         required: false
 *         description: The timeline period for reporting (e.g. daily, weekly, monthly).
 *     responses:
 *       200:
 *         description: Overview metrics successfully retrieved
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
 *                   example: "Operation successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSales:
 *                       type: number
 *                       example: 12.50
 *                     totalOrders:
 *                       type: integer
 *                       example: 4
 *                     averageOrderValue:
 *                       type: number
 *                       example: 3.125
 *                     salesUSD:
 *                       type: number
 *                       example: 12.50
 *                     salesKHR:
 *                       type: number
 *                       example: 0
 *       401:
 *         description: Unauthorized (Invalid or missing JWT)
 *       403:
 *         description: Forbidden (Requires Admin privileges)
 *
 * /api/reports/item-performance:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Retrieve top/bottom best-selling items
 *     description: Returns lists of the top 5 and bottom 5 selling items (quantity and revenue) for the selected period.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         required: false
 *         description: The timeline period for reporting.
 *     responses:
 *       200:
 *         description: Item performance metrics retrieved successfully
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
 *                   example: "Operation successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     topSellers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Iced Latte"
 *                           quantity:
 *                             type: integer
 *                             example: 15
 *                           revenue:
 *                             type: number
 *                             example: 45.00
 *                     bottomSellers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Chocolate Muffin"
 *                           quantity:
 *                             type: integer
 *                             example: 1
 *                           revenue:
 *                             type: number
 *                             example: 3.50
 *
 * /api/reports/category-performance:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Retrieve category-wise sales performance
 *     description: Returns aggregated quantities and revenues sold grouped by category (Coffee, Tea, Bakery, etc.) for the selected period.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         required: false
 *         description: The timeline period for reporting.
 *     responses:
 *       200:
 *         description: Category performance data retrieved successfully
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
 *                   example: "Operation successful"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                         example: "Coffee"
 *                       quantity:
 *                         type: integer
 *                         example: 22
 *                       revenue:
 *                         type: number
 *                         example: 66.00
 *
 * /api/reports/inventory-insights:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Retrieve stock alerts and out-of-stock insights
 *     description: Returns real-time counts and lists of out-of-stock and low-stock ingredients inside the shop.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory insights retrieved successfully
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
 *                   example: "Operation successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     outOfStockCount:
 *                       type: integer
 *                       example: 1
 *                     lowStockCount:
 *                       type: integer
 *                       example: 2
 *                     outOfStock:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 4
 *                           name:
 *                             type: string
 *                             example: "Whole Milk"
 *                           currentStock:
 *                             type: number
 *                             example: 0
 *                           unitOfMeasure:
 *                             type: string
 *                             example: "ml"
 *                     lowStock:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "Coffee Beans"
 *                           currentStock:
 *                             type: number
 *                             example: 1500
 *                           lowStockThreshold:
 *                             type: number
 *                             example: 2000
 *                           unitOfMeasure:
 *                             type: string
 *                             example: "g"
 *
 * /api/reports/exports:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Export Sales or Inventory data to CSV
 *     description: Generates and streams a flat CSV file format containing either physical inventory status or historical completed sales lists depending on the selected scope.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [sales, inventory]
 *           default: sales
 *         required: true
 *         description: The category type to export (e.g. sales completed list, or physical raw inventory ledger).
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         required: false
 *         description: Timeline scope filter for sales export files.
 *     responses:
 *       200:
 *         description: CSV report stream generated successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: '"Order Number","Date","Cashier","Type","Total (USD)","Currency","Amount Received","Payment Status"\n"ORD-072165","2026-05-19T03:17:29.000Z","System","dine_in","3.00","USD","3.00","paid"'
 */
