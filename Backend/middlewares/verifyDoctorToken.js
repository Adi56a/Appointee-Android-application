// middleware/verifyDoctorsToken.js

const jwt = require("jsonwebtoken");

const verifyDoctorsToken = (req, res, next) => {
  try {
    let token = null;

    console.log("\n========== VERIFY DOCTOR TOKEN ==========");

    // 1. Read Authorization Header
    const authHeader = req.headers.authorization;
    console.log("Authorization Header:", authHeader);

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2. If Token Missing
    if (!token) {
      console.log("❌ Token not provided");

      return res.status(401).json({
        success: false,
        message: "Access denied. Token not provided.",
      });
    }

    console.log("Received Token:", token);

    // 3. Verify JWT Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("Decoded Token Data:", decoded);

    // 4. Check Role
    if (decoded.role !== "doctor") {
      console.log("❌ Invalid Role:", decoded.role);

      return res.status(403).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    // 5. Attach Doctor Data to Request
    req.doctor = {
      id: decoded.id,
      dr_id: decoded.id,
      dr_name: decoded.dr_name,
      dr_mobile_number: decoded.dr_mobile_number,
      dr_email: decoded.dr_email,
      role: decoded.role,
    };

    console.log("Attached req.doctor:", req.doctor);
    console.log("✅ Doctor Token Verified Successfully");
    console.log("=========================================\n");

    next();
  } catch (error) {
    console.error("[VERIFY DOCTOR TOKEN ERROR]", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

module.exports = verifyDoctorsToken;