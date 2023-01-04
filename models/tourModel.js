const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');

// specifing a schema for the data, describing it and doing some validation.
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxLength: [
        40,
        'A tour name must have less or equal than 40 characters.',
      ],
      minLength: [10, 'A tour name must have more or equal than 10 characters'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration.'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a maximum group size.'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty.'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either easy, medium or difficult.',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // arredondando a nota
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      // creating our own validator --- checking if the price discount is lower than the price of the tour
      validate: {
        validator: function (val) {
          // this only points to current doc on NEW document creation
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below the regular price.',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description.'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image.'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false, // hiding
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    // creating embedded documents by specifying an array of objects this will create then brand new documents inside of the parent document whcih is in this case, the tour
    startLocation: {
      // GeoJSON to specify geospatial data
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    // doing it by referecing: tours and users will always remain completely separate entities in the database so all we save on a certain tour document is the IDs of the users that are the tour guides for that specific tour and then when we query the tour we want to automatically get access to the tour guides but without they being saved on the tour document itself as it would do if we were using embedded
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User', // referecing to another model, creating the relationship between these two datasets
      },
    ],
  },
  {
    // setting the virtuals
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// sorting by price and ratings (1 stands for ascending order, and -1 for descendent order)
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
// telling mongoDB that the index should be 2dsphere
tourSchema.index({ startLocation: '2dsphere' });

// durationWeekes is the name of the duration property ---- and then calculating the duration in weeks --- the this keyword will be pointing to the current document ---- it's gonna be there only when we GET the data.
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// implementing the virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// document middleware: it's a mongoose middleware that can access the currently document; it will run before .save() and .create(), not for .update(); this is the currently processed document.
// creating a slug for each of these documents

tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// this is responsible for embedding (example)
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises); // we need to use Promise.all here because the result of all of the above is a promise
//   next();
// });

// query middleware allows us to run function before or after a certain query is executed; the pre-find hook, which is a middleware that will run before any find query is executed; it wont point to any document, beacause its processing a query, and its pre, which menas it doesnt have any document yet. example: creating for tours that are secret.
// written this way it will get all of the commands that starts with find, findOne, etc.
tourSchema.pre(/ˆfind/, function (next) {
  this.find({ secretTour: { $ne: true } }); // selecting all the documents that secretTour is not true, which means it will hide the secret one
  this.start = Date.now();
  next();
});

tourSchema.pre(/ˆfind/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v - passwordChangedAt',
  }); // populate: replacce the fields that we referenced with the actual related data; it will look as if the data has always been embedded when in fact it is in a completely different collection
  next();
});

// and now, with post, it has access to the document that were created.
tourSchema.post(/ˆfind/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  next();
});

/*
>>>> we can have multiple pre middlewares or also post middlewares for the same hook 
tourSchema.pre('save', function(next){
  console.log('Will save document...')
  next()
})

>>>> creating a post middleware; it has access to the document that wass just saved to the database.
tourSchema.post('save', function (doc, next) {
  console.log(doc);
  next();
});
*/

// aggregation middleware
// tourSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } }); // adding an element at the beggining of the array in order to hide the secret tour
//   console.log(this.pipeline()); // this is gonna point to the current   aggreagation object
//   next();
// });

// creating a model for the application to perform each of the CRUD operation
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;

// virtual properties are basically fields that we can define on our schema but that wont be persisted, meaning it wont be saved to the database in order to save some space.
