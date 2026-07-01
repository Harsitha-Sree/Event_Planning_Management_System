const mongoose = require('mongoose');
const dotenv = require('dotenv'); 

dotenv.config();

const connectDB = async () => {
  mu="mongodb://localhost:27017/eventPlannerDB"
  try {
    const conn = await mongoose.connect(mu, {
      // The following options are deprecated in Mongoose 6+ and can usually be omitted
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      // useCreateIndex: true, // Not supported in Mongoose 6+
      // useFindAndModify: false // Not supported in Mongoose 6+
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;