const client = require("../db/connect/connections");

const sendMessage = async (data) => {
  let sender_id = data.sender_id;
  let inboxData = await findInbox(data.sender_id, data.receiver_id);
  let message_text = data.message_text;

  let sendMessageQuery = `
    insert into messages (inbox_id, sender_id, message_text)
    values($1, $2, $3)
    `;
  await client.query(sendMessageQuery, [
    inboxData.inbox_id,
    sender_id,
    message_text,
  ]);

  let fetchMessagesQuery = `SELECT * FROM messages WHERE inbox_id = $1 ORDER BY sent_at ASC;`;
  let messages = await client.query(fetchMessagesQuery, [inboxData.inbox_id]);

  return messages.rows;

  // let receiver_id = data.receiver_id;
};
async function findInbox(userId1, userId2) {
  try {
    let findInboxQuery = `
            SELECT * FROM inbox 
            WHERE (user1_id = $1 AND user2_id = $2) 
            OR (user1_id = $2 AND user2_id = $1) `;

    let inbox = await client.query(findInboxQuery, [userId1, userId2]);

    if (inbox.rows.length === 0) {
      let createInboxQuery = `
            INSERT INTO inbox (user1_id, user2_id)
            VALUES ($1, $2)
            RETURNING *
            `;
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
    let query = `
            SELECT 
            m.*, 
            u.name AS sender_name  -- Assuming 'name' is the column for the user's name in the users table
            FROM messages m
            JOIN users u ON m.sender_id = u.user_id  -- Join the messages with the users table to get sender details
            WHERE m.inbox_id = $1
            ORDER BY m.sent_at ASC;
        `;
    let data = await client.query(query, [inbox_id]);
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
    console.log();
    if (inBox.rows[0].isgroup == false) {
      let readQuery = `
            UPDATE MESSAGES
            SET MESSAGE_STATUS = 'read'
            WHERE INBOX_ID = $1 AND SENDER_ID != $2;
            `;
      let status = await client.query(readQuery, [inbox_id, user_id]);
      return true;
    } else {
      let msgReadQuery = `
            UPDATE message_reads
        SET is_read = true
        WHERE message_id IN (
            SELECT message_id 
            FROM messages 
            WHERE inbox_id = $1  -- The ID of the inbox
        )
        AND user_id = $2;  -- The ID of the user
    
        `;
      await client.query(msgReadQuery, [inbox_id, user_id]);
      return true;
    }
  } catch (err) {
    console.log(err);
    return false;
  }
};

async function sendMessageToGroup(inbox_id, sender_id, message_text) {
  try {
    let sendMessageQuery = `
        insert into messages (inbox_id, sender_id, message_text, message_status)
        values($1, $2, $3, 'read')
        returning message_id;
        `;
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
      `
        select member_id from group_members
        where inbox_id = $1
        `,
      [inbox_id]
    );
    let members = membersRows.rows.map((member) => member.member_id);

    for (let id of members) {
      await client.query(msgRead, [data.rows[0].message_id, id]);
    }
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

module.exports = { sendMessage, getAllMessages , sendMessageToGroup, markAsRead};
