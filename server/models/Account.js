import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
    mobileNumber: { type: String, required: true, unique: true },
}, { timestamps: true, versionKey: false });

export default mongoose.model('Account', accountSchema);