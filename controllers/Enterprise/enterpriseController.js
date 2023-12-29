const EnterpriseAdminModel = require('../../models/enterprise.model');
const EnterpriseStateModel = require('../../models/enterprise_state.model');
const EnterpriseStateLocationModel = require('../../models/enterprise_state_location.model');
const GatewayModel = require('../../models/gateway.model');
const UserModel = require('../../models/user.model');
const bcrypt = require('bcrypt');
const { decode } = require('../../utility/JwtDecoder');
const OptimizerModel = require('../../models/optimizer.model');



// EnterpriseList
exports.EnterpriseListData = async (req, res) => {
    try {
        const AllEnt = await EnterpriseAdminModel.find({});

        if (req.params.flag === 'name') {
            return res.status(200).json({ success: true, message: "Data fetched successfully", data: AllEnt });
        }

        if (req.params.flag === 'data') {
            const getAllEnterpriseLocation = async (entId) => {
                const data = await EnterpriseStateLocationModel.find({ Enterprise_ID: entId }).exec();
                // console.log("Location=>", data);
                return data;
            };

            const getAllEnterpriseGateway = async (entInfoID) => {
                const data = await GatewayModel.find({ EnterpriseInfo: entInfoID }).exec();
                // console.log("Gateway=>", data);
                return data;
            };

            const getAllEnterpriseOptimizer = async (gatewayID) => {
                const data = await OptimizerModel.find({ GatewayId: gatewayID }).exec();
                // console.log("Optimizer=>", data);
                return data;
            };

            const updatedAllEnt = await Promise.all(AllEnt.map(async (ent) => {
                // Getting all the locations
                const LocationData = await getAllEnterpriseLocation(ent._id);

                // Getting all the gateways
                const GatewayData = await Promise.all(LocationData.map(async (location) => {
                    return await getAllEnterpriseGateway(location._id);
                }));
                const FlattenedGatewayData = GatewayData.flat(); // Use flat to flatten the array

                // Getting all the optimizers
                const OptimizerData = await Promise.all(FlattenedGatewayData.map(async (gateway) => {
                    return await getAllEnterpriseOptimizer(gateway._id);
                }));
                const FlattenedOptimizerData = OptimizerData.flat();


                const data = {
                    location: LocationData.length,
                    gateway: FlattenedGatewayData.length,
                    optimizer: FlattenedOptimizerData.length,
                    power_save_unit: Math.round(Math.random() * (300 - 100) + 1),
                };

                return { ...ent._doc, data };
            }));

            return res.status(200).json({ success: true, message: "Data fetched successfully", data: updatedAllEnt });
        }
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
};

// EnterpriseStateList
exports.EnterpriseStateList = async (req, res) => {
    const { enterprise_id } = req.params;

    try {
        const AllEnterpriseState = await EnterpriseStateModel.find({ Enterprise_ID: enterprise_id }).populate({
            path: 'Enterprise_ID'
        }).populate({
            path: 'State_ID'
        });


        if (AllEnterpriseState.length === 0) {
            return res.status(404).send({ success: false, message: 'No data found for the given enterprise ID.' });
        }

        // Extract the common Enterprise_ID data from the first object
        const { Enterprise_ID, ...commonEnterpriseData } = AllEnterpriseState[0].Enterprise_ID;
        const commonEnterpriseDataWithDoc = { ...commonEnterpriseData._doc };

        const getAllEnterpriseLocation = async (entId, stateId) => {
            const data = await EnterpriseStateLocationModel.find({ Enterprise_ID: entId, State_ID: stateId }).exec();
            // console.log("Location=>", data);
            return data;
        };

        const getAllEnterpriseGateway = async (entInfoID) => {
            const data = await GatewayModel.find({ EnterpriseInfo: entInfoID }).exec();
            // console.log("Gateway=>", data);
            return data;
        };

        const getAllEnterpriseOptimizer = async (gatewayID) => {
            const data = await OptimizerModel.find({ GatewayId: gatewayID }).exec();
            // console.log("Optimizer=>", data);
            return data;
        };

        // Map through the array and add the fields to each object
        const AllEntState = await Promise.all(AllEnterpriseState.map(async (item) => {
            // Getting all the locations
            const LocationData = await getAllEnterpriseLocation(item.Enterprise_ID._id, item.State_ID._id);

            // Getting all the gateways
            const GatewayData = await Promise.all(LocationData.map(async (location) => {
                return await getAllEnterpriseGateway(location._id);
            }));
            const FlattenedGatewayData = GatewayData.flat(); // Use flat to flatten the array

            // Getting all the optimizers
            const OptimizerData = await Promise.all(FlattenedGatewayData.map(async (gateway) => {
                return await getAllEnterpriseOptimizer(gateway._id);
            }));
            const FlattenedOptimizerData = OptimizerData.flat();


            const data = {
                location: LocationData.length,
                gateway: FlattenedGatewayData.length,
                optimizer: FlattenedOptimizerData.length,
                power_save_unit: Math.round(Math.random() * (300 - 100) + 1),
            };

            return { ...item._doc, data };
        }));

        // Remove "Enterprise_ID" field from AllEntState
        AllEntState.forEach(state => {
            delete state.Enterprise_ID;
        });

        // console.log(AllEntState);
        return res.status(200).json(
            {
                success: true,
                message: "Data fetched successfully",
                commonEnterpriseData: commonEnterpriseDataWithDoc,
                AllEntState
            }
        );
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }

}

// EnterpriseStateLocationList
exports.EnterpriseStateLocationList = async (req, res) => {
    const { enterprise_id, state_id } = req.params;

    try {
        const AllEnterpriseStateLocation = await EnterpriseStateLocationModel.find({ Enterprise_ID: enterprise_id, State_ID: state_id }).populate({
            path: 'Enterprise_ID'
        }).populate({
            path: 'State_ID'
        });

        if (AllEnterpriseStateLocation.length === 0) {
            return res.status(404).send({ success: false, message: 'No data found for the given enterprise ID.' });
        }

        // Extract the common Enterprise_ID data from the first object
        const { Enterprise_ID, ...commonEnterpriseData } = AllEnterpriseStateLocation[0].Enterprise_ID;
        const commonEnterpriseDataWithDoc = { ...commonEnterpriseData._doc };

        // Extract the common State_ID data from the first object
        const { State_ID, ...commonStateData } = AllEnterpriseStateLocation[0].State_ID;
        const commonStateDataWithDoc = { ...commonStateData._doc };

        const getAllEnterpriseGateway = async (entInfoID) => {
            const data = await GatewayModel.find({ EnterpriseInfo: entInfoID }).exec();
            // console.log("Gateway=>", data);
            return data;
        };

        const getAllEnterpriseOptimizer = async (gatewayID) => {
            const data = await OptimizerModel.find({ GatewayId: gatewayID }).exec();
            // console.log("Optimizer=>", data);
            return data;
        };

        // Map through the array and add the fields to each object
        const AllEntStateLocation = await Promise.all(AllEnterpriseStateLocation.map(async (location) => {
            // Getting all the gateways
            const GatewayData = await getAllEnterpriseGateway(location._id);
            const FlattenedGatewayData = GatewayData.flat(); // Use flat to flatten the array

            // Getting all the optimizers
            const OptimizerData = await Promise.all(FlattenedGatewayData.map(async (gateway) => {
                return await getAllEnterpriseOptimizer(gateway._id);
            }));
            const FlattenedOptimizerData = OptimizerData.flat();

            const data = {
                gateway: FlattenedGatewayData.length,
                optimizer: FlattenedOptimizerData.length,
                power_save_unit: Math.round(Math.random() * (300 - 100) + 1),
            };

            return { ...location._doc, data };
        }));

        // Remove "Enterprise_ID" & "State_ID" fields from AllEntStateLocation
        AllEntStateLocation.forEach(ent => {
            delete ent.Enterprise_ID;
            delete ent.State_ID;
        });


        // console.log(AllEntStateLocation);
        return res.status(200).json(
            {
                success: true,
                message: "Data fetched successfully",
                commonEnterpriseData: commonEnterpriseDataWithDoc,
                commonStateData: commonStateDataWithDoc,
                AllEntStateLocation
            }
        );
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
}

// EnterpriseStateLocationGatewayList
exports.EnterpriseStateLocationGatewayList = async (req, res) => {
    const { enterpriseInfo_id } = req.params;

    try {
        const AllEnterpriseStateLocationGateway = await GatewayModel.find({ EnterpriseInfo: enterpriseInfo_id }).populate({
            path: 'EnterpriseInfo',
            populate: [
                {
                    path: 'Enterprise_ID',
                },
                {
                    path: 'State_ID',
                },
            ]
        });

        if (AllEnterpriseStateLocationGateway.length === 0) {
            return res.status(404).send({ success: false, message: 'No data found for the given enterprise ID.' });
        }

        // Extract the common Enterprise_ID data from the first object
        const { Enterprise_ID, ...commonEnterpriseData } = AllEnterpriseStateLocationGateway[0].EnterpriseInfo.Enterprise_ID;
        const commonEnterpriseDataWithDoc = { ...commonEnterpriseData._doc };

        // Extract the common State_ID data from the first object
        const { State_ID, ...commonStateData } = AllEnterpriseStateLocationGateway[0].EnterpriseInfo.State_ID;
        const commonStateDataWithDoc = { ...commonStateData._doc };

        // Dynamic extraction of fields for commonLocationDataDoc
        const LocationData = { ...AllEnterpriseStateLocationGateway[0].EnterpriseInfo };
        const commonLocationDataDoc = { ...LocationData._doc };
        if (commonLocationDataDoc.Enterprise_ID && commonLocationDataDoc.State_ID) {
            delete commonLocationDataDoc.Enterprise_ID;
            delete commonLocationDataDoc.State_ID;
        } else {
            return commonLocationDataDoc;
        };

        const getAllEnterpriseOptimizer = async (gatewayID) => {
            const data = await OptimizerModel.find({ GatewayId: gatewayID }).exec();
            // console.log("Optimizer=>", data);
            return data;
        };

        // Map through the array and add the fields to each object
        const AllEntStateLocationGateway = await Promise.all(AllEnterpriseStateLocationGateway.map(async (gateway) => {
            // Getting all the optimizers
            const OptimizerData = await getAllEnterpriseOptimizer(gateway._id);
            const FlattenedOptimizerData = OptimizerData.flat();

            const data = {
                optimizer: FlattenedOptimizerData.length,
                power_save_unit: Math.round(Math.random() * (300 - 100) + 1),
            };

            return { ...gateway._doc, data };
        }));

        // Remove "EnterpriseInfo" field from AllEntStateLocationGateway
        AllEntStateLocationGateway.forEach(ent => {
            delete ent.EnterpriseInfo;
        });

        // return res.send(AllEnterpriseStateLocationGateway[0].EnterpriseInfo._id;);

        return res.status(200).json(
            {
                success: true,
                message: "Data fetched successfully",
                commonEnterpriseData: commonEnterpriseDataWithDoc,
                commonStateData: commonStateDataWithDoc,
                commonLocationData: commonLocationDataDoc,
                AllEntStateLocationGateway
            }
        );
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
}

// EnterpriseStateLocationGatewayOptimizerList
exports.EnterpriseStateLocationGatewayOptimizerList = async (req, res) => {
    const { gateway_id } = req.params;

    try {
        const Gateway = await GatewayModel.findOne({ GatewayID: gateway_id });
        if (!Gateway) {
            return res.status(401).json({ success: false, message: "Gateway ID not found" });
        }
        const AllEnterpriseStateLocationGatewayOptimizer = await OptimizerModel.find({ GatewayId: Gateway._id }).populate({
            path: 'GatewayId',
            populate:
            {
                path: 'EnterpriseInfo',
                populate: [
                    {
                        path: 'Enterprise_ID',
                    },
                    {
                        path: 'State_ID',
                    },
                ]
            }

        });

        if (AllEnterpriseStateLocationGatewayOptimizer.length === 0) {
            return res.status(404).send({ success: false, message: 'No data found for the given enterprise ID.' });
        }


        // Extract the common Enterprise_ID data from the first object
        const { Enterprise_ID, ...commonEnterpriseData } = AllEnterpriseStateLocationGatewayOptimizer[0].GatewayId.EnterpriseInfo.Enterprise_ID;
        const commonEnterpriseDataWithDoc = { ...commonEnterpriseData._doc };

        // Extract the common State_ID data from the first object
        const { State_ID, ...commonStateData } = AllEnterpriseStateLocationGatewayOptimizer[0].GatewayId.EnterpriseInfo.State_ID;
        const commonStateDataWithDoc = { ...commonStateData._doc };

        // Dynamic extraction of fields for commonLocationDataDoc
        const LocationData = { ...AllEnterpriseStateLocationGatewayOptimizer[0].GatewayId.EnterpriseInfo };
        const commonLocationDataDoc = { ...LocationData._doc };
        if (commonLocationDataDoc.Enterprise_ID && commonLocationDataDoc.State_ID) {
            delete commonLocationDataDoc.Enterprise_ID;
            delete commonLocationDataDoc.State_ID;
        } else {
            return commonLocationDataDoc;
        };

        // Dynamic extraction of fields for commonGatewayDataDoc
        const commonGatewayDataDoc = { ...AllEnterpriseStateLocationGatewayOptimizer[0].GatewayId._doc };
        if (commonGatewayDataDoc) {
            delete commonGatewayDataDoc.EnterpriseInfo;
        } else {
            return commonGatewayDataDoc;
        };

        // Map through the array and add the fields to each object
        const AllEntStateLocationGatewayOptimizer = AllEnterpriseStateLocationGatewayOptimizer.map(ent => ({
            ...ent._doc,
        }));

        // Remove "GatewayId" field from AllEntStateLocationGatewayOptimizer
        AllEntStateLocationGatewayOptimizer.forEach(ent => {
            delete ent.GatewayId;
        });

        // return res.send(AllEntStateLocationGatewayOptimizer);

        return res.status(200).json(
            {
                success: true,
                message: "Data fetched successfully",
                commonEnterpriseData: commonEnterpriseDataWithDoc,
                commonStateData: commonStateDataWithDoc,
                commonLocationData: commonLocationDataDoc,
                commonGatewayData: commonGatewayDataDoc,
                AllEntStateLocationGatewayOptimizer
            }
        );

    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
}

// OptimizerDetails
exports.OptimizerDetails = async (req, res) => {
    const { optimizer_id } = req.params;
    const Optimizer = await OptimizerModel.findOne({ OptimizerID: optimizer_id });

    if (Optimizer) {
        const Gateway = await GatewayModel.findOne({ _id: Optimizer.GatewayId });
        const STATIC_DATA = {
            optimizer: Optimizer,
            gateway: Gateway,
            optimizer_mode: "NON-OPTIMIZATION",
            outside_temp: "29",
            outside_humidity: "20",
            room_temp: "23.8",
            coil_temp: "22.3",
            humidity_percentage: "65",
            unit: {
                temperature: "C",
                voltage: "V",
                current: "A",
                active_power: "kW",
                apartment_power: "kVA",
            },
            PH1: {
                voltage: "253.974503",
                current: "6.210000",
                active_power: "-0.995000",
                power_factor: "1185.000000",
                apartment_power: "1579.000000",
            },
            PH2: {
                voltage: "254.018997",
                current: "5.880000",
                active_power: "0.961000",
                power_factor: "1341.000000",
                apartment_power: "1496.000000",
            },
            PH3: {
                voltage: "254.386505",
                current: "9.950001",
                active_power: "0.999000",
                power_factor: "1591.000000",
                apartment_power: "1075.000000",
            },
        }
        return res.status(200).json({ success: true, message: "Data fetched successfully", data: STATIC_DATA });
    } else {
        return res.status(404).json({ success: false, message: "Optimizer not found", data: null });
    }
}

// SET PASSWORD VIEW
exports.SetNewPasswordView = async (req, res) => {
    try {
        const url = process.env.HOST;
        const decodedHashValue = decode("Bearer " + req.params.hashValue);
        let valid = true;
        let message = "";
        // Check if the token has expired
        const currentTimestamp = Math.floor(Date.now() / 1000); // Get current timestamp in seconds
        if (decodedHashValue.exp && currentTimestamp > decodedHashValue.exp) {
            valid = false
            message = 'Token has expired';
        } else {
            valid = true;
            message = 'Token is still valid';
        }
        const DATA = {
            message,
            valid,
            token: req.params.hashValue,
            backend_url: url + "/api/enterprise/set/new/password/" + req.params.hashValue,
            perpose: "Set New Password"
        }
        // return res.status(200).json(DATA);
        // return res.send(decodedHashValue);
        return res.render("auth/set_password", {
            title: "Set New Password",
            DATA
        });
    } catch (error) {
        console.log(error.message);
        return res.send({ success: false, message: error.message });
    }
}

// SET PASSWORD
exports.SetNewPassword = async (req, res) => {
    const { _token, password } = req.body;
    try {
        const decodedHashValueEmail = decode("Bearer " + _token).email;
        // const user = await User.findOne({ email: decodedHashValueEmail });
        const hashedPassword = await bcrypt.hash(password, 10);
        const filter = { email: decodedHashValueEmail };
        const update = { password: hashedPassword };

        // Use updateOne to update a single document
        const result = await UserModel.updateOne(filter, update);

        console.log(result);
        // return res.status(200).json({
        //     success: true,
        //     message: "Password reset successfully!",
        // });

        return res.render("auth/success", {});
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

