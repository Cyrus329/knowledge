
const ITEMS = window.KNOWLEDGE_ITEMS || [];
const STORAGE_KEY = 'zsb-knowledge-pwa:v1';
const TEXT_MODE_KEY = 'zsb-knowledge-pwa:text-mode:v1';
const RAW_TEXT_KEY = 'zsb-knowledge-pwa:raw-text:v1';
const $ = (s)=>document.querySelector(s);
const state = {selected: ITEMS[0]?.id || '', query:'', chapter:'', status:'', textMode: localStorage.getItem(TEXT_MODE_KEY) === '1', rawText: localStorage.getItem(RAW_TEXT_KEY) === '1'};
let study = loadStudy();
let deferredPrompt = null;

function loadStudy(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}}}
function saveStudy(){localStorage.setItem(STORAGE_KEY, JSON.stringify(study)); render();}
function itemState(id){return study[id] || {read:false,starred:false,mastered:false,note:''}}
function setItemState(id, patch){study[id] = {...itemState(id), ...patch, updatedAt:new Date().toISOString()}; saveStudy();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function chapters(){return [...new Set(ITEMS.map(i=>i.chapter))].sort((a,b)=>a.localeCompare(b,'zh-CN'))}
function matches(item){
  const st=itemState(item.id);
  const q=state.query.trim().toLowerCase();
  if(state.chapter && item.chapter!==state.chapter) return false;
  if(state.status==='unread' && st.read) return false;
  if(state.status==='read' && !st.read) return false;
  if(state.status==='starred' && !st.starred) return false;
  if(state.status==='mastered' && !st.mastered) return false;
  if(!q) return true;
  return [item.id,item.title,item.chapter,item.range,item.batch,item.text,JSON.stringify(item.memoBlocks||[]),...(item.topics||[]),...(item.keywords||[])].join(' ').toLowerCase().includes(q);
}
function renderStats(){
  const vals=ITEMS.map(i=>itemState(i.id));
  $('#totalCount').textContent=ITEMS.length;
  $('#readCount').textContent=vals.filter(x=>x.read).length;
  $('#starCount').textContent=vals.filter(x=>x.starred).length;
  $('#masteredCount').textContent=vals.filter(x=>x.mastered).length;
}
function renderFilters(){
  const sel=$('#chapterFilter');
  const current=sel.value;
  sel.innerHTML='<option value="">全部章节</option>'+chapters().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value=current;
}
function renderList(){
  const list=$('#itemList');
  const filtered=ITEMS.filter(matches);
  if(!filtered.length){list.innerHTML='<div class="item-card"><div class="item-meta">没有匹配结果</div></div>';return;}
  if(!filtered.some(i=>i.id===state.selected)) state.selected=filtered[0].id;
  list.innerHTML=filtered.map(item=>{
    const st=itemState(item.id);
    return `<button class="item-card ${item.id===state.selected?'active':''}" data-id="${esc(item.id)}">
      <span class="order-badge">${String(item.order || '').padStart(2,'0')}</span>
      <span class="item-content">
        <span class="item-title">${esc(item.title)}</span>
        <span class="item-meta">${esc(item.id)} · ${esc(item.batch)} · ${esc(item.range)}</span>
        <span class="badges">
          ${st.read?'<span class="badge">已看</span>':'<span class="badge">未看</span>'}
          ${st.starred?'<span class="badge star">重点</span>':''}
          ${st.mastered?'<span class="badge mastered">已掌握</span>':''}
        </span>
      </span>
    </button>`
  }).join('');
}


function renderBulletList(items, cls='memory-list'){
  if(!items || !items.length) return '<ol class="'+cls+'"><li><span>1</span><p>暂无内容，后续可以继续补。</p></li></ol>';
  return '<ol class="'+cls+'">' + items.map((line,i)=>`<li><span>${i+1}</span><p>${esc(line)}</p></li>`).join('') + '</ol>';
}
function renderCompactMemo(item){
  const blocks = item.memoBlocks || [];
  if(!blocks.length) return '';
  const first = blocks[0];
  const title = blocks.length > 1 ? '本页综合必背' : first.title;
  const lines = blocks.length > 1 ? blocks.flatMap(b=>(b.understanding&&b.understanding.length?b.understanding:b.mustKnow).slice(0,1)) : ((first.understanding&&first.understanding.length?first.understanding:first.mustKnow).slice(0,3));
  return `<section class="quick-memo-card">
    <div class="section-title"><strong>${esc(title)}</strong><em>先理解，再背</em></div>
    ${renderBulletList(lines, 'memory-list compact')}
  </section>`;
}
function memoryOutlineHTML(item){
  const blocks = item.memoBlocks || [];
  const keywords = item.keywords || [];
  const keywordHTML = keywords.length ? keywords.map(k=>`<span class="keyword-pill">${esc(k)}</span>`).join('') : '<span class="keyword-pill">看图补充关键词</span>';
  let blocksHTML = '';
  if(blocks.length){
    blocksHTML = blocks.map((b,idx)=>`
      <section class="memo-block">
        <div class="memo-block-head">
          <b>${String(idx+1).padStart(2,'0')}</b>
          <div><h3>${esc(b.title)}</h3><p>按“理解 → 必背 → 考法 → 易混 → 口诀”背，不用只看框架。</p></div>
        </div>
        <div class="memory-section understand">
          <div class="section-title"><strong>怎么理解</strong><em>先看懂它在讲什么</em></div>
          ${renderBulletList(b.understanding || [])}
        </div>
        <div class="memory-section primary">
          <div class="section-title"><strong>必背知识点</strong><em>理解后直接背</em></div>
          ${renderBulletList(b.mustKnow || [])}
        </div>
        <div class="memo-two-col">
          <section class="memory-section exam">
            <div class="section-title"><strong>考试这样考</strong><em>选择/判断高频</em></div>
            ${renderBulletList(b.examPoints || [])}
          </section>
          <section class="memory-section warn">
            <div class="section-title"><strong>易混点</strong><em>专门防错</em></div>
            ${renderBulletList(b.confusing || [])}
          </section>
        </div>
        <section class="memory-section formula">
          <div class="section-title"><strong>记忆口诀</strong><em>考前快背</em></div>
          ${renderBulletList(b.mnemonic || [])}
        </section>
        <section class="memory-section supplement">
          <div class="section-title"><strong>补充说明</strong><em>理解用</em></div>
          ${renderBulletList(b.supplement || [])}
        </section>
      </section>
    `).join('');
  } else {
    const outline = item.outline || [];
    blocksHTML = `<section class="memory-section primary"><div class="section-title"><strong>提取提纲</strong><em>暂未补全文字</em></div>${renderBulletList(outline)}</section>`;
  }
  return `
    <div class="memory-mode">
      <section class="memory-section keyword-panel">
        <div class="section-title"><strong>先扫关键词</strong><em>搜索和回忆用</em></div>
        <div class="keyword-row">${keywordHTML}</div>
      </section>
      ${blocksHTML}
      <button class="raw-toggle" data-act="rawtext">${state.rawText ? '收起原始文字' : '展开原始文字'}</button>
      ${state.rawText ? `<section class="memory-section raw"><div class="section-title"><strong>原始文字</strong><em>从 PDF 自动提取，仅作核对</em></div><div class="text-block raw-text">${esc(item.text || '无文字提取内容。')}</div></section>` : ''}
    </div>`;
}

function renderDetail(){
  const item=ITEMS.find(i=>i.id===state.selected) || ITEMS[0];
  const detail=$('#detail');
  const toggle=$('#textModeToggle');
  if(toggle){ toggle.textContent = state.textMode ? '切回图文' : '进入背诵'; toggle.classList.toggle('on', state.textMode); }
  if(!item){detail.innerHTML='<p>暂无知识点</p>';return;}
  const st=itemState(item.id);
  const topics=(item.topics||[]).map(t=>`<span class="topic">${esc(t)}</span>`).join('');
  const keys=(item.keywords||[]).map(t=>`<span class="topic">#${esc(t)}</span>`).join('');
  const textOnly = memoryOutlineHTML(item);
  const pdfLink = item.pdf ? `<a class="pdf-link" href="${esc(item.pdf)}" target="_blank" rel="noopener">打开原 PDF / 原图合集</a>` : '';
  const imageHTML = item.image ? `<div class="mindmap-wrap"><img id="mindmapImg" src="${esc(item.image)}" alt="${esc(item.title)}"></div>` : `<div class="no-image-card"><strong>纯文字卡片</strong><p>为减少 GitHub 文件数量，本条新增资料不单独内置图片；需要核对原图时点下面的 PDF 合集链接。</p></div>`;
  const imageBlock = state.textMode ? '' : `${imageHTML}${pdfLink}`;
  const normalText = state.textMode ? '' : renderCompactMemo(item) + `<h3>原始文字预览</h3><div class="text-block">${esc(item.text || '无文字提取内容，直接看图。')}</div>`;
  detail.classList.remove('empty');
  detail.innerHTML=`
    <div class="detail-head">
      <div><h2>${esc(item.id)} ${esc(item.title)}</h2><p class="item-meta">顺序：${esc(item.order || '')} · ${esc(item.chapter)} · 来源：${esc(item.sourceFile)}</p></div>
      <div class="detail-actions">
        <button data-act="read" class="${st.read?'on':''}">${st.read?'已看':'标记已看'}</button>
        <button data-act="star" class="${st.starred?'on':''}">${st.starred?'重点中':'标重点'}</button>
        <button data-act="master" class="${st.mastered?'on':''}">${st.mastered?'已掌握':'标掌握'}</button>
      </div>
    </div>
    ${state.textMode ? textOnly : `<div class="topic-grid">${topics || '<span class="topic">未提取到小标题</span>'}${keys}</div>`}
    ${imageBlock}
    ${normalText}
    <div class="note-box"><h3>我的笔记</h3><textarea id="noteInput" placeholder="这里写你的理解、易混点、背诵口诀...">${esc(st.note||'')}</textarea></div>
  `;
}
function render(){renderStats();renderList();renderDetail();}

document.addEventListener('click',e=>{
  const card=e.target.closest('.item-card[data-id]'); if(card){state.selected=card.dataset.id; render(); return;}
  const btn=e.target.closest('[data-act]'); if(btn){const id=state.selected, st=itemState(id); const act=btn.dataset.act; if(act==='read') setItemState(id,{read:!st.read}); if(act==='star') setItemState(id,{starred:!st.starred}); if(act==='master') setItemState(id,{mastered:!st.mastered, read:true}); if(act==='rawtext'){state.rawText=!state.rawText; localStorage.setItem(RAW_TEXT_KEY,state.rawText?'1':'0'); render();} return;}
  if(e.target.id==='mindmapImg'){ $('#dialogImage').src=e.target.src; $('#imageDialog').showModal(); }
});
document.addEventListener('input',e=>{ if(e.target.id==='noteInput'){const id=state.selected; study[id]={...itemState(id), note:e.target.value, updatedAt:new Date().toISOString()}; localStorage.setItem(STORAGE_KEY, JSON.stringify(study)); }});
$('#searchInput').addEventListener('input',e=>{state.query=e.target.value; render();});
$('#chapterFilter').addEventListener('change',e=>{state.chapter=e.target.value; render();});
$('#statusFilter').addEventListener('change',e=>{state.status=e.target.value; render();});
$('#textModeToggle').addEventListener('click',()=>{state.textMode=!state.textMode; localStorage.setItem(TEXT_MODE_KEY, state.textMode ? '1':'0'); render();});
$('#closeDialog').addEventListener('click',()=>$('#imageDialog').close());
$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),study},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='专升本知识点学习记录.json'; a.click(); URL.revokeObjectURL(a.href);});
$('#importInput').addEventListener('change',async e=>{const file=e.target.files?.[0]; if(!file) return; try{const data=JSON.parse(await file.text()); study=data.study||data||{}; saveStudy(); alert('导入完成');}catch{alert('导入失败，请选择正确的 JSON 文件');}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); deferredPrompt=e; $('#installBtn').classList.remove('hidden');});
$('#installBtn').addEventListener('click',async()=>{ if(deferredPrompt){deferredPrompt.prompt(); deferredPrompt=null; $('#installBtn').classList.add('hidden'); }});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
renderFilters(); render();
