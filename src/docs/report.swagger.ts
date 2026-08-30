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
 * /api/reports/sales-trend:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Retrieve net-sales time series for the overview chart
 *     description: Returns an ordered list of net-sales (USD) data points bucketed by the selected granularity — weekly (current week, Mon→Sun), monthly (current year, Jan→current month), or yearly (last 5 years).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, yearly]
 *           default: weekly
 *         required: false
 *         description: The bucketing granularity for the sales trend.
 *     responses:
 *       200:
 *         description: Sales trend retrieved successfully
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
 *                     granularity:
 *                       type: string
 *                       example: "weekly"
 *                     points:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                             example: "Mon"
 *                           value:
 *                             type: number
 *                             example: 1420.5
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
 *
 * /api/reports/exports/sales-summary:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Export the Sales Summary ("Menu Performance") workbook
 *     description: >
 *       Streams a styled .xlsx workbook for an inclusive range of shop-local calendar days.
 *       The sheet carries one row-block per day; inside a day every item is split by payment
 *       method, with quantity sold, gross sales, discounts (comps plus each line's pro-rata
 *       share of order promotions) and net sales. Only sold orders are counted (paid and
 *       partially-refunded, excluding cancelled), and cancelled line quantities are dropped.
 *       Responds 204 when the window has no sales.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-08-01"
 *         required: true
 *         description: First shop-local calendar day to include (YYYY-MM-DD).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-08-07"
 *         required: true
 *         description: Last shop-local calendar day to include (YYYY-MM-DD); must be on or after startDate.
 *     responses:
 *       200:
 *         description: Workbook generated successfully. Filename is in the Content-Disposition header.
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename="SalesSummary_2026-08-01_to_2026-08-07.xlsx"'
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       204:
 *         description: No sales in the requested period, so no workbook was produced.
 *       400:
 *         description: Invalid or reversed date range.
 *
 * /api/reports/daily-summary:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Retrieve the daily cash/KHQR revenue summary
 *     description: Returns total paid revenue for a shop on a given day, broken down by cash and KHQR payment methods, along with the shop's exchange rate. Accessible to both Admin and Cashier roles. Defaults to the current day if no date is provided.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-07-22"
 *         required: false
 *         description: The target date to summarize, in YYYY-MM-DD format. Defaults to today when omitted.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-07-25"
 *         required: false
 *         description: Widens the summary to the inclusive window [date, endDate]. Requires `date`, and must be on or after it.
 *     responses:
 *       200:
 *         description: Daily summary retrieved successfully
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
 *                     total_revenue:
 *                       type: number
 *                       example: 45.00
 *                     cash_total:
 *                       type: number
 *                       example: 30.00
 *                     khqr_total:
 *                       type: number
 *                       example: 15.00
 *                     exchange_rate:
 *                       type: number
 *                       example: 4100
 *       400:
 *         description: Validation error (invalid date format)
 *       401:
 *         description: Unauthorized (Invalid or missing JWT)
 *       403:
 *         description: Forbidden (Requires Admin or Cashier privileges)
 */
