const mongoose = require("mongoose");
const { Schema } = mongoose;

const otpSchema = new Schema(
  {
    phone: {
      type: String,
      minLength: 5,
      maxLength: 10,
      unique: true,
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    rememberToken: {
      type: String,
      required: true,
    },
    verifyToken: {
      type: String,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    error: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Otp", otpSchema);
