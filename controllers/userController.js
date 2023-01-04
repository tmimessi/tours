const User = require('./../models/userModel');
const sharp = require('sharp');
const multer = require('multer');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');

// setting the destination; when there isnt an error, it will show null and then the path --- this will be used when you dont need to format the image
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  // mimetype = for any extension it will start with image
  if (file.mimetype.startaWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please, upload only images', 400), false);
  }
};

// showing the destination of the photo and then in the updateMe route, a middleware that will be called when the user wants to update the picture
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

// creating a middleware that will run right after the photo is uploaded and it will resize the image to fit in
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

// looping through all the fileds that are in the object and then for each field, we check if its one of the allowed fields; if so, we create a new field in the new object, with the same name with the same value as it has in the original object and in the end, we return that one
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// adding a /me endpoint -- in this case, we want to get the document based on the current logged in user ID, so we don't have to pass any ID as a URL parameter

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) creating an error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  // setting the user photo
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

// we are not deleting the user, we are only marking them as inactive
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'err',
    message: 'This route is not defined. Please uuse /signup instead.',
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

// DO NOT update passwords with this!
exports.updateUser = factory.updateOne(User);

// when the user wants to delete his own account: Delete Current User
// when the admin wants to delete some account: Delete User
exports.deleteUser = factory.deleteOne(User);
