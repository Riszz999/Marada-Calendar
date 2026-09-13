import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { beginRead, readPhase, validateRead } from './read-state';

// Request counts/list are independent of confirmed bookings; a failed inbox load
// must never hide the confirmed calendar or leak an old admin's data.
export function useRequestData(kind, query, enabled, scope='admin') {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState({});
  const generation = useRef(0);
  const key=scope+':'+kind+'?'+query;
  const refresh=useCallback((options={})=>{
    generation.current += 1;
    setState(previous=>beginRead(previous,key,options.invalidate===true));
    setRefreshKey(n=>n+1);
  },[key]);
  useEffect(()=>{
    if (!enabled) { setState({}); return; }
    let active=true, controller;
    async function load() {
      controller?.abort(); controller=new AbortController();
      const current=controller;
      const version=++generation.current;
      setState(previous=>beginRead(previous,key));
      let timedOut=false;
      const timeout=setTimeout(()=>{timedOut=true;current.abort();},15000);
      try {
        const data=validateRead(kind,await api.bookingRequestFeed(kind,query,current.signal));
        if(active && current===controller && version===generation.current) setState({key,data,error:false,fetching:false});
      } catch (error) {
        if(active && (!current.signal.aborted || timedOut) && current===controller && version===generation.current) setState(previous=>({key,data:previous.key===key?previous.data:null,error:true,fetching:false}));
      } finally {clearTimeout(timeout);}
    }
    load();
    const visible=()=>{if(document.visibilityState!=='hidden') load();};
    const timer=setInterval(visible,30000);
    window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return ()=>{active=false;controller?.abort();clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  },[enabled,key,kind,query,refreshKey]);
  const current=enabled && state.key===key;
  const phase=readPhase(state,key,enabled);
  return {data:current?state.data:null,error:phase==='error',loading:phase==='loading',refreshing:phase==='refreshing',phase,refresh};
}
