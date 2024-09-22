const multer = require('multer');
const path = require('path');


// Set up storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../../assets/profile_pics'));
      },
      filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
      },
});

// Initialize upload variable
const upload = multer({
  storage: storage,
//   limits: { fileSize: 1000000 }, // Limit file size to 1MB
//   fileFilter: (req, file, cb) => {
//     checkFileType(file, cb);
//   }
}); // 'image' is the name of the field in the form




module.exports = upload

