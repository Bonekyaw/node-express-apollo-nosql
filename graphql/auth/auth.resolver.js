require("dotenv").config();

const Admin = require("../../models/admin");
const Otp = require("../../models/otp");

// const { composeResolvers } = require("@graphql-tools/resolvers-composition");
const asyncHandler = require("express-async-handler");
// const { body, validationResult } = require("express-validator");
// const { v4: uuidv4 } = require("uuid");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const validator = require("validator");
const { GraphQLError } = require("graphql");

const {
  checkPhoneExist,
  checkPhoneIfNotExist,
  validatePhone,
  checkOtpErrorIfSameDate,
  checkOtpPhone,
} = require("../../middleware/check");

const rand = () => Math.random().toString(36).substring(2);

module.exports = {
  Mutation: {
    register: asyncHandler(async (parent, args, context, info) => {
      const phoneNumber = validatePhone(args.phone);

      const admin = await Admin.findOne({
        phone: phoneNumber,
      });
      checkPhoneExist(admin);

      // OTP processing eg. Sending OTP request to Operator
      const otpCheck = await Otp.findOne({
        phone: phoneNumber,
      });

      const token = rand() + rand();
      if (!otpCheck) {
        const otp = new Otp({
          phone: phoneNumber,
          otp: "123456", // fake OTP
          rememberToken: token,
          count: 1,
        });
        await otp.save();
      } else {
        const lastRequest = new Date(otpCheck.updatedAt).toLocaleDateString();
        const isSameDate = lastRequest == new Date().toLocaleDateString();

        checkOtpErrorIfSameDate(isSameDate, otpCheck);

        if (!isSameDate) {
          otpCheck.otp = "123456"; // Should replace new OTP
          otpCheck.rememberToken = token;
          otpCheck.count = 1;
          otpCheck.error = 0; // reset error count
          await otpCheck.save();
        } else {
          if (otpCheck.count === 3) {
            throw new GraphQLError(
              "OTP requests are allowed only 3 times per day. Please try again tomorrow,if you reach the limit.",
              {
                extensions: {
                  code: "METHOD NOT ALLOWED",
                  http: { status: 405 },
                },
              }
            );
          } else {
            otpCheck.otp = "123456"; // Should replace new OTP
            otpCheck.rememberToken = token;
            otpCheck.count += 1;
            await otpCheck.save();
          }
        }
      }

      return {
        message: `We are sending OTP to 09${phoneNumber}.`,
        phone: phoneNumber,
        token: token,
      };
    }),

    verifyOtp: asyncHandler(async (parent, args, context, info) => {
      let token;
      let phone = validatePhone(args.userInput.phone);
      let otp = args.userInput.otp;

      // Start validation
      if (validator.isEmpty(args.userInput.token.trim())) {
        throw new GraphQLError("Token must not be empty.", {
          extensions: {
            code: "BAD REQUEST",
            http: { status: 400 },
          },
        });
      }
      if (
        validator.isEmpty(otp.trim()) ||
        !validator.isLength(otp, { min: 5, max: 12 }) ||
        !validator.matches(otp, "^[0-9]+$")
      ) {
        throw new GraphQLError("OTP is invalid.", {
          extensions: {
            code: "BAD REQUEST",
            http: { status: 400 },
          },
        });
      }

      token = validator.escape(args.userInput.token);

      // End validation

      const admin = await Admin.findOne({
        phone: phone,
      });
      checkPhoneExist(admin);

      const otpCheck = await Otp.findOne({
        phone: phone,
      });
      checkOtpPhone(otpCheck);

      // Wrong OTP allowed 5 times per day
      const lastRequest = new Date(otpCheck.updatedAt).toLocaleDateString();
      const isSameDate = lastRequest == new Date().toLocaleDateString();

      checkOtpErrorIfSameDate(isSameDate, otpCheck);

      if (otpCheck.rememberToken !== token) {
        otpCheck.error = 5;
        await otpCheck.save();

        throw new GraphQLError("Token is invalid.", {
          extensions: {
            code: "BAD REQUEST",
            http: { status: 400 },
          },
        });
      }

      const difference = moment() - moment(otpCheck.updatedAt);
      // console.log("Diff", difference);

      if (difference > 90000) {
        // will expire after 1 min 30 sec
        throw new GraphQLError("OTP is expired.", {
          extensions: {
            code: "FORBIDDEN",
            http: { status: 403 },
          },
        });
      }

      if (otpCheck.otp !== otp) {
        // ----- Starting to record wrong times --------
        if (!isSameDate) {
          otpCheck.error = 1;
          await otpCheck.save();
        } else {
          otpCheck.error += 1;
          await otpCheck.save();
        }
        // ----- Ending -----------
        throw new GraphQLError("OTP is incorrect.", {
          extensions: {
            code: "UNAUTHORIZED",
            http: { status: 401 },
          },
        });
      }

      const randomToken = rand() + rand() + rand();
      otpCheck.verifyToken = randomToken;
      otpCheck.count = 1;
      otpCheck.error = 1; // reset error count
      await otpCheck.save();

      return {
        message: "Successfully OTP is verified",
        phone: phone,
        token: randomToken,
      };
    }),

    confirmPassword: asyncHandler(async (parent, args, context, info) => {
      let phone = validatePhone(args.userInput.phone);
      let password = args.userInput.password;

      // Start validation
      if (validator.isEmpty(args.token.trim())) {
        throw new GraphQLError("Token must not be empty.", {
          extensions: {
            code: "BAD REQUEST",
            http: { status: 400 },
          },
        });
      }
      if (
        validator.isEmpty(password.trim()) ||
        !validator.isLength(password, { min: 8, max: 8 }) ||
        !validator.matches(password, "^[0-9]+$")
      ) {
        throw new GraphQLError("OTP is invalid.", {
          extensions: {
            code: "BAD REQUEST",
            http: { status: 400 },
          },
        });
      }

      token = validator.escape(args.token);

      // End validation

      const admin = await Admin.findOne({
        phone: phone,
      });
      checkPhoneExist(admin);

      const otpCheck = await Otp.findOne({
        phone: phone,
      });
      checkOtpPhone(otpCheck);

      if (otpCheck.error === 5) {
        throw new GraphQLError(
          "This request may be an attack. If not, try again tomorrow.",
          {
            extensions: {
              code: "UNAUTHORIZED",
              http: { status: 401 },
            },
          }
        );
      }

      if (otpCheck.verifyToken !== token) {
        otpCheck.error = 5;
        await otpCheck.save();

        throw new GraphQLError("Token is invalid.", {
          extensions: {
            code: "BAD REQUEST",
            http: { status: 400 },
          },
        });
      }

      const difference = moment() - moment(otpCheck.updatedAt);
      // console.log("Diff", difference);

      if (difference > 300000) {
        // will expire after 5 min
        throw new GraphQLError("Your request is expired. Please try again.", {
          extensions: {
            code: "FORBIDDEN",
            http: { status: 403 },
          },
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);

      const newAdmin = new Admin({
        phone: phone,
        password: hashPassword,
      });
      await newAdmin.save();

      // jwt token
      let payload = { id: newAdmin._id };
      const jwtToken = jwt.sign(payload, process.env.TOKEN_SECRET);

      return {
        message: "Successfully created an account.",
        token: jwtToken,
        phone: phone,
        userId: newAdmin._id,
      };
    }),

    login: asyncHandler(async (parent, args, context, info) => {
      let phone = validatePhone(args.userInput.phone);
      let password = args.userInput.password;

      // Start validation
      if (
        validator.isEmpty(password.trim()) ||
        !validator.isLength(password, { min: 8, max: 8 }) ||
        !validator.matches(password, "^[0-9]+$")
      ) {
        throw new GraphQLError("Validation failed.", {
          extensions: {
            code: "BAD REQUEST",
            http: { status: 400 },
          },
        });
      }
      // End validation

      const admin = await Admin.findOne({
        phone: phone,
      });
      checkPhoneIfNotExist(admin);

      // Wrong Password allowed 3 times per day
      if (admin.status === "freeze") {
        throw new GraphQLError(
          "Your account is temporarily locked. Please contact us.",
          {
            extensions: {
              code: "UNAUTHORIZED",
              http: { status: 401 },
            },
          }
        );
      }

      const isEqual = await bcrypt.compare(password, admin.password);
      if (!isEqual) {
        // ----- Starting to record wrong times --------
        const lastRequest = new Date(admin.updatedAt).toLocaleDateString();
        const isSameDate = lastRequest == new Date().toLocaleDateString();

        if (!isSameDate) {
          admin.error = 1;
          await admin.save();
        } else {
          if (admin.error >= 2) {
            admin.status = "freeze";
            await admin.save();
          } else {
            admin.error += 1;
            await admin.save();
          }
        }
        // ----- Ending -----------
        throw new GraphQLError("Password is wrong.", {
          extensions: {
            code: "UNAUTHORIZED",
            http: { status: 401 },
          },
        });
      }

      if (admin.error >= 1) {
        admin.error = 0;
        await admin.save();
      }

      let payload = { id: admin._id };
      const jwtToken = jwt.sign(payload, process.env.TOKEN_SECRET);

      return {
        message: "Successfully Logged In.",
        token: jwtToken,
        phone: phone,
        userId: admin._id,
      };
    }),
  },
};

// Resolvers Composition like auth middleware in REST

// const isAuthenticated = () => (next) => (root, args, context, info) => {
//   if (!context.currentUser) {
//     throw new Error("You are not authenticated!");
//   }

//   return next(root, args, context, info);
// };

// const resolversComposition = {
//   "Query.myQuery": [isAuthenticated(), hasRole("EDITOR")],
// };

// const composedResolvers = composeResolvers(resolvers, resolversComposition);