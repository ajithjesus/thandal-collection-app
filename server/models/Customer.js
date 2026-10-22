import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
    accountMobile: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    mobileNumber: { type: String, required: true },
}, { timestamps: true, versionKey: false });

customerSchema.index({ accountMobile: 1, mobileNumber: 1 }, { unique: true });

export default mongoose.model('Customer', customerSchema);