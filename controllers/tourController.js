const AppError = require('../utils/appError');
const Tour = require('./../models/tourModel');
const catchAsync = require('./../utils/catchAsync');
const factory = require('./handlerFactory');
const sharp = require('sharp');
const multer = require('multer');

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

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.ody.images.push(filename);
    })
  );
  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' }); // this one has the path property because it's the field that we want to populate
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

// aggregation pipeline = mongobd framework for data aggregation ---- define a pipeline that all documents from a certain collection go through where they are processed step by step in order to transform then into aggregated results

// this function will calculate a couple of statistics about the tours
exports.getToursStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      // match is a filter that will find ratings greater or equals to 4.5
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    // grouping documents together using accumulators, like average
    {
      $group: {
        _id: '$difficulty ', // here it's set to null because we want all the tours together in one big group
        numTours: { $sum: 1 }, // the number of tours --- for each of the document that's gonna go through this pipeline, one will be added to this num counter
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' }, // this is how we specify the field which we want to calculate the average from
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { $avgPrice: 1 }, // sorting by the average price
    },
    // {
    //   $match: { _id: { $ne: 'EASY' } }, // not equal to easy
    // },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

// creating a function to see ehich month has most tours
exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1; // multiplying it for one is a tric to convert this data into a number (2021)
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates', // it will deconstruct an array field from the info documents and then output one document for each element of the array; basically we want to have one tour for each os these dates in the array
    },
    {
      // selecting the documents for the year that was passed in
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' }, // using the name of the field that we want to extract the data from, which is the month
        numTourStarts: { $sum: 1 }, // showing how many tours
        tours: { $push: '$name' }, // pushing into the array which tours are those
      },
    },
    {
      $addFields: { month: '$_id' }, // selecting the field that is gonna be replaced
    },
    {
      $project: {
        _id: 0, // the ID no longer shows up, and now only the field month will appear as an identifier
      },
    },
    {
      // sorting by the number of tours
      $sort: { numTourStarts: -1 },
    },
    {
      // limiting to six outputs
      $limit: 6,
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

// /tours-within/:distance/center/:latlng/unit/:unit
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  // mongoDB expects the radius of our sphere to be in radians
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please, provide latitude and longitude in the format lat, lng',
        400
      )
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'success',
    result: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please, provide latitude and longitude in the format lat, lng',
        400
      )
    );
  }

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
