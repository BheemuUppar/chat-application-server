const client = require("../db/connect/connections");
const queries = require("../db/queries/Queries");
const path = require("path");
const fs = require("fs");
const { convertImagetoString } = require("./user.controller");

const sendMessage = async (data) => {
  if (data.files_data) {
    let files = data.files_data.map((file) => {
      const savePath = path.join(__dirname, `../../assets/messages`);
      const filePath = path.join(savePath, Date.now() + "_" + file.name);
      fs.writeFileSync(filePath, Buffer.from(file.fileData));
      file.name = filePath;
      file.fileData = filePath;
      return file;
    });
    let sender_id = data.sender_id;
    let inboxData = await findInbox(data.sender_id, data.receiver_id);
    let message_text = data.message_text == "" ? null : data.message_text;

    let sendMessageQuery = `
          insert into messages (inbox_id, sender_id, message_text, message_status, message_file)
          values($1, $2, $3, 'unread', $4)
          returning message_id, message_text, message_status;
          `;
    let afterSent = await client.query(sendMessageQuery, [
      inboxData.inbox_id,
      sender_id,
      message_text,
      files[0].fileData,
    ]);

    let fetchMessagesQuery = queries.fetchMessagesQuery;
    let messages = await client.query(fetchMessagesQuery, [inboxData.inbox_id]);
    let neeMsg = messages.rows.filter((message) => {
      return message.message_id == afterSent.rows[0].message_id;
    });
    return messages.rows.map((message)=>{
      if(!message.message_file){
        return message
      }
      else{
        let imgUrl = convertImagetoString(message.message_file);
        message.file_type = getMimeType(message.message_file)
        message.message_file = imgUrl
        return message
      }
    });
  } else {
    let sender_id = data.sender_id;
    let inboxData = await findInbox(data.sender_id, data.receiver_id);
    let message_text = data.message_text;

    let sendMessageQuery = queries.sendMessageQuery;
    let afterSent = await client.query(sendMessageQuery, [
      inboxData.inbox_id,
      sender_id,
      message_text,
    ]);

    let fetchMessagesQuery = queries.fetchMessagesQuery;
    let messages = await client.query(fetchMessagesQuery, [inboxData.inbox_id]);
    let neeMsg = messages.rows.filter((message) => {
      return message.message_id == afterSent.rows[0].message_id;
    });
    return messages.rows.map((message)=>{
      if(!message.message_file){
        return message
      }
      else{
        let imgUrl = convertImagetoString(message.message_file);
        message.file_type = getMimeType(message.message_file)
        message.message_file = imgUrl
        return message
      }
    });
  }

  // let receiver_id = data.receiver_id;
};
async function findInbox(userId1, userId2) {
  try {
    let findInboxQuery = queries.findInboxQuery;

    let inbox = await client.query(findInboxQuery, [userId1, userId2]);

    if (inbox.rows.length === 0) {
      let createInboxQuery = queries.createInboxQuery;
      let newInbox = await client.query(createInboxQuery, [userId1, userId2]);

      return newInbox.rows[0];
    }
    return inbox.rows[0];
  } catch (error) {
    console.error(error);
    throw error; // Rethrow the error to handle it further up the chain if needed
  }
}

const getAllMessages = async (req, res) => {
  try {
    let inbox_id = req.params.inbox_id;
    let query = queries.getAllMessagesQuery;
    let data = await client.query(query, [inbox_id]);
    data.rows =  data.rows.map((message)=>{
      if(!message.message_file){
        return message
      }
      else{
          let imgUrl = convertImagetoString(message.message_file);
          message.file_type = getMimeType(message.message_file)
          message.message_file = imgUrl
          return message
      }
    });
    res.status(200).json(data.rows);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Unable to fetch messages" });
  }
};

const markAsRead = async ({ inbox_id, user_id }) => {
  try {
    let inBox = await client.query(`select * from inbox where inbox_id = $1`, [
      inbox_id,
    ]);
    if (inBox.rows[0].isgroup == false) {
      let readQuery = queries.chatMsgRead;
      let status = await client.query(readQuery, [inbox_id, user_id]);
      return true;
    } else {
      let msgReadQuery = queries.groupMsgRead;
      await client.query(msgReadQuery, [inbox_id, user_id]);
      return true;
    }
  } catch (err) {
    console.log(err);
    return false;
  }
};

async function sendMessageToGroup(inbox_id, sender_id, message_text, payload) {
  try {

    if (payload &&  payload.files_data) {
      console.log('some data ' ,payload.files_data)
      let files = payload.files_data.map((file) => {
        const savePath = path.join(__dirname, `../../assets/messages`);
        const filePath = path.join(savePath, Date.now() + "_" + file.name);
        fs.writeFileSync(filePath, Buffer.from(file.fileData));
        file.name = filePath;
        file.fileData = filePath;
        return file;
      });
      let sendMessageQuery = ` insert into messages (inbox_id, sender_id, message_text, message_status, message_file)
         values($1, $2, $3, 'unread', $4)
         returning message_id, message_text, message_status;`;
      let data = await client.query(sendMessageQuery, [
      inbox_id,
      sender_id,
      message_text,
      files[0].fileData

    ]);
    let msgRead = `
        INSERT INTO message_reads (message_id, user_id, is_read, read_at)
    VALUES ($1, $2, false, null)
        `;
    let membersRows = await client.query(
      ` select member_id from group_members
        where inbox_id = $1
        `,
      [inbox_id]
    );
    let members = membersRows.rows.map((member) => member.member_id);

    for (let id of members) {
      await client.query(msgRead, [data.rows[0].message_id, id]);
    }
    return true;
    }else{
      let sendMessageQuery = queries.sendMessageQuery;
      let data = await client.query(sendMessageQuery, [
        inbox_id,
        sender_id,
        message_text,
      ]);
      let msgRead = `
          INSERT INTO message_reads (message_id, user_id, is_read, read_at)
      VALUES ($1, $2, false, null)
          `;
      let membersRows = await client.query(
        ` select member_id from group_members
          where inbox_id = $1
          `,
        [inbox_id]
      );
      let members = membersRows.rows.map((member) => member.member_id);
  
      for (let id of members) {
        await client.query(msgRead, [data.rows[0].message_id, id]);
      }
      return true;
    }

    
  } catch (error) {
    console.log(error);
    return false;
  }
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.pdf':
      return 'application/pdf';
    case '.doc':
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.txt':
      return 'text/plain';
    // Add more cases for different file types as needed
    default:
      return 'application/octet-stream'; // Default for unknown types
  }
}

module.exports = {
  sendMessage,
  getAllMessages,
  sendMessageToGroup,
  markAsRead,
  getMimeType
};
