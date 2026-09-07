const broken=error=>['EPIPE','ERR_STREAM_DESTROYED','ECONNRESET'].includes(error?.code);
function protectConsole(stream){
 if(!stream||stream.__lishonProtected)return;
 stream.__lishonProtected=true;let closed=false;const write=stream.write;
 // A desktop app may outlive the terminal that launched it. Never let logging crash it.
 stream.on('error',error=>{if(broken(error))closed=true;else throw error;});
 stream.write=function(...args){
  if(closed||stream.destroyed){const callback=args.at(-1);if(typeof callback==='function')queueMicrotask(()=>callback());return true;}
  try{return write.apply(this,args);}catch(error){if(!broken(error))throw error;closed=true;return true;}
 };
}
function safeWrite(stream,data,onError=()=>{}){
 let reported=false;const fail=error=>{if(!reported){reported=true;onError(error);}};
 if(!stream||stream.destroyed||!stream.writable){fail(Object.assign(new Error('后台组件连接已关闭，请重试'),{code:'EPIPE'}));return false;}
 try{return stream.write(data,error=>{if(error)fail(error);});}catch(error){fail(error);return false;}
}
module.exports={protectConsole,safeWrite};
