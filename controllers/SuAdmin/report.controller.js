const EnterpriseModel = require('../../models/enterprise.model');
const EnterpriseStateModel = require('../../models/enterprise_state.model');
const EnterpriseStateLocationModel = require('../../models/enterprise_state_location.model');
const GatewayLogModel = require('../../models/GatewayLog.model');
const GatewayModel = require('../../models/gateway.model');
const OptimizerModel = require('../../models/optimizer.model');
const OptimizerLogModel = require('../../models/OptimizerLog.model');
const StateModel = require('../../models/state.model');
const { parse } = require('json2csv');
const istToTimestamp = require('../../utility/TimeStamp');

const UtilInter = require('../../utility/Interval');
const UtilDown = require('../../utility/Download');
const fs = require('fs');
const INTERVAL_ARRAY = {
    "Actual": '--',
    "15s": 15,
    "30s": 30,
    "1m": 60,
    "5m": 5 * 60,
    "10m": 10 * 60,
    "15m": 15 * 60,
    "30m": 30 * 60,
    "1h": 60 * 60,
    "2h": 2 * 60 * 60,
    "4h": 4 * 60 * 60,
    "8h": 8 * 60 * 60,
    "12h": 12 * 60 * 60
};


// AllDeviceData report
exports.AllDeviceData = async (req, res) => {
    const { enterprise_id, state_id, location_id, gateway_id, startDate, endDate, Interval } = req.body;
    const { page, pageSize } = req.query;
    const INTERVAL_IN_SEC = INTERVAL_ARRAY[Interval];
    // console.log({ enterprise_id, state_id, location_id, gateway_id, startDate, endDate, page, pageSize, Interval, param: req.params, INTERVAL_IN_SEC });

    try {
        // Validate the mandatory filters
        // if (!enterprise_id) {
        //     return res.status(400).json({ success: false, message: "Missing required field: Customer", key: "customer" });
        // }
        // if (!(startDate & endDate)) {
        //     return res.status(400).json({ success: false, message: "Missing required field: Date Range", key: "date" });
        // }

        // const startUtcTimestamp = new Date(startDate).getTime() / 1000;
        // const endUtcTimestamp = new Date(endDate).getTime() / 1000;

        const startIstTimestamp = istToTimestamp(startDate) / 1000;
        const endIstTimestamp = istToTimestamp(endDate) / 1000;

        const istOffsetSeconds = 5.5 * 60 * 60; // Offset for IST in seconds
        // Adjust timestamps for IST
        const startIstTimestampUTC = startIstTimestamp - istOffsetSeconds;
        const endIstTimestampUTC = endIstTimestamp - istOffsetSeconds;

        const validatedPage = Math.max(1, parseInt(page, 10)) || 1;
        const validatedPageSize = Math.max(1, parseInt(pageSize, 10)) || 10;
        const skip = (validatedPage - 1) * validatedPageSize;

        const Enterprise = await EnterpriseModel.findOne({ _id: enterprise_id });
        const enterpriseStateQuery = state_id ? { Enterprise_ID: Enterprise._id, State_ID: state_id } : { Enterprise_ID: Enterprise._id };

        const EntStates = await EnterpriseStateModel.find(enterpriseStateQuery);

        const responseData = [{
            EnterpriseName: Enterprise.EnterpriseName,
            State: [],
        }];

        let totalResults; // Initialize total count



        for (const State of EntStates) {
            const Location = await EnterpriseStateLocationModel.find(location_id ? { _id: location_id } : { Enterprise_ID: State.Enterprise_ID, State_ID: State.State_ID });
            const state = await StateModel.findOne({ _id: State.State_ID });

            if (Location.length > 0) {
                const stateData = {
                    stateName: state.name,
                    state_ID: state._id,
                    location: []
                };

                for (const loc of Location) {
                    const gatewayQuery = gateway_id ? { GatewayID: gateway_id } : { EnterpriseInfo: loc._id };
                    const Gateways = await GatewayModel.find(gatewayQuery);
                    const locationData = {
                        locationName: loc.LocationName,
                        location_ID: loc._id,
                        gateway: []
                    };

                    for (const gateway of Gateways) {
                        const Optimizers = await OptimizerModel.find({ GatewayId: gateway._id });

                        const gatewayData = {
                            GatewayName: gateway.GatewayID,
                            Gateway_ID: gateway._id,
                            optimizer: []
                        };

                        // Object to store optimizer logs grouped by timestamp
                        const groupedOptimizerLogs = {};

                        for (const optimizer of Optimizers) {
                            const query = {
                                OptimizerID: optimizer._id,
                                TimeStamp: { $gte: startIstTimestampUTC, $lte: endIstTimestampUTC },
                            };

                            const OptimizerLogs = await OptimizerLogModel.find(query)
                                .populate({
                                    path: "OptimizerID",
                                    OptimizerModel: "Optimizer",
                                    options: { lean: true }
                                })
                                .sort({ TimeStamp: 1 })
                                .skip(skip)
                                .limit(pageSize)
                                .lean();

                            // Group optimizer logs based on their timestamps
                            for (const optimizerLog of OptimizerLogs) {
                                const timestamp = optimizerLog.TimeStamp;
                                if (!groupedOptimizerLogs[timestamp]) {
                                    groupedOptimizerLogs[timestamp] = [];
                                }
                                groupedOptimizerLogs[timestamp].push(optimizerLog);
                            }

                            // Increment totalCount for each optimizer log
                            totalResults = await OptimizerLogModel.countDocuments({
                                OptimizerID: optimizer._id,
                                TimeStamp: { $gte: startIstTimestampUTC, $lte: endIstTimestampUTC },
                            });
                        }

                        // Create optimizer data for each unique timestamp and push grouped logs into it
                        for (const timestamp in groupedOptimizerLogs) {
                            const optimizerLogsForTimestamp = groupedOptimizerLogs[timestamp];
                            const optimizerData = {
                                timestamp: timestamp,
                                optimizerLogs: optimizerLogsForTimestamp
                            };
                            gatewayData.optimizer.push(optimizerData);
                        }

                        locationData.gateway.push(gatewayData);
                    }

                    stateData.location.push(locationData);
                }

                responseData[0].State.push(stateData);
            }
        }

        if (INTERVAL_IN_SEC != '--') {
            const NewResponseData = await UtilInter.DeviceData(INTERVAL_IN_SEC, {
                success: true,
                message: "Data fetched successfully",
                response: responseData
            });
            // return console.log({NewResponseData});

            return res.send({
                success: true,
                message: "Data fetched successfully",
                data: NewResponseData.data,
                pagination: {
                    page: validatedPage,
                    pageSize: validatedPageSize,
                    totalResults: totalResults,
                },
            });
        }
        // console.log({ responseData });
        return res.send({
            success: true,
            message: "Data fetched successfully",
            data: responseData,
            pagination: {
                page: validatedPage,
                pageSize: validatedPageSize,
                totalResults: totalResults
            },
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', err: error.message });
    }
};


// AllMeterData report
exports.AllMeterData = async (req, res) => {
    // return console.log(JSON.stringify(req.query.flag));
    try {
        const { Customer, Stateid, Locationid, Gatewayid, startDate, endDate, Interval, FirstRef, LastRef } = req.body;
        const { page, flag, PrevTimeStamp } = req.query;
        let pageSize = 100;
        if (Interval == '12h') {
            pageSize = 5000000;
        }else if(Interval == '8h'){
            pageSize = 100000;

        }else if(Interval == '4h'){
            pageSize = 50000;

        }else if(Interval == '2h'){
            pageSize = 10000;

        }else if(Interval == '1h'){
            pageSize = 5000;

        }else if(Interval == '30m'){
            pageSize = 1000;

        }
        // console.log(req.query);
        // console.log(req.body);
        // const pageSize = 200;
        // console.log({ FirstRef, LastRef });
        const INTERVAL_IN_SEC = INTERVAL_ARRAY[Interval];


        const startIstTimestamp = istToTimestamp(startDate) / 1000;
        const endIstTimestamp = istToTimestamp(endDate) / 1000;

        const istOffsetSeconds = 5.5 * 60 * 60; // Offset for IST in seconds
        // Adjust timestamps for IST
        let startIstTimestampUTC;

        startIstTimestampUTC = startIstTimestamp - istOffsetSeconds;
        const endIstTimestampUTC = endIstTimestamp - istOffsetSeconds;
        const countPoint = startIstTimestamp - istOffsetSeconds;
        // Validate page and pageSize parameters
        let validatedPage = Math.max(1, parseInt(page, 10)) || 1;
        let validatedPageSize;
        validatedPageSize = Math.max(1, parseInt(pageSize, 10)) || 100;
        // Pagination
        let skip = (validatedPage - 1) * validatedPageSize;

        console.log({
            startIstTimestampUTC: { unix: startIstTimestampUTC, humanReadable: new Date(startIstTimestampUTC * 1000).toLocaleString() },
            endIstTimestampUTC: { unix: endIstTimestampUTC, humanReadable: new Date(endIstTimestampUTC * 1000).toLocaleString() },
            FirstRef: { unix: FirstRef, humanReadable: new Date(FirstRef * 1000).toLocaleString() },
            LastRef: { unix: LastRef, humanReadable: new Date(LastRef * 1000).toLocaleString() },
            query: req.query,
            // body: req.body,
            current_interval: req.body.current_interval,
            interval: Interval,
            skip
        });

        let pageWiseTimestamp = {};
        let pageReset = false;
        if (page > 1 && INTERVAL_IN_SEC != '--' && req.body.current_interval == Interval) {
            // pageWiseTimestamp[page - 1] = FirstRef;
            // pageWiseTimestamp['interval'] = Interval;
            pageWiseTimestamp.interval = Interval; // Assuming Interval is defined elsewhere
            pageWiseTimestamp.page = {};

            pageWiseTimestamp.page[page - 1] = FirstRef;

            // console.log("LastRef condi......");
            if (flag == "Prev") {
                startIstTimestampUTC = PrevTimeStamp
            } else {
                startIstTimestampUTC = LastRef;
            }
            skip = 0;
        } else if (req.body.current_interval != Interval && INTERVAL_IN_SEC != '--') {
            // req.body.current_interval != Interval
            startIstTimestampUTC = startIstTimestamp - istOffsetSeconds;
            pageReset = true;
            skip = 0;
        }
        // console.log({
        //     AFTER_startIstTimestampUTC: { unix: startIstTimestampUTC, humanReadable: new Date(startIstTimestampUTC * 1000).toLocaleString() },
        //     pageWiseTimestamp,
        //     query: req.query
        // });


        // Fetch Enterprise data
        const enterprise = await EnterpriseModel.findOne({ _id: Customer });
        if (!enterprise) {
            return res.status(404).json({
                success: false,
                message: "This enterprise is not available",
            });
        } else if (!startDate || !endDate) {
            return res.status(404).json({
                success: false,
                message: "Please provide Start and End Date and time ",
            });
        }



        // Aggregation Pipeline
        let aggregationPipeline = [];
        const enterpriseStateQuery = Stateid ? { Enterprise_ID: enterprise._id, State_ID: Stateid } : { Enterprise_ID: enterprise._id };

        const EntStates = await EnterpriseStateModel.find(enterpriseStateQuery);

        const responseData = [];

        let totalResults;

        for (const States of EntStates) {
            const locationQuery = Locationid ? { _id: Locationid } : { Enterprise_ID: States.Enterprise_ID, State_ID: States.State_ID };
            const Location = await EnterpriseStateLocationModel.find(locationQuery);

            const state = await StateModel.findOne({ _id: States.State_ID });

            if (Location.length > 0) {

                const stateData = {
                    EnterpriseName: enterprise.EnterpriseName,
                    State: [
                        {
                            stateName: state.name,
                            state_ID: state._id,
                            location: []
                        }
                    ]
                };
                for (const loc of Location) {
                    const gatewayQuery = Gatewayid ? { _id: Gatewayid } : { EnterpriseInfo: loc._id };
                    const GatewayData = await GatewayModel.find(gatewayQuery);
                    const locationData = {
                        locationName: loc.LocationName,
                        location_ID: loc._id,
                        gateway: []
                    };

                    for (const gateway of GatewayData) {
                        let GatewayLogData = await GatewayLogModel
                            .find({
                                GatewayID: gateway._id,
                                TimeStamp: { $gte: startIstTimestampUTC, $lte: endIstTimestampUTC },
                            })
                            .sort({ TimeStamp: 1 })
                            .skip(skip)
                            .limit(validatedPageSize);

                        totalResults = await GatewayLogModel.countDocuments({
                            GatewayID: gateway._id,
                            TimeStamp: { $gte: countPoint, $lte: endIstTimestampUTC },
                        });

                        if (GatewayLogData.length > 0) {
                            locationData.gateway.push({
                                GatewayName: gateway.GatewayID,
                                Gateway_ID: gateway._id,
                                GatewayLogs: GatewayLogData
                            });
                        }
                    }
                    stateData.State[0].location.push(locationData);
                }

                responseData.push(stateData);
            }
        }


        if (INTERVAL_IN_SEC != '--') {
            const NewResponseData = await UtilInter.MeterData(INTERVAL_IN_SEC, {
                success: true,
                message: "Data fetched successfully",
                response: responseData
            });
            // console.log(responseData);
            return res.send({
                success: true,
                message: "Data fetched successfully",
                response: NewResponseData.response,
                pagination: {
                    page: validatedPage,
                    pageSize: validatedPageSize,
                    totalResults: totalResults,
                },
                pageWiseTimestamp,
                flag,
                current_interval: Interval,
                pageReset
            });
        }

        return res.send({
            success: true,
            message: "Data fetched successfully",
            response: responseData,
            pagination: {
                page: validatedPage,
                pageSize: validatedPageSize,
                totalResults: totalResults,
            },
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        return res.status(500).json({ success: false, message: "Internal server error", err: error });
    }
};


/******************************* R E P O R T  D O W N L O A D *********************************/
// DownloadDeviceDataReport
exports.DownloadDeviceDataReport = async (req, res) => {
    // return console.log("hiiii");
    try {
        const { enterprise_id, state_id, location_id, gateway_id, startDate, endDate, } = req.body;
        const Interval = 'Actual';
        const INTERVAL_IN_SEC = INTERVAL_ARRAY[Interval];
        // console.log({ enterprise_id, state_id, location_id, gateway_id, startDate, endDate,  Interval, INTERVAL_IN_SEC });


        const startIstTimestamp = istToTimestamp(startDate) / 1000;
        const endIstTimestamp = istToTimestamp(endDate) / 1000;

        const istOffsetSeconds = 5.5 * 60 * 60; // Offset for IST in seconds
        // Adjust timestamps for IST
        const startIstTimestampUTC = startIstTimestamp - istOffsetSeconds;
        const endIstTimestampUTC = endIstTimestamp - istOffsetSeconds;



        const Enterprise = await EnterpriseModel.findOne({ _id: enterprise_id });
        const enterpriseStateQuery = state_id ? { Enterprise_ID: Enterprise._id, State_ID: state_id } : { Enterprise_ID: Enterprise._id };

        const EntStates = await EnterpriseStateModel.find(enterpriseStateQuery);

        const responseData = [{
            EnterpriseName: Enterprise.EnterpriseName,
            State: [],
        }];

        let totalResults; // Initialize total count



        for (const State of EntStates) {
            const Location = await EnterpriseStateLocationModel.find(location_id ? { _id: location_id } : { Enterprise_ID: State.Enterprise_ID, State_ID: State.State_ID });
            const state = await StateModel.findOne({ _id: State.State_ID });

            if (Location.length > 0) {
                const stateData = {
                    stateName: state.name,
                    state_ID: state._id,
                    location: []
                };

                for (const loc of Location) {
                    const gatewayQuery = gateway_id ? { GatewayID: gateway_id } : { EnterpriseInfo: loc._id };
                    const Gateways = await GatewayModel.find(gatewayQuery);
                    const locationData = {
                        locationName: loc.LocationName,
                        location_ID: loc._id,
                        gateway: []
                    };

                    for (const gateway of Gateways) {
                        const Optimizers = await OptimizerModel.find({ GatewayId: gateway._id });

                        const gatewayData = {
                            GatewayName: gateway.GatewayID,
                            Gateway_ID: gateway._id,
                            optimizer: []
                        };

                        // Object to store optimizer logs grouped by timestamp
                        const groupedOptimizerLogs = {};

                        for (const optimizer of Optimizers) {
                            const query = {
                                OptimizerID: optimizer._id,
                                TimeStamp: { $gte: startIstTimestampUTC, $lte: endIstTimestampUTC },
                            };

                            const OptimizerLogs = await OptimizerLogModel.find(query)
                                .populate({
                                    path: "OptimizerID",
                                    OptimizerModel: "Optimizer",
                                    options: { lean: true }
                                });

                            // Group optimizer logs based on their timestamps
                            for (const optimizerLog of OptimizerLogs) {
                                const timestamp = optimizerLog.TimeStamp;
                                if (!groupedOptimizerLogs[timestamp]) {
                                    groupedOptimizerLogs[timestamp] = [];
                                }
                                groupedOptimizerLogs[timestamp].push(optimizerLog);
                            }

                            // Increment totalCount for each optimizer log
                            totalResults = await OptimizerLogModel.countDocuments({
                                OptimizerID: optimizer._id,
                                TimeStamp: { $gte: startIstTimestampUTC, $lte: endIstTimestampUTC },
                            });
                        }

                        // Create optimizer data for each unique timestamp and push grouped logs into it
                        for (const timestamp in groupedOptimizerLogs) {
                            const optimizerLogsForTimestamp = groupedOptimizerLogs[timestamp];
                            const optimizerData = {
                                timestamp: timestamp,
                                optimizerLogs: optimizerLogsForTimestamp
                            };
                            gatewayData.optimizer.push(optimizerData);
                        }

                        locationData.gateway.push(gatewayData);
                    }

                    stateData.location.push(locationData);
                }

                responseData[0].State.push(stateData);
            }
        }

        if (INTERVAL_IN_SEC != '--') {
            const NewResponseData = await UtilInter.DeviceData(INTERVAL_IN_SEC, {
                success: true,
                message: "Data fetched successfully",
                response: responseData
            });
            // return console.log({NewResponseData});
            const download = await UtilDown.DeviceDownloadCSV(NewResponseData.data, Interval);
            // Set the headers for the response
            const filename = `file_${Interval}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);


            // Write the CSV content to the response stream
            return res.send(download);

        }
        const download = await UtilDown.DeviceDownloadCSV(responseData, Interval);
        // Set the headers for the response
        const filename = `file_${Interval}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write the CSV content to the response stream
        return res.send(download);


    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', err: error.message });
    }
};

// DownloadMeterDataReport
exports.DownloadMeterDataReport = async (req, res) => {
    //console.log("_____________");
    console.log(req.body);
    try {
        const { Customer, Stateid, Locationid, Gatewayid, startDate, endDate, Interval } = req.body;
        // const Interval = "Actual";
        const INTERVAL_IN_SEC = INTERVAL_ARRAY[Interval];

        const startIstTimestamp = istToTimestamp(startDate) / 1000;
        const endIstTimestamp = istToTimestamp(endDate) / 1000;

        const istOffsetSeconds = 5.5 * 60 * 60; // Offset for IST in seconds
        // Adjust timestamps for IST
        const startIstTimestampUTC = startIstTimestamp - istOffsetSeconds;
        const endIstTimestampUTC = endIstTimestamp - istOffsetSeconds;

        // Fetch Enterprise data
        const enterprise = await EnterpriseModel.findOne({ _id: Customer });
        if (!enterprise) {
            return res.status(404).json({
                success: false,
                message: "This enterprise is not available",
            });
        } else if (!startDate || !endDate) {
            return res.status(404).json({
                success: false,
                message: "Please provide Start and End Date and time ",
            });
        }

        console.log({
            startIstTimestampUTC: { unix: startIstTimestampUTC, humanReadable: new Date(startIstTimestampUTC * 1000).toLocaleString() },
            endIstTimestampUTC: { unix: endIstTimestampUTC, humanReadable: new Date(endIstTimestampUTC * 1000).toLocaleString() }
        });

        // Aggregation Pipeline
        let aggregationPipeline = [];
        const enterpriseStateQuery = Stateid ? { Enterprise_ID: enterprise._id, State_ID: Stateid } : { Enterprise_ID: enterprise._id };

        const EntStates = await EnterpriseStateModel.find(enterpriseStateQuery);

        const responseData = [];


        for (const States of EntStates) {
            const locationQuery = Locationid ? { _id: Locationid } : { Enterprise_ID: States.Enterprise_ID, State_ID: States.State_ID };
            const Location = await EnterpriseStateLocationModel.find(locationQuery);

            const state = await StateModel.findOne({ _id: States.State_ID });

            if (Location.length > 0) {

                const stateData = {
                    EnterpriseName: enterprise.EnterpriseName,
                    State: [
                        {
                            stateName: state.name,
                            state_ID: state._id,
                            location: []
                        }
                    ]
                };

                for (const loc of Location) {
                    const gatewayQuery = Gatewayid ? { _id: Gatewayid } : { EnterpriseInfo: loc._id };
                    const GatewayData = await GatewayModel.find(gatewayQuery);
                    const locationData = {
                        locationName: loc.LocationName,
                        location_ID: loc._id,
                        gateway: []
                    };

                    for (const gateway of GatewayData) {
                        let GatewayLogData = await GatewayLogModel
                            .find({
                                GatewayID: gateway._id,
                                TimeStamp: { $gte: startIstTimestampUTC, $lte: endIstTimestampUTC },
                            });
                        // console.log(GatewayLogData);

                        if (GatewayLogData.length > 0) {
                            locationData.gateway.push({
                                GatewayName: gateway.GatewayID,
                                Gateway_ID: gateway._id,
                                GatewayLogs: GatewayLogData
                            });
                        }
                    }

                    stateData.State[0].location.push(locationData);
                }

                responseData.push(stateData);
            }
        }


        if (INTERVAL_IN_SEC != '--') {
            const NewResponseData = await UtilInter.MeterData(INTERVAL_IN_SEC, {
                success: true,
                message: "Data fetched successfully",
                response: responseData
            });
            const download = await UtilDown.MeterDownloadCSV(NewResponseData.response, Interval);
            // console.log("INTERVAL", download);
            // return res.send(download);
            // Set the headers for the response
            const filename = `file_${Interval}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);


            // Write the CSV content to the response stream
            return res.send(download);

        }

        const download = await UtilDown.MeterDownloadCSV(responseData, Interval);
        // console.log("Actual", download);
        // return res.send(download);
        // Set the headers for the response
        const filename = `file_${Interval}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write the CSV content to the response stream
        return res.send(download);
    } catch (error) {
        console.error("Error fetching data:", error);
        return res.status(500).json({ success: false, message: "Internal server error", err: error });
    }
};





/********************** NOT IN USE************************/
// AllDataLogDemo
exports.AllDataLogDemo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const skip = (page - 1) * pageSize;

        const pipeline = [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: pageSize },
            {
                $lookup: {
                    from: 'optimizerlogs',
                    localField: '_id',
                    foreignField: 'GatewayLogID',
                    as: 'OptimizerLogDetails'
                }
            },
            {
                $lookup: {
                    from: 'gateways',
                    localField: 'GatewayID',
                    foreignField: '_id',
                    as: 'GatewayDetails'
                }
            },
            {
                $lookup: {
                    from: 'optimizers',
                    localField: 'OptimizerLogDetails.OptimizerID',
                    foreignField: '_id',
                    as: 'OptimizerDetails'
                }
            },
            {
                $project: {
                    _id: 1,
                    GatewayID: { $arrayElemAt: ['$GatewayDetails.GatewayID', 0] },
                    TimeStamp: {
                        $dateToString: {
                            format: "%Y-%m-%d %H:%M:%S GMT%z", // Format the date without %I for 24-hour clock
                            date: {
                                $toDate: {
                                    $multiply: [
                                        { $toDouble: "$TimeStamp" }, // Convert to numeric type
                                        1000
                                    ]
                                }
                            },
                            timezone: "+05:30" // Set your desired timezone
                        }
                    },
                    Phases: 1,
                    KVAH: 1,
                    KWH: 1,
                    PF: 1,
                    isDelete: 1,
                    OptimizerLogDetails: {
                        $map: {
                            input: '$OptimizerLogDetails',
                            as: 'optimizer',
                            in: {
                                OptimizerID: {
                                    $ifNull: [
                                        { $ifNull: [{ $arrayElemAt: ['$OptimizerDetails.OptimizerID', 0] }, '$$optimizer.OptimizerID'] },
                                        null
                                    ]
                                },
                                GatewayID: { $arrayElemAt: ['$GatewayDetails.GatewayID', 0] },
                                GatewayLogID: '$$optimizer.GatewayLogID',
                                RoomTemperature: '$$optimizer.RoomTemperature',
                                Humidity: '$$optimizer.Humidity',
                                CoilTemperature: '$$optimizer.CoilTemperature',
                                OptimizerMode: '$$optimizer.OptimizerMode',
                                isDelete: '$$optimizer.isDelete',
                                OptimizerDetails: '$$optimizer.OptimizerDetails'
                            }
                        }
                    }
                }
            }
        ];

        const allData = await GatewayLogModel.aggregate(pipeline);

        return res.status(200).json({ success: true, message: 'Data fetched successfully', data: allData });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error', err: error.message });
    }
};


exports.PaginationData = async (req, res) => {
    try {
        const { page, pageSize } = req.query;
        console.log({ page, pageSize });

        // Validate page and pageSize parameters
        const validatedPage = Math.max(1, parseInt(page, 10)) || 1;
        const validatedPageSize = Math.max(1, parseInt(pageSize, 10)) || 100;
        console.log({ validatedPage, validatedPageSize });

        // Pagination
        const skip = (validatedPage - 1) * validatedPageSize;



        let GatewayLogData = await GatewayLogModel
            .find({})
            .sort({ TimeStamp: 1 })
            .skip(skip)
            .limit(validatedPageSize);
        const totalResults = await GatewayLogModel.countDocuments({});

        return res.send({
            success: true,
            message: "Data fetched successfully",
            response: GatewayLogData,
            pagination: {
                page: validatedPage,
                pageSize: validatedPageSize,
                totalResults: totalResults,
            },
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        return res.status(500).json({ success: false, message: "Internal server error", err: error });
    }
};