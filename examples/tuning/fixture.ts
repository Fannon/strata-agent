import {makeWorld as original} from '../composition/fixture.ts';
export function makeWorld(taskId:string,variant:number,operations?:string[]){return original(taskId==='N6'?'R4':taskId,variant,operations);}
export type World=ReturnType<typeof makeWorld>;
