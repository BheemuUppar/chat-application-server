const jwt = require("jsonwebtoken");

export const authMiddleware = async (req, res, next) => {
  try {
    let isvalid = await jwt.verify(
      req.headers["authorization"],
      process.env.JWTSECRETEKEY
    );
    if (isvalid) {
      next();
    }
  } catch (err) {
    res.status(401).json({message : "Invalid token"});
  }
};
