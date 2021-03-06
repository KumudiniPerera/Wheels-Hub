'use strict'

var express = require('express');
var router = express.Router();
var request = require('request');
const $ = require('jquery')
const {
	submitUpdate,
	submitUpdate_sync,
	randomNameGenerator
} = require('../helpers/helpers')

var Vehicle = require('../models/vehicles');

// Application Object
const app = { user: null, keys: [], assets: [], transfers: [] }

const vehicle_global = {}
// Get Homepage
router.get('/', ensureAuthenticated, function (req, res) {
	if (req.user.user_type == "rmv") {
		res.render('RMV/index');
	}
	else if (req.user.user_type == "insurance") {
		res.render('Insurance/insurance');
	}
	else if (req.user.user_type == "gen_user") {
		res.render('normal_user/gen_user');
	}
});

//Get Register vehicle page
router.get('/register_vehicle', ensureAuthenticated, function (req, res) {
	//console.log(req.user.public_key);
	//console.log("test global->"+JSON.stringify(test_global));
	res.render('RMV/register_vehicle');
});

//Get Tranfer vehicle page
router.get('/transfer_vehicle', ensureAuthenticated, function (req, res) {
	//test_global['testing']= {"hi":"good stuff"};
	//console.log(JSON.stringify(test_global));
	res.render('RMV/transfer_vehicle');
});

router.get('/transfer_vehicle_info', ensureAuthenticated, function (req, res) {
	console.log("he he-->" + req.query.link);
	var res_link = "http://localhost:8008/batches?id=" + req.query.link;
	request({
		url: res_link,
		method: "GET"
	}, function (error, response, body) {
		try {
			var obj = JSON.parse(response.body);
			/*
						Object.keys(obj.data).forEach(function(key){
							console.log('key:' + key);
						})
			*/
			var payload = obj.data[0].transactions[0].payload;
			//console.log("payload in base64--> " + payload);

			var decoded = new Buffer(payload, 'base64').toString('ascii');

			//here we decode the response we get from the backend
			var decoded = JSON.parse(decoded);

			//filtering the json
			delete decoded.action;
			delete decoded.asset;
			delete decoded.owner;

			//console.log("payload in text-->" + decoded.vehicle_info.vehicle.chasis_no);
			console.log("payload in text-->" + JSON.stringify(decoded));

			vehicle_global['info'] = decoded;
			//console.log("global---->"+JSON.stringify(vehicle_global));

			res.render('RMV/transfer_vehicle_info', { vehicle: decoded });
		}
		catch (err) {
			console.log(err);
		}
	});
});

router.post('/transfer_vehicle', ensureAuthenticated, function (req, res) {
	var dir = req.body.vehiclestate
	var english_no = req.body.vehicleregistration
	var vehicle_no = req.body.vehicleno

	var tot = dir + english_no + vehicle_no;

	Vehicle.findOne({ vehicle_no: tot }, function (err, result) {
		if (err) {
			req.flash('error_msg', "vehicle not found");
			console.log(err);
			res.redirect('/transfer_vehicle');
		}
		//console.log(result.link);
		try {
			var res_link = result.link + " ";
			//req.flash('success_msg', decoded.vehicle_info.vehicle.chasis_no);
			res.redirect('/transfer_vehicle_info/?link=' + res_link);
		}
		catch (err) {
			req.flash('error_msg', "vehicle not found");
			res.redirect('/transfer_vehicle');
			console.log(err);
		}
	});
});

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	} else {
		//req.flash('error_msg','You are not logged in');
		res.redirect('/users/login');
	}
}


router.post('/register_vehicle', function (req, res) {
	RegVehicle(req, req.body.vehicle_no, req.body.chasis_no);
	//req.flash('success_msg', req.body.vehicle_no);
	res.redirect('/register_vehicle');
});

router.post('/trasfer_owner', function (req, res) {
	console.log("global---->" + JSON.stringify(vehicle_global));
	var key = "" + Date.now();
	var owner_info = {}
	owner_info[key] = {
		"name": req.body.transferee_name,
		"nic": req.body.nic,
		"owner_address": req.body.transferee_address, "license": req.body.license,
		"province": req.body.province,
		"district": req.body.district,
		"timestamp": Date.now()
	}
	console.log("owner_info->" + JSON.stringify(owner_info));

	var vehicle_info = vehicle_global.info.vehicle_info;
	vehicle_info.owner_info[key] = owner_info;
	console.log("haha" + JSON.stringify(vehicle_info));

	makeChanges(req, vehicle_info.vehicle.vehicle_no + Math.random(), vehicle_info);
	//AddOwner(req);
	//req.flash('success_msg', req.body.vehicle_no);
	res.redirect('/transfer_vehicle');
});

function RegVehicle(req, asset, vehicle_info) {
	var vehicle_info = {
		"vehicle": {
			"chasis_no": req.body.chasis_no, "vehicle_no": req.body.vehicle_no,
			"Model": req.body.Model, "yom": req.body.yom, "manufacture_country": req.body.manufacture_country,
			"engine_no": req.body.engine_no, "color": req.body.color, "registration_status": req.body.registration_status,
			"vehicle_type": req.body.vehicle_type
		},
		"owner_info": {},
		"insuarance_claims": {}
	}

	var key = "" + Date.now();
	var owner_info = {}
	owner_info[key] = {
		"name": req.body.owner_name,
		"nic": req.body.nic,
		"owner_address": req.body.owner_address, "license": req.body.license,
		"province": req.body.province,
		"district": req.body.district,
		"timestamp": Date.now()
	}
	vehicle_info.owner_info[key] = owner_info;
	console.log(vehicle_info)

	req.flash('success_msg', "successfully added: " + asset);
	
	submitUpdate(
		{ action: 'create', asset, vehicle_info, owner: req.user.public_key },
		req.user.private_key,
		success => success ? this.refresh() : null,
		asset
	)
	
}

function makeChanges(req, asset, vehicle_info) {
	req.flash('success_msg', "successfully added: " + asset);
	submitUpdate_sync(
		{ action: 'create', asset, vehicle_info, owner: req.user.public_key },
		req.user.private_key,
		success => success ? this.refresh() : null,
		vehicle_info.vehicle.vehicle_no
	)
}
function AddOwner(req, asset = randomNameGenerator()) {
	var owner_info = {
		"owner": {
			"name": req.body.owner_name,
			"nic": req.body.nic
		}
	}

	req.flash('success_msg', "owner successfully added");
	submitUpdate(
		{ action: 'add_vehicle_owner', asset, owner_info, owner: req.user.public_key },
		req.user.private_key,
		success => success ? this.refresh() : null,
		asset
	)
}

module.exports = router;