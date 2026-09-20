import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const { SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

const LOGO_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'logo.png');
const LOGO_CID = 'unic-logo';

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

/* Почтовые клиенты не читают внешние стили — всё оформление живёт в атрибуте style.
   Ширину держит таблица: только она центрируется одинаково везде. */
export const layout = (code) => `
<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:0;background:#f5f5f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:18px;border:1px solid rgba(0,0,0,0.06);">
            <tr>
              <td align="center" style="padding:40px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">

                <img src="cid:${LOGO_CID}" alt="Unic" width="132" style="display:block;border:0;margin:0 auto 24px;" />

                <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1d1d1f;letter-spacing:-0.4px;">Восстановление пароля</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.5;color:#6e6e73;">Введите этот код на странице восстановления</p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                  <tr>
                    <td align="center" style="background:#f5f5f7;border-radius:12px;padding:18px 28px;">
                      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:34px;font-weight:600;letter-spacing:10px;color:#0063fd;">${code}</span>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:#86868b;">Код действует 10 минут.</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#86868b;">Если вы не запрашивали восстановление, просто проигнорируйте это письмо.</p>

              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
                <div style="border-top:1px solid rgba(0,0,0,0.06);padding-top:20px;font-size:12px;color:#86868b;">
                  Unic — управление клубами университета
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export async function sendResetCode(email, code) {
  if (!transport) {
    console.log(`[почта не настроена] код для ${email}: ${code}`);
    return;
  }

  await transport.sendMail({
    from: MAIL_FROM || `Unic <${SMTP_USER}>`,
    to: email,
    // В теме кода нет: она видна в уведомлениях и на экране блокировки
    subject: 'Код для восстановления пароля',
    text: `Код для восстановления пароля: ${code}\n\nКод действует 10 минут. Если вы не запрашивали восстановление, просто проигнорируйте это письмо.\n\nUnic — управление клубами университета`,
    html: layout(code),
    attachments: [{ filename: 'logo.png', path: LOGO_PATH, cid: LOGO_CID }],
  });
}
