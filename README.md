# Rinde - ERP de Rentabilidad Dinámica

## Descripción
Aplicación de escritorio para microemprendedores diseñada para calcular la rentabilidad real basada en el costo dinámico de producción (Escandallo) y el Gasto Total Real (GTR).

## Instalación
1. Asegúrate de tener Python 3.8+ instalado.
2. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```

## Configuración Inicial
Antes de abrir la app por primera vez, inicializa los datos:
```bash
python seed_data.py
```

## Uso
Para iniciar la aplicación:
```bash
python main.py
```

### Credenciales por Defecto
- **Usuario**: `admin`
- **Contraseña**: `admin123`

## Características
- **Escandallo Dinámico**: Los costos se actualizan automáticamente al cargar insumos.
- **GTR (Gasto Total Real)**: Rentabilidad calculada sobre el costo real de las unidades vendidas.
- **Roles**: Admin (Gestión total) y Operador (Solo ventas y stock).
- **Reportes**: Exportación a PDF y Excel.
