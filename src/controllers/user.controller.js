const client = require("../db/connect/connections");
const fs = require("fs");
const path = require("path");
const queries = require("../db/queries/Queries");
const eventEmitter = require("./eventemitter");

const uploadProfile = async (req, res) => {
  if (req.file == undefined || req.file.path == undefined) {
    res.status(402).json({ message: "Invalid payload" });
    return;
  }
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
      console.log(user.profile_path);
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

async function getAllinbox(req, res) {
  try {
    let userid = req.params.user_id;

    // Query for one-to-one chats
    let oneToOneQuery = `
      SELECT 
        i.inbox_id,
        false AS isGroup,
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
        COALESCE(unread_counts.unread_count, 0) AS unread_count,
        NULL AS group_members
      FROM inbox i
      LEFT JOIN users u1 ON i.user1_id = u1.user_id
      LEFT JOIN users u2 ON i.user2_id = u2.user_id
      LEFT JOIN (
        SELECT 
          m.inbox_id,
          m.message_text,
          m.sent_at,
          m.sender_id
        FROM messages m
        JOIN (
          SELECT inbox_id, MAX(sent_at) AS max_sent_at
          FROM messages
          GROUP BY inbox_id
        ) latest_msg ON m.inbox_id = latest_msg.inbox_id AND m.sent_at = latest_msg.max_sent_at
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
      WHERE i.user1_id = $1 OR i.user2_id = $1
      GROUP BY i.inbox_id, u1.user_id, u2.user_id, u1.name, u2.name, u1.currentStatus, u2.currentStatus, u1.last_seen, u2.last_seen, u1.profile_path, u2.profile_path, m.message_text, m.sent_at, m.sender_id, unread_counts.unread_count
    `;

    // Query for group chats
    let groupQuery = `
   SELECT 
    i.inbox_id,
    true AS isGroup,
    NULL AS contact_id,
    i.name AS contact_name,  -- Group name
    'Group' AS contact_status,
    NULL AS contact_last_seen,
    i.profile_path AS profile_path,  -- Group profile path
    m.message_text AS last_message,
    m.sent_at AS last_message_time,
    m.sender_id,
    -- Calculate unread count specifically for the logged-in user in group chats
    COALESCE(unread_counts.unread_count, 0) AS unread_count,
    -- Aggregate group members as JSON array
    COALESCE(json_agg(DISTINCT gm.member_id) FILTER (WHERE gm.member_id IS NOT NULL), '[]'::json) AS group_members
FROM inbox i
-- Get the latest message details for each inbox
LEFT JOIN (
    SELECT 
        m.inbox_id,
        m.message_text,
        m.sent_at,
        m.sender_id
    FROM messages m
    JOIN (
        SELECT inbox_id, MAX(sent_at) AS max_sent_at
        FROM messages
        GROUP BY inbox_id
    ) latest_msg ON m.inbox_id = latest_msg.inbox_id AND m.sent_at = latest_msg.max_sent_at
) m ON m.inbox_id = i.inbox_id
-- Calculate unread messages specifically for the user in group chats using message_reads
LEFT JOIN (
    SELECT 
        m.inbox_id,
        COUNT(*) AS unread_count
    FROM messages m
    -- Join to check if the message is read by the specific user
    LEFT JOIN message_reads mr ON m.message_id = mr.message_id AND mr.user_id = $1  -- $1 is the specific user ID
    WHERE 
        (mr.is_read = false OR mr.is_read IS NULL)  -- Count messages as unread if not marked as read
        AND m.sender_id <> $1  -- Exclude messages sent by the current user
    GROUP BY m.inbox_id
) unread_counts ON unread_counts.inbox_id = i.inbox_id
-- Left join group members for group chat details
LEFT JOIN group_members gm ON gm.inbox_id = i.inbox_id
WHERE i.isGroup = true  -- Filter for group chats only
GROUP BY i.inbox_id, i.name, i.profile_path, m.message_text, m.sent_at, m.sender_id, unread_counts.unread_count
ORDER BY m.sent_at DESC;  -- Order by last message time
`;

    // Fetch one-to-one and group chat data
    let oneToOneData = await client.query(oneToOneQuery, [userid]);
    let groupData = await client.query(groupQuery, [userid]);

    // Merge both results
    let combinedData = [...oneToOneData.rows, ...groupData.rows];

    // Convert profile_path to image string if available
    combinedData = combinedData.map((obj) => {
      if (obj.profile_path == null) {
        return obj;
      } else {
        obj.profile_path = convertImagetoString(obj.profile_path);
        return obj;
      }
    });

    // Sort by the last message time in descending order
    combinedData.sort(
      (a, b) => new Date(b.last_message_time) - new Date(a.last_message_time)
    );

    res.status(200).json(combinedData);
  } catch (err) {
    console.error("Error fetching inbox:", err);
    res.status(500).json({ message: "Failed to fetch inbox" });
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

const createGroup = async (req, res) => {
  try {
    let { myUserId, groupName, groupMembers } = req.body;
    let filePath = req.file.path;
    groupMembers = JSON.parse(groupMembers);
    // let { myUserId, groupName, groupMembers } = req.body;
    if (!myUserId || !groupName || !groupMembers) {
      res.status(402).json({ message: "Invalid Payload" });
      return;
    }
    await client.query("BEGIN");

    let groupCreationQuery = `
    INSERT INTO INBOX (ISGROUP, NAME, CREATED_BY)
    VALUES($1, $2, $3)
    RETURNING inbox_id;
    `;

    // this creates group with group name
    let newGroup = await client.query(groupCreationQuery, [
      true,
      groupName,
      myUserId,
    ]);

    let newInboxId = newGroup.rows[0].inbox_id;

    await updateGroupProfile(newInboxId, filePath);
    groupMembers.unshift(myUserId);
    for (let member of groupMembers) {
      let insertMemberQuery = `
        insert into group_members(inbox_id, member_id)
        values ($1, $2);`;
      await client.query(insertMemberQuery, [newInboxId, member]);
    }
    await client.query("COMMIT");
    eventEmitter.emit("groupCreated", {
      groupId: newInboxId,
      groupName,
      groupMembers,
      creatorId: myUserId,
    });
    console.log("Group Created with ", newInboxId);
    res.status(201).json({ message: "group created successfull" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);
    res.status(500).json({
      message: "Failed to create a group, Please try after some time",
    });
  } finally {
  }
};

async function updateGroupProfile(inbox_id, filePath) {
  let query = `
UPDATE INBOX 
SET PROFILE_PATH = $1
WHERE INBOX_ID =$2;
`;
  await client.query(query, [filePath, inbox_id]);
}

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

module.exports = {
  uploadProfile,
  getUserById,
  searchUSers,
  sendMessage,
  getAllinbox,
  getAllMessages,
  markAsRead,
  createGroup,
  sendMessageToGroup,
};
