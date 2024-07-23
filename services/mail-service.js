const nodemailer = require('nodemailer');
const fs = require('fs').promises;

class MailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: process.env.SMTP_SERVICE,
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
    }

    async sendActivationMail(lang, to, name, link) {
        const html = await fs.readFile(`emails/activation/${lang}.html`, 'utf-8');

        let subject = 'Account activation at';
        lang === 'uk' && (subject = 'Активація облікового запису на');

        await this.transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject: `${subject} ${process.env.CLIENT_URL.replace('https://', '')}`,
            text: '',
            html: html.replace('{name}', name).replace('{link}', link).replace('{handle-link}', link)
        });
    }

    async sendPasswordResetMail(lang, to, name, link) {
        const html = await fs.readFile(`emails/password-reset/${lang}.html`, 'utf-8');

        let subject = 'Password reset at';
        lang === 'uk' && (subject = 'Відновлення пароля на');

        await this.transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject: `${subject} ${process.env.CLIENT_URL.replace('https://', '')}`,
            text: '',
            html: html.replace('{name}', name).replace('{link}', link).replace('{handle-link}', link)
        });
    }
}

module.exports = new MailService();
