// middleware/verifyMrToken.js

const jwt = require("jsonwebtoken");

const verifyMrToken = (req, res, next) => {
  try {
    let token = null;

    console.log("\n========== VERIFY MR TOKEN ==========");

    // 1. Read Authorization Header
    const authHeader = req.headers.authorization;
    console.log("Authorization Header:", authHeader);

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2. Token Missing
    if (!token) {
      console.log("❌ Token not provided");

      return res.status(401).json({
        success: false,
        message: "Access denied. Token not provided.",
      });
    }

    console.log("Received Token:", token);

    // 3. Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("Decoded Token Data:", decoded);

    // 4. Check Role
    if (decoded.role !== "medical_representative") {
      console.log("❌ Invalid Role:", decoded.role);

      return res.status(403).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    // 5. Attach to req
    req.mr = {
      id: decoded.id,
      mr_mobile_number: decoded.mr_mobile_number,
      mr_email: decoded.mr_email,
      mr_name: decoded.mr_name,
      mr_city: decoded.mr_city,
      role: decoded.role,
    };

    console.log("Attached req.mr:", req.mr);
    console.log("✅ Token Verified Successfully");
    console.log("=====================================\n");

    next();
  } catch (error) {
    console.error("[VERIFY MR TOKEN ERROR]", error.message);

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

module.exports = verifyMrToken;