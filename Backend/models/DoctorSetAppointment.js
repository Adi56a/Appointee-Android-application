// models/SetDoctorAppointment.js

const mongoose = require("mongoose");

const setDoctorAppointmentSchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },

    // null = available, not null = booked
   

    
    day: { 
      type: String,
       required: true,
        trim: true,
         lowercase: true, 
        },

    timeslot: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
  STRICT UNIQUE RULE:
  Same doctor + same date + same timeslot
  can exist only once
*/
setDoctorAppointmentSchema.index(
  {
    doctor_id: 1,
    date: 1,
    timeslot: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "SetDoctorAppointment",
  setDoctorAppointmentSchema
);