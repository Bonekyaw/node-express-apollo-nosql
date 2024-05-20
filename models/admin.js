const mongoose = require("mongoose");
const { Schema } = mongoose;

const adminSchema = new Schema(
  {
    name: {
      type: String,
    },
    phone: {
      type: String,
      minLength: 5,
      maxLength: 10,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "editor",
    },
    status: {
      type: String,         // active, freeze, deactivate
      default: "active",
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    //   required: true,
    },
    error: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
  },
  { timestamps: true }
);

// adminSchema.virtual("localCreatedAt").get(function () {
//   return moment(this.createdAt).tz("Asia/Yangon").format();
// });


module.exports = mongoose.model("Admin", adminSchema);
