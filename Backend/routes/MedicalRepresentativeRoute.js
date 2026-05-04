const express = require("express");
const router = express.Router();
const MedicalRepresentative = require("../models/MedicalRepresentativeModel");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const path = require("path");
const Doctor = require("../models/DoctorModel");
const verifyMrToken = require("../middlewares/verifyMrToken");
const setDoctorAppointment = require("../models/DoctorSetAppointment");
const BookAppointment = require("../models/BookAppointment");
const getistDateStart = require("../utils/datehelper");

console.log('\n========== MEDICAL REPRESENTATIVE ROUTE INIT ==========');

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dceovbwta',
  api_key: process.env.CLOUDINARY_API_KEY || '567437721784314',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'O38Ys9xXczfHk2YjzF6kdLB0Rjk',
};

console.log('☁️  Cloudinary Configuration:');
console.log('   Cloud Name:', cloudinaryConfig.cloud_name);
console.log('   API Key:', cloudinaryConfig.api_key ? '✓ Set' : '✗ Missing');
console.log('   API Secret:', cloudinaryConfig.api_secret ? '✓ Set' : '✗ Missing');

cloudinary.config(cloudinaryConfig);

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only JPEG, PNG, WebP images and PDF files are allowed`), false);
    }
  },
});

// Helper function to upload file to Cloudinary with better error handling
const uploadToCloudinary = async (fileBuffer, folder, fileName, fileType) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder,
      public_id: fileName,
      resource_type: "auto",
    };
    
    // Add transformation for images to optimize
    if (fileType === 'image') {
      uploadOptions.transformation = [
        { quality: "auto:good" },
        { fetch_format: "auto" }
      ];
    }
    
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error(`[Cloudinary] Upload error for ${fileName}:`, error);
          reject(error);
        } else {
          console.log(`[Cloudinary] Upload successful for ${fileName}:`, result.secure_url);
          resolve(result);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Determine file type
const getFileType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'other';
};

// Send OTP Route
router.post("/send-otp", async (req, res) => {
  console.log('\n[MR] Send OTP Request:', req.body);
  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  if (!/^\d{10}$/.test(mobileNumber)) {
    return res.status(400).json({
      success: false,
      message: "Invalid mobile number format",
    });
  }

  try {
    let mr = await MedicalRepresentative.findOne({ mr_mobile_number: mobileNumber });

    if (!mr) {
      mr = new MedicalRepresentative({
        mr_name: "temp",
        mr_email: `temp_${mobileNumber}_${Date.now()}@temp.com`,
        mr_mobile_number: mobileNumber,
        mr_company_name: "temp",
        mr_city: "temp",
        mr_region: "temp",
        mr_address: "temp",
        mr_password: Math.random().toString(36),
        is_temp: true,
      });
      await mr.save();
      console.log('[MR] Created temporary record for:', mobileNumber);
    }

    if (mr.last_otp_sent_at && (new Date() - mr.last_otp_sent_at) < 30000) {
      return res.status(429).json({
        success: false,
        message: "Please wait 30 seconds before requesting another OTP",
      });
    }

    if (mr.otp_verification_id && mr.otp_expires_at && mr.otp_expires_at > new Date()) {
      return res.status(200).json({
        success: true,
        message: "OTP already sent. Please check your messages.",
        verificationId: mr.otp_verification_id,
        alreadySent: true,
      });
    }

    const options = {
      method: "POST",
      url: `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=C-019F646DA2204BC&flowType=SMS&mobileNumber=${mobileNumber}`,
      headers: {
        authToken: process.env.OTP_AUTH_TOKEN,
      },
    };

    const response = await axios(options);

    if (response.data.responseCode === 200) {
      mr.otp_verification_id = response.data.data.verificationId;
      mr.otp_expires_at = new Date(Date.now() + 60000);
      mr.last_otp_sent_at = new Date();
      mr.otp_attempts = (mr.otp_attempts || 0) + 1;
      await mr.save();

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        verificationId: response.data.data.verificationId,
        timeout: response.data.data.timeout,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || "Failed to send OTP",
      });
    }
  } catch (error) {
    console.error("[MR] Error sending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending OTP",
      error: error.message,
    });
  }
});

// Verify OTP Route
router.post("/verify-otp", async (req, res) => {
  console.log('\n[MR] Verify OTP Request:', { ...req.body, otpCode: '***' });
  const { mobileNumber, otpCode, verificationId } = req.body;

  if (!mobileNumber || !otpCode || !verificationId) {
    return res.status(400).json({
      success: false,
      message: "Mobile number, OTP code, and verification ID are required",
    });
  }

  try {
    const mr = await MedicalRepresentative.findOne({ mr_mobile_number: mobileNumber });

    if (!mr) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not found",
      });
    }

    const finalVerificationId = verificationId || mr.otp_verification_id;

    if (!finalVerificationId) {
      return res.status(400).json({
        success: false,
        message: "No OTP request found. Please request a new OTP.",
      });
    }

    if (mr.otp_expires_at && mr.otp_expires_at < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    const options = {
      method: "GET",
      url: `https://cpaas.messagecentral.com/verification/v3/validateOtp?countryCode=91&mobileNumber=${mobileNumber}&verificationId=${finalVerificationId}&customerId=C-019F646DA2204BC&code=${otpCode}`,
      headers: {
        authToken: process.env.OTP_AUTH_TOKEN,
      },
    };

    const response = await axios(options);

    if (
      response.data.responseCode === 200 &&
      response.data.data.verificationStatus === "VERIFICATION_COMPLETED"
    ) {
      mr.is_mobile_verified = true;
      mr.clearOtpData();
      await mr.save();

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
      });
    }
  } catch (error) {
    console.error("[MR] Error verifying OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
    });
  }
});

// Register MR Route with Document Upload - BOTH REQUIRED
router.post("/register", upload.fields([
  { name: "certificate", maxCount: 1 },
  { name: "profile_picture", maxCount: 1 },
]), async (req, res) => {
  console.log('\n[MR] Register Request Received');
  console.log('[MR] Body:', { ...req.body, mr_password: '***' });
  console.log('[MR] Files received:', req.files ? Object.keys(req.files) : 'No files');
  
  if (req.files) {
    if (req.files.certificate) {
      console.log('[MR] Certificate file:', {
        name: req.files.certificate[0].originalname,
        type: req.files.certificate[0].mimetype,
        size: req.files.certificate[0].size
      });
    }
    if (req.files.profile_picture) {
      console.log('[MR] Profile picture file:', {
        name: req.files.profile_picture[0].originalname,
        type: req.files.profile_picture[0].mimetype,
        size: req.files.profile_picture[0].size
      });
    }
  }
  
  try {
    const {
      mr_name,
      mr_email,
      mr_mobile_number,
      mr_company_name,
      mr_city,
      mr_region,
      mr_address,
      mr_password,
      experience_years,
    } = req.body;

    // Check all required fields
    if (
      !mr_name ||
      !mr_email ||
      !mr_mobile_number ||
      !mr_company_name ||
      !mr_city ||
      !mr_region ||
      !mr_address ||
      !mr_password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Find MR by mobile number
    const mr = await MedicalRepresentative.findOne({ mr_mobile_number });

    if (!mr) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not found. Please request OTP first.",
      });
    }

    // Check if mobile is verified
    if (!mr.is_mobile_verified) {
      return res.status(400).json({
        success: false,
        message: "Mobile number not verified. Please verify OTP first.",
      });
    }

    // Check if email already exists
    const existingMR = await MedicalRepresentative.findOne({
      mr_email: mr_email,
      is_temp: { $ne: true },
      _id: { $ne: mr._id },
    });

    if (existingMR) {
      return res.status(400).json({
        success: false,
        message: "MR with this email already exists",
      });
    }

    // Upload documents to Cloudinary
    let certificateUrl = null;
    let profilePictureUrl = null;

    // Upload certificate if provided - NOW REQUIRED
    if (req.files && req.files.certificate && req.files.certificate[0]) {
      try {
        const certificateFile = req.files.certificate[0];
        const timestamp = Date.now();
        const fileExt = path.extname(certificateFile.originalname);
        const fileName = `mr_certificate_${mr_mobile_number}_${timestamp}${fileExt}`;
        const fileType = getFileType(certificateFile.mimetype);
        
        console.log('[MR] Uploading certificate to Cloudinary...');
        const uploadResult = await uploadToCloudinary(
          certificateFile.buffer,
          "medical_representatives/certificates",
          fileName,
          fileType
        );
        certificateUrl = uploadResult.secure_url;
        console.log('[MR] Certificate uploaded successfully:', certificateUrl);
      } catch (uploadError) {
        console.error('[MR] Certificate upload failed:', uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload certificate",
          error: uploadError.message
        });
      }
    } else {
      console.log('[MR] No certificate file provided');
      return res.status(400).json({
        success: false,
        message: "Certificate document is required",
      });
    }

    // Upload profile picture if provided - NOW REQUIRED
    if (req.files && req.files.profile_picture && req.files.profile_picture[0]) {
      try {
        const profileFile = req.files.profile_picture[0];
        const timestamp = Date.now();
        const fileExt = path.extname(profileFile.originalname);
        const fileName = `mr_profile_${mr_mobile_number}_${timestamp}${fileExt}`;
        const fileType = getFileType(profileFile.mimetype);
        
        console.log('[MR] Uploading profile picture to Cloudinary...');
        const uploadResult = await uploadToCloudinary(
          profileFile.buffer,
          "medical_representatives/profiles",
          fileName,
          fileType
        );
        profilePictureUrl = uploadResult.secure_url;
        console.log('[MR] Profile picture uploaded successfully:', profilePictureUrl);
      } catch (uploadError) {
        console.error('[MR] Profile picture upload failed:', uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile picture",
          error: uploadError.message
        });
      }
    } else {
      console.log('[MR] No profile picture file provided');
      return res.status(400).json({
        success: false,
        message: "Profile picture is required",
      });
    }

    // Update MR with actual data
    mr.mr_name = mr_name;
    mr.mr_email = mr_email;
    mr.mr_company_name = mr_company_name;
    mr.mr_city = mr_city;
    mr.mr_region = mr_region;
    mr.mr_address = mr_address;
    mr.mr_password = mr_password;
    mr.experience_years = experience_years || 0;
    mr.is_temp = false;
    mr.certificate_url = certificateUrl;
    mr.profile_picture = profilePictureUrl;

    await mr.save();
    console.log('[MR] MR record saved successfully with URLs:', {
      certificate_url: mr.certificate_url,
      profile_picture: mr.profile_picture
    });

    // Remove password from response
    const mrResponse = mr.toObject();
    delete mrResponse.mr_password;

    return res.status(201).json({
      success: true,
      message: "Medical Representative registered successfully",
      mr: mrResponse,
    });
  } catch (error) {
    console.error("[MR] Error in registration:", error);
    return res.status(500).json({
      success: false,
      message: "Error registering medical representative",
      error: error.message,
    });
  }
});

// Resend OTP Route
router.post("/resend-otp", async (req, res) => {
  console.log('\n[MR] Resend OTP Request:', req.body);
  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  try {
    const mr = await MedicalRepresentative.findOne({ mr_mobile_number: mobileNumber });

    if (!mr) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not found",
      });
    }

    if (mr.last_otp_sent_at && (new Date() - mr.last_otp_sent_at) < 30000) {
      return res.status(429).json({
        success: false,
        message: "Please wait 30 seconds before requesting another OTP",
      });
    }

    mr.otp_verification_id = null;
    await mr.save();

    const options = {
      method: "POST",
      url: `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=C-019F646DA2204BC&flowType=SMS&mobileNumber=${mobileNumber}`,
      headers: {
        authToken: process.env.OTP_AUTH_TOKEN,
      },
    };

    const response = await axios(options);

    if (response.data.responseCode === 200) {
      mr.otp_verification_id = response.data.data.verificationId;
      mr.otp_expires_at = new Date(Date.now() + 60000);
      mr.last_otp_sent_at = new Date();
      mr.otp_attempts = (mr.otp_attempts || 0) + 1;
      await mr.save();

      return res.status(200).json({
        success: true,
        message: "OTP resent successfully",
        verificationId: response.data.data.verificationId,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || "Failed to resend OTP",
      });
    }
  } catch (error) {
    console.error("[MR] Error resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Error resending OTP",
      error: error.message,
    });
  }
});

// MR Login Route
router.post("/mr-login", async (req, res) => {
  const { mr_mobile_number, mr_password } = req.body;

  if (!mr_mobile_number || !mr_password) {
    return res.status(400).json({
      success: false,
      message: "Mobile number and password are required",
    });
  }

  if (!/^\d{10}$/.test(mr_mobile_number)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid 10-digit mobile number",
    });
  }

  try {
    const mr = await MedicalRepresentative.findOne({ mr_mobile_number });

    if (!mr) {
      return res.status(404).json({
        success: false,
        message: "No account found with this mobile number",
      });
    }

    // Plain password compare
    if (mr.mr_password !== mr_password) {
      return res.status(401).json({
        success: false,
        message: "Invalid password. Please try again.",
      });
    }

    const token = jwt.sign(
      {
        id: mr._id,
        mr_mobile_number: mr.mr_mobile_number,
        mr_email: mr.mr_email,
        mr_name: mr.mr_name,
        mr_city: mr.mr_city,
        role: "medical_representative",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("[MR LOGIN ERROR]", error);

    return res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
});

// Get MR Profile Route
router.get("/profile/:id", async (req, res) => {
  console.log('\n[MR] Get Profile for ID:', req.params.id);
  try {
    const mr = await MedicalRepresentative.findById(req.params.id).select("-mr_password");
    
    if (!mr) {
      return res.status(404).json({
        success: false,
        message: "Medical Representative not found",
      });
    }

    return res.status(200).json({
      success: true,
      mr,
    });
  } catch (error) {
    console.error("[MR] Error fetching profile:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
});

// Upload Document Route
router.post("/upload-document/:id", upload.fields([
  { name: "certificate", maxCount: 1 },
  { name: "profile_picture", maxCount: 1 },
]), async (req, res) => {
  console.log('\n[MR] Upload Documents for ID:', req.params.id);
  try {
    const mr = await MedicalRepresentative.findById(req.params.id);
    
    if (!mr) {
      return res.status(404).json({
        success: false,
        message: "Medical Representative not found",
      });
    }

    let uploadedUrls = {};

    if (req.files && req.files.certificate && req.files.certificate[0]) {
      const certificateFile = req.files.certificate[0];
      const timestamp = Date.now();
      const fileExt = path.extname(certificateFile.originalname);
      const fileName = `mr_certificate_${mr.mr_mobile_number}_${timestamp}${fileExt}`;
      const fileType = getFileType(certificateFile.mimetype);
      
      const uploadResult = await uploadToCloudinary(
        certificateFile.buffer,
        "medical_representatives/certificates",
        fileName,
        fileType
      );
      mr.certificate_url = uploadResult.secure_url;
      uploadedUrls.certificate_url = uploadResult.secure_url;
    }

    if (req.files && req.files.profile_picture && req.files.profile_picture[0]) {
      const profileFile = req.files.profile_picture[0];
      const timestamp = Date.now();
      const fileExt = path.extname(profileFile.originalname);
      const fileName = `mr_profile_${mr.mr_mobile_number}_${timestamp}${fileExt}`;
      const fileType = getFileType(profileFile.mimetype);
      
      const uploadResult = await uploadToCloudinary(
        profileFile.buffer,
        "medical_representatives/profiles",
        fileName,
        fileType
      );
      mr.profile_picture = uploadResult.secure_url;
      uploadedUrls.profile_picture = uploadResult.secure_url;
    }

    await mr.save();

    return res.status(200).json({
      success: true,
      message: "Documents uploaded successfully",
      urls: uploadedUrls,
    });
  } catch (error) {
    console.error("[MR] Error uploading documents:", error);
    return res.status(500).json({
      success: false,
      message: "Error uploading documents",
      error: error.message,
    });
  }
});

router.get("/getDoctorsByCity", verifyMrToken, async (req, res) => {
  try {
    const mrCity = req.mr.mr_city;

    console.log("\n[GET DOCTORS BY CITY]");
    console.log("MR City:", mrCity);

    if (!mrCity) {
      return res.status(400).json({
        success: false,
        message: "MR city not found in token",
      });
    }

    const doctors = await Doctor.find(
      {
        dr_city: { $regex: new RegExp(`^${mrCity}$`, "i") },
      },
      {
        _id: 1,
        dr_name: 1,
        dr_degree: 1,
        dr_email: 1,
        dr_mobile_number: 1,
        dr_city: 1,
        dr_address: 1,
      }
    ).lean();

    const formattedDoctors = doctors.map((doc) => ({
      id : doc._id,
      name: doc.dr_name,
      degree: doc.dr_degree,
      email: doc.dr_email,
      mobile: doc.dr_mobile_number,
      city: doc.dr_city,
      address: doc.dr_address,
    }));

    return res.status(200).json({
      success: true,
      city: mrCity,
      count: formattedDoctors.length,
      doctors: formattedDoctors,
    });
  } catch (error) {
    console.error("[GET DOCTORS BY CITY ERROR]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctors",
    });
  }
}); 


router.post( "/mr-doctor-get-appointment", verifyMrToken,
  async (req, res) => {
    try {
      console.log("\n========== MR GET DOCTOR APPOINTMENTS ==========");

      const { doctor_id } = req.body;

      if (!doctor_id) {
        return res.status(400).json({
          success: false,
          message: "doctor_id is required",
        });
      }

      // ✅ 1. Get today's date (normalized)
      const today = new Date(
        new Date().toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
        })
      );
      today.setHours(0, 0, 0, 0);

      console.log("Today Date:", today);

      // ✅ 2. Get all slots created by doctor
      const slots = await setDoctorAppointment
        .find({ doctor_id })
        .sort({ createdAt: -1 });

      if (!slots || slots.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No slots found for this doctor",
          data: [],
        });
      }

      // ✅ 3. Get today's booked slots
      const bookedAppointments = await BookAppointment.find({
        doctor_id,
        date: today,
      });

      // extract booked slot_ids
      const bookedSlotIds = new Set(
        bookedAppointments.map((b) => b.slot_id.toString())
      );

      // ✅ 4. Attach isBooked flag
      const updatedSlots = slots.map((slot) => {
        const isBooked = bookedSlotIds.has(slot._id.toString());

        return {
          ...slot.toObject(),
          isBooked, // 👈 IMPORTANT FLAG
        };
      });

      // ✅ 5. Send response
      return res.status(200).json({
        success: true,
        message: "Doctor slots fetched successfully",
        total: updatedSlots.length,
        data: updatedSlots,
      });

    } catch (error) {
      console.error(
        "Error in /mr-doctor-get-appointment:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);


router.post("/mr-book-appointment", verifyMrToken, async (req, res) => {
  try {
    console.log("\n========== MR BOOK APPOINTMENT ==========");

    const { doctor_id, slot_id } = req.body;
    const mr_id = req.mr.id;

    if (!doctor_id || !slot_id) {
      return res.status(400).json({
        success: false,
        message: "doctor_id and slot_id are required",
      });
    }

    // ✅ FIX: Proper IST date (NO string conversion)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC +5:30
    const istNow = new Date(now.getTime() + istOffset);

    // normalize to start of IST day
    const today = new Date(istNow);
    today.setHours(0, 0, 0, 0);

    console.log("IST Today:", today);

    // ✅ Month boundaries based on IST
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfNextMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      1
    );

    // ✅ Monthly rule
    const existingMonthlyBooking = await BookAppointment.findOne({
      doctor_id,
      mr_id,
      date: {
        $gte: startOfMonth,
        $lt: startOfNextMonth,
      },
    });

    if (existingMonthlyBooking) {
      return res.status(400).json({
        success: false,
        message: "You have already booked this doctor in this month",
      });
    }

    // ✅ Create appointment
    const appointment = await BookAppointment.create({
      doctor_id,
      slot_id,
      mr_id,
      date: today,
    });

    return res.status(200).json({
      success: true,
      message: "Appointment booked successfully",
      data: appointment,
    });

  } catch (error) {
    console.error("BOOK APPOINTMENT ERROR:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Slot already booked for today",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});




router.get("/get-mr-appointments",verifyMrToken,
  async (req, res) => {
    try {
      const mr_id = req.mr.id;

      // ✅ IST TODAY (INLINE FIX)
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffset);

      const today = new Date(
        istNow.getFullYear(),
        istNow.getMonth(),
        istNow.getDate()
      );

      console.log("IST Today:", today);

      const appointments = await BookAppointment.find({ mr_id })
        .populate("doctor_id")
        .populate("slot_id")
        .sort({ date: -1 });

      const updatedAppointments = appointments.map((appt) => {
        // ✅ Convert appointment date to IST properly
        const apptUTC = new Date(appt.date);
        const apptIST = new Date(apptUTC.getTime() + istOffset);

        const apptDate = new Date(
          apptIST.getFullYear(),
          apptIST.getMonth(),
          apptIST.getDate()
        );

        const status = apptDate < today ? "past" : "live";

        return {
          ...appt.toObject(),
          status,
        };
      });

      res.json({
        success: true,
        data: updatedAppointments,
      });

    } catch (err) {
      console.error("GET MR APPOINTMENTS ERROR:", err);

      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);
console.log('✅ Medical Representative Routes Loaded Successfully');
console.log('=====================================================\n');

module.exports = router;