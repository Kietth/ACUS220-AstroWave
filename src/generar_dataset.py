import pandas as pd
import numpy as np
import os
from astroquery.simbad import Simbad
from astroquery.mast import Catalogs
import warnings

warnings.filterwarnings('ignore')

def calcular_frec(teff):
    if pd.isna(teff) or teff <= 0: return np.nan

    T_min, T_max = 3000.0, 10000.0
    f_min, f_max = 220.0, 880.0

    x = np.clip((teff - T_min) / (T_max - T_min), 0.0, 1.0)

    f_sound = f_min * (f_max / f_min) ** x
    return round(f_sound, 2)

def calcular_reverb(plx_mas):
    if pd.isna(plx_mas) or plx_mas <= 0: return np.nan

    plx_min, plx_max = 1.0, 100.0
    plx_clipped = np.clip(plx_mas, plx_min, plx_max)

    distance_proxy = 1.0 - (np.log10(plx_clipped) - np.log10(plx_min)) / (np.log10(plx_max) - np.log10(plx_min))
    distance_proxy = np.clip(distance_proxy, 0.0, 1.0)

    wet_mix = 0.1 + 0.70 * distance_proxy
    return round(wet_mix, 4)

simbad_custom = Simbad()
simbad_custom.add_votable_fields('plx_value', 'sp_type')

lista_estrellas = ['Betelgeuse', 'Sirius', 'Rigel', 'Aldebaran', 'Vega', 
                   #'Polaris', 'Antares', 'Altair', 'Deneb'
                    ]
datos_finales = []

print('Generando dataset de estrellas...')
print('-'*50)

for estrella in lista_estrellas:
    print(f'Buscando datos para: {estrella}...')

    try:
        resultado_simbad = simbad_custom.query_object(estrella)
        if resultado_simbad is None:
            print(f'No se encontraron datos en Simbad para {estrella}.')
            continue

        sp_type = resultado_simbad['sp_type'][0]
        plx_value = float(resultado_simbad['plx_value'][0]) if not np.ma.is_masked(resultado_simbad['plx_value'][0]) else np.nan

        ids_simbad = Simbad.query_objectids(estrella).to_pandas()
        tic_matches = ids_simbad[ids_simbad['id'].str.match(r'^TIC\s+\d+$', na=False)].reset_index(drop=True)

        teff_value = np.nan
        if len(tic_matches) > 0:
            tic_id = int(str(tic_matches.loc[0, 'id']).split()[1])
            tic_data = Catalogs.query_criteria(catalog='TIC', ID=tic_id)
            if 'Teff' in tic_data.colnames and not np.ma.is_masked(tic_data['Teff'][0]):
                teff_value = float(tic_data['Teff'][0])

        freq_hz = calcular_frec(teff_value)
        reverb_mix = calcular_reverb(plx_value)

        if pd.isna(teff_value) or pd.isna(plx_value):
            print(f"Datos incompletos (Teff: {teff_value}, Plx: {plx_value}). Omitiendo estrella.")
        else:
            datos_finales.append({
                "Estrella": estrella,
                "Tipo_Espectral": sp_type,
                "Temp_K": teff_value,
                "Paralaje_mas": plx_value,
                "AstroWave_Freq_Hz": freq_hz,
                "AstroWave_Reverb": reverb_mix
        })
        print(f'{estrella} procesada!')
    except Exception as e:
        print(f'Error al procesar {estrella}: {e}')

print('-'*50)
print('Generando Dataset final...')

df_astrowave = pd.DataFrame(datos_finales)

#Eliminar estrellas que no tengan todos los datos necesarios para el dataset
df_astrowave = df_astrowave.dropna().reset_index(drop=True)

os.makedirs('data', exist_ok=True)
ruta_archivo = os.path.join('data', 'dataset_astrowave.csv')

#Exportar dataset a CSV
df_astrowave.to_csv(ruta_archivo, index=False)

print(f'Dataset generado y guardado en {ruta_archivo}.')
print('Vista previa de los datos:')
print(df_astrowave.head())