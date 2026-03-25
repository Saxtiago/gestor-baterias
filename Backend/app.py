
import os
import pandas as pd
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Importante para que Angular pueda consultar al Backend

# Definimos la ruta de forma dinámica
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RUTA_EXCEL = os.path.join(BASE_DIR, 'data', 'plantilla_baterias.xlsx')

COLUMNAS = [
    'COD',
    'Negocio',
    'UPS Marca',
    'Modelo',
    'Capacidad',
    'Serial',
    'Inventario No',
    'FECHA DE INSTALACION',
    'REFERENCIA',
    'CANTIDAD',
    'FECHA DE VENCIMIENTO',
    'ESTADO',
    'DIAS VENCIDOS',
    'AÑOS/ MESES/ DIAS',
]


def cargar_excel():
    if not os.path.exists(RUTA_EXCEL):
        df = pd.DataFrame(columns=COLUMNAS)
        df.to_excel(RUTA_EXCEL, index=False)
        return df

    df = pd.read_excel(RUTA_EXCEL)
    df.columns = df.columns.map(lambda col: str(col).strip())
    return df


def guardar_excel(df: pd.DataFrame) -> None:
    df.to_excel(RUTA_EXCEL, index=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/gestion_baterias')
def gestion_baterias():
    # Capturamos el nombre del archivo que viene del select (opcional por ahora)
    archivo_seleccionado = request.args.get('archivo')
    
    # IMPORTANTE: Aquí retornamos el HTML de la tabla de gestión
    return render_template('gestion_baterias.html', archivo=archivo_seleccionado)

@app.route('/agregar')
def agregar():
    return render_template('agregar.html')


@app.route('/editar')
def editar():
    return render_template('editar.html')

@app.route('/eliminar')
def eliminar():
    return render_template('eliminar.html')
    
@app.route('/api/baterias', methods=['GET'])
def listar_baterias():
    try:
        df = cargar_excel()
        df = df.fillna("")
        data = df.to_dict(orient='records')
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"Error al procesar el archivo: {str(e)}"}), 500


@app.route('/api/baterias', methods=['POST'])
def crear_bateria():
    try:
        payload = request.get_json(silent=True) or {}
        df = cargar_excel()

        nueva_fila = {col: payload.get(col, "") for col in COLUMNAS}
        df = pd.concat([df, pd.DataFrame([nueva_fila])], ignore_index=True)
        guardar_excel(df)
        return jsonify({"ok": True, "mensaje": "Registro agregado"}), 201
    except Exception as e:
        return jsonify({"error": f"Error al guardar el registro: {str(e)}"}), 500


@app.route('/api/baterias/<int:row_id>', methods=['PUT'])
def actualizar_bateria(row_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        df = cargar_excel()

        if row_id < 0 or row_id >= len(df):
            return jsonify({"error": "Registro no encontrado"}), 404

        for col in COLUMNAS:
            if col in payload:
                df.at[row_id, col] = payload[col]

        guardar_excel(df)
        return jsonify({"ok": True, "mensaje": "Registro actualizado"}), 200
    except Exception as e:
        return jsonify({"error": f"Error al actualizar el registro: {str(e)}"}), 500


@app.route('/api/baterias/<int:row_id>', methods=['DELETE'])
def eliminar_bateria(row_id: int):
    try:
        df = cargar_excel()

        if row_id < 0 or row_id >= len(df):
            return jsonify({"error": "Registro no encontrado"}), 404

        df = df.drop(index=row_id).reset_index(drop=True)
        guardar_excel(df)
        return jsonify({"ok": True, "mensaje": "Registro eliminado"}), 200
    except Exception as e:
        return jsonify({"error": f"Error al eliminar el registro: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)