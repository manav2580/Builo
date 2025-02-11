const express= require('express');
const app=express();
const cors = require('cors');
app.use(cors())
const errorMiddleware=require('./middleware/error');
const cookieParser=require('cookie-parser');
app.use(express.json())
app.use(cookieParser());
const building=require('./routes/buildingRoutes');
// const employee=require('./routes/employeeRoute');
// const process=require('./routes/processRoute');
app.use("/api/v1",building);
// app.use("/api/v1",employee);
// app.use("/api/v1",process);
app.use(errorMiddleware);

//Middleware for error
module.exports=app
