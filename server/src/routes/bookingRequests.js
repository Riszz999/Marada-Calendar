import {Router} from 'express';
import {pool} from '../db.js';
import {optionalAuth} from '../middleware/auth.js';
import {createRateLimit} from '../middleware/rateLimit.js';
import {handleRequests,validateSubmission} from '../lib/booking-requests.js';

export const bookingRequestsRouter=Router();
export const adminBookingRequestsRouter=Router();
const submitLimit=createRateLimit({windowMs:15*60*1000,max:5});
const query=(sql,args=[])=>pool.query(sql.replaceAll('CURRENT_TIMESTAMP','UTC_TIMESTAMP()'),args);
const db={
  async one(sql,args){return (await query(sql,args))[0][0] || null;},
  async all(sql,args){return (await query(sql,args))[0];},
  async run(sql,args){const [r]=await query(sql,args);return {meta:{changes:r.affectedRows,last_row_id:r.insertId}};},
};
bookingRequestsRouter.post('/',submitLimit,async(req,res,next)=>{
  try {
    const {data,errors}=validateSubmission(req.body);
    if(errors) return res.status(400).json({error:'validation_failed',fields:errors});
    await db.run(`INSERT INTO reservations(reserved_date,reserved_time,customer_name,seats,phone,zone,food_order,status,source,requested_at)
      VALUES(?,?,?,?,?,?,?,'pending','web',CURRENT_TIMESTAMP)`,[data.date,data.time,data.name,data.seats,data.phone,data.zone||null,data.food||null]);
    res.set('Cache-Control','no-store').status(201).json({received:true,status:'pending'});
  } catch(error){next(error);}
});
adminBookingRequestsRouter.use(optionalAuth);
adminBookingRequestsRouter.all(['/', '/:id'],async(req,res,next)=>{
  try {
    const response=await handleRequests(db,new URL(req.originalUrl,'http://localhost'),req.method,req.params.id,req.body,req.viewLevel);
    res.set('Cache-Control','no-store').status(response.status).json(await response.json());
  } catch(error){next(error);}
});
