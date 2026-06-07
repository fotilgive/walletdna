import nodemailer from 'nodemailer';

// Uses Gmail SMTP with App Password (not your main Gmail password).
// How to get App Password:
//   Google Account → Security → 2-Step Verification → App passwords → create one
//   Set GMAIL_APP_PASSWORD in Railway env vars.

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SUPPORT_EMAIL || 'walletdna.help@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendWelcomeEmail({ to, password }) {
  const loginUrl = process.env.PUBLIC_APP_URL || 'https://walletdna.app';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#06060a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#A855F7,#00D4FF);border-radius:14px;line-height:52px;font-size:24px;margin-bottom:16px;">🧬</div>
      <h1 style="color:#F8FAFC;font-size:22px;font-weight:800;margin:0;">WalletDNA</h1>
      <p style="color:#64748B;font-size:14px;margin:6px 0 0;">Smart money tracker for Base chain</p>
    </div>

    <!-- Main card -->
    <div style="background:#0f0f16;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px 28px;margin-bottom:20px;">
      <h2 style="color:#F8FAFC;font-size:18px;font-weight:800;margin:0 0 8px;">
        🎉 Your access is ready
      </h2>
      <p style="color:#94A3B8;font-size:14px;margin:0 0 28px;line-height:1.6;">
        Thank you for purchasing WalletDNA Lifetime Access. Here are your login credentials:
      </p>

      <!-- Credentials box -->
      <div style="background:#06060a;border:1px solid rgba(168,85,247,0.3);border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <div style="margin-bottom:14px;">
          <div style="color:#64748B;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Email</div>
          <div style="color:#F8FAFC;font-size:15px;font-weight:600;font-family:monospace;">${to}</div>
        </div>
        <div>
          <div style="color:#64748B;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Password</div>
          <div style="color:#A855F7;font-size:18px;font-weight:800;font-family:monospace;letter-spacing:0.05em;">${password}</div>
        </div>
      </div>

      <a href="${loginUrl}/login" style="display:block;text-align:center;padding:14px;background:linear-gradient(135deg,#A855F7,#6366F1);border-radius:12px;color:#fff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 4px 20px rgba(168,85,247,0.3);">
        Sign In to WalletDNA →
      </a>
    </div>

    <!-- What's next -->
    <div style="background:#0f0f16;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px 28px;margin-bottom:20px;">
      <div style="color:#F8FAFC;font-size:14px;font-weight:800;margin-bottom:16px;">🚀 Start here</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="color:#94A3B8;font-size:13px;line-height:1.6;">✅ <strong style="color:#F8FAFC;">Live Clusters</strong> — real-time smart money signals</div>
        <div style="color:#94A3B8;font-size:13px;line-height:1.6;">💎 <strong style="color:#F8FAFC;">Hidden Gems</strong> — wallets nobody is copying yet</div>
        <div style="color:#94A3B8;font-size:13px;line-height:1.6;">📲 <strong style="color:#F8FAFC;">Telegram Alerts</strong> — get pinged when clusters form</div>
        <div style="color:#94A3B8;font-size:13px;line-height:1.6;">📊 <strong style="color:#F8FAFC;">Signal History</strong> — see how every past signal performed</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#334155;font-size:12px;line-height:1.7;">
      <p style="margin:0 0 6px;">Change your password after first login in Profile settings.</p>
      <p style="margin:0;">Questions? Reply to this email or contact <a href="mailto:walletdna.help@gmail.com" style="color:#A855F7;">walletdna.help@gmail.com</a></p>
    </div>

  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"WalletDNA" <${process.env.SUPPORT_EMAIL || 'walletdna.help@gmail.com'}>`,
    to,
    subject: '🧬 Your WalletDNA access — login credentials inside',
    html,
  });

  console.log(`[MAILER] Welcome email sent to ${to}`);
}

export async function sendTestEmail(to) {
  await transporter.sendMail({
    from: `"WalletDNA" <${process.env.SUPPORT_EMAIL || 'walletdna.help@gmail.com'}>`,
    to,
    subject: '✅ WalletDNA email test',
    text: 'Email sending works correctly.',
  });
}
