const Router = require('express').Router;
const multer = require('multer');
const {
    registration,
    login,
    refresh,
    activate,
    logout,
    getUsers,
    saveMyUser,
} = require('../controllers/user-controller');
const { createWish, getWishList } = require('../controllers/wish-controller');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth-middleware');

const upload = multer();

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
router.post('/wishes', authMiddleware, createWish);
router.get('/wishes', authMiddleware, getWishList);
router.post('/user', upload.single('avatar'), authMiddleware, saveMyUser);

module.exports = router;
