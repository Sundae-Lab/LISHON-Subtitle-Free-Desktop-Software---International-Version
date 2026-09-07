const test=require('node:test'),assert=require('node:assert/strict');
const {widthForLevel,levelForWidth}=require('../electron/subtitle-width.cjs');
const {cleanSettings}=require('../electron/core.cjs');
test('existing ten width settings remain unchanged and new levels reach 3840',()=>{
 for(let level=1;level<=20;level++){
  const expected=level<=10?400+(level-1)*120:1480+(level-10)*236;
  assert.equal(cleanSettings({widthLevel:level}).overlayWidth,expected);
  assert.equal(cleanSettings({overlayWidth:expected}).widthLevel,level);
  assert.equal(levelForWidth(widthForLevel(level)),level);
 }
 assert.equal(widthForLevel(100),3840);assert.equal(widthForLevel(-1),400);
 assert.equal(cleanSettings({}).overlayWidth,760);
});
test('dragging snaps to adjacent widths including the transition to added levels',()=>{
 for(let level=1;level<20;level++){
  const midpoint=(widthForLevel(level)+widthForLevel(level+1))/2;
  assert.equal(levelForWidth(midpoint-.1),level);
  assert.equal(levelForWidth(midpoint),level+1);
 }
 assert.equal(levelForWidth(99999),20);assert.equal(levelForWidth(-100),1);
});
