// Expected operation failures are data, so Electron does not log them to a closed stderr pipe.
async function reply(operation){try{return {lishonReply:1,ok:true,value:await operation()};}catch(error){return {lishonReply:1,ok:false,error:String(error?.message||'操作失败，请重试').slice(0,1000)};}}
module.exports={reply};
