function createTranslationRouter({ai,rpc}){
 async function translate(args,channel='text'){return ai.enabled()?ai.translate(args,channel):rpc('translate',args);}
 async function transcribe(args,{channel='audio',current=()=>true,onSegment=()=>{},timeout=120000}={}){
  const online=ai.enabled(),started=Date.now();
  let result;
  try { result=await rpc('transcribe',{...args,...(online?{source:'auto',recognizeOnly:true}:{})},timeout); }
  catch(error){if(!current())return {segments:[],ms:Date.now()-started};throw error;}
  if(!current())return {...result,segments:[]};
  if(!online)return result;
  const segments=[];
  for(const item of result.segments){
   if(!current())break;
   const translation=await ai.translate({...args,text:item.text,source:result.source},channel);
   if(!current())break;
   const next={...translation,start:item.start,end:item.end};segments.push(next);onSegment(next);
  }
  return {...result,segments,ms:Date.now()-started};
 }
 return {translate,transcribe};
}
module.exports={createTranslationRouter};
