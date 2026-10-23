import { chromium } from '@playwright/test';
import binary from '@sparticuz/chromium';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);await mkdir('artifacts',{recursive:true});
const results=[];
const pass=(name,details)=>{results.push({name,passed:true,...details});console.log('PASS',name);};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);if(relative.includes('..')){res.writeHead(403);res.end();return;}const bytes=await readFile(path.join(root,'apps/demo/dist',relative));res.setHeader('Content-Type',relative.endsWith('.js')?'text/javascript':relative.endsWith('.map')?'application/json':'text/html');res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const localChromium=process.env.CHROMIUM_PATH;const browser=await chromium.launch({executablePath:localChromium||await binary.executablePath(),args:localChromium?[]:binary.args,headless:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.mockupStudio&&document.querySelector('canvas').width>500);await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.mockupStudio.getScene().nodes.length),4);pass('demo mounts from public SDK');
 await page.screenshot({path:'artifacts/editor-desktop.png'});
 const original=await page.evaluate(()=>{window.changes=0;window.mockupStudio.store.subscribe(()=>window.changes++);return window.mockupStudio.getScene().nodes.at(-1);});
 const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.56);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.66,{steps:8});await page.mouse.up();
 const drag=await page.evaluate(()=>({node:window.mockupStudio.getScene().nodes.at(-1),changes:window.changes}));assert.equal(drag.changes,1);assert.ok(Math.abs(drag.node.x-original.x-144)<1);assert.ok(Math.abs(drag.node.y-original.y-108)<1);
 await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>window.mockupStudio.getScene().nodes.at(-1).x),original.x);pass('pointer dragging creates one undo step');
 await page.getByRole('button',{name:'Shape',exact:true}).click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();assert.equal(await page.evaluate(()=>window.mockupStudio.getScene().nodes.length),6);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.evaluate(()=>window.mockupStudio.getScene().nodes.length),5);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await page.evaluate(()=>window.mockupStudio.getScene().nodes.length),6);pass('layers duplicate undo redo');
 await page.getByLabel('Project name',{exact:true}).fill('Safe <img src=x onerror=alert(1)>');await page.getByLabel('Project name',{exact:true}).press('Tab');
 await page.getByRole('button',{name:'Manage studio',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();const saved=await download;const project=JSON.parse(await readFile(await saved.path(),'utf8'));assert.equal(project.name,'Safe <img src=x onerror=alert(1)>');assert.ok(project.assets.every(a=>a.src.startsWith('data:')));pass('portable JSON and inert user strings');
 await page.locator('input[type=file]').first().setInputFiles(path.join(root,'artifacts/render-fixture.png'));await page.waitForFunction(()=>window.mockupStudio.getScene().assets.length===2);assert.ok(await page.evaluate(()=>window.mockupStudio.getScene().assets[1].src.startsWith('data:image/png;base64,')));pass('real PNG import and data URL persistence');
 await page.locator('input[type=file]').nth(1).setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.waitForFunction(()=>window.mockupStudio.getScene().assets.length===1);pass('validated JSON reload');
 await page.getByText('Motion',{exact:true}).click();await page.getByRole('button',{name:'Apply motion',exact:true}).click();assert.ok(await page.evaluate(()=>window.mockupStudio.getScene().tracks.length>0));await page.locator('.ms-timeline > summary').click();await page.getByRole('button',{name:'Play preview',exact:true}).click();await page.waitForTimeout(300);await page.getByRole('button',{name:'Pause preview',exact:true}).click();pass('animation preset and preview');
 await page.getByRole('button',{name:'Manage studio',exact:true}).click();const pngDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const png=await pngDownload;assert.ok((await readFile(await png.path())).subarray(1,4).equals(Buffer.from('PNG')));pass('editor PNG download');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:'artifacts/editor-mobile.png'});assert.equal(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),true);await page.getByRole('button',{name:'Library',exact:true}).click();assert.equal(await page.locator('.ms-left').isVisible(),true);pass('mobile layout without horizontal overflow');
 const {outputFiles}=await build({entryPoints:['packages/sdk/src/index.ts'],bundle:true,format:'iife',globalName:'SDK',write:false,target:'es2022',tsconfig:'tsconfig.json'});await page.addScriptTag({content:outputFiles[0].text});
 const media=await page.evaluate(async()=>{
   const sdk=globalThis.SDK;const node=sdk.createShape({id:'block',x:160,y:120,width:100,height:80,fill:'#34d7ab',radius:10});
   const scene=sdk.createScene({width:320,height:240,duration:.25,fps:12,background:{type:'solid',color:'#0f2a45'},nodes:[node],tracks:sdk.createAnimationTracks(node,'float',.25)});
   const out=[];const canvas=document.createElement('canvas');const renderer=new sdk.CanvasRenderer(canvas);
   const dataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
   try {
    const meshScene=sdk.createScene({width:320,height:240,background:{type:'transparent'},nodes:[sdk.createShape({x:160,y:120,width:280,height:200,tiltX:20,tiltY:15,fill:'#ee3355',radius:0})]});
    await renderer.render(meshScene);const mesh=canvas.getContext('2d').getImageData(105,85,110,70).data;
    for(let i=0;i<mesh.length;i+=4)if(mesh[i+3]<254||Math.abs(mesh[i]-238)>2||Math.abs(mesh[i+1]-51)>2||Math.abs(mesh[i+2]-85)>2)throw new Error('Perspective mesh seam');
    const palette=sdk.createMagicBackground(canvas,{colors:3});if(palette.palette.length!==3)throw new Error('Media palette');
    for(const format of ['png','jpeg','webp']) {const blob=await sdk.exportImage(renderer,scene,{format});const bitmap=await createImageBitmap(blob);if(bitmap.width!==320||bitmap.height!==240)throw new Error('Image dimensions');bitmap.close();out.push({format,size:blob.size,type:blob.type});}
    const frames=[];for await(const frame of sdk.exportFrames(renderer,scene,{fps:12}))frames.push(frame.time);if(frames.length!==3||frames[1]!==1/12)throw new Error('Frame timestamps');
    const videos=[];
    for(const format of ['webm','mp4']){
      const progress=[];const blob=await sdk.exportVideo(renderer,scene,{format,fps:12,onProgress:p=>progress.push(p)});
      const url=URL.createObjectURL(blob);const video=document.createElement('video');video.muted=true;video.preload='auto';video.src=url;
      try {
        await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Video decode timeout')),10000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(new Error('Video decode failed'));};video.load();});
        if(video.videoWidth!==320||video.videoHeight!==240||Math.abs(video.duration-.25)>.03)throw new Error('Video dimensions/duration');
        video.currentTime=.1;await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Seek timeout')),10000);video.onseeked=()=>{clearTimeout(t);resolve();};});
        const sample=document.createElement('canvas');sample.width=320;sample.height=240;sample.getContext('2d').drawImage(video,0,0);const p=sample.getContext('2d').getImageData(5,5,1,1).data;if(Math.abs(p[0]-15)>12||Math.abs(p[1]-42)>12||Math.abs(p[2]-69)>12)throw new Error('Decoded pixels');
        if(progress[0]!==0||progress.at(-1)!==1||!progress.every((p,i)=>i===0||p>=progress[i-1]))throw new Error('Export progress');
        videos.push({format,size:blob.size,duration:video.duration,type:blob.type,data:await dataURL(blob)});
      } finally {video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
    }
    const imported=sdk.createScene({width:320,height:240,duration:.25,fps:12,assets:[{id:'encoded',kind:'video',src:videos[0].data,width:320,height:240,duration:.25}],nodes:[sdk.createMockup({assetId:'encoded',x:160,y:120,width:320,height:240,radius:0,borderWidth:0,lighting:0,shadow:{color:'#000',opacity:0,blur:0,spread:0,offsetX:0,offsetY:0}})]});
    await renderer.render(imported,.1);const importedPixel=canvas.getContext('2d').getImageData(5,5,1,1).data;if(Math.abs(importedPixel[0]-15)>12)throw new Error('Video import frame');
    const cancel=new AbortController();cancel.abort();let cancelled=false;try{await sdk.exportVideo(renderer,scene,{signal:cancel.signal});}catch(e){cancelled=e.name==='AbortError';}if(!cancelled)throw new Error('Cancellation');
    const benchScene=sdk.createScene({width:1920,height:1080,duration:.5,fps:30,background:{type:'gradient',kind:'linear',angle:135,stops:[{offset:0,color:'#b7cbeb'},{offset:1,color:'#405578'}]},nodes:[sdk.createMockup({x:960,y:540,width:1280,height:780,deviceId:'browser',tiltY:-12})]});
    const start=performance.now();await renderer.render(benchScene);const stillMs=performance.now()-start;
    const encodeStart=performance.now();const benchVideo=await sdk.exportVideo(renderer,benchScene,{format:'webm',fps:30});const videoMs=performance.now()-encodeStart;
    return {images:out,frameTimes:frames,videos,importedVideo:true,cancellation:true,benchmark:{stillWidth:1920,stillHeight:1080,stillMs,videoDuration:.5,videoFps:30,videoFrames:15,videoMs,videoBytes:benchVideo.size}};
   }finally{renderer.dispose();}
 });
 for(const video of media.videos){await writeFile(`artifacts/export-fixture.${video.format}`,Buffer.from(video.data.split(',')[1],'base64'));delete video.data;}
 pass('perspective mesh without opaque triangle seams');pass('local media-derived palette');pass('actual PNG JPEG WebP codecs', {images:media.images});pass('deterministic frame sequence',{times:media.frameTimes});pass('offline WebM and MP4 encode decode seek',{videos:media.videos});pass('video import seek and cancellation');
 await page.evaluate(()=>window.mockupStudio.destroy());assert.equal(await page.locator('.ms-editor').count(),0);assert.deepEqual(errors,[]);pass('editor destroy and zero uncaught browser errors');
 const info={browser:await browser.version(),platform:process.platform,arch:process.arch,benchmark:media.benchmark,results};await writeFile('artifacts/browser-results.json',JSON.stringify(info,null,2));console.log(`${results.length} browser checks passed`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}

