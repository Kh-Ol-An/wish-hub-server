const Router = require('express').Router;
const multer = require('multer');
const { body } = require('express-validator');
const {
    registration,
    activate,
    getActivationLink,
    googleAuthorization,
    login,
    logout,
    refresh,
    forgotPassword,
    changeForgottenPassword,
    changePassword,
    changeLang,
    notificationSubscribe,
    notificationUnsubscribe,
    changeShowedInfo,
    changeFirstLoaded,
    updateMyUser,
    addFriend,
    removeFriend,
    deleteMyUser,
    getUsers,
    getAllUsers,
} = require('../controllers/user-controller');
const {
    createWish,
    updateWish,
    getWish,
    bookWish,
    cancelBookWish,
    doneWish,
    undoneWish,
    likeWish,
    dislikeWish,
    deleteWish,
    getWishList,
    getAllWishes,
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

router.post('/registration', body('email').isEmail(), registration);
router.get('/activate/:link', activate);
router.get('/get-activation-link/:userId', getActivationLink);
router.post('/google-auth', googleAuthorization);
router.post('/login', login);
router.post('/logout', logout);
router.get('/refresh', refresh);
router.put('/forgot-password', forgotPassword);
router.put('/change-forgotten-password', changeForgottenPassword);
router.put('/change-password', authMiddleware, changePassword);
router.put('/lang', authMiddleware, changeLang);
router.put('/notification-subscribe', authMiddleware, notificationSubscribe);
router.put('/notification-unsubscribe', authMiddleware, notificationUnsubscribe);
router.put('/showed-info', authMiddleware, changeShowedInfo);
router.put('/first-loaded', authMiddleware, changeFirstLoaded);
router.put('/user', upload.single('avatar'), authMiddleware, updateMyUser);
router.post('/friend', authMiddleware, addFriend);
router.delete('/friend', authMiddleware, removeFriend);
router.post('/user/delete', authMiddleware, deleteMyUser);
router.get('/users', authMiddleware, getUsers);
router.get('/all-users', getAllUsers);

router.post('/wish', upload.fields(fields), authMiddleware, createWish);
router.put('/wish', upload.fields(fields), authMiddleware, updateWish);
router.get('/wish', getWish);
router.put('/wish/book', authMiddleware, bookWish);
router.put('/wish/cancel-book', authMiddleware, cancelBookWish);
router.put('/wish/done', authMiddleware, doneWish);
router.put('/wish/undone', authMiddleware, undoneWish);
router.put('/wish/like', authMiddleware, likeWish);
router.put('/wish/dislike', authMiddleware, dislikeWish);
router.delete('/wish', authMiddleware, deleteWish);
router.get('/wishes', getWishList);
router.get('/all-wishes', getAllWishes);

module.exports = router;
