import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'primary' },
  customerName: { type: String, default: '' },
  phone: { type: String, default: '' },
  whatsappOptIn: { type: Boolean, default: false },
  loanAmount: { type: Number, min: 0, default: 800000 },
  autoDailyAmount: { type: Number, min: 0, default: 320 },
  loanDailyAmount: { type: Number, min: 0, default: 700 },
  monthlyAmount: { type: Number, min: 0, default: 15000 },
}, { timestamps: true, versionKey: false });

export default mongoose.model('Settings', settingsSchema);
