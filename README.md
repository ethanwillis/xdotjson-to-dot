# xdotjson-convert

Install
```sh
$ npm install -g xdotjson-convert
```

Convert your dot file to a json file and then back  
```sh
$ dot -Txdot_json mygraph.dot > mygraph.json
$ cat mygraph.json | xdotjson-convert > mygraphconverted.dot
```
