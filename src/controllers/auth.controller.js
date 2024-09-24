const client = require("../db/connect/connections");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const queries = require("../db/queries/Queries");

const register = async (req, res) => {
  let { name, email, mobile, password } = req.body;
  let query = queries.registerUser;

  try {
    if(!name || !email || !mobile || !password){
      res.status(409).json({ message: "Invalid payload" });
      return
    }
    // Check if user with email exists
    let users = await client.query(queries.findUserByEmail, [email]);

    if (users.rows.length > 0) {
      res.status(409).json({ message: "User already exists" });
    } else {
      // Hash password before registration
      let hashedPassword = await bcrypt.hash(password, 10);

      let result = await client.query(query, [
        name,
        email,
        mobile,
        hashedPassword,
      ]);
      res.status(200).json({ message: "User registered" });
    }
  } catch (error) {
    console.error(error); // Log the actual error
    res.status(500).json({ message: "may be email and mobile exist!" });
  }
};
const login = async (req, res) => {
  let { username, password } = req.body;

  try {
    // Check if user exists with the email
    let users = await client.query(queries.findUserByEmail, [username]);

    if (users.rows.length == 0) {
      res.status(404).json({ message: "User does not exist" });
    } else {
      let user = users.rows[0];
      let hashedPassword = user.password;
      // Compare password
      let isValid = await bcrypt.compare(password, hashedPassword);

      if (isValid) {
        let { password, ...params } = user;
        let token = await jwt.sign(params, process.env.JWTSECRETEKEY);
        res.status(200).json({ message: "Login successful", token });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    }
  } catch (err) {
    console.error(err); // Log the actual error
    res.status(500).json({ message: "Something broke" });
  }
};

module.exports = { register, login };
