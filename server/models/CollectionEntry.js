import mongoose from 'mongoose';

const collectionEntrySchema = new mongoose.Schema({
  accountMobile: { type: String, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  type: { type: String, enum: ['daily', 'monthly'], required: true, default: 'daily' },
  autoExpected: { type: Number, min: 0, default: 0 },
  autoReceived: { type: Number, min: 0, default: 0 },
  loanExpected: { type: Number, min: 0, default: 0 },
  loanReceived: { type: Number, min: 0, default: 0 },
  monthlyExpected: { type: Number, min: 0, default: 0 },
  monthlyReceived: { type: Number, min: 0, default: 0 },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true, versionKey: false });

// One daily collection and one monthly payment record per date. Saving again for the same
// date/type updates that record rather than accidentally counting the same day twice.
collectionEntrySchema.index({ accountMobile: 1, date: 1, type: 1 }, { unique: true });

export default mongoose.model('CollectionEntry', collectionEntrySchema);
