const API_URL = ''; // Since we serve from same origin
let currentUser = null;
let allProviders = []; // Store providers locally for auto-category logic

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
    
    // Refresh data based on section
    if (secId === 'sec-performance') loadMetrics();
    if (secId === 'sec-proveedores') loadProviders();
    if (secId === 'sec-gastos') {
        loadCategories();
        loadProvidersDropdown();
    }
    if (secId === 'sec-ventas') loadStock();
}

function setupDashboard() {
    userDisplay.textContent = `${currentUser.username} (${currentUser.role})`;
    navLinks.innerHTML = '';
    
    if (currentUser.role === 'Admin') {
        addNavLink('Performance', 'sec-performance', true);
        addNavLink('Proveedores', 'sec-proveedores');
        addNavLink('Carga de Gastos', 'sec-gastos');
        switchSection('sec-performance', 'Performance');
        loadCategories(); // Global categories load
    } else {
        addNavLink('Ventas y Stock', 'sec-ventas', true);
        switchSection('sec-ventas', 'Ventas y Stock');
        loadProducts();
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
            row.innerHTML = `
                <div class="bar-label">${cat}</div>
                <div style="flex:1">
                    <div class="bar-fill" style="width: ${pct}%"></div>
                </div>
                <div class="bar-value">$${val.toFixed(2)}</div>
            `;
            barsContainer.appendChild(row);
        }
    } catch (err) {}
}

async function loadCategories() {
    try {
        const res = await fetch(`${API_URL}/categories`);
        const data = await res.json();
        const selects = ['exp-cat', 'prov-cat'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<option value="">Seleccione...</option>' + data.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            }
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
                <td><button class="btn secondary outline" onclick="deleteProvider(${p.id})">Eliminar</button></td>
            </tr>
        `).join('');
    } catch (err) {}
}

async function loadProvidersDropdown() {
    try {
        const res = await fetch(`${API_URL}/providers`);
        allProviders = await res.json();
        const select = document.getElementById('exp-prov');
        select.innerHTML = '<option value="">Seleccione un proveedor</option>' + 
                          allProviders.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    } catch (err) {}
}

async function deleteProvider(id) {
    if (confirm('¿Eliminar este proveedor?')) {
        await fetch(`${API_URL}/providers/${id}`, { method: 'DELETE' });
        loadProviders();
    }
}

// Auto-Category Logic
document.getElementById('exp-prov').addEventListener('change', (e) => {
    const provName = e.target.value;
    const catSelect = document.getElementById('exp-cat');
    const provider = allProviders.find(p => p.name === provName);
    if (provider) {
        catSelect.value = provider.category;
        catSelect.removeAttribute('disabled');
    } else {
        catSelect.value = '';
        catSelect.setAttribute('disabled', 'true');
    }
});

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const data = await res.json();
        const select = document.getElementById('sale-product');
        select.innerHTML = data.map(p => `<option value="${p.id}">${p.name} ($${p.price})</option>`).join('');
    } catch (err) {}
}

async function loadStock() {
    try {
        const res = await fetch(`${API_URL}/stock`);
        const data = await res.json();
        const tbody = document.getElementById('stock-tbody');
        tbody.innerHTML = data.map(s => `
            <tr>
                <td>${s.flavor}</td>
                <td>${s.stock}</td>
            </tr>
        `).join('');
    } catch (err) {}
}

// Form Submissions
document.getElementById('provider-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('prov-name').value,
        category_name: document.getElementById('prov-cat').value
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
            msg.textContent = 'Proveedor guardado';
            e.target.reset();
            loadProviders();
        } else {
            msg.className = 'error-msg';
            msg.textContent = 'Error al guardar';
        }
    } catch (err) {}
});

document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        provider: document.getElementById('exp-prov').value,
        category_name: document.getElementById('exp-cat').value,
        items: [{
            description: document.getElementById('exp-desc').value,
            quantity: parseFloat(document.getElementById('exp-qty').value),
            unit_price: parseFloat(document.getElementById('exp-price').value)
        }]
    };
    
    try {
        const res = await fetch(`${API_URL}/expenses`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const msg = document.getElementById('exp-msg');
        if (res.ok) {
            msg.className = 'success-msg';
            msg.textContent = 'Gasto registrado correctamente';
            e.target.reset();
            loadMetrics();
        } else {
            msg.className = 'error-msg';
            msg.textContent = 'Error al registrar el gasto';
        }
    } catch (err) {}
});

document.getElementById('sale-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        client_name: document.getElementById('sale-client').value,
        items: [{
            product_id: parseInt(document.getElementById('sale-product').value),
            quantity: parseInt(document.getElementById('sale-qty').value)
        }]
    };
    
    try {
        const res = await fetch(`${API_URL}/sales`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const msg = document.getElementById('sale-msg');
        if (res.ok) {
            msg.className = 'success-msg';
            msg.textContent = 'Venta registrada correctamente';
            e.target.reset();
            loadStock();
        } else {
            const errorData = await res.json();
            msg.className = 'error-msg';
            msg.textContent = `Error: ${errorData.detail || 'al registrar la venta'}`;
        }
    } catch (err) {}
});
