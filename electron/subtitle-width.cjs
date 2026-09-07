// Preserve existing widths; the ten additional levels extend to 4K width.
const widths=Object.freeze(Array.from({length:20},(_,i)=>i<10?400+i*120:1480+(i-9)*236));
function widthLevel(value){return Number.isFinite(value)?Math.max(1,Math.min(widths.length,Math.round(value))):4;}
function widthForLevel(value){return widths[widthLevel(value)-1];}
function levelForWidth(value){
 if(!Number.isFinite(value))return 4;
 let nearest=0;
 for(let i=1;i<widths.length;i++)if(Math.abs(widths[i]-value)<=Math.abs(widths[nearest]-value))nearest=i;
 return nearest+1;
}
module.exports={widthLevel,widthForLevel,levelForWidth};
