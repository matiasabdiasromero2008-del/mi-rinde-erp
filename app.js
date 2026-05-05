const API_URL = '';
let currentUser = null;
let allProviders = [];
let allIngredients = [];

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function setDefaultDateTime(id) {
    const el = document.getElementById(id);
    if (el && !el.value) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        el.value = now.toISOString().slice(0, 16);
    }
}

function switchSection(secId, title) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(secId);
    if (target) target.classList.add('active');
    document.getElementById('view-title').textContent = title.toUpperCase();
    
    if (secId === 'sec-performance') loadMetrics();
    if (secId === 'sec-proveedores') loadProviders();
    if (secId === 'sec-clientes') loadClients();
    if (secId === 'sec-escandallos') {
        loadIngredientsCache().then(loadEscandalloTable);
    }
    if (secId === 'sec-gastos') {
        loadCategories();
        loadProvidersDropdown();
        loadExpensesHistory();
        setDefaultDateTime('exp-date');
    }
    if (secId === 'sec-ingresos') {
        loadProductsDropdown('prodrun-product');
        loadProductionHistory();
        setDefaultDateTime('prodrun-date');
    }
    if (secId === 'sec-ventas') {
        loadProducts();
        loadClientsDropdown();
        loadStock();
        setDefaultDateTime('sale-date');
    }
}

// Auth
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass})
    });
    if (res.ok) {
        currentUser = await res.json();
        setupDashboard();
        switchView('dashboard-view');
    } else {
        document.getElementById('login-error').textContent = "ERROR DE ACCESO";
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    switchView('login-view');
});

function setupDashboard() {
    document.getElementById('user-display').textContent = `${currentUser.username.toUpperCase()} (${currentUser.role.toUpperCase()})`;
    const nav = document.getElementById('nav-links');
    nav.innerHTML = '';
    
    if (currentUser.role === 'Admin') {
        addNavLink('donut_small', 'PERFORMANCE', 'sec-performance', true);
        addNavLink('local_shipping', 'PROVEEDORES', 'sec-proveedores');
        addNavLink('person', 'CLIENTES', 'sec-clientes');
        addNavLink('inventory_2', 'PRODUCTOS', 'sec-escandallos');
        addNavLink('conveyor_belt', 'INGRESOS', 'sec-ingresos');
        addNavLink('receipt_long', 'GASTOS', 'sec-gastos');
        switchSection('sec-performance', 'PERFORMANCE');
    } else {
        addNavLink('point_of_sale', 'VENTAS Y STOCK', 'sec-ventas', true);
        switchSection('sec-ventas', 'VENTAS Y STOCK');
    }
}

function addNavLink(icon, text, secId, isActive = false) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.innerHTML = `<span class="material-symbols-outlined">${icon}</span> ${text}`;
    if (isActive) a.classList.add('active');
    a.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('#nav-links a').forEach(link => link.classList.remove('active'));
        a.classList.add('active');
        switchSection(secId, text);
    });
    li.appendChild(a);
    document.getElementById('nav-links').appendChild(li);
}

// --- PRODUCTOS ---
async function loadIngredientsCache() {
    const res = await fetch(`${API_URL}/ingredients`);
    allIngredients = await res.json();
    const dl = document.getElementById('ingredients-list');
    if (dl) dl.innerHTML = allIngredients.map(i => `<option value="${i.name}">`).join('');
}

async function loadEscandalloTable() {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    const tbody = document.getElementById('escandallo-tbody');
    tbody.innerHTML = '';

    for (const prod of products) {
        const resRec = await fetch(`${API_URL}/recipes/${prod.id}`);
        const ingredients = await resRec.json();
        
        let ingredientsHtml = '';
        if (ingredients.length > 0) {
            ingredientsHtml = ingredients.map(ing => {
                const totalCost = ing.quantity * ing.cost;
                return `
                    <tr class="ingredient-row row-prod-${prod.id}">
                        <td></td>
                        <td style="padding-left: 30px; color: var(--text-muted);"><span class="material-symbols-outlined" style="font-size:1rem; vertical-align:middle;">subdirectory_arrow_right</span> ${ing.name}</td>
                        <td colspan="2" class="text-muted">Cant: ${ing.quantity}</td>
                        <td colspan="2" class="text-muted">$${totalCost.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');
        }

        tbody.innerHTML += `
            <tr class="group-header">
                <td style="text-align: center;">
                    ${ingredients.length > 0 ? `<span class="material-symbols-outlined toggle-btn" onclick="toggleIngredients(${prod.id}, this)">expand_more</span>` : ''}
                </td>
                <td><strong>${prod.name}</strong></td>
                <td>${prod.yield || 1}</td>
                <td>$${prod.price.toFixed(2)}</td>
                <td><strong style="color: var(--primary);">$${prod.gpu.toFixed(2)}</strong></td>
                <td style="white-space: nowrap;">
                    <button class="btn secondary outline btn-icon" onclick="editProduct(${prod.id}, '${prod.name}', ${prod.price}, ${prod.yield || 1})" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                    <button class="btn secondary outline btn-icon" onclick="deleteProduct(${prod.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button>
                </td>
            </tr>
            ${ingredientsHtml}
        `;
    }
}

function toggleIngredients(prodId, iconEl) {
    const rows = document.querySelectorAll(`.row-prod-${prodId}`);
    let isHidden = true;
    rows.forEach(row => {
        if (row.classList.contains('show')) {
            row.classList.remove('show');
            isHidden = true;
        } else {
            row.classList.add('show');
            isHidden = false;
        }
    });
    iconEl.textContent = isHidden ? 'expand_more' : 'expand_less';
}

const escItemsContainer = document.getElementById('esc-items-container');
function addEscRow(name = '', qty = '') {
    const row = document.createElement('div');
    row.className = 'esc-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 10px;';
    const ing = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
    const cost = ing ? (ing.cost * (parseFloat(qty) || 0)).toFixed(2) : '0.00';
    row.innerHTML = `
        <input type="text" class="esc-item-name" placeholder="Insumo" required list="ingredients-list" value="${name}">
        <input type="number" step="0.01" class="esc-item-qty" placeholder="Cant." required value="${qty}">
        <input type="text" class="esc-item-cost" readonly disabled style="background: rgba(0,0,0,0.2);" value="${cost}">
        <button type="button" class="btn secondary outline remove-esc-item btn-icon"><span class="material-symbols-outlined">close</span></button>`;
    escItemsContainer.appendChild(row);
}

document.getElementById('esc-add-item-btn').addEventListener('click', () => addEscRow());

escItemsContainer.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-esc-item');
    if (removeBtn) {
        removeBtn.closest('.esc-row').remove();
        updateEscTotals();
    }
});

escItemsContainer.addEventListener('input', (e) => {
    if (e.target.classList.contains('esc-item-name') || e.target.classList.contains('esc-item-qty')) {
        const row = e.target.closest('.esc-row');
        const name = row.querySelector('.esc-item-name').value;
        const qty = parseFloat(row.querySelector('.esc-item-qty').value) || 0;
        const ing = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
        row.querySelector('.esc-item-cost').value = (qty * (ing ? ing.cost : 0)).toFixed(2);
        updateEscTotals();
    }
});

function updateEscTotals() {
    let totalBatch = 0;
    document.querySelectorAll('.esc-item-cost').forEach(el => totalBatch += parseFloat(el.value) || 0);
    const yld = parseFloat(document.getElementById('esc-yield').value) || 1;
    document.getElementById('esc-total-batch-cost').textContent = `$${totalBatch.toFixed(2)}`;
    document.getElementById('esc-gpu-display').textContent = `$${(totalBatch / yld).toFixed(2)}`;
}
document.getElementById('esc-yield').addEventListener('input', updateEscTotals);

let editingProductId = null;
function editProduct(id, name, price, yld) {
    editingProductId = id;
    document.getElementById('esc-sabor').value = name;
    document.getElementById('esc-sale-price').value = price;
    document.getElementById('esc-yield').value = yld;
    escItemsContainer.innerHTML = '';
    
    document.getElementById('cancel-edit-product-btn').style.display = 'inline-flex';
    
    fetch(`${API_URL}/recipes/${id}`).then(res => res.json()).then(items => {
        items.forEach(item => addEscRow(item.name, item.quantity));
        if (items.length === 0) addEscRow();
        updateEscTotals();
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('cancel-edit-product-btn').addEventListener('click', () => {
    editingProductId = null;
    document.getElementById('escandallo-form').reset();
    escItemsContainer.innerHTML = '';
    addEscRow();
    updateEscTotals();
    document.getElementById('cancel-edit-product-btn').style.display = 'none';
});

document.getElementById('escandallo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sabor = document.getElementById('esc-sabor').value.trim();
    const price = parseFloat(document.getElementById('esc-sale-price').value);
    const yld = parseFloat(document.getElementById('esc-yield').value);
    
    let productId = editingProductId;
    if (!productId) {
        await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ flavor_name: sabor.toUpperCase(), sale_price: price, yield_per_batch: yld })
        });
        const products = await (await fetch(`${API_URL}/products`)).json();
        productId = products.find(p => p.name.toLowerCase() === sabor.toLowerCase())?.id;
    } else {
        await fetch(`${API_URL}/products/${productId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ flavor_name: sabor.toUpperCase(), sale_price: price, yield_per_batch: yld })
        });
    }

    const items = [];
    for (const row of document.querySelectorAll('.esc-row')) {
        const name = row.querySelector('.esc-item-name').value.trim();
        const qty = parseFloat(row.querySelector('.esc-item-qty').value);
        if (!name || isNaN(qty)) continue;
        let ing = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (!ing) {
            await fetch(`${API_URL}/ingredients`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name: name.toUpperCase() })
            });
            await loadIngredientsCache();
            ing = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
        }
        if (ing) items.push({ ingredient_id: ing.id, quantity: qty });
    }

    const res = await fetch(`${API_URL}/recipes`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ product_id: productId, yield_per_batch: yld, items: items })
    });

    if (res.ok) {
        e.target.reset();
        escItemsContainer.innerHTML = '';
        addEscRow();
        editingProductId = null;
        document.getElementById('cancel-edit-product-btn').style.display = 'none';
        loadEscandalloTable();
        const msg = document.getElementById('esc-msg');
        msg.textContent = "PRODUCTO GUARDADO EXITOSAMENTE";
        msg.className = "success-msg";
        setTimeout(() => msg.textContent = '', 3000);
    }
});

async function deleteProduct(id) {
    if (confirm('¿ELIMINAR ESTE PRODUCTO? ESTO BORRARÁ SU RECETA Y STOCK.')) {
        const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            alert(data.detail || "Error al eliminar el producto.");
        } else {
            loadEscandalloTable();
            if (editingProductId === id) {
                document.getElementById('cancel-edit-product-btn').click();
            }
        }
    }
}

// --- PROVEEDORES ---
async function loadProvidersDropdown() {
    const res = await fetch(`${API_URL}/providers`);
    allProviders = await res.json();
    document.getElementById('exp-prov').innerHTML = '<option value="">PROVEEDOR...</option>' + allProviders.map(p => `<option value="${p.name}">${p.name.toUpperCase()}</option>`).join('');
}

document.getElementById('provider-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('prov-name').value.toUpperCase(),
        category_name: document.getElementById('prov-cat').value,
        phone: null, location: null, delivery_time: null, observations: null
    };
    try {
        const res = await fetch(`${API_URL}/providers`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const msg = document.getElementById('prov-msg');
        if (res.ok) {
            msg.className = 'success-msg';
            msg.textContent = 'PROVEEDOR GUARDADO';
            e.target.reset();
            loadProviders();
            setTimeout(() => msg.textContent = '', 3000);
        } else {
            msg.className = 'error-msg';
            msg.textContent = 'ERROR AL GUARDAR';
        }
    } catch (err) {}
});


// --- GASTOS ---
document.getElementById('exp-prov')?.addEventListener('change', (e) => {
    const p = allProviders.find(prov => prov.name === e.target.value);
    document.getElementById('exp-cat').value = p ? p.category : '';
});

const expenseItemsContainer = document.getElementById('expense-items-container');
function addExpenseRow(desc = '', qty = '', unit = '') {
    const row = document.createElement('div');
    row.className = 'expense-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 40px; gap: 10px; margin-bottom: 10px;';
    const sub = (parseFloat(qty) * parseFloat(unit)) || 0;
    row.innerHTML = `
        <input type="text" class="exp-item-desc" placeholder="Producto/Insumo" required list="ingredients-list" value="${desc}">
        <input type="number" step="0.01" class="exp-item-qty" placeholder="Cant." required value="${qty}">
        <input type="number" step="0.01" class="exp-item-unit" placeholder="$ Unit." required value="${unit}">
        <input type="text" class="exp-item-subtotal" readonly disabled style="background: rgba(0,0,0,0.2);" value="${sub > 0 ? sub.toFixed(2) : ''}">
        <button type="button" class="btn secondary outline remove-item-btn btn-icon"><span class="material-symbols-outlined">close</span></button>`;
    expenseItemsContainer.appendChild(row);
}

document.getElementById('add-item-btn').addEventListener('click', () => addExpenseRow());

expenseItemsContainer.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-item-btn');
    if (removeBtn) {
        removeBtn.closest('.expense-row').remove();
        calculateExpenseTotal();
    }
});

expenseItemsContainer.addEventListener('input', () => {
    calculateExpenseTotal();
});

function calculateExpenseTotal() {
    let total = 0;
    document.querySelectorAll('.expense-row').forEach(row => {
        const q = parseFloat(row.querySelector('.exp-item-qty').value) || 0;
        const u = parseFloat(row.querySelector('.exp-item-unit').value) || 0;
        const sub = q * u;
        row.querySelector('.exp-item-subtotal').value = sub.toFixed(2);
        total += sub;
    });
    document.getElementById('exp-total-display').textContent = total.toFixed(2);
}

let editingExpenseId = null;

document.getElementById('cancel-edit-expense-btn').addEventListener('click', () => {
    editingExpenseId = null;
    document.getElementById('expense-form').reset();
    expenseItemsContainer.innerHTML = '';
    addExpenseRow();
    calculateExpenseTotal();
    setDefaultDateTime('exp-date');
    document.getElementById('cancel-edit-expense-btn').style.display = 'none';
});

document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('.expense-row').forEach(row => {
        const desc = row.querySelector('.exp-item-desc').value.trim().toUpperCase();
        if(!desc) return;
        items.push({
            description: desc,
            quantity: parseFloat(row.querySelector('.exp-item-qty').value),
            unit_price: parseFloat(row.querySelector('.exp-item-unit').value)
        });
    });
    
    const payload = {
        provider: document.getElementById('exp-prov').value,
        category_name: document.getElementById('exp-cat').value,
        date: document.getElementById('exp-date').value,
        items: items
    };

    let url = `${API_URL}/expenses`;
    let method = 'POST';

    if (editingExpenseId) {
        url = `${API_URL}/expenses/${editingExpenseId}`;
        method = 'PUT';
    }

    const res = await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        e.target.reset();
        expenseItemsContainer.innerHTML = '';
        addExpenseRow();
        document.getElementById('exp-total-display').textContent = '0.00';
        loadExpensesHistory();
        loadMetrics();
        setDefaultDateTime('exp-date');
        
        if (editingExpenseId) {
            document.getElementById('cancel-edit-expense-btn').click();
        }
        
        const msg = document.getElementById('exp-msg');
        msg.textContent = "GASTO GUARDADO EXITOSAMENTE";
        msg.className = "success-msg";
        setTimeout(() => msg.textContent = '', 3000);
    }
});

async function loadExpensesHistory() {
    const res = await fetch(`${API_URL}/expenses`);
    const data = await res.json();
    document.getElementById('expenses-history-tbody').innerHTML = data.map(e => `
        <tr>
            <td>${e.date}</td>
            <td>${e.provider.toUpperCase()}</td>
            <td>${e.category}</td>
            <td><strong style="color: var(--primary);">$${e.amount.toFixed(2)}</strong></td>
            <td style="white-space: nowrap;">
                <button class="btn secondary outline btn-icon" onclick="viewExpenseDetail(${e.id})" title="Ver Detalles"><span class="material-symbols-outlined">visibility</span></button>
                <button class="btn secondary outline btn-icon" onclick="editExpense(${e.id})" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                <button class="btn secondary outline btn-icon" onclick="deleteExpense(${e.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button>
            </td>
        </tr>`).join('');
}

async function viewExpenseDetail(id) {
    try {
        const res = await fetch(`${API_URL}/expenses/${id}/items`);
        const items = await res.json();
        const body = document.getElementById('modal-body');
        body.innerHTML = `
            <table class="data-table">
                <thead><tr><th>ITEM</th><th>CANT.</th><th>PRECIO</th><th>TOTAL</th></tr></thead>
                <tbody>${items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>$${i.unit_price}</td><td>$${i.total_price.toFixed(2)}</td></tr>`).join('')}</tbody>
            </table>`;
        document.getElementById('detail-modal').style.display = 'block';
    } catch (err) {
        alert("Error al cargar detalles del gasto.");
    }
}

async function editExpense(id) {
    try {
        const resExp = await fetch(`${API_URL}/expenses`);
        const allExp = await resExp.json();
        const exp = allExp.find(e => e.id === id);
        
        if(!exp) return;
        
        editingExpenseId = id;
        document.getElementById('exp-prov').value = exp.provider;
        document.getElementById('exp-cat').value = exp.category;
        
        // Format date to local datetime-local
        let dateVal = exp.date;
        if(dateVal.length === 16) {
            dateVal = dateVal.replace(' ', 'T');
        }
        document.getElementById('exp-date').value = dateVal;
        
        document.getElementById('cancel-edit-expense-btn').style.display = 'inline-flex';
        expenseItemsContainer.innerHTML = '';
        
        const resItems = await fetch(`${API_URL}/expenses/${id}/items`);
        const items = await resItems.json();
        
        items.forEach(i => addExpenseRow(i.description, i.quantity, i.unit_price));
        calculateExpenseTotal();
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        alert("Error al cargar el gasto para edición.");
    }
}

async function deleteExpense(id) {
    if (confirm('¿ELIMINAR ESTE GASTO? ESTO NO SE PUEDE DESHACER.')) {
        await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE' });
        loadExpensesHistory();
        loadMetrics();
        if (editingExpenseId === id) {
            document.getElementById('cancel-edit-expense-btn').click();
        }
    }
}

// Helpers
async function loadMetrics() {
    const res = await fetch(`${API_URL}/metrics`);
    const data = await res.json();
    document.getElementById('metric-ingresos').textContent = `$${data.ingresos.toFixed(2)}`;
    document.getElementById('metric-gtr').textContent = `$${data.gtr.toFixed(2)}`;
    document.getElementById('metric-egresos').textContent = `$${data.egresos_operativos.toFixed(2)}`;
    document.getElementById('metric-rentabilidad').textContent = `${data.rentabilidad_real.toFixed(2)}%`;
    const bars = document.getElementById('expenses-bars');
    bars.innerHTML = '';
    const max = Math.max(...Object.values(data.egresos_detallados), 1);
    for (const [cat, val] of Object.entries(data.egresos_detallados)) {
        bars.innerHTML += `<div class="bar-row"><div class="bar-label">${cat}</div><div style="flex:1"><div class="bar-fill" style="width:${(val/max)*100}%"></div></div><div class="bar-value">$${val.toFixed(2)}</div></div>`;
    }
}

async function loadCategories() {
    const res = await fetch(`${API_URL}/categories`);
    const data = await res.json();
    ['exp-cat', 'prov-cat'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">CATEGORÍA...</option>' + data.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    });
}

async function loadProviders() {
    const res = await fetch(`${API_URL}/providers`);
    allProviders = await res.json();
    document.getElementById('providers-tbody').innerHTML = allProviders.map(p => `<tr><td>${p.name.toUpperCase()}</td><td>${p.category}</td><td style="white-space: nowrap;"><button class="btn secondary outline btn-icon" onclick="deleteProvider(${p.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button></td></tr>`).join('');
}

async function deleteProvider(id) {
    if (confirm('¿ELIMINAR ESTE PROVEEDOR?')) {
        await fetch(`${API_URL}/providers/${id}`, { method: 'DELETE' });
        loadProviders();
    }
}

// --- CLIENTES ---
let allClients = [];
let editingClientId = null;

async function loadClients() {
    const res = await fetch(`${API_URL}/clients`);
    allClients = await res.json();
    document.getElementById('clients-tbody').innerHTML = allClients.map(c => `
        <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone || '<span style="color:var(--text-muted)">Sin teléfono</span>'}</td>
            <td style="white-space: nowrap;">
                <button class="btn secondary outline btn-icon" onclick="editClient(${c.id}, '${c.name}', '${c.phone}')" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                <button class="btn secondary outline btn-icon" onclick="deleteClient(${c.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button>
            </td>
        </tr>`).join('');
}

document.getElementById('client-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('client-name').value.trim(),
        phone: document.getElementById('client-phone').value.trim() || null
    };
    let url = `${API_URL}/clients`;
    let method = 'POST';
    if (editingClientId) {
        url = `${API_URL}/clients/${editingClientId}`;
        method = 'PUT';
    }
    try {
        const res = await fetch(url, {
            method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const msg = document.getElementById('client-msg');
        if (res.ok) {
            msg.className = 'success-msg';
            msg.textContent = 'CLIENTE GUARDADO';
            e.target.reset();
            editingClientId = null;
            document.getElementById('cancel-edit-client-btn').style.display = 'none';
            loadClients();
            setTimeout(() => msg.textContent = '', 3000);
        } else {
            msg.className = 'error-msg';
            msg.textContent = 'ERROR AL GUARDAR';
        }
    } catch(err) {}
});

document.getElementById('cancel-edit-client-btn')?.addEventListener('click', () => {
    editingClientId = null;
    document.getElementById('client-form').reset();
    document.getElementById('cancel-edit-client-btn').style.display = 'none';
});

function editClient(id, name, phone) {
    editingClientId = id;
    document.getElementById('client-name').value = name;
    document.getElementById('client-phone').value = phone || '';
    document.getElementById('cancel-edit-client-btn').style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteClient(id) {
    if (confirm('¿ELIMINAR ESTE CLIENTE?')) {
        await fetch(`${API_URL}/clients/${id}`, { method: 'DELETE' });
        loadClients();
    }
}

async function loadProducts() {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    const el = document.getElementById('sale-product');
    if (el) el.innerHTML = data.map(p => `<option value="${p.id}">${p.name.toUpperCase()} ($${p.price})</option>`).join('');
}

async function loadProductsDropdown(selectId) {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    const el = document.getElementById(selectId);
    if (el) el.innerHTML = data.map(p => `<option value="${p.id}">${p.name.toUpperCase()}</option>`).join('');
}

// --- PRODUCCIÓN (INGRESOS) ---
let editingProdRunId = null;

async function loadProductionHistory() {
    const res = await fetch(`${API_URL}/production`);
    const data = await res.json();
    document.getElementById('prodrun-tbody').innerHTML = data.map(pr => `
        <tr>
            <td>${pr.date.replace('T', ' ')}</td>
            <td><strong>${pr.product_name}</strong></td>
            <td>${pr.quantity}</td>
            <td style="white-space: nowrap;">
                <button class="btn secondary outline btn-icon" onclick="editProduction(${pr.id})" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                <button class="btn secondary outline btn-icon" onclick="deleteProduction(${pr.id})" title="Eliminar"><span class="material-symbols-outlined">delete</span></button>
            </td>
        </tr>`).join('');
}

document.getElementById('cancel-edit-prodrun-btn').addEventListener('click', () => {
    editingProdRunId = null;
    document.getElementById('prodrun-form').reset();
    setDefaultDateTime('prodrun-date');
    document.getElementById('cancel-edit-prodrun-btn').style.display = 'none';
});

document.getElementById('prodrun-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        product_id: parseInt(document.getElementById('prodrun-product').value),
        quantity: parseInt(document.getElementById('prodrun-qty').value),
        date: document.getElementById('prodrun-date').value
    };

    let url = `${API_URL}/production`;
    let method = 'POST';
    if (editingProdRunId) {
        url = `${API_URL}/production/${editingProdRunId}`;
        method = 'PUT';
    }

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const msg = document.getElementById('prodrun-msg');
        if (res.ok) {
            e.target.reset();
            setDefaultDateTime('prodrun-date');
            loadProductionHistory();
            if (editingProdRunId) {
                document.getElementById('cancel-edit-prodrun-btn').click();
            }
            msg.textContent = "INGRESO GUARDADO EXITOSAMENTE";
            msg.className = "success-msg";
            setTimeout(() => msg.textContent = '', 3000);
        } else {
            const err = await res.json();
            msg.textContent = err.detail || "ERROR AL GUARDAR";
            msg.className = "error-msg";
        }
    } catch (err) {}
});

async function editProduction(id) {
    try {
        const res = await fetch(`${API_URL}/production`);
        const allPr = await res.json();
        const pr = allPr.find(p => p.id === id);
        if(!pr) return;
        
        editingProdRunId = id;
        document.getElementById('prodrun-product').value = pr.product_id;
        document.getElementById('prodrun-qty').value = pr.quantity;
        document.getElementById('prodrun-date').value = pr.date;
        
        document.getElementById('cancel-edit-prodrun-btn').style.display = 'inline-flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(err) {}
}

async function deleteProduction(id) {
    if (confirm('¿ELIMINAR ESTE INGRESO? ESTO RESTARÁ UNIDADES DEL STOCK.')) {
        await fetch(`${API_URL}/production/${id}`, { method: 'DELETE' });
        loadProductionHistory();
    }
}

async function loadStock() {}

async function loadClientsDropdown() {
    const res = await fetch(`${API_URL}/clients`);
    const data = await res.json();
    const el = document.getElementById('sale-client');
    if (el) el.innerHTML = '<option value="">SELECIONAR CLIENTE...</option>' + data.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

document.getElementById('sale-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            client_name: document.getElementById('sale-client').value,
            items: [{ product_id: parseInt(document.getElementById('sale-product').value), quantity: parseInt(document.getElementById('sale-qty').value) }],
            date: document.getElementById('sale-date').value
        })
    });
    e.target.reset();
    setDefaultDateTime('sale-date');
});
