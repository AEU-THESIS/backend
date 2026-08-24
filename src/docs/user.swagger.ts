/**
 * @openapi
 * tags:
 *   name: User
 *   description: Staff management operations
 *
 * /api/users:
 *   get:
 *     tags:
 *       - User
 *     summary: Get all staff members for the authenticated user's shop
 *     description: Returns a list of staff members with their roles. Passwords are excluded for security.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Staff list retrieved successfully
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
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       role:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized (Invalid or missing JWT)
 *       403:
 *         description: Forbidden (Admin-only)
 *
 *   post:
 *     tags:
 *       - User
 *     summary: Create a new staff member
 *     description: Creates a new user with a random temporary password, assigns a role, and sends an account setup email with an 8-hour token link.
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
 *               - email
 *               - roleId
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name of the staff member
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The staff member's email address
 *                 example: "johndoe@routincafe.com"
 *               roleId:
 *                 type: integer
 *                 description: ID of the role to assign (e.g. Manager, Cashier)
 *                 example: 2
 *     responses:
 *       201:
 *         description: Staff member created. Setup email sent.
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
 *                   example: "Staff member created successfully. Setup email sent."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error, duplicate email, or invalid role
 *       401:
 *         description: Unauthorized (Invalid or missing JWT)
 *       403:
 *         description: Forbidden (Admin-only)
 */
