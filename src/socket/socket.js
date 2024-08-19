const {Server} = require('socket.io')

// Initialize Socket.IO with CORS settings
 let   io ;
 let onlineUsers = []
 function socketInit(httpServer){
   io =  new Server(httpServer, {
        cors: {
          origin: "*", // Replace with your Angular app URL
          methods: ["GET", "POST"],
          credentials: true,
        },
      });
      // Handle socket connections
  io.on("connection", (socket) => {
      let userId = socket.handshake.query.id;
      socket.id = userId
      console.log("New socket connection:", socket.id);
      onlineUsers.push(socket.id)
      socket.broadcast.emit('onlineusers', onlineUsers);
  
    // Handle disconnection
    socket.on("disconnect", () => {
       let index = onlineUsers.indexOf(socket.id);
       onlineUsers.splice(index , 1)
       socket.broadcast.emit('onlineusers', onlineUsers);
      console.log("Socket disconnected:", socket.id);
    });
  });
}
  
  

  module.exports = {socketInit}