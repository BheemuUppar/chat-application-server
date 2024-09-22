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
  await deleteProfileFile(userId);
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

function convertImagetoString(filePath) {
  if (!filePath) {
    return null;
  }

  try {
    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString("base64");
    const extension = path.extname(filePath).slice(1);

    // Define MIME types for different file formats
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      bmp: "image/bmp",
      tiff: "image/tiff",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      mp4: "video/mp4",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      flv: "video/x-flv",
      wmv: "video/x-ms-wmv",
      webm: "video/webm",
    };

    const mimeType = mimeTypes[extension] || "application/octet-stream";
    return `data:${mimeType};base64,${base64Data}`;
  } catch (err) {
    console.error("Error reading file:", err);
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
    query = queries.searchUserBasedOnNameAndEmail;
    params = [str];
  } else {
    // searchQuery is a number, so treat it as an ID
    query = queries.searchUserBasedOnId;
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

async function getAllinbox(req, res) {
  try {
    let userid = req.params.user_id;

    // Query for one-to-one chats
    let oneToOneQuery = queries.oneToOneInbox;

    // Query for group chats
    let groupQuery = queries.groupInbox;

    // Fetch one-to-one and group chat data
    let oneToOneData = await client.query(oneToOneQuery, [userid]);
    let groupData = await client.query(groupQuery, [userid]);

    groupData.rows = groupData.rows.map((group) => {
      group.group_members = group.group_members.map((member) => {
        member.profile_path = convertImagetoString(member.profile_path);
        return member;
      });
      return group;
    });

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

const createGroup = async (req, res) => {
  try {
    let { myUserId, groupName, groupMembers } = req.body;
    let filePath
    if(req.file){
    filePath = req.file.path;
    }else{
      filePath = null
    }
    groupMembers = JSON.parse(groupMembers);
    // let { myUserId, groupName, groupMembers } = req.body;
    if (!myUserId || !groupName || !groupMembers) {
      res.status(402).json({ message: "Invalid Payload" });
      return;
    }
    await client.query("BEGIN");

    let groupCreationQuery = queries.createGroupQuery;

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
      let insertMemberQuery = queries.insertMemberToGroup;
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
  let query = queries.updateGroupProfile;
  await client.query(query, [filePath, inbox_id]);
}

async function getInboxInfo(req, res) {
  try {
    const inbox_id = req.params.inbox_id;
    let inbox = await client.query(`select * from inbox where inbox_id = $1`, [
      inbox_id,
    ]);
    if (inbox.length == 0) {
      res.status(400).json({ message: "Bad Request" });
      return;
    }
    const isGroup = inbox.rows[0].isgroup;
   console.log('is group ', isGroup)
    if (isGroup) {
      let data = await fetchGroupData(inbox_id);
      return res.status(200).json(data);
    } else {
    }
    res.json(inbox.rows);
  } catch (error) {
    console.log(error)
  }
}

async function fetchGroupData(inbox_id) {
  let query = `SELECT 
    inbox.inbox_id,
    inbox.isgroup,
    inbox.name,
    inbox.created_at,
    inbox.profile_path,
    -- Aggregate user details for created_by (DISTINCT ensures no duplication)
    json_agg(
        DISTINCT jsonb_build_object(
            'user_id', u.user_id,
            'name', u.name,
            'email', u.email,
            'mobile', u.mobile,
            'profile_path', u.profile_path
        )
    ) AS created_by,
    -- Aggregate group member details
    json_agg(
       DISTINCT jsonb_build_object(
            'user_id', gm_user.user_id,
            'name', gm_user.name,
            'email', gm_user.email,
            'mobile', gm_user.mobile,
            'profile_path', gm_user.profile_path
        )
    ) AS group_members,
    -- Aggregate messages where message_file is not null
    json_agg(
        DISTINCT jsonb_build_object(
            'message_id', m.message_id,
            'sender_id', m.sender_id,
            'message_text', m.message_text,
            'message_file', m.message_file,
            'file_type', m.file_type,
            'sent_at', m.sent_at,
            'file_size',m.file_size,
            'file_type', m.file_type
        )
    ) AS messages
FROM 
    inbox
-- Join with users table for the creator of the inbox
JOIN 
    users u ON inbox.created_by = u.user_id
-- Join with group_members table to get group members
LEFT JOIN 
    group_members gm ON gm.inbox_id = inbox.inbox_id
-- Join with users table to get user details for each group member using member_id
LEFT JOIN 
    users gm_user ON gm.member_id = gm_user.user_id
-- Join with messages table to get message details
LEFT JOIN 
    messages m ON m.inbox_id = inbox.inbox_id AND m.message_file IS NOT NULL
WHERE 
    inbox.inbox_id = $1
GROUP BY 
    inbox.inbox_id, inbox.isgroup, inbox.name, inbox.created_at;`;
  let data = await client.query(query, [inbox_id]);
  return data.rows.map((obj) => {
    obj.profile_path = convertImagetoString(obj.profile_path);
    obj.created_by = obj.created_by.map((user) => {
      user.profile_path = convertImagetoString(user.profile_path);
      return user;
    });
    obj.group_members = obj.group_members.map((user) => {
      user.profile_path = convertImagetoString(user.profile_path);
      return user;
    });
    obj.messages = obj.messages.map((msg) => {
      msg.file_name =  msg.message_file ? msg.message_file.split("messages\\")[1].split("_")[1] : null;
      msg.message_file = msg.message_file ?  convertImagetoString(msg.message_file) : null;

      return msg;
    });
    return obj;
  });
}

//
async function fetchContactData(user_id, inbox_id) {
  let query = `SELECT 
    i.inbox_id, 
    i.isgroup, 
    (SELECT u.user_id FROM users u WHERE u.user_id = $1 LIMIT 1) AS user_id,
    (SELECT u.name FROM users u WHERE u.user_id = $1 LIMIT 1) AS name,
    (SELECT u.email FROM users u WHERE u.user_id = $1 LIMIT 1) AS email,
    (SELECT u.mobile FROM users u WHERE u.user_id = $1 LIMIT 1) AS mobile,
    (SELECT u.profile_path FROM users u WHERE u.user_id = $1 LIMIT 1) AS profile_path,
    COALESCE(
        jsonb_agg(
            DISTINCT jsonb_build_object(
                'message_id', m.message_id,
                'sender_id', m.sender_id,
                'message_text', m.message_text,
                'message_file', m.message_file,
                'file_type', m.file_type,
                'sent_at', m.sent_at,
                'file_size', m.file_size
            )
        ) FILTER (WHERE m.message_id IS NOT NULL),
        '[]'::jsonb  -- Ensure an empty array if no messages
    ) AS messages
FROM 
    inbox i
LEFT JOIN 
    messages m ON m.inbox_id = i.inbox_id AND m.message_file IS NOT NULL
WHERE 
    i.inbox_id = $2
GROUP BY 
    i.inbox_id;
`;
  let data = await client.query(query, [user_id, inbox_id]);
  return data.rows.map((obj) => {
    obj.profile_path = convertImagetoString(obj.profile_path);

    obj.messages = obj.messages.map((msg) => {
      msg.file_name = msg.message_file.split("messages\\")[1].split("_")[1];
      msg.message_file = convertImagetoString(msg.message_file);

      return msg;
    });
    return obj;
  });
}

async function fetchChatInfo(req, res) {
  try {
    let user_id = req.params.user_id;
    let inbox_id = req.params.inbox_id;
    if (!inbox_id || !user_id) {
      res.status(400).json({ message: "Bad Request" });
      return;
    }
    let data = await fetchContactData(user_id, inbox_id);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
}

async function deleteProfileFile(id) {
  let query = `select * from users where user_id = $1`;
  let result = await client.query(query, [id]);
  if (result.rows[0].profile_path != null) {
    fs.unlinkSync(result.rows[0].profile_path);
  }
}

module.exports = {
  uploadProfile,
  getUserById,
  searchUSers,
  getAllinbox,
  createGroup,
  convertImagetoString,
  getInboxInfo,
  fetchChatInfo,
};
