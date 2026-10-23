import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createMagicBackground } from '@mockup-studio/render';
import { createScene, validateScene } from '@mockup-studio/core';
const factory=(w:number,h:number)=>createCanvas(w,h) as unknown as HTMLCanvasElement;
const image=()=>{const c=createCanvas(80,80),ctx=c.getContext('2d');ctx.fillStyle='#f04070';ctx.fillRect(0,0,40,80);ctx.fillStyle='#3040d0';ctx.fillRect(40,0,40,80);return c as unknown as CanvasImageSource;};
test('media-derived backgrounds are deterministic, valid and use sampled colors',()=>{
 const options={canvasFactory:factory,colors:3};const a=createMagicBackground(image(),options),b=createMagicBackground(image(),options);
 assert.deepEqual(a,b);assert.ok(a.palette.includes('#f04070'));assert.ok(a.palette.includes('#3040d0'));assert.deepEqual(validateScene(createScene({background:a.background})),[]);
});
test('monochrome media receives useful derived stops and optional motion',()=>{const c=createCanvas(20,20);c.getContext('2d').fillStyle='#666666';c.getContext('2d').fillRect(0,0,20,20);const a=createMagicBackground(c as unknown as CanvasImageSource,{canvasFactory:factory,colors:4,animated:true});assert.equal(a.palette.length,4);assert.ok(new Set(a.palette).size>1);assert.equal(a.background.type,'gradient');assert.ok(a.background.type==='gradient'&&a.background.speed);});
test('transparent sources and invalid palette options fail explicitly',()=>{const c=createCanvas(20,20);assert.throws(()=>createMagicBackground(c as unknown as CanvasImageSource,{canvasFactory:factory}),/opaque/);for(const colors of [1,7,2.5,NaN])assert.throws(()=>createMagicBackground(image(),{colors,canvasFactory:factory}),/2–6/);});
test('tainted canvas sampling reports a CORS action rather than a fake palette',()=>{const canvas={width:1,height:1,getContext:()=>({drawImage(){},getImageData(){throw new Error('SecurityError');}})} as unknown as HTMLCanvasElement;assert.throws(()=>createMagicBackground(image(),{canvasFactory:()=>canvas}),/CORS/);});
