const nodemailer = require('nodemailer');

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

    async sendActivationMail(to, link) {
        await this.transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject: `Активація облікового запису на ${process.env.API_URL}`,
            text: '',
            html: `
                <body
                    style="
                        font-family: 'Arial', sans-serif;
                        background-color: #f4f4f4;
                        text-align: center;
                        padding: 20px;
                    "
                >
                    <div
                        style="
                            max-width: 600px;
                            margin: 0 auto;
                            background-color: #fff;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        "
                    >
                        <h1 style="color: #333">Для активації перейдіть за посиланням:</h1>
                        <a
                            href="${link}"
                            style="
                                display: inline-block;
                                margin-top: 15px;
                                padding: 10px 20px;
                                background-color: #007bff;
                                color: #ffffff;
                                text-decoration: none;
                                border-radius: 5px;
                            "
                        >
                            Активувати акаунт
                        </a>
                    </div>
                </body>
            `,
        });
    }
}

module.exports = new MailService();
