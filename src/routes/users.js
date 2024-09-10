const express = require("express");
const router = express.Router();
const upload = require("../db/storage/multerStorage");

const { uploadProfile, getUserById, searchUSers, getAllinbox,createGroup, getInboxInfo, fetchChatInfo } = require("../controllers/user.controller");
const { getAllMessages } = require("../controllers/message.controller");

router.post("/upload/profile", upload.single("file"), uploadProfile);

router.get("/getuser/:id", getUserById);
router.get("/search", searchUSers);

router.get('/getAllChats/:user_id',  getAllinbox);
router.get('/getAllMessage/:inbox_id',  getAllMessages);

router.post('/creategroup', upload.single("groupProfileImage"), createGroup)

router.get('/group/info/:inbox_id', getInboxInfo)
router.get('/chat/info/:user_id/:inbox_id', fetchChatInfo)




module.exports = router;
