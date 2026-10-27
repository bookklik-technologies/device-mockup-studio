import { StudioError, type Background } from '@bookklik/device-mockup-studio-core';
import { context, defaultCanvasFactory, type CanvasFactory } from './canvas.js';
import { sourceSize } from './assets.js';

export interface MagicBackgroundOptions { colors?: number; angle?: number; animated?: boolean; canvasFactory?: CanvasFactory }
export interface MagicBackgroundResult { palette: string[]; background: Background }
/** Deterministic, local palette sampling without network requests.
 * The caller must load the source first. Remote sources require CORS for pixel access. */
export function createMagicBackground(source: CanvasImageSource, options: MagicBackgroundOptions = {}): MagicBackgroundResult {
  const count = options.colors ?? 3;
  if (!Number.isInteger(count) || count < 2 || count > 6 || !Number.isFinite(options.angle ?? 135)) throw new StudioError('PALETTE_OPTIONS', 'Choose 2–6 colors and a finite gradient angle.');
  sourceSize(source);
  const canvas = (options.canvasFactory ?? defaultCanvasFactory)(48, 48); canvas.width=48;canvas.height=48;
  const ctx = context(canvas);
  let pixels: Uint8ClampedArray;
  try { ctx.drawImage(source,0,0,48,48); pixels=ctx.getImageData(0,0,48,48).data; }
  catch(cause) { throw new StudioError('PALETTE_PIXELS', 'Cannot sample this source. Use an imported file or enable anonymous CORS on its server.',cause); }
  finally { canvas.width=1;canvas.height=1; }
  const bins=new Map<number,{r:number;g:number;b:number;weight:number}>();
  for(let i=0;i<pixels.length;i+=4){
    if(pixels[i+3]<64)continue;
    const r=pixels[i],g=pixels[i+1],b=pixels[i+2],key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);
    const saturation=(Math.max(r,g,b)-Math.min(r,g,b))/255;
    const weight=(.2+saturation)*pixels[i+3]/255;
    const bin=bins.get(key)??{r:0,g:0,b:0,weight:0};bin.r+=r*weight;bin.g+=g*weight;bin.b+=b*weight;bin.weight+=weight;bins.set(key,bin);
  }
  if(!bins.size) throw new StudioError('PALETTE_EMPTY','The source contains no sufficiently opaque pixels.');
  const candidates=[...bins.values()].map(b=>({color:[b.r/b.weight,b.g/b.weight,b.b/b.weight],weight:b.weight})).sort((a,b)=>b.weight-a.weight);
  const selected:number[][]=[candidates[0].color];
  while(selected.length<count && selected.length<candidates.length){
    let chosen:number[]|undefined,best=0;
    for(const candidate of candidates){const distance=Math.min(...selected.map(c=>c.reduce((s,n,i)=>s+(n-candidate.color[i])**2,0)));const score=distance*Math.sqrt(candidate.weight);if(score>best){best=score;chosen=candidate.color;}}
    if(!chosen||best<1)break;selected.push(chosen);
  }
  const base=selected[0];
  while(selected.length<count){const light=selected.length%2===1;const amount=.18+selected.length*.06;selected.push(base.map(c=>light?c+(255-c)*amount:c*(1-amount)));}
  const palette=selected.map(c=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''));
  return {palette,background:{type:'gradient',kind:'linear',angle:options.angle??135,stops:palette.map((color,i)=>({color,offset:i/(palette.length-1)})),...(options.animated?{speed:.4}:{})}};
}
