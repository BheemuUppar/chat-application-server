const express = require("express");
const router = express.Router();
const client = require("../db/connect/connections");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const json = require("body-parser/lib/types/json");

router.post("/register", async (req, res) => {
  let { name, email, mobile,  password } = req.body;
  let query = `
    insert into users(name,email,mobile, password)
    values($1, $2, $3,$4)
    `;
  try {
    // check if user with email  exist
    //  if not then insert user
    let users = await client.query(
      ` SELECT * 
        FROM USERS
        WHERE EMAIL = $1;
        `,
      [email]
    );
    if (users.rows.length > 0) {
      res.status(409).json({ message: "user already exits" });
    } else {
      // before register hash password
      let hashedPassword = await bcrypt.hash(password, 10);

      let result = await client.query(query, [
        name,
        email,
        mobile,
        hashedPassword,
      ]);
      res.status(200).json({ message: "user registered" });
    }
  } catch (error) {
    if (error) res.status(500).json(error);
    res.status(500).json({ message: "Something Broken" });
  }
});

router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  try {
    // check if user exist with the email
    let users =await  client.query( `
        SELECT * FROM USERS
        WHERE EMAIL = $1
        `, [email])

        if(users.rows.length ==  0){
            res.status(404).json({message : "user not found"});
        }
        else{
            users.rows[0].password 
            let isValid  = await bcrypt.compare(password ,  users.rows[0].password );
            if(isValid){
                let {password , ...params} = users.rows[0];
               
                let token  = await jwt.sign(params, process.env.JWTSECRETEKEY);
                res.status(200).json({message:"login successfull", token:token})
            }
            else{
                res.status(401).json({message:"invalid credientials"})
            }
     
        }
  } catch (err) {
    console.log(err)
    res.status(500).json(err)
  }
});

module.exports = router;
