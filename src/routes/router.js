const express = require("express");

const app = express();


// error handling middleware

app.use((err, req, res, next) => {
    if (err) {
        res.status(500).json({ message: err.message });
    } else {
        next();
    }
});

app.listen(3000, () => {
  console.log("server is running... ");
});

module.exports = app;
