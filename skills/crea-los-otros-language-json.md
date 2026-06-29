# Lo que se busca (parte 1)
a partir de src/app/message/en.json se deben crear los otros idiomas, el el archivo en.json está estructurado de la siguiente manera:

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



# Crea/Agrega los otros (language-json)
- debes traducir del inglés ( src/messages/en.json ) a los siguientes idiomas:
  - es, en-gb, pt, fr, de, it, nl, sv, no, da, fi, is, pl, cs, sk, sl, hr, sr, bs, ro, bg, ru, uk, be, el, tr, he, ar, fa, ur, hi, bn, pa, ta, te, ml, mr, gu, kn, th, vi, id, ms, fil, ja, ko, zh, yue, km, lo, my, sw, am, zu, af, xh, eo
  - cada idioma debe tener su propio archivo en src/messages/
- lo que debes traducir es el "texto original", y el texto traducido debe ir en el mismo lugar que el texto original
- debes crear un archivo para cada idioma, o agregar lo faltante si ya existe el archivo
  