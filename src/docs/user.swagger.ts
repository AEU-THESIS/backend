/**
 * @openapi
 * tags:
 *   name: User
 *   description: User management operations
 *
 * /api/users/admin:
 *   post:
 *     tags:
 *       - User
 *     summary: Create a new user (Admin Only)
 *     description: Allows an admin to register a new user into a specific shop. Generates a temporary secure password and sends an email to the user with a 24-hour reset password link.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shopId
 *               - name
 *               - email
 *             properties:
 *               shopId:
 *                 type: integer
 *                 description: ID of the shop to assign this user to
 *                 example: 1
 *               name:
 *                 type: string
 *                 description: Full name of the user
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The user's valid email address
 *                 example: "johndoe@example.com"
 *     responses:
 *       201:
 *         description: User created successfully. Email sent with password reset link.
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
 *                   example: "Resource created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     shopId:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error or user/shop already exists
 *       401:
 *         description: Unauthorized (Invalid or missing JWT)
 *       403:
 *         description: Forbidden (Requires Admin role)
 */
