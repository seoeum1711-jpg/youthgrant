export function parseSavedGrantIds(raw:string|null){try{const value=JSON.parse(raw??"[]");return Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];}catch{return[];}}
export function toggleSavedGrantId(ids:string[],id:string){return ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];}
