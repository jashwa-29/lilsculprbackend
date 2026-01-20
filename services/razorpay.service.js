const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
    constructor() {
        this.instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }

    // Create a new order
    async createOrder(amount, currency = 'INR', receipt = null) {
        try {
            const options = {
                amount: amount * 100, // Convert to paise
                currency,
                receipt: receipt || `receipt_${Date.now()}`,
                payment_capture: 1 // Auto capture
            };

            const order = await this.instance.orders.create(options);
            return {
                success: true,
                order_id: order.id,
                amount: order.amount,
                currency: order.currency
            };
        } catch (error) {
            console.error('Razorpay order creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Verify payment signature
    verifyPaymentSignature(orderId, paymentId, signature) {
        try {
            const body = orderId + "|" + paymentId;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');
            
            return expectedSignature === signature;
        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    }

    // Fetch payment details
    async fetchPayment(paymentId) {
        try {
            const payment = await this.instance.payments.fetch(paymentId);
            return {
                success: true,
                payment
            };
        } catch (error) {
            console.error('Fetch payment error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Refund payment
    async refundPayment(paymentId, amount = null) {
        try {
            const options = {};
            if (amount) {
                options.amount = amount * 100;
            }

            const refund = await this.instance.payments.refund(paymentId, options);
            return {
                success: true,
                refund
            };
        } catch (error) {
            console.error('Refund error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new RazorpayService();