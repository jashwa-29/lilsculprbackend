const SpecialCourse = require('../models/SpecialCourse.model');

// Validate registration data - FIXED VERSION WITH TIMEZONE FIX
exports.validateRegistrationData = (data) => {
    const errors = {};
    
    // Parent Information
    if (!data.parentName || data.parentName.trim() === '') {
        errors.parentName = 'Parent name is required';
    } else if (data.parentName.trim().length < 2) {
        errors.parentName = 'Parent name must be at least 2 characters';
    }
    
    // Email
    if (!data.email || data.email.trim() === '') {
        errors.email = 'Email is required';
    } else {
        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(data.email.trim())) {
            errors.email = 'Please enter a valid email address';
        }
    }
    
    // Phone
    if (!data.phone || data.phone.trim() === '') {
        errors.phone = 'Phone number is required';
    } else {
        const cleanPhone = data.phone.trim().replace(/\s+|[-+()]/g, '');
        if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
            errors.phone = 'Please enter a valid 10-digit Indian phone number';
        }
    }
    
    // Child Information
    if (!data.childName || data.childName.trim() === '') {
        errors.childName = 'Child name is required';
    } else if (data.childName.trim().length < 2) {
        errors.childName = 'Child name must be at least 2 characters';
    }
    
    if (!data.childAge || data.childAge.trim() === '') {
        errors.childAge = 'Child age is required';
    } else {
        const age = parseInt(data.childAge.trim());
        if (isNaN(age) || age < 3 || age > 16) {
            errors.childAge = 'Child age must be between 3 and 16 years';
        }
    }
    
    // Date validation - FIXED: Handle timezone properly
    if (!data.selectedDate || data.selectedDate.trim() === '') {
        errors.selectedDate = 'Please select a date';
    } else {
        const dateValidation = validateDate(data.selectedDate, data.availableDates);
        if (!dateValidation.isValid) {
            errors.selectedDate = dateValidation.error;
        }
    }
    
    // Batch validation - FIXED: Just check if batch is selected
    if (!data.selectedBatch || data.selectedBatch.trim() === '') {
        errors.selectedBatch = 'Please select a time slot';
    }
    // NOTE: We DON'T hardcode batch templates here - frontend provides valid batches
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors: errors
    };
};

// Sanitize input data
exports.sanitizeInput = (data) => {
    const sanitized = {};
    
    sanitized.parentName = (data.parentName || '').trim();
    sanitized.email = (data.email || '').toLowerCase().trim();
    sanitized.phone = (data.phone || '').trim();
    sanitized.childName = (data.childName || '').trim();
    sanitized.childAge = (data.childAge || '').trim();
    sanitized.selectedBatch = (data.selectedBatch || '').trim();
    sanitized.selectedDate = data.selectedDate || '';
    sanitized.message = (data.message || '').trim().substring(0, 500); // Limit message to 500 chars
    
    return sanitized;
};

// In validation.service.js, update the validateDate function:
const validateDate = (selectedDate, availableDates = []) => {
    try {
        if (!selectedDate) {
            return { isValid: false, error: 'Date is required' };
        }
        
        console.log(`🔍 Validating date: ${selectedDate}`);
        
        // Parse as UTC date
        const dateParts = selectedDate.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        
        // Create UTC date
        const date = new Date(Date.UTC(year, month, day));
        
        if (isNaN(date.getTime())) {
            return { isValid: false, error: 'Invalid date format' };
        }
        
        const dateStr = selectedDate; // Use original string
        
        if (availableDates && availableDates.length > 0) {
            if (!availableDates.includes(dateStr)) {
                return { 
                    isValid: false, 
                    error: `Date ${dateStr} is not available for this workshop` 
                };
            }
        }
        
        // Check if date is in the past (UTC)
        const today = new Date();
        const todayUTC = new Date(Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate()
        ));
        
        if (date < todayUTC) {
            return { isValid: false, error: 'Selected date is in the past' };
        }
        
        return { 
            isValid: true, 
            date: date, // This is UTC date
            dateString: dateStr
        };
    } catch (error) {
        console.error('❌ Date validation error:', error);
        return { isValid: false, error: 'Invalid date format' };
    }
};

// Validate date specifically - FIXED: Independent function
exports.validateDate = (dateString, availableDates = []) => {
    return validateDate(dateString, availableDates);
};

// Validate batch specifically - FIXED: Only validate format, not specific values
exports.validateBatch = (batchName) => {
    // Just check if batch has basic required format
    // Don't hardcode specific batch names
    const isValidFormat = batchName && 
                         batchName.includes('⏰');
    
    return {
        isValid: isValidFormat,
        message: isValidFormat ? 'Valid batch format' : 'Invalid batch format'
    };
};