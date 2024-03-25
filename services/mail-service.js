const nodemailer = require('nodemailer');
const fs = require('fs').promises;

class MailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            // secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
    }

    async sendActivationMail(to, name, link) {
        const html = await fs.readFile('emails/activationEmail.html', 'utf-8');

        await this.transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject: `Активація облікового запису на ${process.env.CLIENT_URL.replace('https://', '')}`,
            text: '',
            html: html.replace('{link}', link).replace('{name}', name)
        });
    }
}

module.exports = new MailService();
