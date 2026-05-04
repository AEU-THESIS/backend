/**
 * @openapi
 * /api/auth/sessions:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Create a new session (Login)
 *     description: Authenticate a user and return a JWT token.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@routincafe.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         user_id:
 *                           type: integer
 *                           example: 1
 *                         shop_id:
 *                           type: integer
 *                           example: 1
 *                         role:
 *                           type: string
 *                           example: Admin
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid credentials
 *   delete:
 *     tags:
 *       - Auth
 *     summary: Terminate a session (Logout)
 *     description: Invalidate the current session by blacklisting the token.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @openapi
 * /api/auth/password-resets:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Request a password reset email
 *     description: Sends a password reset link to the user's email. Returns success even if email is not found (to prevent enumeration).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@routincafe.com
 *     responses:
 *       200:
 *         description: Reset link sent (or silently ignored if email not found)
 *       400:
 *         description: Validation failed
 *
 * /api/auth/password-resets/{token}:
 *   put:
 *     tags:
 *       - Auth
 *     summary: Reset password using a token
 *     description: Verifies the JWT token from the email link and sets the new password. Used by both account setup and forgot password flows.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT token from the email link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$"
 *                 description: New password (min 8 characters, must contain uppercase, lowercase, number, and special character)
 *                 example: "NewPassw0rd!"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
