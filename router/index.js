const Router = require('express').Router;
const multer = require('multer');
const {
    registration,
    login,
    refresh,
    activate,
    logout,
    getUsers,
    updateMyUser,
} = require('../controllers/user-controller');
const { createWish, updateWish, getWishList } = require('../controllers/wish-controller');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth-middleware');

const upload = multer();

const fields = Array.from({ length: 10 }, (_, index) => ({ name: `image-${index + 1}` }));

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
router.post('/wish', upload.fields(fields), authMiddleware, createWish);
router.put('/wish', upload.fields(fields), authMiddleware, updateWish);
router.get('/wishes', authMiddleware, getWishList);
router.put('/user', upload.single('avatar'), authMiddleware, updateMyUser);

module.exports = router;
