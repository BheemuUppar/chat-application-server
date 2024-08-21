const express = require("express");
const router = express.Router();
const upload = require("../db/storage/multerStorage");

const { uploadProfile, getUserById, searchUSers, getAllinbox, getAllMessages } = require("../controllers/user.controller");

router.post("/upload/profile", upload.single("file"), uploadProfile);

router.get("/getuser/:id", getUserById);
router.get("/search", searchUSers);

router.get('/getAllChats/:user_id',  getAllinbox);
router.get('/getAllMessage/:inbox_id',  getAllMessages);




module.exports = router;
