const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {attachReader}=require('../electron/reader-docking.cjs');
class Window extends EventEmitter{
 constructor(bounds,rounded=false){super();this.bounds=bounds;this.rounded=rounded;this.full=false;this.calls=0;}
 isDestroyed(){return false;}isFullScreen(){return this.full;}getBounds(){return {...this.bounds};}
 setBounds(b){this.calls++;this.bounds={...b,width:b.width+(this.rounded?1:0),height:b.height+(this.rounded?1:0)};this.emit('move');this.emit('resize');}
 hide(){}showInactive(){}
}
const wait=()=>new Promise(resolve=>setTimeout(resolve,25));
test('rounded native bounds never feed back into reader sizes, including repeated fullscreen restores',async()=>{
 const m=new Window({x:20,y:30,width:820,height:700}),r=new Window({x:0,y:0,width:400,height:700},true),d=attachReader({main:m,reader:r,width:400,height:700});
 for(let i=0;i<30;i++){m.bounds.x=i*3;m.emit('move');await wait();assert.equal(r.bounds.width,401);assert.equal(r.bounds.height,701);}
 for(let i=0;i<20;i++){d.beforeFullscreen();r.full=true;r.emit('enter-full-screen');r.bounds={x:0,y:0,width:2560,height:1440};r.full=false;r.emit('leave-full-screen');await wait();assert.equal(r.bounds.width,401);assert.equal(r.bounds.height,701);}
 d.dispose();assert.equal(m.listenerCount('move'),0);
});
test('detached readers stay independent, snap after release, and follow deliberate main resizing',async()=>{
 const m=new Window({x:20,y:30,width:820,height:700}),r=new Window({x:0,y:0,width:400,height:700}),d=attachReader({main:m,reader:r,width:400,height:700});
 r.emit('will-move');r.bounds.x=200;r.emit('moved');m.bounds.x=80;m.emit('move');await wait();assert.equal(r.bounds.x,200);
 r.emit('will-move');r.bounds.x=890;r.bounds.y=60;r.emit('moved');assert.equal(r.bounds.x,900);assert.equal(r.bounds.y,30);
 m.bounds.height=800;m.emit('resize');await wait();assert.equal(r.bounds.height,800);
 r.emit('will-move');r.bounds.x=200;r.emit('moved');d.beforeFullscreen();r.full=true;r.bounds={x:0,y:0,width:2560,height:1440};r.full=false;r.emit('leave-full-screen');await wait();assert.equal(r.bounds.x,200);assert.equal(r.bounds.height,800);d.dispose();
});
