/**
 * @openapi
 * tags:
 *   name: Role
 *   description: Role management operations
 *
 * /api/roles:
 *   get:
 *     tags:
 *       - Role
 *     summary: Get all roles for the authenticated user's shop
 *     description: Returns available roles (e.g. Admin, Manager, Cashier) for the shop. Used to populate the role dropdown in the staff creation form.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
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
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "Admin"
 *       401:
 *         description: Unauthorized (Invalid or missing JWT)
 *       403:
 *         description: Forbidden (Requires Admin or Manager role)
 */
