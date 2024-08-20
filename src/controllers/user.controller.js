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
      SELECT * FROM users 
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

const sendMessage = async (data)=>{
let sender_id = data.sender_id;

let inboxData = await findInbox(data.sender_id, data.receiver_id);
let message_text = data.message_text;


let sendMessageQuery = `
insert into messages (inbox_id, sender_id, message_text)
values($1, $2, $3)
`
console.log(inboxData)
await client.query(sendMessageQuery, [inboxData.inbox_id, sender_id, message_text]);

let fetchMessagesQuery = `
SELECT * FROM MESSAGES WHERE INBOX_ID = $1
`
let messages  = await client.query(fetchMessagesQuery, [inboxData.inbox_id])

return messages.rows;

// let receiver_id = data.receiver_id;


}

async function findInbox(userId1, userId2 ){
   try{
    let findInboxQuery = `
    select * from inbox 
    WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
    ` 
  let inbox = await  client.query(findInboxQuery, [userId1 , userId2]);
 if(inbox.rows.length == 0){
  let createInbox =  `
  INSERT INTO INBOX (USER1_ID, USER2_ID)
  VALUES ($1, $2)
  `
  console.log('creating...')
  let inbox = await  client.query(createInbox, [userId1 , userId2]);
  console.log('created...' , inbox)


  return inbox.rows[0]
 }
 console.log(inbox.rows)
 return inbox.rows[0]
   }catch(error){
    console.log("failed to create inbox")
    console.log(error)
   }

}

module.exports = { uploadProfile, getUserById, searchUSers, sendMessage };
