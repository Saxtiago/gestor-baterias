import os
import pandas as pd
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Importante para que Angular pueda consultar al Backend

# Definimos la ruta de forma dinámica
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RUTA_EXCEL = os.path.join(BASE_DIR, 'data', 'plantilla_baterias.xlsx')

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