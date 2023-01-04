const express = require('express');
const morgan = require('morgan');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser')
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRouter');      
const viewRouter = require('./routes/viewRoutes');
const path = require('path');

const app = express();

// defining the view engine (pug)
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES
// serving static files
app.use(express.static(path.join(__dirname, 'public')));
// set security HTTP headers
app.use(helmet());

// development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000, // allowing 100 requests per hour
  message: 'Too many requests from this IP, please try again in an hour!',
});

// it will only affect the URL that starts with /api
app.use('/api', limiter);

// body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({extended: true, limit: '10kb'}))
app.use(cookieParser())

// data sanitization: it means to clean all the data that comes into the application from malicious code
// >>> data sanitization against NoSQL query injection: it will filter out all of the dollar signs and dots so the operators of mongoDB will no longer gonna work
app.use(mongoSanitize());

// >>> data sanitization against XSS
app.use(xss()); // this will clean any user input from malicious HTML code

// prevent parameter pollution (duplicated fields)
app.use(
  hpp({
    // an array of properties for which we allow duplicates in the query string
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

// test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies)
  next();
});

// 2) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/booking', bookingRouter);

// getting all the routes with *; this is a middleware to deal when the client tries to hit an url that does not exists.
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// middleware to catch the status code
app.use(globalErrorHandler);

module.exports = app;
