const express = require("express");
const { deleteMessage } = require("../controllers/message.controller");
const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({message:"Message route"})
});


router.get('/delete' , deleteMessage )
module.exports = router;
