// Desktop capture must never sample a capture-visible copy of its own subtitles.
function capturePolicy(settings) {
 const allowed=settings.allowSubtitleCapture!==false;
 const blur=settings.backgroundEnabled&&settings.backgroundBlur&&settings.backgroundOpacity<100;
 return {protected:!allowed,nativeBlur:!!(blur&&allowed),desktopBlur:!!(blur&&!allowed)};
}
module.exports={capturePolicy};
