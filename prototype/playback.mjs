import {grow,profile,HOUR} from './growth.mjs';
export const REPLAY_MS=4000;
export function replayFrame(record,end,progress){const {initial,days}=profile(record);const current=Math.max(0,Math.min(1,initial+(end-record.createdAt)/(days*24*HOUR)*(1-initial)));return grow(record,current*Math.max(0,Math.min(1,progress)),{at:end});}
