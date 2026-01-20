// models/Registration.js
const mongoose = require("mongoose");

const RegistrationSchema = new mongoose.Schema(
  {
    registrationDate: { 
      type: String, 
      required: true 
    },
    registrationNo: { 
      type: String, 
      unique: true,
      index: true 
    },

    // Child Information
    child: {
      fullName: { type: String, required: true },
      dateOfBirth: { type: String, required: true },
      age: { type: Number },
      gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
      schoolName: { type: String, required: true },
      grade: { type: String, required: true },
      photo: { type: String },
    },

    // Parent/Guardian Information
    guardian: {
      primaryGuardianName: { type: String, required: true },
      relationshipToChild: {
        type: String,
        enum: ["Father", "Mother", "Grandfather", "Grandmother", "Uncle", "Aunt", "Other"],
        required: true
      },
      otherRelationship: { type: String },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
    },

    // Course Details
    courseDetails: {
      courseName: { type: String, required: true },
      levelEnrolled: { type: String, required: true },
      weekdays: {
        type: [String],
        enum: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      },
      weekend: {
        type: [String],
        enum: ["Sat", "Sun"],
      },
      timings: {
        type: String,
        enum: [
          "10am-11am",
          "11am-12pm",
          "12pm-1pm",
          "2pm-3pm",
          "3pm-4pm",
          "4pm-5pm",
          "5pm-6pm",
          "6pm-7pm",
          "7pm-8pm"
        ],
        required: true,
        set: function(timings) {
          if (Array.isArray(timings) && timings.length > 0) {
            return timings[0];
          }
          return timings;
        }
      },
      fees: { type: String, required: true },
  feeType: {
        type: [String],
        enum: ["per-month", "per-level",],
      },
      withMaterials: { type: Boolean, required: true },
      paymentMethod: { 
        type: String, 
        enum: ["Cash", "UPI", "Credit Card", "Debit Card", "Bank Transfer", "Online"],
        default: "Online"
      },
    },

    // Emergency Contact
    emergencyContact: {
      fullName: { type: String, required: true },
      relationship: { type: String, required: true },
      phone: { type: String, required: true },
    },

    // Declaration
    declarationDate: { type: String, required: true },

    // Payment Details
    paymentDetails: {
      paymentId: { 
        type: String, 
        required: true,
        index: true
      },
      paymentStatus: { 
        type: String, 
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
        required: true
      },
      paymentDate: { 
        type: Date,
        default: Date.now
      },
      amount: { 
        type: String,
        required: true
      },
      // razorpayOrderId: { 
      //   type: String 
      // },
      // razorpaySignature: { 
      //   type: String 
      // }
    },
    
    // Registration Status
    status: { 
      type: String, 
      enum: ["pending", "active","inactive", "cancelled", "completed"],
      default: "pending",
      index: true
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate registration number before saving (only for active registrations)
RegistrationSchema.pre('save', async function(next) {
  if (this.isNew && !this.registrationNo && this.status === 'active') {
    try {
      // Find the latest registration regardless of status to get the highest number
      const latestRegistration = await mongoose.model('Registration')
        .findOne()
        .sort({ registrationNo: -1 })
        .select('registrationNo');
      
      let sequentialNumber = 1;
      
      if (latestRegistration && latestRegistration.registrationNo) {
        // Extract number from format CM0001, CM0002, etc.
        const match = latestRegistration.registrationNo.match(/^CM(\d{4})$/);
        if (match && match[1]) {
          sequentialNumber = parseInt(match[1]) + 1;
        }
      }
      
      // Format: CM0001, CM0002, ..., CM0009, CM0010, etc.
      this.registrationNo = `CM${sequentialNumber.toString().padStart(4, '0')}`;
      console.log(`Generated registration number: ${this.registrationNo}`);
      next();
    } catch (error) {
      console.error('Error generating registration number:', error);
      next(error);
    }
  } else {
    next();
  }
});

// Static method to get the next registration number without saving
RegistrationSchema.statics.getNextRegistrationNumber = async function() {
  try {
    // Find the latest registration regardless of status
    const latestRegistration = await this.findOne()
      .sort({ registrationNo: -1 })
      .select('registrationNo');
    
    let sequentialNumber = 1;
    
    if (latestRegistration && latestRegistration.registrationNo) {
      const match = latestRegistration.registrationNo.match(/^CM(\d{4})$/);
      if (match && match[1]) {
        sequentialNumber = parseInt(match[1]) + 1;
      }
    }
    
    const nextNumber = `CM${sequentialNumber.toString().padStart(4, '0')}`;
    console.log(`Next registration number calculated: ${nextNumber} (Latest: ${latestRegistration?.registrationNo})`);
    return nextNumber;
  } catch (error) {
    console.error('Error in getNextRegistrationNumber:', error);
    throw new Error('Error generating registration number: ' + error.message);
  }
};

// Static method to get the last registration number
RegistrationSchema.statics.getLastRegistrationNumber = async function() {
  try {
    const latestRegistration = await this.findOne()
      .sort({ registrationNo: -1 })
      .select('registrationNo');
    
    return latestRegistration ? latestRegistration.registrationNo : null;
  } catch (error) {
    console.error('Error in getLastRegistrationNumber:', error);
    throw new Error('Error fetching last registration number: ' + error.message);
  }
};

// Index for better performance
RegistrationSchema.index({ registrationNo: 1 });
RegistrationSchema.index({ createdAt: -1 });
RegistrationSchema.index({ status: 1 });
RegistrationSchema.index({ 'paymentDetails.paymentId': 1 });

module.exports = mongoose.model("Registration", RegistrationSchema);