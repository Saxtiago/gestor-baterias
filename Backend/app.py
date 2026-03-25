
import os
import pandas as pd
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Importante para que Angular pueda consultar al Backend

# Definimos la ruta de forma dinámica
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RUTA_EXCEL = os.path.join(BASE_DIR, 'data', 'plantilla_baterias.xlsx')
from flask import render_template

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
    
# Y así con editar, eliminar, etc.
@app.route('/api/baterias', methods=['GET'])
def listar_baterias():
    if not os.path.exists(RUTA_EXCEL):
        return jsonify({"error": "El archivo de datos no existe en el servidor"}), 404
    
    try:
        # Leemos el excel
        df = pd.read_excel(RUTA_EXCEL)
        
        # Limpieza rápida: reemplaza valores nulos (NaN) por strings vacíos 
        # para evitar errores al convertir a JSON
        df = df.fillna("")
        
        # Convertimos a lista de diccionarios
        data = df.to_dict(orient='records')
        
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"Error al procesar el archivo: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
    
# Y así con editar, eliminar, etc.
@app.route('/api/baterias', methods=['GET'])
def listar_baterias():
    if not os.path.exists(RUTA_EXCEL):
        return jsonify({"error": "El archivo de datos no existe en el servidor"}), 404
    
    try:
        # Leemos el excel
        df = pd.read_excel(RUTA_EXCEL)
        
        # Limpieza rápida: reemplaza valores nulos (NaN) por strings vacíos 
        # para evitar errores al convertir a JSON
        df = df.fillna("")
        
        # Convertimos a lista de diccionarios
        data = df.to_dict(orient='records')
        
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"Error al procesar el archivo: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)