const Router = require('express').Router;
const {
    registration,
    login,
    refresh,
    activate,
    logout,
    getUsers,
    saveMyUser,
} = require('../controllers/user-controller');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth-middleware');

const router = new Router();

router.post(
    '/registration',
    body('email').isEmail(),
    body('password').isLength({ min: 4, max: 32 }),
    registration,
);
router.post('/login', login);
router.post('/logout', logout);
router.get('/activate/:link', activate);
router.get('/refresh', refresh);
router.get('/users', authMiddleware, getUsers);
router.post('/user', authMiddleware, saveMyUser);

module.exports = router;
