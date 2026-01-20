const Registration = require("../models/Registration");
const cloudinary = require("../middleware/cloudinary");
const fs = require("fs");
const path = require("path");
const { sendRegistrationConfirmationEmail } = require("../services/emailService");

// Helper: safe trim
const trim = (v) => (typeof v === "string" ? v.trim() : v);

// Helper: parse CSV string to trimmed array
const toArray = (val) => {
  if (!val && val !== 0) return [];
  if (Array.isArray(val)) return val.map((v) => trim(v));
  return String(val)
    .split(",")
    .map((v) => trim(v))
    .filter((v) => v !== "");
};

// Helper: Handle timings field
const handleTimings = (timings) => {
  if (Array.isArray(timings) && timings.length > 0) {
    return timings[0];
  }
  return timings;
};

// Helper: Handle boolean conversion
const toBoolean = (val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    return val === 'true' || val === '1';
  }
  return false;
};

// Image validation function
const validateImage = (file) => {
  const errors = [];
  
  if (!file) {
    return errors; // Photo is optional
  }

  // Check file type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    errors.push('Photo must be a valid image (JPEG, PNG, GIF, WebP)');
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    errors.push('Photo size must be less than 5MB');
  }

  return errors;
};

// Comprehensive validation function
const validateRegistrationData = (body, file) => {
  const errors = [];

  // Child Information Validation
  if (!trim(body.childFullName)) errors.push("Child full name is required");
  if (!trim(body.childDateOfBirth)) errors.push("Child date of birth is required");
  
  const age = body.childAge ? Number(body.childAge) : null;
  if (!age || age < 3 || age > 16) errors.push("Child age must be between 3 and 16 years");
  
  if (!trim(body.childGender)) errors.push("Child gender is required");
  if (!trim(body.childSchoolName)) errors.push("School name is required");
  if (!trim(body.childGrade)) errors.push("Grade is required");

  // Guardian Information Validation
  if (!trim(body.guardianPrimaryGuardianName)) errors.push("Guardian name is required");
  if (!trim(body.guardianRelationshipToChild)) errors.push("Relationship to child is required");
  
  if (!trim(body.guardianEmail)) {
    errors.push("Email is required");
  } else if (!/\S+@\S+\.\S+/.test(trim(body.guardianEmail))) {
    errors.push("Email format is invalid");
  }
  
  if (!trim(body.guardianPhone)) {
    errors.push("Phone number is required");
  } else if (!/^\d{10}$/.test(trim(body.guardianPhone).replace(/\D/g, ''))) {
    errors.push("Phone number must be 10 digits");
  }
  
  if (!trim(body.guardianAddress)) errors.push("Address is required");

  // Course Details Validation
  if (!trim(body.courseName)) errors.push("Course selection is required");
  if (!trim(body.courseLevelEnrolled)) errors.push("Level selection is required");
  if (!trim(body.selectedBatch)) errors.push("Please select a batch");
  if (!trim(body.selectedTiming)) errors.push("Please select a timing slot");
  
  const fees = body.courseFees ? parseFloat(body.courseFees) : null;
  if (!fees || fees <= 0) errors.push("Valid course fee is required");

  // Fee Type Validation
  const feeType = body.feeType || body.courseFeeType;
  if (!feeType) {
    errors.push("Fee type is required");
  }

  // With Materials Validation
  if (body.withMaterials === undefined || body.withMaterials === null || body.withMaterials === '') {
    errors.push("Please specify if materials are included");
  }

  // Emergency Contact Validation
  if (!trim(body.emergencyContactFullName)) errors.push("Emergency contact name is required");
  if (!trim(body.emergencyContactRelationship)) errors.push("Emergency contact relationship is required");
  
  if (!trim(body.emergencyContactPhone)) {
    errors.push("Emergency phone is required");
  } else if (!/^\d{10}$/.test(trim(body.emergencyContactPhone).replace(/\D/g, ''))) {
    errors.push("Emergency phone must be 10 digits");
  }

  // Image validation
  const imageErrors = validateImage(file);
  errors.push(...imageErrors);

  return errors;
};

// Step 1: Validate registration before payment (WITH FILE VALIDATION BUT NO UPLOAD)
exports.validateRegistration = async (req, res) => {
  try {
    console.log('Validation request received - Body keys:', Object.keys(req.body));
    console.log('File received:', req.file ? `Yes - ${req.file.originalname}` : 'No');
    
    // Parse form data fields (they come as strings when using multipart/form-data)
    const parsedBody = { ...req.body };
    
    // Parse array fields if they are sent as strings
    if (parsedBody.courseWeekdays && typeof parsedBody.courseWeekdays === 'string') {
      try {
        parsedBody.courseWeekdays = JSON.parse(parsedBody.courseWeekdays);
      } catch (e) {
        parsedBody.courseWeekdays = toArray(parsedBody.courseWeekdays);
      }
    }
    
    if (parsedBody.courseWeekend && typeof parsedBody.courseWeekend === 'string') {
      try {
        parsedBody.courseWeekend = JSON.parse(parsedBody.courseWeekend);
      } catch (e) {
        parsedBody.courseWeekend = toArray(parsedBody.courseWeekend);
      }
    }

    // Parse feeType field
    if (parsedBody.feeType && typeof parsedBody.feeType === 'string') {
      try {
        parsedBody.feeType = JSON.parse(parsedBody.feeType);
      } catch (e) {
        parsedBody.feeType = toArray(parsedBody.feeType);
      }
    }

    // Parse withMaterials field
    if (parsedBody.withMaterials !== undefined && parsedBody.withMaterials !== null) {
      parsedBody.withMaterials = toBoolean(parsedBody.withMaterials);
    }

    // Validate the data (including image)
    const validationErrors = validateRegistrationData(parsedBody, req.file);
    
    // Clean up uploaded file immediately after validation (frontend will send it again)
    if (req.file) {
      try {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('Temporary file cleaned up after validation');
        }
      } catch (cleanupError) {
        console.warn('File cleanup warning:', cleanupError.message);
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
        message: "Please fix the errors before proceeding to payment"
      });
    }

    // Prepare registration data (without saving to database)
    const registrationData = {
      registrationDate: trim(parsedBody.registrationDate) || new Date().toISOString().split('T')[0],
      child: {
        fullName: trim(parsedBody.childFullName),
        dateOfBirth: trim(parsedBody.childDateOfBirth),
        age: Number(parsedBody.childAge),
        gender: trim(parsedBody.childGender),
        schoolName: trim(parsedBody.childSchoolName),
        grade: trim(parsedBody.childGrade),
        photo: null, // Will be set during final registration
      },
      guardian: {
        primaryGuardianName: trim(parsedBody.guardianPrimaryGuardianName),
        relationshipToChild: trim(parsedBody.guardianRelationshipToChild),
        otherRelationship: trim(parsedBody.guardianOtherRelationship) || "",
        email: trim(parsedBody.guardianEmail),
        phone: trim(parsedBody.guardianPhone),
        address: trim(parsedBody.guardianAddress),
      },
      courseDetails: {
        courseName: trim(parsedBody.courseName),
        levelEnrolled: trim(parsedBody.courseLevelEnrolled),
        weekdays: toArray(parsedBody.courseWeekdays),
        weekend: toArray(parsedBody.courseWeekend),
        timings: handleTimings(parsedBody.courseTimings || parsedBody.selectedTiming),
        fees: String(parsedBody.courseFees).replace(/[^0-9.]/g, ""),
        feeType: toArray(parsedBody.feeType || parsedBody.courseFeeType),
        withMaterials: toBoolean(parsedBody.withMaterials),
        paymentMethod: "Online",
      },
      emergencyContact: {
        fullName: trim(parsedBody.emergencyContactFullName),
        relationship: trim(parsedBody.emergencyContactRelationship),
        phone: trim(parsedBody.emergencyContactPhone),
      },
      declarationDate: trim(parsedBody.declarationDate) || new Date().toISOString().split('T')[0],
      status: "pending"
    };

    // Return success with preview data for payment
    const response = {
      success: true,
      message: "Registration validated successfully. Proceed to payment.",
      data: {
        registrationPreview: registrationData,
        amount: parseFloat(registrationData.courseDetails.fees) * 100, // Amount in paise for Razorpay
        currency: "INR",
        imageValidated: !!req.file // Let frontend know image was validated
      }
    };

    console.log('Validation successful, returning response');
    console.log('Fee Type:', registrationData.courseDetails.feeType);
    console.log('With Materials:', registrationData.courseDetails.withMaterials);
    
    res.status(200).json(response);

  } catch (err) {
    console.error("Validation Error:", err);
    
    // Clean up file on error
    if (req.file) {
      try {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.warn('File cleanup failed on error:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: "Validation failed due to server error",
      details: err.message
    });
  }
};

// Step 2: Create registration after successful payment (WITH FILE UPLOAD TO CLOUDINARY)
exports.createRegistrationAfterPayment = async (req, res) => {
  try {
    const { paymentId, paymentStatus, registrationData } = req.body;

    console.log('Payment confirmation received:', {
      paymentId,
      paymentStatus,
      registrationData: registrationData ? 'present' : 'missing',
      file: req.file ? `Yes - ${req.file.originalname}` : 'No'
    });

    // Verify payment was successful
    if (paymentStatus !== 'completed') {
      // Clean up uploaded file if payment failed
      if (req.file) {
        try {
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (cleanupError) {
          console.warn('File cleanup failed:', cleanupError.message);
        }
      }

      return res.status(400).json({
        success: false,
        error: "Payment not completed",
        message: "Cannot create registration without successful payment"
      });
    }

    // Validate payment ID
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: "Payment ID is required",
        message: "Valid payment confirmation is required"
      });
    }

    // Check if registration already exists with this payment ID (idempotency)
    const existingRegistration = await Registration.findOne({ 
      'paymentDetails.paymentId': paymentId 
    });

    if (existingRegistration) {
      // Clean up duplicate file upload
      if (req.file) {
        try {
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (cleanupError) {
          console.warn('File cleanup failed for duplicate:', cleanupError.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Registration already completed for this payment",
        data: existingRegistration,
        registrationNo: existingRegistration.registrationNo
      });
    }

    // Parse registration data
    let parsedRegistrationData;
    try {
      parsedRegistrationData = typeof registrationData === 'string' 
        ? JSON.parse(registrationData) 
        : registrationData;
    } catch (parseError) {
      // Clean up file on parse error
      if (req.file) {
        try {
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (cleanupError) {
          console.warn('File cleanup failed on parse error:', cleanupError.message);
        }
      }

      return res.status(400).json({
        success: false,
        error: "Invalid registration data format",
        details: parseError.message
      });
    }

    // Handle file upload to Cloudinary if photo was provided
    let photoUrl = null;
    if (req.file) {
      try {
        console.log('Uploading photo to Cloudinary...');
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "registration_photos",
          use_filename: true,
          unique_filename: false,
        });
        photoUrl = result.secure_url;
        console.log('Photo uploaded successfully to Cloudinary:', photoUrl);

        // Delete local file after upload
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.warn('Could not delete local file:', e.message);
        }
      } catch (uploadError) {
        console.error('Photo upload to Cloudinary failed:', uploadError);
        
        // Clean up file on upload error
        if (req.file && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn('File cleanup failed on upload error:', cleanupError.message);
          }
        }
        
        return res.status(400).json({
          success: false,
          error: "Failed to upload photo to cloud storage",
          details: uploadError.message
        });
      }
    }

    // Prepare final registration data with payment info
    const finalRegistrationData = {
      ...parsedRegistrationData,
      paymentDetails: {
        paymentId: paymentId,
        paymentStatus: 'completed',
        paymentDate: new Date(),
        amount: parsedRegistrationData.courseDetails.fees,
      },
      status: 'active' // Registration is active after payment
    };

    // Update photo URL if uploaded to Cloudinary
    if (photoUrl) {
      finalRegistrationData.child.photo = photoUrl;
    } else {
      // If no photo was provided, set to null
      finalRegistrationData.child.photo = null;
    }

    console.log('Creating final registration with data:', JSON.stringify(finalRegistrationData, null, 2));
    console.log('Fee Type in final data:', finalRegistrationData.courseDetails.feeType);
    console.log('With Materials in final data:', finalRegistrationData.courseDetails.withMaterials);

    // Create the registration in database
    const newRegistration = await Registration.create(finalRegistrationData);

    console.log('Registration created successfully:', newRegistration.registrationNo);

    // ✅ SEND CONFIRMATION EMAIL (non-blocking)
    sendRegistrationConfirmationEmail(
      newRegistration.toObject(), 
      {
        paymentId: paymentId,
        paymentDate: new Date(),
        amount: finalRegistrationData.courseDetails.fees
      }
    ).then(emailResult => {
      if (emailResult.success) {
        console.log('✅ Confirmation email sent successfully to:', emailResult.recipient);
      } else {
        console.warn('⚠️ Email sending failed:', emailResult.error);
        // Don't throw error - registration is still successful
      }
    }).catch(emailError => {
      console.error('❌ Email sending error (non-critical):', emailError);
      // Don't affect the main registration flow
    });

    // RETURN THE ACTUAL REGISTRATION NUMBER (Only after successful payment)
    res.status(201).json({
      success: true,
      message: "Registration completed successfully",
      data: newRegistration,
      registrationNo: newRegistration.registrationNo, // ACTUAL registration number
      paymentId: paymentId,
      photoUploaded: !!photoUrl
    });

  } catch (err) {
    console.error("Create Registration After Payment Error:", err);

    // Clean up file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('File cleanup failed on error:', cleanupError.message);
      }
    }

    // Handle duplicate registration number error
    if (err.code === 11000 && err.keyPattern && err.keyPattern.registrationNo) {
      try {
        console.log('Duplicate registration number detected, retrying...');
        // Retry without registration number (will be auto-generated)
        const retryData = {
          ...(typeof req.body.registrationData === 'string' 
            ? JSON.parse(req.body.registrationData) 
            : req.body.registrationData),
          paymentDetails: {
            paymentId: req.body.paymentId,
            paymentStatus: 'completed',
            paymentDate: new Date(),
            amount: req.body.registrationData.courseDetails.fees
          },
          status: 'active'
        };
        
        const retryRegistration = await Registration.create(retryData);
        
        return res.status(201).json({
          success: true,
          message: "Registration created successfully (retry)",
          data: retryRegistration,
          registrationNo: retryRegistration.registrationNo,
          paymentId: req.body.paymentId
        });
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        return res.status(500).json({
          success: false,
          error: "Failed to create registration after retry",
          details: retryError.message
        });
      }
    }

    // Handle validation errors
    if (err.name === "ValidationError") {
      const errorMessages = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
      }));

      return res.status(400).json({
        success: false,
        error: "Registration validation failed",
        details: errorMessages
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create registration after payment",
      details: err.message
    });
  }
};

// Get next registration number - for admin use
exports.getNextRegistrationNumber = async (req, res) => {
  try {
    const nextRegNo = await Registration.getNextRegistrationNumber();
    
    res.status(200).json({
      success: true,
      nextRegistrationNumber: nextRegNo
    });
  } catch (err) {
    console.error("Get Next Registration Number Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to generate next registration number",
      details: err.message
    });
  }
};

// Get last registration number
exports.getLastRegistrationNumber = async (req, res) => {
  try {
    const lastRegNo = await Registration.getLastRegistrationNumber();
    res.status(200).json({
      success: true,
      lastRegistrationNumber: lastRegNo
    });
  } catch (err) {
    console.error("Get Last Registration Number Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch last registration number",
      details: err.message
    });
  }
};

// Get all registrations (only active by default)
exports.getRegistrations = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    
    let query = {};
    
    // Status filter
    if (status) {
      query.status = status;
    } else {
      query.status = 'active'; // Default to active registrations
    }

    // Search functionality
    if (search) {
      query.$or = [
        { registrationNo: { $regex: search, $options: 'i' } },
        { 'child.fullName': { $regex: search, $options: 'i' } },
        { 'guardian.primaryGuardianName': { $regex: search, $options: 'i' } },
        { 'guardian.email': { $regex: search, $options: 'i' } },
        { 'guardian.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const data = await Registration.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Registration.countDocuments(query);

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data
    });
  } catch (err) {
    console.error("Get Registrations Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch registrations",
      details: err.message
    });
  }
};

// Get registration by ID
exports.getRegistrationById = async (req, res) => {
  try {
    const data = await Registration.findById(req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    console.error("Get Registration By ID Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch registration",
      details: err.message
    });
  }
};

// Get registration by registration number
exports.getRegistrationByNumber = async (req, res) => {
  try {
    const data = await Registration.findOne({
      registrationNo: req.params.registrationNo
    });
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    console.error("Get Registration By Number Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch registration",
      details: err.message
    });
  }
};

// Update registration
exports.updateRegistration = async (req, res) => {
  try {
    // If there's a new file, upload and set photoUrl
    let photoUrl = null;
    if (req.file) {
      try {
        console.log('Uploading new photo for update...');
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "registration_photos",
          use_filename: true,
          unique_filename: false,
        });
        photoUrl = result.secure_url;

        // Delete local file after upload
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.warn('Could not delete local file:', e.message);
        }
      } catch (uploadError) {
        console.error('Photo upload failed during update:', uploadError);
        return res.status(400).json({
          success: false,
          error: "Failed to upload photo",
          details: uploadError.message
        });
      }
    }

    const body = req.body || {};
    const update = {};

    // Update child fields
    if (photoUrl) update["child.photo"] = photoUrl;
    if (body.childFullName) update["child.fullName"] = trim(body.childFullName);
    if (body.childDateOfBirth) update["child.dateOfBirth"] = trim(body.childDateOfBirth);
    if (body.childAge) update["child.age"] = Number(body.childAge);
    if (body.childGender) update["child.gender"] = trim(body.childGender);
    if (body.childSchoolName) update["child.schoolName"] = trim(body.childSchoolName);
    if (body.childGrade) update["child.grade"] = trim(body.childGrade);

    // Update guardian fields
    if (body.guardianPrimaryGuardianName) update["guardian.primaryGuardianName"] = trim(body.guardianPrimaryGuardianName);
    if (body.guardianRelationshipToChild) update["guardian.relationshipToChild"] = trim(body.guardianRelationshipToChild);
    if (body.guardianOtherRelationship) update["guardian.otherRelationship"] = trim(body.guardianOtherRelationship);
    if (body.guardianEmail) update["guardian.email"] = trim(body.guardianEmail);
    if (body.guardianPhone) update["guardian.phone"] = trim(body.guardianPhone);
    if (body.guardianAddress) update["guardian.address"] = trim(body.guardianAddress);

    // Update course details
    if (body.courseName) update["courseDetails.courseName"] = trim(body.courseName);
    if (body.courseLevelEnrolled) update["courseDetails.levelEnrolled"] = trim(body.courseLevelEnrolled);
    if (body.courseWeekdays) update["courseDetails.weekdays"] = toArray(body.courseWeekdays);
    if (body.courseWeekend) update["courseDetails.weekend"] = toArray(body.courseWeekend);
    if (body.courseTimings) update["courseDetails.timings"] = handleTimings(body.courseTimings);
    if (body.courseFees) update["courseDetails.fees"] = String(body.courseFees).replace(/[^0-9.]/g, "");
    if (body.feeType || body.courseFeeType) update["courseDetails.feeType"] = toArray(body.feeType || body.courseFeeType);
    if (body.withMaterials !== undefined && body.withMaterials !== null) {
      update["courseDetails.withMaterials"] = toBoolean(body.withMaterials);
    }
    if (body.coursePaymentMethod) update["courseDetails.paymentMethod"] = trim(body.coursePaymentMethod);

    // Update emergency contact
    if (body.emergencyContactFullName) update["emergencyContact.fullName"] = trim(body.emergencyContactFullName);
    if (body.emergencyContactRelationship) update["emergencyContact.relationship"] = trim(body.emergencyContactRelationship);
    if (body.emergencyContactPhone) update["emergencyContact.phone"] = trim(body.emergencyContactPhone);

    // Update payment details if provided
    if (body.paymentStatus) update["paymentDetails.paymentStatus"] = trim(body.paymentStatus);
    if (body.paymentId) update["paymentDetails.paymentId"] = trim(body.paymentId);

    // Update status if provided
    if (body.status) update["status"] = trim(body.status);

    // Update dates
    if (body.registrationDate) update["registrationDate"] = trim(body.registrationDate);
    if (body.declarationDate) update["declarationDate"] = trim(body.declarationDate);

    console.log('Updating registration with data:', JSON.stringify(update, null, 2));

    const updated = await Registration.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Registration updated successfully",
      data: updated
    });
  } catch (err) {
    console.error("Update Registration Error:", err);

    if (err.name === "ValidationError") {
      const errorMessages = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
      }));

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errorMessages
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update registration",
      details: err.message
    });
  }
};

// Delete registration (soft delete by changing status)
exports.deleteRegistration = async (req, res) => {
  try {
    const deleted = await Registration.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Registration cancelled successfully",
      cancelledRegistrationNo: deleted.registrationNo
    });
  } catch (err) {
    console.error("Delete Registration Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to cancel registration",
      details: err.message
    });
  }
};

// Hard delete registration (permanent removal)
exports.hardDeleteRegistration = async (req, res) => {
  try {
    const deleted = await Registration.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }
    res.status(200).json({
      success: true,
      message: "Registration permanently deleted successfully",
      deletedRegistrationNo: deleted.registrationNo
    });
  } catch (err) {
    console.error("Hard Delete Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete registration",
      details: err.message
    });
  }
};

// Add this function to your registration.controller.js, right after getRegistrationStats

// Get dashboard statistics (basic overview)
exports.getDashboardStats = async (req, res) => {
  try {
    const totalRegistrations = await Registration.countDocuments({});
    const activeRegistrations = await Registration.countDocuments({ status: 'active' });
    const pendingRegistrations = await Registration.countDocuments({ status: 'pending' });
    const cancelledRegistrations = await Registration.countDocuments({ status: 'cancelled' });
    const completedRegistrations = await Registration.countDocuments({ status: 'completed' });
    
    const lastRegistration = await Registration.findOne({})
      .sort({ createdAt: -1 })
      .select('registrationNo createdAt child.fullName courseDetails.courseName');

    // Get top 3 courses
    const topCourses = await Registration.aggregate([
      { 
        $group: { 
          _id: '$courseDetails.courseName', 
          count: { $sum: 1 },
          totalFees: { $sum: { $toDouble: '$courseDetails.fees' } }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRegistrations,
        activeRegistrations,
        pendingRegistrations,
        cancelledRegistrations,
        completedRegistrations,
        lastRegistration: lastRegistration ? {
          registrationNo: lastRegistration.registrationNo,
          studentName: lastRegistration.child?.fullName || 'Unknown',
          courseName: lastRegistration.courseDetails?.courseName || 'Unknown',
          date: lastRegistration.createdAt
        } : null,
        topCourses
      }
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard statistics",
      details: err.message
    });
  }
};

// Make sure this function exists (your original getRegistrationStats)
exports.getRegistrationStats = async (req, res) => {
  try {
    const totalRegistrations = await Registration.countDocuments({});
    const activeRegistrations = await Registration.countDocuments({ status: 'active' });
    const pendingRegistrations = await Registration.countDocuments({ status: 'pending' });
    const cancelledRegistrations = await Registration.countDocuments({ status: 'cancelled' });
    const completedRegistrations = await Registration.countDocuments({ status: 'completed' });
    
    const lastRegistration = await Registration.findOne({})
      .sort({ registrationNo: -1 })
      .select('registrationNo createdAt');

    // Course-wise statistics
    const courseStats = await Registration.aggregate([
      { $group: { _id: '$courseDetails.courseName', count: { $sum: 1 } } }
    ]);

    // Fee type statistics
    const feeTypeStats = await Registration.aggregate([
      { $unwind: { path: '$courseDetails.feeType', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$courseDetails.feeType', count: { $sum: 1 } } }
    ]);

    // Materials statistics
    const materialsStats = await Registration.aggregate([
      { $group: { _id: '$courseDetails.withMaterials', count: { $sum: 1 } } }
    ]);

    // Monthly registration trends
    const monthlyStats = await Registration.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          totalFees: { $sum: { $toDouble: '$courseDetails.fees' } }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRegistrations,
        activeRegistrations,
        pendingRegistrations,
        cancelledRegistrations,
        completedRegistrations,
        lastRegistrationNumber: lastRegistration ? lastRegistration.registrationNo : null,
        lastRegistrationDate: lastRegistration ? lastRegistration.createdAt : null,
        courseStats,
        feeTypeStats,
        materialsStats,
        monthlyStats
      }
    });
  } catch (err) {
    console.error("Registration Stats Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch registration statistics",
      details: err.message
    });
  }
};

// Add bulkUpdateStatus if not exists
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { registrationIds, status } = req.body;

    if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Registration IDs array is required"
      });
    }

    if (!status || !['active', 'pending', 'cancelled', 'completed', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Valid status is required"
      });
    }

    const result = await Registration.updateMany(
      { _id: { $in: registrationIds } },
      { 
        $set: { 
          status: status,
          updatedAt: new Date()
        } 
      }
    );

    res.status(200).json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} registrations to ${status} status`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("Bulk Update Status Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update registrations status",
      details: err.message
    });
  }
};






// Toggle registration active/inactive status
exports.toggleActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the registration
    const registration = await Registration.findById(id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    // Determine new status - toggle between active and inactive
    // If current status is active, make inactive. If anything else, make active.
    const newStatus = registration.status === 'active' ? 'inactive' : 'active';

    // Update the status
    const updatedRegistration = await Registration.findByIdAndUpdate(
      id,
      { 
        status: newStatus,
        $set: {
          updatedAt: new Date()
        }
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    console.log(`Registration ${registration.registrationNo} status changed from ${registration.status} to ${newStatus}`);

    res.status(200).json({
      success: true,
      message: `Registration status updated to ${newStatus}`,
      data: {
        registrationNo: updatedRegistration.registrationNo,
        studentName: updatedRegistration.child.fullName,
        previousStatus: registration.status,
        newStatus: updatedRegistration.status,
        updatedAt: updatedRegistration.updatedAt
      }
    });

  } catch (err) {
    console.error("Toggle Active Status Error:", err);
    
    if (err.name === "ValidationError") {
      const errorMessages = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
      }));

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errorMessages
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to toggle registration status",
      details: err.message
    });
  }
};





// Add this function to your registration.controller.js (after the existing functions)

// ==================== OFFLINE REGISTRATION (ADMIN) ====================

// Create offline registration (without payment)
exports.createOfflineRegistration = async (req, res) => {
  try {
    console.log('Offline registration request received - Body keys:', Object.keys(req.body));
    console.log('File received:', req.file ? `Yes - ${req.file.originalname}` : 'No');

    const parsedBody = { ...req.body };

    // Parse array fields if they are sent as strings
    if (parsedBody.courseWeekdays && typeof parsedBody.courseWeekdays === 'string') {
      try {
        parsedBody.courseWeekdays = JSON.parse(parsedBody.courseWeekdays);
      } catch (e) {
        parsedBody.courseWeekdays = toArray(parsedBody.courseWeekdays);
      }
    }
    
    if (parsedBody.courseWeekend && typeof parsedBody.courseWeekend === 'string') {
      try {
        parsedBody.courseWeekend = JSON.parse(parsedBody.courseWeekend);
      } catch (e) {
        parsedBody.courseWeekend = toArray(parsedBody.courseWeekend);
      }
    }

    // Parse feeType field
    if (parsedBody.feeType && typeof parsedBody.feeType === 'string') {
      try {
        parsedBody.feeType = JSON.parse(parsedBody.feeType);
      } catch (e) {
        parsedBody.feeType = toArray(parsedBody.feeType);
      }
    }

    // Parse withMaterials field
    if (parsedBody.withMaterials !== undefined && parsedBody.withMaterials !== null) {
      parsedBody.withMaterials = toBoolean(parsedBody.withMaterials);
    }

    // Validate required fields (but not payment related)
    const validationErrors = [];
    
    // Child Information Validation
    if (!trim(parsedBody.childFullName)) validationErrors.push("Child full name is required");
    if (!trim(parsedBody.childDateOfBirth)) validationErrors.push("Child date of birth is required");
    
    const age = parsedBody.childAge ? Number(parsedBody.childAge) : null;
    if (!age || age < 3 || age > 16) validationErrors.push("Child age must be between 3 and 16 years");
    
    if (!trim(parsedBody.childGender)) validationErrors.push("Child gender is required");
    if (!trim(parsedBody.childSchoolName)) validationErrors.push("School name is required");
    if (!trim(parsedBody.childGrade)) validationErrors.push("Grade is required");

    // Guardian Information Validation
    if (!trim(parsedBody.guardianPrimaryGuardianName)) validationErrors.push("Guardian name is required");
    if (!trim(parsedBody.guardianRelationshipToChild)) validationErrors.push("Relationship to child is required");
    
    if (!trim(parsedBody.guardianEmail)) {
      validationErrors.push("Email is required");
    } else if (!/\S+@\S+\.\S+/.test(trim(parsedBody.guardianEmail))) {
      validationErrors.push("Email format is invalid");
    }
    
    if (!trim(parsedBody.guardianPhone)) {
      validationErrors.push("Phone number is required");
    } else if (!/^\d{10}$/.test(trim(parsedBody.guardianPhone).replace(/\D/g, ''))) {
      validationErrors.push("Phone number must be 10 digits");
    }
    
    if (!trim(parsedBody.guardianAddress)) validationErrors.push("Address is required");

    // Course Details Validation
    if (!trim(parsedBody.courseName)) validationErrors.push("Course selection is required");
    if (!trim(parsedBody.courseLevelEnrolled)) validationErrors.push("Level selection is required");
    if (!trim(parsedBody.selectedTiming)) validationErrors.push("Please select a timing slot");
    
    const fees = parsedBody.courseFees ? parseFloat(parsedBody.courseFees) : null;
    if (!fees || fees <= 0) validationErrors.push("Valid course fee is required");

    // Fee Type Validation
    const feeType = parsedBody.feeType || parsedBody.courseFeeType;
    if (!feeType) {
      validationErrors.push("Fee type is required");
    }

    // With Materials Validation
    if (parsedBody.withMaterials === undefined || parsedBody.withMaterials === null || parsedBody.withMaterials === '') {
      validationErrors.push("Please specify if materials are included");
    }

    // Emergency Contact Validation
    if (!trim(parsedBody.emergencyContactFullName)) validationErrors.push("Emergency contact name is required");
    if (!trim(parsedBody.emergencyContactRelationship)) validationErrors.push("Emergency contact relationship is required");
    
    if (!trim(parsedBody.emergencyContactPhone)) {
      validationErrors.push("Emergency phone is required");
    } else if (!/^\d{10}$/.test(trim(parsedBody.emergencyContactPhone).replace(/\D/g, ''))) {
      validationErrors.push("Emergency phone must be 10 digits");
    }

    // Image validation (optional for offline)
    const imageErrors = validateImage(req.file);
    validationErrors.push(...imageErrors);

    if (validationErrors.length > 0) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        try {
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (cleanupError) {
          console.warn('File cleanup warning:', cleanupError.message);
        }
      }

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
        message: "Please fix the errors before creating registration"
      });
    }

    // Handle file upload to Cloudinary if photo was provided
    let photoUrl = null;
    if (req.file) {
      try {
        console.log('Uploading photo to Cloudinary for offline registration...');
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "registration_photos",
          use_filename: true,
          unique_filename: false,
        });
        photoUrl = result.secure_url;
        console.log('Photo uploaded successfully to Cloudinary:', photoUrl);

        // Delete local file after upload
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.warn('Could not delete local file:', e.message);
        }
      } catch (uploadError) {
        console.error('Photo upload to Cloudinary failed:', uploadError);
        
        // Clean up file on upload error
        if (req.file && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn('File cleanup failed on upload error:', cleanupError.message);
          }
        }
        
        return res.status(400).json({
          success: false,
          error: "Failed to upload photo to cloud storage",
          details: uploadError.message
        });
      }
    }

    // Determine registration status based on payment method
    let registrationStatus = 'active';
    const paymentMethod = trim(parsedBody.paymentMethod) || 'Cash';
    
    // If payment is pending, set status as pending
    if (parsedBody.paymentStatus === 'pending') {
      registrationStatus = 'pending';
    }

    // Prepare registration data
    const registrationData = {
      registrationDate: trim(parsedBody.registrationDate) || new Date().toISOString().split('T')[0],
      child: {
        fullName: trim(parsedBody.childFullName),
        dateOfBirth: trim(parsedBody.childDateOfBirth),
        age: Number(parsedBody.childAge),
        gender: trim(parsedBody.childGender),
        schoolName: trim(parsedBody.childSchoolName),
        grade: trim(parsedBody.childGrade),
        photo: photoUrl || null,
      },
      guardian: {
        primaryGuardianName: trim(parsedBody.guardianPrimaryGuardianName),
        relationshipToChild: trim(parsedBody.guardianRelationshipToChild),
        otherRelationship: trim(parsedBody.guardianOtherRelationship) || "",
        email: trim(parsedBody.guardianEmail),
        phone: trim(parsedBody.guardianPhone),
        address: trim(parsedBody.guardianAddress),
      },
      courseDetails: {
        courseName: trim(parsedBody.courseName),
        levelEnrolled: trim(parsedBody.courseLevelEnrolled),
        weekdays: toArray(parsedBody.courseWeekdays),
        weekend: toArray(parsedBody.courseWeekend),
        timings: handleTimings(parsedBody.courseTimings || parsedBody.selectedTiming),
        fees: String(parsedBody.courseFees).replace(/[^0-9.]/g, ""),
        feeType: toArray(parsedBody.feeType || parsedBody.courseFeeType),
        withMaterials: toBoolean(parsedBody.withMaterials),
        paymentMethod: paymentMethod,
      },
      emergencyContact: {
        fullName: trim(parsedBody.emergencyContactFullName),
        relationship: trim(parsedBody.emergencyContactRelationship),
        phone: trim(parsedBody.emergencyContactPhone),
      },
      declarationDate: trim(parsedBody.declarationDate) || new Date().toISOString().split('T')[0],
      paymentDetails: {
        paymentId: `OFFLINE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        paymentStatus: parsedBody.paymentStatus || 'completed',
        paymentDate: new Date(),
        amount: String(parsedBody.courseFees).replace(/[^0-9.]/g, ""),
      },
      status: registrationStatus
    };

    console.log('Creating offline registration with data:', JSON.stringify(registrationData, null, 2));

    // Create the registration in database
    const newRegistration = await Registration.create(registrationData);

    console.log('Offline registration created successfully:', newRegistration.registrationNo);

    // Send confirmation email if status is active
    if (registrationStatus === 'active') {
      sendRegistrationConfirmationEmail(
        newRegistration.toObject(), 
        {
          paymentId: registrationData.paymentDetails.paymentId,
          paymentDate: new Date(),
          amount: registrationData.courseDetails.fees,
          paymentMethod: paymentMethod
        }
      ).then(emailResult => {
        if (emailResult.success) {
          console.log('✅ Offline registration confirmation email sent successfully to:', emailResult.recipient);
        } else {
          console.warn('⚠️ Email sending failed for offline registration:', emailResult.error);
        }
      }).catch(emailError => {
        console.error('❌ Email sending error for offline registration (non-critical):', emailError);
      });
    }

    res.status(201).json({
      success: true,
      message: `Offline registration created successfully (${registrationStatus})`,
      data: newRegistration,
      registrationNo: newRegistration.registrationNo,
      photoUploaded: !!photoUrl,
      paymentMethod: paymentMethod,
      status: registrationStatus
    });

  } catch (err) {
    console.error("Create Offline Registration Error:", err);

    // Clean up file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('File cleanup failed on error:', cleanupError.message);
      }
    }

    // Handle duplicate registration number error
    if (err.code === 11000 && err.keyPattern && err.keyPattern.registrationNo) {
      return res.status(400).json({
        success: false,
        error: "Duplicate registration number",
        message: "A registration with this number already exists. Please try again."
      });
    }

    // Handle validation errors
    if (err.name === "ValidationError") {
      const errorMessages = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
      }));

      return res.status(400).json({
        success: false,
        error: "Registration validation failed",
        details: errorMessages
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create offline registration",
      details: err.message
    });
  }
};

// Validate offline registration (without payment validation)
exports.validateOfflineRegistration = async (req, res) => {
  try {
    console.log('Offline validation request received - Body keys:', Object.keys(req.body));
    console.log('File received:', req.file ? `Yes - ${req.file.originalname}` : 'No');

    const parsedBody = { ...req.body };

    // Parse array fields if they are sent as strings
    if (parsedBody.courseWeekdays && typeof parsedBody.courseWeekdays === 'string') {
      try {
        parsedBody.courseWeekdays = JSON.parse(parsedBody.courseWeekdays);
      } catch (e) {
        parsedBody.courseWeekdays = toArray(parsedBody.courseWeekdays);
      }
    }
    
    if (parsedBody.courseWeekend && typeof parsedBody.courseWeekend === 'string') {
      try {
        parsedBody.courseWeekend = JSON.parse(parsedBody.courseWeekend);
      } catch (e) {
        parsedBody.courseWeekend = toArray(parsedBody.courseWeekend);
      }
    }

    // Parse feeType field
    if (parsedBody.feeType && typeof parsedBody.feeType === 'string') {
      try {
        parsedBody.feeType = JSON.parse(parsedBody.feeType);
      } catch (e) {
        parsedBody.feeType = toArray(parsedBody.feeType);
      }
    }

    // Parse withMaterials field
    if (parsedBody.withMaterials !== undefined && parsedBody.withMaterials !== null) {
      parsedBody.withMaterials = toBoolean(parsedBody.withMaterials);
    }

    // Validate required fields (but not payment related)
    const validationErrors = [];
    
    // Child Information Validation
    if (!trim(parsedBody.childFullName)) validationErrors.push("Child full name is required");
    if (!trim(parsedBody.childDateOfBirth)) validationErrors.push("Child date of birth is required");
    
    const age = parsedBody.childAge ? Number(parsedBody.childAge) : null;
    if (!age || age < 3 || age > 16) validationErrors.push("Child age must be between 3 and 16 years");
    
    if (!trim(parsedBody.childGender)) validationErrors.push("Child gender is required");
    if (!trim(parsedBody.childSchoolName)) validationErrors.push("School name is required");
    if (!trim(parsedBody.childGrade)) validationErrors.push("Grade is required");

    // Guardian Information Validation
    if (!trim(parsedBody.guardianPrimaryGuardianName)) validationErrors.push("Guardian name is required");
    if (!trim(parsedBody.guardianRelationshipToChild)) validationErrors.push("Relationship to child is required");
    
    if (!trim(parsedBody.guardianEmail)) {
      validationErrors.push("Email is required");
    } else if (!/\S+@\S+\.\S+/.test(trim(parsedBody.guardianEmail))) {
      validationErrors.push("Email format is invalid");
    }
    
    if (!trim(parsedBody.guardianPhone)) {
      validationErrors.push("Phone number is required");
    } else if (!/^\d{10}$/.test(trim(parsedBody.guardianPhone).replace(/\D/g, ''))) {
      validationErrors.push("Phone number must be 10 digits");
    }
    
    if (!trim(parsedBody.guardianAddress)) validationErrors.push("Address is required");

    // Course Details Validation
    if (!trim(parsedBody.courseName)) validationErrors.push("Course selection is required");
    if (!trim(parsedBody.courseLevelEnrolled)) validationErrors.push("Level selection is required");
    if (!trim(parsedBody.selectedTiming)) validationErrors.push("Please select a timing slot");
    
    const fees = parsedBody.courseFees ? parseFloat(parsedBody.courseFees) : null;
    if (!fees || fees <= 0) validationErrors.push("Valid course fee is required");

    // Fee Type Validation
    const feeType = parsedBody.feeType || parsedBody.courseFeeType;
    if (!feeType) {
      validationErrors.push("Fee type is required");
    }

    // With Materials Validation
    if (parsedBody.withMaterials === undefined || parsedBody.withMaterials === null || parsedBody.withMaterials === '') {
      validationErrors.push("Please specify if materials are included");
    }

    // Emergency Contact Validation
    if (!trim(parsedBody.emergencyContactFullName)) validationErrors.push("Emergency contact name is required");
    if (!trim(parsedBody.emergencyContactRelationship)) validationErrors.push("Emergency contact relationship is required");
    
    if (!trim(parsedBody.emergencyContactPhone)) {
      validationErrors.push("Emergency phone is required");
    } else if (!/^\d{10}$/.test(trim(parsedBody.emergencyContactPhone).replace(/\D/g, ''))) {
      validationErrors.push("Emergency phone must be 10 digits");
    }

    // Image validation (optional)
    const imageErrors = validateImage(req.file);
    validationErrors.push(...imageErrors);

    // Clean up uploaded file after validation
    if (req.file) {
      try {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('Temporary file cleaned up after offline validation');
        }
      } catch (cleanupError) {
        console.warn('File cleanup warning:', cleanupError.message);
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
        message: "Please fix the errors before creating offline registration"
      });
    }

    // Prepare preview data
    const previewData = {
      registrationDate: trim(parsedBody.registrationDate) || new Date().toISOString().split('T')[0],
      child: {
        fullName: trim(parsedBody.childFullName),
        dateOfBirth: trim(parsedBody.childDateOfBirth),
        age: Number(parsedBody.childAge),
        gender: trim(parsedBody.childGender),
        schoolName: trim(parsedBody.childSchoolName),
        grade: trim(parsedBody.childGrade),
      },
      guardian: {
        primaryGuardianName: trim(parsedBody.guardianPrimaryGuardianName),
        relationshipToChild: trim(parsedBody.guardianRelationshipToChild),
        otherRelationship: trim(parsedBody.guardianOtherRelationship) || "",
        email: trim(parsedBody.guardianEmail),
        phone: trim(parsedBody.guardianPhone),
        address: trim(parsedBody.guardianAddress),
      },
      courseDetails: {
        courseName: trim(parsedBody.courseName),
        levelEnrolled: trim(parsedBody.courseLevelEnrolled),
        weekdays: toArray(parsedBody.courseWeekdays),
        weekend: toArray(parsedBody.courseWeekend),
        timings: handleTimings(parsedBody.courseTimings || parsedBody.selectedTiming),
        fees: String(parsedBody.courseFees).replace(/[^0-9.]/g, ""),
        feeType: toArray(parsedBody.feeType || parsedBody.courseFeeType),
        withMaterials: toBoolean(parsedBody.withMaterials),
        paymentMethod: trim(parsedBody.paymentMethod) || 'Cash',
      },
      emergencyContact: {
        fullName: trim(parsedBody.emergencyContactFullName),
        relationship: trim(parsedBody.emergencyContactRelationship),
        phone: trim(parsedBody.emergencyContactPhone),
      },
      declarationDate: trim(parsedBody.declarationDate) || new Date().toISOString().split('T')[0],
      status: parsedBody.paymentStatus === 'pending' ? 'pending' : 'active'
    };

    const response = {
      success: true,
      message: "Offline registration validated successfully",
      data: {
        registrationPreview: previewData,
        imageValidated: !!req.file,
        paymentMethod: trim(parsedBody.paymentMethod) || 'Cash',
        paymentStatus: parsedBody.paymentStatus || 'completed'
      }
    };

    console.log('Offline validation successful');
    
    res.status(200).json(response);

  } catch (err) {
    console.error("Offline Validation Error:", err);
    
    // Clean up file on error
    if (req.file) {
      try {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.warn('File cleanup failed on error:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: "Offline validation failed due to server error",
      details: err.message
    });
  }
};