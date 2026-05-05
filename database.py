import psycopg2
import bcrypt
import os

DB_URL = os.environ.get("DATABASE_URL", "postgresql://neondb_owner:npg_3qmQAyfaS8oJ@ep-cool-waterfall-ajt00qej-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require")

def get_connection():
    return psycopg2.connect(DB_URL)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Users
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('Admin', 'Operator')) NOT NULL
    )
    ''')

    # Categories
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
    )
    ''')

    # Products (Sabores)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        flavor_name TEXT UNIQUE NOT NULL,
        sale_price REAL NOT NULL,
        yield_per_batch REAL DEFAULT 1,
        current_gpu REAL DEFAULT 0
    )
    ''')

    # Ingredients (Insumos)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        last_unit_cost REAL DEFAULT 0
    )
    ''')

    # Product-Ingredient mapping
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS product_ingredients (
        product_id INTEGER,
        ingredient_id INTEGER,
        quantity_per_batch REAL NOT NULL,
        PRIMARY KEY (product_id, ingredient_id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    )
    ''')

    # Expenses
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        provider TEXT,
        category_id INTEGER,
        date TIMESTAMP,
        total_amount REAL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )
    ''')

    # Expense Items
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS expense_items (
        id SERIAL PRIMARY KEY,
        expense_id INTEGER,
        description TEXT,
        quantity REAL,
        unit_price REAL,
        total_price REAL,
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
    )
    ''')

    # Providers
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS providers (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        category_id INTEGER,
        phone TEXT,
        location TEXT,
        delivery_time TEXT,
        observations TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )
    ''')

    # Sales
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        client_name TEXT,
        date TIMESTAMP,
        discount REAL DEFAULT 0,
        total_income REAL,
        total_gpu_snapshot REAL,
        user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    ''')

    # Sale Items
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        gpu_snapshot REAL,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
    ''')

    # Production Runs (Ingresos)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS production_runs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER,
        quantity INTEGER,
        date TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
    ''')

    # Stock
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS stock (
        product_id INTEGER PRIMARY KEY,
        quantity_remaining INTEGER DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
    ''')

    # Seed Categories
    categories = [
        "SUELDOS", "INSUMOS", "UTENSILIOS", "PROGRAMAS", 
        "SITIO WEB", "DISEÑADOR", "PACKAGING", "MARKETING"
    ]
    for cat in categories:
        cursor.execute("INSERT INTO categories (name) VALUES (%s) ON CONFLICT (name) DO NOTHING", (cat,))

    # Create default Admin
    admin_pass = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s) ON CONFLICT (username) DO NOTHING", 
                   ("admin", admin_pass, "Admin"))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
