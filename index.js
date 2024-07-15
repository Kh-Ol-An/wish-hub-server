require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cron = require('node-cron');
const webPush = require('web-push');
const router = require('./router/index');
const errorMiddleware = require('./middlewares/error-middleware');
const UserService = require('./services/user-service');

const PORT = process.env.PORT || 5000;

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,token');
    res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
    res.header('Content-Type', 'application/json;charset=utf-8');
    res.header('Access-Control-Allow-Credentials', true);
    next();
});
app.use('/api', router);
app.use(errorMiddleware);

cron.schedule(
    '0 0 * * *', // every day at 00:00
//    '*/2 * * * *', // кожні дві хвилини
    async () => {
        await UserService.deleteInactiveAccounts();
        await UserService.deleteExpiredPasswordResetLink();
    },
    {
        timezone: 'UTC'
    },
);

webPush.setVapidDetails(
    `mailto:${process.env.SMTP_USER}`,
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
);

const start = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        app.listen(PORT, () => console.log(`Server started on PORT: ${PORT}`));
    } catch (error) {
        console.log(error);
    }
};

start();

// TODO: до user додати поле lastActivity, яке буде оновлюватись кожен раз при виконанні будь-якого запиту від користувача. Якщо користувач не виконував запити протягом 370 днів, то його аккаунт вважається неактивним. Такому користувачеві надсилається лист з попередженням про видалення акаунта через 31 день якщо він не відвідає наш ресурс.
