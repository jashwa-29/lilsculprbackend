const FreeWorkshop = require('../models/FreeWorkshop.model');
const { sendParentConfirmationEmail, sendAdminNotificationEmail } = require('../services/freeWorkshopEmail.service');

exports.registerForWorkshop = async (req, res) => {
    try {
        const { parentName, email, phone, childName, childAge } = req.body;

        // Check if required fields are provided
        if (!parentName || !email || !phone || !childName || !childAge) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: parentName, email, phone, childName, childAge'
            });
        }

        // Check total limit
        const totalRegistrations = await FreeWorkshop.countDocuments();
        if (totalRegistrations >= 50) {
            return res.status(400).json({
                success: false,
                message: 'Sorry, the workshop is fully booked. Maximum capacity of 50 reached.'
            });
        }

        // Check if this specific child is already registered with this email or phone
        // We'll enforce that the same childName cannot be registered under the same email
        const existingRegistration = await FreeWorkshop.findOne({ 
            childName: { $regex: new RegExp('^' + childName + '$', 'i') }, 
            $or: [{ email: email.toLowerCase() }, { phone }] 
        });

        if (existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'This child is already registered for the workshop under this email or phone number.'
            });
        }

        // Create new registration
        const newRegistration = new FreeWorkshop({
            parentName,
            email,
            phone,
            childName,
            childAge,
            batchTime: '11:00 AM - 12:00 PM'
        });

        await newRegistration.save();

        // ── Fire emails (non-blocking, won't crash the response if email fails) ──
        const totalAfter = await FreeWorkshop.countDocuments();
        const slotsRemaining = Math.max(0, 50 - totalAfter);

        sendParentConfirmationEmail(newRegistration).catch(err =>
            console.error('⚠️  Parent email failed:', err.message)
        );

        sendAdminNotificationEmail(newRegistration, slotsRemaining).catch(err =>
            console.error('⚠️  Admin email failed:', err.message)
        );

        res.status(201).json({
            success: true,
            message: 'Successfully registered for the free workshop.',
            data: newRegistration
        });

    } catch (error) {
        console.error('Error registering for free workshop:', error);
        
        // Handle Mongoose duplicate key error specifically
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This child is already registered with this email address.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while registering for workshop. Please try again later.'
        });
    }
};

exports.getAllRegistrations = async (req, res) => {
    try {
        const registrations = await FreeWorkshop.find().sort({ createdAt: -1 });
        const total = await FreeWorkshop.countDocuments();

        res.status(200).json({
            success: true,
            count: total,
            data: registrations
        });
    } catch (error) {
        console.error('Error fetching workshop registrations:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching registrations.'
        });
    }
};

exports.getWorkshopSlots = async (req, res) => {
    try {
        const TOTAL_SLOTS = 50;
        const registered = await FreeWorkshop.countDocuments();
        const remaining = Math.max(0, TOTAL_SLOTS - registered);

        res.status(200).json({
            success: true,
            total: TOTAL_SLOTS,
            registered,
            remaining,
            isFull: remaining === 0
        });
    } catch (error) {
        console.error('Error fetching slot count:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching slot count.'
        });
    }
};
