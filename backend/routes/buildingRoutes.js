const express=require('express');
const {createBuilding, filterByLocation, filterByName, getAllBuildings, groupByName, getCurrentLocation}=require('../controllers/buildingController');

const router=express.Router();



router.route('/building/new').post(createBuilding);
router.route('/filterbylocation').get(filterByLocation)
router.route('/filterbyname').get(filterByName)
router.route('/getBuildings').get(getAllBuildings)
router.route('/groupByName').get(groupByName)
router.route('/getCurrentLocation').get(getCurrentLocation)

module.exports=router;