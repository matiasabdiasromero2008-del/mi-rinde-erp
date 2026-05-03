from database import get_connection
from datetime import datetime

def update_all_gpus():
    """Recalculate GPU for all products based on latest ingredient costs."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM products")
    products = cursor.fetchall()
    
    for (p_id,) in products:
        recalculate_product_gpu(p_id, cursor)
        
    conn.commit()
    conn.close()

def recalculate_product_gpu(product_id, cursor):
    """Calculate GPU = sum(qty * cost) / yield."""
    # Get yield for the product
    cursor.execute("SELECT yield_per_batch FROM products WHERE id = %s", (product_id,))
    row = cursor.fetchone()
    yield_val = row[0] if row and row[0] else 1
    
    # Get ingredients and their costs
    cursor.execute('''
        SELECT pi.quantity_per_batch, i.last_unit_cost
        FROM product_ingredients pi
        JOIN ingredients i ON pi.ingredient_id = i.id
        WHERE pi.product_id = %s
    ''', (product_id,))
    
    items = cursor.fetchall()
    if not items:
        # If no recipe, GPU is 0
        cursor.execute("UPDATE products SET current_gpu = 0 WHERE id = %s", (product_id,))
        return
        
    total_batch_cost = 0
    for qty, cost in items:
        total_batch_cost += (qty * cost)
        
    gpu = total_batch_cost / yield_val if yield_val > 0 else 0
    
    cursor.execute("UPDATE products SET current_gpu = %s WHERE id = %s", (gpu, product_id))

def add_expense(provider, category_name, items_list, date_str):
    """
    items_list: list of dicts [{'description': 'Azucar', 'quantity': 10, 'unit_price': 900}]
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get category id
    cursor.execute("SELECT id FROM categories WHERE name = %s", (category_name,))
    cat_row = cursor.fetchone()
    if not cat_row:
        raise ValueError("Categoria no encontrada")
    cat_id = cat_row[0]
    
    total_amount = sum(item['quantity'] * item['unit_price'] for item in items_list)
    
    cursor.execute('''
        INSERT INTO expenses (provider, category_id, date, total_amount)
        VALUES (%s, %s, %s, %s) RETURNING id
    ''', (provider, cat_id, date_str, total_amount))
    expense_id = cursor.fetchone()[0]
    
    for item in items_list:
        cursor.execute('''
            INSERT INTO expense_items (expense_id, description, quantity, unit_price, total_price)
            VALUES (%s, %s, %s, %s, %s)
        ''', (expense_id, item['description'], item['quantity'], item['unit_price'], item['quantity'] * item['unit_price']))
        
        # If it's an Insumo, update the ingredient cost
        if category_name == "INSUMOS":
            cursor.execute("UPDATE ingredients SET last_unit_cost = %s WHERE name = %s", 
                           (item['unit_price'], item['description']))
    
    conn.commit()
    
    # After updating ingredients, update affected product GPUs
    if category_name == "INSUMOS":
        cursor.execute("SELECT id FROM products")
        products = cursor.fetchall()
        for (p_id,) in products:
            recalculate_product_gpu(p_id, cursor)
        conn.commit()
        
    conn.close()

def record_sale(client_name, items_list, discount, date_str=None):
    """
    items_list: list of dicts [{'product_id': 1, 'quantity': 2}]
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
        
    conn = get_connection()
    cursor = conn.cursor()
    
    total_income = 0
    total_gpu_snapshot = 0
    
    # Validate stock and calculate totals
    valid_items = []
    for item in items_list:
        cursor.execute("SELECT flavor_name, sale_price, current_gpu FROM products WHERE id = %s", (item['product_id'],))
        prod = cursor.fetchone()
        
        cursor.execute("SELECT quantity_remaining FROM stock WHERE product_id = %s", (item['product_id'],))
        stock_row = cursor.fetchone()
        stock_qty = stock_row[0] if stock_row else 0
        
        if stock_qty < item['quantity']:
            raise ValueError(f"Stock insuficiente para {prod[0]}")
            
        total_income += (prod[1] * item['quantity'])
        total_gpu_snapshot += (prod[2] * item['quantity'])
        valid_items.append({
            'id': item['product_id'],
            'qty': item['quantity'],
            'gpu': prod[2]
        })
    
    final_income = total_income - discount
    
    # Record Sale
    cursor.execute('''
        INSERT INTO sales (client_name, date, discount, total_income, total_gpu_snapshot)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', (client_name, date_str, discount, final_income, total_gpu_snapshot))
    sale_id = cursor.fetchone()[0]
    
    # Record Items and update Stock
    for item in valid_items:
        cursor.execute('''
            INSERT INTO sale_items (sale_id, product_id, quantity, gpu_snapshot)
            VALUES (%s, %s, %s, %s)
        ''', (sale_id, item['id'], item['qty'], item['gpu']))
        
        cursor.execute("UPDATE stock SET quantity_remaining = quantity_remaining - %s WHERE product_id = %s", 
                       (item['qty'], item['id']))
        
    conn.commit()
    conn.close()

def get_performance_metrics(month_str):
    """month_str format: 'YYYY-MM'"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Ingresos y GTR (Real)
    cursor.execute('''
        SELECT SUM(total_income), SUM(total_gpu_snapshot)
        FROM sales
        WHERE to_char(date::timestamp, 'YYYY-MM') = %s
    ''', (month_str,))
    sales_data = cursor.fetchone()
    ingresos = sales_data[0] if sales_data and sales_data[0] else 0
    gtr = sales_data[1] if sales_data and sales_data[1] else 0
    
    # 2. Egresos Operativos (Excluyendo Insumos para la rentabilidad real)
    cursor.execute('''
        SELECT c.name, SUM(e.total_amount)
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        WHERE to_char(e.date::timestamp, 'YYYY-MM') = %s
        GROUP BY c.name
    ''', (month_str,))
    egresos_by_cat = dict(cursor.fetchall())
    
    total_egresos_operativos = sum(v for k, v in egresos_by_cat.items() if k != "INSUMOS")
    
    # 3. Rentabilidad Real
    # Formula: ((Ingresos - GTR) / Ingresos) * 100
    rentabilidad = ((ingresos - gtr) / ingresos * 100) if ingresos > 0 else 0
    
    conn.close()
    
    return {
        'ingresos': ingresos,
        'gtr': gtr,
        'egresos_operativos': total_egresos_operativos,
        'egresos_detallados': egresos_by_cat,
        'rentabilidad_real': rentabilidad
    }
