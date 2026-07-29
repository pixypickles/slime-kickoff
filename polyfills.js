'use strict';
// 古いAndroid WebView向け互換処理。roundRect未対応でも描画処理を止めない。
if(typeof CanvasRenderingContext2D!=='undefined'&&!CanvasRenderingContext2D.prototype.roundRect){
 CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
  let radius=Array.isArray(r)?Number(r[0]||0):Number(r||0);
  radius=Math.max(0,Math.min(radius,Math.abs(w)/2,Math.abs(h)/2));
  this.moveTo(x+radius,y);this.lineTo(x+w-radius,y);this.quadraticCurveTo(x+w,y,x+w,y+radius);
  this.lineTo(x+w,y+h-radius);this.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
  this.lineTo(x+radius,y+h);this.quadraticCurveTo(x,y+h,x,y+h-radius);
  this.lineTo(x,y+radius);this.quadraticCurveTo(x,y,x+radius,y);this.closePath();return this;
 };
}
