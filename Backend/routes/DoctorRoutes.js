const express = require("express");
const router = express.Router();
const Doctor = require("../models/DoctorModel");
const axios = require("axios");
const jwt = require('jsonwebtoken')

// Send OTP Route
router.post("/send-otp", async (req, res) => {
  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  // Validate mobile number format (10 digits)
  if (!/^\d{10}$/.test(mobileNumber)) {
    return res.status(400).json({
      success: false,
      message: "Invalid mobile number format",
    });
  }

  try {
    // Check if doctor exists with this mobile number
    let doctor = await Doctor.findOne({ dr_mobile_number: mobileNumber });

    // If doctor doesn't exist, create a temporary record
    if (!doctor) {
      doctor = new Doctor({
        dr_name: "temp",
        dr_degree: "temp",
        dr_email: `temp_${mobileNumber}_${Date.now()}@temp.com`,
        dr_mobile_number: mobileNumber,
        dr_city: "temp",
        dr_address: "temp",
        dr_password: Math.random().toString(36),
        is_temp: true,
      });
      await doctor.save();
    }

    // Check if OTP was sent recently (cooldown of 30 seconds)
    if (doctor.last_otp_sent_at && (new Date() - doctor.last_otp_sent_at) < 30000) {
      return res.status(429).json({
        success: false,
        message: "Please wait 30 seconds before requesting another OTP",
      });
    }

    // Check if there's an existing verification ID that's not expired
    if (doctor.otp_verification_id && doctor.otp_expires_at && doctor.otp_expires_at > new Date()) {
      // Return existing verification ID instead of sending new OTP
      return res.status(200).json({
        success: true,
        message: "OTP already sent. Please check your messages.",
        verificationId: doctor.otp_verification_id,
        alreadySent: true,
      });
    }

    const options = {
      method: "POST",
      url: `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=C-6D16D900FA3044F&flowType=SMS&mobileNumber=${mobileNumber}`,
      headers: {
        authToken: "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDLTZEMTZEOTAwRkEzMDQ0RiIsImlhdCI6MTc3NzA1NTAyNSwiZXhwIjoxOTM0NzM1MDI1fQ.M1JGE1L837hn6ZtTqFqr6_OHd4F5j2aCA4EwAryItZVE1kVNAfAFAxgR_KVQOBhBAx9HrtGJJmTkcy3SCNU9Ow",
      },
    };

    const response = await axios(options);

    console.log("Send OTP API Response:", response.data);

    if (response.data.responseCode === 200) {
      // Store OTP data in database
      doctor.otp_verification_id = response.data.data.verificationId;
      doctor.otp_expires_at = new Date(Date.now() + 60000); // 60 seconds expiry
      doctor.last_otp_sent_at = new Date();
      doctor.otp_attempts = (doctor.otp_attempts || 0) + 1;
      await doctor.save();

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        verificationId: response.data.data.verificationId,
        timeout: response.data.data.timeout,
      });
    } else if (response.data.responseCode === 506) {
      // REQUEST_ALREADY_EXISTS - OTP already pending
      return res.status(200).json({
        success: true,
        message: "OTP already sent. Please check your messages.",
        verificationId: doctor.otp_verification_id,
        alreadySent: true,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || "Failed to send OTP",
      });
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
    
    // Handle specific error cases
    if (error.response?.data?.responseCode === 506) {
      return res.status(200).json({
        success: true,
        message: "OTP already sent. Please check your messages or wait a minute.",
        alreadySent: true,
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Error sending OTP",
      error: error.message,
    });
  }
});

// Verify OTP Route
router.post("/verify-otp", async (req, res) => {
  const { mobileNumber, otpCode, verificationId } = req.body;

  console.log("Verify OTP Request:", { mobileNumber, otpCode, verificationId });

  if (!mobileNumber || !otpCode || !verificationId) {
    return res.status(400).json({
      success: false,
      message: "Mobile number, OTP code, and verification ID are required",
    });
  }

  try {
    // Find doctor by mobile number
    const doctor = await Doctor.findOne({ dr_mobile_number: mobileNumber });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not found",
      });
    }

    // Use the verificationId from request or from database
    const finalVerificationId = verificationId || doctor.otp_verification_id;

    if (!finalVerificationId) {
      return res.status(400).json({
        success: false,
        message: "No OTP request found. Please request a new OTP.",
      });
    }

    // Check if OTP is expired
    if (doctor.otp_expires_at && doctor.otp_expires_at < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    // Verify OTP with external API
    const options = {
      method: "GET",
      url: `https://cpaas.messagecentral.com/verification/v3/validateOtp?countryCode=91&mobileNumber=${mobileNumber}&verificationId=${finalVerificationId}&customerId=C-6D16D900FA3044F&code=${otpCode}`,
      headers: {
        authToken: "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDLTZEMTZEOTAwRkEzMDQ0RiIsImlhdCI6MTc3NzA1NTAyNSwiZXhwIjoxOTM0NzM1MDI1fQ.M1JGE1L837hn6ZtTqFqr6_OHd4F5j2aCA4EwAryItZVE1kVNAfAFAxgR_KVQOBhBAx9HrtGJJmTkcy3SCNU9Ow",
      },
    };

    const response = await axios(options);
    console.log("Verify OTP API Response:", response.data);

    if (
      response.data.responseCode === 200 &&
      response.data.data.verificationStatus === "VERIFICATION_COMPLETED"
    ) {
      // Mark mobile as verified and clear OTP data
      doctor.is_mobile_verified = true;
      doctor.clearOtpData();
      await doctor.save();

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        mobileNumber: response.data.data.mobileNumber,
        verificationStatus: response.data.data.verificationStatus,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP or verification failed",
        details: response.data,
      });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error.response?.data || error.message);
    
    // Check if error is due to invalid OTP
    if (error.response?.data?.responseCode === 400) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code. Please try again.",
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.response?.data || error.message,
    });
  }
});

// Register Doctor Route
router.post("/register", async (req, res) => {
  const {
    dr_name,
    dr_degree,
    dr_email,
    dr_mobile_number,
    dr_city,
    dr_address,
    dr_password,
  } = req.body;

  // Check all required fields
  if (
    !dr_name ||
    !dr_degree ||
    !dr_email ||
    !dr_mobile_number ||
    !dr_city ||
    !dr_address ||
    !dr_password
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    // Find doctor by mobile number
    const doctor = await Doctor.findOne({ dr_mobile_number });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not found. Please request OTP first.",
      });
    }

    // Check if mobile is verified
    if (!doctor.is_mobile_verified) {
      return res.status(400).json({
        success: false,
        message: "Mobile number not verified. Please verify OTP first.",
      });
    }

    // Check if email already exists for non-temp doctors
    const existingDoctor = await Doctor.findOne({
      dr_email: dr_email,
      is_temp: { $ne: true },
      _id: { $ne: doctor._id },
    });

    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: "Doctor with this email already exists",
      });
    }

    // Update the temporary doctor record with actual data
    doctor.dr_name = dr_name;
    doctor.dr_degree = dr_degree;
    doctor.dr_email = dr_email;
    doctor.dr_city = dr_city;
    doctor.dr_address = dr_address;
    doctor.dr_password = dr_password;
    doctor.is_temp = false;
    doctor.dr_mobile_number = dr_mobile_number;

    await doctor.save();

    // Remove password from response
    const doctorResponse = doctor.toObject();
    delete doctorResponse.dr_password;

    return res.status(201).json({
      success: true,
      message: "Doctor registered successfully",
      doctor: doctorResponse,
    });
  } catch (error) {
    console.error("Error in registration:", error);
    return res.status(500).json({
      success: false,
      message: "Error registering doctor",
      error: error.message,
    });
  }
});

// Resend OTP Route
router.post("/resend-otp", async (req, res) => {
  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  try {
    const doctor = await Doctor.findOne({ dr_mobile_number: mobileNumber });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not found",
      });
    }

    // Check cooldown period
    if (doctor.last_otp_sent_at && (new Date() - doctor.last_otp_sent_at) < 30000) {
      return res.status(429).json({
        success: false,
        message: "Please wait 30 seconds before requesting another OTP",
      });
    }

    // Clear old verification ID before sending new one
    doctor.otp_verification_id = null;
    await doctor.save();

    const options = {
      method: "POST",
      url: `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=C-6D16D900FA3044F&flowType=SMS&mobileNumber=${mobileNumber}`,
      headers: {
        authToken: "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDLTZEMTZEOTAwRkEzMDQ0RiIsImlhdCI6MTc3NzA1NTAyNSwiZXhwIjoxOTM0NzM1MDI1fQ.M1JGE1L837hn6ZtTqFqr6_OHd4F5j2aCA4EwAryItZVE1kVNAfAFAxgR_KVQOBhBAx9HrtGJJmTkcy3SCNU9Ow",
      },
    };

    const response = await axios(options);
    console.log("Resend OTP Response:", response.data);

    if (response.data.responseCode === 200) {
      doctor.otp_verification_id = response.data.data.verificationId;
      doctor.otp_expires_at = new Date(Date.now() + 60000);
      doctor.last_otp_sent_at = new Date();
      doctor.otp_attempts = (doctor.otp_attempts || 0) + 1;
      await doctor.save();

      return res.status(200).json({
        success: true,
        message: "OTP resent successfully",
        verificationId: response.data.data.verificationId,
      });
    } else if (response.data.responseCode === 506) {
      return res.status(200).json({
        success: true,
        message: "OTP already pending. Please check your messages.",
        verificationId: doctor.otp_verification_id,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || "Failed to resend OTP",
      });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Error resending OTP",
      error: error.message,
    });
  }
});


router.post("/doctor-login", async (req, res) => {
  const { dr_mobile_number, dr_password } = req.body;

  // Validate input
  if (!dr_mobile_number || !dr_password) {
    return res.status(400).json({
      success: false,
      message: "Mobile number and password are required",
    });
  }

  // Validate mobile number format
  if (!/^\d{10}$/.test(dr_mobile_number)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid 10-digit mobile number",
    });
  }

  try {
    // Find doctor by mobile number
    const doctor = await Doctor.findOne({ dr_mobile_number });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "No account found with this mobile number",
      });
    }

    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined in environment variables");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // Compare password (supports both plain text and hashed passwords)
    let isPasswordValid = false;
    
    // Check if password is hashed (starts with $2a$ or $2b$)
    if (doctor.dr_password && doctor.dr_password.startsWith('$2')) {
      // Password is hashed with bcrypt
      isPasswordValid = await bcrypt.compare(dr_password, doctor.dr_password);
    } else {
      // Plain text password comparison (for backward compatibility)
      isPasswordValid = (doctor.dr_password === dr_password);
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password. Please try again.",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: doctor._id,
        dr_mobile_number: doctor.dr_mobile_number,
        dr_email: doctor.dr_email,
        dr_name: doctor.dr_name,
        role: "doctor",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Prepare doctor data for response (exclude sensitive info)
    const doctorData = {
      id: doctor._id,
      dr_name: doctor.dr_name,
      dr_degree: doctor.dr_degree,
      dr_email: doctor.dr_email,
      dr_mobile_number: doctor.dr_mobile_number,
      dr_city: doctor.dr_city,
      dr_address: doctor.dr_address,
      is_mobile_verified: doctor.is_mobile_verified,
      createdAt: doctor.createdAt,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});



router.get("/getAllDoctors", async (req, res) => {
  try {
    const doctors = await Doctor.find(
      {},
      {
        _id: 0,
        dr_name: 1,
        dr_degree: 1,
        dr_email: 1,
        dr_mobile_number: 1,
        dr_city: 1,
        dr_address: 1,
      }
    ).lean();

    const formattedDoctors = doctors.map((doc) => ({
      name: doc.dr_name,
      degree: doc.dr_degree,
      email: doc.dr_email,
      mobile: doc.dr_mobile_number,
      city: doc.dr_city,
      address: doc.dr_address,
    }));

    return res.status(200).json({
      success: true,
      count: formattedDoctors.length,
      doctors: formattedDoctors,
    });
  } catch (error) {
    console.error("GET ALL DOCTORS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctors",
    });
  }
});


module.exports = router;