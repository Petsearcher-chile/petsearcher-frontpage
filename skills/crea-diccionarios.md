# Estado actual
- el proyecto tiene sus textos en español

# Lo que se busca (parte 1)
debes encontrar todos los textos que encuentres que salgan por pantalla o que que estén en las apis, y a partir de esos textos que encontraste, créame un archivo en src/messages/en.json o modifica el que existe con los nuevos valores bajo la siguiente estructura

{
    "Index": {
        "title": "Hola mundo",
        .....
    },
    ....
}

### donde
- Index: es el nombre de la sección o página donde encontraste el texto
- title: <a este texto le llamaremos "texto llave"> ,es el texto que encontraste , pero en minúsculas, y en ingles, los espacios deben ser reemplazados con _ , las vocales con acento deben ser reemplazadas por vocales sin acento, y todo lo adicional que no sea a-z debe ser eliminado
- Hola mundo: es el texto que encontraste <que llamaremos "texto original">

## reemplazo final
- debes tomar los textos originales, sea donde sea que aparezca y reemplazar el texto original por esto t('title'), pero, en donde "title" es el "texto llave"

## traducción final
- debes traducir al inglés
- debes crear un arhivo en src/messages/en.json
- lo que debes traducir es el "texto original", y el texto traducido debe ir en el mismo lugar que el texto original
- haz esto para los idiomas, toma como base "en.json", los idiomas que debes traducir son:
