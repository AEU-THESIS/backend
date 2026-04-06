// This is a stub for the email service.
// When you get SMTP credentials, you can replace this logic with Nodemailer or an API like Resend.
export const emailService = {
  async sendPasswordResetEmail(email: string, token: string) {
    console.log("\n==================================================");
    console.log(`📧 MOCK EMAIL SENT TO: ${email}`);
    console.log(`⏰ Expiry: 24 Hours`);
    console.log(
      `🔗 Reset Link: http://localhost:3000/reset-password?token=${token}`,
    );
    console.log("==================================================\n");
    return true;
  },
};
