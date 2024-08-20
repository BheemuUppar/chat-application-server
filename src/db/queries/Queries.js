const queries = {
  registerUser: `
      INSERT INTO users(name, email, mobile, password)
      VALUES($1, $2, $3, $4)
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
   searchUser:`
   select * from users
   where user_id = $1
    OR UPPER(NAME) LIKE UPPER($2) 
    OR  UPPER(EMAIL) LIKE UPPER($2)
   `
};

module.exports = queries;
