const express = require("express");
const parser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { socketInit } = require("../socket/socket");
// const { Server } = require("socket.io");

// Initialize Express app
const app = express();

// Middleware setup
app.use(cors());
app.use(parser.json());

// Create HTTP server
let httpServer = http.createServer(app);

socketInit(httpServer)


// Routers
const AuthRouter = require("./auth");
const UsersRouter = require("./users");
const MessageRouter = require("./messages");


app.use("/auth", AuthRouter);
app.use("/users", UsersRouter);
app.use("/message", MessageRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err) {
    res.status(500).json({ message: err.message });
  } else {
    next();
  }
});

// Start server
const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
