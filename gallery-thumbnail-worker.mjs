import {parentPort,workerData} from 'node:worker_threads';
import {Resvg} from '@resvg/resvg-js';
import {galleryPreview} from './prototype/gallery-preview.mjs';

const {svg,paper}=galleryPreview(workerData.record,workerData.at);
const png=new Resvg(svg,{background:paper,font:{loadSystemFonts:false}}).render().asPng();
parentPort.postMessage({png,paper});
