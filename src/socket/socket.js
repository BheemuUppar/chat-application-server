const {Server} = require('socket.io');
const { sendMessage } = require('../controllers/user.controller');

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
  

      socket.on("sendMessage", async  (data)=>{
        socket.join(data.receiver_id);
        console.log("send message event")
       let  messages = await sendMessage(data)
       socket.to(data.receiver_id).emit(messages)
       // create room if not exist
   
      })

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