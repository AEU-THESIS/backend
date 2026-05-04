import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 1025,
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
})

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const FROM = process.env.SMTP_FROM || 'RoutinCafe <no-reply@routincafe.com>'

export const emailService = {
  /**
   * Sends an account setup email to a newly created staff member.
   * The link contains a JWT token valid for 8 hours.
   */
  async sendAccountSetupEmail(email: string, name: string, token: string) {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`

    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: 'Welcome to RoutinCafe — Set Your Password',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #33251d; margin-bottom: 8px;">Welcome, ${name}!</h2>
          <p style="color: #555; line-height: 1.6;">
            You have been added as a team member at <strong>RoutinCafe</strong>.
            Please click the button below to set your password and activate your account.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}"
               style="background-color: #33251d; color: #fff; padding: 14px 32px; border-radius: 8px;
                      text-decoration: none; font-weight: bold; display: inline-block;">
              Set Your Password
            </a>
          </div>
          <p style="color: #999; font-size: 13px;">
            This link expires in <strong>8 hours</strong>. If you did not expect this email, please ignore it.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #bbb; font-size: 11px; text-align: center;">
            © ${new Date().getFullYear()} RoutinCafe • Artisan POS System
          </p>
        </div>
      `,
    })
  },

  /**
   * Sends a password reset email for the "Forgot Password" flow.
   * The link contains a JWT token valid for 8 hours.
   */
  async sendPasswordResetEmail(email: string, token: string) {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`

    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: 'RoutinCafe — Reset Your Password',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #33251d; margin-bottom: 8px;">Password Reset Request</h2>
          <p style="color: #555; line-height: 1.6;">
            We received a request to reset your password.
            Click the button below to choose a new password.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}"
               style="background-color: #845230; color: #fff; padding: 14px 32px; border-radius: 8px;
                      text-decoration: none; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #999; font-size: 13px;">
            This link expires in <strong>8 hours</strong>. If you did not request this, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #bbb; font-size: 11px; text-align: center;">
            © ${new Date().getFullYear()} RoutinCafe • Artisan POS System
          </p>
        </div>
      `,
    })
  },
}
