const storageApi=window.storage&&typeof window.storage.get==="function"&&typeof window.storage.set==="function"
  ?window.storage
  :{
    async get(key){
      const value=window.localStorage.getItem(key);
      return value===null?null:{value};
    },
    async set(key,value){
      window.localStorage.setItem(key,value);
      return {ok:true};
    }
  };

const STEPS=[
  {id:'identity',label:'Identity',title:'Community identity',sub:'Name your community and public update. These fields drive every heading, address, and closing line in the generated prompt.',fields:[
    {id:'community_name',label:'Nation / community name',type:'text',req:true},
    {id:'public_update_name',label:'Public update name',type:'text',req:true,hint:'e.g. PIT RIVER WEDNESDAY CHECK-IN — Events + Deadlines'},
    {id:'preferred_community_address',label:'Preferred term for the people',type:'text',req:true,hint:'e.g. relatives, community, citizens, family'},
    {id:'self_description',label:'One-line positioning statement',type:'text',hint:'e.g. Weekly briefing serving Pit River relatives on and off reservation'},
    {id:'edition_cadence',label:'Publication cadence',type:'select',req:true,opts:['weekly','biweekly','monthly','custom'],init:'weekly'},
    {id:'closing_line',label:'Closing line (used word for word at end of every post)',type:'text',req:true}
  ]},
  {id:'geography',label:'Geography',title:'Geographic scope',sub:'Define where this update covers. Time zone and forward window control how the LLM filters and flags dates.',fields:[
    {id:'edition_region',label:'Edition region',type:'text',req:true,hint:'e.g. Pit River Territory + Statewide Native'},
    {id:'primary_homeland',label:'Primary homeland / service area',type:'text'},
    {id:'default_timezone',label:'Default time zone',type:'select',req:true,opts:['America/Los_Angeles (Pacific)','America/Denver (Mountain)','America/Chicago (Central)','America/New_York (Eastern)','America/Anchorage (Alaska)','Pacific/Honolulu (Hawaii)','Other — specify in local authority note'],init:'America/Los_Angeles (Pacific)'},
    {id:'weather_coverage',label:'Weather / travel coverage area',type:'text',hint:'e.g. Burney / Fall River area travel corridors'},
    {id:'forward_window',label:'Action window (days)',type:'select',req:true,opts:['30','45','60','90'],init:'60',hint:'Items beyond this window go to Save the Dates only'}
  ]},
  {id:'authority',label:'Authority',title:'Local institutions & source tiers',sub:'The most important PRS layer. Define who counts as authoritative in your community. Do not leave at generic defaults — these must be locally adopted.',fields:[
    {id:'tier1',label:'Tier 1 — Locally authoritative sources',type:'tags',req:true,hint:'Press Enter after each institution, department, or official page'},
    {id:'tier2',label:'Tier 2 — Trusted partner sources',type:'tags',req:true,hint:'IHS, BIA, regional tribal coalitions, partner agencies'},
    {id:'tier3',label:'Tier 3 — Regional / media / public info',type:'tags',hint:'Local newspapers, ICT, state portals, nonprofit newsletters'},
    {id:'tier4_note',label:'Tier 4 — Community good-faith shares (describe what qualifies)',type:'text',hint:'e.g. Community-submitted flyers and publicly posted social content'},
    {id:'local_authority_note',label:'Local authority note',type:'textarea',req:true,hint:"State clearly that this tool is a public-information workflow and does not define the Nation's political authority, governance, or cultural boundaries."}
  ]},
  {id:'boundaries',label:'Boundaries',title:'Publication boundaries',sub:'What cannot be published is as important as what can. These rules are enforced by the two-lane verification system in the generated prompt.',fields:[
    {id:'items_may_publish',label:'Items that may be published',type:'tags',req:true,hint:'e.g. public events, services, deadlines, health resources, jobs, scholarships'},
    {id:'items_review',label:'Items requiring extra human review before publishing',type:'tags',req:true,hint:'e.g. youth with partial details, MMIP items, grief or safety-sensitive content'},
    {id:'items_never',label:'Items that must NEVER be published',type:'tags',req:true,hint:'e.g. private addresses, rumors, unverifiable screenshots, expired deadlines'},
    {id:'culturally_sensitive',label:'Culturally sensitive / restricted categories',type:'tags',req:true,hint:'e.g. ceremonial events, restricted community knowledge, sacred site details'},
    {id:'privacy_rules',label:'Privacy rules',type:'textarea',req:true,hint:'Contact disclosure, address handling, youth photo/name rules, anonymous source handling'}
  ]},
  {id:'editorial',label:'Editorial',title:'Voice, tone & style',sub:'Set the editorial personality. The generated prompt instructs the LLM to follow these rules exactly when drafting every edition.',fields:[
    {id:'preferred_tone',label:'Preferred tone',type:'textarea',req:true,hint:'e.g. warm but efficient; community-protective; plain language; never alarmist; never corporate'},
    {id:'terms_to_use',label:'Terms to use',type:'tags',req:true,hint:'e.g. relatives, shared in good faith, confirm directly'},
    {id:'terms_to_avoid',label:'Terms to avoid',type:'tags',req:true,hint:'e.g. official, verified, guaranteed, jargon, corporate phrasing'},
    {id:'lane_b_disclaimer',label:'Required Lane B disclaimer — exact wording',type:'textarea',req:true,hint:'e.g. Shared in good faith to support community visibility — please confirm details directly with the individual or family.'}
  ]},
  {id:'sections',label:'Sections',title:'Section order & structure',sub:'Toggle sections on or off. Required sections always appear. Drag the handle (⠿) to reorder. Only enabled sections appear in the generated post.',isSections:true}
];

const DEFAULT_SECTIONS=[
  {id:'dont_miss',label:"Don't miss this week",emoji:'🔴',required:true,enabled:true},
  {id:'weather',label:'Weather + travel',emoji:'⚠️',required:true,enabled:true},
  {id:'food',label:'Need help getting food?',emoji:'🥫',required:false,enabled:true},
  {id:'health',label:'Health service',emoji:'🏥',required:true,enabled:true},
  {id:'services',label:'Local services + notices',emoji:'🧑‍💼',required:false,enabled:true},
  {id:'land',label:'Land / protection + public comment',emoji:'🏔️',required:false,enabled:true},
  {id:'families',label:'Families / youth support',emoji:'👨‍👩‍👧‍👦',required:false,enabled:true},
  {id:'fundraisers',label:'Youth & school fundraisers',emoji:'📚',required:false,enabled:true},
  {id:'youth',label:'Youth + leadership opportunities',emoji:'👥',required:false,enabled:true},
  {id:'training',label:'Training / leadership (regional)',emoji:'🎓',required:false,enabled:true},
  {id:'scholarships',label:'Scholarships + FAFSA help',emoji:'🏫',required:false,enabled:true},
  {id:'mmip',label:'MMIP / advocacy',emoji:'🕊️',required:false,enabled:true},
  {id:'jobs',label:'Jobs + career training',emoji:'💼',required:true,enabled:true},
  {id:'markets',label:'Markets / vendors / Indigenous art',emoji:'🛍️',required:false,enabled:false},
  {id:'spotlight',label:'Community spotlight / cultural signal',emoji:'🎶',required:false,enabled:true},
  {id:'save_dates',label:'Save the dates',emoji:'📌',required:false,enabled:true},
  {id:'policy',label:'Policy / funding watch',emoji:'🧾',required:false,enabled:true},
  {id:'education',label:'Education / good news',emoji:'📖',required:false,enabled:false},
  {id:'scam',label:'Scam reminder',emoji:'🛑',required:true,enabled:true},
  {id:'ref_list',label:'Reference list',emoji:'📎',required:true,enabled:true}
];

const IK='ci-index2';
const CK=(id,v)=>`ci-${id}-v${v}`;

let S={
  screen:'home',communities:[],form:{},tags:{},
  sections:DEFAULT_SECTIONS.map(s=>({...s})),
  step:0,editId:null,editVersion:0,editName:'',
  outputTab:'master',outputConfig:null,
  historyId:null,historyVersions:[],dragIdx:null
};

async function loadIndex(){try{const r=await storageApi.get(IK);return r?JSON.parse(r.value):[]}catch{return[]}}
async function saveIndex(idx){try{await storageApi.set(IK,JSON.stringify(idx))}catch(e){console.error('saveIndex',e)}}
async function loadConfig(id,version){try{const r=await storageApi.get(CK(id,version));return r?JSON.parse(r.value):null}catch{return null}}
async function saveConfig(id,version,config){try{const r=await storageApi.set(CK(id,version),JSON.stringify(config));return!!r}catch(e){console.error('saveConfig',e);return false}}

function toast(msg,dur=2500){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur)}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function gid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function fdate(ts){return ts?new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}

function render(){
  document.getElementById('app').innerHTML=renderHeader()+renderScreen();
}

function renderHeader(){
  const back=S.screen!=='home'?`<button class="btn btn-ghost btn-sm" onclick="goHome()">← All communities</button>`:'';
  return`<div class="hdr"><div class="hdr-left"><h1>Tribal Community Check-In</h1><p>Prompt foundry — locally governed editorial systems</p></div><div>${back}</div></div>`;
}

function renderScreen(){
  if(S.screen==='home')return renderHome();
  if(S.screen==='builder')return renderBuilder();
  if(S.screen==='output')return renderOutput();
  if(S.screen==='history')return renderHistory();
  return'';
}

function renderHome(){
  const cards=S.communities.map(c=>`
    <div class="c-card">
      <h3>${esc(c.name)}</h3>
      <div class="meta">${esc(c.cadence)} · v${c.latestVersion} · Updated ${fdate(c.updatedAt)}</div>
      <div class="actions">
        <button class="btn btn-sm" onclick="editCommunity('${c.id}',${c.latestVersion})">Edit</button>
        <button class="btn btn-teal btn-sm" onclick="viewOutput('${c.id}',${c.latestVersion})">Outputs</button>
        <button class="btn btn-ghost btn-sm" onclick="viewHistory('${c.id}')">History</button>
      </div>
    </div>`).join('');
  return`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
      <div style="font-size:19px;font-weight:600">Community profiles</div>
      <button class="btn btn-teal btn-sm" onclick="newCommunity()">+ New community</button>
    </div>
    <p style="font-size:13px;color:#666;margin-bottom:1rem">Each community owns its prompt, source hierarchy, and publication boundaries. Configs are saved across sessions.</p>
    <div class="home-guide">
      <div class="c-card">
        <h3 style="margin-bottom:.65rem">How to use this tool</h3>
        <div class="home-copy">
          <p><strong>1. Gather verified details first.</strong><br>For each item, try to collect: title, exact date, exact time, location, why it matters, source link, and organizer/contact.</p>
          <p><strong>2. Sort items into sections.</strong><br>Group entries under practical headings like Weather + Travel, Health, Jobs, Markets, Scholarships, or Save-the-dates.</p>
          <p><strong>3. Keep every item short and useful.</strong><br>Each listing should tell people what it is, when it is, where it is, why it matters, and where to verify it.</p>
        </div>
        <div class="section-note" style="margin-top:1rem;margin-bottom:0">
          <div style="font-weight:600;color:#555;margin-bottom:.45rem">Recommended item format</div>
          <div class="otext" style="font-size:12px;line-height:1.65;white-space:pre-wrap">• Item name — Date • Time • Location
One short practical sentence about why this matters.
Key details: the most useful facts in one line.
Source: [official/public link]
Contact/Host: [name — phone, email, or host page]</div>
        </div>
        <div class="home-rules">
          <div style="font-weight:600;color:#555;margin-bottom:.45rem">Posting rules</div>
          <p>- Use exact dates whenever possible.</p>
          <p>- Prefer official sources over reposts.</p>
          <p>- Include a public contact path.</p>
          <p>- Do not present unverified items as confirmed.</p>
          <p>- If something is a community share, label it clearly and advise readers to confirm directly.</p>
        </div>
      </div>
      <div class="c-card">
        <h3 style="margin-bottom:.65rem">Why this gets easier over time</h3>
        <div class="home-copy">
          <p>The first build usually takes the most effort because you are creating the structure: sections, source standards, contact patterns, tone, and formatting.</p>
          <p>Once you have a strong first version, the generated prompt becomes a reusable template. In later weeks, you usually only need to update the dates, swap in new events or notices, remove expired items, and refine details.</p>
          <p>Build carefully once, then reuse and improve.</p>
        </div>
      </div>
    </div>
    <div class="grid">
      ${cards}
      <div class="new-c" onclick="newCommunity()"><span style="font-size:24px;font-weight:300">+</span><span>New community</span></div>
    </div>
    ${S.communities.length===0?`<div class="empty"><p>No communities yet. Create your first one above.</p></div>`:''}
    <div class="home-footer">
      <p>This tool is a reusable community prompt builder, not an official notice system.</p>
      <p>Always verify dates, locations, contacts, and organizer details before posting.</p>
      <p>Adapt locally. Verify locally. Publish responsibly.</p>
    </div>`;
}

function renderBuilder(){
  const step=STEPS[S.step];
  const prog=STEPS.map((_,i)=>`<div class="${i<S.step?'done':i===S.step?'active':''}"></div>`).join('');
  const isLast=S.step===STEPS.length-1;
  const isFirst=S.step===0;
  const body=step.isSections?renderSectionManager():step.fields.map(f=>renderField(f)).join('');
  return`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:1.5rem">
      <span class="badge badge-blue">${S.editId?`Editing v${S.editVersion}`:'New community'}</span>
      ${S.editName?`<span style="font-size:13px;color:#666">${esc(S.editName)}</span>`:''}
    </div>
    <div class="prog">${prog}</div>
    <div class="step-lbl">Step ${S.step+1} of ${STEPS.length} — ${step.label}</div>
    <div class="step-title">${step.title}</div>
    <div class="step-sub">${step.sub}</div>
    ${body}
    <div class="nav">
      ${!isFirst?`<button class="btn" onclick="navStep(-1)">← Back</button>`:`<span></span>`}
      <div class="nav-r">
        <button class="btn btn-ghost btn-sm" onclick="saveDraft()" id="sdraft">Save draft</button>
        ${isLast
          ?`<button class="btn btn-teal" onclick="saveAndGenerate()">Save & generate outputs →</button>`
          :`<button class="btn btn-primary" onclick="navStep(1)">Continue →</button>`}
      </div>
    </div>`;
}

function renderField(f){
  let input='';
  if(f.type==='tags'){
    const tags=(S.tags[f.id]||[]).map((t,i)=>`<span class="tag">${esc(t)}<button type="button" onclick="removeTag('${f.id}',${i})">×</button></span>`).join('');
    input=`<div class="tw" id="tw-${f.id}" onclick="focusTagInput('${f.id}')">${tags}<input id="ti-${f.id}" type="text" placeholder="Type and press Enter" onkeydown="handleTag(event,'${f.id}')"></div>`;
  }else if(f.type==='select'){
    const cur=S.form[f.id]||f.init||f.opts[0];
    input=`<select id="f-${f.id}" onchange="S.form['${f.id}']=this.value">${f.opts.map(o=>`<option${cur===o?' selected':''}>${esc(o)}</option>`).join('')}</select>`;
  }else if(f.type==='textarea'){
    input=`<textarea id="f-${f.id}" oninput="S.form['${f.id}']=this.value">${esc(S.form[f.id]||'')}</textarea>`;
  }else{
    input=`<input type="text" id="f-${f.id}" value="${esc(S.form[f.id]||'')}" oninput="S.form['${f.id}']=this.value">`;
  }
  return`<div class="field"><label>${f.label}${f.req?'<span class="req"> *</span>':''}</label>${input}${f.hint?`<div class="hint">${f.hint}</div>`:''}</div>`;
}

function renderSectionManager(){
  const items=S.sections.map((s,i)=>`
    <div class="si" id="si-${i}" draggable="true" ondragstart="dStart(event,${i})" ondragover="dOver(event,${i})" ondrop="dDrop(event,${i})" ondragend="dEnd(event,${i})">
      <span class="si-drag">⠿</span>
      <span class="si-name">${s.emoji} ${s.label}</span>
      ${s.required
        ?`<span class="si-req">required</span>`
        :`<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="checkbox" ${s.enabled?'checked':''} onchange="S.sections[${i}].enabled=this.checked"> on</label>`}
    </div>`).join('');
  return`<div class="section-note">Drag ⠿ to reorder. Required sections cannot be turned off. Optional sections only appear in the post when they have items.</div><div class="sl">${items}</div>`;
}

function dStart(e,i){S.dragIdx=i;setTimeout(()=>{const el=document.getElementById('si-'+i);if(el)el.style.opacity='.4'},0)}
function dOver(e,i){e.preventDefault();document.querySelectorAll('.si').forEach(el=>el.classList.remove('over'));const el=document.getElementById('si-'+i);if(el)el.classList.add('over')}
function dDrop(e,i){e.preventDefault();if(S.dragIdx===null||S.dragIdx===i)return;const m=S.sections.splice(S.dragIdx,1)[0];S.sections.splice(i,0,m);S.dragIdx=null;render()}
function dEnd(){S.dragIdx=null;document.querySelectorAll('.si').forEach(el=>{el.style.opacity='';el.classList.remove('over')})}

function focusTagInput(id){const el=document.getElementById('ti-'+id);if(el)el.focus()}
function handleTag(e,id){
  if(e.key==='Enter'||e.key===','){
    e.preventDefault();
    const v=e.target.value.trim().replace(/,$/,'');
    if(v){if(!S.tags[id])S.tags[id]=[];if(!S.tags[id].includes(v)){S.tags[id].push(v);refreshTagWrap(id);}else{e.target.value=''}}
  }
}
function removeTag(id,idx){if(S.tags[id])S.tags[id].splice(idx,1);refreshTagWrap(id)}
function refreshTagWrap(id){
  const tw=document.getElementById('tw-'+id);
  if(!tw)return;
  const tags=(S.tags[id]||[]).map((t,i)=>`<span class="tag">${esc(t)}<button type="button" onclick="removeTag('${id}',${i})">×</button></span>`).join('');
  tw.innerHTML=tags+`<input id="ti-${id}" type="text" placeholder="Type and press Enter" onkeydown="handleTag(event,'${id}')">`;
  const inp=document.getElementById('ti-'+id);if(inp)inp.focus();
}

function navStep(dir){S.step=Math.max(0,Math.min(STEPS.length-1,S.step+dir));render();window.scrollTo(0,0)}
function goHome(){S.screen='home';S.step=0;render();window.scrollTo(0,0)}

function newCommunity(){
  S.form={};S.tags={};S.sections=DEFAULT_SECTIONS.map(s=>({...s}));
  S.step=0;S.editId=null;S.editVersion=0;S.editName='';
  S.screen='builder';render();window.scrollTo(0,0);
}

async function editCommunity(id,version){
  const config=await loadConfig(id,version);
  if(!config){toast('Could not load config');return;}
  S.form={
    community_name:config.community?.community_name||'',
    public_update_name:config.community?.public_update_name||'',
    preferred_community_address:config.community?.preferred_community_address||'',
    self_description:config.community?.self_description||'',
    edition_cadence:config.meta?.edition_cadence||'weekly',
    closing_line:config.community?.closing_line||'',
    edition_region:config.geography?.edition_region||'',
    primary_homeland:config.geography?.primary_homeland||'',
    default_timezone:config.geography?.default_timezone||'America/Los_Angeles (Pacific)',
    weather_coverage:config.geography?.weather_coverage||'',
    forward_window:String(config.geography?.default_forward_window_days||60),
    tier4_note:config.authority?.tier4_note||'',
    local_authority_note:config.authority?.local_authority_note||'',
    privacy_rules:config.boundaries?.privacy_rules||'',
    preferred_tone:config.editorial?.preferred_tone||'',
    lane_b_disclaimer:config.editorial?.lane_b_disclaimer||''
  };
  S.tags={
    tier1:[...(config.authority?.tier1||[])],
    tier2:[...(config.authority?.tier2||[])],
    tier3:[...(config.authority?.tier3||[])],
    items_may_publish:[...(config.boundaries?.items_may_publish||[])],
    items_review:[...(config.boundaries?.items_review||[])],
    items_never:[...(config.boundaries?.items_never||[])],
    culturally_sensitive:[...(config.boundaries?.culturally_sensitive||[])],
    terms_to_use:[...(config.editorial?.terms_to_use||[])],
    terms_to_avoid:[...(config.editorial?.terms_to_avoid||[])]
  };
  S.sections=config.sections?[...config.sections.map(s=>({...s}))]:DEFAULT_SECTIONS.map(s=>({...s}));
  S.editId=id;S.editVersion=version;S.editName=config.community?.community_name||'';
  S.step=0;S.screen='builder';render();window.scrollTo(0,0);
}

async function saveDraft(){
  const btn=document.getElementById('sdraft');
  if(btn){btn.textContent='Saving...';btn.disabled=true;}
  const ok=await doSave(buildConfig());
  toast(ok?'Draft saved ✓':'Save failed — try again');
  if(btn){btn.textContent='Save draft';btn.disabled=false;}
}

async function saveAndGenerate(){
  const config=buildConfig();
  const ok=await doSave(config);
  if(!ok){toast('Save failed');return;}
  S.outputConfig=config;S.outputTab='master';S.screen='output';
  render();window.scrollTo(0,0);
}

async function doSave(config){
  const id=S.editId||gid();
  if(!S.editId)S.editId=id;
  let idx=await loadIndex();
  const existing=idx.find(c=>c.id===id);
  let newV;
  if(existing){newV=existing.latestVersion+1;existing.latestVersion=newV;existing.updatedAt=Date.now();existing.name=config.community.community_name||existing.name;existing.cadence=config.meta.edition_cadence;}
  else{newV=1;idx.push({id,name:config.community.community_name||'New community',cadence:config.meta.edition_cadence||'weekly',latestVersion:1,createdAt:Date.now(),updatedAt:Date.now()});}
  S.editVersion=newV;S.editName=config.community.community_name||'';
  const ok=await saveConfig(id,newV,config);
  if(ok)await saveIndex(idx);
  S.communities=await loadIndex();
  return ok;
}

async function viewOutput(id,version){
  const config=await loadConfig(id,version);
  if(!config){toast('Could not load');return;}
  S.editId=id;S.editVersion=version;S.outputConfig=config;S.outputTab='master';S.screen='output';
  render();window.scrollTo(0,0);
}

function renderOutput(){
  const c=S.outputConfig;
  if(!c)return'<p>No config loaded.</p>';
  const name=c.community?.community_name||'Community';
  const tabs=['master','profile','weekly','json'];
  const tabLabels={master:'Master prompt',profile:'Community profile',weekly:'Weekly template',json:'JSON config'};
  const tabHtml=tabs.map(t=>`<button class="otab${S.outputTab===t?' active':''}" onclick="switchTab('${t}')">${tabLabels[t]}</button>`).join('');
  const txt=getOutput(c,S.outputTab);
  return`
    <div class="bc"><a onclick="goHome()">All communities</a><span>›</span><span>${esc(name)}</span><span>›</span><span>Outputs v${S.editVersion}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <div style="font-size:19px;font-weight:600">${esc(name)}</div>
      <div style="display:flex;gap:7px">
        <button class="btn btn-sm" onclick="editCommunity('${S.editId}',${S.editVersion})">Edit</button>
        <button class="btn btn-teal btn-sm" id="copy-btn" onclick="copyOut()">Copy</button>
      </div>
    </div>
    <div class="otabs">${tabHtml}</div>
    <div class="obox"><div class="otext" id="otext">${esc(txt)}</div></div>
    <p style="font-size:11px;color:#999;margin-top:.6rem">v${S.editVersion} · Paste directly into any LLM</p>`;
}

function switchTab(tab){
  S.outputTab=tab;
  const el=document.getElementById('otext');if(el)el.textContent=getOutput(S.outputConfig,tab);
  document.querySelectorAll('.otab').forEach(b=>{const labels={master:'Master prompt',profile:'Community profile',weekly:'Weekly template',json:'JSON config'};b.classList.toggle('active',b.textContent===labels[tab])});
}

function getOutput(c,tab){
  if(tab==='master')return genMaster(c);
  if(tab==='profile')return genProfile(c);
  if(tab==='weekly')return genWeekly(c);
  if(tab==='json')return JSON.stringify(c,null,2);
  return'';
}

function copyOut(){
  const txt=getOutput(S.outputConfig,S.outputTab);
  navigator.clipboard.writeText(txt).then(()=>{
    const b=document.getElementById('copy-btn');
    if(b){const o=b.textContent;b.textContent='Copied!';setTimeout(()=>b.textContent=o,2000);}
  });
}

async function viewHistory(id){
  S.historyId=id;
  const idx=await loadIndex();
  const c=idx.find(x=>x.id===id);
  if(!c)return;
  const versions=[];
  for(let v=c.latestVersion;v>=1;v--){
    const config=await loadConfig(id,v);
    if(config)versions.push({version:v,config,ts:c.updatedAt});
  }
  S.historyVersions=versions;S.screen='history';render();window.scrollTo(0,0);
}

function renderHistory(){
  const name=S.historyVersions[0]?.config?.community?.community_name||'Community';
  const items=S.historyVersions.map(({version,config})=>`
    <div class="vi">
      <span class="vi-v">v${version}</span>
      <div style="flex:1"><div class="vi-name">${esc(config.community?.community_name||'—')}</div>
      <div class="vi-date">${config.meta?.edition_cadence||''}</div></div>
      <div style="display:flex;gap:5px">
        <button class="btn btn-sm btn-teal" onclick="viewOutput('${S.historyId}',${version})">Outputs</button>
        <button class="btn btn-sm" onclick="editCommunity('${S.historyId}',${version})">Edit</button>
      </div>
    </div>`).join('');
  return`
    <div class="bc"><a onclick="goHome()">All communities</a><span>›</span><span>${esc(name)}</span><span>›</span><span>Version history</span></div>
    <div style="font-size:19px;font-weight:600;margin-bottom:1.25rem">Version history — ${esc(name)}</div>
    ${items||'<div class="empty"><p>No versions found.</p></div>'}`;
}

function buildConfig(){
  const f=S.form,t=S.tags;
  return{
    meta:{version_label:'v4.0',edition_cadence:f.edition_cadence||'weekly',default_timezone:f.default_timezone||'America/Los_Angeles (Pacific)',savedAt:Date.now()},
    community:{community_name:f.community_name||'',public_update_name:f.public_update_name||'',preferred_community_address:f.preferred_community_address||'',self_description:f.self_description||'',closing_line:f.closing_line||''},
    geography:{edition_region:f.edition_region||'',primary_homeland:f.primary_homeland||'',default_timezone:f.default_timezone||'America/Los_Angeles (Pacific)',weather_coverage:f.weather_coverage||'',default_forward_window_days:parseInt(f.forward_window,10)||60},
    authority:{tier1:t.tier1||[],tier2:t.tier2||[],tier3:t.tier3||[],tier4_note:f.tier4_note||'',local_authority_note:f.local_authority_note||''},
    boundaries:{items_may_publish:t.items_may_publish||[],items_review:t.items_review||[],items_never:t.items_never||[],culturally_sensitive:t.culturally_sensitive||[],privacy_rules:f.privacy_rules||''},
    editorial:{preferred_tone:f.preferred_tone||'',terms_to_use:t.terms_to_use||[],terms_to_avoid:t.terms_to_avoid||[],lane_b_disclaimer:f.lane_b_disclaimer||'',closing_line:f.closing_line||''},
    sections:S.sections.filter(s=>s.enabled||s.required).map(s=>({id:s.id,label:s.label,emoji:s.emoji,required:s.required,enabled:s.enabled}))
  };
}

const s=(v,fb)=>(v&&String(v).trim())?v:(fb||'[not specified]');
const a=(v,sep=', ')=>Array.isArray(v)&&v.length?v.join(sep):'[not specified]';
const li=(v)=>Array.isArray(v)&&v.length?v.map(x=>'- '+x).join('\n'):'- [not specified]';

function genMaster(c){
  const secs=(c.sections||[]).map(s=>`  ${s.emoji} ${s.label}${s.required?' (required)':''}`).join('\n');
  return`# ${s(c.community?.public_update_name,'COMMUNITY CHECK-IN — Events + Deadlines')}
## ALGORITHMIC MASTER PROMPT — LOCAL IMPLEMENTATION v4.0
### For LLM Execution | Locally Governed Public-Information Workflow

> LOCAL AUTHORITY NOTICE
> This prompt is a public-information workflow tool for ${s(c.community?.community_name)}.
> It does not define the Nation's political authority, governance, ceremonial
> boundaries, or constitutional meaning. It is an editorial scaffold adopted under
> local authority and subject to local revision.

---

## PERSONA + MISSION

You are Research Editor for ${s(c.community?.public_update_name)},
a ${s(c.meta?.edition_cadence)} community briefing serving
${s(c.community?.preferred_community_address)} across ${s(c.geography?.edition_region)}.

Your mission: Transform raw community notes, flyers, links, and announcements into
a polished, trustworthy, highly scannable post that protects community members from
misinformation, prioritizes local voice, and amplifies Indigenous visibility.

Address the people as: ${s(c.community?.preferred_community_address)}
Default time zone: ${s(c.meta?.default_timezone)}
Action window: ${c.geography?.default_forward_window_days||60} days

Tone: ${s(c.editorial?.preferred_tone,'warm, community-protective, plain language, scannable')}
Terms to use: ${a(c.editorial?.terms_to_use)}
Terms to avoid: ${a(c.editorial?.terms_to_avoid)}

---

## THE TWO-LANE VERIFICATION SYSTEM

### LANE A — STRICT VERIFIED
Used for: Civic / Legal / Services / Jobs / Health / Policy / Money / Safety

Both must be present or the item is OMITTED:
1. A working hyperlink to an original authoritative source
2. Public contact information OR verified official host identity

Auto-assign to Lane A: money, legal status, safety, deadlines, government policy.

### LANE B — COMMUNITY GOOD FAITH
Used for: Cultural events / celebrations / fundraisers / sports /
school support / milestones / community shares

Required disclaimer for every Lane B item (exact wording):
${s(c.editorial?.lane_b_disclaimer,'Shared in good faith — please confirm details directly.')}

Banned words in Lane B: "official," "verified," "confirmed," "guaranteed"
Use instead: shared, community-submitted, publicly posted, confirm directly

### AUTOMATIC OMIT CONDITIONS
- Untraceable screenshot with no origin
- Private contact info not publicly posted
- Deadline already passed as of Edition Date
- Item outside ${c.geography?.default_forward_window_days||60}-day forward window
- Item in NEVER PUBLISH list (see below)
- Culturally sensitive or restricted material without local authorization
- Vague time with no follow-up source (Lane A only)

---

## SOURCE TIER HIERARCHY

TIER 1 — Locally authoritative:
${a(c.authority?.tier1,'\n')||'[not specified]'}

TIER 2 — Trusted partners:
${a(c.authority?.tier2,'\n')||'[not specified]'}

TIER 3 — Regional / media:
${a(c.authority?.tier3,'\n')||'[not specified]'}

TIER 4 — Community good faith:
${s(c.authority?.tier4_note,'Community-submitted flyers and public social posts')}

De-duplication rule: Always use the highest-tier source. Merge only if a lower-tier
source adds non-conflicting public contact or event detail.

---

## PUBLICATION BOUNDARIES

ITEMS THAT MAY BE PUBLISHED:
${li(c.boundaries?.items_may_publish)}

ITEMS REQUIRING EXTRA HUMAN REVIEW BEFORE PUBLISHING:
${li(c.boundaries?.items_review)}

ITEMS THAT MUST NEVER BE PUBLISHED:
${li(c.boundaries?.items_never)}

CULTURALLY SENSITIVE / RESTRICTED CATEGORIES:
${li(c.boundaries?.culturally_sensitive)}

PRIVACY RULES:
${s(c.boundaries?.privacy_rules,'[Define in community profile]')}

---

## THE 4-STAGE EXECUTION PROCESS

### STAGE 1 — COLLECT & CLASSIFY
Extract every item from source data. Build an internal Evidence Table:
Item | Lane | Tier | Category | Date | Time+TZ | Location | Action | Source | Contact | Omit?

Rules:
- Default time zone: ${s(c.meta?.default_timezone)}
- Flag missing TZ: [TZ NOT LISTED — confirm]
- Flag Lane A with no URL: [NO URL — Lane A ineligible]
- Convert relative dates to explicit MM/DD/YY from Edition Date
- Items beyond ${c.geography?.default_forward_window_days||60} days → Save the Dates only

### STAGE 2 — CURATE
Apply all omit conditions first.
Select 3-5 Don't Miss items in priority order:
  1. Safety / emergency (always first)
  2. Hard deadlines within 14 days
  3. Tier 1 authoritative announcements
  4. Health / service access
  5. Jobs / funding / legal deadlines

Apply forward-window filter. Assign surviving items to sections.

### STAGE 3 — DRAFT
Address people as: ${s(c.community?.preferred_community_address)}
Tone: ${s(c.editorial?.preferred_tone,'community-protective, plain language')}
Use: ${a(c.editorial?.terms_to_use)}
Avoid: ${a(c.editorial?.terms_to_avoid)}
Max 3 sentences body copy per item. Short sentences. Active verbs. Second person.

### STAGE 4 — SILENT QA PASS
Before outputting, internally confirm all of the following:
[ ] Every Lane A item has a URL + named contact
[ ] Every Lane B item has the required disclaimer
[ ] No banned words in Lane B items
[ ] All dates are MM/DD/YY (no "next Tuesday," no "this weekend")
[ ] All times include time zone or [TZ NOT LISTED — confirm]
[ ] Don't Miss block has only Lane A or flagged safety-critical items
[ ] No expired deadlines remain
[ ] No items violate publication boundaries
[ ] Closing line present exactly as written
[ ] Reference list is deduplicated
Do not output the checklist. Only output the corrected post.

---

## ITEM FORMAT

• [ITEM NAME] — [MM/DD/YY] • [TIME] [TZ or "(time zone not listed — confirm)"] • [LOCATION]
[One sentence: what it is and what the reader should do.]
[Key details as short fragments: eligibility, cost, deadline, what to bring]

(Lane B only) → ${s(c.editorial?.lane_b_disclaimer)}

Source: [Full URL — no shortlinks — or "Community share via [platform]"]
Contact/Host: [Name + phone/email or official page URL]

If a field is unknown:
- Location: write "Location: not listed (confirm before attending)"
- Contact (Lane A): OMIT the item
- Cost: write "Cost: not listed (confirm directly)"

---

## SECTION ORDER

${secs||'  [No sections configured]'}

---

## HARD RAILS — THIS PROMPT WILL NOT:
- Fabricate any phone number, email, URL, or date
- Speculate about details not present in the source
- Include private contacts not publicly posted
- Soften a missing-link issue to force a Lane A item
- Include expired items even if the submitter says they are current
- Override the locally defined source hierarchy with outside assumptions
- Publish items outside defined publication boundaries
- Publish culturally sensitive or restricted information without local authorization
- Editorialize on internal political disputes or contested legitimacy questions
- Promote candidates, parties, or ballot positions

---

## EDITOR'S NOTES BLOCK (append after every post — not for publication):
━━━━━━━━━━━━━━━━
EDITOR'S NOTES (not for publication)
━━━━━━━━━━━━━━━━
Items OMITTED and why:
• [Item] — [Reason]

Items needing human follow-up before publishing:
• [Item] — [What must be confirmed]

Time zones not confirmed:
• [Item] — [Time listed, needs TZ verification]

Items held under publication boundaries:
• [Item] — [Boundary triggered]
━━━━━━━━━━━━━━━━

---

## CLOSING LINE (word for word, every post):
${s(c.editorial?.closing_line||c.community?.closing_line)}

---

## INPUT FIELDS — FILL IN BEFORE RUNNING

EDITION DATE:     
VERSION:          v4.0
WEEK WINDOW:      

SOURCE DATA:
↓ ↓ ↓ BEGIN SOURCE DATA ↓ ↓ ↓


↑ ↑ ↑ END SOURCE DATA ↑ ↑ ↑

---

LOCAL AUTHORITY NOTE:
${s(c.authority?.local_authority_note)}

---
Generated by Tribal Community Check-In Prompt Foundry v4.0
Community: ${s(c.community?.community_name)} | Saved: ${new Date(c.meta?.savedAt||Date.now()).toLocaleString()}
`;
}

function genProfile(c){
  const secs=(c.sections||[]).map(s=>`- ${s.emoji} ${s.label}${s.required?' [required]':''}`).join('\n');
  return`# ${s(c.community?.community_name)} — COMMUNITY PROFILE
## Local instance of the Tribal Community Check-In Master Prompt Framework
## Generated: ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}

━━━ IDENTITY ━━━
Community name:  ${s(c.community?.community_name)}
Public update:   ${s(c.community?.public_update_name)}
Address people as: ${s(c.community?.preferred_community_address)}
Cadence:         ${s(c.meta?.edition_cadence)}
Description:     ${s(c.community?.self_description)}

━━━ GEOGRAPHY ━━━
Edition region:  ${s(c.geography?.edition_region)}
Homeland / service area: ${s(c.geography?.primary_homeland)}
Default time zone: ${s(c.meta?.default_timezone)}
Weather coverage: ${s(c.geography?.weather_coverage)}
Forward window:  ${c.geography?.default_forward_window_days||60} days

━━━ SOURCE TIERS (locally defined) ━━━
Tier 1 — Authoritative:
${a(c.authority?.tier1,'\n')||'  [not specified]'}

Tier 2 — Partners:
${a(c.authority?.tier2,'\n')||'  [not specified]'}

Tier 3 — Regional / media:
${a(c.authority?.tier3,'\n')||'  [not specified]'}

Tier 4 — Good faith shares:
${s(c.authority?.tier4_note)}

━━━ PUBLICATION BOUNDARIES ━━━
May publish:
${li(c.boundaries?.items_may_publish)}

Requires extra review:
${li(c.boundaries?.items_review)}

Must never publish:
${li(c.boundaries?.items_never)}

Culturally sensitive:
${li(c.boundaries?.culturally_sensitive)}

Privacy rules:
${s(c.boundaries?.privacy_rules)}

━━━ EDITORIAL ━━━
Tone:            ${s(c.editorial?.preferred_tone)}
Terms to use:    ${a(c.editorial?.terms_to_use)}
Terms to avoid:  ${a(c.editorial?.terms_to_avoid)}
Lane B disclaimer:
${s(c.editorial?.lane_b_disclaimer)}

Closing line:
${s(c.editorial?.closing_line||c.community?.closing_line)}

━━━ ACTIVE SECTIONS ━━━
${secs||'[None configured]'}

━━━ LOCAL AUTHORITY NOTE ━━━
${s(c.authority?.local_authority_note)}

---
This community profile is a locally adopted editorial workflow configuration.
It is not a sovereignty document. It does not define this Nation's political
authority, governance, or cultural boundaries unless formally adopted as such.
`;
}

function genWeekly(c){
  const name=s(c.community?.public_update_name,'COMMUNITY CHECK-IN');
  return`# ${name}
## WEEKLY EDITION INPUT FORM

EDITION DATE:    
VERSION:         v4.0
WEEK WINDOW:     
SPECIAL NOTES THIS WEEK:   

---
Paste all raw source data below (notes, flyers, links, community messages):
[Paste here]

---
Standing links to include this week (mark all that apply):
[ ] Weather / road conditions
[ ] Health service hours or updates
[ ] Food / aid resources
[ ] Scholarship / FAFSA deadlines
[ ] Job postings
[ ] Land / public comment notices
[ ] Fraud / scam alert
[ ] Other: _______________

Items flagged for extra human review BEFORE publishing:
[List here]

Items to omit this week:
[List here]

---
Community: ${s(c.community?.community_name)}
Prompt version: v4.0
Generated by Tribal Community Check-In Prompt Foundry
`;
}

async function init(){
  S.communities=await loadIndex();
  render();
}

init();
