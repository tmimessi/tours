const express = require('express');
const tourController = require('./../controllers/tourController');
const authController = require('./../controllers/authController');
const reviewRouter = require('./../routes/reviewRoutes');

const router = express.Router();

// saying that for this specific route we want to use the reviewRouter instead
router.use('/:tourId/reviews', reviewRouter);

// >>> example of how to check the id param: router.param('id', tourController.checkID);

// when the user hits the 'top-5-cheap' route, it will first run the middleware 'aliasTopTours', which will set the properties of the query object to the values that it's specified at the tourController.js, doing a filter and then showing the response in 'getAllTours'.
router
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

router.route('/tour-stats').get(tourController.getToursStats);

router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.getMonthlyPlan
  );

// geospacial query
router
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);

// calculating distances to all the tours from a certain point
router.route('/distances/:latlng/unit').get(tourController.getDistances);

router
  .route('/')
  .get(tourController.getAllTours)
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.createTour
  ); // if everything is correct in the checkBody, move to the next middleware, which is createTour.

router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.updateTour
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour
  );

module.exports = router;
