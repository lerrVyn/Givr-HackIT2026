'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'givr-db.json');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const CAUSE_BG = { Animals:'#F0EBE1', Environment:'#E8EDE4', Elderly:'#F7F3EC', Children:'#E8EDE4', Community:'#F3E9E3', Education:'#EBF0F3' };

const seedEvents = [
  { id:1, title:'East Coast Beach Cleanup', org:'Green Futures SG', cause:'Environment', bg:'#E8EDE4', img:'images/beachcleanup.jpg', date:'Sat, 28 Sep', time:'9:00 AM', location:'East Coast Park, Singapore', dist:2.4, duration:2, durationLabel:'2 hrs', pts:100, slots:18, desc:"Help keep our shorelines clean! We'll tackle litter across a 2km stretch of East Coast Park beach. Gloves and bags provided. Great for first-timers — no experience needed.", types:['outdoor','hands-on'], eventCode:'GREEN28', seeded:true },
  { id:2, title:'Animal Shelter Support Day', org:'SPCA Singapore', cause:'Animals', bg:'#F0EBE1', img:'images/animalss.jpg', date:'Sun, 29 Sep', time:'10:00 AM', location:'SPCA, 140 Kim Seng Road', dist:4.1, duration:3, durationLabel:'3 hrs', pts:150, slots:8, desc:'Spend the morning with dogs and cats awaiting adoption. Activities include walking dogs, grooming cats, and keeping their spaces clean and cheerful.', types:['outdoor','hands-on','animals'], eventCode:'SPCA29', seeded:true },
  { id:3, title:'Digital Skills for Seniors', org:'Silver Generation Office', cause:'Elderly', bg:'#F7F3EC', img:'images/elderlydigal.jpg', date:'Wed, 2 Oct', time:'2:00 PM', location:'Bedok CC, Block 11 Bedok North', dist:6.8, duration:2, durationLabel:'2 hrs', pts:100, slots:12, desc:'Teach seniors how to use smartphones for video calls, health apps, and online services. Patient and friendly volunteers encouraged.', types:['teaching','people'], eventCode:'SENIOR02', seeded:true },
  { id:4, title:'Community Food Distribution', org:'Food from the Heart', cause:'Community', bg:'#F3E9E3', img:'images/fooddistribution.jpg', date:'Sat, 5 Oct', time:'8:00 AM', location:'Ang Mo Kio Hub', dist:8.2, duration:4, durationLabel:'4 hrs', pts:200, slots:25, desc:'Help sort, pack, and distribute food to low-income families and elderly residents. A very hands-on and impactful morning.', types:['hands-on','people','community'], eventCode:'FOOD05', seeded:true },
  { id:5, title:"Children's Reading Programme", org:'ReadAble SG', cause:'Children', bg:'#E8EDE4', img:'images/childreading.jpg', date:'Sat, 12 Oct', time:'10:00 AM', location:'Tampines Public Library', dist:11.3, duration:2, durationLabel:'2 hrs', pts:100, slots:6, desc:'Read aloud to children aged 5–10 and run fun literacy activities. Perfect for those who enjoy working with kids.', types:['teaching','people','children'], eventCode:'READ12', seeded:true },
  { id:6, title:'Community Garden Day', org:'NParks SG', cause:'Environment', bg:'#E8EDE4', img:'images/planting.jpg', date:'Sun, 6 Oct', time:'8:30 AM', location:'Bishan-Ang Mo Kio Park', dist:5.1, duration:3, durationLabel:'3 hrs', pts:150, slots:20, desc:'Maintain the community garden — planting, weeding, and learning about urban farming. A refreshing outdoor activity.', types:['outdoor','hands-on','environment'], eventCode:'GARDEN06', seeded:true },
  { id:7, title:'Elderly Home Visits', org:'Care Corner SG', cause:'Elderly', bg:'#F3E9E3', img:'images/elderlyhome.jpg', date:'Sat, 19 Oct', time:'11:00 AM', location:'Various locations, Central SG', dist:3.5, duration:2, durationLabel:'2 hrs', pts:100, slots:10, desc:'Visit elderly residents living alone to provide companionship and simple assistance. Warm, friendly volunteers welcome.', types:['people','community'], eventCode:'CARE19', seeded:true },
  { id:8, title:'Wildlife Photography Walk', org:'Nature Society SG', cause:'Environment', bg:'#E8EDE4', img:'images/photographywalk.jpg', date:'Sun, 13 Oct', time:'7:00 AM', location:'Sungei Buloh Wetland Reserve', dist:14.2, duration:4, durationLabel:'4 hrs', pts:200, slots:15, desc:"Document Singapore's native wildlife to support conservation research. Cameras provided, no prior experience needed.", types:['outdoor','environment'], eventCode:'WILDLIFE13', seeded:true }
];

function emptyDb() {
  return {
    users: [],
    sessions: {},
    events: seedEvents.map(e => ({
      ...e,
      attendanceToken: crypto.randomBytes(18).toString('hex'),
      attendees: [],
      completedBy: [],
      coverImage: null
    }))
  };
}
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) { fs.mkdirSync(DB_DIR, { recursive:true }); fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb(),null,2)); }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) { console.error('DB read failed:', e.message); return emptyDb(); }
}
let db = readDb();
function writeDb() { fs.mkdirSync(DB_DIR,{recursive:true}); fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
function safeUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    avatar: u.avatar || '', points: u.points || 0,
    prefs: u.prefs || {}, redeemed: u.redeemed || [],
    gender: u.gender || '', phone: u.phone || '',
    joinedEvents: db.events.filter(e=>(e.attendees||[]).includes(u.id)).map(e=>e.id)
  };
}
function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function tokenFor(user) { const token=crypto.randomBytes(32).toString('hex'); db.sessions[token]=user.id; writeDb(); return token; }
function auth(req,res,next) {
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const uid=db.sessions[token]; const user=db.users.find(u=>u.id===uid);
  if (!user) return res.status(401).json({error:'Please log in to continue.'});
  req.user=user; req.token=token; next();
}
function role(r) { return (req,res,next)=>req.user.role===r?next():res.status(403).json({error:`This action requires a ${r} account.`}); }
function makeEventCode() { let code; do { code='GV-'+crypto.randomBytes(3).toString('hex').toUpperCase(); } while(db.events.some(e=>e.eventCode===code)); return code; }

// ── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req,res)=>res.json({ok:true,app:'Givr API'}));

app.post('/api/auth/register', (req,res)=>{
  const {name,email,password,role:userRole}=req.body||{};
  if (!name||!email||!password) return res.status(400).json({error:'Name, email and password are required.'});
  if (String(password).length<8) return res.status(400).json({error:'Use a password with at least 8 characters.'});
  const normalizedEmail=String(email).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(400).json({error:'Enter a valid email address.'});
  if (db.users.some(u=>u.email===normalizedEmail)) return res.status(409).json({error:'An account with this email already exists. Please log in.'});
  const roleValue=userRole==='organisation'?'organisation':'student';
  const credentials=hashPassword(String(password));
  const user={id:crypto.randomUUID(),name:String(name).trim().slice(0,80),email:normalizedEmail,role:roleValue,...credentials,avatar:'',points:0,prefs:{},redeemed:[],createdAt:new Date().toISOString()};
  db.users.push(user); const token=tokenFor(user); writeDb();
  res.status(201).json({token,user:safeUser(user)});
});

app.post('/api/auth/login', (req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  const password=String(req.body?.password||'');
  const user=db.users.find(u=>u.email===email);
  if (!user||!password) return res.status(401).json({error:'Email or password is incorrect.'});
  const hash=crypto.scryptSync(password,user.salt,64).toString('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(user.hash,'hex'))) return res.status(401).json({error:'Email or password is incorrect.'});
  const token=tokenFor(user); res.json({token,user:safeUser(user)});
});

app.post('/api/auth/logout', auth, (req,res)=>{ delete db.sessions[req.token]; writeDb(); res.json({ok:true}); });
app.get('/api/me', auth, (req,res)=>res.json({user:safeUser(req.user)}));
app.patch('/api/me', auth, (req,res)=>{
  const {name,avatar,prefs,gender,phone}=req.body||{};
  if (name)   req.user.name=String(name).trim().slice(0,80);
  if (typeof avatar==='string'&&avatar.length<1500000) req.user.avatar=avatar;
  if (prefs&&typeof prefs==='object') req.user.prefs=prefs;
  if (gender) req.user.gender=String(gender).trim().slice(0,40);
  if (phone)  req.user.phone=String(phone).trim().slice(0,20);
  writeDb(); res.json({user:safeUser(req.user)});
});
function safeUserFull(u) { return { ...safeUser(u), gender:u.gender||'', phone:u.phone||'' }; }

const rewardCatalog={chagee:500,grab:600,shopee:1000,uniqlo:1200,ntuc:550,starbucks:800};
app.post('/api/rewards/redeem', auth, role('student'), (req,res)=>{
  const rewardId=String(req.body?.rewardId||''); const cost=rewardCatalog[rewardId];
  if (!cost) return res.status(400).json({error:'That reward is not available.'});
  if (!Array.isArray(req.user.redeemed)) req.user.redeemed=[];
  if (req.user.points<cost) return res.status(400).json({error:'Not enough points for this reward.'});
  const code='GIVR-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  const redeemed={rewardId,code,date:new Date().toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'})};
  req.user.points-=cost; req.user.redeemed.push(redeemed); writeDb();
  res.json({ok:true,redeemed,totalPoints:req.user.points});
});

app.get('/api/events', (req,res)=>{
  res.json({events:db.events.map(ev=>{
    const {attendanceToken,attendees,completedBy,...e}=ev;
    if (!e.img) { const seed=seedEvents.find(s=>s.id===e.id); if (seed) e.img=seed.img; }
    return e;
  })});
});

app.get('/api/events/code/:code', (req,res)=>{
  const event=db.events.find(e=>String(e.eventCode).toLowerCase()===String(req.params.code).toLowerCase());
  if (!event) return res.status(404).json({error:'No event found for that code.'});
  const {attendanceToken,attendees,completedBy,...safe}=event;
  if (!safe.img) { const seed=seedEvents.find(s=>s.id===safe.id); if (seed) safe.img=seed.img; }
  res.json({event:safe});
});

app.post('/api/events', auth, role('organisation'), (req,res)=>{
  const {title,cause,date,time,location,desc,pts,slots,coverImage}=req.body||{};
  if (![title,cause,date,time,location,desc].every(v=>String(v||'').trim())) return res.status(400).json({error:'Please complete all event details.'});
  const id='org_'+crypto.randomBytes(6).toString('hex');
  const event={
    id, title:String(title).trim().slice(0,120),
    org:req.user.name, orgId:req.user.id,
    cause:String(cause),
    bg:CAUSE_BG[cause]||'#E8EDE4',
    coverImage:(typeof coverImage==='string'&&coverImage.length<2000000)?coverImage:null,
    date:String(date), time:String(time),
    location:String(location).trim(),
    dist:0, duration:2, durationLabel:'2 hrs',
    pts:Math.max(0,Math.min(1000,Number(pts)||100)),
    slots:Math.max(1,Math.min(500,Number(slots)||20)),
    desc:String(desc).trim().slice(0,1200),
    types:[String(cause).toLowerCase()],
    eventCode:makeEventCode(),
    attendanceToken:crypto.randomBytes(24).toString('hex'),
    attendees:[], completedBy:[],
    createdAt:new Date().toISOString()
  };
  db.events.unshift(event); writeDb();
  const {attendanceToken,attendees,completedBy,...safe}=event;
  res.status(201).json({event:safe,attendanceToken});
});

// Update event cover image
app.patch('/api/events/:id/cover', auth, role('organisation'), (req,res)=>{
  const event=db.events.find(e=>String(e.id)===String(req.params.id));
  if (!event) return res.status(404).json({error:'Event not found.'});
  if (event.orgId!==req.user.id) return res.status(403).json({error:'Not your event.'});
  const {coverImage}=req.body||{};
  if (typeof coverImage==='string'&&coverImage.length<2000000) event.coverImage=coverImage;
  writeDb();
  res.json({ok:true});
});

app.get('/api/org/events', auth, role('organisation'), (req,res)=>{
  const events=db.events.filter(e=>e.orgId===req.user.id).map(e=>({
    ...e,
    attendees:e.attendees.map(id=>{
      const u=db.users.find(x=>x.id===id);
      return u?{id:u.id,name:u.name,email:u.email,avatar:u.avatar||'',completed:e.completedBy.includes(id)}:null;
    }).filter(Boolean),
    attendanceToken:e.attendanceToken
  }));
  res.json({events});
});

app.post('/api/events/:id/join', auth, role('student'), (req,res)=>{
  const event=db.events.find(e=>String(e.id)===String(req.params.id));
  if (!event) return res.status(404).json({error:'Event not found.'});
  if (!event.attendees.includes(req.user.id)) event.attendees.push(req.user.id);
  writeDb(); res.json({ok:true,eventId:event.id,eventCode:event.eventCode});
});

app.post('/api/events/:id/complete', auth, role('student'), (req,res)=>{
  const event=db.events.find(e=>String(e.id)===String(req.params.id));
  if (!event) return res.status(404).json({error:'Event not found.'});
  const payload=String(req.body?.payload||'');
  const expected=`GIVR_ATTENDANCE:${event.id}:${event.attendanceToken}`;
  if (payload!==expected) return res.status(400).json({error:'This attendance QR code is invalid.'});
  if (!event.attendees.includes(req.user.id)) return res.status(403).json({error:'Sign up for this event before checking out.'});
  if (event.completedBy.includes(req.user.id)) return res.status(409).json({error:'You have already checked out for this event.'});
  event.completedBy.push(req.user.id);
  req.user.points=(req.user.points||0)+(Number(event.pts)||0);
  writeDb(); res.json({ok:true,pointsEarned:Number(event.pts)||0,totalPoints:req.user.points,eventTitle:event.title});
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`Givr running at http://localhost:${PORT}`));