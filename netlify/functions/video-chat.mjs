const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const MAX_BODY=64*1024,MAX_MESSAGES=24,MAX_CHARS=12000,roles=new Set(["user","assistant"]);
export default async function handler(request){
 if(request.method!=="POST")return json({error:"Method not allowed."},405);
 const origin=request.headers.get("origin"),host=request.headers.get("host");
 if(origin&&host){try{if(new URL(origin).host!==host)return json({error:"Origin not allowed."},403)}catch{return json({error:"Invalid origin."},403)}}
 const key=Netlify.env.get("OPENROUTER_API_KEY"),model=Netlify.env.get("OPENROUTER_VIDEO_MODEL")||"anthropic/claude-sonnet-5.5";
 if(!key)return json({error:"Video Builder is not configured. Add OPENROUTER_API_KEY in Netlify environment variables with Functions scope."},503);
 if(Number(request.headers.get("content-length")||0)>MAX_BODY)return json({error:"Request too large."},413);
 let payload;try{payload=await request.json()}catch{return json({error:"Invalid JSON."},400)}
 if(!Array.isArray(payload?.messages)||payload.messages.length<1||payload.messages.length>MAX_MESSAGES)return json({error:"Send between 1 and 24 messages."},400);
 const messages=[];for(const m of payload.messages){if(!m||!roles.has(m.role)||typeof m.content!=="string")return json({error:"Invalid message format."},400);const content=m.content.trim();if(!content||content.length>MAX_CHARS)return json({error:"Each message must be 1–12,000 characters."},400);messages.push({role:m.role,content})}
 if(messages[messages.length-1].role!=="user")return json({error:"The last message must be from the user."},400);
 const system="You are the Video Builder assistant inside Riyad AI Studio. Help the user plan a real video production. Ask only for missing details that materially affect the result. When enough information exists, produce a practical production package with: concept and audience; duration, aspect ratio and platform; visual direction; complete voiceover/dialogue script with timing; scene-by-scene shot list with duration, framing, camera movement, visual content and on-screen text; image-generation prompts for each needed shot; music and sound design notes; captions/subtitles; editing and transition instructions; export settings and a final checklist. Keep each scene distinct and timed so the total matches the requested duration. Do not invent facts in documentary scripts; mark facts that need source verification. Never claim to render, export, or create a video file. You can create plans and prompts only; actual rendering needs a connected video generation provider. Use the user's language.";
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),52000);
 try{const upstream=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json","accept":"text/event-stream","http-referer":"https://riyad-ai-studio.netlify.app","x-title":"Riyad AI Studio Video Builder"},body:JSON.stringify({model,messages:[{role:"system",content:system},...messages],temperature:0.6,max_tokens:5000,stream:true}),signal:controller.signal});
 if(!upstream.ok)return json({error:upstream.status===429?"OpenRouter rate limit or account quota reached.":"OpenRouter request failed. Check the API key, model availability and account credits."},upstream.status===429?429:502);
 if(!upstream.body)return json({error:"OpenRouter returned no response stream."},502);
 return new Response(upstream.body,{status:200,headers:{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-store, no-cache, no-transform","x-content-type-options":"nosniff","x-accel-buffering":"no"}});
 }catch(e){return json({error:e?.name==="AbortError"?"Claude request timed out.":"Unable to reach OpenRouter."},e?.name==="AbortError"?504:502)}finally{clearTimeout(timeout)}
}
export const config={path:"/api/video-chat",rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:8}};
