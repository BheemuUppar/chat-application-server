const express = require("express");
const router = express.Router();
const upload = require("../db/storage/multerStorage");

const { uploadProfile, getUserById, searchUSers, getAllinbox,createGroup, getInboxInfo } = require("../controllers/user.controller");
const { getAllMessages } = require("../controllers/message.controller");

router.post("/upload/profile", upload.single("file"), uploadProfile);

router.get("/getuser/:id", getUserById);
router.get("/search", searchUSers);

router.get('/getAllChats/:user_id',  getAllinbox);
router.get('/getAllMessage/:inbox_id',  getAllMessages);

router.post('/creategroup', upload.single("groupProfileImage"), createGroup)

router.get('/chat/info/:inbox_id', getInboxInfo)




module.exports = router;
