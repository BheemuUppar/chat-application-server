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

   groupData.rows =  groupData.rows.map((group)=>{
    group.group_members = group.group_members.map((member)=>{
      member.profile_path =  convertImagetoString(member.profile_path)
      return member
    })
    return group
    })

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
    let filePath = req.file.path;
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

module.exports = {
  uploadProfile,
  getUserById,
  searchUSers,
  getAllinbox,
  createGroup,
  convertImagetoString
};
