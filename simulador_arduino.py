import json
import random
import time
import urllib.request
import urllib.error

# Substitua pelos dados em: Project Settings -> API no Supabase


def gerar_leitura_simulada():
    # Gera valores normalmente dentro da faixa segura, com chance de pico anômalo
    temp = round(random.uniform(25.5, 28.5), 1)
    ph = round(random.uniform(6.4, 7.6), 2)
    tds = round(random.uniform(140.0, 360.0), 0)

    alerta = (
        temp < 26.0 or temp > 28.0 or
        ph < 6.5 or ph > 7.5 or
        tds < 150.0 or tds > 350.0
    )

    return {
        "temperatura": temp,
        "ph": ph,
        "tds": tds,
        "alerta_ativo": alerta
    }

def enviar_para_supabase(dados):
    payload = json.dumps(dados).encode("utf-8")
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    req = urllib.request.Request(SUPABASE_URL, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"[HTTP {resp.status}] Enviado com sucesso: {dados}")
    except urllib.error.HTTPError as e:
        print(f"[ERRO {e.code}] Falha no Supabase: {e.read().decode()}")
    except Exception as e:
        print(f"[ERRO DE REDE] {e}")

if __name__ == "__main__":
    print("=== Simulando Arduino Uno R4 WiFi -> Supabase (Ctrl+C para parar) ===")
    while True:
        leitura = gerar_leitura_simulada()
        enviar_para_supabase(leitura)
        time.sleep(5)