const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function resizeRegion(b,corner,axis,dx,dy,area){
 let {x,y,width,height}=b;const right=x+width,bottom=y+height;
 if(axis==='x'){if(corner.includes('w')){x=clamp(x+dx,area.x,right-60);width=right-x;}else width=clamp(width+dx,60,area.x+area.width-x);}
 if(axis==='y'){if(corner.includes('n')){y=clamp(y+dy,area.y,bottom-24);height=bottom-y;}else height=clamp(height+dy,24,area.y+area.height-y);}
 return Object.fromEntries(Object.entries({x,y,width,height}).map(([k,v])=>[k,Math.round(v)]));
}
function moveBounds(b,dx,dy,area){return {...b,x:Math.round(clamp(b.x+dx,area.x-b.width+100,area.x+area.width-100)),y:Math.round(clamp(b.y+dy,area.y,area.y+area.height-30))};}
module.exports={resizeRegion,moveBounds};
