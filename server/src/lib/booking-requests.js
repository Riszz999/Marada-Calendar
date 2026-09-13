import { serializeReservation } from './mask.js';
import { checkDateRange, isValidDateKey, validateReservationBody } from './validate.js';

const ACTIVE = "status IN ('pending','follow_up')";
const web = "source='web'";
export function requestView(row, level='admin') {
  return {...serializeReservation(row, level), status:row.status, note:row.admin_note || '',
    requestedAt:row.requested_at, reviewedAt:row.reviewed_at, revision:row.revision};
}

// Public submission is a separate route. It can never create a confirmed booking.
export function validateSubmission(input) {
  const result = validateReservationBody(input);
  if (result.errors) return result;
  if (result.data.food.length > 5000) return {errors:{food:'too_long'}};
  if (result.data.phone.length > 32) return {errors:{phone:'too_long'}};
  return result;
}

export function requestQuery(params) {
  const state=params.get('state') || 'active', date=params.get('date');
  const page=Number(params.get('page') || 1);
  if (!['active','history'].includes(state) || !Number.isSafeInteger(page) || page<1 || page>100000 || (date && !isValidDateKey(date))) return null;
  return {where:`${web} AND ${state==='active'?ACTIVE:"status IN ('confirmed','rejected')"}${date?' AND reserved_date=?':''}`,
    args:date?[date]:[], order:state==='active'?'reserved_date ASC,reserved_time ASC,id ASC':'reviewed_at DESC,id DESC', page, limit:30};
}

export function validateDecision(data) {
  if (!['approve','follow_up','reject'].includes(data.action) || !Number.isSafeInteger(data.revision) || data.revision<0) return {error:'invalid_request_action'};
  if (typeof data.note !== 'string' || data.note.length>2000) return {error:'invalid_request_note'};
  const note=data.note.trim();
  if (data.action==='reject' && !note) return {error:'request_reason_required'};
  return {status:{approve:'confirmed',follow_up:'follow_up',reject:'rejected'}[data.action], note};
}

export async function handleRequests(db, url, method, id, data, level='admin') {
  const error=(code,status=400)=>Response.json({error:code},{status});
  if(level!=='admin' && !(level==='staff' && method==='GET')) return error('unauthorized',401);
  if(level==='staff' && url.searchParams.get('state')==='history') return error('unauthorized',403);
  if (id==='summary' && method==='GET') {
    const from=url.searchParams.get('from'),to=url.searchParams.get('to');
    const invalid=checkDateRange(from,to);if(invalid) return error(invalid);
    const total=await db.one(`SELECT COUNT(*) AS count FROM reservations WHERE ${web} AND ${ACTIVE}`);
    const days=await db.all(`SELECT reserved_date AS date,COUNT(*) AS count FROM reservations WHERE ${web} AND ${ACTIVE} AND reserved_date BETWEEN ? AND ? GROUP BY reserved_date`,[from,to]);
    return Response.json({total:total.count,days});
  }
  if (!id && method==='GET') {
    const query=requestQuery(url.searchParams);if(!query) return error('invalid_range');
    const count=await db.one(`SELECT COUNT(*) AS count FROM reservations WHERE ${query.where}`,query.args);
    const rows=await db.all(`SELECT * FROM reservations WHERE ${query.where} ORDER BY ${query.order} LIMIT ? OFFSET ?`,[...query.args,query.limit,(query.page-1)*query.limit]);
    return Response.json({items:rows.map(row=>requestView(row,level)),total:count.count,page:query.page,pageSize:query.limit});
  }
  if (!/^\d+$/.test(id || '')) return error('not_found',404);
  const row=await db.one(`SELECT * FROM reservations WHERE id=? AND ${web}`,[Number(id)]);
  if (!row) return error('not_found',404);
  if(level==='staff' && !['pending','follow_up'].includes(row.status)) return error('not_found',404);
  if (method==='GET') return Response.json(requestView(row,level));
  if (method==='PATCH') {
    if (data.action==='edit') {
      if (!Number.isSafeInteger(data.revision) || data.revision<0) return error('invalid_request_action');
      const validated=validateSubmission(data);
      if (validated.errors) return Response.json({error:'validation_failed',fields:validated.errors},{status:400});
      const v=validated.data;
      const changed=await db.run(`UPDATE reservations SET reserved_date=?,reserved_time=?,customer_name=?,seats=?,phone=?,zone=?,food_order=?,reviewed_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND ${web} AND ${ACTIVE} AND revision=?`,[v.date,v.time,v.name,v.seats,v.phone,v.zone||null,v.food||null,Number(id),data.revision]);
      if (!changed.meta.changes) return error('request_changed',409);
      return Response.json(requestView(await db.one('SELECT * FROM reservations WHERE id=?',[Number(id)])));
    }
    const decision=validateDecision(data);
    if (decision.error) return error(decision.error);
    // One conditional write both approves and publishes to the calendar. No duplicate insert.
    const changed=await db.run(`UPDATE reservations SET status=?,admin_note=?,reviewed_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND ${web} AND ${ACTIVE} AND revision=?`,[decision.status,decision.note,Number(id),data.revision]);
    if (!changed.meta.changes) return error('request_changed',409);
    return Response.json(requestView(await db.one('SELECT * FROM reservations WHERE id=?',[Number(id)])));
  }
  return error('not_found',404);
}
