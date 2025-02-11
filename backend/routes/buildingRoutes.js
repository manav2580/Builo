const express=require('express');
const {createBuilding, filterByLocation, filterByName, getAllBuildings, groupByName}=require('../controllers/buildingController');

const router=express.Router();



router.route('/building/new').post(createBuilding);
router.route('/filterbylocation').get(filterByLocation)
router.route('/filterbyname').get(filterByName)
router.route('/getBuildings').get(getAllBuildings)
router.route('/groupByName').get(groupByName)

module.exports=router;