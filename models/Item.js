const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collectionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    category: { type: String },
    year: { type: String },
    condition: { type: String },
    isForSale: { type: Boolean, default: false },
    price: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);
