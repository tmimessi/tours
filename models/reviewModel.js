const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'review cannot be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user.'],
    },
  },
  {
    // make sure that when we have a virtual property (a filed that is not stored in the database but calculated using some other value) it shows up whenever theres an output
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// preventing the user to write more than one review for each tour
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/ˆfind/, function (next) {
  // this.populate({
  // >> by specifying 'tour' here means that the field that has the same name above is going to be the one that's populated based on a tour model
  //   path: 'tour',
  //   select: 'name',
  // }).populate({
  // >> populating again
  //   path: 'user',
  //   select: 'name photo',
  // });

  this.populate({
    path: 'user',
    select: 'name photo',
  });

  next();
});

// creating a new function which will take in a tour ID and calculate the average rating and the number of ratings that exists in the collection for that exact tour and in the end the function will even update the corresponding tour document; then, in order to use that function, we will use middleware to call it each time that there is a review or one is updated or deleted

reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // an array of all the stages we want in aggregate
  const stats = await this.aggregate([
    {
      $match: { tour: tourId }, // selecting the exact tour we want to update
    },
    {
      // calculating the statistics themselves (grouping all the tours by tour)
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      raintgsAverage: stats[0].avgRating,
    });
  } else {
    // it means all the reviews are gone, so go back to the default
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      raintgsAverage: 4.5,
    });
  }
};

reviewSchema.post('save', function () {
  // this points to the document and the constructor is the model who created that document
  this.constructor.calcAverageRatings(this.tour);
});

// only getting access to the query
reviewSchema.pre(/ˆfindOneAnd/, async function (next) {
  this.r = await this.findOne();
  next();
});

reviewSchema.post(/ˆfindOneAnd/, async function () {
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;

// virtual populate: a way of keeping the array os reviews ID's on a tour but without persisting it to the database
