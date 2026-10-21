import os
import numpy as np
import pandas as pd
from scipy.io import wavfile
from scipy import signal

#1. Carga de datos
ruta_csv = os.path.join("data", "dataset_astrowave.csv")
df_astrowave = pd.read_csv(ruta_csv)

os.makedirs(os.path.join("data", "audio"), exist_ok=True)

#2. Configuracion de parametros de audio
sample_rate = 44100  
duracion = 4.0       
t = np.linspace(0, duracion, int(sample_rate * duracion), endpoint=False)

def generar_onda_base(tipo_espectral, frecuencia, t):
    clase = str(tipo_espectral)[0].upper()
    
    if clase in ['O', 'B']:
        return signal.sawtooth(2 * np.pi * frecuencia * t)
    elif clase in ['A', 'F']:
        return signal.square(2 * np.pi * frecuencia * t)
    elif clase == 'G':
        return signal.sawtooth(2 * np.pi * frecuencia * t, width=0.5)
    else: # 'K', 'M' y desconocidos
        return np.sin(2 * np.pi * frecuencia * t)

print("Iniciando motor de síntesis AstroWave...")
print("-" * 50)

#3. Generacion de audio por estrella
for index, row in df_astrowave.iterrows():
    estrella = row['Estrella']
    freq = row['AstroWave_Freq_Hz']
    tipo = row['Tipo_Espectral']
    reverb_mix = row['AstroWave_Reverb']
    
    print(f"Sintetizando {estrella} (Freq: {freq}Hz, Timbre: {str(tipo)[0]}, Reverb: {reverb_mix})...")

    #A. Generar Timbre (Tipo Espectral) y Pitch (Freq)
    onda = generar_onda_base(tipo, freq, t)
    
    #B. Generar Envolvente ADSR
    fade_len = int(sample_rate * 0.2) # 200ms de fundido
    envelope = np.ones_like(onda)
    envelope[:fade_len] = np.linspace(0, 1, fade_len)
    envelope[-fade_len:] = np.linspace(1, 0, fade_len)
    onda = onda * envelope
    
    #C. Aplicacion reverb
    delay_samples = int(sample_rate * 0.3) 
    onda_eco = np.zeros_like(onda)
    onda_eco[delay_samples:] = onda[:-delay_samples] * reverb_mix
    
    #Mezcla final de la señal seca + la señal con eco
    onda_final = onda + onda_eco
    
    #D. Normalización a 16-bit PCM (Formato estándar WAV)
    onda_pico = onda_final / np.max(np.abs(onda_final))
    
    #Atenuacion del volumen
    # Si es 220 Hz, el volumen es 1.0 (100%). Si es 880 Hz, baja a 0.15 (15%).
    f_min, f_max = 220.0, 880.0
    freq_clip = np.clip(freq, f_min, f_max) # Por seguridad
    volumen_percibido = 1.0 - 0.85 * ((freq_clip - f_min) / (f_max - f_min))
    
    #Aplicacion del volumen compensado
    onda_compensada = onda_pico * volumen_percibido
    
    #Exportación estándar a 16-bit PCM
    onda_pcm = np.int16(onda_compensada * 32767)
    
    #Exportación
    ruta_salida = os.path.join("data", "audio", f"{estrella}.wav")
    wavfile.write(ruta_salida, sample_rate, onda_pcm)
    

print("-" * 50)
print(f"Archivos .wav generados en la carpeta 'data/audio/'.")