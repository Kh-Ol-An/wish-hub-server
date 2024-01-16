const Router = require('express').Router;
const {registration, login, refresh, activate, logout, getUsers} = require('../controllers/user-controller');
const {body} = require('express-validator');

const router = new Router();

router.post(
    '/registration',
    body('email').isEmail(),
    body('password').isLength({min: 4, max: 32}),
    registration,
);
router.post('/login', login);
router.post('/logout', logout);
router.get('/activate/:link', activate);
router.get('/refresh', refresh);
router.get('/users', getUsers);

module.exports = router;
