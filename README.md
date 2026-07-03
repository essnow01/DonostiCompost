# Donosti Compost

**Donosti Compost** es una aplicación web interactiva desarrollada con **p5.js** que transforma la trama urbana de Donostia / San Sebastián en una retícula visual compostable. El proyecto cruza mapa, datos urbanos, clima y visualización generativa para explorar una idea de **compost digital**: una imagen que se descompone, se reorganiza y vuelve a aparecer como tejido gráfico.

## Demo

Cuando GitHub Pages esté activado, la aplicación podrá verse en:

```txt
https://essnow01.github.io/DonostiCompost/
```

## Descripción

La app carga una trama urbana basada en datos abiertos de OpenStreetMap y la convierte en una composición visual interactiva. El usuario puede modificar el espaciado del hilo, compostar la imagen, reiniciar la composición, centrar la vista, recargar la trama urbana, activar modo térmico, invertir color y capturar una imagen del resultado.

El proyecto está pensado como una pieza visual online, no como una aplicación cerrada para ESP32.

## Funciones principales

- Visualización generativa de la trama urbana de Donostia / San Sebastián.
- Composición reticular con estética de tejido, residuo y compost digital.
- Botón **Compostar** para transformar la imagen.
- Control de **espaciado del hilo**.
- Botón **Reiniciar**.
- Botón **Centrar vista**.
- Botón **Recargar trama urbana**.
- Modo **invertir color**.
- Modo **térmico**, vinculado a datos climáticos.
- Botón de **captura** para guardar una imagen del resultado.

## Tecnologías utilizadas

- HTML
- CSS
- JavaScript
- p5.js
- OpenStreetMap / Overpass API
- Open-Meteo API
- GitHub Pages

## Estructura del proyecto

```txt
DonostiCompost/
├── index.html
├── style.css
├── sketch.js
├── libraries/
├── jsconfig.json
└── README.md
```

## Cómo ejecutar localmente

La forma recomendada es usar **Visual Studio Code** con la extensión **Live Server**.

1. Abre la carpeta del proyecto en VS Code.
2. Instala la extensión **Live Server** si no la tienes.
3. Haz clic derecho sobre `index.html`.
4. Selecciona **Open with Live Server**.

También puedes abrir `index.html` directamente en el navegador, pero algunas funciones pueden comportarse mejor usando un servidor local.

## Cómo subir cambios a GitHub

Después de modificar archivos como `index.html`, `style.css` o `sketch.js`, ejecuta en la terminal:

```bash
git add .
git commit -m "Ajustes en Donosti Compost"
git push
```

## Publicación con GitHub Pages

Para publicar el proyecto:

1. Entra al repositorio en GitHub.
2. Ve a **Settings**.
3. Entra a **Pages**.
4. En **Build and deployment**, selecciona:
   - **Source:** Deploy from a branch
   - **Branch:** main
   - **Folder:** /root
5. Guarda los cambios.

La URL final debería ser:

```txt
https://essnow01.github.io/DonostiCompost/
```

## Notas

- `index.html` debe estar en la raíz del repositorio.
- GitHub Pages distingue entre mayúsculas y minúsculas, por lo que `sketch.js` y `Sketch.js` no son lo mismo.
- Si la web no se actualiza después de hacer cambios, prueba recargar con:

```txt
Cmd + Shift + R
```

o abre la página en una ventana de incógnito.

## Autor

Proyecto desarrollado por Sebastián Correal.

## Licencia

Licencia pendiente de definir.
