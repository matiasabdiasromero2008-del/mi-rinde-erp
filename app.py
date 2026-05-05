from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import bcrypt
import os
import sys
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from database import get_connection, init_db
    import logic
except ImportError as e:
    logger.error(f"Error importando modulos locales: {e}")
    sys.path.append(os.path.dirname(__file__))
    from database import get_connection, init_db
    import logic

app = FastAPI(title="Rinde ERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    try:
        init_db()
        logger.info("Base de datos inicializada.")
    except Exception as e:
        logger.error(f"Error DB: {e}")

# Robust Frontend Finding
base_dir = os.path.dirname(__file__)
frontend_dir = None

# Case 1: Standard folder
if os.path.exists(os.path.join(base_dir, "frontend")):
    frontend_dir = os.path.join(base_dir, "frontend")
elif os.path.exists(os.path.join(base_dir, "Frontend")):
    frontend_dir = os.path.join(base_dir, "Frontend")
# Case 2: Files are in the root (Detected from user logs)
elif os.path.exists(os.path.join(base_dir, "index.html")):
    frontend_dir = base_dir

if frontend_dir:
    # If serving from root, we mount it as static so /static/style.css works
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
    logger.info(f"Frontend detectado en: {frontend_dir}")
else:
    logger.error("No se encontro el frontend en ninguna ubicacion.")

@app.get("/")
def serve_index():
    if not frontend_dir:
        return {"error": "No se encontró index.html. Por favor verifique los archivos en GitHub."}
    
    index_path = os.path.join(frontend_dir, "index.html")
    return FileResponse(index_path)

# --- Pydantic Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class ExpenseItemModel(BaseModel):
    description: str
    quantity: float
    unit_price: float

class ExpenseRequest(BaseModel):
    provider: str
    category_name: str
    items: List[ExpenseItemModel]
    date: Optional[str] = None

class ProviderModel(BaseModel):
    name: str
    category_name: str
    phone: Optional[str] = None
    location: Optional[str] = None
    delivery_time: Optional[str] = None
    observations: Optional[str] = None

class IngredientModel(BaseModel):
    name: str

class ProductModel(BaseModel):
    flavor_name: str
    sale_price: float
    yield_per_batch: float

class RecipeItem(BaseModel):
    ingredient_id: int
    quantity: float

class RecipeRequest(BaseModel):
    product_id: int
    yield_per_batch: float
    items: List[RecipeItem]

class ProductionModel(BaseModel):
    product_id: int
    quantity: int
    date: Optional[str] = None

class ClientModel(BaseModel):
    name: str
    phone: Optional[str] = None

class SaleItemModel(BaseModel):
    product_id: int
    quantity: int

class SaleRequest(BaseModel):
    client_name: str
    items: List[SaleItemModel]
    discount: float = 0
    date: Optional[str] = None

# --- API Endpoints ---
@app.post("/login")
def login(req: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash, role FROM users WHERE username = %s", (req.username,))
    result = cursor.fetchone()
    conn.close()
    if result and bcrypt.checkpw(req.password.encode('utf-8'), result[0].encode('utf-8')):
        return {"success": True, "role": result[1], "username": req.username}
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/metrics")
def get_metrics(month: str = None):
    if not month:
        month = datetime.now().strftime("%Y-%m")
    try:
        data = logic.get_performance_metrics(month)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/expenses")
def get_expenses():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT e.id, e.provider, c.name, e.date, e.total_amount
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        ORDER BY e.date DESC, e.id DESC
        LIMIT 50
    """)
    results = cursor.fetchall()
    conn.close()
    # Format date to string with time
    return [{"id": r[0], "provider": r[1], "category": r[2], "date": r[3].strftime("%Y-%m-%d %H:%M"), "amount": r[4]} for r in results]

@app.get("/expenses/{expense_id}/items")
def get_expense_items(expense_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT description, quantity, unit_price, total_price FROM expense_items WHERE expense_id = %s", (expense_id,))
    items = cursor.fetchall()
    conn.close()
    return [{"description": r[0], "quantity": r[1], "unit_price": r[2], "total_price": r[3]} for r in items]

@app.post("/expenses")
def create_expense(req: ExpenseRequest):
    date_str = req.date if req.date else datetime.now().strftime("%Y-%m-%d")
    items_dict = [{"description": i.description, "quantity": i.quantity, "unit_price": i.unit_price} for i in req.items]
    try:
        logic.add_expense(req.provider, req.category_name, items_dict, date_str)
        return {"success": True, "message": "Expense registered"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    # Delete items first due to foreign key
    cursor.execute("DELETE FROM expense_items WHERE expense_id = %s", (expense_id,))
    cursor.execute("DELETE FROM expenses WHERE id = %s", (expense_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.put("/expenses/{expense_id}")
def update_expense(expense_id: int, req: ExpenseRequest):
    date_str = req.date if req.date else datetime.now().strftime("%Y-%m-%d")
    items_dict = [{"description": i.description, "quantity": i.quantity, "unit_price": i.unit_price} for i in req.items]
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 1. Update main expense record
        cursor.execute("SELECT id FROM categories WHERE name = %s", (req.category_name,))
        cat_id = cursor.fetchone()[0]
        
        total_amount = sum(item['quantity'] * item['unit_price'] for item in items_dict)
        
        cursor.execute("""
            UPDATE expenses 
            SET provider = %s, category_id = %s, date = %s, total_amount = %s
            WHERE id = %s
        """, (req.provider, cat_id, date_str, total_amount, expense_id))
        
        # 2. Delete old items and insert new ones
        cursor.execute("DELETE FROM expense_items WHERE expense_id = %s", (expense_id,))
        for item in items_dict:
            cursor.execute('''
                INSERT INTO expense_items (expense_id, description, quantity, unit_price, total_price)
                VALUES (%s, %s, %s, %s, %s)
            ''', (expense_id, item['description'], item['quantity'], item['unit_price'], item['quantity'] * item['unit_price']))
            
            # Upsert ingredient
            if req.category_name == "INSUMOS":
                cursor.execute('''
                    INSERT INTO ingredients (name, last_unit_cost)
                    VALUES (%s, %s)
                    ON CONFLICT (name) DO UPDATE SET last_unit_cost = EXCLUDED.last_unit_cost
                ''', (item['description'], item['unit_price']))
                
        conn.commit()
        conn.close()
        return {"success": True, "message": "Expense updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/providers")
def get_providers():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.id, p.name, c.name, p.phone, p.location, p.delivery_time, p.observations
        FROM providers p 
        JOIN categories c ON p.category_id = c.id
    """)
    results = cursor.fetchall()
    conn.close()
    return [{
        "id": r[0], "name": r[1], "category": r[2], 
        "phone": r[3], "location": r[4], "delivery_time": r[5], "observations": r[6]
    } for r in results]

@app.post("/providers")
def add_provider(req: ProviderModel):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM categories WHERE name = %s", (req.category_name,))
        cat_id = cursor.fetchone()
        if not cat_id: raise HTTPException(status_code=400, detail="Category not found")
        
        cursor.execute("""
            INSERT INTO providers (name, category_id, phone, location, delivery_time, observations) 
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (req.name, cat_id[0], req.phone, req.location, req.delivery_time, req.observations))
        conn.commit()
        return {"success": True}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally: conn.close()

@app.delete("/providers/{provider_id}")
def delete_provider(provider_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM providers WHERE id = %s", (provider_id,))
    conn.commit()
    conn.close()
    return {"success": True}

# --- Client Endpoints ---

@app.get("/clients")
def get_clients():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, phone FROM clients ORDER BY name")
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "phone": r[2] or ""} for r in results]

@app.post("/clients")
def add_client(req: ClientModel):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO clients (name, phone) VALUES (%s, %s)", (req.name.upper(), req.phone))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@app.put("/clients/{client_id}")
def update_client(client_id: int, req: ClientModel):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE clients SET name = %s, phone = %s WHERE id = %s", (req.name.upper(), req.phone, client_id))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@app.delete("/clients/{client_id}")
def delete_client(client_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM clients WHERE id = %s", (client_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()



@app.get("/ingredients")
def get_ingredients():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, last_unit_cost FROM ingredients ORDER BY name")
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "cost": r[2]} for r in results]

@app.post("/ingredients")
def add_ingredient(req: IngredientModel):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO ingredients (name) VALUES (%s)", (req.name,))
        conn.commit()
        return {"success": True}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally: conn.close()

@app.post("/products")
def add_product(req: ProductModel):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO products (flavor_name, sale_price, yield_per_batch) 
            VALUES (%s, %s, %s)
        """, (req.flavor_name, req.sale_price, req.yield_per_batch))
        conn.commit()
        return {"success": True}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally: conn.close()

@app.delete("/products/{product_id}")
def delete_product(product_id: int):
    import psycopg2.errors
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Delete related product_ingredients first
        cursor.execute("DELETE FROM product_ingredients WHERE product_id = %s", (product_id,))
        # Delete related stock
        cursor.execute("DELETE FROM stock WHERE product_id = %s", (product_id,))
        cursor.execute("DELETE FROM products WHERE id = %s", (product_id,))
        conn.commit()
        return {"success": True}
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="No se puede eliminar el producto porque ya tiene ventas registradas.")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@app.put("/products/{product_id}")
def update_product(product_id: int, req: ProductModel):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE products 
            SET flavor_name = %s, sale_price = %s, yield_per_batch = %s
            WHERE id = %s
        """, (req.flavor_name, req.sale_price, req.yield_per_batch, product_id))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@app.get("/recipes/{product_id}")
def get_recipe(product_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT i.id, i.name, pi.quantity_per_batch, i.last_unit_cost
        FROM product_ingredients pi
        JOIN ingredients i ON pi.ingredient_id = i.id
        WHERE pi.product_id = %s
    """, (product_id,))
    items = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "quantity": r[2], "cost": r[3]} for r in items]

@app.post("/recipes")
def save_recipe(req: RecipeRequest):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Update yield in products table
        cursor.execute("UPDATE products SET yield_per_batch = %s WHERE id = %s", (req.yield_per_batch, req.product_id))
        
        # Clear old recipe
        cursor.execute("DELETE FROM product_ingredients WHERE product_id = %s", (req.product_id,))
        
        # Insert new items
        for item in req.items:
            cursor.execute("""
                INSERT INTO product_ingredients (product_id, ingredient_id, quantity_per_batch)
                VALUES (%s, %s, %s)
            """, (req.product_id, item.ingredient_id, item.quantity))
        
        # Recalculate GPU immediately
        logic.recalculate_product_gpu(req.product_id, cursor)
        
        conn.commit()
        return {"success": True}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally: conn.close()

@app.post("/sales")
def create_sale(req: SaleRequest):
    date_str = req.date if req.date else datetime.now().strftime("%Y-%m-%d")
    items_dict = [{"product_id": i.product_id, "quantity": i.quantity} for i in req.items]
    try:
        logic.record_sale(req.client_name, items_dict, req.discount, date_str)
        return {"success": True, "message": "Sale registered"}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))

@app.get("/metrics")
def get_metrics():
    return logic.get_performance_metrics()

# --- PRODUCCIÓN (INGRESOS) ---
@app.post("/production")
def create_production(req: ProductionModel):
    date_str = req.date if req.date else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Insert into production_runs
        cursor.execute("""
            INSERT INTO production_runs (product_id, quantity, date)
            VALUES (%s, %s, %s)
        """, (req.product_id, req.quantity, date_str))
        
        # Update Stock
        cursor.execute("""
            INSERT INTO stock (product_id, quantity_remaining)
            VALUES (%s, %s)
            ON CONFLICT (product_id) DO UPDATE 
            SET quantity_remaining = stock.quantity_remaining + EXCLUDED.quantity_remaining
        """, (req.product_id, req.quantity))
        
        conn.commit()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@app.get("/production")
def get_production():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pr.id, p.id, p.flavor_name, pr.quantity, pr.date
        FROM production_runs pr
        JOIN products p ON pr.product_id = p.id
        ORDER BY pr.date DESC
    """)
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "product_id": r[1], "product_name": r[2], "quantity": r[3], "date": r[4].strftime("%Y-%m-%dT%H:%M")} for r in results]

@app.delete("/production/{prod_id}")
def delete_production(prod_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT product_id, quantity FROM production_runs WHERE id = %s", (prod_id,))
        row = cursor.fetchone()
        if not row: raise Exception("Registro no encontrado")
        p_id, qty = row
        
        # Reduce stock
        cursor.execute("""
            UPDATE stock SET quantity_remaining = quantity_remaining - %s
            WHERE product_id = %s
        """, (qty, p_id))
        
        cursor.execute("DELETE FROM production_runs WHERE id = %s", (prod_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@app.put("/production/{prod_id}")
def update_production(prod_id: int, req: ProductionModel):
    date_str = req.date if req.date else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT product_id, quantity FROM production_runs WHERE id = %s", (prod_id,))
        row = cursor.fetchone()
        if not row: raise Exception("Registro no encontrado")
        old_p_id, old_qty = row
        
        # First, revert old stock
        cursor.execute("""
            UPDATE stock SET quantity_remaining = quantity_remaining - %s
            WHERE product_id = %s
        """, (old_qty, old_p_id))
        
        # Now, update production run
        cursor.execute("""
            UPDATE production_runs 
            SET product_id = %s, quantity = %s, date = %s
            WHERE id = %s
        """, (req.product_id, req.quantity, date_str, prod_id))
        
        # Apply new stock
        cursor.execute("""
            INSERT INTO stock (product_id, quantity_remaining)
            VALUES (%s, %s)
            ON CONFLICT (product_id) DO UPDATE 
            SET quantity_remaining = stock.quantity_remaining + EXCLUDED.quantity_remaining
        """, (req.product_id, req.quantity))
        
        conn.commit()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@app.get("/stock")
def get_stock():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT p.id, p.flavor_name, s.quantity_remaining FROM products p JOIN stock s ON p.id = s.product_id")
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "flavor": r[1], "stock": r[2]} for r in results]

@app.get("/products")
def get_products():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, flavor_name, sale_price, current_gpu, yield_per_batch FROM products")
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "price": r[2], "gpu": r[3], "yield": r[4]} for r in results]

@app.get("/categories")
def get_categories():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM categories")
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1]} for r in results]
