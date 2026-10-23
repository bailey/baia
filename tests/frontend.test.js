const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const html = fs.readFileSync('index.html','utf8');
const script = fs.readFileSync('script.js','utf8');
const flush = () => new Promise(resolve=>setImmediate(resolve));
function fixture({storageBlocked=false, response, reduced=false}={}) {
  const dom = new JSDOM(html,{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window, intervals=[], requests=[];
  let hidden=false;
  Object.defineProperty(w.document,'hidden',{get:()=>hidden});
  w.console.warn=()=>{};
  w.matchMedia=()=>({matches:reduced,addEventListener(){}});
  w.setInterval=(fn)=>{intervals.push(fn);return intervals.length;};
  w.HTMLElement.prototype.animate=function(){return {};};
  if (storageBlocked) for (const key of ['localStorage','sessionStorage']) Object.defineProperty(w,key,{get(){throw new Error('storage denied');}});
  w.fetch=async(url, options={})=>{
    requests.push([url,options]);
    return response ? response(url,options) : {ok:true,json:async()=>({count:1,messages:[]})};
  };
  w.eval(script + "\nwindow.TestApp = App;"); // THREE is deliberately absent: all desktop features must survive.
  return {w,dom,intervals,requests,setHidden(value){hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'));}};
}

test('desktop initializes despite missing WebGL and blocked storage', async () => {
  const f=fixture({storageBlocked:true}); const d=f.w.document;
  d.querySelector('[data-window="projects"]').click();
  assert.ok(d.getElementById('osWindow').classList.contains('is-open'));
  assert.equal(d.getElementById('osWindow').getAttribute('aria-hidden'),'false');
  assert.equal(d.activeElement.id,'osWindowClose');
  d.getElementById('osWindowClose').click();
  assert.equal(d.getElementById('osWindow').inert,true);
  assert.equal(d.activeElement.dataset.window,'projects');
  d.getElementById('osMenuButton').click(); await flush();
  assert.equal(d.getElementById('osStartMenu').inert,false);
  assert.equal(d.getElementById('osMenuButton').getAttribute('aria-expanded'),'true');
  f.dom.window.close();
});

test('modal is exposed while open, contains Tab, and hides on Escape', () => {
  const f=fixture(); const d=f.w.document;
  f.w.showOsModal('Test','Body');
  assert.equal(d.getElementById('osModal').getAttribute('aria-hidden'),'false');
  assert.equal(d.activeElement.id,'osModalClose');
  const tab=new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});
  d.activeElement.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented,true);
  d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape'}));
  assert.equal(d.getElementById('osModal').inert,true);
  f.dom.window.close();
});

test('Wall surfaces HTTP failures and restores posting/deletion controls', async () => {
  let failList=true;
  const f=fixture({response:(url,options)=>({ok:url.includes('presence') || (!options.method && !failList),status:429,json:async()=>({messages:[{id:'test',name:'name',message:'hello',ts:0}]})})});
  const d=f.w.document;
  f.w.localStorage.setItem('thewallTokens',JSON.stringify({test:'secret'}));
  d.querySelector('[data-window="thewall"]').click(); await flush();
  assert.match(d.getElementById('thewallFeed').textContent,/couldn't reach/);
  failList=false;
  f.intervals.forEach(fn=>fn()); await flush();
  const del=d.querySelector('.os-thewall-delete'); del.click(); await flush();
  assert.equal(del.disabled,false);
  assert.match(d.getElementById('thewallStatus').textContent,/wait/);
  d.getElementById('thewallMessage').value='preserve me';
  d.getElementById('thewallForm').dispatchEvent(new f.w.Event('submit',{cancelable:true})); await flush();
  assert.equal(d.querySelector('.os-thewall-submit').disabled,false);
  assert.equal(d.getElementById('thewallMessage').value,'preserve me');
  assert.match(d.getElementById('thewallStatus').textContent,/20 seconds/);
  f.dom.window.close();
});

test('hidden tabs suspend presence and Wall polling and resume on visibility', async () => {
  const f=fixture(); f.w.document.querySelector('[data-window="thewall"]').click(); await flush();
  f.setHidden(true); f.requests.length=0;
  f.intervals.forEach(fn=>fn()); await flush();
  assert.equal(f.requests.length,0);
  f.setHidden(false); await flush();
  assert.deepEqual(f.requests.map(r=>r[0]).sort(),['/api/messages','/api/presence']);
  f.dom.window.close();
});

test('reduced-motion and visibility changes stop and restart WebGL frames', () => {
  const f=fixture(); const w=f.w;
  const app=Object.create(w.TestApp.prototype);
  let renders=0,scheduled=0,cancelled=0;
  app.frame=null;app.motionPreference={matches:true};app.clock={getDelta(){}};app.render=()=>renders++;
  w.requestAnimationFrame=()=>++scheduled;w.cancelAnimationFrame=()=>cancelled++;
  app.syncAnimation(); assert.equal(renders,1);assert.equal(scheduled,0);
  app.motionPreference.matches=false;app.syncAnimation();assert.equal(scheduled,1);
  f.setHidden(true);app.syncAnimation();assert.equal(cancelled,1);assert.equal(app.frame,null);
  f.dom.window.close();
});
