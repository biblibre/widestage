var mongoose = require('mongoose');

var datasourceSchema = new mongoose.Schema({
    companyID: { type: String, required: false, default: 'COMPID' },
    connection: {
        database: String,
        host: String,
        password: String,
        port: String,
        userName: String,
        search_path: String, // Only for PostgreSQL
    },
    createdBy: { type: String },
    createdOn: { type: Date, default: Date.now },
    name: { type: String, required: true },
    status: { type: Number, required: true, default: 1 }, // 0 not active, 1 active
    type: { type: String, required: true },
});

module.exports = mongoose.model('Datasource', datasourceSchema);
