import subprocess
import webbrowser

webbrowser.open("http://localhost:8080")
subprocess.run(["python", "-m", "http.server", "8080"])
