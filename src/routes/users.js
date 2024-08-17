const express = require("express");
const router = express.Router();
const upload = require("../db/storage/multerStorage");
const client = require("../db/connect/connections");
const fs = require("fs");
const path = require("path");

router.post("/upload/profile", upload.single("file"), async (req, res) => {
  let file = req.file.path;
  let userId = req.body.id;

  let query = `
   update users
   set profile_path = $1
   where id = $2; `;
  await client.query(query, [file, userId]);
  let result = await client.query(
    `
    select id, name,email, mobile, profile_path, created_at
    from users where id = $1;
    `,
    [userId]
  );
  const filePath = result.rows[0].profile_path;
  let data = fs.readFileSync(filePath);
  // Convert file data to Base64
  const base64Data = data.toString("base64");
  const extension = path.extname(filePath).slice(1); // Get file extension (e.g., 'png')

  // Add Base64 data to the profile data object
  result.rows[0].profile_path = `data:image/${extension};base64,${base64Data}`;
  delete result.rows[0]?.password;
  res.status(200).json({ message: "Profile Saved", data: result.rows[0] });
});

router.get("/getuser/:id", async (req, res) => {
  let id = req.params.id;
  let query = `
  select * from users
  where id = $1;
  `;
  let data = await client.query(query, [id]);
  if (data.rows.length === 0) {
    res.status(404).json({ message: "No user found" });
    return;
  }

 if(data.rows[0].profile_path){
  let fileData = fs.readFileSync(data.rows[0].profile_path);
  // Convert file data to Base64
  const base64Data = fileData.toString("base64");
  const extension = path.extname(data.rows[0].profile_path).slice(1);
  data.rows[0].profile_path = `data:image/${extension};base64,${base64Data}`;
 }
 else{
  data.rows[0].profile_path = null
 }
  delete data.rows[0]?.password;
  res.status(200).json({ data: data.rows[0] });
});

module.exports = router;
