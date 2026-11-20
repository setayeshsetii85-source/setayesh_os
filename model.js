export const days=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

export const subjects=[
 'دانش فنی پایه','دانش فنی تخصصی','وجوه نقد و دفاتر قانونی',
 'خرید و فروش','اموال و انبار','حقوق و دستمزد',
 'بهای تمام‌شده و مالیاتی','صورت‌های مالی',
 'ریاضی ۱','ریاضی ۲','فیزیک','شیمی',
 'فارسی ۳','عربی ۳','تعلیمات دینی ۳',
 'زبان خارجی ۱','زبان خارجی ۲',
 'کارگاه نوآوری و کارآفرینی','اخلاق حرفه‌ای',
 'مدیریت تولید','الزامات محیط کار'
];

export const categories=[
 'مطالعه','مرور','مدرسه','زبان','پروژه','ورزش','استراحت','شخصی'
];

export const defaults={
 targetSchool:240,
 targetFree:360,
 schoolStart:'',
 wake:'05:00',
 sleep:'21:00',
 english:20,
 negative:true
};

export const iso=(d=new Date())=>
 `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export const dateOf=s=>new Date(`${s}T12:00:00`);

export function addDays(s,n){
 const d=dateOf(s);
 d.setDate(d.getDate()+n);
 return iso(d);
}

export const weekday=s=>(dateOf(s).getDay()+1)%7;

export const weekStart=s=>addDays(s,-weekday(s));

export const num=n=>new Intl.NumberFormat('fa-IR',{
 maximumFractionDigits:1
}).format(Number.isFinite(+n)?+n:0);

export const pretty=s=>s?
 new Intl.DateTimeFormat('fa-IR-u-ca-persian',{
  dateStyle:'full'
 }).format(dateOf(s)):'—';

export const time=s=>String(s||'—').replace(/[0-9]/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x]);

export const mins=s=>{
 const [h,m]=String(s).split(':').map(Number);
 return h*60+m;
};

const hm=n=>
 `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;

export const elapsed=(a,b)=>
 (mins(b)-mins(a)+1440)%1440;

export const duration=n=>{
 n=Math.max(0,Math.round(Number(n)||0));
 return `${n>=60?`${num(Math.floor(n/60))} ساعت${n%60?' و ':''}`:''}${n%60||!n?`${num(n%60)} دقیقه`:''}`;
};

export const target=(s,settings)=>
 weekday(s)<5?+settings.targetSchool:+settings.targetFree;

export function plan(day,settings){
 const w=weekday(day),result=[];

 const a=(start,end,title,category,fixed=false)=>
  result.push({
   id:`${day}:${result.length}:${category}`,
   date:day,start,end,title,category,
   fixed,template:true,status:'باز'
  });

 const study=(s,e,i)=>
  a(s,e,[
   'مطالعه تخصصی','تست و تحلیل','مرور و بازیابی',
   'تمرین محاسباتی','آزمون و تحلیل'
  ][i],'مطالعه');

 const project=w%2===0||w===6?'آقای اسپیگات':'ویترا';

 if(w<5){
  const leave=settings.schoolStart?
   mins(settings.schoolStart)-45:390;

  const morningEnd=Math.min(
   390,leave-15*(!!settings.schoolStart)
  );

  const morningStart=Math.max(
   330,mins(settings.wake)+30
  );

  if(morningEnd-morningStart>=20)
   study(hm(morningStart),hm(morningEnd),0);
  else result.push(null);

  const schoolEnd=w===0?'13:00':'13:45';
  const arrive=w===0?'13:45':'14:30';
  const start=w===0?'14:45':'15:30';

  a(settings.schoolStart||'',schoolEnd,'مدرسه','مدرسه',true);
  a(schoolEnd,arrive,'رفت‌وآمد تا خانه','استراحت',true);
  a(arrive,start,'غذا و استراحت','استراحت',true);

  if(w===0){
   study(start,'15:45',1);
   study('16:00','17:00',2);
   a('17:00','17:30','پیگیری مشتریان اسپیگات','پروژه');
   a('17:40','18:10',`تولید محتوا · ${project}`,'پروژه');
   a('18:15',hm(1095+Math.min(45,+settings.english)),'تمرین انگلیسی','زبان');
  }else{
   study(start,'16:30',1);
   study('16:45','17:45',2);
   a('17:45','18:15','پیگیری مشتریان اسپیگات','پروژه');
   a('18:25','18:55',`تولید محتوا · ${project}`,'پروژه');
   a('19:00',hm(1140+Math.min(45,+settings.english)),'تمرین انگلیسی','زبان');
  }
 }else{
  const offset=Math.max(0,mins(settings.wake)+30-360);

  [[360,420],[435,495],[510,570],[600,660],[960,1020]]
   .forEach(([s,e],i)=>
    study(
     hm(s+(i<4?offset:0)),
     hm(e+(i<4?offset:0)),
     i
    )
   );

  a('17:15','17:45','پیگیری مشتریان اسپیگات','پروژه');
  a('17:55','18:30',`تولید محتوا · ${project}`,'پروژه');
  a('18:40',hm(1120+Math.min(45,+settings.english)),'تمرین انگلیسی','زبان');
 }

 if(w===0)a('19:00','19:25','ورزش سبک','ورزش');
 if(w===1||w===3)a('19:20','19:45','مهارت منتخب یا تکلیف ضروری','شخصی');
 if(w===2||w===4)a('19:20','19:45','پیاده‌روی یا تحرک سبک','ورزش');
 if(w>=5)a('15:35','15:55',w===5?'تمرین مهارت منتخب':'تفریح یا ریکاوری','شخصی');

 const kept=[];

 for(const x of result.filter(x=>
  x&&(x.fixed||mins(x.end)<=Math.min(1200,mins(settings.sleep)-15))
  )){
  if(!x.start||!clashes(kept,x))kept.push(x);
 }

 return kept;
}

export function agenda(state,date){
 const base=plan(date,state.settings)
  .map(t=>({...t,...state.overrides[t.id]}));

 return [
  ...base,
  ...state.items.filter(x=>x.type==='task'&&x.date===date)
 ].filter(x=>
  x.status!=='حذف'&&x.date===date
 ).sort((a,b)=>
  (a.start||'00:00').localeCompare(b.start||'00:00')
 );
}

export function clashes(rows,item){
 return rows.some(x=>
  x.id!==item.id&&x.start&&x.end&&
  mins(x.start)<mins(item.end)&&
  mins(x.end)>mins(item.start)
 );
}

export function suggestSlot(state,item,from){
 const len=mins(item.end)-mins(item.start);
 if(!(len>0))return null;

 const date=addDays(from,1);
 const rows=agenda(state,date);
 const limit=Math.min(1200,mins(state.settings.sleep)-30);

 const available=Math.max(
  weekday(date)<5?(weekday(date)===0?1065:1080):600,
  mins(state.settings.wake)+30
 );

 for(let m=available;m+len<=limit;m+=5){
  const slot={date,start:hm(m),end:hm(m+len)};

  if(
   !clashes(rows.map(x=>x.start?{
    ...x,
    start:hm(Math.max(0,mins(x.start)-5)),
    end:hm(Math.min(1439,mins(x.end)+5))
   }:x),slot)&&
   !(m<1170&&m+len>1110)
  )return slot;
 }

 return null;
}

export const pct=(c,w,n,negative)=>
 n?100*(c-(negative?w/3:0))/n:null;

const jalali=new Intl.DateTimeFormat('en-u-ca-persian',{
 year:'numeric',
 month:'numeric'
});

export const monthKey=s=>jalali.format(dateOf(s));

export function range(date,mode){
 if(mode==='روزانه')return [date];

 if(mode==='هفتگی')
  return Array.from({length:7},(_,i)=>
   addDays(weekStart(date),i)
  );

 const k=monthKey(date);
 let d=date;

 while(monthKey(addDays(d,-1))===k)
  d=addDays(d,-1);

 const list=[];

 while(monthKey(d)===k){
  list.push(d);
  d=addDays(d,1);
 }

 return list;
}

/* پیدا کردن دوره قبلی برای مقایسه گزارش‌ها */
export function previousRange(date,mode){
 if(mode==='روزانه')
  return [addDays(date,-1)];

 if(mode==='هفتگی')
  return range(addDays(date,-7),'هفتگی');

 const current=range(date,'ماهانه');
 return range(addDays(current[0],-1),'ماهانه');
}

export function stats(state,list){
 const all=state.items.filter(x=>list.includes(x.date));
 const study=all.filter(x=>x.type==='study');

 const sum=(arr,key)=>
  arr.reduce((a,x)=>a+(+x[key]||0),0);

 const test=sum(study,'tests');
 const correct=sum(study,'correct');
 const wrong=sum(study,'wrong');

 return {
  all,
  study,
  m:sum(study,'minutes')+
   sum(all.filter(x=>x.type==='video'),'active'),
  test,
  correct,
  wrong,
  percent:pct(correct,wrong,test,state.settings.negative),
  goal:list.reduce((a,d)=>a+target(d,state.settings),0),
  english:sum(all.filter(x=>x.type==='english'),'minutes'),
  exercise:sum(all.filter(x=>x.type==='exercise'),'minutes'),
  phone:sum(all.filter(x=>x.type==='phone'),'minutes'),
  sleep:all.filter(x=>x.type==='sleep').map(x=>elapsed(x.bed,x.wake)),
  tasks:list.flatMap(d=>
   agenda(state,d).filter(x=>!x.fixed)
  )
 };
}

/* آمار تفکیکی درس‌ها */
export function subjectStats(state,list){
 const st=stats(state,list);

 return subjects.map(subject=>{
  const rows=st.study.filter(x=>x.subject===subject);

  const sum=key=>
   rows.reduce((a,x)=>a+(+x[key]||0),0);

  const tests=sum('tests');
  const correct=sum('correct');
  const wrong=sum('wrong');

  return {
   subject,
   minutes:sum('minutes'),
   tests,
   correct,
   wrong,
   blank:sum('blank'),
   percent:pct(correct,wrong,tests,state.settings.negative),
   sessions:rows.length
  };
 }).filter(x=>x.minutes||x.tests||x.sessions);
}

/* آمار فعالیت روزانه و استمرار */
export function activityStats(state,list){
 const daily=list.map(date=>{
  const s=stats(state,[date]);
  const active=
   s.m>0||s.english>0||s.exercise>0||
   s.all.some(x=>x.type==='journal');

  return {
   date,
   minutes:s.m,
   goal:s.goal,
   goalReached:s.goal>0&&s.m>=s.goal,
   english:s.english,
   exercise:s.exercise,
   active
  };
 });

 const activeDays=daily.filter(x=>x.active).length;
 const goalDays=daily.filter(x=>x.goalReached).length;
 const studyDays=daily.filter(x=>x.minutes>0).length;

 let currentStreak=0,maxStreak=0,previous=null;

 for(const day of daily){
  if(day.active){
   currentStreak=previous&&addDays(previous,1)===day.date?
    currentStreak+1:1;
   maxStreak=Math.max(maxStreak,currentStreak);
  }else{
   currentStreak=0;
  }
  previous=day.date;
 }

 const totalMinutes=daily.reduce((a,x)=>a+x.minutes,0);

 return {
  daily,
  totalDays:list.length,
  activeDays,
  studyDays,
  goalDays,
  currentStreak,
  maxStreak,
  totalMinutes,
  averageMinutes:list.length?totalMinutes/list.length:0,
  activePercent:list.length?100*activeDays/list.length:0,
  goalPercent:list.length?100*goalDays/list.length:0
 };
}

/* آمار عادت‌ها بر اساس روزهای دارای رکورد */
export function habitStats(state,list){
 const types=[
  ['مطالعه','study'],
  ['زبان','english'],
  ['ورزش','exercise'],
  ['بازنگری','journal']
 ];

 return types.map(([label,type])=>{
  const dates=new Set(
   state.items
    .filter(x=>list.includes(x.date)&&x.type===type)
    .map(x=>x.date)
  );

  return {
   label,
   days:dates.size,
   totalDays:list.length,
   percent:list.length?100*dates.size/list.length:0
  };
 });
}

/* تحلیل خطاهای ثبت‌شده */
export function errorStats(state,list){
 const errors=state.items.filter(x=>
  list.includes(x.date)&&x.type==='error'
 );

 const counts=new Map();

 for(const x of errors){
  const cause=x.cause||'علت ثبت نشده';
  counts.set(cause,(counts.get(cause)||0)+1);
 }

 return [...counts.entries()]
  .map(([cause,count])=>({cause,count}))
  .sort((a,b)=>b.count-a.count);
}

/* خلاصه قابل استفاده در گزارش‌های هوشمند */
export function reportAnalysis(state,list){
 const s=stats(state,list);
 const activity=activityStats(state,list);
 const habits=habitStats(state,list);
 const subjectsData=subjectStats(state,list);
 const errors=errorStats(state,list);

 const completed=s.tasks.filter(x=>x.status==='انجام شد').length;
 const open=s.tasks.length-completed;

 return {
  ...s,
  activity,
  habits,
  subjects:subjectsData,
  errors,
  completedTasks:completed,
  openTasks:open,
  taskPercent:s.tasks.length?
   100*completed/s.tasks.length:0,
  sleepAverage:s.sleep.length?
   s.sleep.reduce((a,b)=>a+b,0)/s.sleep.length:null
 };
}

export const empty=()=>({
 version:1,
 rev:0,
 items:[],
 overrides:{},
 settings:{...defaults}
});
