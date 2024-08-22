const {Server} = require('socket.io');
const { sendMessage } = require('../controllers/user.controller');

// Initialize Socket.IO with CORS settings
 let   io ;
 let onlineUsers = []
 const userSocketMap = {}; // Store user ID to socket ID mapping
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
          socket.userId = userId;
      
          // Map the user ID to the socket ID
          userSocketMap[userId] = socket.id;
          console.log("New socket connection:", socket.userId);
      
          onlineUsers.push(userId);
          socket.broadcast.emit('onlineusers', onlineUsers);
      
          socket.on("sendMessage", async (data) => {
              socket.join(data.inbox_id);
      
              // Debugging logs
              // console.log('Sender ID:', data.sender_id);
              // console.log('Receiver ID:', data.receiver_id);
      
              let messages = await sendMessage(data);
      
              // Send confirmation to the sender
      
              // Fetch the receiver's socket ID using userSocketMap
              const receiverSocketId = userSocketMap[data.receiver_id];
      
              // Send message received notification to the receiver
              if (receiverSocketId) {
                  io.to(receiverSocketId).emit("messageReceviced", messages);
              } else {
                  console.log('Receiver not connected');
              }
              socket.emit("sent", messages);
          });
      
          socket.on("disconnect", () => {
              let index = onlineUsers.indexOf(userId);
              onlineUsers.splice(index, 1);
              socket.broadcast.emit('onlineusers', onlineUsers);
              console.log("Socket disconnected:", userId);
      
              // Remove from userSocketMap
              delete userSocketMap[userId];
          });
      });
      
    
}
  
  

  module.exports = {socketInit}