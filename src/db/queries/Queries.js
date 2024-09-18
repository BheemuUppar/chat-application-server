const queries = {
  registerUser: `
              INSERT INTO users(name, email, mobile, password)
              VALUES($1, $2, $3, $4);
            `,
  findUserByEmail: `
                SELECT * 
                FROM USERS
                WHERE EMAIL = $1;
              `,
  setProfilePath: `
          update users
          set profile_path = $1
          where user_id = $2; `,
  finduserById: `
          select user_id, name,email, mobile, profile_path, created_at
          from users where user_id = $1;
          `,
  getAllDeatailsOfUserById: `
          select * from users
          where user_id = $1;
          `,
  searchUser: `
          select * from users
          where user_id = $1
            OR UPPER(NAME) LIKE UPPER($2) 
            OR  UPPER(EMAIL) LIKE UPPER($2);
          `,
  sendMessageQuery: `
          insert into messages (inbox_id, sender_id, message_text, message_status)
          values($1, $2, $3, 'unread')
          returning message_id, message_text, message_status;
          `,
  fetchMessagesQuery: `SELECT * FROM messages WHERE inbox_id = $1 ORDER BY sent_at ASC;`,
  findInboxQuery: `
          SELECT * FROM inbox 
          WHERE (user1_id = $1 AND user2_id = $2) 
          OR (user1_id = $2 AND user2_id = $1) `,
  createInboxQuery: `
                  INSERT INTO inbox (user1_id, user2_id)
                  VALUES ($1, $2)
                  RETURNING *
                  `,
  getAllMessagesQuery: `
                  SELECT 
                  m.*, 
                  u.name AS sender_name, u.profile_path  -- Assuming 'name' is the column for the user's name in the users table
                  FROM messages m
                  JOIN users u ON m.sender_id = u.user_id  -- Join the messages with the users table to get sender details
                  WHERE m.inbox_id = $1
                  ORDER BY m.sent_at ASC;
              `,
  chatMsgRead: `
              UPDATE MESSAGES
              SET MESSAGE_STATUS = 'read'
              WHERE INBOX_ID = $1 AND SENDER_ID != $2;
              `,
  groupMsgRead: `
              UPDATE message_reads
          SET is_read = true
          WHERE message_id IN (
              SELECT message_id 
              FROM messages 
              WHERE inbox_id = $1  -- The ID of the inbox
          )
          AND user_id = $2;  -- The ID of the user
      
          `,
  // sendMessageQuery: `
  //         insert into messages (inbox_id, sender_id, message_text, message_status)
  //         values($1, $2, $3, 'read')
  //         returning message_id;
  //         `,
  searchUserBasedOnNameAndEmail: `
    SELECT user_id as contact_id,
        name as contact_name,last_seen,
        profile_path, email
  FROM users 
        WHERE UPPER(name) LIKE UPPER($1) 
          OR UPPER(email) LIKE UPPER($1)
      `,
  searchUserBasedOnId: `
      SELECT * FROM users 
      WHERE id = $1 
         OR UPPER(name) LIKE UPPER($2) 
         OR UPPER(email) LIKE UPPER($2)
    `,
    oneToOneInbox: `
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
      m.message_file, -- Added
      m.file_type, -- Added
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
        m.sender_id,
        m.message_file,  -- Added
        m.file_type      -- Added
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
    GROUP BY i.inbox_id, u1.user_id, u2.user_id, u1.name, u2.name, u1.currentStatus, u2.currentStatus, u1.last_seen, u2.last_seen, u1.profile_path, u2.profile_path, m.message_text, m.sent_at, m.sender_id, m.message_file, m.file_type, unread_counts.unread_count
    ORDER BY m.sent_at DESC;
  `,
  
  groupInbox: `
  WITH group_members_data AS (
    SELECT 
        gm.inbox_id,
        jsonb_agg(
            jsonb_build_object(
                'id', gm.member_id,
                'profile_path', u.profile_path
            )
        ) AS group_members
    FROM group_members gm
    LEFT JOIN users u ON gm.member_id = u.user_id
    GROUP BY gm.inbox_id
)
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
    m.message_file,  -- Added
    m.file_type,     -- Added
    COALESCE(unread_counts.unread_count, 0) AS unread_count,
    COALESCE(gmd.group_members, '[]'::jsonb) AS group_members  -- Get group members from subquery
FROM 
    inbox i
-- Get the latest message details for each inbox
LEFT JOIN (
    SELECT 
        m.inbox_id,
        m.message_text,
        m.sent_at,
        m.sender_id,
        m.message_file,  -- Added
        m.file_type      -- Added
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
    LEFT JOIN message_reads mr ON m.message_id = mr.message_id AND mr.user_id = $1  -- $1 is the specific user ID
    WHERE 
        (mr.is_read = false OR mr.is_read IS NULL)  -- Count messages as unread if not marked as read
        AND m.sender_id <> $1  -- Exclude messages sent by the current user
    GROUP BY m.inbox_id
) unread_counts ON unread_counts.inbox_id = i.inbox_id
-- Fetch pre-aggregated group members for each inbox
LEFT JOIN group_members_data gmd ON gmd.inbox_id = i.inbox_id
-- Ensure the user is a member of the group
WHERE i.isGroup = true
AND EXISTS (
    SELECT 1 
    FROM group_members gm2 
    WHERE gm2.inbox_id = i.inbox_id 
    AND gm2.member_id = $1  -- Ensure the user is a member of the group
)
GROUP BY i.inbox_id, i.name, i.profile_path, m.message_text, m.sent_at, m.sender_id, m.message_file, m.file_type, unread_counts.unread_count, gmd.group_members
ORDER BY m.sent_at DESC;

`,


  createGroupQuery: `
    INSERT INTO INBOX (ISGROUP, NAME, CREATED_BY)
    VALUES($1, $2, $3)
    RETURNING inbox_id;
    `,
  insertMemberToGroup: `
        insert into group_members(inbox_id, member_id)
        values ($1, $2);`,
  updateGroupProfile: `
UPDATE INBOX 
SET PROFILE_PATH = $1
WHERE INBOX_ID =$2;
`,

deleteMessage : `delete from messages where message_id = $1;`
};

module.exports = queries;
