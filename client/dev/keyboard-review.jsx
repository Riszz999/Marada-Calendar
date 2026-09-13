// Development-only fixture. All API methods are replaced; no server writes.
// Run on a dedicated dev origin (5192), never against a user's app session.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LangProvider, useLang } from '../src/context/LangContext';
import { api, ApiError } from '../src/api';
import AccessScreen from '../src/components/AccessScreen';
import App from '../src/App';
import AccountModal from '../src/components/AccountModal';
import UsersModal from '../src/components/UsersModal';
import StaffKeyAdminModal from '../src/components/StaffKeyAdminModal';
import StaffKeyModal from '../src/components/StaffKeyModal';
import LoginModal from '../src/components/LoginModal';
import ReservationForm from '../src/components/ReservationForm';
import ReservationDetail from '../src/components/ReservationDetail';
import BookingRequestDetail from '../src/components/BookingRequestDetail';
import '../src/theme.css';

const options = new URLSearchParams(location.search);
const screen = options.get('screen') || 'create';
document.documentElement.dataset.theme = options.get('theme') || 'dark';
// Simulate visual-only keyboard resizing, independently from layout height.
// Alt+K toggles open/closed; Alt+P simulates the browser panning upward.
if (options.has('vv')) {
  const mock = new EventTarget();
  let open = true, panned = false;
  Object.defineProperties(mock, {
    height: { get: () => open ? Math.min(innerHeight, Number(options.get('vv'))) : innerHeight },
    offsetTop: { get: () => panned ? 36 : 0 },
    width: { get: () => innerWidth }, scale: { get: () => 1 },
  });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: mock });
  window.addEventListener('keydown', e => {
    if (!e.altKey || !['k', 'p'].includes(e.key.toLowerCase())) return;
    e.preventDefault();
    if (e.key.toLowerCase() === 'k') { open = !open; mock.dispatchEvent(new Event('resize')); }
    else { panned = !panned; mock.dispatchEvent(new Event('scroll')); }
  });
}
const user = { id: 1, username: 'fixture-admin' };
for (const method of Object.keys(api)) api[method] = async () => { throw new ApiError(400, { error: 'nothing_to_update' }); };
api.login = async username => {
  if (username !== user.username) throw new ApiError(401, {error:'invalid_credentials'});
  return { token:'fixture-session-no-server-access', user };
};
api.session = async () => screen === 'app-login' ? {level:'guest'} : {level:'admin',user};
api.listUsers = async () => Array.from({length:16},(_,i)=>({id:i+1,username:i?'fixture-user-'+i:user.username,createdAt:'2026-09-06T00:00:00Z'}));
api.getStaffKey = async () => ({configured:true,updatedAt:'2026-09-06T00:00:00Z'});
const reservation = {id:1,date:'2026-09-06',time:'18:30',name:'ผู้จองสำหรับทดสอบเท่านั้น',seats:4,phone:'0000000000',zone:'โต๊ะตัวอย่าง',food:Array(8).fill('อาหารทดสอบหลายบรรทัด').join('\n')};
let writeCount = 0, finishedAt = 0;
async function mutation() {
  writeCount++;
  document.querySelector('[data-write-count]')?.setAttribute('data-write-count', String(writeCount));
  await new Promise(resolve => setTimeout(resolve, 300));
  if (options.has('fail') || writeCount === Number(options.get('fail-at'))) throw new ApiError(400, {error:'nothing_to_update'});
  finishedAt = performance.now();
}
if (options.has('success')) {
  api.updateMe = async () => { await mutation(); return { user, token:'fixture-session-no-server-access' }; };
  for (const method of ['createUser','updateUser','deleteUser','clearStaffKey']) api[method] = mutation;
  api.setStaffKey = async () => { await mutation(); return {configured:true,updatedAt:'2026-09-06T00:00:00Z'}; };
  api.reviewBookingRequest=async(id,data)=>{await mutation();return {id,...reservation,status:data.action==='approve'?'confirmed':data.action==='reject'?'rejected':'follow_up',note:data.note,revision:1};};
  // Clipboard is isolated too; no host clipboard is changed in this fixture.
  Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:mutation}});
}

function Fixture() {
  const { login } = useAuth();
  const { setLang } = useLang();
  const [ready,setReady] = useState(false);
  const [closed,setClosed] = useState(false);
  const [closeDelay,setCloseDelay] = useState(0);
  useEffect(() => {
    setLang(options.get('lang') || 'th');
    if (screen === 'app-login') setReady(true);
    else login(user.username,'').then(()=>setReady(true));
  },[]);
  const close = () => { setCloseDelay(finishedAt ? performance.now() - finishedAt : 0); setClosed(true); };
  if (screen === 'app-login') return <App />;
  return <div className={screen === 'access' ? 'app-shell is-access' : undefined}>
    <p style={{padding:12}}>Development fixture · {screen} · API disabled · Alt+K keyboard · Alt+P pan</p>
    <output data-write-count={writeCount} data-close-delay={closeDelay}>Fixture writes: {writeCount}</output>
    {ready && !closed && <>
      {screen === 'access' && <AccessScreen />}
      {screen === 'account' && <AccountModal onClose={close} />}
      {screen === 'users' && <UsersModal onClose={close} />}
      {screen === 'staff-key' && <StaffKeyAdminModal onClose={close} />}
      {screen === 'staff-login' && <StaffKeyModal onClose={close} />}
      {screen === 'admin-login' && <LoginModal onClose={close} />}
      {['create','edit'].includes(screen) && <ReservationForm mode={screen} date={reservation.date} initial={screen==='edit'?reservation:undefined} onSubmit={mutation} onCancel={close} onDelete={async()=>{await mutation();return true;}} />}
      {screen === 'detail' && <ReservationDetail reservation={reservation} onClose={close} />}
      {screen === 'request-detail' && <BookingRequestDetail request={{...reservation,status:'pending',note:'',revision:0,requestedAt:'2026-09-06 00:00:00'}} onChanged={()=>{}} onClose={close} />}
    </>}
    {closed && <p>Closed · background scroll restored</p>}
  </div>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><LangProvider><AuthProvider><Fixture /></AuthProvider></LangProvider></React.StrictMode>);
