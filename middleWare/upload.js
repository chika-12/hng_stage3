const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AppError = require('../utils/appError');

const uploadDir = 'tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) !== '.csv') {
      return cb(new AppError('Only CSV files allowed', 403));
    }
    cb(null, true);
  },
});

module.exports = upload;
