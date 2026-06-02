const API_URL='';
let currentUser=null,allProviders=[],allIngredients=[],allClients=[],allStockProducts=[];

function switchView(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id).classList.add('active');}
function setNow(id){const el=document.getElementById(id);if(el&&!el.value){const n=new Date();n.setMinutes(n.getMinutes()-n.getTimezoneOffset());el.value=n.toISOString().slice(0,16);}}

function switchSection(secId,title){
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    const t=document.getElementById(secId);if(t)t.classList.add('active');
    document.getElementById('view-title').textContent=title.toUpperCase();
    if(secId==='sec-performance')loadMetrics();
    if(secId==='sec-ventas'){loadClientsDropdown();loadStockDropdown();loadSalesHistory();setNow('sale-date');}
    if(secId==='sec-gastos'){loadCategories();loadProvidersDropdown();loadExpensesHistory();setNow('exp-date'); if(expCont.children.length===0) addExpRow();}
    if(secId==='sec-ingresos'){loadProductsDropdown('prodrun-product');loadProductionHistory();setNow('prodrun-date');}
    if(secId==='sec-clientes')loadClients();
    if(secId==='sec-proveedores')loadProviders();
    if(secId==='sec-escandallos'){loadIngredientsCache().then(()=>{loadEscandalloTable(); if(escCont.children.length===0) addEscRow();});}
}

document.getElementById('login-form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const res=await fetch(`${API_URL}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('username').value,password:document.getElementById('password').value})});
    if(res.ok){currentUser=await res.json();setupDashboard();switchView('dashboard-view');}
    else document.getElementById('login-error').textContent='ERROR DE ACCESO';
});
document.getElementById('logout-btn').addEventListener('click',()=>{currentUser=null;switchView('login-view');});

function setupDashboard(){
    document.getElementById('user-display').textContent=`${currentUser.username.toUpperCase()} (${currentUser.role.toUpperCase()})`;
    const nav=document.getElementById('nav-links');nav.innerHTML='';
    if(currentUser.role==='Admin'){
        addNav('donut_small','PERFORMANCE','sec-performance',true);
        addNav('point_of_sale','VENTAS','sec-ventas');
        addNav('receipt_long','GASTOS','sec-gastos');
        addNav('conveyor_belt','INGRESOS','sec-ingresos');
        addNav('person','CLIENTES','sec-clientes');
        addNav('local_shipping','PROVEEDORES','sec-proveedores');
        addNav('inventory_2','PRODUCTOS','sec-escandallos');
        switchSection('sec-performance','PERFORMANCE');
    } else {
        addNav('point_of_sale','VENTAS','sec-ventas',true);
        switchSection('sec-ventas','VENTAS');
    }
}
function addNav(icon,text,secId,active=false){
    const li=document.createElement('li');
    const a=document.createElement('a');a.href='#';
    a.innerHTML=`<span class="material-symbols-outlined">${icon}</span> ${text}`;
    if(active)a.classList.add('active');
    a.addEventListener('click',(e)=>{e.preventDefault();document.querySelectorAll('#nav-links a').forEach(l=>l.classList.remove('active'));a.classList.add('active');switchSection(secId,text);});
    li.appendChild(a);document.getElementById('nav-links').appendChild(li);
}

// PRODUCTOS
async function loadIngredientsCache(){
    allIngredients=await(await fetch(`${API_URL}/ingredients`)).json();
    const dl=document.getElementById('ingredients-list');
    if(dl)dl.innerHTML=allIngredients.map(i=>`<option value="${i.name}">`).join('');
}
async function loadEscandalloTable(){
    const products=await(await fetch(`${API_URL}/products`)).json();
    const tbody=document.getElementById('escandallo-tbody');tbody.innerHTML='';
    for(const prod of products){
        const ingredients=await(await fetch(`${API_URL}/recipes/${prod.id}`)).json();
        const ingHtml=ingredients.map(ing=>`<tr class="ingredient-row row-prod-${prod.id}"><td></td><td style="padding-left:30px;color:var(--text-muted);"><span class="material-symbols-outlined" style="font-size:1rem;vertical-align:middle;">subdirectory_arrow_right</span> ${ing.name}</td><td colspan="3" class="text-muted">Cant: ${ing.quantity}</td><td colspan="2" class="text-muted">$${(ing.quantity*ing.cost).toFixed(2)}</td></tr>`).join('');
        tbody.innerHTML+=`<tr class="group-header"><td style="text-align:center;">${ingredients.length>0?`<span class="material-symbols-outlined toggle-btn" onclick="toggleIng(${prod.id},this)">expand_more</span>`:''}</td><td><strong>${prod.name}</strong></td><td>${prod.yield||1}</td><td style="text-align:center;">${prod.min_stock||0} u.</td><td>$${prod.price.toFixed(2)}</td><td><strong style="color:var(--primary);">$${prod.gpu.toFixed(2)}</strong></td><td style="white-space:nowrap;"><button class="btn secondary outline btn-icon" onclick="editProduct(${prod.id},'${prod.name}',${prod.price},${prod.yield||1},${prod.min_stock||0})" title="Editar"><span class="material-symbols-outlined">edit</span></button> <button class="btn secondary outline btn-icon" onclick="deleteProduct(${prod.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button></td></tr>${ingHtml}`;
    }
}
function toggleIng(id,el){document.querySelectorAll(`.row-prod-${id}`).forEach(r=>r.classList.toggle('show'));el.textContent=el.textContent==='expand_more'?'expand_less':'expand_more';}

const escCont=document.getElementById('esc-items-container');
function addEscRow(name='',qty=''){
    const row=document.createElement('div');row.className='esc-row';
    row.style.cssText='display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:10px;margin-bottom:10px;';
    const ing=allIngredients.find(i=>i.name.toLowerCase()===name.toLowerCase());
    row.innerHTML=`<input type="text" class="esc-item-name" placeholder="Insumo" list="ingredients-list" value="${name}"><input type="number" step="0.01" class="esc-item-qty" placeholder="Cant." value="${qty}"><input type="text" class="esc-item-cost" readonly disabled style="background:rgba(0,0,0,0.2);" value="${ing?(ing.cost*(parseFloat(qty)||0)).toFixed(2):'0.00'}"><button type="button" class="btn secondary outline remove-esc-item btn-icon"><span class="material-symbols-outlined">close</span></button>`;
    escCont.appendChild(row);
}
document.getElementById('esc-add-item-btn').addEventListener('click',()=>addEscRow());
escCont.addEventListener('click',e=>{const b=e.target.closest('.remove-esc-item');if(b){b.closest('.esc-row').remove();updateEscTotals();}});
escCont.addEventListener('input',e=>{
    if(e.target.classList.contains('esc-item-name')||e.target.classList.contains('esc-item-qty')){
        const row=e.target.closest('.esc-row');
        const ing=allIngredients.find(i=>i.name.toLowerCase()===row.querySelector('.esc-item-name').value.toLowerCase());
        row.querySelector('.esc-item-cost').value=((parseFloat(row.querySelector('.esc-item-qty').value)||0)*(ing?ing.cost:0)).toFixed(2);
        updateEscTotals();
    }
});
function updateEscTotals(){
    let t=0;document.querySelectorAll('.esc-item-cost').forEach(el=>t+=parseFloat(el.value)||0);
    const y=parseFloat(document.getElementById('esc-yield').value)||1;
    document.getElementById('esc-total-batch-cost').textContent=`$${t.toFixed(2)}`;
    document.getElementById('esc-gpu-display').textContent=`$${(t/y).toFixed(2)}`;
}
document.getElementById('esc-yield').addEventListener('input',updateEscTotals);
let editingProductId=null;
function editProduct(id,name,price,yld,minStock){
    editingProductId=id;
    document.getElementById('esc-sabor').value=name;
    document.getElementById('esc-sale-price').value=price;
    document.getElementById('esc-yield').value=yld;
    document.getElementById('esc-min-stock').value=minStock || 0;
    escCont.innerHTML='';document.getElementById('cancel-edit-product-btn').style.display='inline-flex';
    fetch(`${API_URL}/recipes/${id}`).then(r=>r.json()).then(items=>{items.forEach(i=>addEscRow(i.name,i.quantity));if(!items.length)addEscRow();updateEscTotals();});
    window.scrollTo({top:0,behavior:'smooth'});
}
document.getElementById('cancel-edit-product-btn').addEventListener('click',()=>{editingProductId=null;document.getElementById('escandallo-form').reset();document.getElementById('esc-min-stock').value=0;escCont.innerHTML='';addEscRow();updateEscTotals();document.getElementById('cancel-edit-product-btn').style.display='none';});
document.getElementById('escandallo-form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const sabor=document.getElementById('esc-sabor').value.trim().toUpperCase();
    const price=parseFloat(document.getElementById('esc-sale-price').value);
    const yld=parseFloat(document.getElementById('esc-yield').value);
    const minStock=parseInt(document.getElementById('esc-min-stock').value) || 0;
    let productId=editingProductId;
    if(!productId){
        await fetch(`${API_URL}/products`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flavor_name:sabor,sale_price:price,yield_per_batch:yld,min_stock:minStock})});
        productId=(await(await fetch(`${API_URL}/products`)).json()).find(p=>p.name.toLowerCase()===sabor.toLowerCase())?.id;
    } else {
        await fetch(`${API_URL}/products/${productId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({flavor_name:sabor,sale_price:price,yield_per_batch:yld,min_stock:minStock})});
    }
    const items=[];
    for(const row of document.querySelectorAll('.esc-row')){
        const name=row.querySelector('.esc-item-name').value.trim();const qty=parseFloat(row.querySelector('.esc-item-qty').value);
        if(!name||isNaN(qty))continue;
        let ing=allIngredients.find(i=>i.name.toLowerCase()===name.toLowerCase());
        if(!ing){await fetch(`${API_URL}/ingredients`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.toUpperCase()})});await loadIngredientsCache();ing=allIngredients.find(i=>i.name.toLowerCase()===name.toLowerCase());}
        if(ing)items.push({ingredient_id:ing.id,quantity:qty});
    }
    const res=await fetch(`${API_URL}/recipes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:productId,yield_per_batch:yld,items})});
    if(res.ok){e.target.reset();escCont.innerHTML='';addEscRow();editingProductId=null;document.getElementById('cancel-edit-product-btn').style.display='none';loadEscandalloTable();const m=document.getElementById('esc-msg');m.textContent='PRODUCTO GUARDADO';m.className='success-msg';setTimeout(()=>m.textContent='',3000);}
});
async function deleteProduct(id){
    if(confirm('¿ELIMINAR ESTE PRODUCTO?')){
        const r=await fetch(`${API_URL}/products/${id}`,{method:'DELETE'});
        if(!r.ok){const d=await r.json();alert(d.detail||'Error');}else{loadEscandalloTable();if(editingProductId===id)document.getElementById('cancel-edit-product-btn').click();}
    }
}

// VENTAS
async function loadClientsDropdown(){
    const res=await fetch(`${API_URL}/clients`);
    const data=await res.json();
    const el=document.getElementById('sale-client');
    if(el)el.innerHTML='<option value="">SELECCIONAR CLIENTE...</option>'+data.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
}
async function loadStockDropdown(){
    const res=await fetch(`${API_URL}/stock`);
    allStockProducts=await res.json();
    if(document.querySelectorAll('.sale-row').length===0) addSaleRow();
}
const saleCont=document.getElementById('sale-items-container');
function addSaleRow(prodId='',qty=''){
    const row=document.createElement('div');row.className='sale-row';
    row.style.cssText='display:grid;grid-template-columns:3fr 1fr 40px;gap:10px;margin-bottom:10px;';
    row.innerHTML=`<select class="sale-item-prod" required><option value="">SABOR...</option>${allStockProducts.map(p=>`<option value="${p.id}" ${p.id==prodId?'selected':''}>${p.name}</option>`).join('')}</select><input type="number" class="sale-item-qty" placeholder="CANT." required value="${qty}"><button type="button" class="btn secondary outline remove-sale-item btn-icon"><span class="material-symbols-outlined">close</span></button>`;
    saleCont.appendChild(row);
    updateSaleTotals();
}
document.getElementById('add-sale-item-btn').addEventListener('click',()=>addSaleRow());
saleCont.addEventListener('click',e=>{const b=e.target.closest('.remove-sale-item');if(b){b.closest('.sale-row').remove();updateSaleTotals();}});
saleCont.addEventListener('input',updateSaleTotals);

function getDiscountValueToSend() {
    const val = parseFloat(document.getElementById('sale-discount').value) || 0;
    const type = document.getElementById('sale-discount-type').value;
    if (val === 0) return 0;
    // Positive = percentage, negative = fixed amount (matches backend convention)
    return type === 'percent' ? val : -val;
}

function updateSaleTotals(){
    let total=0;
    document.querySelectorAll('.sale-row').forEach(row=>{
        const pId=row.querySelector('.sale-item-prod').value;
        const qty=parseFloat(row.querySelector('.sale-item-qty').value)||0;
        const prod=allStockProducts.find(p=>p.id==pId);
        if(prod) total+=(prod.price*qty);
    });
    const discVal = getDiscountValueToSend();
    let finalTotal = total;
    if (discVal > 0) {
        finalTotal = total * (1 - (discVal / 100));
    } else if (discVal < 0) {
        finalTotal = total - Math.abs(discVal);
    }
    if (finalTotal < 0) finalTotal = 0;
    document.getElementById('sale-total-display').textContent=finalTotal.toFixed(2);
}
document.getElementById('sale-discount').addEventListener('input',updateSaleTotals);
document.getElementById('sale-discount-type').addEventListener('change',updateSaleTotals);

document.getElementById('sale-form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const items=[];
    document.querySelectorAll('.sale-row').forEach(row=>{
        const pId=row.querySelector('.sale-item-prod').value;
        const qty=parseInt(row.querySelector('.sale-item-qty').value);
        if(pId&&qty)items.push({product_id:parseInt(pId),quantity:qty});
    });
    const payload={
        client_name:document.getElementById('sale-client').value,
        items:items,
        discount:getDiscountValueToSend(),
        date:document.getElementById('sale-date').value
    };
    const res=await fetch(`${API_URL}/sales`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.ok){
        e.target.reset();saleCont.innerHTML='';addSaleRow();setNow('sale-date');loadSalesHistory();
        const m=document.getElementById('sale-msg');m.textContent='VENTA REGISTRADA';m.className='success-msg';setTimeout(()=>m.textContent='',3000);
    }
});

async function loadSalesHistory(){
    const res=await fetch(`${API_URL}/sales`);
    const data=await res.json();
    document.getElementById('sales-history-tbody').innerHTML=data.map(s=>`<tr><td>${s.date.replace('T',' ')}</td><td><strong>${s.client}</strong></td><td>${s.discount}</td><td><strong>$${s.total.toFixed(2)}</strong></td><td><span class="tag tag-red">$${s.gpu?s.gpu.toFixed(2):'0.00'}</span></td><td><button class="btn secondary outline btn-icon" onclick="viewSaleDetails(${s.id})" title="Ver"><span class="material-symbols-outlined">visibility</span></button> <button class="btn secondary outline btn-icon" onclick="deleteSale(${s.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button></td></tr>`).join('');
}
async function viewSaleDetails(id){
    const res=await fetch(`${API_URL}/sales/${id}/items`);
    const items=await res.json();
    document.getElementById('modal-title').textContent=`DETALLE DE VENTA #${id}`;
    document.getElementById('modal-body').innerHTML=`<table class="data-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>GPU (Unit)</th><th>GPV (Total)</th></tr></thead><tbody>${items.map(i=>`<tr><td>${i.product}</td><td>${i.quantity}</td><td>$${i.unit_price.toFixed(2)}</td><td>$${i.gpu.toFixed(2)}</td><td>$${(i.gpu*i.quantity).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
    document.getElementById('detail-modal').style.display='block';
}
async function deleteSale(id){
    if(confirm('¿ELIMINAR ESTA VENTA? EL STOCK SERÁ DEVUELTO.')){
        await fetch(`${API_URL}/sales/${id}`,{method:'DELETE'});loadSalesHistory();
    }
}

// GASTOS
async function loadCategories(){
    const res=await fetch(`${API_URL}/categories`);
    const data=await res.json();
    const el=document.getElementById('exp-cat');
    if(el)el.innerHTML=data.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
}
async function loadProvidersDropdown(){
    const res=await fetch(`${API_URL}/providers`);
    allProviders=await res.json();
    const el=document.getElementById('exp-prov');
    if(el){
        el.innerHTML='<option value="">SELECCIONAR PROVEEDOR...</option>'+allProviders.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
        el.addEventListener('change',()=>{
            const p=allProviders.find(x=>x.id==el.value);
            if(p)document.getElementById('exp-cat').value=p.category;
        });
    }
}
const expCont=document.getElementById('expense-items-container');
function addExpRow(desc='',qty=1,price=''){
    const row=document.createElement('div');row.className='exp-row';
    row.style.cssText='display:grid;grid-template-columns:3fr 1fr 1fr 40px;gap:10px;margin-bottom:10px;';
    row.innerHTML=`<input type="text" class="exp-item-desc" placeholder="Descripción" value="${desc}" required><input type="number" step="0.01" class="exp-item-qty" placeholder="Cant." value="${qty}" required><input type="number" step="0.01" class="exp-item-price" placeholder="Precio Unit." value="${price}" required><button type="button" class="btn secondary outline remove-exp-item btn-icon"><span class="material-symbols-outlined">close</span></button>`;
    expCont.appendChild(row);
}
document.getElementById('add-item-btn').addEventListener('click',()=>addExpRow());
expCont.addEventListener('click',e=>{const b=e.target.closest('.remove-exp-item');if(b){b.closest('.exp-row').remove();updateExpTotal();}});
expCont.addEventListener('input',updateExpTotal);
function updateExpTotal(){
    let t=0;
    document.querySelectorAll('.exp-row').forEach(row=>{
        const q=parseFloat(row.querySelector('.exp-item-qty').value)||0;
        const p=parseFloat(row.querySelector('.exp-item-price').value)||0;
        t+=(q*p);
    });
    document.getElementById('exp-total-display').textContent=t.toFixed(2);
}
let editingExpenseId=null;
document.getElementById('expense-form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const items=[];
    document.querySelectorAll('.exp-row').forEach(row=>{
        const desc=row.querySelector('.exp-item-desc').value.trim();
        const qty=parseFloat(row.querySelector('.exp-item-qty').value)||0;
        const price=parseFloat(row.querySelector('.exp-item-price').value)||0;
        if(desc&&qty&&price)items.push({description:desc,quantity:qty,unit_price:price});
    });
    const payload={
        provider_id:parseInt(document.getElementById('exp-prov').value),
        category_name:document.getElementById('exp-cat').value,
        date:document.getElementById('exp-date').value,
        items:items
    };
    let url=`${API_URL}/expenses`,method='POST';
    if(editingExpenseId){url=`${API_URL}/expenses/${editingExpenseId}`;method='PUT';}
    const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.ok){
        e.target.reset();expCont.innerHTML='';addExpRow();setNow('exp-date');loadExpensesHistory();
        editingExpenseId=null;document.getElementById('cancel-edit-expense-btn').style.display='none';
        const m=document.getElementById('exp-msg');m.textContent='GASTO GUARDADO';m.className='success-msg';setTimeout(()=>m.textContent='',3000);
    }
});
async function loadExpensesHistory(){
    const res=await fetch(`${API_URL}/expenses`);
    const data=await res.json();
    document.getElementById('expenses-history-tbody').innerHTML=data.map(e=>`<tr><td>${e.date.replace('T',' ')}</td><td>${e.provider_name}</td><td>${e.category_name}</td><td><strong>$${e.total.toFixed(2)}</strong></td><td style="white-space:nowrap;"><button class="btn secondary outline btn-icon" onclick="viewExpenseDetails(${e.id})" title="Ver"><span class="material-symbols-outlined">visibility</span></button> <button class="btn secondary outline btn-icon" onclick="editExpense(${e.id})" title="Editar"><span class="material-symbols-outlined">edit</span></button> <button class="btn secondary outline btn-icon" onclick="deleteExpense(${e.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button></td></tr>`).join('');
}
async function editExpense(id){
    const res=await fetch(`${API_URL}/expenses`);
    const all=await res.json();
    const exp=all.find(x=>x.id===id);if(!exp)return;
    editingExpenseId=id;
    document.getElementById('exp-prov').value=exp.provider_id;
    document.getElementById('exp-cat').value=exp.category_name;
    document.getElementById('exp-date').value=exp.date;
    expCont.innerHTML='';
    const itemsRes=await fetch(`${API_URL}/expenses/${id}/items`);
    const items=await itemsRes.json();
    items.forEach(i=>addExpRow(i.description,i.quantity,i.unit_price));
    updateExpTotal();
    document.getElementById('cancel-edit-expense-btn').style.display='inline-flex';
    window.scrollTo({top:0,behavior:'smooth'});
}
document.getElementById('cancel-edit-expense-btn').addEventListener('click',()=>{editingExpenseId=null;document.getElementById('expense-form').reset();expCont.innerHTML='';addExpRow();updateExpTotal();document.getElementById('cancel-edit-expense-btn').style.display='none';});
async function deleteExpense(id){if(confirm('¿ELIMINAR ESTE GASTO?')){await fetch(`${API_URL}/expenses/${id}`,{method:'DELETE'});loadExpensesHistory();}}
async function viewExpenseDetails(id){
    const res=await fetch(`${API_URL}/expenses/${id}/items`);
    const items=await res.json();
    document.getElementById('modal-title').textContent=`DETALLE DE GASTO #${id}`;
    document.getElementById('modal-body').innerHTML=`<table class="data-table"><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead><tbody>${items.map(i=>`<tr><td>${i.description}</td><td>${i.quantity}</td><td>$${i.unit_price.toFixed(2)}</td><td>$${(i.quantity*i.unit_price).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
    document.getElementById('detail-modal').style.display='block';
}

// INGRESOS (PRODUCCIÓN)
let editingProdRunId=null;
async function loadProductionHistory(){
    const res=await fetch(`${API_URL}/production`);
    const data=await res.json();
    document.getElementById('prodrun-tbody').innerHTML=data.map(pr=>`<tr><td>${pr.date.replace('T',' ')}</td><td><strong>${pr.product_name}</strong></td><td>${pr.quantity}</td><td style="white-space:nowrap;"><button class="btn secondary outline btn-icon" onclick="editProdRun(${pr.id})" title="Editar"><span class="material-symbols-outlined">edit</span></button> <button class="btn secondary outline btn-icon" onclick="deleteProdRun(${pr.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button></td></tr>`).join('');
}
async function loadProductsDropdown(id){
    const res=await fetch(`${API_URL}/products`);
    const data=await res.json();
    const el=document.getElementById(id);
    if(el)el.innerHTML=data.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
}
document.getElementById('prodrun-form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const payload={product_id:parseInt(document.getElementById('prodrun-product').value),quantity:parseInt(document.getElementById('prodrun-qty').value),date:document.getElementById('prodrun-date').value};
    let url=`${API_URL}/production`,method='POST';
    if(editingProdRunId){url=`${API_URL}/production/${editingProdRunId}`;method='PUT';}
    const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.ok){e.target.reset();setNow('prodrun-date');loadProductionHistory();editingProdRunId=null;document.getElementById('cancel-edit-prodrun-btn').style.display='none';}
});
async function editProdRun(id){
    const res=await fetch(`${API_URL}/production`);
    const all=await res.json();
    const pr=all.find(x=>x.id===id);if(!pr)return;
    editingProdRunId=id;
    document.getElementById('prodrun-product').value=pr.product_id;
    document.getElementById('prodrun-qty').value=pr.quantity;
    document.getElementById('prodrun-date').value=pr.date;
    document.getElementById('cancel-edit-prodrun-btn').style.display='inline-flex';
    window.scrollTo({top:0,behavior:'smooth'});
}
document.getElementById('cancel-edit-prodrun-btn').addEventListener('click',()=>{editingProdRunId=null;document.getElementById('prodrun-form').reset();setNow('prodrun-date');document.getElementById('cancel-edit-prodrun-btn').style.display='none';});
async function deleteProdRun(id){if(confirm('¿ELIMINAR ESTE INGRESO?')){await fetch(`${API_URL}/production/${id}`,{method:'DELETE'});loadProductionHistory();}}

// CLIENTES
async function loadClients(){
    const res=await fetch(`${API_URL}/clients`);
    allClients=await res.json();
    document.getElementById('clients-tbody').innerHTML=allClients.map(c=>`<tr><td><strong>${c.name}</strong></td><td>${c.phone||'---'}</td><td style="white-space:nowrap;"><button class="btn secondary outline btn-icon" onclick="editClient(${c.id},'${c.name}','${c.phone}')" title="Editar"><span class="material-symbols-outlined">edit</span></button> <button class="btn secondary outline btn-icon" onclick="deleteClient(${c.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button></td></tr>`).join('');
}
document.getElementById('client-form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const payload={name:document.getElementById('client-name').value.trim(),phone:document.getElementById('client-phone').value.trim()||null};
    let url=`${API_URL}/clients`,method='POST';
    if(editingClientId){url=`${API_URL}/clients/${editingClientId}`;method='PUT';}
    const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.ok){e.target.reset();editingClientId=null;document.getElementById('cancel-edit-client-btn').style.display='none';loadClients();}
});
let editingClientId=null;
function editClient(id,name,phone){editingClientId=id;document.getElementById('client-name').value=name;document.getElementById('client-phone').value=phone||'';document.getElementById('cancel-edit-client-btn').style.display='inline-flex';window.scrollTo({top:0,behavior:'smooth'});}
document.getElementById('cancel-edit-client-btn').addEventListener('click',()=>{editingClientId=null;document.getElementById('client-form').reset();document.getElementById('cancel-edit-client-btn').style.display='none';});
async function deleteClient(id){if(confirm('¿ELIMINAR ESTE CLIENTE?')){await fetch(`${API_URL}/clients/${id}`,{method:'DELETE'});loadClients();}}

// PROVEEDORES
async function loadProviders(){
    const res=await fetch(`${API_URL}/providers`);
    allProviders=await res.json();
    document.getElementById('providers-tbody').innerHTML=allProviders.map(p=>`<tr><td>${p.name}</td><td>${p.category}</td><td style="white-space:nowrap;"><button class="btn secondary outline btn-icon" onclick="deleteProvider(${p.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button></td></tr>`).join('');
}
document.getElementById('provider-form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const payload={name:document.getElementById('prov-name').value.trim(),category_name:document.getElementById('prov-cat').value};
    const res=await fetch(`${API_URL}/providers`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.ok){e.target.reset();loadProviders();const m=document.getElementById('prov-msg');m.textContent='PROVEEDOR GUARDADO';m.className='success-msg';setTimeout(()=>m.textContent='',3000);}
});
async function deleteProvider(id){if(confirm('¿ELIMINAR ESTE PROVEEDOR?')){await fetch(`${API_URL}/providers/${id}`,{method:'DELETE'});loadProviders();}}

// PERFORMANCE (Rendimiento Inteligente con Refacción de Lógica y Estado Inicial Bloqueado)
// PERFORMANCE (Rendimiento Inteligente con Refacción de Lógica y Estado Inicial Bloqueado)
async function loadMetrics() {
    try {
        // 1. Consumir asíncronamente ventas, gastos y productos existentes (sin tocar sus funciones)
        const [salesRes, expensesRes, productsRes] = await Promise.all([
            fetch(`${API_URL}/sales`),
            fetch(`${API_URL}/expenses`),
            fetch(`${API_URL}/products`)
        ]);
        
        const allSales = await salesRes.json();
        const allExpenses = await expensesRes.json();
        const allProducts = await productsRes.json();

        // 2. EXCEPCIÓN DE BLOQUEO (CTR - Capital Total Restante) y STOCK DISPONIBLE: SIEMPRE cargado
        // CTR = Suma de todas las ventas históricas - GTR histórico acumulado de las ventas
        let totalVentasHistorico = 0;
        let totalGTRHistorico = 0;

        // Sumar directamente usando los campos optimizados devueltos por el backend (sin fetches concurrentes)
        allSales.forEach(sale => {
            totalVentasHistorico += parseFloat(sale.total) || 0;
            totalGTRHistorico += parseFloat(sale.gpu_total) || 0;
        });

        const ctr = totalVentasHistorico - totalGTRHistorico;
        const ctrValorEl = document.getElementById('perf-ctr-valor');
        if (ctrValorEl) {
            ctrValorEl.textContent = `${ctr >= 0 ? '' : '-'}$${Math.abs(ctr).toFixed(2)}`;
            ctrValorEl.className = ctr >= 0 ? 'value positive' : 'value negative';
        }

        // Cargar y renderizar stock disponible en tiempo real
        const stockRes = await fetch(`${API_URL}/stock`);
        const stockData = await stockRes.json();
        const stockTbody = document.getElementById('perf-stock-tbody');
        if (stockTbody) {
            // Filtrar productos con stock > 0
            const activeStock = stockData.filter(item => item.stock > 0);
            if (activeStock.length === 0) {
                stockTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Sin stock disponible en almacén</td></tr>`;
            } else {
                stockTbody.innerHTML = activeStock.map(item => {
                    const minStockThreshold = item.min_stock || 0;
                    const isLow = item.stock <= minStockThreshold;
                    const badgeClass = isLow ? 'tag tag-red' : 'tag tag-green';
                    const badgeText = isLow ? 'BAJO STOCK' : 'OK';
                    return `<tr>
                        <td><strong>${item.name}</strong></td>
                        <td style="text-align: center; font-weight: 700; color: ${isLow ? '#ef4444' : 'var(--text)'};">${item.stock} u.</td>
                        <td style="text-align: center; color: var(--text-muted);">${minStockThreshold} u.</td>
                        <td style="text-align: right;"><span class="${badgeClass}">${badgeText}</span></td>
                    </tr>`;
                }).join('');
            }
        }

        // 3. DINAMISMO DEL SELECTOR: Sólo listar meses que REALMENTE tienen datos en Ventas o Gastos
        const monthsSet = new Set();
        allSales.forEach(s => { if(s.date) monthsSet.add(s.date.slice(0, 7)); });
        allExpenses.forEach(e => { if(e.date) monthsSet.add(e.date.slice(0, 7)); });

        const sortedMonths = Array.from(monthsSet).sort().reverse(); // Del más nuevo al más viejo

        // 4. Inicializar selector interactivo de forma segura (clonando para limpiar listeners previos)
        const selector = document.getElementById('performance-month-select');
        if (selector) {
            const currentValue = selector.value;

            selector.innerHTML = '<option value="">Seleccionar mes...</option>' + sortedMonths.map(m => {
                const [year, month] = m.split('-');
                const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const label = `${monthNames[parseInt(month) - 1]} ${year}`;
                return `<option value="${m}">${label}</option>`;
            }).join('');

            // Restaurar el valor si sigue siendo válido
            if (currentValue && sortedMonths.includes(currentValue)) {
                selector.value = currentValue;
            }

            // Clonar nodo para remover listeners previos del selector de forma limpia
            const newSelector = selector.cloneNode(true);
            selector.parentNode.replaceChild(newSelector, selector);

            newSelector.addEventListener('change', () => {
                const selectedMonth = newSelector.value;
                if (!selectedMonth) {
                    document.getElementById('perf-blocked-msg').style.display = 'block';
                    document.getElementById('perf-data-container').style.display = 'none';
                } else {
                    document.getElementById('perf-blocked-msg').style.display = 'none';
                    document.getElementById('perf-data-container').style.display = 'block';
                    calculateAndRenderMetrics(selectedMonth, allSales, allExpenses, allProducts);
                }
            });

            // Si hay un período seleccionado, calcular métricas inmediatamente
            if (newSelector.value) {
                document.getElementById('perf-blocked-msg').style.display = 'none';
                document.getElementById('perf-data-container').style.display = 'block';
                calculateAndRenderMetrics(newSelector.value, allSales, allExpenses, allProducts);
            } else {
                document.getElementById('perf-blocked-msg').style.display = 'block';
                document.getElementById('perf-data-container').style.display = 'none';
            }
        }
    } catch (err) {
        console.error("Error al cargar métricas de performance:", err);
    }
}

async function calculateAndRenderMetrics(targetMonth, sales, expenses, products) {
    // Filtrar Ventas y Gastos del mes seleccionado
    const monthlySales = sales.filter(s => s.date && s.date.slice(0, 7) === targetMonth);
    const monthlyExpenses = expenses.filter(e => e.date && e.date.slice(0, 7) === targetMonth);

    // --- A) CÁLCULO DE INGRESOS BRUTOS POR PRODUCTO ---
    const productSalesMap = {}; 
    let totalIngresosBrutos = 0;
    let totalGTR = 0; // GTR (Gasto Total Real del mes) = Sumatoria de (Unidades Vendidas * GPU)

    // Consultar items detallados de las ventas del mes seleccionado (son pocas, no sobrecarga Neon)
    const saleDetailsPromises = monthlySales.map(s => fetch(`${API_URL}/sales/${s.id}/items`).then(res => res.json()).catch(() => []));
    const allMonthlySaleItems = await Promise.all(saleDetailsPromises);

    allMonthlySaleItems.forEach((items) => {
        items.forEach(item => {
            const flavor = item.product || "PRODUCTO DESCONOCIDO";
            const qty = item.quantity || 0;
            const subtotal = item.subtotal || 0;
            const unitGpu = item.gpu || 0;
            const itemCost = unitGpu * qty;

            if (!productSalesMap[flavor]) {
                productSalesMap[flavor] = { qty: 0, revenue: 0 };
            }
            productSalesMap[flavor].qty += qty;
            productSalesMap[flavor].revenue += subtotal;

            totalGTR += itemCost;
            totalIngresosBrutos += subtotal;
        });
    });

    // Renderizar tabla de Ingresos por Producto
    const ingresosTbody = document.getElementById('perf-ingresos-productos-tbody');
    if (ingresosTbody) {
        const sortedProducts = Object.keys(productSalesMap).sort();
        if (sortedProducts.length === 0) {
            ingresosTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Sin ventas en este período</td></tr>`;
        } else {
            ingresosTbody.innerHTML = sortedProducts.map(prod => {
                const data = productSalesMap[prod];
                return `<tr>
                    <td><strong>${prod}</strong></td>
                    <td style="text-align: center; font-weight: 600;">${data.qty} u.</td>
                    <td style="text-align: right; font-weight: 700; color: var(--positive);">$${data.revenue.toFixed(2)}</td>
                </tr>`;
            }).join('');
        }
    }

    // --- B) EGRESOS POR MES POR CATEGORÍA (8 categorías del sistema) ---
    const officialCategories = [
        "SUELDOS", "INSUMOS", "UTENSILIOS", "PROGRAMAS", 
        "SITIO WEB", "DISEÑADOR", "PACKAGING", "MARKETING"
    ];
    
    const categoryExpensesMap = {};
    officialCategories.forEach(cat => categoryExpensesMap[cat] = 0);
    let totalEgresos = 0;

    monthlyExpenses.forEach(exp => {
        const category = (exp.category || "").toUpperCase();
        const total = parseFloat(exp.total) || 0;
        
        totalEgresos += total;
        
        if (categoryExpensesMap.hasOwnProperty(category)) {
            categoryExpensesMap[category] += total;
        } else {
            if (!categoryExpensesMap["OTROS"]) categoryExpensesMap["OTROS"] = 0;
            categoryExpensesMap["OTROS"] += total;
        }
    });

    // Renderizar tabla de Egresos
    const egresosTbody = document.getElementById('perf-egresos-categorias-tbody');
    if (egresosTbody) {
        egresosTbody.innerHTML = Object.keys(categoryExpensesMap).map(cat => {
            const amount = categoryExpensesMap[cat];
            return `<tr>
                <td><strong>${cat}</strong></td>
                <td style="text-align: right; font-weight: 700; color: ${amount > 0 ? '#f472b6' : 'var(--text-muted)'};">$${amount.toFixed(2)}</td>
            </tr>`;
        }).join('');
    }

    // --- C) RNA (Rentabilidad Neta Aproximada) ---
    const rna = totalIngresosBrutos > 0 ? ((totalIngresosBrutos - totalGTR) / totalIngresosBrutos * 100) : 0;

    const rendimientoEl = document.getElementById('perf-rendimiento-real');
    if (rendimientoEl) {
        rendimientoEl.textContent = `${rna.toFixed(2)}%`;
        rendimientoEl.className = rna >= 0 ? 'value positive' : 'value negative';
    }

    const rentabilidadPorcentajeEl = document.getElementById('perf-rentabilidad-porcentaje');
    if (rentabilidadPorcentajeEl) {
        const margenPesos = totalIngresosBrutos - totalGTR;
        rentabilidadPorcentajeEl.innerHTML = `Ganancia Estimada: <strong style="color: ${margenPesos >= 0 ? 'var(--positive)' : '#f472b6'};">${margenPesos >= 0 ? '' : '-'}$${Math.abs(margenPesos).toFixed(2)}</strong> (descontando GTR de $${totalGTR.toFixed(2)})`;
    }

    // Actualizar tarjetas de apoyo
    document.getElementById('perf-total-ingresos').textContent = `$${totalIngresosBrutos.toFixed(2)}`;
    document.getElementById('perf-total-gtr').textContent = `$${totalGTR.toFixed(2)}`;
    document.getElementById('perf-total-egresos').textContent = `$${totalEgresos.toFixed(2)}`;
}

// Global init - Removed automatic row calls to prevent errors on empty data
// addEscRow();addExpRow();addSaleRow();
