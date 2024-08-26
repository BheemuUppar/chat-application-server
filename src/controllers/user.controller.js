const client = require("../db/connect/connections");
const fs = require("fs");
const path = require("path");
const queries = require("../db/queries/Queries");
const { query } = require("express");

const uploadProfile = async (req, res) => {
  let file = req.file.path;
  let userId = req.body.id;

  let query = queries.setProfilePath;
  await client.query(query, [file, userId]);
  let result = await client.query(queries.finduserById, [userId]);
  const filePath = result.rows[0].profile_path;
  let data = fs.readFileSync(filePath);
  // Convert file data to Base64
  const base64Data = data.toString("base64");
  const extension = path.extname(filePath).slice(1); // Get file extension (e.g., 'png')

  // Add Base64 data to the profile data object
  result.rows[0].profile_path = `data:image/${extension};base64,${base64Data}`;
  delete result.rows[0]?.password;
  res.status(200).json({ message: "Profile Saved", data: result.rows[0] });
};

const getUserById = async (req, res) => {
  let id = req.params.id;
  if (!id || id == "undefined" || id == "null") {
    res.status(400).json({ message: "Bad Request" });
    return;
  }
  let query = queries.getAllDeatailsOfUserById;
  let data = await client.query(query, [id]);
  if (data.rows.length === 0) {
    res.status(404).json({ message: "No user found" });
    return;
  }

  if (data.rows[0].profile_path) {
    // let fileData = fs.readFileSync(data.rows[0].profile_path);
    // // Convert file data to Base64
    // const base64Data = fileData.toString("base64");
    // const extension = path.extname(data.rows[0].profile_path).slice(1);
    data.rows[0].profile_path = convertImagetoString(data.rows[0].profile_path);
  } else {
    data.rows[0].profile_path = null;
  }
  delete data.rows[0]?.password;
  res.status(200).json({ data: data.rows[0] });
};

function convertImagetoString(profile_path) {
  if (!profile_path) {
    return null;
  }
  try {
    let fileData = fs.readFileSync(profile_path);
    // Convert file data to Base64
    const base64Data = fileData.toString("base64");
    const extension = path.extname(profile_path).slice(1);
    return `data:image/${extension};base64,${base64Data}`;
  } catch (err) {
    return null;
  }
}

const searchUSers = async (req, res) => {
  let query;
  let params;
  let searchQuery = req.query.search;
  if (isNaN(searchQuery)) {
    // searchQuery is not a number, so treat it as a string
    const str = "%" + searchQuery + "%";
    query = `
      SELECT user_id as contact_id,
      name as contact_name,last_seen,
      profile_path, email
 FROM users 
      WHERE UPPER(name) LIKE UPPER($1) 
         OR UPPER(email) LIKE UPPER($1)
    `;
    params = [str];
  } else {
    // searchQuery is a number, so treat it as an ID
    query = `
      SELECT * FROM users 
      WHERE id = $1 
         OR UPPER(name) LIKE UPPER($2) 
         OR UPPER(email) LIKE UPPER($2)
    `;
    const str = "%" + searchQuery + "%";
    params = [parseInt(searchQuery, 10), str];
  }

  try {
    let data = await client.query(query, params);
    data = data.rows.map((user) => {
      user.profile_path = convertImagetoString(user.profile_path);
      return user;
    });

    res.status(200).json({ data: data });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Unable to fetch users" });
    // res.status(400).json(error)
  }
};

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

  let fetchMessagesQuery = `SELECT * FROM messages WHERE inbox_id = $1 ORDER BY sent_at ASC;`
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
      console.log("Creating inbox...");
      let newInbox = await client.query(createInboxQuery, [userId1, userId2]);
      console.log("Created inbox:", newInbox.rows[0]);

      return newInbox.rows[0];
    }

    console.log("Found inbox:", inbox.rows[0]);
    return inbox.rows[0];
  } catch (error) {
    console.log("Failed to find or create inbox");
    console.error(error);
    throw error; // Rethrow the error to handle it further up the chain if needed
  }
}

async function getAllinbox(req, res) {
  try {
    let userid = req.params.user_id;
    let query = `
    SELECT 
    i.inbox_id,
    CASE 
        WHEN i.user1_id = $1 THEN u2.user_id
        ELSE u1.user_id
    END AS contact_id,
    CASE 
        WHEN i.user1_id = $1 THEN u2.name
        ELSE u1.name
    END AS contact_name,
    CASE 
        WHEN i.user1_id = $1 THEN u2.currentStatus
        ELSE u1.currentStatus
    END AS contact_status,
    CASE 
        WHEN i.user1_id = $1 THEN u2.last_seen
        ELSE u1.last_seen
    END AS contact_last_seen,
    CASE 
        WHEN i.user1_id = $1 THEN u2.profile_path
        ELSE u1.profile_path
    END AS profile_path,
    m.message_text AS last_message,
    m.sent_at AS last_message_time,
    m.sender_id,
    COALESCE(unread_counts.unread_count, 0) AS unread_count
FROM inbox i
JOIN users u1 ON i.user1_id = u1.user_id
JOIN users u2 ON i.user2_id = u2.user_id
LEFT JOIN (
    SELECT 
        inbox_id,
        message_text,
        sent_at,
        sender_id
    FROM messages
    WHERE (inbox_id, sent_at) IN (
        SELECT inbox_id, MAX(sent_at)
        FROM messages
        GROUP BY inbox_id
    )
) m ON m.inbox_id = i.inbox_id
LEFT JOIN (
    SELECT 
        inbox_id,
        COUNT(*) AS unread_count
    FROM messages
    WHERE message_status = 'unread'
    AND sender_id <> $1
    GROUP BY inbox_id
) unread_counts ON unread_counts.inbox_id = i.inbox_id
WHERE i.user1_id = $1 OR i.user2_id = $1;
 
    `;
    let data = await client.query(query, [userid]);

    data.rows = data.rows.map((obj) => {
      if (obj.profile_path == null) {
        return obj;
      } else {
        obj.profile_path = convertImagetoString(obj.profile_path);
        return obj;
      }
    });
    res.status(200).json(data.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch inbox" });
  }
}

const getAllMessages = async (req, res) => {
  try {
    let inbox_id = req.params.inbox_id;
    let query = `SELECT * FROM messages WHERE inbox_id = $1 ORDER BY sent_at ASC;`;
    let data = await client.query(query, [inbox_id]);
    res.status(200).json(data.rows);
  } catch (err) {
    res.status(500).json({ message: "unable to fetch message" });
  }
};

const markAsRead = async ({inbox_id, user_id}) => {
  try {
    let readQuery = `
UPDATE MESSAGES
SET MESSAGE_STATUS = 'read'
WHERE INBOX_ID = $1 AND SENDER_ID != $2;
`;
console.log('inbox and user id  ' ,inbox_id , user_id)
    let status = await client.query(readQuery, [inbox_id, user_id]);
    console.log('query status ',status)
    return true;
  } catch (err) {
    console.log(err)
    return false;
  }
};

module.exports = {
  uploadProfile,
  getUserById,
  searchUSers,
  sendMessage,
  getAllinbox,
  getAllMessages,markAsRead
};
