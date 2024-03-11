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
    addFriend,
    deleteFriend,
} = require('../controllers/user-controller');
const { createWish, updateWish, getWishList, deleteWish } = require('../controllers/wish-controller');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth-middleware');

const upload = multer();

const fields = Array.from(
    // додаємо одиницю до MAX_NUMBER_OF_FILES спеціально щоб відпрацював не multer, а wishValidator в разі перевищення максимальної кількості завантажувальних файлів
    { length: process.env.MAX_NUMBER_OF_FILES + 1 },
    (_, index) => ({ name: `image-${index}` }),
);

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
router.put('/user', upload.single('avatar'), authMiddleware, updateMyUser);
router.post('/friend', authMiddleware, addFriend);
router.delete('/friend', authMiddleware, deleteFriend);
router.post('/wish', upload.fields(fields), authMiddleware, createWish);
router.put('/wish', upload.fields(fields), authMiddleware, updateWish);
router.get('/wishes', authMiddleware, getWishList);
router.delete('/wish', authMiddleware, deleteWish);

module.exports = router;
