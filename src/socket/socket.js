const { Server } = require("socket.io");
const {
  sendMessage,
  markAsRead,
  sendMessageToGroup,
  deleteMessage,
} = require("../controllers/message.controller");
const client = require("../db/connect/connections");

// Initialize Socket.IO with CORS settings
let io;
let onlineUsers = [];
const userSocketMap = {}; // Store user ID to socket ID mapping
function socketInit(httpServer) {
  io = new Server(httpServer, {
    pingTimeout:60000 ,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8, // 100 MB (increase if needed)
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
    io.emit("onlineusers", onlineUsers);

    socket.on("sendMessage", async (data) => {
     try {
       // socket.join(data.inbox_id);
       console.log('message sending.. ', )
       let messages = await sendMessage(data);
       // Send confirmation to the sender
       // Fetch the receiver's socket ID using userSocketMap
       const receiverSocketId = userSocketMap[data.receiver_id];
       // Send message received notification to the receiver
       if (receiverSocketId) {
         io.to(receiverSocketId).emit("messageReceviced", "");
       } else {
         console.log("Receiver not connected");
       }
       socket.emit("sent", "");
     } catch (error) {
      console.log(error)
     }
    });

    socket.on("read", async (data) => {
      let res = await markAsRead(data);
      socket.emit("onMsgRead");
    });

    socket.on("disconnect", async () => {
      try {
        let index = onlineUsers.indexOf(userId);
        onlineUsers.splice(index, 1);
        // socket.broadcast.emit('onlineusers', onlineUsers);
        io.emit("onlineusers", onlineUsers);
        console.log("Socket disconnected:", userId);

        let query = `UPDATE users
  SET last_seen = CURRENT_TIMESTAMP
  WHERE user_id = $1;`;

        await client.query(query, [userId]);
        // Remove from userSocketMap
        delete userSocketMap[userId];
      } catch (error) {
        // throw Error('Internal Server Error')
        // console.log(error)
      }
    });

    socket.on("groupCreated", async (users) => {
      console.log("group creaded in socket", users);
      console.log("online users", onlineUsers);
      users.forEach((user) => {
        user = user + "";
        if (onlineUsers.includes(user)) {
          const receiverSocketId = userSocketMap[user];
          // io.to(user).emit("groupAdded", { message: "group created" });
          // console.log("emmiting to ", user);
          io.to(receiverSocketId).emit("groupAdded", {
            message: "group created",
          });
        }
      });
    });

    socket.on("sendToGroup", async (data) => {
      let res = await sendMessageToGroup(
        data.inbox_id,
        data.sender_id,
        data.message_text,
        data
      );
      let membersRows = await client.query(
        `
      select member_id from group_members
      where inbox_id = $1
      `,
        [data.inbox_id]
      );
      let members = membersRows.rows.map((member) => member.member_id);

      members.forEach((id) => {
        const receiverSocketId = userSocketMap[id];
        if (receiverSocketId && id != data.sender_id) {
          io.to(receiverSocketId).emit("messageReceviced", "");
        } else {
          console.log("Receiver not connected");
        }
      });

      socket.emit("sent", "");
    });

    socket.on("deleteMessage", async (data) => {
      const message_id = data.message_id;
      const inbox_id = data.inbox_id;
      let result = await deleteMessage(message_id);
      let inboxData = await client.query(
        `select * from inbox where inbox_id = $1 `,
        [inbox_id]
      );
      let inbox = inboxData.rows[0];

      if (result == false) {
        socket.emit("failedToDeleteMessage", "");
      } else {
        // socket.emit('msgDeleted', '');
        let users = [];
        if (inbox.isgroup == false) {
          users = [inbox.user1_id, inbox.user2_id];
        } else {
          let groupMembers = await client.query(
            `select member_id from group_members where inbox_id = $1 `,
            [inbox_id]
          );
          users = groupMembers.rows.map((member) => {
            return member.member_id;
          });
        }
        users.forEach((id) => {
          const receiverSocketId = userSocketMap[id];
          if (receiverSocketId && id != data.sender_id) {
            io.to(receiverSocketId).emit("msgDeleted", "");
          } else {
            console.log("Receiver not connected");
          }
        });
      }
    });
  });
}

module.exports = { socketInit };
