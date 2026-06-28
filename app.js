
const ITEMS = window.KNOWLEDGE_ITEMS || [];
const SUBJECT_MARK = {"计算机":"计","英语":"英","考点必背":"必"};
const META = window.KNOWLEDGE_META || {};
const STORE = 'zsb-knowledge-final-v7'; // v9继续沿用旧进度键，保证两个版本进度一致
const OLD_STORE = 'zsb-knowledge-pwa:v1';
const INITIAL_STUDY = {"HF-001":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-17T07:35:46.746Z"},"HF-002":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-17T07:52:31.081Z"},"HF-003":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-17T08:02:34.157Z"},"HF-004":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-17T08:07:40.355Z"},"HF-005":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-17T14:14:16.169Z"},"HF-006":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T04:16:37.183Z"},"HF-007":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T04:23:37.075Z"},"HF-008":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T05:55:02.425Z"},"HF-009":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T09:52:36.385Z"},"HF-010":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T09:59:08.234Z"},"HF-011":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T10:01:22.388Z"},"HF-012":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T10:01:29.978Z"},"HF-013":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T10:03:15.507Z"},"HF-014":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T10:04:59.536Z"},"HF-015":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T10:08:55.694Z"},"HF-016":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T10:12:38.953Z"},"HF-017":{"read":true,"starred":false,"mastered":false,"note":"","updatedAt":"2026-06-18T10:13:22.786Z"},"KP-001":{"read":true,"starred":true,"mastered":false,"note":"","updatedAt":"2026-06-18T10:32:18.550Z"}};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = {q:'', subject:'', chapter:'', status:'', selected:'', hideMastered:false, detailMode:true, panel:'learn', reviewMode:'today'};
const REVIEW_INTERVALS = [1,2,4,7,15,30];
let timer = {left:25*60, running:false, handle:null};
let data = load();
let deferredPrompt=null;
function today(){return new Date().toISOString().slice(0,10)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function load(){
  let base={study:{...INITIAL_STUDY},stats:{totalSeconds:0,subjectSeconds:{},itemSeconds:{},days:{},checkins:{},focusSessions:0},reviews:{}};
  try{const old=localStorage.getItem(OLD_STORE); if(old) base.study={...base.study,...JSON.parse(old)}}catch{}
  try{const raw=localStorage.getItem(STORE); if(raw) base={...base,...JSON.parse(raw)}}catch{}
  base.study = compat(base.study||{});
  base.stats = base.stats || {totalSeconds:0,subjectSeconds:{},itemSeconds:{},days:{},checkins:{},focusSessions:0};
  base.stats.subjectSeconds ||= {}; base.stats.itemSeconds ||= {}; base.stats.days ||= {}; base.stats.checkins ||= {}; base.stats.focusSessions ||= 0;
  base.reviews ||= {};
  return base;
}
function save(){localStorage.setItem(STORE,JSON.stringify(data))}
function compat(study){
  const out={...study};
  ITEMS.forEach(i=>{
    if(!out[i.id] && Array.isArray(i.sourceIds)){
      const sources=i.sourceIds.map(id=>out[id]).filter(Boolean);
      if(sources.length){
        out[i.id]={read:sources.some(x=>x.read),starred:sources.some(x=>x.starred),mastered:sources.every(x=>x.mastered),note:sources.map(x=>x.note).filter(Boolean).join('\n'),updatedAt:new Date().toISOString()};
      }
    }
  });
  return out;
}
function st(id){return data.study[id]||{read:false,starred:false,mastered:false,note:''}}
function setst(id, patch){data.study[id]={...st(id),...patch,updatedAt:new Date().toISOString()}; save(); render()}
function txt(i){return [i.id,i.title,i.subject,i.chapter,i.range,i.batch,i.oneLine,JSON.stringify(i.memoBlocks||[]),JSON.stringify(i.phraseGroups||[]),JSON.stringify(i.tables||[]),JSON.stringify(i.clozeLines||[]),JSON.stringify(i.pdfTextLines||[]),JSON.stringify(i.pdfClozeLines||[]),...(i.topics||[]),...(i.keywords||[])].join(' ').toLowerCase()}
function matches(i){const s=st(i.id); if(state.subject && i.subject!==state.subject) return false; if(state.chapter && i.chapter!==state.chapter) return false; if(state.status==='unread' && s.read) return false; if(state.status==='read' && !s.read) return false; if(state.status==='starred' && !s.starred) return false; if(state.status==='mastered' && !s.mastered) return false; if(state.hideMastered && s.mastered) return false; return !state.q || txt(i).includes(state.q.toLowerCase())}
function filtered(){return ITEMS.filter(matches).sort((a,b)=>(a.order||0)-(b.order||0))}
function pct(arr){if(!arr.length)return 0;return Math.round(arr.filter(i=>st(i.id).mastered).length/arr.length*100)}
function fmt(sec){sec=Math.floor(sec||0); if(sec<60)return sec+'s'; let m=Math.floor(sec/60); if(m<60)return m+'m'; return (m/60).toFixed(1)+'h'}
function chapters(){return [...new Set(ITEMS.filter(i=>!state.subject||i.subject===state.subject).map(i=>i.chapter))].sort((a,b)=>a.localeCompare(b,'zh-CN'))}
function list(arr){arr=(arr||[]).filter(Boolean);return arr.length?`<ul>${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">暂无</p>'}
function renderStats(){
  const comp=ITEMS.filter(i=>i.subject==='计算机'), eng=ITEMS.filter(i=>i.subject==='英语');
  $('#totalCount').textContent=ITEMS.length; $('#shownCount').textContent=filtered().length+' 个正在显示';
  const cp=pct(comp), ep=pct(eng); $('#compPct').textContent=cp+'%'; $('#engPct').textContent=ep+'%'; $('#compBar').style.width=cp+'%'; $('#engBar').style.width=ep+'%';
  $('#timeTotal').textContent=fmt(data.stats.totalSeconds); $('#timeToday').textContent=fmt(data.stats.days[today()]||0); $('#streak').textContent=calcStreak()+' 天'; if($('#focusCount')) $('#focusCount').textContent=data.stats.focusSessions||0; if($('#reviewDue')) $('#reviewDue').textContent=dueReviews().length+' 张';
  $$('#subjectTabs button').forEach(b=>b.classList.toggle('active',(b.dataset.subject||'')===state.subject));
}
function calcStreak(){let d=new Date(), n=0; for(;;){const k=d.toISOString().slice(0,10); if((data.stats.checkins&&data.stats.checkins[k]) || (data.stats.days&&data.stats.days[k]>120)){n++; d.setDate(d.getDate()-1)}else break;} return n}
function renderFilters(){const chs=chapters(); const cur=state.chapter; $('#chapterFilter').innerHTML='<option value="">全部章节</option>'+chs.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(''); if(chs.includes(cur)) $('#chapterFilter').value=cur; else {state.chapter=''; $('#chapterFilter').value=''} $('#statusFilter').value=state.status}
function renderTree(){
  const groups={}; ITEMS.forEach(i=>{if(state.subject&&i.subject!==state.subject)return; (groups[i.chapter] ||= []).push(i)});
  $('#treeNav').innerHTML=Object.entries(groups).map(([ch,arr])=>{const p=pct(arr);return `<button data-chapter="${esc(ch)}" class="${ch===state.chapter?'active':''}"><span class="tree-title">${esc(ch)}</span><small>${arr.length}张 · 掌握 ${p}%</small><span class="mini"><i style="width:${p}%"></i></span></button>`}).join('');
}
function renderTasks(){
  const pick=(sub,n)=>ITEMS.filter(i=>i.subject===sub&&!st(i.id).mastered).slice(0,n);
  const tasks=[...pick('计算机',3),...pick('英语',3),...pick('考点必背',2)];
  $('#todayTasks').innerHTML=tasks.map(i=>`<button class="task" data-task="${esc(i.id)}">${SUBJECT_MARK[i.subject]||'学'} · ${esc(i.title.replace(/^.*?｜/,''))}</button>`).join('') || '<span class="muted">今天没有未掌握卡，开始复盘重点。</span>';
}
function quick(i){return i.oneLine || ((i.clozeLines||[])[0]||'').replace(/\[\[(.*?)\]\]/g,'$1') || ((i.memoBlocks||[])[0]?.mnemonic||[])[0] || ((i.memoBlocks||[])[0]?.mustKnow||[])[0] || (i.outline||[])[0] || ''}
function renderList(){const arr=filtered(); if(!arr.length){$('#itemList').innerHTML='<div class="nores">没有匹配结果</div>'; return} if(!state.selected||!arr.some(i=>i.id===state.selected)) state.selected=arr[0].id; $('#itemList').innerHTML=arr.map(i=>{const s=st(i.id); return `<button class="row ${i.id===state.selected?'active':''}" data-id="${esc(i.id)}" data-subject="${esc(i.subject)}"><span class="num">${String(i.order||'').padStart(3,'0')}</span><span class="rmain"><b>${esc(i.title)}</b><em>${esc(i.subject)} · ${esc(i.chapter)} · ${esc(i.range||'')}</em><small>${esc(quick(i)).slice(0,62)}</small></span><span class="marks">${s.starred?'★':''}${s.mastered?'✓':''}</span></button>`}).join('')}
function sec(title, html, open=false){return `<details class="sec" ${open?'open':''}><summary>${esc(title)}</summary><div class="inside">${html}</div></details>`}
function tableHTML(t){return `<div class="table-wrap"><table><thead><tr>${(t.headers||[]).map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(t.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function examplesHTML(ex){return ex&&ex.length?`<div class="examples">${ex.map(e=>`<div class="example"><b>${esc(e.en)}</b><span>${esc(e.cn)}</span><em>${esc(e.note||'')}</em></div>`).join('')}</div>`:'<p class="muted">暂无例句</p>'}
function confusionHTML(cs){return cs&&cs.length?`<div class="confusion">${cs.map(c=>`<div class="conf-item"><b>${esc(c[0])} ${c[1]?`/ ${esc(c[1])}`:''}</b><p>${esc(c[2]||'')}</p></div>`).join('')}</div>`:'<p class="muted">暂无易混点</p>'}
function testsHTML(ts){return ts&&ts.length?`<div class="tests">${ts.map(t=>`<details class="test"><summary>${esc(t.q)}</summary><p>${esc(t.a)}</p></details>`).join('')}</div>`:'<p class="muted">暂无自测题</p>'}
function phraseHTML(groups){if(!groups||!groups.length)return '<p class="muted">非短语卡暂无短语表</p>'; return `<div class="phrase-tools"><button id="showPhraseAnswers" class="ghost">显示/隐藏中文</button><span class="muted">点每个短语也能单独显示答案。</span></div><div id="phraseGrid" class="phrase-grid">${groups.map(g=>`<div class="phrase-group"><h3>${esc(g.key)}</h3>${g.items.map(x=>`<div class="phrase"><b>${esc(x.phrase)}</b><div class="meaning">${esc(x.meaning)}</div><small>${esc(x.example||'')}</small></div>`).join('')}</div>`).join('')}</div>`}
function cleanExtractHTML(i){
  const full=(i.pdfTextLines||[]).filter(Boolean);
  const explain=(i.basicExplain||[]).slice(0,6);
  const exam=(i.examRefine||[]).slice(0,8);
  const must=(i.mustPatterns||[]).slice(0,8);
  const fullHtml=full.length?`<div class="pdf-text"><div class="pdf-text-head">PDF 原文提取</div>${full.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:'';
  const blocks=(i.memoBlocks||[]).map(b=>{
    const a=[...(b.understanding||[]),...(b.mustKnow||[]),...(b.exam||[]),...(b.confuse||[]),...(b.mnemonic||[])].filter(Boolean).slice(0,8);
    return a.length?`<div class="extract-group"><h4>${esc(b.title||'整理内容')}</h4>${list(a)}</div>`:'';
  }).join('');
  return `<div class="clean-notice"><b>不再显示乱码 OCR</b><p>能提取文字的 PDF 会在这里完整显示；图片型 PDF 以原图核对，不强行生成乱码。</p></div>${fullHtml}${sec('干净整理版：先看这个', list(must.length?must:explain), true)}${sec('基础解释', list(explain), true)}${sec('考试考法', list(exam), true)}${blocks}`;
}
function mediaHTML(i){
  if(i.pageCloze){
    const p=i.pageCloze;
    const files=i.sourceFile?`<p class="source-files">来源：${esc(i.sourceFile)} · ${esc(p.video||'录屏')} · ${esc(p.time||'')}s</p>`:'';
    return `${files}<div class="page-gallery"><figure><div class="page-label">考点必背原图 / 答案页</div><img class="zoom" loading="lazy" src="${esc(p.answer)}" alt="${esc(i.title)} 原图答案"></figure></div>`;
  }
  const imgs=i.images&&i.images.length?i.images:(i.image?[i.image]:[]);
  const pdf=i.pdf?`<a class="pdf" href="${esc(i.pdf)}" target="_blank" rel="noopener">打开完整 PDF / 原图</a>`:'';
  const files=i.sourceFiles?.length?`<p class="source-files">来源：${esc(i.sourceFiles.join('；'))}</p>`:(i.sourceFile?`<p class="source-files">来源：${esc(i.sourceFile)}</p>`:'');
  const gal=imgs.length?`<div class="page-gallery">${imgs.map((src,idx)=>`<figure><div class="page-label">第 ${idx+1} / ${imgs.length} 页</div><img class="zoom" loading="lazy" src="${esc(src)}" alt="${esc(i.title)} 第${idx+1}页"></figure>`).join('')}</div>`:'';
  return `${pdf}${files}${gal}` || '<p class="muted">暂无原图</p>'
}

function addDays(dateStr,n){const d=dateStr?new Date(dateStr):new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10)}
function isDue(r){return r && (!r.due || r.due<=today())}
function dueReviews(){return Object.entries(data.reviews||{}).filter(([id,r])=>ITEMS.some(i=>i.id===id)&&isDue(r)).map(([id,r])=>({item:ITEMS.find(i=>i.id===id),review:r}))}
function allReviews(){return Object.entries(data.reviews||{}).filter(([id,r])=>ITEMS.some(i=>i.id===id)).map(([id,r])=>({item:ITEMS.find(i=>i.id===id),review:r}))}
function ensureReview(id){const now=today(); if(!data.reviews) data.reviews={}; if(!data.reviews[id]) data.reviews[id]={stage:0,due:now,last:'',count:0}; save(); return data.reviews[id]}
function scheduleReview(id, remembered=true){
  const r=ensureReview(id); const now=today();
  if(remembered){r.stage=Math.min((r.stage||0)+1, REVIEW_INTERVALS.length); const days=REVIEW_INTERVALS[Math.max(0,r.stage-1)]||30; r.due=addDays(now,days);}
  else{r.stage=0; r.due=addDays(now,1);}
  r.last=now; r.count=(r.count||0)+1; data.reviews[id]=r; save(); render();
}
function reviewBadge(id){const r=data.reviews?.[id]; if(!r)return '未加入'; return isDue(r)?'今日复习':'下次 '+r.due}
function renderReview(){
  const box=$('#reviewList'); if(!box)return;
  const arr=state.reviewMode==='all'?allReviews():dueReviews();
  if(!arr.length){box.innerHTML='<div class="review-card"><b>暂无需要复习</b><em>在任意知识点里点“加入抗遗忘”，系统会按 1/2/4/7/15/30 天帮你排期。</em></div>'; return}
  box.innerHTML=arr.map(({item,review})=>`<div class="review-card"><b>${esc(item.subject)} · ${esc(item.title.replace(/^.*?｜/,''))}</b><em>阶段 ${review.stage||0}/6 · 下次 ${esc(review.due||today())} · 已复习 ${review.count||0} 次</em><div class="buttons"><button data-review-open="${esc(item.id)}">打开</button><button data-review-ok="${esc(item.id)}">记住了</button><button class="weak" data-review-no="${esc(item.id)}">没记住</button></div></div>`).join('');
}
function memoryHTML(i){
  const r=data.reviews?.[i.id];
  return `<div class="memory-box"><h3>抗遗忘记忆法</h3><p>这张卡按“当天理解 → 1天后 → 2天后 → 4天后 → 7天后 → 15天后 → 30天后”复习。不要每天从头乱背，优先复习快忘的内容。</p><div class="memory-steps"><span>当天</span><span>1天</span><span>2天</span><span>4天</span><span>7天</span><span>15天</span><span>30天</span></div><p><b>当前状态：</b>${esc(reviewBadge(i.id))}</p><div class="buttons"><button class="review-action" data-review-add="${esc(i.id)}">${r?'重新加入今天复习':'加入抗遗忘'}</button><button class="review-action ghost" data-review-ok="${esc(i.id)}">我记住了</button><button class="review-action ghost" data-review-no="${esc(i.id)}">没记住，明天再来</button></div></div>`;
}
function renderTimer(){const m=Math.floor(timer.left/60),s=timer.left%60; if($('#focusTimer')) $('#focusTimer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
function addFocusTime(seconds){
  data.stats.totalSeconds=(data.stats.totalSeconds||0)+seconds;
  data.stats.days[today()]=(data.stats.days[today()]||0)+seconds;
  data.stats.focusSessions=(data.stats.focusSessions||0)+1;
  if(state.selected){
    const i=ITEMS.find(x=>x.id===state.selected);
    if(i){data.stats.subjectSeconds[i.subject]=(data.stats.subjectSeconds[i.subject]||0)+seconds; data.stats.itemSeconds[i.id]=(data.stats.itemSeconds[i.id]||0)+seconds;}
  }
  save(); renderStats();
}
function timerTick(){if(!timer.running)return; timer.left--; renderTimer(); if(timer.left<=0){timer.running=false; clearInterval(timer.handle); timer.handle=null; timer.left=25*60; addFocusTime(25*60); renderTimer(); alert('25分钟完成，已计入学习时长。休息5分钟再继续。')}}
function startTimer(){if(timer.running)return; timer.running=true; timer.handle=setInterval(timerTick,1000)}
function pauseTimer(){timer.running=false; if(timer.handle){clearInterval(timer.handle); timer.handle=null}}
function resetTimer(){pauseTimer(); timer.left=25*60; renderTimer()}


function normAns(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,'').replace(/[，。；;,.]/g,'')}
function clozeLineHTML(line, idx){return '<p class="cloze-line">'+esc(line).replace(/\[\[(.*?)\]\]/g,(m,ans)=>{const n=Math.max(2,Math.min(10,[...ans].length+1));return `<span class="cloze-blank"><input data-cloze-input="1" data-answer="${esc(ans)}" aria-label="填空" autocomplete="off" style="--blank-ch:${n}ch"><span class="cloze-answer">${esc(ans)}</span></span>`})+'</p>'}
function clozeHTML(i){
  if(i.pageCloze){
    const lines=i.pageClozeTextLines||[];
    if(!lines.length){
      return `<div class="cloze-box"><div class="cloze-head"><b>录屏文字填空</b><span>这一页暂时没有提取到稳定文字，请到“PDF原图/干净整理”查看原图核对。</span></div></div>`;
    }
    const p=i.pageCloze;
    return `<div class="cloze-box video-text-cloze"><div class="cloze-head"><b>录屏文字填空</b><span>这里是录屏黄色重点的纯文字版；原图答案放在“PDF原图/干净整理”。</span></div><div class="cloze-actions"><button data-cloze-check="1">检查</button><button class="ghost" data-cloze-reveal="1">答案</button><button class="ghost" data-cloze-clear="1">清空</button></div><div class="cloze-lines">${lines.map(clozeLineHTML).join('')}</div><p class="muted">来源：${esc(p.video||'录屏')} · ${esc(p.time||'')}s · 约 ${esc(p.boxCount||0)} 处黄色重点。以原图答案为准。</p></div>`;
  }
  const lines=(i.pdfClozeLines&&i.pdfClozeLines.length)?i.pdfClozeLines:(i.clozeLines||[]);
  if(!lines.length)return '<p class="muted">这张卡没有填空内容。</p>';
  return `<div class="cloze-box"><div class="cloze-head"><b>文字填空</b><span>把重点词隐藏，自己输入后检查。</span></div><div class="cloze-actions"><button data-cloze-check="1">检查</button><button class="ghost" data-cloze-reveal="1">答案</button><button class="ghost" data-cloze-clear="1">清空</button></div><div class="cloze-lines">${lines.map(clozeLineHTML).join('')}</div></div>`
}

function blocksHTML(i){const bs=i.memoBlocks||[]; if(!bs.length)return ''; return bs.map(b=>`<details class="sec" open><summary>${esc(b.title||'背诵整理')}</summary><div class="inside">${list(b.understanding)}${list(b.mustKnow)}</div></details>`).join('')}
function renderDetail(){
  const i=ITEMS.find(x=>x.id===state.selected); const pane=$('#detailPane'); if(!i){pane.innerHTML='<div class="empty">点一个知识点开始。</div>';return}
  const s=st(i.id); document.body.classList.add('detail-mode'); document.body.classList.toggle('detail-on', state.detailMode);
  pane.innerHTML=`<button class="back" id="backBtn">← 返回列表</button><div class="dhead"><div><p>${esc(i.subject)} · ${esc(i.chapter)} · ${esc(i.range||'')}</p><h2>${esc(i.title)}</h2></div><span>${String(i.order||'').padStart(3,'0')}</span></div><div class="pills"><span class="pill">${esc(i.batch||'知识点')}</span><span class="pill">${i.pageCount?i.pageCount+'页PDF':'文字卡'}</span><span class="pill">时长 ${fmt(data.stats.itemSeconds[i.id]||0)}</span></div><div class="quick-grid"><div class="quick-card"><strong>一句话速记</strong><p>${esc(i.oneLine||quick(i))}</p></div><div class="quick-card"><strong>基础解释</strong>${list((i.basicExplain||[]).slice(0,2))}</div></div><div class="ops"><button data-act="read" class="${s.read?'on':''}">${s.read?'已看':'标已看'}</button><button data-act="star" class="star ${s.starred?'on':''}">重点</button><button data-act="master" class="master ${s.mastered?'on':''}">${s.mastered?'已掌握':'掌握'}</button><button data-act="forget" class="memory-on">抗遗忘</button></div><div class="tabs"><button data-panel="learn" class="active">背诵整理</button><button data-panel="cloze">填空背诵</button><button data-panel="pdf">PDF原图/干净整理</button><button data-panel="exam">考试考法</button><button data-panel="confuse">易混/图表</button><button data-panel="phrase">例句/短语</button><button data-panel="test">自测</button><button data-panel="memory">抗遗忘</button></div><section class="panel active" data-panel-box="learn">${sec('PDF原文 + 背诵版双层：先背这里', list(i.mustPatterns||[]), true)}${sec('详细解释版', list(i.basicExplain||[]), true)}${blocksHTML(i)}</section><section class="panel" data-panel-box="cloze">${clozeHTML(i)}</section><section class="panel" data-panel-box="pdf">${sec('完整 PDF / 页面原图', mediaHTML(i), true)}${sec('PDF内容提取：清爽整理版', cleanExtractHTML(i), true)}</section><section class="panel" data-panel-box="exam">${sec('考点提炼', list(i.examRefine||[]), true)}${sec('必背句式 / 固定结构', list(i.mustPatterns||[]), true)}</section><section class="panel" data-panel-box="confuse">${confusionHTML(i.confusions||[])}${(i.tables||[]).map(tableHTML).join('')}</section><section class="panel" data-panel-box="phrase">${examplesHTML(i.examples||[])}${phraseHTML(i.phraseGroups||[])}</section><section class="panel" data-panel-box="test">${testsHTML(i.selfTests||[])}<div class="note"><h3>我的笔记</h3><textarea data-note="${esc(i.id)}" placeholder="写自己的理解、易错点...">${esc(s.note||'')}</textarea></div></section><section class="panel" data-panel-box="memory">${memoryHTML(i)}</section>`;
}
function render(){renderStats();renderFilters();renderTree();renderTasks();renderReview();renderList();renderDetail();renderTimer()}
document.addEventListener('click',e=>{
  const subj=e.target.closest('[data-subject]'); if(subj && subj.parentElement?.id==='subjectTabs'){state.subject=subj.dataset.subject||'';state.chapter='';state.selected='';render();return}
  const tree=e.target.closest('[data-chapter]'); if(tree){state.chapter=tree.dataset.chapter;state.selected='';render();return}
  const task=e.target.closest('[data-task]'); if(task){state.selected=task.dataset.task;markRead(state.selected);render();return}
  const row=e.target.closest('.row'); if(row){state.selected=row.dataset.id;markRead(state.selected);renderList();renderDetail();return}
  const act=e.target.closest('[data-act]')?.dataset.act; if(act&&state.selected){const s=st(state.selected); if(act==='read')setst(state.selected,{read:!s.read}); if(act==='star')setst(state.selected,{starred:!s.starred}); if(act==='master'){setst(state.selected,{mastered:!s.mastered,read:true}); if(!s.mastered) ensureReview(state.selected);} if(act==='forget'){ensureReview(state.selected); render();} return}
  const panel=e.target.closest('[data-panel]'); if(panel){const name=panel.dataset.panel; $$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.panel===name)); $$('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panelBox===name)); return}
  
  const ro=e.target.closest('[data-review-open]'); if(ro){state.selected=ro.dataset.reviewOpen; markRead(state.selected); render(); return}
  const ra=e.target.closest('[data-review-add]'); if(ra){ensureReview(ra.dataset.reviewAdd); render(); return}
  const rk=e.target.closest('[data-review-ok]'); if(rk){scheduleReview(rk.dataset.reviewOk,true); return}
  const rn=e.target.closest('[data-review-no]'); if(rn){scheduleReview(rn.dataset.reviewNo,false); return}
  if(e.target.id==='reviewTodayBtn'){state.reviewMode='today'; renderReview(); return}
  if(e.target.id==='reviewAllBtn'){state.reviewMode='all'; renderReview(); return}
  if(e.target.id==='timerStart'){startTimer(); return}
  if(e.target.id==='timerPause'){pauseTimer(); return}
  if(e.target.id==='timerReset'){resetTimer(); return}



  const pr=e.target.closest('[data-page-reveal]'); if(pr){(pr.closest('.page-cloze')||pr.closest('.video-fallback'))?.classList.toggle('show-page-answer'); return}
  const pc=e.target.closest('[data-page-clear]'); if(pc){const ta=pc.closest('.page-cloze')?.querySelector('.page-answer-input'); if(ta)ta.value=''; return}

  const ck=e.target.closest('[data-cloze-check]'); if(ck){ $$('#detailPane [data-cloze-input]').forEach(inp=>{const ok=normAns(inp.value)===normAns(inp.dataset.answer); inp.classList.toggle('ok',ok); inp.classList.toggle('bad',!ok);}); return}
  const cr=e.target.closest('[data-cloze-reveal]'); if(cr){cr.closest('.cloze-box')?.classList.toggle('show-answers'); return}
  const cc=e.target.closest('[data-cloze-clear]'); if(cc){ $$('#detailPane [data-cloze-input]').forEach(inp=>{inp.value=''; inp.classList.remove('ok','bad')}); return}

  const phrase=e.target.closest('.phrase'); if(phrase){phrase.classList.toggle('show'); return}
  if(e.target.id==='showPhraseAnswers'){$('#phraseGrid')?.classList.toggle('show-answers'); return}
  if(e.target.id==='backBtn'){document.body.classList.remove('detail-mode'); return}
  if(e.target.id==='themeBtn'){document.body.classList.toggle('dark'); localStorage.setItem('zsb-theme',document.body.classList.contains('dark')?'dark':'light'); return}
  if(e.target.id==='checkinBtn'){data.stats.checkins[today()]=true; save(); renderStats(); return}
  const img=e.target.closest('.zoom'); if(img){$('#dialogImage').src=img.src; $('#imageDialog').showModal()}
});
function markRead(id){if(!st(id).read){data.study[id]={...st(id),read:true,updatedAt:new Date().toISOString()}; save()}}
document.addEventListener('input',e=>{if(e.target.id==='searchInput'){state.q=e.target.value; state.selected=''; renderList(); renderDetail()} if(e.target.id==='hideMastered'){state.hideMastered=e.target.checked; state.selected=''; render()} if(e.target.id==='detailMode'){state.detailMode=e.target.checked; document.body.classList.toggle('detail-on',state.detailMode)} if(e.target.dataset.note){data.study[e.target.dataset.note]={...st(e.target.dataset.note),note:e.target.value,updatedAt:new Date().toISOString()}; save()}});
$('#chapterFilter').addEventListener('change',e=>{state.chapter=e.target.value;state.selected='';render()});
$('#statusFilter').addEventListener('change',e=>{state.status=e.target.value;state.selected='';render()});
$('#closeDialog').addEventListener('click',()=>$('#imageDialog').close());
$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:12,exportedAt:new Date().toISOString(),study:data.study,stats:data.stats,reviews:data.reviews},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='专升本知识点学习记录_v14_PDF原文填空抗遗忘.json'; a.click(); URL.revokeObjectURL(a.href)});
$('#importInput').addEventListener('change',async e=>{const f=e.target.files?.[0]; if(!f)return; try{const x=JSON.parse(await f.text()); data.study=compat(x.study||x||{}); data.stats=x.stats||data.stats; data.reviews=x.reviews||data.reviews||{}; save(); render(); alert('导入完成')}catch{alert('导入失败，请选择正确 JSON')}});
setInterval(()=>{if(document.hidden||!state.selected)return; const i=ITEMS.find(x=>x.id===state.selected); if(!i)return; data.stats.totalSeconds=(data.stats.totalSeconds||0)+15; data.stats.days[today()]=(data.stats.days[today()]||0)+15; data.stats.subjectSeconds[i.subject]=(data.stats.subjectSeconds[i.subject]||0)+15; data.stats.itemSeconds[i.id]=(data.stats.itemSeconds[i.id]||0)+15; save(); renderStats();},15000);
if(localStorage.getItem('zsb-theme')==='dark') document.body.classList.add('dark');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').addEventListener('click',async()=>{if(deferredPrompt){deferredPrompt.prompt(); deferredPrompt=null; $('#installBtn').classList.add('hidden')}});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
render();
