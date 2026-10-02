/** 065 application pilot. Task instructions and derived schemas stay local. */
export const definitions = [
  {family:'27e1026',category:'oldest-library-item',apps:['supervisor','spotify']},
  {family:'e7a10f8',category:'playlist-duration',apps:['supervisor','spotify']},
  {family:'d0b1f43',category:'roommate-payment-reconciliation',apps:['supervisor','venmo','phone']},
  {family:'50e1ac9',category:'ranked-genre-list',apps:['supervisor','spotify']},
  {family:'fac291d',category:'deduplicated-library-count',apps:['supervisor','spotify']},
  {family:'23cf851',category:'transaction-like-aggregation',apps:['supervisor','venmo']},
];
export const development={task:'6bdbc26_1',apps:['supervisor','spotify']};
export function allowedOperation(name:string) {
 const [app,op]=name.split('__');
 if(!app||!op)return false;
 if(app==='supervisor')return ['show_active_task','show_profile','show_account_passwords','complete_task'].includes(op);
 return op==='login'||/^(show_|search_|get_|list_|count_)/.test(op);
}
export function parseAnswer(text:string) {
 try{return {answer:JSON.parse(text),pureJson:true};}catch{}
 const match=text.match(/^\s*```json\s*\n([\s\S]*?)\n```\s*$/);
 if(match)try{return {answer:JSON.parse(match[1]!),pureJson:false};}catch{}
 return {answer:undefined,pureJson:false};
}
