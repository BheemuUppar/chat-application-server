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

// Check file type function
function checkFileType(file, cb) {
  // Allowed extensions
  const filetypes = /jpeg|jpg|png|gif/;
  // Check extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime type
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

// Route for image upload
// app.post('/upload', (req, res) => {
//   upload(req, res, (err) => {
//     if (err) {
//       res.status(400).json({ message: err });
//     } else {
//       if (req.file == undefined) {
//         res.status(400).json({ message: 'No file selected!' });
//       } else {
//         res.status(200).json({
//           message: 'File uploaded successfully!',
//           file: `uploads/${req.file.filename}`
//         });
//       }
//     }
//   });
// });

module.exports = upload

