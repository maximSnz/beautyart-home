// Beauty Art — вход через Supabase Auth, общий для всех страниц (ИП, ООО, главная).
// Один вход сразу в обе базы (одинаковые почта и пароль); вход помнится до «Выйти» (localStorage —
// все сайты maximsnz.github.io для браузера один сайт). Страница: BA_AUTH.login(SUPABASE_URL,HD) в go(),
// BA_AUTH.has(SUPABASE_URL) при загрузке. HD меняется на месте: Authorization = токен пользователя.
(function(){
const BASES={
  ip:{url:'https://jvoofakrkhzoblhhuyvr.supabase.co',anon:'sb_publishable_IA4ReUU9xTL7hb_sbsHaFA_LPATJazE',name:'ИП'},
  ooo:{url:'https://jaruwkpugxybwcsalhgr.supabase.co',anon:'sb_publishable_09rFaH3adGXnEO3-cybX9A_eK_mCnW0',name:'ООО'}
};
const KEY='ba_auth',now=()=>Math.floor(Date.now()/1000);
const baseOf=url=>Object.keys(BASES).find(k=>BASES[k].url===url);
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};}};
const write=s=>{try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}};
const keep=t=>({access_token:t.access_token,refresh_token:t.refresh_token,expires_at:t.expires_at||now()+(t.expires_in||3600)});
async function grant(b,type,body){
  const r=await fetch(BASES[b].url+'/auth/v1/token?grant_type='+type,{method:'POST',headers:{apikey:BASES[b].anon,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.msg||j.error_description||j.message||('HTTP '+r.status));e.code=j.error_code||j.code||j.error;e.status=r.status;throw e;}
  return j;
}
// Токен базы: свежий из хранилища (его могла продлить другая вкладка) или продлённый сейчас
const pending={};
async function token(b){
  const s=read(),t=s[b];if(!t)return null;
  if(t.expires_at-now()>300)return t.access_token;
  if(!pending[b])pending[b]=grant(b,'refresh_token',{refresh_token:t.refresh_token})
    .then(j=>{const s2=read();s2[b]=keep(j);write(s2);return j.access_token;})
    .catch(e=>{if(e.status>=400&&e.status<500){const s2=read();if(s2[b]&&s2[b].refresh_token===t.refresh_token){delete s2[b];write(s2);}return null;}throw e;})
    .finally(()=>{delete pending[b];});
  return pending[b];
}
const attached=[];
async function attach(b,HD){
  const a=await token(b);if(!a)return false;
  HD.Authorization='Bearer '+a;
  if(!attached.some(x=>x.HD===HD))attached.push({b,HD});
  addLogout();return true;
}
// Продление каждую минуту и при возврате на вкладку; сессия отозвана — страница заново просит вход
async function tick(){
  for(const {b,HD} of attached){
    try{const a=await token(b);if(a)HD.Authorization='Bearer '+a;else{location.reload();return;}}catch(e){console.warn('[auth] продление не удалось',e);}
  }
}
setInterval(tick,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
function showErr(m){const e=document.getElementById('errorMessage');if(e){e.style.display='block';e.textContent=m;}}
async function login(url,HD){
  const b=baseOf(url);if(!b){showErr('Неизвестная база: '+url);return false;}
  const had=!!read()[b];
  try{if(await attach(b,HD))return true;}catch(e){showErr('Нет связи с сервером входа. Попробуйте ещё раз.');return false;}
  const em=(document.getElementById('email')||{}).value||'',pw=(document.getElementById('pwd')||{}).value||'';
  if(!em.trim()||!pw){showErr(had?'Вход истёк — войдите снова.':'Введите почту и пароль');return false;}
  const s={},errs={};
  await Promise.all(Object.keys(BASES).map(k=>grant(k,'password',{email:em.trim(),password:pw}).then(j=>{s[k]=keep(j);}).catch(e=>{errs[k]=e;})));
  if(Object.keys(s).length){write({...s,email:em.trim()});}
  if(!s[b]){
    const e=errs[b]||{};
    showErr(e.status===400||e.code==='invalid_credentials'?'Неверная почта или пароль.':e.status===429?'Слишком много попыток. Подождите минуту.':'Не удалось войти: '+(e.message||'нет связи с сервером'));
    return false;
  }
  Object.keys(errs).forEach(k=>console.warn('[auth] нет входа в базу '+BASES[k].name,errs[k]));
  return attach(b,HD);
}
async function logout(){
  const s=read();
  await Promise.all(Object.keys(BASES).filter(k=>s[k]).map(k=>fetch(BASES[k].url+'/auth/v1/logout',{method:'POST',headers:{apikey:BASES[k].anon,Authorization:'Bearer '+s[k].access_token}}).catch(()=>{})));
  try{localStorage.removeItem(KEY);}catch(e){}
  location.reload();
}
// Кнопка «Выйти» справа в шапке (у страниц шапка .header)
function addLogout(){
  const h=document.querySelector('.header');if(!h||h.querySelector('.ba-logout'))return;
  const em=read().email||'';
  const btn=document.createElement('button');btn.className='ba-logout';btn.type='button';btn.textContent='Выйти';btn.title=em?('Вы вошли как '+em):'Выйти';btn.onclick=logout;
  btn.style.cssText="margin-left:auto;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.45);color:#fff;border-radius:10px;padding:7px 16px;font-family:'Forum',serif;font-size:1em;cursor:pointer";
  h.appendChild(btn);
}
window.BA_AUTH={login,logout,has:url=>{const b=baseOf(url);return !!(b&&read()[b]);},email:()=>read().email||''};
})();
