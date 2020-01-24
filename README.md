# xdotjson-to-dot

Install
```sh
$ npm install -g xdotjson-to-json
```

Convert your dot file to a json file and then back  
```sh
$ dot -Txdot_json mygraph.dot > mygraph.json
$ cat mygraph.json | xdotjson-to-json > mygraphconverted.dot
```
