// models/Appointment.js

const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },

    slot_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SetDoctorAppointment",
      required: true,
      index: true,
    },

    mr_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRepresentative",
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// 🔥 Prevent double booking for same slot on same date
appointmentSchema.index(
  { doctor_id: 1, slot_id: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model("BookAppointment", appointmentSchema);