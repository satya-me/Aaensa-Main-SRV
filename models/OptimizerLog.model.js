const mongoose = require('mongoose');
const Schema = mongoose.Schema; // Add this line to import Schema
const moment = require('moment-timezone');

const OptimizerLogSchema = new mongoose.Schema({

    OptimizerID: {
        type: Schema.Types.ObjectId,
        ref: "Optimizer",
        required: true,
        index: true // Create index on OptimizerID
    },
    GatewayID: {
        type: Schema.Types.ObjectId,
        ref: "Gateway",
        required: true
    },
    GatewayLogID: {
        type: Schema.Types.ObjectId,
        ref: "GatewayLog",
        required: true
    },
    DeviceStatus: { type: Boolean, default: false },
    TimeStamp: { type: String },
    RoomTemperature: { type: Number },
    Humidity: { type: Number },
    CoilTemperature: { type: Number },
    OptimizerMode: { type: String }, //OptimizerMode and Bypass are same.

    isDelete: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

// Create index on createdAt field
OptimizerLogSchema.index({ createdAt: -1 });

// Middleware to convert timestamps to IST before saving
OptimizerLogSchema.pre('save', function (next) {
    // Convert timestamps to IST
    this.createdAt = moment(this.createdAt).tz('Asia/Kolkata');
    this.updatedAt = moment(this.updatedAt).tz('Asia/Kolkata');
    next();
});


const OptimizerLogModel = mongoose.model('OptimizerLog', OptimizerLogSchema);

module.exports = OptimizerLogModel;