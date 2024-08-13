const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({message:"users route"})
});

module.exports = router;
