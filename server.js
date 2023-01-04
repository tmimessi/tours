const mongoose = require('mongoose');
const dotenv = require('dotenv');

// uncaught exceptions: bugs that occur in the synchronous code but are not handled anywhere
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>', 
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log('DB connection successful!'));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

// mongoose is an Object Data Modeling (ODM) library for MongoDB and Node.js, a higher level of abstraction

// each time that theres an unhandled rejection somewhere in the application, the process object will emit an object called unhandled rejection, so we can subscribe to that event, like this:
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLER REJECTION! Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  }); 
});
