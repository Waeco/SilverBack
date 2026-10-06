import http.server
import socketserver
import webbrowser

PORT = 8000

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Agregamos cabeceras para evitar problemas de caché durante tus pruebas
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

try:
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        print("\n" + "="*50)
        print(" 🚀 SILVERBACK PLAYGROUND INICIADO CON ÉXITO")
        print(f" 👉 Abre en tu navegador: http://localhost:{PORT}")
        print("="*50)
        print("\nPresiona Ctrl + C en la terminal para apagar el servidor.\n")
        
        # Abre automáticamente la pestaña en tu navegador
        webbrowser.open(f"http://localhost:{PORT}")
        
        # Mantiene el servidor corriendo
        httpd.serve_forever()
        
except KeyboardInterrupt:
    print("\n\n🔌 Servidor apagado. ¡Hasta la próxima, Luis Fernando!")
except Exception as e:
    print(f"\n❌ No se pudo iniciar el servidor: {e}")