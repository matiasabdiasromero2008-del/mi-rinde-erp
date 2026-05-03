const API_URL = ''; // Since we serve from same origin
let currentUser = null;
let allProviders = [];
let allIngredients = []; // Cache for costs

// DOM Elements
const views = document.querySelectorAll('.view');
const sections = document.querySelectorAll('.section');
const navLinks = document.getElementById('nav-links');
const userDisplay = document.getElementById('user-display');
const viewTitle = document.getElementById('view-title');

// Auth
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        
        if (res.ok) {
            const data = await res.json();
            currentUser = data;
            setupDashboard();
            switchView('dashboard-view');
        } else {
            errorMsg.textContent = "Credenciales incorrectas";
        }
    } catch (err) {
        errorMsg.textContent = "Error de conexión al servidor";
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    switchView('login-view');
});

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function switchSection(secId, title) {
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById(secId).classList.add('active');
    viewTitle.textContent = title;
    
    if (secId === 'sec-performance') loadMetrics();
    if (secId === 'sec-proveedores') loadProviders();
    if (secId === 'sec-escandallos') {
        loadIngredientsCache().then(loadEscandalloTable);
    }
    if (secId === 'sec-gastos') {
        loadCategories();
        loadProvidersDropdown();
    }
    if (secId === 'sec-ventas') {
        loadProducts();
        loadStock();
    }
}

function setupDashboard() {
    userDisplay.textContent = `${currentUser.username} (${currentUser.role})`;
    navLinks.innerHTML = '';
    
    if (currentUser.role === 'Admin') {
        addNavLink('Performance', 'sec-performance', true);
        addNavLink('Proveedores', 'sec-proveedores');
        addNavLink('Escandallos', 'sec-escandallos');
        addNavLink('Carga de Gastos', 'sec-gastos');
        switchSection('sec-performance', 'Performance');
        loadCategories();
    } else {
        addNavLink('Ventas y Stock', 'sec-ventas', true);
        switchSection('sec-ventas', 'Ventas y Stock');
    }
}

function addNavLink(text, secId, isActive = false) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = text;
    if (isActive) a.classList.add('active');
    
    a.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('#nav-links a').forEach(link => link.classList.remove('active'));
        a.classList.add('active');
        switchSection(secId, text);
    });
    
    li.appendChild(a);
    navLinks.appendChild(li);
}

// Data Fetching
async function loadMetrics() {
    try {
        const res = await fetch(`${API_URL}/metrics`);
        const data = await res.json();
        document.getElementById('metric-ingresos').textContent = `$${data.ingresos.toFixed(2)}`;
        document.getElementById('metric-gtr').textContent = `$${data.gtr.toFixed(2)}`;
        document.getElementById('metric-egresos').textContent = `$${data.egresos_operativos.toFixed(2)}`;
        document.getElementById('metric-rentabilidad').textContent = `${data.rentabilidad_real.toFixed(2)}%`;
        
        const barsContainer = document.getElementById('expenses-bars');
        barsContainer.innerHTML = '';
        const vals = Object.values(data.egresos_detallados).map(v => Number(v));
        const maxVal = vals.length > 0 ? Math.max(...vals, 1) : 1;
        for (const [cat, val] of Object.entries(data.egresos_detallados)) {
            const row = document.createElement('div');
            row.className = 'bar-row';
            const pct = (val / maxVal) * 100;
            row.innerHTML = `<div class="bar-label">${cat}</div><div style="flex:1"><div class="bar-fill" style="width: ${pct}%"></div></div><div class="bar-value">$${val.toFixed(2)}</div>`;
            barsContainer.appendChild(row);
        }
    } catch (err) {}
}

async function loadCategories() {
    try {
        const res = await fetch(`${API_URL}/categories`);
        const data = await res.json();
        ['exp-cat', 'prov-cat'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<option value="">Seleccione...</option>' + data.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        });
    } catch (err) {}
}

async function loadProviders() {
    try {
        const res = await fetch(`${API_URL}/providers`);
        allProviders = await res.json();
        const tbody = document.getElementById('providers-tbody');
        tbody.innerHTML = allProviders.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${p.phone || '-'}</td>
                <td>${p.location || '-'}</td>
                <td>${p.delivery_time || '-'}</td>
                <td>${p.observations || '-'}</td>
                <td><button class="btn secondary outline" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteProvider(${p.id})">Eliminar</button></td>
            </tr>
        `).join('');
    } catch (err) {}
}

// Escandallo Logic
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
        
        if (ingredients.length === 0) {
            tbody.innerHTML += `
                <tr class="group-header">
                    <td><strong>${prod.name}</strong></td>
                    <td colspan="5" class="text-muted italic">Sin ingredientes cargados</td>
                    <td>$${prod.gpu.toFixed(2)}</td>
                    <td><button class="btn secondary outline" onclick="editEscandallo(${prod.id}, '${prod.name}', ${prod.price}, ${prod.yield})">Editar</button></td>
                </tr>
            `;
            continue;
        }

        ingredients.forEach((ing, index) => {
            const totalCost = ing.quantity * ing.cost;
            tbody.innerHTML += `
                <tr class="${index === 0 ? 'group-header' : ''}">
                    <td>${index === 0 ? `<strong>${prod.name}</strong>` : ''}</td>
                    <td>${ing.name}</td>
                    <td>${ing.quantity}</td>
                    <td>${index === 0 ? prod.yield : ''}</td>
                    <td>$${ing.cost.toFixed(2)}</td>
                    <td>$${totalCost.toFixed(2)}</td>
                    <td>${index === 0 ? `<strong>$${prod.gpu.toFixed(2)}</strong>` : ''}</td>
                    <td>${index === 0 ? `<button class="btn secondary outline" style="padding:2px 8px;" onclick="editEscandallo(${prod.id}, '${prod.name}', ${prod.price}, ${prod.yield})">Editar</button>` : ''}</td>
                </tr>
            `;
        });
    }
}

// Dynamic Row Management for Escandallo Form
const escItemsContainer = document.getElementById('esc-items-container');

function addEscRow(name = '', qty = '') {
    const row = document.createElement('div');
    row.className = 'esc-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 10px;';
    
    // Find cost if name exists
    const ing = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
    const cost = ing ? (ing.cost * (parseFloat(qty) || 0)).toFixed(2) : '0.00';

    row.innerHTML = `
        <input type="text" class="esc-item-name" placeholder="Ej: Azúcar" required list="ingredients-list" value="${name}">
        <input type="number" step="0.01" class="esc-item-qty" placeholder="Cant." required value="${qty}">
        <input type="text" class="esc-item-cost" readonly disabled placeholder="Auto $" style="background: rgba(0,0,0,0.2);" value="${cost}">
        <button type="button" class="btn secondary outline remove-esc-item" style="padding:0; height:38px;">&times;</button>
    `;
    escItemsContainer.appendChild(row);
    updateEscTotals();
}

document.getElementById('esc-add-item-btn').addEventListener('click', () => addEscRow());

escItemsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-esc-item')) {
        e.target.closest('.esc-row').remove();
        updateEscTotals();
    }
});

escItemsContainer.addEventListener('input', (e) => {
    if (e.target.classList.contains('esc-item-name') || e.target.classList.contains('esc-item-qty')) {
        const row = e.target.closest('.esc-row');
        const name = row.querySelector('.esc-item-name').value;
        const qty = parseFloat(row.querySelector('.esc-item-qty').value) || 0;
        
        const ing = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
        const costPerUnit = ing ? ing.cost : 0;
        const total = (qty * costPerUnit).toFixed(2);
        
        row.querySelector('.esc-item-cost').value = total;
        updateEscTotals();
    }
});

document.getElementById('esc-yield').addEventListener('input', updateEscTotals);

function updateEscTotals() {
    let totalBatch = 0;
    document.querySelectorAll('.esc-item-cost').forEach(el => {
        totalBatch += parseFloat(el.value) || 0;
    });
    
    const yld = parseFloat(document.getElementById('esc-yield').value) || 1;
    const gpu = totalBatch / yld;
    
    document.getElementById('esc-total-batch-cost').textContent = `$${totalBatch.toFixed(2)}`;
    document.getElementById('esc-gpu-display').textContent = `$${gpu.toFixed(2)}`;
}

let editingProductId = null;

function editEscandallo(id, name, price, yld) {
    editingProductId = id;
    document.getElementById('esc-sabor').value = name;
    document.getElementById('esc-sale-price').value = price;
    document.getElementById('esc-yield').value = yld;
    
    escItemsContainer.innerHTML = '';
    fetch(`${API_URL}/recipes/${id}`)
        .then(res => res.json())
        .then(items => {
            items.forEach(item => addEscRow(item.name, item.quantity));
            if (items.length === 0) addEscRow();
        });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('escandallo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const sabor = document.getElementById('esc-sabor').value;
    const price = parseFloat(document.getElementById('esc-sale-price').value);
    const yld = parseFloat(document.getElementById('esc-yield').value);
    
    // 1. Ensure Product exists or update it
    let productId = editingProductId;
    if (!productId) {
        // Simple search in cached products or just try to create
        const resP = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ flavor_name: sabor, sale_price: price, yield_per_batch: yld })
        });
        // We'll need to get the ID back. For simplicity, let's refresh products list
        const products = await (await fetch(`${API_URL}/products`)).json();
        productId = products.find(p => p.name === sabor)?.id;
    } else {
        // Update product yield and price (we need a PUT endpoint ideally, but let's re-save recipe)
    }

    // 2. Save Recipe
    const items = [];
    for (const row of document.querySelectorAll('.esc-row')) {
        const name = row.querySelector('.esc-item-name').value;
        const qty = parseFloat(row.querySelector('.esc-item-qty').value);
        
        // Ensure ingredient exists in DB to get an ID
        let ing = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (!ing) {
            await fetch(`${API_URL}/ingredients`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name: name })
            });
            await loadIngredientsCache();
            ing = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
        }
        
        if (ing && qty) {
            items.push({ ingredient_id: ing.id, quantity: qty });
        }
    }

    const res = await fetch(`${API_URL}/recipes`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            product_id: productId,
            yield_per_batch: yld,
            items: items
        })
    });

    if (res.ok) {
        document.getElementById('esc-msg').textContent = 'Escandallo guardado correctamente';
        document.getElementById('esc-msg').className = 'success-msg';
        e.target.reset();
        escItemsContainer.innerHTML = '';
        addEscRow();
        editingProductId = null;
        loadEscandalloTable();
    }
});

// Providers
async function loadProvidersDropdown() {
    const res = await fetch(`${API_URL}/providers`);
    allProviders = await res.json();
    const select = document.getElementById('exp-prov');
    select.innerHTML = '<option value="">Seleccione un proveedor</option>' + allProviders.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
}

async function deleteProvider(id) {
    if (confirm('¿Eliminar este proveedor?')) {
        await fetch(`${API_URL}/providers/${id}`, { method: 'DELETE' });
        loadProviders();
    }
}

document.getElementById('provider-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('prov-name').value,
        category_name: document.getElementById('prov-cat').value,
        phone: document.getElementById('prov-phone').value,
        location: document.getElementById('prov-location').value,
        delivery_time: document.getElementById('prov-delivery').value,
        observations: document.getElementById('prov-obs').value
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
            msg.textContent = 'Proveedor guardado correctamente';
            e.target.reset();
            loadProviders();
        } else {
            msg.className = 'error-msg';
            msg.textContent = 'Error al guardar el proveedor';
        }
    } catch (err) {}
});

// Expenses
const expenseItemsContainer = document.getElementById('expense-items-container');
const expTotalDisplay = document.getElementById('exp-total-display');

function calculateExpenseTotal() {
    let total = 0;
    document.querySelectorAll('.exp-item-subtotal').forEach(el => {
        total += parseFloat(el.value) || 0;
    });
    if (expTotalDisplay) expTotalDisplay.textContent = total.toFixed(2);
}

expenseItemsContainer?.addEventListener('input', (e) => {
    if (e.target.classList.contains('exp-item-qty') || e.target.classList.contains('exp-item-unit')) {
        const row = e.target.closest('.expense-row');
        const qty = parseFloat(row.querySelector('.exp-item-qty').value) || 0;
        const unit = parseFloat(row.querySelector('.exp-item-unit').value) || 0;
        const subtotalEl = row.querySelector('.exp-item-subtotal');
        const subtotal = qty * unit;
        subtotalEl.value = subtotal > 0 ? subtotal.toFixed(2) : '';
        calculateExpenseTotal();
    }
});

document.getElementById('add-item-btn')?.addEventListener('click', () => {
    const newRow = document.createElement('div');
    newRow.className = 'expense-row';
    newRow.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 40px; gap: 10px; margin-bottom: 10px;';
    newRow.innerHTML = `
        <input type="text" class="exp-item-desc" placeholder="Producto / Descripción" required>
        <input type="number" step="0.01" class="exp-item-qty" placeholder="Cantidad" required>
        <input type="number" step="0.01" class="exp-item-unit" placeholder="Precio Unit. ($U)" required>
        <input type="text" class="exp-item-subtotal" readonly disabled placeholder="$" style="background: rgba(0,0,0,0.2);">
        <button type="button" class="btn secondary outline remove-item-btn" style="padding:0; height:38px;">&times;</button>
    `;
    expenseItemsContainer.appendChild(newRow);
});

expenseItemsContainer?.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item-btn')) {
        e.target.closest('.expense-row').remove();
        calculateExpenseTotal();
    }
});

document.getElementById('expense-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('.expense-row').forEach(row => {
        const desc = row.querySelector('.exp-item-desc').value.trim();
        const qty = parseFloat(row.querySelector('.exp-item-qty').value);
        const unit = parseFloat(row.querySelector('.exp-item-unit').value);
        if (desc && !isNaN(qty) && !isNaN(unit)) {
            items.push({ description: desc, quantity: qty, unit_price: unit });
        }
    });
    const payload = {
        provider: document.getElementById('exp-prov').value,
        category_name: document.getElementById('exp-cat').value,
        date: document.getElementById('exp-date').value || null,
        items: items
    };
    const res = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    if (res.ok) {
        e.target.reset();
        if (expTotalDisplay) expTotalDisplay.textContent = '0.00';
        loadMetrics();
    }
});

// Sales & Stock
async function loadProducts() {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    const select = document.getElementById('sale-product');
    if (select) select.innerHTML = data.map(p => `<option value="${p.id}">${p.name} ($${p.price})</option>`).join('');
}

async function loadStock() {
    const res = await fetch(`${API_URL}/stock`);
    const data = await res.json();
    const tbody = document.getElementById('stock-tbody');
    if (tbody) tbody.innerHTML = data.map(s => `<tr><td>${s.flavor}</td><td>${s.stock}</td></tr>`).join('');
}

document.getElementById('sale-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        client_name: document.getElementById('sale-client').value,
        items: [{
            product_id: parseInt(document.getElementById('sale-product').value),
            quantity: parseInt(document.getElementById('sale-qty').value)
        }]
    };
    const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    if (res.ok) {
        e.target.reset();
        loadStock();
    }
});
