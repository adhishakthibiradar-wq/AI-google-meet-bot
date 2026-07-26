import mongoose from "mongoose";

export const connectDB = async () => {
  try {

    console.log("Using Mongo URL:");
    console.log(process.env.MONGODB_URI);

    await mongoose.connect(process.env.MONGODB_URI as string);

    console.log("✅ MongoDB Connected");

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};