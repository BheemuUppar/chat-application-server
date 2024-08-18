const express = require("express");
const router = express.Router();
const upload = require("../db/storage/multerStorage");

const { uploadProfile, getUserById } = require("../controllers/user.controller");

router.post("/upload/profile", upload.single("file"), uploadProfile);

router.get("/getuser/:id", getUserById);

module.exports = router;
