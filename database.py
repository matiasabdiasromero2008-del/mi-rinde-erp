import sqlite3
import bcrypt
import os

DB_PATH = os.path.join("data", "rinde.db")

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    if not os.path.exists("data"):
        os.makedirs("data")
        
    conn = get_connection()
    cursor = conn.cursor()

    # Users
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('Admin', 'Operator')) NOT NULL
    )
    ''')

    # Categories (8 fixed categories)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    ''')

    # Products (Sabores)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flavor_name TEXT UNIQUE NOT NULL,
        sale_price REAL NOT NULL,
        yield_per_batch REAL DEFAULT 1,
        current_gpu REAL DEFAULT 0
    )
    ''')

    # Ingredients (Insumos)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        last_unit_cost REAL DEFAULT 0
    )
    ''')

    # Product-Ingredient mapping (The Escandallo)
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT,
        category_id INTEGER,
        date TEXT,
        total_amount REAL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )
    ''')

    # Expense Items (Support for up to 5 items per expense)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS expense_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER,
        description TEXT,
        quantity REAL,
        unit_price REAL,
        total_price REAL,
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
    )
    ''')

    # Sales
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT,
        date TEXT,
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        gpu_snapshot REAL,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
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

    # Providers
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category_id INTEGER,
        phone TEXT,
        location TEXT,
        delivery_time TEXT,
        observations TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )
    ''')

    # Seed Categories (User updated requirements)
    categories = [
        "SUELDOS", "INSUMOS", "UTENSILIOS", "PROGRAMAS", 
        "SITIO WEB", "DISEÑADOR", "PACKAGING", "MARKETING"
    ]
    for cat in categories:
        cursor.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (cat,))

    # Create default Admin (password: admin123)
    admin_pass = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    cursor.execute("INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                   ("admin", admin_pass, "Admin"))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
