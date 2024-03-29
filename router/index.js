const Router = require('express').Router;
const multer = require('multer');
const { body } = require('express-validator');
const {
    registration,
    login,
    refresh,
    activate,
    getActivationLink,
    logout,
    getUsers,
    updateMyUser,
    deleteMyUser,
    addFriend,
    removeFriend,
} = require('../controllers/user-controller');
const {
    createWish,
    bookWish,
    cancelBookWish,
    doneWish,
    undoneWish,
    updateWish,
    getWishList,
    deleteWish,
} = require('../controllers/wish-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const { MAX_NUMBER_OF_FILES } = require('../utils/variables');

const upload = multer();

const fields = Array.from(
    // додаємо одиницю до MAX_NUMBER_OF_FILES спеціально щоб відпрацював не multer, а wishValidator в разі перевищення максимальної кількості завантажувальних файлів
    { length: MAX_NUMBER_OF_FILES + 1 },
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
router.get('/get-activation-link/:userId', getActivationLink);
router.get('/refresh', refresh);
router.get('/users', authMiddleware, getUsers);
router.put('/user', upload.single('avatar'), authMiddleware, updateMyUser);
router.post('/user/delete', authMiddleware, deleteMyUser);
router.post('/friend', authMiddleware, addFriend);
router.delete('/friend', authMiddleware, removeFriend);
router.post('/wish', upload.fields(fields), authMiddleware, createWish);
router.post('/wish/book', authMiddleware, bookWish);
router.post('/wish/cancel-book', authMiddleware, cancelBookWish);
router.post('/wish/done', authMiddleware, doneWish);
router.post('/wish/undone', authMiddleware, undoneWish);
router.put('/wish', upload.fields(fields), authMiddleware, updateWish);
router.delete('/wish', authMiddleware, deleteWish);
router.get('/wishes', authMiddleware, getWishList);

module.exports = router;
