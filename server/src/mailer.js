import nodemailer from 'nodemailer';

const { SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

// Пока SMTP не настроен, код печатается в консоль сервера — поток остаётся рабочим
const configured = Boolean(SMTP_USER && SMTP_PASS);

const transport = configured
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export async function sendResetCode(email, code) {
  if (!transport) {
    console.log(`[почта не настроена] код для ${email}: ${code}`);
    return;
  }

  await transport.sendMail({
    from: MAIL_FROM || `Unic <${SMTP_USER}>`,
    to: email,
    subject: `${code} — код для восстановления пароля`,
    text: `Код для восстановления пароля: ${code}\n\nКод действует 10 минут. Если вы не запрашивали восстановление, просто проигнорируйте это письмо.`,
    html: `
      <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#1d1d1f">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;letter-spacing:-0.016em">Восстановление пароля</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#6e6e73">Введите этот код на странице восстановления:</p>
        <p style="margin:0 0 24px;font-size:34px;font-weight:600;letter-spacing:0.18em;color:#0063fd">${code}</p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#86868b">Код действует 10 минут. Если вы не запрашивали восстановление, просто проигнорируйте это письмо.</p>
      </div>
    `,
  });
}
