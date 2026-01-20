const SpecialCourse = require('../models/SpecialCourse.model');
const SpecialCoursePayment = require('../models/SpecialCoursePayment.model');
const emailService = require('../services/email.service');
const crypto = require('crypto');

// Razorpay webhook secret from environment
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Verify webhook signature
const verifyWebhookSignature = (body, signature) => {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(body)
            .digest('hex');
        
        return expectedSignature === signature;
    } catch (error) {
        console.error('Webhook signature verification error:', error);
        return false;
    }
};

// Handle Razorpay webhooks
exports.handleWebhook = async (req, res) => {
    try {
        // Get the signature from the header
        const signature = req.headers['x-razorpay-signature'];
        
        if (!signature) {
            return res.status(400).send('No signature provided');
        }

        // Verify webhook signature
        const body = JSON.stringify(req.body);
        const isValidSignature = verifyWebhookSignature(body, signature);
        
        if (!isValidSignature) {
            console.error('Invalid webhook signature');
            return res.status(400).send('Invalid signature');
        }

        const event = req.body.event;
        const payment = req.body.payload.payment.entity;

        console.log(`📩 Webhook received: ${event}`, payment.id);

        switch (event) {
            case 'payment.authorized':
                await handlePaymentAuthorized(payment);
                break;
                
            case 'payment.captured':
                await handlePaymentCaptured(payment);
                break;
                
            case 'payment.failed':
                await handlePaymentFailed(payment);
                break;
                
            case 'payment.refunded':
                await handlePaymentRefunded(payment);
                break;
                
            default:
                console.log(`Unhandled event type: ${event}`);
        }

        // Always send 200 OK to Razorpay
        res.status(200).send('Webhook processed');

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Webhook processing failed');
    }
};

// Handle payment authorized event
const handlePaymentAuthorized = async (payment) => {
    try {
        // Find registration by order ID
        const registration = await SpecialCourse.findOne({
            'payment.razorpay_order_id': payment.order_id
        });

        if (!registration) {
            console.error('Registration not found for order:', payment.order_id);
            return;
        }

        // Update payment status
        registration.payment_status = 'pending';
        registration.payment.razorpay_payment_id = payment.id;
        await registration.save();

        // Log payment event
        await SpecialCoursePayment.create({
            registrationId: registration.registrationId,
            razorpay_payment_id: payment.id,
            razorpay_order_id: payment.order_id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: 'authorized',
            method: payment.method,
            bank: payment.bank,
            wallet: payment.wallet,
            card_id: payment.card_id,
            vpa: payment.vpa,
            webhook_data: payment
        });

        console.log(`Payment authorized: ${payment.id} for registration: ${registration.registrationId}`);

    } catch (error) {
        console.error('Handle payment authorized error:', error);
    }
};

// Handle payment captured event
const handlePaymentCaptured = async (payment) => {
    try {
        // Find registration by order ID
        const registration = await SpecialCourse.findOne({
            'payment.razorpay_order_id': payment.order_id
        });

        if (!registration) {
            console.error('Registration not found for order:', payment.order_id);
            return;
        }

        // Update registration with captured payment
        registration.payment_status = 'paid';
        registration.status = 'registered';
        registration.payment = {
            razorpay_payment_id: payment.id,
            razorpay_order_id: payment.order_id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: 'paid',
            payment_date: new Date()
        };

        await registration.save();

        // Update payment log
        await SpecialCoursePayment.findOneAndUpdate(
            { razorpay_payment_id: payment.id },
            { status: 'captured' },
            { upsert: true }
        );

        // Send confirmation email
        await emailService.sendRegistrationConfirmation(registration.email, {
            parentName: registration.parentName,
            childName: registration.childName,
            batch: registration.selectedBatch,
            registrationId: registration.registrationId,
            paymentId: payment.id,
            amount: payment.amount / 100
        });

        // Send admin notification
        await emailService.sendAdminNotification(registration);

        console.log(`Payment captured: ${payment.id} for registration: ${registration.registrationId}`);

    } catch (error) {
        console.error('Handle payment captured error:', error);
    }
};

// Handle payment failed event
const handlePaymentFailed = async (payment) => {
    try {
        // Find registration by order ID
        const registration = await SpecialCourse.findOne({
            'payment.razorpay_order_id': payment.order_id
        });

        if (!registration) {
            console.error('Registration not found for order:', payment.order_id);
            return;
        }

        // Update registration status
        registration.payment_status = 'pending';
        registration.status = 'pending_payment';
        await registration.save();

        // Log failed payment
        await SpecialCoursePayment.create({
            registrationId: registration.registrationId,
            razorpay_payment_id: payment.id,
            razorpay_order_id: payment.order_id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: 'failed',
            error_code: payment.error_code,
            error_description: payment.error_description,
            webhook_data: payment
        });

        console.log(`Payment failed: ${payment.id} for registration: ${registration.registrationId}`);

    } catch (error) {
        console.error('Handle payment failed error:', error);
    }
};

// Handle payment refunded event
const handlePaymentRefunded = async (payment) => {
    try {
        // Find registration by payment ID
        const registration = await SpecialCourse.findOne({
            'payment.razorpay_payment_id': payment.id
        });

        if (!registration) {
            console.error('Registration not found for payment:', payment.id);
            return;
        }

        // Update registration status
        registration.status = 'refunded';
        registration.payment.status = 'refunded';
        await registration.save();

        // Update payment log
        await SpecialCoursePayment.findOneAndUpdate(
            { razorpay_payment_id: payment.id },
            { status: 'refunded' },
            { upsert: true }
        );

        console.log(`Payment refunded: ${payment.id} for registration: ${registration.registrationId}`);

    } catch (error) {
        console.error('Handle payment refunded error:', error);
    }
};