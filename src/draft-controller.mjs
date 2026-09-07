// A single in-flight request with a replaceable latest draft. Older results never reach the UI.
export class DraftController {
  constructor({translate,onDraft,onResult,onBusy,onError,delay=420}) {
    Object.assign(this,{translate,onDraft,onResult,onBusy,onError,delay});
    this.revision=0;this.value='';this.pending=null;this.running=false;this.disposed=false;
  }
  edit(value,{immediate=false}={}) {
    value=value.replace(/\r\n/g,'\n');
    this.value=value;const revision=++this.revision;clearTimeout(this.timer);this.pending=null;
    this.onDraft(value);this.onResult(null);this.onBusy(false);
    if(!value.trim())return;
    if(immediate)this.enqueue(revision);else this.timer=setTimeout(()=>this.enqueue(revision),this.delay);
  }
  refresh(){this.edit(this.value);}
  submit(){clearTimeout(this.timer);if(this.value.trim())this.enqueue(this.revision);}
  enqueue(revision){
    if(this.disposed||revision!==this.revision)return;
    if(this.activeRevision===revision)return;
    this.pending={text:this.value,revision};this.onBusy(true);this.pump();
  }
  async pump(){
    if(this.running)return;this.running=true;
    try{
      while(this.pending&&!this.disposed){
        const job=this.pending;this.pending=null;this.activeRevision=job.revision;
        try{const result=await this.translate(job.text);if(!this.disposed&&job.revision===this.revision)this.onResult(result);}
        catch(error){if(!this.disposed&&job.revision===this.revision)this.onError(error);}
        finally{if(!this.disposed&&job.revision===this.revision)this.onBusy(false);this.activeRevision=null;}
      }
    }finally{this.running=false;}
  }
  dispose(){this.disposed=true;clearTimeout(this.timer);this.pending=null;this.revision++;}
}
