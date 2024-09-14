const fs = require('fs');

async function deleteFile(filePath){
  try {
    fs.unlinkSync(filePath)
    return true
  } catch (error) {
    return false
  }
}

module.exports = {deleteFile}