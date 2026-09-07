import sys
import os
import tkinter as tk
import socket
import threading
import webbrowser
import subprocess
import traceback
from tkinter import messagebox

# ==========================================
# CONFIGURACIONES GLOBALES
# ==========================================
PUERTO_DB = 5432       
PUERTO_DJANGO = 5002
CREATE_NO_WINDOW = 0x08000000

class LanzadorSupergrill:
    def __init__(self, root):
        self.root = root
        self.proceso_django = None
        self.postgres_iniciado = False  

        self.ip_actual = self.obtener_ip_local()
        self.url_red = f"http://{self.ip_actual}:{PUERTO_DJANGO}"

        self._configurar_ventana()
        self._construir_interfaz()

    # ==========================================
    # INTERFAZ GRÁFICA (UI)
    # ==========================================
    def _configurar_ventana(self):
        self.root.title("Supergrill")
        try:
            ruta_icono = os.path.join(self.obtener_ruta_base(), "supergrill", "gestion", "static", "gestion", "logo.ico")
            self.root.iconbitmap(ruta_icono)
        except Exception:
            pass

        self.root.geometry("480x320")
        self.root.resizable(False, False)
        self.root.configure(bg="#ffffff")
        self.root.protocol("WM_DELETE_WINDOW", self.cerrar_aplicacion)
        self.root.eval('tk::PlaceWindow . center')

    def _construir_interfaz(self):
        frame_header = tk.Frame(self.root, bg="#ea044e", height=60)
        frame_header.pack(fill="x", side="top")
        frame_header.pack_propagate(False)
        tk.Label(frame_header, text="🍔 SUPERGRILL", font=("Segoe UI", 18, "bold"), bg="#ea044e", fg="#ffffff").pack(pady=12)

        frame_body = tk.Frame(self.root, bg="#ffffff")
        frame_body.pack(fill="both", expand=True, pady=15)
        tk.Label(frame_body, text="Copia y pega esta IP en tu navegador favorito:", font=("Segoe UI", 10), bg="#ffffff", fg="#495057").pack(pady=(0, 5))

        frame_ip = tk.Frame(frame_body, bg="#f8f9fa", bd=1, relief="solid")
        frame_ip.pack(pady=5)

        txt_ip = tk.Entry(frame_ip, font=("Consolas", 15, "bold"), justify="center", bg="#f8f9fa", fg="#212529", relief="flat", width=22)
        txt_ip.insert(0, self.url_red)
        txt_ip.configure(state="readonly")
        txt_ip.pack(side="left", padx=(10, 0), ipady=8)

        btn_copiar = tk.Button(frame_ip, text="📋 Copiar", font=("Segoe UI", 9, "bold"), bg="#dee2e6", fg="#495057",
                               activebackground="#ced4da", relief="flat", cursor="hand2", command=self.copiar_ip)
        btn_copiar.pack(side="right", padx=5, pady=5, ipadx=5, ipady=2)

        self.lbl_aviso_copia = tk.Label(frame_body, text="", font=("Segoe UI", 9, "bold"), bg="#ffffff")
        self.lbl_aviso_copia.pack()

        frame_footer = tk.Frame(self.root, bg="#ffffff")
        frame_footer.pack(side="bottom", fill="x", pady=20)

        self.btn_iniciar = tk.Button(frame_footer, text="🚀 INICIAR SERVIDOR", font=("Segoe UI", 13, "bold"),
                                     bg="#042505", fg="white", activebackground="#0a4b0d", activeforeground="white",
                                     cursor="hand2", relief="flat", command=self.boton_iniciar_click)
        self.btn_iniciar.pack(ipadx=20, ipady=6)

        frame_estado = tk.Frame(frame_footer, bg="#ffffff")
        frame_estado.pack(pady=(10, 0))

        self.lbl_led = tk.Label(frame_estado, text="🔴", font=("Segoe UI", 10), bg="#ffffff", fg="#dc3545")
        self.lbl_led.pack(side="left")

        self.lbl_estado = tk.Label(frame_estado, text="Servidor apagado.", font=("Segoe UI", 9, "italic"), bg="#ffffff", fg="#6c757d")
        self.lbl_estado.pack(side="left", padx=5)

    # ==========================================
    # LÓGICA DE NEGOCIO Y SERVIDOR
    # ==========================================
    @staticmethod
    def obtener_ip_local():
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"

    @staticmethod
    def obtener_ruta_base():
        if getattr(sys, 'frozen', False):
            return os.path.dirname(os.path.abspath(sys.executable))
        return os.path.dirname(os.path.abspath(__file__))

    def rutas_postgres(self):
        ruta_base = self.obtener_ruta_base()
        ruta_basedir = os.path.join(ruta_base, "pgsql")
        return {
            "pg_ctl": os.path.join(ruta_basedir, "bin", "pg_ctl.exe"),
            "datadir": os.path.join(ruta_basedir, "data"),
            "log": os.path.join(ruta_basedir, "postgres.log"),
        }

    def limpiar_procesos_previos(self):
        """Mata cualquier base de datos vieja que haya quedado abierta en la PC."""
        self.root.after(0, lambda: self.lbl_estado.config(text="Limpiando procesos huerfanos...", fg="#17a2b8"))
        
        # Aniquila MariaDB viejo, Postgres trabados, y el controlador de Postgres
        procesos_a_matar = ["mysqld.exe", "postgres.exe", "pg_ctl.exe"]
        
        for proceso in procesos_a_matar:
            try:
                subprocess.run(
                    ["taskkill", "/F", "/IM", proceso, "/T"],
                    creationflags=CREATE_NO_WINDOW,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                pass # Si el proceso no existía, simplemente lo ignora y sigue

    def arrancar_postgres(self):
        try:
            rutas = self.rutas_postgres()
            
            # --- AUTO-CURACIÓN: Borrar candado huérfano si existe ---
            pid_file = os.path.join(rutas["datadir"], "postmaster.pid")
            if os.path.exists(pid_file):
                try:
                    os.remove(pid_file)
                except OSError:
                    pass 

            comando = [
                rutas["pg_ctl"], "start",
                "-D", rutas["datadir"],
                "-o", f"-p {PUERTO_DB}",
                "-l", rutas["log"],
                "-w",
            ]

            resultado = subprocess.run(
                comando,
                creationflags=CREATE_NO_WINDOW,
                stdin=subprocess.DEVNULL,   
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            self.postgres_iniciado = (resultado.returncode == 0)
            return self.postgres_iniciado

        except Exception:
            return False

    def detener_postgres(self):
        if not self.postgres_iniciado:
            return
        try:
            rutas = self.rutas_postgres()
            comando = [rutas["pg_ctl"], "stop", "-D", rutas["datadir"], "-m", "fast"]
            subprocess.run(
                comando,
                creationflags=CREATE_NO_WINDOW,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass

    def arrancar_servidor(self):
        ruta_base = self.obtener_ruta_base()
        python_exe = os.path.join(ruta_base, "env", "Scripts", "python.exe")
        ruta_req = os.path.join(ruta_base, "requirements.txt")

        # --- 0. DESTRUIR BASES DE DATOS VIEJAS O COLGADAS ---
        self.limpiar_procesos_previos()

        # --- 1. CONSTRUCCIÓN AUTOMÁTICA DEL ENTORNO ---
        if not os.path.exists(python_exe):
            self.root.after(0, lambda: self.lbl_estado.config(text="Creando entorno base (1/2)...", fg="#17a2b8"))
            try:
                subprocess.run(
                    ["python", "-m", "venv", "env"],
                    cwd=ruta_base, creationflags=CREATE_NO_WINDOW,
                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
                )
                
                if os.path.exists(ruta_req):
                    self.root.after(0, lambda: self.lbl_estado.config(text="Instalando librerías (2/2)...", fg="#17a2b8"))
                    subprocess.run(
                        [python_exe, "-m", "pip", "install", "-r", "requirements.txt"],
                        cwd=ruta_base, creationflags=CREATE_NO_WINDOW,
                        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
                    )
            except Exception:
                self.root.after(0, lambda: messagebox.showerror("Error de Entorno", "Fallo al crear el entorno virtual.\n\nAsegúrate de tener Python instalado en esta PC y que la opción 'Add Python to PATH' haya sido marcada en el instalador."))
                self.root.after(0, lambda: self.lbl_estado.config(text="Falta instalar Python en la PC.", fg="#dc3545"))
                self.root.after(0, lambda: self.lbl_led.config(text="🔴", fg="#dc3545"))
                return

        # --- 2. ARRANCAR BASE DE DATOS ---
        self.root.after(0, lambda: self.lbl_estado.config(text="Cargando base de datos limpia...", fg="#ffc107"))
        if not self.arrancar_postgres():
            self.root.after(0, lambda: self.lbl_estado.config(text="Error: La base de datos no inició.", fg="#dc3545"))
            self.root.after(0, lambda: self.lbl_led.config(text="🔴", fg="#dc3545"))
            return

        self.root.after(0, lambda: self.lbl_led.config(text="🟢", fg="#28a745"))
        self.root.after(0, lambda: self.lbl_estado.config(text="Servidor corriendo. Minimiza esta ventana.", fg="#28a745"))

        # --- 3. ARRANCAR DJANGO ---
        try:
            ruta_manage = os.path.join(ruta_base, "supergrill", "manage.py")
            ruta_supergrill = os.path.join(ruta_base, "supergrill")

            comando_django = [python_exe, "-u", ruta_manage, "runserver", f"0.0.0.0:{PUERTO_DJANGO}"]

            self.proceso_django = subprocess.Popen(
                comando_django,
                cwd=ruta_supergrill,
                creationflags=CREATE_NO_WINDOW,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

        except Exception:
            error_msg = traceback.format_exc()
            self.root.after(0, lambda: messagebox.showerror("Error Crítico", f"Django falló al iniciar:\n\n{error_msg}"))
            self.root.after(0, lambda: self.lbl_estado.config(text="El servidor web falló.", fg="#dc3545"))
            self.root.after(0, lambda: self.lbl_led.config(text="🔴", fg="#dc3545"))

    def boton_iniciar_click(self):
        self.btn_iniciar.config(text="INICIANDO...", bg="#e9ecef", fg="#6c757d", state="disabled", cursor="arrow")
        self.lbl_led.config(text="🟡", fg="#ffc107")
        self.lbl_estado.config(text="Verificando archivos del sistema...", fg="#ffc107")

        threading.Thread(target=self.arrancar_servidor, daemon=True).start()

        self.root.after(15000, lambda: webbrowser.open(self.url_red))
        self.root.after(16000, self.root.iconify)

    def copiar_ip(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.url_red)
        self.lbl_aviso_copia.config(text="¡Copiado!", fg="#28a745")
        self.root.after(2000, lambda: self.lbl_aviso_copia.config(text=""))

    def cerrar_aplicacion(self):
        if self.proceso_django:
            self.proceso_django.terminate()
        self.detener_postgres()

        self.root.destroy()
        os._exit(0)

if __name__ == "__main__":
    ventana_principal = tk.Tk()
    app_lanzador = LanzadorSupergrill(ventana_principal)
    ventana_principal.mainloop()