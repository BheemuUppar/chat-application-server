const queries = {
    registerUser:`
      INSERT INTO users(name, email, mobile, password)
      VALUES($1, $2, $3, $4)
    `,
    findUserByEmail :`
        SELECT * 
        FROM USERS
        WHERE EMAIL = $1;
      `,
    setProfilePath :`
   update users
   set profile_path = $1
   where id = $2; `,
   finduserById: `
   select id, name,email, mobile, profile_path, created_at
   from users where id = $1;
   `,
   getAllDeatailsOfUserById: `
   select * from users
   where id = $1;
   `
};

module.exports = queries;
