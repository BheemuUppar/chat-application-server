const express = require("express");

const app = express();
const  AuthRouter = require("./auth");
const UsersRouter = require("./users");
const MessageRouter = require("./messages")

app.use("/auth" , AuthRouter);
app.use("/users" , UsersRouter);
app.use("/message" , MessageRouter);

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
