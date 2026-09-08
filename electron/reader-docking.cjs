// Keep requested sizes separate from Windows' rounded getBounds results.
// At 150% DPI a getBounds -> setBounds size round trip can add one DIP.
function attachReader({main,reader,screen,width,height}){
 let docked=true,dragging=false,applying=false,timer=null,lastMainHeight=main.getBounds().height;
 let size={width,height},freeBounds=null;
 const active=()=>!main.isDestroyed()&&!reader.isDestroyed();
 function place(bounds){if(!active())return;applying=true;try{reader.setBounds({...bounds,...size},false);}finally{applying=false;}}
 function sync(){timer=null;if(!active()||!docked||dragging||reader.isFullScreen())return;
  const b=main.getBounds();
  place({x:Math.round(b.x+b.width),y:b.y});
 }
 function schedule(){if(!timer)timer=setTimeout(sync,16);}
 function mainResize(){const height=main.getBounds().height;if(Math.abs(height-lastMainHeight)>2){lastMainHeight=height;if(docked)size.height=Math.max(360,height);schedule();}}
 function willMove(){if(applying||reader.isFullScreen())return;dragging=true;docked=false;clearTimeout(timer);timer=null;}
 function moved(){if(!dragging||applying||!active())return;dragging=false;const b=main.getBounds(),r=reader.getBounds();
  // Require both proximity and vertical overlap; release before snapping.
  const overlap=Math.min(b.y+b.height,r.y+r.height)-Math.max(b.y,r.y);
  if(Math.abs(r.x-(b.x+b.width))<=28&&overlap>=Math.min(120,b.height/3)){
   docked=true;size.height=Math.max(360,b.height);lastMainHeight=b.height;sync();
  }else{freeBounds={x:r.x,y:r.y};}
 }
 function willResize(event,bounds){if(applying||reader.isFullScreen())return;docked=false;dragging=false;size={width:Math.max(360,bounds.width),height:Math.max(360,bounds.height)};}
 function enterFull(){const b=reader.getBounds();freeBounds={x:b.x,y:b.y};}
 function leaveFull(){setImmediate(()=>{if(!active())return;if(docked)sync();else if(freeBounds)place(freeBounds);});}
 function hide(){if(active()&&docked)reader.hide();}
 function show(){if(active()&&docked){sync();reader.showInactive();}}
 main.on('move',schedule);main.on('resize',mainResize);main.on('minimize',hide);main.on('restore',show);
 reader.on('will-move',willMove);reader.on('moved',moved);reader.on('will-resize',willResize);reader.on('leave-full-screen',leaveFull);
 sync();
 return {beforeFullscreen:enterFull,dispose(){clearTimeout(timer);main.removeListener('move',schedule);main.removeListener('resize',mainResize);main.removeListener('minimize',hide);main.removeListener('restore',show);reader.removeListener('will-move',willMove);reader.removeListener('moved',moved);reader.removeListener('will-resize',willResize);reader.removeListener('leave-full-screen',leaveFull);}};
}
module.exports={attachReader};
